import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateAuthConfig } from '../src/config/env.js';

describe('Phase 1: Supabase Environment and Auth Configuration Validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.EDGE_PROXY_SECRET = 'a-secure-production-proxy-secret-123456';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('fails clearly in production when EDGE_PROXY_SECRET is absent', () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL = 'https://demo.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.DATABASE_URL = 'postgres://prod_user:prod_pass@db.prod.internal:5432/production_erp';
    delete process.env.EDGE_PROXY_SECRET;

    expect(() => validateAuthConfig()).toThrowError(/EDGE_PROXY_SECRET/);
  });

  it('fails clearly in production when SUPABASE_URL is absent', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.DATABASE_URL = 'postgres://prod_user:prod_pass@db.prod.internal:5432/production_erp';

    expect(() => validateAuthConfig()).toThrowError(/Missing required Supabase Auth production environment variables: SUPABASE_URL/);
  });

  it('fails clearly in production when SUPABASE_SERVICE_ROLE_KEY is absent', () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL = 'https://demo.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.DATABASE_URL = 'postgres://prod_user:prod_pass@db.prod.internal:5432/production_erp';

    expect(() => validateAuthConfig()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('fails clearly when AUTH_REDIRECT_URL contains wildcard characters', () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL = 'https://demo.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.DATABASE_URL = 'postgres://prod_user:prod_pass@db.prod.internal:5432/production_erp';
    process.env.AUTH_REDIRECT_URL = 'https://*.kampus.pk/auth/callback';

    expect(() => validateAuthConfig()).toThrowError(/Wildcards are prohibited in AUTH_REDIRECT_URL/);
  });

  it('fails clearly when ALLOW_DEMO_SEED=true in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL = 'https://demo.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.DATABASE_URL = 'postgres://prod_user:prod_pass@db.prod.internal:5432/production_erp';
    process.env.ALLOW_DEMO_SEED = 'true';

    expect(() => validateAuthConfig()).toThrowError(/ALLOW_DEMO_SEED cannot be enabled in production/);
  });

  it('passes in production with valid Supabase configuration and sets JWKS defaults', () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL = 'https://xyzcompany.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key-123';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-456';
    process.env.DATABASE_URL = 'postgres://prod_user:prod_pass@db.prod.internal:5432/production_erp';
    process.env.AUTH_REDIRECT_URL = 'https://app.kampus.pk/auth/callback';
    delete process.env.ALLOW_DEMO_SEED;
    // Clear explicit overrides so defaults are derived from SUPABASE_URL
    delete process.env.SUPABASE_JWT_ISSUER;
    delete process.env.SUPABASE_JWKS_URL;

    const config = validateAuthConfig();
    expect(config.supabaseUrl).toBe('https://xyzcompany.supabase.co');
    expect(config.supabaseJwtIssuer).toBe('https://xyzcompany.supabase.co/auth/v1');
    expect(config.supabaseJwksUrl).toBe('https://xyzcompany.supabase.co/auth/v1/.well-known/jwks.json');
    expect(config.supabaseJwtAudience).toBe('authenticated');
    expect(config.authRedirectUrl).toBe('https://app.kampus.pk/auth/callback');
  });

  it('proves production startup does not depend on JWT_SECRET', () => {
    process.env.NODE_ENV = 'production';
    process.env.SUPABASE_URL = 'https://xyzcompany.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key-123';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-456';
    process.env.DATABASE_URL = 'postgres://prod_user:prod_pass@db.prod.internal:5432/production_erp';
    delete process.env.JWT_SECRET;
    delete process.env.ALLOW_DEMO_SEED;

    expect(() => validateAuthConfig()).not.toThrow();
  });
});
