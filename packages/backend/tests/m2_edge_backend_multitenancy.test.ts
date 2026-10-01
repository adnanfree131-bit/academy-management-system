import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { normalizeEffectiveHostname, resolveHostTenant } from '../src/lib/tenant-resolver.js';
import { CloudflareService } from '../src/services/cloudflare.js';
import { IMailerService } from '../src/services/mailer.js';

describe('Milestone M2 Unit & Integration Suite: Edge-to-Backend Multi-Tenancy & Host Resolution', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;

  const TENANT_ID = 't0000000-0000-0000-0000-000000000001';
  const PROXY_SECRET = 'test-m2-edge-proxy-secret';

  const mockMailer: IMailerService = {
    async sendOTP() {
      return true;
    },
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.BASE_DOMAIN = 'kampus.pk';
    process.env.EDGE_PROXY_SECRET = PROXY_SECRET;

    store = new InMemoryDataStore();

    // Register active test tenant with custom domain
    const seedTenant: any = {
      id: TENANT_ID,
      name: 'Apex Premier Academy',
      slug: 'apex-premier',
      domain: 'portal.apexpremier.edu.pk',
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

  // ---------------------------------------------------------------------------
  // 1. normalizeEffectiveHostname Anti-Spoofing & Normalization
  // ---------------------------------------------------------------------------
  it('recognizes the specific staging Pages hostname without resolving a tenant', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [] })) };
    const central = await resolveHostTenant('academy-management-system.pages.dev', pool);
    expect(central).toMatchObject({ isCentralHost: true, isBrandedHost: false, isUnmapped: false });
    expect(pool.query).not.toHaveBeenCalled();
    const unknown = await resolveHostTenant('unrelated.pages.dev', pool);
    expect(unknown).toMatchObject({ isCentralHost: false, isBrandedHost: true, isUnmapped: true });
  });

  describe('1. normalizeEffectiveHostname Anti-Spoofing', () => {
    it('1.1 Trusts X-Forwarded-Host when X-Edge-Proxy-Secret matches', () => {
      const req: any = {
        hostname: 'direct-backend.sslip.io',
        headers: {
          host: 'direct-backend.sslip.io',
          'x-forwarded-host': 'alpha.kampus.pk',
          'x-edge-proxy-secret': PROXY_SECRET,
        },
      };
      expect(normalizeEffectiveHostname(req)).toBe('alpha.kampus.pk');
    });

    it('1.2 Strictly ignores X-Forwarded-Host when X-Edge-Proxy-Secret is missing', () => {
      const req: any = {
        hostname: 'direct-backend.sslip.io',
        headers: {
          host: 'direct-backend.sslip.io',
          'x-forwarded-host': 'spoofed-academy.kampus.pk',
        },
      };
      expect(normalizeEffectiveHostname(req)).toBe('direct-backend.sslip.io');
    });

    it('1.3 Strictly ignores X-Forwarded-Host when X-Edge-Proxy-Secret is invalid', () => {
      const req: any = {
        hostname: 'direct-backend.sslip.io',
        headers: {
          host: 'direct-backend.sslip.io',
          'x-forwarded-host': 'spoofed-academy.kampus.pk',
          'x-edge-proxy-secret': 'invalid-secret-attacker',
        },
      };
      expect(normalizeEffectiveHostname(req)).toBe('direct-backend.sslip.io');
    });

    it('1.4 Safely extracts the first host from comma-separated multi-proxy X-Forwarded-Host', () => {
      const req: any = {
        hostname: 'direct-backend.sslip.io',
        headers: {
          host: 'direct-backend.sslip.io',
          'x-forwarded-host': 'alpha.kampus.pk, edge-proxy-1.internal, edge-proxy-2.internal',
          'x-edge-proxy-secret': PROXY_SECRET,
        },
      };
      expect(normalizeEffectiveHostname(req)).toBe('alpha.kampus.pk');
    });

    it('1.5 Strips port numbers, trailing period, and normalizes uppercase characters', () => {
      const req: any = {
        hostname: 'direct-backend.sslip.io',
        headers: {
          host: 'direct-backend.sslip.io',
          'x-forwarded-host': 'PORTAL.APEXPREMIER.EDU.PK.:8443',
          'x-edge-proxy-secret': PROXY_SECRET,
        },
      };
      expect(normalizeEffectiveHostname(req)).toBe('portal.apexpremier.edu.pk');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. resolveHostTenant Resolution Boundaries
  // ---------------------------------------------------------------------------
  describe('2. resolveHostTenant Resolution Boundaries', () => {
    it('2.1 Resolves central platform domain with isCentralHost: true, isCustomDomain: false', async () => {
      const res = await resolveHostTenant('app.kampus.pk', null as any, store);
      expect(res.isCentralHost).toBe(true);
      expect(res.isBrandedHost).toBe(false);
      expect(res.isCustomDomain).toBe(false);
      expect(res.tenantSlug).toBeNull();
      expect(res.isUnmapped).toBe(false);
    });

    it('2.2 Resolves registered platform subdomain with isBrandedHost: true, isCustomDomain: false', async () => {
      const res = await resolveHostTenant('apex-premier.kampus.pk', null as any, store);
      expect(res.isCentralHost).toBe(false);
      expect(res.isBrandedHost).toBe(true);
      expect(res.isCustomDomain).toBe(false);
      expect(res.tenantSlug).toBe('apex-premier');
      expect(res.tenantId).toBe(TENANT_ID);
      expect(res.isUnmapped).toBe(false);
    });

    it('2.3 Resolves custom domain with isBrandedHost: true, isCustomDomain: true', async () => {
      const res = await resolveHostTenant('portal.apexpremier.edu.pk', null as any, store);
      expect(res.isCentralHost).toBe(false);
      expect(res.isBrandedHost).toBe(true);
      expect(res.isCustomDomain).toBe(true);
      expect(res.tenantSlug).toBe('apex-premier');
      expect(res.tenantId).toBe(TENANT_ID);
      expect(res.isUnmapped).toBe(false);
    });

    it('2.4 Returns isUnmapped: true for unregistered platform subdomain', async () => {
      const res = await resolveHostTenant('unregistered-school.kampus.pk', null as any, store);
      expect(res.isUnmapped).toBe(true);
      expect(res.isCentralHost).toBe(false);
      expect(res.isCustomDomain).toBe(false);
    });

    it('2.5 Returns isUnmapped: true for unrecognized custom domain', async () => {
      const res = await resolveHostTenant('portal.unknownschool.edu.pk', null as any, store);
      expect(res.isUnmapped).toBe(true);
      expect(res.isCentralHost).toBe(false);
      expect(res.isCustomDomain).toBe(true);
      expect(res.tenantId).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. GET /api/v1/auth/resolve-host Endpoint
  // ---------------------------------------------------------------------------
  describe('3. GET /api/v1/auth/resolve-host Endpoint', () => {
    it('3.1 Resolves active custom domain to canonical tenant mapping', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/resolve-host?host=portal.apexpremier.edu.pk',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.tenant_id).toBe(TENANT_ID);
      expect(body.data.slug).toBe('apex-premier');
      expect(body.data.name).toBe('Apex Premier Academy');
      expect(body.data.status).toBe('active');
      expect(body.data.is_custom_domain).toBe(true);
    });

    it('3.2 Resolves registered platform subdomain to tenant mapping', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/resolve-host?host=apex-premier.kampus.pk',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.tenant_id).toBe(TENANT_ID);
      expect(body.data.slug).toBe('apex-premier');
      expect(body.data.is_custom_domain).toBe(false);
    });

    it('3.3 Resolves central platform host cleanly', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/resolve-host?host=app.kampus.pk',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.is_central_host).toBe(true);
      expect(body.data.is_custom_domain).toBe(false);
    });

    it('3.4 Returns 404 UNMAPPED_HOST for unmapped subdomain', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/resolve-host?host=nonexistent.kampus.pk',
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNMAPPED_HOST');
      expect(body.error.message).toContain('nonexistent.kampus.pk');
    });

    it('3.5 Returns 404 UNMAPPED_HOST for unmapped custom domain', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/resolve-host?host=portal.randomschool.org',
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNMAPPED_HOST');
      expect(body.error.message).toContain('portal.randomschool.org');
    });

    it('3.6 Uses verified forwarded host via edge secret when query param is omitted', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/resolve-host',
        headers: {
          'x-forwarded-host': 'portal.apexpremier.edu.pk',
          'x-edge-proxy-secret': PROXY_SECRET,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.slug).toBe('apex-premier');
      expect(body.data.is_custom_domain).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Cloudflare Domain Provisioning Hardening (B10)
  // ---------------------------------------------------------------------------
  describe('4. Cloudflare Domain Provisioning Hardening', () => {
    it('4.1 attachPagesHostname propagates failure when Pages project is unconfigured', async () => {
      const cf = new CloudflareService();
      // Credentials set but accountId missing
      (cf as any).apiToken = 'cf-test-token';
      (cf as any).zoneId = 'cf-test-zone';
      (cf as any).accountId = '';

      const res = await cf.provisionSubdomain('new-academy');
      expect(res.status).toBe('failed');
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('4.2 provisionSubdomain returns status: failed when Pages attachment returns HTTP 403', async () => {
      const cf = new CloudflareService();
      (cf as any).apiToken = 'cf-test-token';
      (cf as any).zoneId = 'cf-test-zone';
      (cf as any).accountId = 'cf-test-account';
      (cf as any).pagesProject = 'cf-test-pages';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/dns_records')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, result: { id: 'dns-rec-123' } }),
          } as any;
        }
        if (url.includes('/pages/projects/')) {
          return {
            ok: false,
            status: 403,
            json: async () => ({
              success: false,
              errors: [{ code: 10000, message: 'Authentication error: insufficient Pages permissions' }],
            }),
          } as any;
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) } as any;
      });

      try {
        const res = await cf.provisionSubdomain('test-forbidden-subdomain');
        expect(res.status).toBe('failed');
        expect(res.success).toBe(false);
        expect(res.error).toContain('insufficient Pages permissions');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('4.3 verifyPagesHostname returns active when Cloudflare Pages verification succeeds', async () => {
      const cf = new CloudflareService();
      (cf as any).apiToken = 'cf-test-token';
      (cf as any).zoneId = 'cf-test-zone';
      (cf as any).accountId = 'cf-test-account';
      (cf as any).pagesProject = 'cf-test-pages';

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          result: {
            status: 'active',
            verification_status: 'active',
          },
        }),
      } as any);

      try {
        const res = await cf.verifyPagesHostname('alpha.kampus.pk');
        expect(res.success).toBe(true);
        expect(res.status).toBe('active');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
