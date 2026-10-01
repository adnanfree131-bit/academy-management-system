import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import { buildApp } from '../src/app.js';
import { PostgresDataStore } from '../src/services/postgres-store.js';
import { createTestSupabaseToken } from '../src/lib/jwt-verifier.js';
import { CloudflareService } from '../src/services/cloudflare.js';
import {
  executeTenantOnboardingTransaction,
  executeCreateInvitationTransaction,
  executeRevokeInvitationTransaction,
  executeAcceptInvitationTransaction,
  executeCreateCustomDomainTransaction,
  executeUpdateCustomDomainStatusTransaction,
  executeInitiateCustomDomainDeletionTransaction,
  executeFinalizeCustomDomainDeletionTransaction,
  executeAdmissionTransaction,
  executeInvoicePaymentTransaction,
} from '../src/db/transactions.js';

describe('Phase 11: End-to-End Cutover Verification Matrix', () => {
  let db: PGlite;
  let client: { query: (text: string, params?: any[]) => Promise<any> };
  let store: PostgresDataStore;
  let app: FastifyInstance;
  let cloudflare: CloudflareService;

  const SUPER_ADMIN_AUTH_ID = 'e1000000-0000-0000-0000-000000000000';
  const DIRECTOR_AUTH_ID = 'e1000000-0000-0000-0000-000000000001';
  const TEACHER_AUTH_ID = 'e1000000-0000-0000-0000-000000000002';
  const ACCOUNTANT_AUTH_ID = 'e1000000-0000-0000-0000-000000000003';
  const ATTACKER_AUTH_ID = 'e1000000-0000-0000-0000-000000000099';

  let tenantA: any;
  let tenantB: any;

  async function ensureUser(id: string, email: string, name: string, platformRole: 'user' | 'super_admin' = 'user') {
    await client.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [id, email, JSON.stringify({ full_name: name })]
    );
    await client.query(
      `INSERT INTO public.profiles (id, email, display_name, platform_role, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (id) DO UPDATE SET status = 'active', platform_role = $4`,
      [id, email, name, platformRole]
    );
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.BASE_DOMAIN = 'kampus.pk';
    process.env.SUPABASE_JWT_ISSUER = 'https://test-project.supabase.co/auth/v1';
    process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
    process.env.TEST_JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long';
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ZONE_ID;

    cloudflare = new CloudflareService();

    // 1. Initialize PGlite database
    db = new PGlite();
    client = {
      query: async (text: string, params: any[] = []) => {
        return db.query(text, params);
      },
    };

    // 2. Apply all canonical migrations
    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await db.exec(sql);
    }

    // 3. Initialize PostgresDataStore backed by PGlite
    store = new PostgresDataStore(client as any);

    // 4. Setup Seed Users
    await ensureUser(SUPER_ADMIN_AUTH_ID, 'superadmin@kampus.pk', 'Super Admin', 'super_admin');
    await ensureUser(DIRECTOR_AUTH_ID, 'director@apex.pk', 'Director Apex');
    await ensureUser(TEACHER_AUTH_ID, 'teacher@apex.pk', 'Teacher Alpha');
    await ensureUser(ACCOUNTANT_AUTH_ID, 'accountant@apex.pk', 'Accountant Beta');
    await ensureUser(ATTACKER_AUTH_ID, 'attacker@external.pk', 'Hostile Attacker');

    // 5. Onboard Tenant A and Tenant B
    const onbA = await executeTenantOnboardingTransaction(client, {
      authUserId: DIRECTOR_AUTH_ID,
      authEmail: 'director@apex.pk',
      authDisplayName: 'Director Apex',
      tenantName: 'Apex Grammar Academy',
      tenantSlug: 'apex-grammar',
      city: 'Lahore',
    });
    tenantA = onbA.tenant;

    const onbB = await executeTenantOnboardingTransaction(client, {
      authUserId: ATTACKER_AUTH_ID,
      authEmail: 'attacker@external.pk',
      authDisplayName: 'Hostile Attacker',
      tenantName: 'Isolated Academy',
      tenantSlug: 'isolated-academy',
      city: 'Karachi',
    });
    tenantB = onbB.tenant;

    // 6. Build Fastify App backed by PostgresDataStore
    app = await buildApp({ store });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // Journey 1: Platform Administrator Journey
  // ---------------------------------------------------------------------------
  describe('Journey 1: Platform Administrator Journey', () => {
    it('authenticates with AAL2, accesses SaaS overview, and inspects platform audit logs', async () => {
      const tokenAal2 = await createTestSupabaseToken({
        sub: SUPER_ADMIN_AUTH_ID,
        email: 'superadmin@kampus.pk',
        aal: 'aal2',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
        headers: {
          host: 'app.kampus.pk',
          authorization: `Bearer ${tokenAal2}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();

      // Platform audit log inspection
      const auditRes = await client.query('SELECT * FROM public.audit_logs');
      expect(auditRes.rows.length).toBeGreaterThan(0);
    });

    it('suspends an academy and verifies immediate access blocking for regular members', async () => {
      // 1. Suspend Tenant B
      await client.query(`UPDATE public.tenants SET status = 'suspended' WHERE id = $1`, [tenantB.id]);

      const memberToken = await createTestSupabaseToken({
        sub: ATTACKER_AUTH_ID,
        email: 'attacker@external.pk',
      });

      // 2. Regular member request is blocked with 403 ACADEMY_SUSPENDED
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: {
          host: 'app.kampus.pk',
          authorization: `Bearer ${memberToken}`,
          'x-tenant-id': tenantB.id,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('ACADEMY_SUSPENDED');

      // 3. Reactivate Tenant B
      await client.query(`UPDATE public.tenants SET status = 'active' WHERE id = $1`, [tenantB.id]);
    });
  });

  // ---------------------------------------------------------------------------
  // Journey 2: Tenant Onboarding Journey
  // ---------------------------------------------------------------------------
  describe('Journey 2: Tenant Onboarding Journey', () => {
    it('creates a tenant with normalized slug and verifies creator becomes tenant_admin', async () => {
      const newAuthId = 'e1000000-0000-0000-0000-000000000050';
      await ensureUser(newAuthId, 'founder@beacon.pk', 'Beacon Founder');

      const result = await executeTenantOnboardingTransaction(client, {
        authUserId: newAuthId,
        authEmail: 'founder@beacon.pk',
        authDisplayName: 'Beacon Founder',
        tenantName: 'Beacon Model Academy',
        tenantSlug: 'beacon-model',
      });

      expect(result.tenant.slug).toBe('beacon-model');
      expect(result.membership.role).toBe('tenant_admin');
      expect(result.membership.auth_user_id).toBe(newAuthId);

      // Verify unmapped custom host fails cleanly
      const unmappedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: {
          host: 'unmapped-unknown-school.pk',
          authorization: `Bearer ${await createTestSupabaseToken({ sub: newAuthId, email: 'founder@beacon.pk' })}`,
        },
      });
      expect(unmappedRes.statusCode).toBe(404);
      expect(JSON.parse(unmappedRes.body).error.code).toBe('UNMAPPED_HOST');
    });
  });

  // ---------------------------------------------------------------------------
  // Journey 3: User Invitation and Role Journey
  // ---------------------------------------------------------------------------
  describe('Journey 3: User Invitation and Role Journey', () => {
    it('issues hashed invitations, enforces email matching, and rejects revoked tokens', async () => {
      const directorMember = (
        await client.query('SELECT id FROM public.tenant_memberships WHERE tenant_id = $1 AND auth_user_id = $2', [
          tenantA.id,
          DIRECTOR_AUTH_ID,
        ])
      ).rows[0];

      // 1. Issue Accountant invitation
      const inv = await executeCreateInvitationTransaction(client, {
        tenantId: tenantA.id,
        invitedByMembershipId: directorMember.id,
        email: 'accountant@apex.pk',
        role: 'finance_manager',
      });

      expect(inv.raw_token).toBeDefined();

      // Token in DB is strictly hashed
      const dbInv = (
        await client.query('SELECT * FROM public.tenant_invitations WHERE id = $1', [inv.invitation.id])
      ).rows[0];
      expect(dbInv.token_hash).not.toBe(inv.raw_token);

      // 2. Reject acceptance if email does not match
      await expect(
        executeAcceptInvitationTransaction(client, {
          rawToken: inv.raw_token,
          authUserId: ATTACKER_AUTH_ID,
          authEmail: 'imposter@external.pk',
        })
      ).rejects.toThrow(/issued to/i);

      // 3. Accept with valid email
      const accepted = await executeAcceptInvitationTransaction(client, {
        rawToken: inv.raw_token,
        authUserId: ACCOUNTANT_AUTH_ID,
        authEmail: 'accountant@apex.pk',
        authDisplayName: 'Accountant Beta',
      });
      expect(accepted.membership.role).toBe('finance_manager');

      // 4. Revocation invalidates token immediately
      const teacherInv = await executeCreateInvitationTransaction(client, {
        tenantId: tenantA.id,
        invitedByMembershipId: directorMember.id,
        email: 'teacher@apex.pk',
        role: 'teacher',
      });

      await executeRevokeInvitationTransaction(client, {
        tenantId: tenantA.id,
        invitationId: teacherInv.invitation.id,
        revokedByMembershipId: directorMember.id,
      });

      await expect(
        executeAcceptInvitationTransaction(client, {
          rawToken: teacherInv.raw_token,
          authUserId: TEACHER_AUTH_ID,
          authEmail: 'teacher@apex.pk',
        })
      ).rejects.toThrow(/revoked/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Journey 4: Custom Domain Journey
  // ---------------------------------------------------------------------------
  describe('Journey 4: Custom Domain Journey', () => {
    it('manages full domain lifecycle: creation, verification, and external-first deletion', async () => {
      const customDomain = 'portal.apexgrammar.edu.pk';

      // 1. Create custom domain
      const cfResult = await cloudflare.createCustomHostname(customDomain);
      const domainRow = await executeCreateCustomDomainTransaction(client, {
        tenantId: tenantA.id,
        authUserId: DIRECTOR_AUTH_ID,
        actorEmail: 'director@apex.pk',
        hostname: customDomain,
        verificationTxtName: cfResult.verification_txt_name,
        verificationTxtValue: cfResult.verification_txt_value,
        status: 'pending',
      });

      expect(domainRow.hostname).toBe(customDomain);
      expect(domainRow.status).toBe('pending');

      // 2. Simulate verification failure -> enters failed state
      const failedState = await executeUpdateCustomDomainStatusTransaction(client, {
        tenantId: tenantA.id,
        authUserId: DIRECTOR_AUTH_ID,
        domainId: domainRow.id,
        status: 'failed',
        actorEmail: 'director@apex.pk',
        lastError: 'DNS verification timeout',
      });
      expect(failedState.status).toBe('failed');

      // 3. Simulate successful verification -> enters active state
      const activeState = await executeUpdateCustomDomainStatusTransaction(client, {
        tenantId: tenantA.id,
        authUserId: DIRECTOR_AUTH_ID,
        domainId: domainRow.id,
        status: 'active',
        actorEmail: 'director@apex.pk',
      });
      expect(activeState.status).toBe('active');
      expect(activeState.verified_at).toBeDefined();

      // 4. Teardown: marks pending_cleanup, triggers Cloudflare delete, then removes row
      const cleanupStep1 = await executeInitiateCustomDomainDeletionTransaction(client, {
        tenantId: tenantA.id,
        authUserId: DIRECTOR_AUTH_ID,
        domainId: domainRow.id,
        actorEmail: 'director@apex.pk',
      });
      expect(cleanupStep1.status).toBe('pending_cleanup');

      const cfDel = await cloudflare.deleteCustomHostname('mock-hostname-id');
      expect(cfDel.success).toBe(true);

      const deleted = await executeFinalizeCustomDomainDeletionTransaction(client, {
        tenantId: tenantA.id,
        authUserId: DIRECTOR_AUTH_ID,
        domainId: domainRow.id,
        actorEmail: 'director@apex.pk',
      });
      expect(deleted.id).toBe(domainRow.id);

      const check = await client.query('SELECT id FROM public.tenant_domains WHERE id = $1', [domainRow.id]);
      expect(check.rows.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Journey 5: Student and Financial Transaction Journey
  // ---------------------------------------------------------------------------
  describe('Journey 5: Student and Financial Transaction Journey', () => {
    it('executes admission, invoice generation, and partial fee payment atomically in PostgreSQL', async () => {
      // 1. Create Program & Batch
      const prog = await client.query(
        `INSERT INTO public.programs (tenant_id, name, code) VALUES ($1, 'Matric Science', 'MAT-SCI') RETURNING id`,
        [tenantA.id]
      );
      const batch = await client.query(
        `INSERT INTO public.batches (tenant_id, program_id, name, shift, max_capacity, academic_session)
         VALUES ($1, $2, 'Batch 2026-A', 'morning', 40, '2026-2027') RETURNING id`,
        [tenantA.id, prog.rows[0].id]
      );

      // 2. Execute Admission Transaction (Student + Invoice)
      const admissionResult = await executeAdmissionTransaction(client, {
        tenantId: tenantA.id,
        authUserId: DIRECTOR_AUTH_ID,
        student: {
          admission_number: 'ADM-2026-001',
          roll_number: 'R-101',
          full_name: 'Muhammad Ali',
          guardian_name: 'Ahmed Ali',
          guardian_phone: '03001234567',
          program_id: prog.rows[0].id,
          batch_id: batch.rows[0].id,
        },
        invoice: {
          invoice_number: 'INV-2026-0001',
          subtotal_amount: 15000,
          net_amount: 15000,
          billing_month: '2026-09',
          issue_date: '2026-09-01',
          due_date: '2026-09-10',
        },
      });

      expect(admissionResult.student.id).toBeDefined();
      expect(Number(admissionResult.invoice.balance_amount)).toBe(15000);

      // 3. Receive partial payment (5000 PKR)
      const paymentResult = await executeInvoicePaymentTransaction(client, {
        tenantId: tenantA.id,
        authUserId: DIRECTOR_AUTH_ID,
        invoiceId: admissionResult.invoice.id,
        paymentAmount: 5000,
        paymentMethod: 'cash',
        receiptNumber: 'RCP-2026-0001',
        collectedBy: 'Accountant Beta',
      });

      expect(Number(paymentResult.payment.amount_paid)).toBe(5000);
      expect(Number(paymentResult.invoice.paid_amount)).toBe(5000);
      expect(Number(paymentResult.invoice.balance_amount)).toBe(10000);
      expect(paymentResult.invoice.status).toBe('partially_paid');
    });
  });

  // ---------------------------------------------------------------------------
  // Journey 6: Tenant Isolation Attack Matrix
  // ---------------------------------------------------------------------------
  describe('Journey 6: Tenant Isolation Attack Matrix', () => {
    it('Gate 1: Spoofed X-Tenant-ID on central host is strictly rejected (403 FORBIDDEN)', async () => {
      const token = await createTestSupabaseToken({
        sub: ATTACKER_AUTH_ID,
        email: 'attacker@external.pk',
      });

      // Attacker belongs to Tenant B, attempts to access Tenant A
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: {
          host: 'app.kampus.pk',
          authorization: `Bearer ${token}`,
          'x-tenant-id': tenantA.id, // Target Tenant A
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error.code).toBe('FORBIDDEN');
    });

    it('Gate 2: Cross-tenant access on branded host is rejected (403 TENANT_HOST_MISMATCH)', async () => {
      const token = await createTestSupabaseToken({
        sub: DIRECTOR_AUTH_ID,
        email: 'director@apex.pk',
      });

      // Request to apex-grammar.kampus.pk with mismatched X-Tenant-ID
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: {
          host: 'apex-grammar.kampus.pk',
          authorization: `Bearer ${token}`,
          'x-tenant-id': tenantB.id, // Mismatched tenant ID
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error.code).toBe('TENANT_HOST_MISMATCH');
    });

    it('Gate 3: Audit log tampering (UPDATE and DELETE) is rejected at database level', async () => {
      const auditId = (await client.query('SELECT id FROM public.audit_logs LIMIT 1')).rows[0]?.id;
      expect(auditId).toBeDefined();

      // Attempt UPDATE
      await expect(
        client.query(`UPDATE public.audit_logs SET action = 'TAMPERED' WHERE id = $1`, [auditId])
      ).rejects.toThrow(/AUDIT_LOG_IMMUTABLE/i);

      // Attempt DELETE
      await expect(
        client.query(`DELETE FROM public.audit_logs WHERE id = $1`, [auditId])
      ).rejects.toThrow(/AUDIT_LOG_IMMUTABLE/i);
    });
  });
});
