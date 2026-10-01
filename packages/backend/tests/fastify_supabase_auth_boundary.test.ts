import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { createTestSupabaseToken } from '../src/lib/jwt-verifier.js';
import { UserProfile, TenantMembership } from '@apex/shared-types';

describe('Phase 4: Fastify Supabase Authentication & Tenant Boundary Integration Tests', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;

  const TENANT_A_ID = 'a0000000-0000-0000-0000-000000000001'; // Apex Academy
  const TENANT_B_ID = 'b0000000-0000-0000-0000-000000000002'; // Crescent Academy
  const TENANT_C_ID = 'c0000000-0000-0000-0000-000000000003'; // Quaid Academy (not joined)

  const USER_A_AUTH_ID = 'e1000000-0000-0000-0000-000000000001'; // Adnan (Apex admin)
  const USER_MULTI_AUTH_ID = 'e1000000-0000-0000-0000-000000000099'; // Multi-tenant user (Apex + Crescent)
  const SUPER_ADMIN_AUTH_ID = 'e1000000-0000-0000-0000-000000000000'; // Platform Super Admin
  const SUSPENDED_AUTH_ID = 'e1000000-0000-0000-0000-000000000055'; // Suspended profile

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SUPABASE_JWT_ISSUER = 'https://test-project.supabase.co/auth/v1';
    process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
    process.env.TEST_JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long';

    store = new InMemoryDataStore();

    // 1. Ensure Tenant A and Tenant B exist
    const tenantA = await store.getTenantById(TENANT_A_ID);
    if (!tenantA) {
      await store.createTenant({
        name: 'Apex Academy',
        slug: 'apex',
        admin_name: 'Director Adnan',
        admin_email: 'adnan@apexacademy.edu.pk',
      });
    }

    const tenantB = await store.getTenantById(TENANT_B_ID);
    if (!tenantB) {
      await store.createTenant({
        name: 'Crescent Academy',
        slug: 'crescent',
        admin_name: 'Principal Crescent',
        admin_email: 'principal@crescent.edu.pk',
      });
    }

    // 2. Setup profiles
    await store.saveProfile({
      id: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
      display_name: 'Director Adnan',
      platform_role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await store.saveProfile({
      id: USER_MULTI_AUTH_ID,
      email: 'multi@example.com',
      display_name: 'Multi Tenant Member',
      platform_role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await store.saveProfile({
      id: SUPER_ADMIN_AUTH_ID,
      email: 'superadmin@kampus.pk',
      display_name: 'Platform Super Admin',
      platform_role: 'super_admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await store.saveProfile({
      id: SUSPENDED_AUTH_ID,
      email: 'suspended@example.com',
      display_name: 'Suspended User',
      platform_role: 'user',
      status: 'suspended',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 3. Setup multi-tenant memberships
    // Multi user is member of Tenant A and Tenant B, but NOT Tenant C
    (store as any).users.set(`${TENANT_A_ID}:multi@example.com`, {
      id: 'm1000000-0000-0000-0000-000000000001',
      tenant_id: TENANT_A_ID,
      auth_user_id: USER_MULTI_AUTH_ID,
      email: 'multi@example.com',
      full_name: 'Multi Tenant Member',
      role: 'teacher',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    (store as any).users.set(`${TENANT_B_ID}:multi@example.com`, {
      id: 'm1000000-0000-0000-0000-000000000002',
      tenant_id: TENANT_B_ID,
      auth_user_id: USER_MULTI_AUTH_ID,
      email: 'multi@example.com',
      full_name: 'Multi Tenant Member',
      role: 'tenant_admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Ensure User A is in Tenant A
    (store as any).users.set(`${TENANT_A_ID}:adnan@apexacademy.edu.pk`, {
      id: 'a1000000-0000-0000-0000-000000000001',
      tenant_id: TENANT_A_ID,
      auth_user_id: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
      full_name: 'Director Adnan',
      role: 'tenant_admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    app = await buildApp({ store });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Gate 1: Rejects request with missing Authorization header (401)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        'x-tenant-id': TENANT_A_ID,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('Gate 2: Rejects request with malformed or non-Bearer token (401)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: 'Basic dXNlcjpwYXNz',
        'x-tenant-id': TENANT_A_ID,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('Gate 3: Rejects expired Supabase token (401)', async () => {
    const expiredToken = await createTestSupabaseToken({
      sub: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${expiredToken}`,
        'x-tenant-id': TENANT_A_ID,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('Gate 4: Rejects token with wrong issuer (401)', async () => {
    const wrongIssuerToken = await createTestSupabaseToken({
      sub: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
      iss: 'https://evil-project.supabase.co/auth/v1',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${wrongIssuerToken}`,
        'x-tenant-id': TENANT_A_ID,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('Gate 5: Rejects token with wrong audience (401)', async () => {
    const wrongAudienceToken = await createTestSupabaseToken({
      sub: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
      aud: 'wrong-audience',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${wrongAudienceToken}`,
        'x-tenant-id': TENANT_A_ID,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('Gate 6: Rejects tampered token signature (401)', async () => {
    const validToken = await createTestSupabaseToken({
      sub: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
    });
    const parts = validToken.split('.');
    const tampered = `${parts[0]}.${parts[1]}.tamperedSignatureHere`;

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${tampered}`,
        'x-tenant-id': TENANT_A_ID,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('Gate 7: Rejects request for unknown/deleted profile (401)', async () => {
    const unknownToken = await createTestSupabaseToken({
      sub: 'e1000000-0000-0000-0000-999999999999',
      email: 'ghost@example.com',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${unknownToken}`,
        'x-tenant-id': TENANT_A_ID,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('Gate 8: Rejects request when profile is suspended (403 ACCOUNT_NOT_ACTIVE)', async () => {
    const suspendedToken = await createTestSupabaseToken({
      sub: SUSPENDED_AUTH_ID,
      email: 'suspended@example.com',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${suspendedToken}`,
        'x-tenant-id': TENANT_A_ID,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('ACCOUNT_NOT_ACTIVE');
  });

  it('Gate 9: Rejects tenant route when X-Tenant-ID header is missing (400 TENANT_REQUIRED)', async () => {
    const token = await createTestSupabaseToken({
      sub: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('TENANT_REQUIRED');
  });

  it('Gate 10: Cross-tenant attack with forged X-Tenant-ID header is blocked (403 FORBIDDEN)', async () => {
    // User A belongs ONLY to Tenant A (Apex Academy)
    // User A attempts to access Tenant B (Crescent Academy) by sending forged X-Tenant-ID
    const userAToken = await createTestSupabaseToken({
      sub: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${userAToken}`,
        'x-tenant-id': TENANT_B_ID, // Forged tenant!
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('Gate 11: Valid token with correct X-Tenant-ID header succeeds (200)', async () => {
    const userAToken = await createTestSupabaseToken({
      sub: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${userAToken}`,
        'x-tenant-id': TENANT_A_ID,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });

  it('Gate 12: Suspending a membership immediately revokes API access without waiting for token refresh (403)', async () => {
    const userAToken = await createTestSupabaseToken({
      sub: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
    });

    // 1. Membership is active, request succeeds
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${userAToken}`,
        'x-tenant-id': TENANT_A_ID,
      },
    });
    expect(res1.statusCode).toBe(200);

    // 2. Admin suspends membership
    await store.setMembershipStatus(TENANT_A_ID, USER_A_AUTH_ID, 'suspended');

    // 3. Exact same token sent again immediately fails with 403
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${userAToken}`,
        'x-tenant-id': TENANT_A_ID,
      },
    });
    expect(res2.statusCode).toBe(403);
    const body2 = JSON.parse(res2.body);
    expect(body2.error.code).toBe('ACCOUNT_NOT_ACTIVE');

    // Restore status for following tests
    await store.setMembershipStatus(TENANT_A_ID, USER_A_AUTH_ID, 'active');
  });

  it('Gate 13: Platform routes cannot be reached by a tenant admin (403 FORBIDDEN_ROLE)', async () => {
    const tenantAdminToken = await createTestSupabaseToken({
      sub: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/saas/superadmin/overview',
      headers: {
        authorization: `Bearer ${tenantAdminToken}`,
        'x-tenant-id': TENANT_A_ID,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toMatch(/FORBIDDEN/);
  });

  it('Gate 14: Platform routes succeed for Platform Super Admin without requiring X-Tenant-ID (200)', async () => {
    const superAdminToken = await createTestSupabaseToken({
      sub: SUPER_ADMIN_AUTH_ID,
      email: 'superadmin@kampus.pk',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/saas/superadmin/overview',
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });

  it('Gate 15: Multi-tenant user can switch between Tenant A and Tenant B, but is rejected on Tenant C', async () => {
    const multiToken = await createTestSupabaseToken({
      sub: USER_MULTI_AUTH_ID,
      email: 'multi@example.com',
    });

    // 1. Access Tenant A -> 200 OK
    const resA = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${multiToken}`,
        'x-tenant-id': TENANT_A_ID,
      },
    });
    expect(resA.statusCode).toBe(200);

    // 2. Access Tenant B -> 200 OK
    const resB = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${multiToken}`,
        'x-tenant-id': TENANT_B_ID,
      },
    });
    expect(resB.statusCode).toBe(200);

    // 3. Access unjoined Tenant C -> 404 or 403
    const resC = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${multiToken}`,
        'x-tenant-id': TENANT_C_ID,
      },
    });
    expect([403, 404]).toContain(resC.statusCode);
  });

  it('Gate 16: Session bootstrap endpoint GET /api/v1/auth/session returns profile and memberships', async () => {
    const multiToken = await createTestSupabaseToken({
      sub: USER_MULTI_AUTH_ID,
      email: 'multi@example.com',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: {
        authorization: `Bearer ${multiToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.profile).toBeDefined();
    expect(body.data.profile.id).toBe(USER_MULTI_AUTH_ID);
    expect(body.data.memberships.length).toBeGreaterThanOrEqual(2);
    expect(body.data.memberships.some((m: any) => m.tenant_id === TENANT_A_ID)).toBe(true);
    expect(body.data.memberships.some((m: any) => m.tenant_id === TENANT_B_ID)).toBe(true);
  });
});
