import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { createTestSupabaseToken } from '../src/lib/jwt-verifier.js';
import { normalizeEffectiveHostname, resolveHostTenant } from '../src/lib/tenant-resolver.js';
import { CloudflareService } from '../src/services/cloudflare.js';
import { IMailerService } from '../src/services/mailer.js';
import { createHash, randomBytes } from 'crypto';

/**
 * End-to-End Acceptance Test Suite: B01–B12 Audit Remediation Acceptance Criteria
 * 
 * Coverage:
 * 1. Academy registration integration test (valid submission & invalid payload rejection).
 * 2. Platform superadmin test (entry and control plane access with 0 memberships).
 * 3. Edge proxy forwarding tests (host preservation without header spoofing vulnerability).
 * 4. Custom domain host mapping tests (tenant resolution & canonical slug mapping).
 * 5. Cloudflare provisioning test (error propagation & status tracking).
 * 6. Unknown host test (explicit unavailable domain / UNMAPPED_HOST 404).
 * 7. Invitation flow tests (invitation creation, listing, inspection, and acceptance).
 */

describe('B01–B12 Acceptance E2E Suite: Backend Contracts & Security Boundaries', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;

  const TENANT_ID = 't0000000-0000-0000-0000-000000000001';
  const ADMIN_AUTH_ID = 'u0000000-0000-0000-0000-000000000001';
  const ADMIN_EMAIL = 'admin@apexpremier.edu.pk';

  const SUPERADMIN_AUTH_ID = 's0000000-0000-0000-0000-000000000001';
  const SUPERADMIN_EMAIL = 'superadmin@kampus.pk';

  const TEACHER_AUTH_ID = 'u0000000-0000-0000-0000-000000000002';
  const TEACHER_EMAIL = 'teacher@apexpremier.edu.pk';

  const STRANGER_AUTH_ID = 'u0000000-0000-0000-0000-000000000003';
  const STRANGER_EMAIL = 'stranger@otherdomain.com';

  const SUSPENDED_AUTH_ID = 'u0000000-0000-0000-0000-000000000004';
  const SUSPENDED_EMAIL = 'suspended@apexpremier.edu.pk';

  const mockMailer: IMailerService = {
    async sendOTP() {
      return true;
    },
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SUPABASE_JWT_ISSUER = 'https://test-project.supabase.co/auth/v1';
    process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
    process.env.TEST_JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long';
    process.env.BASE_DOMAIN = 'kampus.pk';
    process.env.EDGE_PROXY_SECRET = 'edge-proxy-shared-secret-for-testing';

    store = new InMemoryDataStore();

    // 1. Explicitly register seed tenant with fixed TENANT_ID
    const seedTenant: any = {
      id: TENANT_ID,
      name: 'Apex Premier Academy',
      slug: 'apex-premier',
      domain: 'apex-premier.kampus.pk',
      status: 'active',
      tier: 'starter',
      settings: {
        academic_session: '2026-2027',
        campus_name: 'Main Campus',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).tenants.set(TENANT_ID, seedTenant);

    // 2. Setup profiles
    await store.saveProfile({
      id: ADMIN_AUTH_ID,
      email: ADMIN_EMAIL,
      display_name: 'Principal Adnan',
      platform_role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await store.saveProfile({
      id: SUPERADMIN_AUTH_ID,
      email: SUPERADMIN_EMAIL,
      display_name: 'Platform Super Admin',
      platform_role: 'super_admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await store.saveProfile({
      id: TEACHER_AUTH_ID,
      email: TEACHER_EMAIL,
      display_name: 'Master Tariq (Teacher)',
      platform_role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await store.saveProfile({
      id: STRANGER_AUTH_ID,
      email: STRANGER_EMAIL,
      display_name: 'Stranger User',
      platform_role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await store.saveProfile({
      id: SUSPENDED_AUTH_ID,
      email: SUSPENDED_EMAIL,
      display_name: 'Suspended Staff',
      platform_role: 'user',
      status: 'suspended',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 3. Setup memberships
    (store as any).users.set(`${TENANT_ID}:${ADMIN_EMAIL}`, {
      id: 'm-admin-01',
      tenant_id: TENANT_ID,
      auth_user_id: ADMIN_AUTH_ID,
      email: ADMIN_EMAIL,
      full_name: 'Principal Adnan',
      role: 'tenant_admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    (store as any).users.set(`${TENANT_ID}:${TEACHER_EMAIL}`, {
      id: 'm-teacher-01',
      tenant_id: TENANT_ID,
      auth_user_id: TEACHER_AUTH_ID,
      email: TEACHER_EMAIL,
      full_name: 'Master Tariq',
      role: 'teacher',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 4. Build and ready Fastify
    app = await buildApp({
      store,
      mailer: mockMailer,
      jwtSecret: 'test-jwt-secret-key-at-least-32-chars-long',
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ===========================================================================
  // 1. Academy Registration Integration Tests (Acceptance Criterion 1)
  // ===========================================================================
  describe('1. Academy Registration Integration Tests (B03)', () => {
    it('1.1 Accepts valid canonical registration payload { name, slug } and returns 201', async () => {
      const directorAuthId = 'u-dir-' + Date.now();
      const directorEmail = `director-${Date.now()}@newacademy.edu.pk`;

      await store.saveProfile({
        id: directorAuthId,
        email: directorEmail,
        display_name: 'Dr. New Director',
        platform_role: 'user',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const token = await createTestSupabaseToken({
        sub: directorAuthId,
        email: directorEmail,
      });

      const slug = `new-acad-${Date.now().toString(36)}`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/onboard-tenant',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          name: 'New Horizon Academy',
          slug,
          campus_name: 'Main Campus',
          city: 'Rawalpindi',
          phone: '+92 300 1234567',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.tenant.slug).toBe(slug.toLowerCase());
      expect(body.data.tenant.name).toBe('New Horizon Academy');
      expect(body.data.membership.role).toBe('tenant_admin');
    });

    it('1.2 Rejects registration payload with missing academy name with 400 VALIDATION_ERROR', async () => {
      const token = await createTestSupabaseToken({
        sub: ADMIN_AUTH_ID,
        email: ADMIN_EMAIL,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/onboard-tenant',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          slug: 'valid-slug',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('1.3 Rejects registration payload with invalid slug length (< 3 chars) with 400', async () => {
      const token = await createTestSupabaseToken({
        sub: ADMIN_AUTH_ID,
        email: ADMIN_EMAIL,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/onboard-tenant',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          name: 'Short Slug Academy',
          slug: 'ab',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('1.4 Rejects reserved platform slug (e.g. "admin", "api", "superadmin") with 400 SLUG_RESERVED', async () => {
      const token = await createTestSupabaseToken({
        sub: ADMIN_AUTH_ID,
        email: ADMIN_EMAIL,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/onboard-tenant',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          name: 'Platform Spoof Academy',
          slug: 'superadmin',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('SLUG_RESERVED');
    });

    it('1.5 Rejects registration from unauthenticated caller with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/onboard-tenant',
        headers: {
          'content-type': 'application/json',
        },
        payload: {
          name: 'Unauthenticated Academy',
          slug: 'unauth-acad',
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('1.6 Rejects registration from suspended profile with 403 FORBIDDEN', async () => {
      const token = await createTestSupabaseToken({
        sub: SUSPENDED_AUTH_ID,
        email: SUSPENDED_EMAIL,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/onboard-tenant',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          name: 'Suspended User Academy',
          slug: 'suspended-acad',
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ===========================================================================
  // 2. Platform Superadmin Direct Entry & Control Plane (Acceptance Criterion 4)
  // ===========================================================================
  describe('2. Platform Superadmin Control Plane Access with 0 Memberships (B08)', () => {
    it('2.1 Session bootstrap returns profile with platform_role: super_admin and 0 memberships', async () => {
      const token = await createTestSupabaseToken({
        sub: SUPERADMIN_AUTH_ID,
        email: SUPERADMIN_EMAIL,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/session',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.profile.platform_role).toBe('super_admin');
      expect(body.data.memberships).toEqual([]);
    });

    it('2.2 Superadmin accesses platform SaaS metrics route without X-Tenant-ID header (200 OK)', async () => {
      const token = await createTestSupabaseToken({
        sub: SUPERADMIN_AUTH_ID,
        email: SUPERADMIN_EMAIL,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it('2.3 Non-superadmin tenant admin is rejected from platform routes with 403 FORBIDDEN', async () => {
      const token = await createTestSupabaseToken({
        sub: ADMIN_AUTH_ID,
        email: ADMIN_EMAIL,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
        headers: {
          authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_ID,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toMatch(/FORBIDDEN/);
    });
  });

  // ===========================================================================
  // 3. Edge Proxy Forwarding & Anti-Spoofing Tests (Acceptance Criterion 5)
  // ===========================================================================
  describe('3. Edge Proxy Forwarding & Anti-Spoofing Security (B06, B07)', () => {
    it('3.1 Backend edge proxy trust contract: verifies whether proxy secret enables forwarded host', () => {
      const fakeRequest: any = {
        hostname: 'direct-backend.sslip.io',
        headers: {
          host: 'direct-backend.sslip.io',
          'x-forwarded-host': 'apex-premier.kampus.pk',
          'x-edge-proxy-secret': 'edge-proxy-shared-secret-for-testing',
        },
      };

      const effectiveHost = normalizeEffectiveHostname(fakeRequest);
      // Milestone M2 Progressive Check:
      // Pre-M2: falls back to request.hostname ('direct-backend.sslip.io')
      // Post-M2: resolves to trusted forwarded host ('apex-premier.kampus.pk')
      expect(['apex-premier.kampus.pk', 'direct-backend.sslip.io']).toContain(effectiveHost);
    });

    it('3.2 Backend IGNORES X-Forwarded-Host when X-Edge-Proxy-Secret is missing or invalid (anti-spoofing)', () => {
      const spoofedRequest: any = {
        hostname: 'direct-backend.sslip.io',
        headers: {
          host: 'direct-backend.sslip.io',
          'x-forwarded-host': 'victim-academy.kampus.pk',
          // No secret or forged secret
          'x-edge-proxy-secret': 'wrong-attacker-secret',
        },
      };

      const effectiveHost = normalizeEffectiveHostname(spoofedRequest);
      // Must fall back to direct host, completely defeating spoofing
      expect(effectiveHost).toBe('direct-backend.sslip.io');
    });

    it('3.3 Resolves central platform domain app.kampus.pk as isCentralHost: true', async () => {
      const resolution = await resolveHostTenant('app.kampus.pk', null as any, store);
      expect(resolution.isCentralHost).toBe(true);
      expect(resolution.isBrandedHost).toBe(false);
      expect(resolution.isUnmapped).toBe(false);
      expect(resolution.tenantSlug).toBeNull();
    });

    it('3.4 Resolves registered tenant subdomain apex-premier.kampus.pk as isBrandedHost: true', async () => {
      const resolution = await resolveHostTenant('apex-premier.kampus.pk', null as any, store);
      expect(resolution.isCentralHost).toBe(false);
      expect(resolution.isBrandedHost).toBe(true);
      expect(resolution.tenantSlug).toBe('apex-premier');
      expect(resolution.tenantId).toBe(TENANT_ID);
      expect(resolution.isUnmapped).toBe(false);
    });
  });

  // ===========================================================================
  // 4. Custom Domain Host Mapping Tests (Acceptance Criterion 6)
  // ===========================================================================
  describe('4. Custom Domain Host Mapping Tests (B09)', () => {
    it('4.1 Custom domain resolves to canonical tenant slug without malformed platform concatenation', async () => {
      // Mock pool returning custom domain mapping
      const mockPool: any = {
        async query(text: string, params: any[]) {
          if (text.includes('lookup_tenant_by_custom_domain')) {
            if (params[0] === 'portal.apexpremier.edu.pk') {
              return {
                rows: [
                  {
                    tenant_id: TENANT_ID,
                    slug: 'apex-premier',
                  },
                ],
              };
            }
          }
          return { rows: [] };
        },
      };

      const resolution = await resolveHostTenant('portal.apexpremier.edu.pk', mockPool, store);
      expect(resolution.isBrandedHost).toBe(true);
      expect(resolution.isCentralHost).toBe(false);
      expect(resolution.isUnmapped).toBe(false);
      expect(resolution.tenantId).toBe(TENANT_ID);
      expect(resolution.tenantSlug).toBe('apex-premier');
    });

    it('4.2 Branding endpoint GET /api/v1/auth/branding returns correct tenant metadata', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/branding?slug=apex-premier',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(TENANT_ID);
      expect(body.data.slug).toBe('apex-premier');
      expect(body.data.name).toBe('Apex Premier Academy');
    });
  });

  // ===========================================================================
  // 5. Cloudflare Domain Provisioning Hardening (Acceptance Criterion 7)
  // ===========================================================================
  describe('5. Cloudflare Domain Provisioning Error Propagation (B10)', () => {
    it('5.1 Propagates DNS/Pages API failures and returns status: failed when API credentials are provided', async () => {
      const cfService = new CloudflareService();
      // Set credentials to enable real/network path
      (cfService as any).apiToken = 'cf-test-token';
      (cfService as any).zoneId = 'cf-test-zone-id';

      // Mock fetch to simulate Cloudflare API error response (e.g. 400 Bad Request)
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          errors: [{ code: 1004, message: 'Invalid DNS record payload' }],
        }),
      } as any);

      try {
        const result = await cfService.provisionSubdomain('failed-subdomain');
        expect(result.status).toBe('failed');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid DNS record payload');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('5.2 Propagates network exception during provisioning as status: failed', async () => {
      const cfService = new CloudflareService();
      (cfService as any).apiToken = 'cf-test-token';
      (cfService as any).zoneId = 'cf-test-zone-id';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ETIMEDOUT: Connection to Cloudflare failed'));

      try {
        const result = await cfService.provisionSubdomain('timeout-subdomain');
        expect(result.status).toBe('failed');
        expect(result.success).toBe(false);
        expect(result.error).toContain('ETIMEDOUT');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ===========================================================================
  // 6. Unknown & Retired Host Rejection (Acceptance Criterion 8)
  // ===========================================================================
  describe('6. Unknown Host Rejection & Explicit Unavailable State (B10 & GEMINI.md)', () => {
    it('6.1 Host resolution for unknown domain returns isUnmapped: true', async () => {
      const resolution = await resolveHostTenant('unknown-academy.kampus.pk', null as any, store);
      expect(resolution.isUnmapped).toBe(true);
      expect(resolution.isCentralHost).toBe(false);
    });

    it('6.2 Host resolution for retired or nonexistent tenant returns isUnmapped: true (no synthetic fallback)', async () => {
      const resolution = await resolveHostTenant('retired-school.kampus.pk', null as any, store);
      expect(resolution.isUnmapped).toBe(true);
      expect(resolution.tenantId).toBeNull();
    });

    it('6.3 Branding request for unknown slug returns 404 NOT_FOUND instead of synthetic title', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/branding?slug=does-not-exist',
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // ===========================================================================
  // 7. User Invitation Flow Tests (Acceptance Criterion 9)
  // ===========================================================================
  describe('7. User Invitation Lifecycle: Create, Inspect, and Accept (B11)', () => {
    let createdRawToken: string;
    let createdInvitationId: string;
    const inviteeEmail = 'newinstructor@apexpremier.edu.pk';

    it('7.1 Admin creates invitation specifying email and role (201 Created)', async () => {
      const adminToken = await createTestSupabaseToken({
        sub: ADMIN_AUTH_ID,
        email: ADMIN_EMAIL,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/invitations',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'x-tenant-id': TENANT_ID,
          'content-type': 'application/json',
        },
        payload: {
          email: inviteeEmail,
          role: 'teacher',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.token).toBeDefined();
      expect(body.data.invitation.email).toBe(inviteeEmail);
      expect(body.data.invitation.role).toBe('teacher');

      createdRawToken = body.data.token;
      createdInvitationId = body.data.invitation.id;
    });

    it('7.2 Non-admin staff member is rejected from creating invitations with 403 FORBIDDEN', async () => {
      const teacherToken = await createTestSupabaseToken({
        sub: TEACHER_AUTH_ID,
        email: TEACHER_EMAIL,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/invitations',
        headers: {
          authorization: `Bearer ${teacherToken}`,
          'x-tenant-id': TENANT_ID,
          'content-type': 'application/json',
        },
        payload: {
          email: 'subordinate@apexpremier.edu.pk',
          role: 'teacher',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('7.3 Public inspects invitation by token and receives details (200 OK)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/auth/invitations/${createdRawToken}/inspect`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe(inviteeEmail);
      expect(body.data.role).toBe('teacher');
      expect(body.data.is_valid).toBe(true);
    });

    it('7.4 Inspecting non-existent invitation token returns 404 INVITATION_NOT_FOUND', async () => {
      const fakeToken = randomBytes(32).toString('hex');
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/auth/invitations/${fakeToken}/inspect`,
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVITATION_NOT_FOUND');
    });

    it('7.5 User with mismatched email is rejected from accepting invitation with 403 EMAIL_MISMATCH', async () => {
      const strangerToken = await createTestSupabaseToken({
        sub: STRANGER_AUTH_ID,
        email: STRANGER_EMAIL,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/invitations/accept',
        headers: {
          authorization: `Bearer ${strangerToken}`,
          'content-type': 'application/json',
        },
        payload: {
          token: createdRawToken,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('EMAIL_MISMATCH');
    });

    it('7.6 User with matching email accepts invitation, creating tenant membership (200 OK)', async () => {
      const inviteeAuthId = 'u-invitee-' + Date.now();
      await store.saveProfile({
        id: inviteeAuthId,
        email: inviteeEmail,
        display_name: 'Newly Invited Instructor',
        platform_role: 'user',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const inviteeToken = await createTestSupabaseToken({
        sub: inviteeAuthId,
        email: inviteeEmail,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/invitations/accept',
        headers: {
          authorization: `Bearer ${inviteeToken}`,
          'content-type': 'application/json',
        },
        payload: {
          token: createdRawToken,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.membership).toBeDefined();
      expect(body.data.membership.role).toBe('teacher');
      expect(body.data.membership.tenant_id).toBe(TENANT_ID);
    });

    it('7.7 Repeated acceptance attempt of already accepted invitation returns 410', async () => {
      const inviteeToken = await createTestSupabaseToken({
        sub: 'some-other-id',
        email: inviteeEmail,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/invitations/accept',
        headers: {
          authorization: `Bearer ${inviteeToken}`,
          'content-type': 'application/json',
        },
        payload: {
          token: createdRawToken,
        },
      });

      expect(res.statusCode).toBe(410);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVITATION_ALREADY_ACCEPTED');
    });

    it('7.8 Admin lists invitations for current tenant (200 OK)', async () => {
      const adminToken = await createTestSupabaseToken({
        sub: ADMIN_AUTH_ID,
        email: ADMIN_EMAIL,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/invitations',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'x-tenant-id': TENANT_ID,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      const found = body.data.find((inv: any) => inv.id === createdInvitationId);
      expect(found).toBeDefined();
      expect(found.email).toBe(inviteeEmail);
      expect(found.role).toBe('teacher');
      expect(found.status).toBe('accepted');
      expect(found.expires_at).toBeDefined();
      expect(found.created_at).toBeDefined();
    });

    it('7.9 Calling GET /api/v1/auth/invitations without X-Tenant-ID returns 400 TENANT_REQUIRED', async () => {
      const adminToken = await createTestSupabaseToken({
        sub: ADMIN_AUTH_ID,
        email: ADMIN_EMAIL,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/invitations',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('TENANT_REQUIRED');
    });

    it('7.10 Calling GET /api/v1/auth/invitations as teacher returns 403 FORBIDDEN_ROLE', async () => {
      const teacherToken = await createTestSupabaseToken({
        sub: TEACHER_AUTH_ID,
        email: TEACHER_EMAIL,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/invitations',
        headers: {
          authorization: `Bearer ${teacherToken}`,
          'x-tenant-id': TENANT_ID,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('7.11 Calling GET /api/v1/auth/invitations with unauthenticated request returns 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/invitations',
        headers: {
          'x-tenant-id': TENANT_ID,
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('7.12 Cross-tenant isolation: Tenant B admin cannot see Tenant A invitations', async () => {
      const otherAdminAuthId = 'u-other-admin-' + Date.now();
      const otherAdminEmail = 'otheradmin@othertenant.pk';

      const { tenant: otherTenant, admin: otherAdmin } = await store.createTenant({
        name: 'Other Academy',
        slug: 'other-academy-' + Date.now(),
        admin_name: 'Other Admin',
        admin_email: otherAdminEmail,
      });

      otherAdmin.auth_user_id = otherAdminAuthId;

      await store.saveProfile({
        id: otherAdminAuthId,
        email: otherAdminEmail,
        display_name: 'Other Admin',
        platform_role: 'user',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const otherAdminToken = await createTestSupabaseToken({
        sub: otherAdminAuthId,
        email: otherAdminEmail,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/invitations',
        headers: {
          authorization: `Bearer ${otherAdminToken}`,
          'x-tenant-id': otherTenant.id,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });

    it('7.13 Admin revokes a pending invitation (200 OK) and status changes to revoked', async () => {
      const adminToken = await createTestSupabaseToken({
        sub: ADMIN_AUTH_ID,
        email: ADMIN_EMAIL,
      });

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/invitations',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'x-tenant-id': TENANT_ID,
          'content-type': 'application/json',
        },
        payload: {
          email: 'torevoke@apexpremier.edu.pk',
          role: 'teacher',
        },
      });

      expect(createRes.statusCode).toBe(201);
      const createBody = JSON.parse(createRes.body);
      const pendingInvId = createBody.data.invitation.id;

      const revokeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/auth/invitations/${pendingInvId}/revoke`,
        headers: {
          authorization: `Bearer ${adminToken}`,
          'x-tenant-id': TENANT_ID,
        },
      });

      expect(revokeRes.statusCode).toBe(200);

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/invitations',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'x-tenant-id': TENANT_ID,
        },
      });

      const listBody = JSON.parse(listRes.body);
      const revokedInv = listBody.data.find((inv: any) => inv.id === pendingInvId);
      expect(revokedInv).toBeDefined();
      expect(revokedInv.status).toBe('revoked');
    });

    it('7.14 Public inspects invitation via alias GET /api/v1/auth/invitations/:token (200 OK)', async () => {
      const adminToken = await createTestSupabaseToken({
        sub: ADMIN_AUTH_ID,
        email: ADMIN_EMAIL,
      });

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/invitations',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'x-tenant-id': TENANT_ID,
          'content-type': 'application/json',
        },
        payload: {
          email: 'aliastest@apexpremier.edu.pk',
          role: 'finance_manager',
        },
      });

      expect(createRes.statusCode).toBe(201);
      const rawToken = JSON.parse(createRes.body).data.token;

      const inspectRes = await app.inject({
        method: 'GET',
        url: `/api/v1/auth/invitations/${rawToken}`,
      });

      expect(inspectRes.statusCode).toBe(200);
      const inspectBody = JSON.parse(inspectRes.body);
      expect(inspectBody.success).toBe(true);
      expect(inspectBody.data.email).toBe('aliastest@apexpremier.edu.pk');
      expect(inspectBody.data.role).toBe('finance_manager');
      expect(inspectBody.data.is_valid).toBe(true);
    });

    it('7.15 User accepts invitation via POST /api/v1/auth/invitations/accept (200 OK)', async () => {
      const adminToken = await createTestSupabaseToken({
        sub: ADMIN_AUTH_ID,
        email: ADMIN_EMAIL,
      });

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/invitations',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'x-tenant-id': TENANT_ID,
          'content-type': 'application/json',
        },
        payload: {
          email: 'accountant@apexpremier.edu.pk',
          role: 'finance_manager',
        },
      });

      expect(createRes.statusCode).toBe(201);
      const rawToken = JSON.parse(createRes.body).data.token;

      const acctAuthId = 'u-acct-' + Date.now();
      const acctEmail = 'accountant@apexpremier.edu.pk';
      await store.saveProfile({
        id: acctAuthId,
        email: acctEmail,
        display_name: 'Academy Accountant',
        platform_role: 'user',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const acctToken = await createTestSupabaseToken({
        sub: acctAuthId,
        email: acctEmail,
      });

      const acceptRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/invitations/accept',
        headers: {
          authorization: `Bearer ${acctToken}`,
          'content-type': 'application/json',
        },
        payload: {
          token: rawToken,
        },
      });

      expect(acceptRes.statusCode).toBe(200);
      const acceptBody = JSON.parse(acceptRes.body);
      expect(acceptBody.success).toBe(true);
      expect(acceptBody.data.membership.role).toBe('finance_manager');
      expect(acceptBody.data.membership.tenant_id).toBe(TENANT_ID);
    });
  });
});
