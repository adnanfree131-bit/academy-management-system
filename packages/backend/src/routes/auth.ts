import { createHash } from 'node:crypto';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { IMailerService } from '../services/mailer.js';
import { ICloudflareService, CloudflareService } from '../services/cloudflare.js';
import { isReservedSlug } from '@apex/shared-types';
import { resolveUserAccess, derivePermissions } from '../lib/access.js';
import { normalizeEffectiveHostname, resolveHostTenant } from '../lib/tenant-resolver.js';
import { getDatabasePool } from '../db/connection.js';

export function authRoutes(
  store: IDataStore,
  _mailer?: IMailerService,
  cloudflare?: ICloudflareService
) {
  const cloudflareService = cloudflare || new CloudflareService();

  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    // -------------------------------------------------------------------------
    // 1. Check Subdomain Availability (Cloudflare for SaaS + Store Check)
    // -------------------------------------------------------------------------
    fastify.get('/check-domain', async (request: any, reply) => {
      const slug = (request.query?.slug || '').trim().toLowerCase();
      if (!slug) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_SLUG', message: 'Subdomain slug is required' },
          timestamp: new Date().toISOString(),
        });
      }

      const domain = `${slug}.${process.env.BASE_DOMAIN || 'kampus.pk'}`;

      if (isReservedSlug(slug)) {
        return reply.send({
          success: true,
          data: {
            slug,
            available: false,
            domain,
            message: `'${slug}' is a reserved platform subdomain and cannot be used.`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Store is the source of truth for registered academies.
      const isStoreAvailable = await store.checkSlugAvailable(slug);
      if (!isStoreAvailable) {
        return reply.send({
          success: true,
          data: {
            slug,
            available: false,
            domain,
            message: 'This subdomain is already registered by another academy.',
          },
          timestamp: new Date().toISOString(),
        });
      }

      const cfResult = await cloudflareService.checkSubdomainAvailable(slug);
      if (!cfResult.available) {
        return reply.send({
          success: true,
          data: {
            slug,
            available: false,
            domain: cfResult.domain,
            message: cfResult.reason || 'This subdomain is unavailable.',
          },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: {
          slug,
          available: true,
          domain: cfResult.domain,
          message: 'Subdomain available!',
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -------------------------------------------------------------------------
    // Deprecated Legacy Auth Endpoints (Return 410 Gone)
    // Supabase Auth is the authoritative provider for all credentials & sessions.
    // -------------------------------------------------------------------------
    const legacyAuthDeprecationHandler = async (_request: any, reply: any) => {
      return reply.status(410).send({
        success: false,
        error: {
          code: 'LEGACY_AUTH_DEPRECATED',
          message: 'Custom password, OTP, and app-signed JWT endpoints have been retired. Use Supabase Auth directly.',
        },
        timestamp: new Date().toISOString(),
      });
    };

    fastify.post('/login', legacyAuthDeprecationHandler);
    fastify.post('/register', legacyAuthDeprecationHandler);
    fastify.post('/verify-registration-otp', legacyAuthDeprecationHandler);
    fastify.post('/forgot-password', legacyAuthDeprecationHandler);
    fastify.post('/reset-password', legacyAuthDeprecationHandler);
    fastify.post('/change-password-otp', legacyAuthDeprecationHandler);
    fastify.post('/change-password', legacyAuthDeprecationHandler);
    fastify.post('/request-otp', legacyAuthDeprecationHandler);
    fastify.post('/verify-otp', legacyAuthDeprecationHandler);

    // -------------------------------------------------------------------------
    // 7. Public Tenant Branding Lookup (for White-Labeling & Subdomains)
    // -------------------------------------------------------------------------
    fastify.get('/branding', async (request: any, reply) => {
      const slug = (request.query?.slug || '').trim();
      const tenant = await store.getTenantBySlug(slug);

      if (!tenant) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Academy not found.' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          campus_name: tenant.settings?.campus_name || 'Main Campus',
          academic_session: tenant.settings?.academic_session || '2026-2027',
          domain: tenant.domain || `${tenant.slug}.kampus.pk`,
          logo_url: tenant.settings?.logo_url || null,
          city: tenant.settings?.city || null,
          phone: tenant.settings?.phone || null,
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -------------------------------------------------------------------------
    // 7.5 Public Host Boundary Resolution (Central Platform vs Academy)
    // -------------------------------------------------------------------------
    fastify.get('/resolve-host', async (request: any, reply) => {
      if (request.query?.host !== undefined && typeof request.query.host === 'string' && request.query.host.trim() === '') {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_HOST', message: 'Host query parameter or valid Host header is required.' },
          timestamp: new Date().toISOString(),
        });
      }
      const rawHost = (request.query?.host as string | undefined) || normalizeEffectiveHostname(request);
      const host = (rawHost || '').split(':')[0].trim().toLowerCase().replace(/\.$/, '');

      if (!host) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_HOST', message: 'Host query parameter or valid Host header is required.' },
          timestamp: new Date().toISOString(),
        });
      }

      let pool: any = request.dbClient || (fastify as any).pg;
      if (!pool) {
        try {
          pool = getDatabasePool();
        } catch {
          pool = null;
        }
      }

      const resolution = await resolveHostTenant(host, pool, store);

      if (resolution.isUnmapped) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'UNMAPPED_HOST',
            message: `Host '${host}' is not associated with an active academy.`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      if (resolution.isCentralHost) {
        return reply.send({
          success: true,
          data: {
            tenant_id: null,
            slug: null,
            name: 'Apex Academy Management System',
            status: 'active',
            is_custom_domain: false,
            is_central_host: true,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Branded host (platform subdomain or verified custom domain)
      let tenant: any = null;
      if (resolution.tenantId) {
        tenant = await store.getTenantById(resolution.tenantId);
      }
      if (!tenant && resolution.tenantSlug) {
        tenant = await store.getTenantBySlug(resolution.tenantSlug);
      }
      if (!tenant && pool && resolution.tenantId) {
        try {
          const res = await pool.query(
            'SELECT id, name, slug, status FROM public.tenants WHERE id = $1',
            [resolution.tenantId]
          );
          if (res.rows.length > 0) tenant = res.rows[0];
        } catch {}
      }

      const tenantId = tenant?.id || resolution.tenantId;
      const tenantSlug = tenant?.slug || resolution.tenantSlug;
      const tenantName = tenant?.name || tenantSlug || 'Academy';
      const tenantStatus = tenant?.status || 'active';
      const isCustomDomain = !!resolution.isCustomDomain;

      return reply.send({
        success: true,
        data: {
          tenant_id: tenantId,
          slug: tenantSlug,
          name: tenantName,
          status: tenantStatus,
          is_custom_domain: isCustomDomain,
        },
        timestamp: new Date().toISOString(),
      });
    });


    // -------------------------------------------------------------------------
    // 8.5 Session Bootstrap Endpoint (Profile & Memberships)
    // -------------------------------------------------------------------------
    fastify.get('/session', {
      onRequest: [(fastify as any).authenticate],
    }, async (request: any, reply) => {
      const auth = request.auth;
      const memberships = await store.getMembershipsByAuthId(auth.user_id);
      const activeTenantId = request.headers['x-tenant-id'] || request.headers['X-Tenant-ID'] || request.user?.tenant_id;
      const activeMembership = activeTenantId ? await store.getMembership(activeTenantId, auth.user_id) : null;
      const activeTenant = activeTenantId ? await store.getTenantById(activeTenantId) : null;

      return reply.send({
        success: true,
        data: {
          profile: auth.profile,
          memberships,
          active_membership: activeMembership,
          active_tenant: activeTenant,
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -------------------------------------------------------------------------
    // 9. Me Endpoint (Session Profile)
    // -------------------------------------------------------------------------
    fastify.get('/me', {
      onRequest: [(fastify as any).authenticate],
    }, async (request: any, reply) => {
      const jwtUser = request.user;
      let user: any = null;
      if (jwtUser?.tenant_id) {
        user = await store.getMembership(jwtUser.tenant_id, jwtUser.auth_user_id || jwtUser.id);
        if (!user && jwtUser.email) {
          user = await store.getUserByEmail(jwtUser.tenant_id, jwtUser.email);
        }
      }
      if (!user && (jwtUser?.role === 'super_admin' || request.auth?.profile?.platform_role === 'super_admin')) {
        user = user || {
          id: request.auth?.user_id || jwtUser?.id,
          tenant_id: '',
          auth_user_id: request.auth?.user_id || jwtUser?.id,
          email: request.auth?.profile?.email || jwtUser?.email,
          full_name: request.auth?.profile?.display_name || jwtUser?.full_name || 'Platform Superadmin',
          role: 'super_admin',
          avatar_url: null,
          metadata: { permissions: ['all'] },
        };
      }
      const tenant = jwtUser?.tenant_id ? await store.getTenantById(jwtUser.tenant_id) : null;

      if (!user && !jwtUser) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User record no longer exists.' },
          timestamp: new Date().toISOString(),
        });
      }

      if (tenant) {
        store.ensureTenantSessions(tenant);
      }
      const workingSession = request.working_session || request.user?.working_session || (tenant ? store.resolveWorkingSession(tenant.id, user || jwtUser) : '2026-2027');
      const yearClosed = request.year_closed !== undefined ? request.year_closed : (tenant ? store.isYearClosed(tenant.id, workingSession) : false);

      const effectiveUser = user || jwtUser;
      return reply.send({
        success: true,
        data: {
          user: {
            id: effectiveUser.id,
            tenant_id: effectiveUser.tenant_id,
            auth_user_id: effectiveUser.auth_user_id || request.auth?.user_id,
            email: effectiveUser.email,
            full_name: effectiveUser.full_name,
            role: effectiveUser.role,
            avatar_url: effectiveUser.avatar_url,
            access: resolveUserAccess(effectiveUser) as any,
            permissions: Array.isArray(effectiveUser.metadata?.permissions) ? effectiveUser.metadata.permissions : derivePermissions(resolveUserAccess(effectiveUser)),
            designation: (effectiveUser.metadata?.designation as string) || undefined,
            must_change_password: Boolean((effectiveUser.metadata as any)?.must_change_password || (effectiveUser.metadata as any)?.requires_password_change),
            working_session: workingSession,
            year_closed: yearClosed,
          },
          tenant: tenant ? {
            ...tenant,
            logo_url: tenant.settings?.logo_url || (tenant.slug === 'tsa' ? '/tsa-logo.png' : null),
            academic_session: tenant.settings?.academic_session || '2026-2027',
            academic_sessions: tenant.settings?.academic_sessions || [],
            campus_name: tenant.settings?.campus_name || 'Main Campus',
          } : null,
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -------------------------------------------------------------------------
    // 10. Authenticated Tenant Onboarding Endpoint
    // -------------------------------------------------------------------------
    fastify.post('/onboard-tenant', {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
      onRequest: [(fastify as any).authenticate],
    }, async (request: any, reply) => {
      const auth = request.auth;
      if (!auth || !auth.user_id) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          timestamp: new Date().toISOString(),
        });
      }

      if (auth.profile?.status !== 'active') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'User profile is not active or verified.' },
          timestamp: new Date().toISOString(),
        });
      }

      const schema = z.object({
        name: z.string().optional(),
        tenant_name: z.string().optional(),
        slug: z.string().optional(),
        tenant_slug: z.string().optional(),
        campus_name: z.string().optional(),
        city: z.string().optional(),
        phone: z.string().optional(),
        logo_url: z.string().optional(),
      }).transform(data => {
        const resolvedName = (data.name ?? data.tenant_name ?? '').trim();
        const resolvedSlug = (data.slug ?? data.tenant_slug ?? '').trim().toLowerCase();
        return {
          name: resolvedName,
          slug: resolvedSlug,
          campus_name: data.campus_name?.trim() || undefined,
          city: data.city?.trim() || undefined,
          phone: data.phone?.trim() || undefined,
          logo_url: data.logo_url?.trim() || undefined,
        };
      }).refine(data => data.name.length >= 2, {
        message: 'Academy name must be at least 2 characters',
        path: ['name'],
      }).refine(data => data.slug.length >= 3 && data.slug.length <= 32, {
        message: 'Academy slug must be between 3 and 32 characters',
        path: ['slug'],
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const { name, slug, campus_name, city, phone, logo_url } = parseResult.data;
      const cleanSlug = slug;

      if (isReservedSlug(cleanSlug)) {
        return reply.status(400).send({
          success: false,
          error: { code: 'SLUG_RESERVED', message: `'${cleanSlug}' is a reserved platform identifier.` },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const result = await store.onboardTenant(auth.user_id, auth.profile.email, auth.profile.display_name, {
          name,
          slug: cleanSlug,
          campusName: campus_name,
          city,
          phone,
          logoUrl: logo_url,
        });

        // Trigger Cloudflare subdomain provisioning
        let provisioningResult: { success: boolean; domain: string; status: 'active' | 'pending' | 'failed'; record_id?: string; error?: string };
        try {
          provisioningResult = await cloudflareService.provisionSubdomain(cleanSlug);
        } catch (err: any) {
          provisioningResult = {
            success: false,
            domain: `${cleanSlug}.${process.env.BASE_DOMAIN || 'kampus.pk'}`,
            status: 'failed',
            error: err.message || 'Network exception connecting to Cloudflare',
          };
        }

        // Durably persist domain provisioning state onto the tenant settings
        if (result.tenant?.id) {
          try {
            await store.updateTenantSettings(result.tenant.id, {
              settings: {
                domain: provisioningResult.domain,
                subdomain: cleanSlug,
                domain_verified: provisioningResult.status === 'active',
                domain_provisioning_status: provisioningResult.status,
                domain_provisioning_error: provisioningResult.error || null,
                domain_provisioned_at: new Date().toISOString(),
              } as any,
            });
            if (result.tenant.settings) {
              result.tenant.settings.domain = provisioningResult.domain;
              result.tenant.settings.subdomain = cleanSlug;
              result.tenant.settings.domain_verified = provisioningResult.status === 'active';
              result.tenant.settings.domain_provisioning_status = provisioningResult.status;
              result.tenant.settings.domain_provisioning_error = provisioningResult.error || null;
              result.tenant.settings.domain_provisioned_at = new Date().toISOString();
            }
          } catch (persistErr) {
            console.error('[Onboard] Failed to persist provisioning status:', persistErr);
          }
        }

        return reply.status(201).send({
          success: true,
          data: {
            ...result,
            domain_provisioning: provisioningResult,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        const status = err.code === 'SLUG_ALREADY_EXISTS' ? 409 : 400;
        return reply.status(status).send({
          success: false,
          error: { code: err.code || 'ONBOARDING_FAILED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // -------------------------------------------------------------------------
    // 10b. Reconcile / Retry Subdomain Provisioning (Finding C06)
    // -------------------------------------------------------------------------
    fastify.post('/reconcile-domain', {
      onRequest: [(fastify as any).authenticate],
    }, async (request: any, reply) => {
      const user = request.user;
      const auth = request.auth;

      const isTenantAdmin =
        user?.role === 'tenant_admin' ||
        user?.role === 'director' ||
        auth?.profile?.platform_role === 'super_admin';

      if (!isTenantAdmin) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only tenant administrators or platform superadmins can reconcile domain provisioning.',
          },
          timestamp: new Date().toISOString(),
        });
      }

      const tenantId =
        user?.tenant_id ||
        (request.headers['x-tenant-id'] as string) ||
        (request.headers['X-Tenant-ID'] as string);

      if (!tenantId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'TENANT_REQUIRED',
            message: 'Tenant identifier is required for domain reconciliation.',
          },
          timestamp: new Date().toISOString(),
        });
      }

      const tenant = await store.getTenantById(tenantId);
      if (!tenant) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'TENANT_NOT_FOUND',
            message: `Tenant '${tenantId}' was not found.`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      let provisioningResult: { success: boolean; domain: string; status: 'active' | 'pending' | 'failed'; record_id?: string; error?: string };
      try {
        provisioningResult = await cloudflareService.provisionSubdomain(tenant.slug);
      } catch (err: any) {
        provisioningResult = {
          success: false,
          domain: `${tenant.slug}.${process.env.BASE_DOMAIN || 'kampus.pk'}`,
          status: 'failed',
          error: err.message || 'Provisioning exception',
        };
      }

      await store.updateTenantSettings(tenant.id, {
        settings: {
          domain: provisioningResult.domain,
          subdomain: tenant.slug,
          domain_verified: provisioningResult.status === 'active',
          domain_provisioning_status: provisioningResult.status,
          domain_provisioning_error: provisioningResult.error || null,
          domain_provisioned_at: new Date().toISOString(),
        } as any,
      });

      return reply.send({
        success: true,
        data: {
          tenant_id: tenant.id,
          slug: tenant.slug,
          domain: provisioningResult.domain,
          status: provisioningResult.status,
          verified: provisioningResult.status === 'active',
          error: provisioningResult.error || null,
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -------------------------------------------------------------------------
    // 10b. List Tenant Invitations Endpoint (Finding B11)
    // -------------------------------------------------------------------------
    fastify.get('/invitations', {
      onRequest: [(fastify as any).authenticate],
    }, async (request: any, reply) => {
      const user = request.user;
      const auth = request.auth;

      if (!user?.tenant_id) {
        return reply.status(400).send({
          success: false,
          error: { code: 'TENANT_REQUIRED', message: 'X-Tenant-ID header is required.' },
          timestamp: new Date().toISOString(),
        });
      }

      if (user.role !== 'tenant_admin' && user.role !== 'owner' && auth?.profile?.platform_role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Only academy administrators can view invitations.' },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const invitations = await store.listInvitations(user.tenant_id);
        return reply.send({
          success: true,
          data: invitations,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: err.code || 'LIST_INVITATIONS_FAILED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // -------------------------------------------------------------------------
    // 11. Create Tenant Membership Invitation
    // -------------------------------------------------------------------------
    fastify.post('/invitations', {
      onRequest: [(fastify as any).authenticate],
    }, async (request: any, reply) => {
      const user = request.user;
      const auth = request.auth;

      if (!user?.tenant_id) {
        return reply.status(400).send({
          success: false,
          error: { code: 'TENANT_REQUIRED', message: 'X-Tenant-ID header is required.' },
          timestamp: new Date().toISOString(),
        });
      }

      if (user.role !== 'tenant_admin' && auth?.profile?.platform_role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only academy administrators can invite users.' },
          timestamp: new Date().toISOString(),
        });
      }

      const schema = z.object({
        email: z.string().email(),
        role: z.enum(['tenant_admin', 'academic_head', 'teacher', 'finance_manager', 'parent', 'student']),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const { email, role } = parseResult.data;

      try {
        const result = await store.createInvitation(user.tenant_id, user.id, email, role);

        return reply.status(201).send({
          success: true,
          data: {
            invitation: result.invitation,
            token: result.raw_token,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: err.code || 'INVITATION_FAILED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // -------------------------------------------------------------------------
    // 12. Revoke Invitation
    // -------------------------------------------------------------------------
    fastify.post('/invitations/:id/revoke', {
      onRequest: [(fastify as any).authenticate],
    }, async (request: any, reply) => {
      const user = request.user;
      const auth = request.auth;
      const { id } = request.params as { id: string };

      if (!user?.tenant_id) {
        return reply.status(400).send({
          success: false,
          error: { code: 'TENANT_REQUIRED', message: 'X-Tenant-ID header is required.' },
          timestamp: new Date().toISOString(),
        });
      }

      if (user.role !== 'tenant_admin' && auth?.profile?.platform_role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only academy administrators can revoke invitations.' },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        await store.revokeInvitation(user.tenant_id, id, user.id, user.email || auth.profile.email);

        return reply.send({
          success: true,
          message: 'Invitation revoked successfully.',
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: err.code || 'REVOKE_FAILED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // -------------------------------------------------------------------------
    // 13. Public Inspect Invitation Endpoint (supports both :token/inspect and :token)
    // -------------------------------------------------------------------------
    const inspectInvitationHandler = async (request: any, reply: any) => {
      const { token } = request.params as { token: string };
      if (!token || !token.trim()) {
        return reply.status(400).send({
          success: false,
          error: { code: 'TOKEN_REQUIRED', message: 'Invitation token is required.' },
          timestamp: new Date().toISOString(),
        });
      }

      const tokenHash = createHash('sha256').update(token.trim()).digest('hex');

      try {
        const inv = await store.getInvitationByTokenHash(tokenHash);

        if (!inv) {
          return reply.status(404).send({
            success: false,
            error: { code: 'INVITATION_NOT_FOUND', message: 'Invitation was not found.' },
            timestamp: new Date().toISOString(),
          });
        }

        if (inv.revoked_at) {
          return reply.status(410).send({
            success: false,
            error: { code: 'INVITATION_REVOKED', message: 'This invitation has been revoked.' },
            timestamp: new Date().toISOString(),
          });
        }

        if (inv.accepted_at) {
          return reply.status(410).send({
            success: false,
            error: { code: 'INVITATION_ALREADY_ACCEPTED', message: 'This invitation was already accepted.' },
            timestamp: new Date().toISOString(),
          });
        }

        if (new Date(inv.expires_at).getTime() < Date.now()) {
          return reply.status(410).send({
            success: false,
            error: { code: 'INVITATION_EXPIRED', message: 'This invitation has expired.' },
            timestamp: new Date().toISOString(),
          });
        }

        return reply.send({
          success: true,
          data: {
            tenant_name: inv.tenant_name,
            tenant_slug: inv.tenant_slug,
            email: inv.email,
            role: inv.role,
            expires_at: inv.expires_at,
            is_valid: true,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: 'INSPECT_FAILED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };

    fastify.get('/invitations/:token/inspect', inspectInvitationHandler);
    fastify.get('/invitations/:token', inspectInvitationHandler);

    // -------------------------------------------------------------------------
    // 14. Accept Invitation Endpoint (supports both /accept and /:token/accept)
    // -------------------------------------------------------------------------
    const acceptInvitationHandler = async (request: any, reply: any) => {
      const auth = request.auth;
      const paramToken = (request.params as any)?.token;
      const bodyToken = (request.body as any)?.token;
      const token = (paramToken || bodyToken || '').trim();

      if (!token) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Token is required' },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const result = await store.acceptInvitation(
          token,
          auth.user_id,
          auth.profile.email,
          auth.profile.display_name
        );

        return reply.send({
          success: true,
          data: result,
          message: 'Invitation accepted successfully.',
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        const status =
          err.code === 'INVITATION_NOT_FOUND' ? 404 :
          err.code === 'EMAIL_MISMATCH' ? 403 :
          err.code === 'INVITATION_REVOKED' || err.code === 'INVITATION_EXPIRED' || err.code === 'INVITATION_ALREADY_ACCEPTED' ? 410 : 400;

        return reply.status(status).send({
          success: false,
          error: { code: err.code || 'ACCEPT_FAILED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };

    fastify.post('/invitations/accept', {
      config: {
        rateLimit: {
          max: 15,
          timeWindow: '1 minute',
        },
      },
      onRequest: [(fastify as any).authenticate],
    }, acceptInvitationHandler);

    fastify.post('/invitations/:token/accept', {
      config: {
        rateLimit: {
          max: 15,
          timeWindow: '1 minute',
        },
      },
      onRequest: [(fastify as any).authenticate],
    }, acceptInvitationHandler);
  };
}
