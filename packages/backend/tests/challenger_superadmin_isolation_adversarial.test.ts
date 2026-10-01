import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { createTestSupabaseToken } from '../src/lib/jwt-verifier.js';
import { IMailerService } from '../src/services/mailer.js';

/**
 * Challenger Final 2: Adversarial Stress Test Suite
 * Target: packages/backend/src/routes/saas.ts & app.ts (Scope 3: Superadmin Platform Isolation)
 * 
 * Objectives:
 * 1. Challenge superadmin access: Verify an ordinary tenant user cannot access
 *    `/api/v1/saas/superadmin/overview` even if they have an active token and valid memberships.
 * 2. Verify platform superadmin with ZERO memberships can access `/api/v1/saas/superadmin/overview`
 *    without an X-Tenant-ID header.
 * 3. Stress-test parameter injection, header spoofing, forged token claims, role escalation,
 *    and account suspension.
 */

describe('Challenger Final 2 — Adversarial Challenge: Superadmin Platform Isolation', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;

  const TENANT_A_ID = '11111111-0000-0000-0000-000000000001';
  const TENANT_B_ID = '22222222-0000-0000-0000-000000000002';

  const SUPERADMIN_AUTH_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
  const SUPERADMIN_EMAIL = 'superadmin@kampus.pk';

  const SUSPENDED_SUPERADMIN_ID = 'eeeeeeee-0000-0000-0000-000000000002';
  const SUSPENDED_SUPERADMIN_EMAIL = 'suspended-super@kampus.pk';

  const TENANT_A_ADMIN_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
  const TENANT_A_ADMIN_EMAIL = 'admin@tenant-a.edu.pk';

  const TENANT_A_TEACHER_ID = 'cccccccc-0000-0000-0000-000000000002';
  const TENANT_A_TEACHER_EMAIL = 'teacher@tenant-a.edu.pk';

  const ZERO_MEMBERSHIP_ORDINARY_USER_ID = 'dddddddd-0000-0000-0000-000000000003';
  const ZERO_MEMBERSHIP_ORDINARY_USER_EMAIL = 'unaffiliated@gmail.com';

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

    // 1. Setup Tenants
    (store as any).tenants.set(TENANT_A_ID, {
      id: TENANT_A_ID,
      name: 'Academy A',
      slug: 'academy-a',
      domain: 'academy-a.kampus.pk',
      status: 'active',
      tier: 'premium',
      settings: { academic_session: '2026-2027' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    (store as any).tenants.set(TENANT_B_ID, {
      id: TENANT_B_ID,
      name: 'Academy B',
      slug: 'academy-b',
      domain: 'academy-b.kampus.pk',
      status: 'active',
      tier: 'standard',
      settings: { academic_session: '2026-2027' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 2. Setup Profiles
    // Superadmin: 0 memberships, platform_role = 'super_admin'
    await store.saveProfile({
      id: SUPERADMIN_AUTH_ID,
      email: SUPERADMIN_EMAIL,
      display_name: 'Platform Super Admin',
      platform_role: 'super_admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Suspended Superadmin: 0 memberships, platform_role = 'super_admin', status = 'suspended'
    await store.saveProfile({
      id: SUSPENDED_SUPERADMIN_ID,
      email: SUSPENDED_SUPERADMIN_EMAIL,
      display_name: 'Suspended Super Admin',
      platform_role: 'super_admin',
      status: 'suspended',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Tenant A Admin
    await store.saveProfile({
      id: TENANT_A_ADMIN_ID,
      email: TENANT_A_ADMIN_EMAIL,
      display_name: 'Admin A',
      platform_role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Tenant A Teacher
    await store.saveProfile({
      id: TENANT_A_TEACHER_ID,
      email: TENANT_A_TEACHER_EMAIL,
      display_name: 'Teacher A',
      platform_role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Unaffiliated User: 0 memberships, platform_role = 'user'
    await store.saveProfile({
      id: ZERO_MEMBERSHIP_ORDINARY_USER_ID,
      email: ZERO_MEMBERSHIP_ORDINARY_USER_EMAIL,
      display_name: 'Unaffiliated User',
      platform_role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 3. Setup Memberships (Notice: Superadmin and Unaffiliated user have NO entries!)
    (store as any).users.set(`${TENANT_A_ID}:${TENANT_A_ADMIN_EMAIL}`, {
      id: 'm-admin-a',
      tenant_id: TENANT_A_ID,
      auth_user_id: TENANT_A_ADMIN_ID,
      email: TENANT_A_ADMIN_EMAIL,
      full_name: 'Admin A',
      role: 'tenant_admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    (store as any).users.set(`${TENANT_A_ID}:${TENANT_A_TEACHER_EMAIL}`, {
      id: 'm-teacher-a',
      tenant_id: TENANT_A_ID,
      auth_user_id: TENANT_A_TEACHER_ID,
      email: TENANT_A_TEACHER_EMAIL,
      full_name: 'Teacher A',
      role: 'teacher',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    app = await buildApp({
      store,
      mailer: mockMailer,
      pool: null,
    });
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // ===========================================================================
  // 1. Platform Superadmin with 0 Memberships: Full Control Plane Access
  // ===========================================================================
  describe('1. Platform Superadmin (0 Memberships) Access', () => {
    it('1.1 Superadmin with 0 memberships accesses /api/v1/saas/superadmin/overview without X-Tenant-ID (200 OK)', async () => {
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
      expect(body.data.total_tenants).toBeDefined();
    });

    it('1.2 Superadmin overview response returns canonical metrics and institutional timestamps', async () => {
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
      expect(body.timestamp).toBeDefined();
      expect(body.data).toHaveProperty('total_tenants');
    });

    it('1.3 Superadmin accesses platform configuration /api/v1/saas/config (200 OK)', async () => {
      const token = await createTestSupabaseToken({
        sub: SUPERADMIN_AUTH_ID,
        email: SUPERADMIN_EMAIL,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/platform-config',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });
  });

  // ===========================================================================
  // 2. Ordinary Tenant Users: Strictly Denied (403 FORBIDDEN)
  // ===========================================================================
  describe('2. Ordinary Tenant Users Rejection', () => {
    it('2.1 Tenant Admin with active token and X-Tenant-ID is REJECTED with 403 FORBIDDEN', async () => {
      const token = await createTestSupabaseToken({
        sub: TENANT_A_ADMIN_ID,
        email: TENANT_A_ADMIN_EMAIL,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
        headers: {
          authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_A_ID,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('Super Admin access required');
    });

    it('2.2 Tenant Admin with active token WITHOUT X-Tenant-ID is REJECTED with 403 FORBIDDEN', async () => {
      const token = await createTestSupabaseToken({
        sub: TENANT_A_ADMIN_ID,
        email: TENANT_A_ADMIN_EMAIL,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('2.3 Tenant Teacher is REJECTED with 403 FORBIDDEN', async () => {
      const token = await createTestSupabaseToken({
        sub: TENANT_A_TEACHER_ID,
        email: TENANT_A_TEACHER_EMAIL,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
        headers: {
          authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_A_ID,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('2.4 Unaffiliated user (0 memberships, platform_role = user) is REJECTED with 403 FORBIDDEN', async () => {
      const token = await createTestSupabaseToken({
        sub: ZERO_MEMBERSHIP_ORDINARY_USER_ID,
        email: ZERO_MEMBERSHIP_ORDINARY_USER_EMAIL,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  // ===========================================================================
  // 3. Adversarial Forgery & Parameter Tampering Probes
  // ===========================================================================
  describe('3. Adversarial Parameter & Claim Forgery Probes', () => {
    it('3.1 Rejects query parameter injection (?role=super_admin&is_super_admin=true)', async () => {
      const token = await createTestSupabaseToken({
        sub: TENANT_A_ADMIN_ID,
        email: TENANT_A_ADMIN_EMAIL,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview?role=super_admin&is_super_admin=true',
        headers: {
          authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_A_ID,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('3.2 Rejects spoofed request headers (X-User-Role / X-Platform-Role)', async () => {
      const token = await createTestSupabaseToken({
        sub: TENANT_A_ADMIN_ID,
        email: TENANT_A_ADMIN_EMAIL,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
        headers: {
          authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_A_ID,
          'x-user-role': 'super_admin',
          'x-platform-role': 'super_admin',
          'x-role': 'super_admin',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('3.3 Rejects forged JWT claims when database profile has platform_role = user', async () => {
      // Attacker crafts a token with custom claims claiming to be super_admin
      const forgedToken = await createTestSupabaseToken({
        sub: TENANT_A_ADMIN_ID,
        email: TENANT_A_ADMIN_EMAIL,
        role: 'super_admin',
        platform_role: 'super_admin',
        user_metadata: { role: 'super_admin', platform_role: 'super_admin' },
        app_metadata: { role: 'super_admin', platform_role: 'super_admin' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
        headers: {
          authorization: `Bearer ${forgedToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  // ===========================================================================
  // 4. Fail-Closed Boundaries: Suspended Superadmin & Missing Credentials
  // ===========================================================================
  describe('4. Fail-Closed Boundaries', () => {
    it('4.1 Suspended superadmin profile is REJECTED with 403 ACCOUNT_NOT_ACTIVE', async () => {
      const token = await createTestSupabaseToken({
        sub: SUSPENDED_SUPERADMIN_ID,
        email: SUSPENDED_SUPERADMIN_EMAIL,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ACCOUNT_NOT_ACTIVE');
    });

    it('4.2 Unauthenticated request without token returns 401 UNAUTHORIZED', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('4.3 Tenant Admin attempting other superadmin control plane routes is REJECTED with 403', async () => {
      const token = await createTestSupabaseToken({
        sub: TENANT_A_ADMIN_ID,
        email: TENANT_A_ADMIN_EMAIL,
      });

      // Platform Config
      const configRes = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/platform-config',
        headers: {
          authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_A_ID,
        },
      });
      expect(configRes.statusCode).toBe(403);

      // Academy Activation
      const activateRes = await app.inject({
        method: 'POST',
        url: `/api/v1/saas/tenants/${TENANT_A_ID}/activate`,
        headers: {
          authorization: `Bearer ${token}`,
          'x-tenant-id': TENANT_A_ID,
        },
        payload: { duration_months: 12 },
      });
      expect(activateRes.statusCode).toBe(403);
    });
  });
});
