import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { validateAuthConfig } from '../src/config/env.js';
import { createTestSupabaseToken } from '../src/lib/jwt-verifier.js';

describe('Phase 10: Operational Security, Hardening & Configuration Acceptance Gate', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;

  const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
  const USER_AUTH_ID = 'e1000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SUPABASE_JWT_ISSUER = 'https://test-project.supabase.co/auth/v1';
    process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
    process.env.TEST_JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long';
    process.env.BASE_DOMAIN = 'kampus.pk';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.kampus.pk,https://kampus-academy.pages.dev';

    store = new InMemoryDataStore();
    await store.createTenant({
      id: TENANT_ID,
      name: 'Hardened Academy',
      slug: 'hardened',
      admin_name: 'Admin User',
      admin_email: 'admin@hardened.pk',
    });

    await store.saveProfile({
      id: USER_AUTH_ID,
      email: 'admin@hardened.pk',
      display_name: 'Admin User',
      platform_role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    (store as any).users.set(`${TENANT_ID}:admin@hardened.pk`, {
      id: 'm1000000-0000-0000-0000-000000000001',
      tenant_id: TENANT_ID,
      auth_user_id: USER_AUTH_ID,
      email: 'admin@hardened.pk',
      full_name: 'Admin User',
      role: 'tenant_admin',
      status: 'active',
      created_at: new Date().toISOString(),
    });

    app = await buildApp({ store });
    await app.ready();
  });

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.SUPABASE_JWT_ISSUER = 'https://test-project.supabase.co/auth/v1';
    process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
    process.env.TEST_JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long';
  });

  afterAll(async () => {
    await app.close();
  });

  it('Gate 1: Refuses to start in production mode if critical environment variables are missing', () => {
    const originalEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.DATABASE_URL;

      expect(() => validateAuthConfig()).toThrow(/FATAL: Missing required Supabase Auth production environment variables/i);
    } finally {
      process.env.NODE_ENV = 'test';
      Object.assign(process.env, originalEnv);
    }
  });

  it('Gate 2: Refuses to start in production mode if placeholder or insecure secrets are detected', () => {
    const originalEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://real-prod-proj.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key-placeholder';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-length-service-role-secret-key-12345';
      process.env.DATABASE_URL = 'postgres://real_user:pass@db.realhost.com:5432/postgres';
      process.env.EDGE_PROXY_SECRET = 'a-secure-production-proxy-secret-123456';

      expect(() => validateAuthConfig()).toThrow(/Insecure or placeholder SUPABASE_ANON_KEY/i);

      process.env.SUPABASE_ANON_KEY = 'valid-anon-key-secret-1234567890';
      process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/postgres';
      expect(() => validateAuthConfig()).toThrow(/Insecure local default DATABASE_URL/i);
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in originalEnv)) {
          delete process.env[key];
        }
      }
      Object.assign(process.env, originalEnv);
    }
  });

  it('Gate 3: Rapid successive requests to rate-limited auth endpoints trigger 429 RATE_LIMIT_EXCEEDED', async () => {
    const token = await createTestSupabaseToken({
      sub: USER_AUTH_ID,
      email: 'admin@hardened.pk',
    });

    let rateLimited = false;
    let statuses: number[] = [];
    // Onboard tenant has max 10 requests / min limit
    for (let i = 0; i < 15; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/onboard-tenant',
        headers: {
          host: 'app.kampus.pk',
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {
          name: `Rate Limit Test ${i}`,
          slug: `rate-limit-test-${i}`,
        },
      });

      statuses.push(res.statusCode);
      if (res.statusCode === 429) {
        rateLimited = true;
        const body = JSON.parse(res.body);
        expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
        break;
      }
    }

    expect(rateLimited).toBe(true);
  });

  it('Gate 4: CORS preflight rejects unauthorized origins and allows configured origins', async () => {
    // 1. Unauthorized origin: attacker.com
    const unauthRes = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/academic/programs',
      headers: {
        origin: 'https://attacker.evil.com',
        'access-control-request-method': 'GET',
      },
    });

    expect(unauthRes.headers['access-control-allow-origin']).toBeUndefined();

    // 2. Authorized origin: configured base domain
    const authRes = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/academic/programs',
      headers: {
        origin: 'https://app.kampus.pk',
        'access-control-request-method': 'GET',
      },
    });

    expect(authRes.headers['access-control-allow-origin']).toBe('https://app.kampus.pk');
  });

  it('Gate 5: Response contains modern institutional security headers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });
});
