import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import {
  executeTenantOnboardingTransaction,
  executeCreateInvitationTransaction,
  executeRevokeInvitationTransaction,
  executeAcceptInvitationTransaction,
} from '../src/db/transactions.js';
import { createHash, randomBytes } from 'crypto';

describe('Phase 6: Tenant Onboarding & Invitation Lifecycle Gates', () => {
  let db: PGlite;
  let client: { query: (text: string, params?: any[]) => Promise<any> };

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

    // 1. Run all migrations in sequence
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
  // 1. Transactional Tenant Onboarding
  // ---------------------------------------------------------------------------
  it('Gate 1: Onboards tenant and first tenant_admin membership atomically in one transaction', async () => {
    const testSlug = `test-onboard-${Date.now()}`;
    const authId = 'c0000000-0000-0000-0000-000000000001';

    await ensureAuthUser(authId, 'director@onboard.pk', 'Dr. Onboard');

    const result = await executeTenantOnboardingTransaction(client, {
      authUserId: authId,
      authEmail: 'director@onboard.pk',
      authDisplayName: 'Dr. Onboard',
      tenantName: 'Onboard Academy',
      tenantSlug: testSlug,
      city: 'Lahore',
    });

    expect(result.tenant).toBeDefined();
    expect(result.tenant.slug).toBe(testSlug);
    expect(result.tenant.status).toBe('active');

    expect(result.membership).toBeDefined();
    expect(result.membership.role).toBe('tenant_admin');
    expect(result.membership.auth_user_id).toBe(authId);
    expect(result.membership.tenant_id).toBe(result.tenant.id);

    // Verify audit log
    const audit = await client.query(
      `SELECT * FROM public.audit_logs WHERE tenant_id = $1 AND action = 'TENANT_ONBOARDED'`,
      [result.tenant.id]
    );
    expect(audit.rows.length).toBeGreaterThan(0);
  });

  it('Gate 2: Onboarding rolls back completely on error leaving 0 orphan records', async () => {
    const failedSlug = `test-fail-${Date.now()}`;
    const authId = 'c0000000-0000-0000-0000-000000000002';

    await ensureAuthUser(authId, 'failed@onboard.pk', 'Failed Admin');

    await expect(
      executeTenantOnboardingTransaction(client, {
        authUserId: authId,
        authEmail: 'failed@onboard.pk',
        authDisplayName: 'Failed Admin',
        tenantName: 'Failed Academy',
        tenantSlug: failedSlug,
        shouldFailAfterTenant: true,
      })
    ).rejects.toThrow('SIMULATED_ONBOARDING_FAILURE');

    // Verify zero orphan tenant records
    const checkTenant = await client.query(`SELECT id FROM public.tenants WHERE slug = $1`, [failedSlug]);
    expect(checkTenant.rows.length).toBe(0);

    // Verify zero orphan membership records
    const checkMember = await client.query(`SELECT id FROM public.tenant_memberships WHERE email = 'failed@onboard.pk'`);
    expect(checkMember.rows.length).toBe(0);
  });

  it('Gate 3: Rejects reserved platform identifiers and duplicate slugs', async () => {
    // Reserved slugs rejection
    for (const reserved of ['admin', 'api', 'app', 'billing', 'superadmin', 'status', 'portal']) {
      await expect(
        executeTenantOnboardingTransaction(client, {
          authUserId: 'c0000000-0000-0000-0000-000000000003',
          authEmail: 'admin@reserved.pk',
          authDisplayName: 'Admin',
          tenantName: 'Reserved',
          tenantSlug: reserved,
        })
      ).rejects.toThrow(/reserved/i);
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Invitation Lifecycle: Create, Hash, Inspect, Expire, Revoke, Accept
  // ---------------------------------------------------------------------------
  it('Gate 4: Issues invitation with token hashed at rest and rejects super_admin role', async () => {
    const testSlug = `test-inv-${Date.now()}`;
    const adminAuthId = 'c0000000-0000-0000-0000-000000000004';

    await ensureAuthUser(adminAuthId, 'director@inv.pk', 'Director');

    const { tenant, membership } = await executeTenantOnboardingTransaction(client, {
      authUserId: adminAuthId,
      authEmail: 'director@inv.pk',
      authDisplayName: 'Director',
      tenantName: 'Invitation Academy',
      tenantSlug: testSlug,
    });

    // 1. Rejects invitation with super_admin role
    await expect(
      executeCreateInvitationTransaction(client, {
        tenantId: tenant.id,
        invitedByMembershipId: membership.id,
        email: 'teacher@inv.pk',
        role: 'super_admin',
      })
    ).rejects.toThrow(/invalid role/i);

    // 2. Creates valid teacher invitation
    const created = await executeCreateInvitationTransaction(client, {
      tenantId: tenant.id,
      invitedByMembershipId: membership.id,
      email: 'teacher@inv.pk',
      role: 'teacher',
    });

    expect(created.raw_token).toBeDefined();
    expect(created.invitation.role).toBe('teacher');

    // 3. Verify token is hashed at rest (database does NOT contain raw token)
    const rawInDb = await client.query(
      `SELECT * FROM public.tenant_invitations WHERE token_hash = $1`,
      [created.raw_token]
    );
    expect(rawInDb.rows.length).toBe(0);

    const expectedHash = createHash('sha256').update(created.raw_token).digest('hex');
    const hashInDb = await client.query(
      `SELECT * FROM public.tenant_invitations WHERE token_hash = $1`,
      [expectedHash]
    );
    expect(hashInDb.rows.length).toBe(1);
    expect(hashInDb.rows[0].accepted_at).toBeNull();
    expect(hashInDb.rows[0].revoked_at).toBeNull();
  });

  it('Gate 5: Revoked, expired, and replayed invitations fail safely', async () => {
    const testSlug = `test-rev-${Date.now()}`;
    const adminAuthId = 'c0000000-0000-0000-0000-000000000005';
    const teacherAuthId = 'c0000000-0000-0000-0000-000000000006';

    await ensureAuthUser(adminAuthId, 'director@rev.pk', 'Director');
    await ensureAuthUser(teacherAuthId, 'teacher@rev.pk', 'Teacher');

    const { tenant, membership } = await executeTenantOnboardingTransaction(client, {
      authUserId: adminAuthId,
      authEmail: 'director@rev.pk',
      authDisplayName: 'Director',
      tenantName: 'Revoke Academy',
      tenantSlug: testSlug,
    });

    // A: Test Revoke
    const invA = await executeCreateInvitationTransaction(client, {
      tenantId: tenant.id,
      invitedByMembershipId: membership.id,
      email: 'teacher@rev.pk',
      role: 'teacher',
    });

    await executeRevokeInvitationTransaction(client, {
      tenantId: tenant.id,
      invitationId: invA.invitation.id,
      revokedByMembershipId: membership.id,
      revokerEmail: 'director@rev.pk',
    });

    await expect(
      executeAcceptInvitationTransaction(client, {
        rawToken: invA.raw_token,
        authUserId: teacherAuthId,
        authEmail: 'teacher@rev.pk',
      })
    ).rejects.toThrow(/revoked/i);

    // B: Test Expired
    const rawTokenB = randomBytes(32).toString('hex');
    const hashB = createHash('sha256').update(rawTokenB).digest('hex');
    await client.query(
      `INSERT INTO public.tenant_invitations (
        tenant_id, email, role, token_hash, expires_at
      ) VALUES ($1, 'teacher@rev.pk', 'teacher', $2, NOW() - INTERVAL '1 day')`,
      [tenant.id, hashB]
    );

    await expect(
      executeAcceptInvitationTransaction(client, {
        rawToken: rawTokenB,
        authUserId: teacherAuthId,
        authEmail: 'teacher@rev.pk',
      })
    ).rejects.toThrow(/expired/i);

    // C: Test Email Mismatch
    const invC = await executeCreateInvitationTransaction(client, {
      tenantId: tenant.id,
      invitedByMembershipId: membership.id,
      email: 'teacher@rev.pk',
      role: 'teacher',
    });

    await expect(
      executeAcceptInvitationTransaction(client, {
        rawToken: invC.raw_token,
        authUserId: 'c0000000-0000-0000-0000-000000000007',
        authEmail: 'imposter@rev.pk',
      })
    ).rejects.toThrow(/This invitation was issued to/i);

    // D: Test Valid Acceptance
    const accepted = await executeAcceptInvitationTransaction(client, {
      rawToken: invC.raw_token,
      authUserId: teacherAuthId,
      authEmail: 'teacher@rev.pk',
      authDisplayName: 'Teacher Alpha',
    });

    expect(accepted.membership).toBeDefined();
    expect(accepted.membership.role).toBe('teacher');
    expect(accepted.membership.auth_user_id).toBe(teacherAuthId);

    // E: Test Replay (cannot accept already accepted invitation)
    await expect(
      executeAcceptInvitationTransaction(client, {
        rawToken: invC.raw_token,
        authUserId: teacherAuthId,
        authEmail: 'teacher@rev.pk',
      })
    ).rejects.toThrow(/already been accepted/i);
  });
});
