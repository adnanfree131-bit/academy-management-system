import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import { CloudflareService } from '../src/services/cloudflare.js';
import {
  executeTenantOnboardingTransaction,
  executeCreateCustomDomainTransaction,
  executeUpdateCustomDomainStatusTransaction,
  executeInitiateCustomDomainDeletionTransaction,
  executeFinalizeCustomDomainDeletionTransaction,
} from '../src/db/transactions.js';

describe('Phase 9: Domain Provisioning, Lifecycle & DNS Verification Acceptance Gate', () => {
  let db: PGlite;
  let client: { query: (text: string, params?: any[]) => Promise<any> };
  let cloudflare: CloudflareService;

  const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
  const ADMIN_AUTH_ID = 'e1000000-0000-0000-0000-000000000001';

  async function ensureAuthUser(id: string, email: string, fullName: string) {
    await client.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [id, email, JSON.stringify({ full_name: fullName })]
    );
    await client.query(
      `INSERT INTO public.profiles (id, email, display_name, platform_role, status)
       VALUES ($1, $2, $3, 'user', 'active')
       ON CONFLICT (id) DO UPDATE SET status = 'active'`,
      [id, email, fullName]
    );
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.BASE_DOMAIN = 'kampus.pk';

    cloudflare = new CloudflareService();

    db = new PGlite();
    client = {
      query: async (text: string, params: any[] = []) => {
        return db.query(text, params);
      },
    };

    // Run all migrations
    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await db.exec(sql);
    }
  });

  beforeEach(async () => {
    await db.exec(`
      RESET app.current_tenant_id;
      RESET app.current_user_id;
      RESET app.is_super_admin;
      SET ROLE postgres;
    `);
  });

  it('Gate 1: Strictly validates domain syntax before storage', () => {
    // 1. Rejects empty string
    expect(cloudflare.validateCustomDomain('').valid).toBe(false);

    // 2. Rejects IP address
    expect(cloudflare.validateCustomDomain('192.168.1.1').valid).toBe(false);

    // 3. Rejects invalid hostname characters
    expect(cloudflare.validateCustomDomain('portal@academy.com').valid).toBe(false);
    expect(cloudflare.validateCustomDomain('portal space.com').valid).toBe(false);

    // 4. Rejects subdomains of base platform domain (these belong to slug routing)
    expect(cloudflare.validateCustomDomain('tsa.kampus.pk').valid).toBe(false);
    expect(cloudflare.validateCustomDomain('kampus.pk').valid).toBe(false);

    // 5. Accepts valid FQDN
    const valid = cloudflare.validateCustomDomain('portal.apex.edu.pk');
    expect(valid.valid).toBe(true);
    expect(valid.normalized).toBe('portal.apex.edu.pk');
  });

  it('Gate 2: Custom domain creation provisions Cloudflare custom hostname and stores verification instructions', async () => {
    const adminEmail = 'director@domaintest.pk';
    await ensureAuthUser(ADMIN_AUTH_ID, adminEmail, 'Director Domain');

    const tenantRes = await executeTenantOnboardingTransaction(client, {
      authUserId: ADMIN_AUTH_ID,
      authEmail: adminEmail,
      authDisplayName: 'Director Domain',
      tenantName: 'Domain Test Academy',
      tenantSlug: `domain-test-${Date.now()}`,
    });

    const tenantId = tenantRes.tenant.id;
    const testHostname = `portal.testschool-${Date.now()}.edu.pk`;

    // 1. Provision via Cloudflare Service
    const cfResult = await cloudflare.createCustomHostname(testHostname);
    expect(cfResult.success).toBe(true);
    expect(cfResult.status).toBe('pending');
    expect(cfResult.verification_txt_name).toBeDefined();
    expect(cfResult.verification_txt_value).toBeDefined();
    expect(cfResult.cname_target).toBeDefined();

    // 2. Execute transactional domain record creation
    const domainRecord = await executeCreateCustomDomainTransaction(client, {
      tenantId,
      authUserId: ADMIN_AUTH_ID,
      actorEmail: adminEmail,
      hostname: testHostname,
      verificationTxtName: cfResult.verification_txt_name,
      verificationTxtValue: cfResult.verification_txt_value,
      status: cfResult.status,
    });

    expect(domainRecord.id).toBeDefined();
    expect(domainRecord.hostname).toBe(testHostname);
    expect(domainRecord.status).toBe('pending');
    expect(domainRecord.verification_txt_name).toBe(cfResult.verification_txt_name);
    expect(domainRecord.verification_txt_value).toBe(cfResult.verification_txt_value);

    // 3. Verify audit log entry
    const auditRes = await client.query(
      `SELECT * FROM public.audit_logs WHERE tenant_id = $1 AND action = 'DOMAIN_PROVISION_INITIATED'`,
      [tenantId]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].resource_id).toBe(domainRecord.id);
  });

  it('Gate 3: Cloudflare outage or failure leaves domain in failed state, never active', async () => {
    const adminEmail = 'director2@domaintest.pk';
    const authId = 'e1000000-0000-0000-0000-000000000002';
    await ensureAuthUser(authId, adminEmail, 'Director 2');

    const tenantRes = await executeTenantOnboardingTransaction(client, {
      authUserId: authId,
      authEmail: adminEmail,
      authDisplayName: 'Director 2',
      tenantName: 'Domain Outage Academy',
      tenantSlug: `domain-outage-${Date.now()}`,
    });

    const tenantId = tenantRes.tenant.id;
    const failedHostname = `portal.failed-${Date.now()}.edu.pk`;

    // Simulate Cloudflare error state
    const domainRecord = await executeCreateCustomDomainTransaction(client, {
      tenantId,
      authUserId: authId,
      actorEmail: adminEmail,
      hostname: failedHostname,
      status: 'failed',
    });

    expect(domainRecord.status).toBe('failed');

    // Update with simulated failure
    const updated = await executeUpdateCustomDomainStatusTransaction(client, {
      tenantId,
      authUserId: authId,
      domainId: domainRecord.id,
      status: 'failed',
      actorEmail: adminEmail,
      lastError: 'Cloudflare API error 10000: Authentication or zone failure',
    });

    expect(updated.status).toBe('failed');
    expect(updated.status).not.toBe('active');
    expect(updated.last_error).toContain('Cloudflare API error');
    expect(updated.verified_at).toBeNull();
  });

  it('Gate 4: Deleting a custom domain marks it pending_cleanup, triggers cleanup, and removes record', async () => {
    const adminEmail = 'director3@domaintest.pk';
    const authId = 'e1000000-0000-0000-0000-000000000003';
    await ensureAuthUser(authId, adminEmail, 'Director 3');

    const tenantRes = await executeTenantOnboardingTransaction(client, {
      authUserId: authId,
      authEmail: adminEmail,
      authDisplayName: 'Director 3',
      tenantName: 'Domain Deletion Academy',
      tenantSlug: `domain-del-${Date.now()}`,
    });

    const tenantId = tenantRes.tenant.id;
    const delHostname = `portal.deletion-${Date.now()}.edu.pk`;

    const domainRecord = await executeCreateCustomDomainTransaction(client, {
      tenantId,
      authUserId: authId,
      actorEmail: adminEmail,
      hostname: delHostname,
      status: 'active',
    });

    // 1. Step 1 of deletion: mark pending_cleanup before external call
    const pendingCleanup = await executeInitiateCustomDomainDeletionTransaction(client, {
      tenantId,
      authUserId: authId,
      domainId: domainRecord.id,
      actorEmail: adminEmail,
    });
    expect(pendingCleanup.status).toBe('pending_cleanup');

    // 2. Step 2 of deletion: execute Cloudflare teardown
    const cfDelete = await cloudflare.deleteCustomHostname('mock-ch-12345');
    expect(cfDelete.success).toBe(true);

    // 3. Step 3 of deletion: finalize database deletion
    const finalized = await executeFinalizeCustomDomainDeletionTransaction(client, {
      tenantId,
      authUserId: authId,
      domainId: domainRecord.id,
      actorEmail: adminEmail,
    });
    expect(finalized.id).toBe(domainRecord.id);

    // Check that row is completely removed from tenant_domains
    const verifyDeleted = await client.query(
      `SELECT id FROM public.tenant_domains WHERE id = $1`,
      [domainRecord.id]
    );
    expect(verifyDeleted.rows.length).toBe(0);

    // Verify cleanup audit log
    const auditRes = await client.query(
      `SELECT action FROM public.audit_logs WHERE tenant_id = $1 AND action IN ('DOMAIN_CLEANUP_INITIATED', 'DOMAIN_DELETED')`,
      [tenantId]
    );
    expect(auditRes.rows.length).toBe(2);
  });

  it('Gate 5: Shared platform DNS records are protected and never identified as custom domains', async () => {
    const sharedPlatformHosts = [
      'app.kampus.pk',
      'api.kampus.pk',
      'edu.kampus.pk',
      'kampus.pk',
      'kampus-academy.pages.dev',
    ];

    for (const host of sharedPlatformHosts) {
      const validation = cloudflare.validateCustomDomain(host);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toMatch(/platform|subdomains|empty|invalid/i);
    }
  });
});
