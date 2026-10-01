import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import {
  executeTenantOnboardingTransaction,
  executeCreateInvitationTransaction,
  executeRevokeInvitationTransaction,
  executeAttendanceCorrectionTransaction,
} from '../src/db/transactions.js';
import { createHash } from 'crypto';

describe('Phase 8: Authorization Matrix, Auditability & Append-Only Log Integrity', () => {
  let db: PGlite;
  let client: { query: (text: string, params?: any[]) => Promise<any> };

  const TENANT_A_ID = 'a0000000-0000-0000-0000-000000000001';
  const DIRECTOR_A_AUTH_ID = 'e1000000-0000-0000-0000-000000000001';

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
    db = new PGlite();
    client = {
      query: async (text: string, params: any[] = []) => {
        return db.query(text, params);
      },
    };

    // Run all migrations in sequence (including 00020_audit_log_immutability.sql)
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

  // ---------------------------------------------------------------------------
  // 1. Audit Log Emission for Critical Operations
  // ---------------------------------------------------------------------------
  describe('Gate 1: Audit Log Generation for Sensitive Actions', () => {
    it('records an audit log entry upon tenant onboarding', async () => {
      const testSlug = `audit-onboard-${Date.now()}`;
      const authId = 'c0000000-0000-0000-0000-000000000099';

      await ensureAuthUser(authId, 'director@audit.pk', 'Director Audit');

      const result = await executeTenantOnboardingTransaction(client, {
        authUserId: authId,
        authEmail: 'director@audit.pk',
        authDisplayName: 'Director Audit',
        tenantName: 'Audit Test Academy',
        tenantSlug: testSlug,
        city: 'Islamabad',
      });

      const auditRes = await client.query(
        `SELECT * FROM public.audit_logs WHERE tenant_id = $1 AND action = 'TENANT_ONBOARDED'`,
        [result.tenant.id]
      );

      expect(auditRes.rows.length).toBe(1);
      const audit = auditRes.rows[0];
      expect(audit.action).toBe('TENANT_ONBOARDED');
      expect(audit.resource).toBe('tenants');
      expect(audit.resource_id).toBe(result.tenant.id);
      expect(audit.actor_email).toBe('director@audit.pk');
      expect(audit.changes).toBeDefined();
      expect(typeof audit.changes).toBe('object');
    });

    it('records audit log entries upon invitation creation and revocation', async () => {
      await ensureAuthUser(DIRECTOR_A_AUTH_ID, 'director@apex.pk', 'Director Apex');

      const tenantRes = await executeTenantOnboardingTransaction(client, {
        authUserId: DIRECTOR_A_AUTH_ID,
        authEmail: 'director@apex.pk',
        authDisplayName: 'Director Apex',
        tenantName: 'Apex Invitational Academy',
        tenantSlug: `apex-inv-${Date.now()}`,
        city: 'Rawalpindi',
      });

      const tenantId = tenantRes.tenant.id;
      const membershipId = tenantRes.membership.id;

      // 1. Create Invitation
      const inv = await executeCreateInvitationTransaction(client, {
        tenantId,
        invitedByMembershipId: membershipId,
        email: 'teacher.new@apex.pk',
        role: 'teacher',
      });

      const createAudit = await client.query(
        `SELECT * FROM public.audit_logs WHERE tenant_id = $1 AND action = 'INVITATION_CREATED'`,
        [tenantId]
      );
      expect(createAudit.rows.length).toBe(1);
      expect(createAudit.rows[0].resource).toBe('tenant_invitations');
      expect(createAudit.rows[0].resource_id).toBe(inv.invitation.id);

      // 2. Revoke Invitation
      await executeRevokeInvitationTransaction(client, {
        tenantId,
        invitationId: inv.invitation.id,
        revokedByMembershipId: membershipId,
      });

      const revokeAudit = await client.query(
        `SELECT * FROM public.audit_logs WHERE tenant_id = $1 AND action = 'INVITATION_REVOKED'`,
        [tenantId]
      );
      expect(revokeAudit.rows.length).toBe(1);
      expect(revokeAudit.rows[0].resource_id).toBe(inv.invitation.id);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Append-Only Immutability Enforcement
  // ---------------------------------------------------------------------------
  describe('Gate 2: Database Append-Only Immutability of Audit Logs', () => {
    it('blocks UPDATE operations on audit_logs with AUDIT_LOG_IMMUTABLE exception', async () => {
      const existingTenant = (await client.query('SELECT id FROM public.tenants LIMIT 1')).rows[0];
      const validTenantId = existingTenant.id;

      // 1. Insert a test audit record
      const insertRes = await client.query(
        `INSERT INTO public.audit_logs (tenant_id, action, resource, resource_id, changes, actor_email)
         VALUES ($1, 'TEST_ACTION', 'test_resource', 'res-1', '{"test": true}'::jsonb, 'admin@apexacademy.edu.pk')
         RETURNING id`,
        [validTenantId]
      );
      const auditId = insertRes.rows[0].id;

      // 2. Attempt UPDATE query
      await expect(
        client.query(
          `UPDATE public.audit_logs SET action = 'TAMPERED_ACTION' WHERE id = $1`,
          [auditId]
        )
      ).rejects.toThrow(/AUDIT_LOG_IMMUTABLE/i);

      // 3. Verify record was untouched
      const verifyRes = await client.query(
        `SELECT action FROM public.audit_logs WHERE id = $1`,
        [auditId]
      );
      expect(verifyRes.rows[0].action).toBe('TEST_ACTION');
    });

    it('blocks DELETE operations on audit_logs with AUDIT_LOG_IMMUTABLE exception', async () => {
      const existingTenant = (await client.query('SELECT id FROM public.tenants LIMIT 1')).rows[0];
      const validTenantId = existingTenant.id;

      // 1. Insert a test audit record
      const insertRes = await client.query(
        `INSERT INTO public.audit_logs (tenant_id, action, resource, resource_id, changes, actor_email)
         VALUES ($1, 'TEST_DELETE_ACTION', 'test_resource', 'res-2', '{"test": true}'::jsonb, 'admin@apexacademy.edu.pk')
         RETURNING id`,
        [validTenantId]
      );
      const auditId = insertRes.rows[0].id;

      // 2. Attempt DELETE query
      await expect(
        client.query(
          `DELETE FROM public.audit_logs WHERE id = $1`,
          [auditId]
        )
      ).rejects.toThrow(/AUDIT_LOG_IMMUTABLE/i);

      // 3. Verify record still exists
      const verifyRes = await client.query(
        `SELECT id FROM public.audit_logs WHERE id = $1`,
        [auditId]
      );
      expect(verifyRes.rows.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Log Hygiene & Secret Sanitization
  // ---------------------------------------------------------------------------
  describe('Gate 3: Log Hygiene & Credential Sanitization', () => {
    it('ensures invitation tokens are stored strictly as SHA-256 hashes and not cleartext', async () => {
      const secretAdminAuthId = 'c0000000-0000-0000-0000-000000000088';
      await ensureAuthUser(secretAdminAuthId, 'director.secret@apex.pk', 'Director Secret');

      const tenantRes = await executeTenantOnboardingTransaction(client, {
        authUserId: secretAdminAuthId,
        authEmail: 'director.secret@apex.pk',
        authDisplayName: 'Director Secret',
        tenantName: 'Apex Secret Sanitization Academy',
        tenantSlug: `apex-secret-${Date.now()}`,
        city: 'Karachi',
      });

      const inv = await executeCreateInvitationTransaction(client, {
        tenantId: tenantRes.tenant.id,
        invitedByMembershipId: tenantRes.membership.id,
        email: 'staff.audit@apex.pk',
        role: 'teacher',
      });

      // Cleartext raw token returned to caller for email
      const cleartextToken = inv.raw_token;
      expect(cleartextToken).toBeDefined();
      expect(cleartextToken.length).toBeGreaterThan(20);

      // Token in database MUST be SHA-256 hash, not cleartext
      const dbInv = await client.query(
        `SELECT token_hash FROM public.tenant_invitations WHERE id = $1`,
        [inv.invitation.id]
      );
      const storedHash = dbInv.rows[0].token_hash;
      const expectedHash = createHash('sha256').update(cleartextToken).digest('hex');

      expect(storedHash).toBe(expectedHash);
      expect(storedHash).not.toBe(cleartextToken);

      // Verify audit log for this invitation also does NOT contain the cleartext token
      const auditRes = await client.query(
        `SELECT * FROM public.audit_logs WHERE resource_id = $1`,
        [inv.invitation.id]
      );
      expect(auditRes.rows.length).toBe(1);
      const auditPayload = JSON.stringify(auditRes.rows[0]);
      expect(auditPayload).not.toContain(cleartextToken);
    });
  });
});
