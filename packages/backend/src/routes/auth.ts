import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/auth.js';
import { IDataStore } from '../services/store.js';
import { IMailerService } from '../services/mailer.js';
import { ICloudflareService, CloudflareService } from '../services/cloudflare.js';
import { hashPassword } from '../services/password.js';
import { JWTPayload, AuthSessionResponse } from '@apex/shared-types';

export function authRoutes(
  store: IDataStore,
  mailer: IMailerService,
  cloudflare?: ICloudflareService
) {
  const authService = new AuthService(store, mailer);
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

      // Check format and DNS
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

      // Check if already taken in our store
      const isStoreAvailable = await store.checkSlugAvailable(slug);
      if (!isStoreAvailable) {
        return reply.send({
          success: true,
          data: {
            slug,
            available: false,
            domain: cfResult.domain,
            message: 'This subdomain is already registered by another academy.',
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
    // 2. Daily Operational Sign In: Email + Password
    // -------------------------------------------------------------------------
    fastify.post('/login', async (request, reply) => {
      const schema = z.object({
        email: z.string().email('Please enter a valid institutional email address.'),
        password: z.string().min(1, 'Password is required.'),
        tenant_slug: z.string().optional(),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email and password are required.',
            details: parseResult.error.flatten(),
          },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const { email, password, tenant_slug } = parseResult.data;
        const { user, tenant } = await authService.loginWithPassword(email, password, tenant_slug);

        const jwtPayload: JWTPayload = {
          sub: user.id,
          tenant_id: tenant.id,
          email: user.email,
          role: user.role,
        };

        const token = fastify.jwt.sign(jwtPayload, { expiresIn: '7d' });

        const sessionResponse: AuthSessionResponse = {
          token,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          user: {
            id: user.id,
            tenant_id: user.tenant_id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            avatar_url: user.avatar_url,
          },
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
            academic_session: tenant.settings?.academic_session || '2026-2027',
            campus_name: tenant.settings?.campus_name || 'Main Campus',
            logo_url: tenant.settings?.logo_url || null,
            city: tenant.settings?.city || null,
          },
        };

        return reply.send({
          success: true,
          data: sessionResponse,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: err.message || 'Invalid email or password.',
          },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // -------------------------------------------------------------------------
    // 3. Register Academy: Provisions Subdomain in Cloudflare & Dispatches Brevo OTP
    // -------------------------------------------------------------------------
    fastify.post('/register', async (request, reply) => {
      const schema = z.object({
        name: z.string().min(2, 'Academy name must be at least 2 characters'),
        slug: z.string().min(2, 'Subdomain identifier must be at least 2 characters'),
        city: z.string().optional(),
        phone: z.string().optional(),
        logo_url: z.string().optional(),
        campus_name: z.string().optional(),
        admin_name: z.string().min(2, 'Administrator name is required'),
        admin_email: z.string().email('Valid institutional email is required'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Please complete all required fields.',
            details: parseResult.error.flatten(),
          },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const { name, slug, city, phone, logo_url, campus_name, admin_name, admin_email, password } = parseResult.data;
        const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');

        // Check if slug is taken
        const isAvailable = await store.checkSlugAvailable(cleanSlug);
        if (!isAvailable) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'SLUG_IN_USE',
              message: `The subdomain identifier '${cleanSlug}' is already registered. Please choose another identifier.`,
            },
            timestamp: new Date().toISOString(),
          });
        }

        // Auto-provision domain in Cloudflare for SaaS
        await cloudflareService.provisionSubdomain(cleanSlug);

        // Hash password with scrypt
        const passwordHash = hashPassword(password);

        // Create tenant & admin user
        const { tenant, admin } = await store.createTenant({
          name,
          slug: cleanSlug,
          campus_name: campus_name || 'Main Campus',
          city,
          phone,
          logo_url,
          admin_name,
          admin_email,
          password_hash: passwordHash,
        });

        // Set status to pending_verification until email OTP is confirmed
        tenant.status = 'pending_verification' as any;
        admin.status = 'pending_verification' as any;

        // Dispatch OTP verification code via Brevo
        const otpResult = await authService.requestOTP(admin.email, tenant.slug);

        return reply.status(201).send({
          success: true,
          data: {
            tenant: {
              id: tenant.id,
              name: tenant.name,
              slug: tenant.slug,
              domain: tenant.domain,
              campus_name: tenant.settings?.campus_name,
              logo_url: tenant.settings?.logo_url,
              city: tenant.settings?.city,
            },
            admin: {
              email: admin.email,
              full_name: admin.full_name,
            },
            otp_preview: otpResult.dev_otp_preview,
            message: `A 6-digit verification code has been sent to ${admin.email}. Please enter the code below to complete setup.`,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'REGISTRATION_FAILED',
            message: err.message || 'Failed to register academy.',
          },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // -------------------------------------------------------------------------
    // 4. Verify Registration OTP: Activates Tenant and Issues JWT Session
    // -------------------------------------------------------------------------
    fastify.post('/verify-registration-otp', async (request, reply) => {
      const schema = z.object({
        email: z.string().email(),
        otp: z.string().length(6, 'Verification code must be 6 digits'),
        tenant_slug: z.string().min(1),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid 6-digit code and email are required.',
            details: parseResult.error.flatten(),
          },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const { email, otp, tenant_slug } = parseResult.data;
        const { user, tenant } = await authService.verifyOTP(email, otp, tenant_slug);

        const jwtPayload: JWTPayload = {
          sub: user.id,
          tenant_id: tenant.id,
          email: user.email,
          role: user.role,
        };

        const token = fastify.jwt.sign(jwtPayload, { expiresIn: '7d' });

        const sessionResponse: AuthSessionResponse = {
          token,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          user: {
            id: user.id,
            tenant_id: user.tenant_id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            avatar_url: user.avatar_url,
          },
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
            academic_session: tenant.settings?.academic_session || '2026-2027',
            campus_name: tenant.settings?.campus_name || 'Main Campus',
            logo_url: tenant.settings?.logo_url || null,
            city: tenant.settings?.city || null,
          },
        };

        return reply.send({
          success: true,
          data: sessionResponse,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'AUTH_VERIFICATION_FAILED',
            message: err.message || 'Invalid or expired verification code.',
          },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // -------------------------------------------------------------------------
    // 5. Password Reset Request: Sends 6-digit OTP via Brevo
    // -------------------------------------------------------------------------
    fastify.post('/forgot-password', async (request, reply) => {
      const schema = z.object({
        email: z.string().email('Valid institutional email is required'),
        tenant_slug: z.string().optional(),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Valid email is required.' },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const { email, tenant_slug } = parseResult.data;
        const result = await authService.requestPasswordReset(email, tenant_slug);
        return reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'FORGOT_PASSWORD_FAILED', message: err.message || 'Failed to dispatch reset code.' },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // -------------------------------------------------------------------------
    // 6. Reset Password Confirmation
    // -------------------------------------------------------------------------
    fastify.post('/reset-password', async (request, reply) => {
      const schema = z.object({
        email: z.string().email(),
        otp: z.string().length(6, 'Verification code must be 6 digits'),
        new_password: z.string().min(6, 'Password must be at least 6 characters'),
        tenant_slug: z.string().optional(),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Please complete all fields with a valid 6-digit code.' },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const { email, otp, new_password, tenant_slug } = parseResult.data;
        await authService.resetPassword(email, otp, new_password, tenant_slug);
        return reply.send({
          success: true,
          message: 'Password updated successfully. You can now sign in with your new password.',
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'RESET_PASSWORD_FAILED', message: err.message || 'Failed to reset password.' },
          timestamp: new Date().toISOString(),
        });
      }
    });

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
          domain: tenant.domain || `${tenant.slug}.toolnestr.com`,
          logo_url: tenant.settings?.logo_url || null,
          city: tenant.settings?.city || null,
          phone: tenant.settings?.phone || null,
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -------------------------------------------------------------------------
    // 8. Legacy / Direct OTP Endpoints (Maintained for Test Compatibility)
    // -------------------------------------------------------------------------
    fastify.post('/request-otp', async (request, reply) => {
      const schema = z.object({
        email: z.string().email(),
        tenant_slug: z.string().min(1).default('apex'),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'A valid email and academy tenant slug are required.',
            details: parseResult.error.flatten(),
          },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const { email, tenant_slug } = parseResult.data;
        const result = await authService.requestOTP(email, tenant_slug);
        return reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'AUTH_REQUEST_FAILED',
            message: err.message || 'Failed to dispatch verification code.',
          },
          timestamp: new Date().toISOString(),
        });
      }
    });

    fastify.post('/verify-otp', async (request, reply) => {
      const schema = z.object({
        email: z.string().email(),
        otp: z.string().length(6, 'Verification code must be 6 digits'),
        tenant_slug: z.string().min(1).default('apex'),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid 6-digit code and email are required.',
            details: parseResult.error.flatten(),
          },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const { email, otp, tenant_slug } = parseResult.data;
        const { user, tenant } = await authService.verifyOTP(email, otp, tenant_slug);

        const jwtPayload: JWTPayload = {
          sub: user.id,
          tenant_id: tenant.id,
          email: user.email,
          role: user.role,
        };

        const token = fastify.jwt.sign(jwtPayload, { expiresIn: '7d' });

        const sessionResponse: AuthSessionResponse = {
          token,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          user: {
            id: user.id,
            tenant_id: user.tenant_id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            avatar_url: user.avatar_url,
          },
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
            academic_session: tenant.settings?.academic_session || '2026-2027',
            campus_name: tenant.settings?.campus_name || 'Main Campus',
            logo_url: tenant.settings?.logo_url || null,
            city: tenant.settings?.city || null,
          },
        };

        return reply.send({
          success: true,
          data: sessionResponse,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'AUTH_VERIFICATION_FAILED',
            message: err.message || 'Invalid or expired verification code.',
          },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // -------------------------------------------------------------------------
    // 9. Me Endpoint (Session Profile)
    // -------------------------------------------------------------------------
    fastify.get('/me', {
      onRequest: [(fastify as any).authenticate],
    }, async (request: any, reply) => {
      const jwtUser = request.user as JWTPayload;
      const user = await store.getUserByEmail(jwtUser.tenant_id, jwtUser.email);
      const tenant = await store.getTenantById(jwtUser.tenant_id);

      if (!user || !tenant) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User or tenant record no longer exists.' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: {
          user,
          tenant,
        },
        timestamp: new Date().toISOString(),
      });
    });
  };
}
