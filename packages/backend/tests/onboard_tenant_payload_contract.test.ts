import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { createTestSupabaseToken } from '../src/lib/jwt-verifier.js';
import { ICloudflareService } from '../src/services/cloudflare.js';

describe('B03 & B08 Backend Contracts: Onboard Tenant Payload & Superadmin Access', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let fakeCloudflare: ICloudflareService;

  const USER_NEW_AUTH_ID = 'e2000000-0000-0000-0000-000000000001';
  const USER_LEGACY_AUTH_ID = 'e2000000-0000-0000-0000-000000000002';
  const USER_FAIL_AUTH_ID = 'e2000000-0000-0000-0000-000000000003';
  const SUPER_ADMIN_AUTH_ID = 'e2000000-0000-0000-0000-000000000099';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SUPABASE_JWT_ISSUER = 'https://test-project.supabase.co/auth/v1';
    process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
    process.env.TEST_JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long';

    store = new InMemoryDataStore();

    // Register active user profiles
    await store.saveProfile({
      id: USER_NEW_AUTH_ID,
      email: 'newdirector@horizon.edu.pk',
      display_name: 'Director Horizon',
      platform_role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await store.saveProfile({
      id: USER_LEGACY_AUTH_ID,
      email: 'legacy@acad.edu.pk',
      display_name: 'Legacy Director',
      platform_role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await store.saveProfile({
      id: USER_FAIL_AUTH_ID,
      email: 'failtest@acad.edu.pk',
      display_name: 'Fail Director',
      platform_role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await store.saveProfile({
      id: SUPER_ADMIN_AUTH_ID,
      email: 'platform.admin@kampus.pk',
      display_name: 'Platform Superadmin',
      platform_role: 'super_admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Provide stubbed Cloudflare service to prevent any network calls to api.cloudflare.com
    fakeCloudflare = {
      checkSubdomainAvailable: async (slug: string) => ({ available: true, domain: `${slug}.kampus.pk` }),
      provisionSubdomain: async (slug: string) => {
        if (slug === 'cf-attach-failed') {
          return {
            success: false,
            domain: `${slug}.kampus.pk`,
            status: 'failed',
            error: 'Cloudflare Pages hostname attach failed (HTTP 400)',
          };
        }
        return {
          success: true,
          domain: `${slug}.kampus.pk`,
          status: 'active',
          record_id: `mock-rec-${slug}`,
        };
      },
      verifyPagesHostname: async () => ({ success: true, status: 'active' }),
      validateCustomDomain: (h: string) => ({ valid: true, normalized: h }),
      createCustomHostname: async (h: string) => ({
        success: true,
        hostname: h,
        status: 'pending',
        cname_target: 'kampus-academy.pages.dev',
      }),
      getCustomHostnameStatus: async () => ({ success: true, status: 'active' }),
      deleteCustomHostname: async () => ({ success: true, deleted: true }),
    };

    app = await buildApp({ store, cloudflare: fakeCloudflare });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('B03: Successfully onboards tenant using canonical payload { name, slug }', async () => {
    const token = await createTestSupabaseToken({
      sub: USER_NEW_AUTH_ID,
      email: 'newdirector@horizon.edu.pk',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboard-tenant',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Horizon Academy',
        slug: 'horizon-test',
        campus_name: 'Main Campus',
        city: 'Islamabad',
        phone: '051-1234567',
        logo_url: 'https://example.com/logo.png',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.tenant).toBeDefined();
    expect(body.data.tenant.name).toBe('Horizon Academy');
    expect(body.data.tenant.slug).toBe('horizon-test');
    expect(body.data.membership).toBeDefined();
    expect(body.data.membership.role).toBe('tenant_admin');
  });

  it('B03: Successfully onboards tenant using legacy fallback payload { tenant_name, tenant_slug }', async () => {
    const token = await createTestSupabaseToken({
      sub: USER_LEGACY_AUTH_ID,
      email: 'legacy@acad.edu.pk',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboard-tenant',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: {
        tenant_name: 'Legacy Academy',
        tenant_slug: 'legacy-test',
        city: 'Rawalpindi',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.tenant.name).toBe('Legacy Academy');
    expect(body.data.tenant.slug).toBe('legacy-test');
    expect(body.data.membership.role).toBe('tenant_admin');
  });

  it('B03: Rejects payload with reserved slug (400 SLUG_RESERVED)', async () => {
    const token = await createTestSupabaseToken({
      sub: USER_NEW_AUTH_ID,
      email: 'newdirector@horizon.edu.pk',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboard-tenant',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Super Academy',
        slug: 'superadmin',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('SLUG_RESERVED');
  });

  it('B03: Rejects payload with invalid slug length (400 VALIDATION_ERROR)', async () => {
    const token = await createTestSupabaseToken({
      sub: USER_NEW_AUTH_ID,
      email: 'newdirector@horizon.edu.pk',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboard-tenant',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Horizon Academy',
        slug: 'ab', // < 3 characters
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('B08: /session bootstrap returns super_admin platform_role with empty memberships for platform superadmin', async () => {
    const superAdminToken = await createTestSupabaseToken({
      sub: SUPER_ADMIN_AUTH_ID,
      email: 'platform.admin@kampus.pk',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.profile.platform_role).toBe('super_admin');
    expect(body.data.memberships).toEqual([]);
  });

  it('B08: /me returns super_admin user session even without X-Tenant-ID header', async () => {
    const superAdminToken = await createTestSupabaseToken({
      sub: SUPER_ADMIN_AUTH_ID,
      email: 'platform.admin@kampus.pk',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.user.role).toBe('super_admin');
    expect(body.data.user.email).toBe('platform.admin@kampus.pk');
  });

  it('C06: Persists and surfaces domain provisioning status on successful onboarding', async () => {
    const token = await createTestSupabaseToken({
      sub: USER_NEW_AUTH_ID,
      email: 'newdirector@horizon.edu.pk',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboard-tenant',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Active Domain Academy',
        slug: 'active-domain-test',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.domain_provisioning).toBeDefined();
    expect(body.data.domain_provisioning.status).toBe('active');
    expect(body.data.domain_provisioning.domain).toBe('active-domain-test.kampus.pk');

    // Verify persisted in store
    const tenant = await store.getTenantById(body.data.tenant.id);
    expect(tenant?.settings?.domain_provisioning_status).toBe('active');
    expect(tenant?.settings?.domain_verified).toBe(true);
  });

  it('C06: Handles and persists failed domain provisioning without breaking tenant onboarding', async () => {
    const token = await createTestSupabaseToken({
      sub: USER_FAIL_AUTH_ID,
      email: 'failtest@acad.edu.pk',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboard-tenant',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: {
        name: 'Attach Failed Academy',
        slug: 'cf-attach-failed',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.tenant).toBeDefined();
    expect(body.data.domain_provisioning).toBeDefined();
    expect(body.data.domain_provisioning.status).toBe('failed');
    expect(body.data.domain_provisioning.error).toContain('Pages hostname attach failed');

    // Verify persisted in store
    const tenant = await store.getTenantById(body.data.tenant.id);
    expect(tenant?.settings?.domain_provisioning_status).toBe('failed');
    expect(tenant?.settings?.domain_provisioning_error).toContain('Pages hostname attach failed');
    expect(tenant?.settings?.domain_verified).toBe(false);
  });

  it('C06: Idempotent /reconcile-domain retries domain provisioning and updates tenant settings', async () => {
    // Look up the previously created tenant with failed domain
    let tenant = Array.from((store as any).tenants.values()).find((t: any) => t.slug === 'cf-attach-failed') as any;
    expect(tenant).toBeDefined();
    expect(tenant!.settings?.domain_provisioning_status).toBe('failed');

    // Simulate recovery of Cloudflare provisioning
    fakeCloudflare.provisionSubdomain = async (slug: string) => ({
      success: true,
      domain: `${slug}.kampus.pk`,
      status: 'active',
      record_id: `rec-recovered-${slug}`,
    });

    const token = await createTestSupabaseToken({
      sub: USER_FAIL_AUTH_ID,
      email: 'failtest@acad.edu.pk',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reconcile-domain',
      headers: {
        authorization: `Bearer ${token}`,
        'x-tenant-id': tenant!.id,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('active');
    expect(body.data.verified).toBe(true);

    // Verify updated in store
    tenant = await store.getTenantById(tenant!.id);
    expect(tenant?.settings?.domain_provisioning_status).toBe('active');
    expect(tenant?.settings?.domain_verified).toBe(true);
    expect(tenant?.settings?.domain_provisioning_error).toBeNull();
  });
});
