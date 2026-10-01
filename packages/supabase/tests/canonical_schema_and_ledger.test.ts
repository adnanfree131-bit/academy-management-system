import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { runMigrationLedger } from '../scripts/migrate.js';

import * as fs from 'fs';
import * as path from 'path';

describe('Phase 2 Acceptance Gate: Canonical Schema & Migration Ledger', () => {
  let db: PGlite;
  const migrationsDir = path.resolve(__dirname, '../migrations');
  const totalMigrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).length;

  beforeAll(() => {
    db = new PGlite();
  });

  beforeEach(async () => {
    await db.exec(`
      SET ROLE postgres;
      RESET app.current_tenant_id;
      RESET app.current_user_id;
      RESET app.is_super_admin;
    `);
  });

  it('Gate 1: A clean database can apply all migrations once through the migration ledger', async () => {
    const result = await runMigrationLedger(db);
    expect(result.applied.length).toBe(totalMigrationFiles);
    expect(result.skipped.length).toBe(0);

    // Verify schema_migrations ledger rows
    const ledger = await db.query<any>('SELECT version, name, checksum FROM public.schema_migrations ORDER BY version');
    expect(ledger.rows.length).toBe(totalMigrationFiles);
    expect(ledger.rows[0].version).toBe('00001');
  });

  it('Gate 2: Re-running the migration command is strictly idempotent and does not corrupt the schema', async () => {
    const result = await runMigrationLedger(db);
    expect(result.applied.length).toBe(0);
    expect(result.skipped.length).toBe(totalMigrationFiles);

    const ledger = await db.query<any>('SELECT COUNT(*) FROM public.schema_migrations');
    expect(parseInt(ledger.rows[0].count as string, 10)).toBe(totalMigrationFiles);
  });

  it('Gate 3: Audit rows cannot be updated or deleted by application runtime roles', async () => {
    // Insert an audit log entry as admin
    const tenantRes = await db.query<any>(`
      INSERT INTO public.tenants (name, slug, status) 
      VALUES ('Audit Test Academy', 'audit-test', 'active') 
      RETURNING id
    `);
    const tenantId = tenantRes.rows[0].id;

    const logRes = await db.query<any>(`
      INSERT INTO public.audit_logs (tenant_id, actor_email, action, resource)
      VALUES ('${tenantId}', 'admin@kampus.pk', 'TEST_EVENT', 'system')
      RETURNING id
    `);
    const logId = logRes.rows[0].id;

    // Switch to authenticated runtime role
    await db.exec(`
      SET ROLE authenticated;
      SET app.current_tenant_id = '${tenantId}';
    `);

    // Verify UPDATE on audit_logs fails closed
    await expect(
      db.query(`UPDATE public.audit_logs SET action = 'ALTERED' WHERE id = '${logId}'`)
    ).rejects.toThrow();

    // Verify DELETE on audit_logs fails closed
    await expect(
      db.query(`DELETE FROM public.audit_logs WHERE id = '${logId}'`)
    ).rejects.toThrow();

    // Reset role
    await db.exec(`SET ROLE postgres; RESET app.current_tenant_id;`);
  });

  it('Gate 4: Platform roles in profiles cannot be modified by ordinary users', async () => {
    // Create an auth user and profile
    const userRes = await db.query<any>(`
      INSERT INTO auth.users (email) VALUES ('ordinary.user@gmail.com') RETURNING id
    `);
    const userId = userRes.rows[0].id;

    // By default, trigger creates profile with platform_role = 'user'
    const profRes = await db.query<any>(`SELECT platform_role FROM public.profiles WHERE id = '${userId}'`);
    expect(profRes.rows[0].platform_role).toBe('user');

    // Emulate ordinary user trying to elevate to super_admin
    await db.exec(`
      SET ROLE authenticated;
      SET app.current_user_id = '${userId}';
      RESET app.is_super_admin;
    `);

    await expect(
      db.query(`UPDATE public.profiles SET platform_role = 'super_admin' WHERE id = '${userId}'`)
    ).rejects.toThrow(/FORBIDDEN_ROLE_CHANGE/);

    await db.exec(`SET ROLE postgres; RESET app.current_user_id;`);
  });

  it('Gate 5: tenant_domains models explicit domain states and lowercase unique hostname', async () => {
    const tenantRes = await db.query<any>(`
      INSERT INTO public.tenants (name, slug, status) 
      VALUES ('Domain Academy', 'domain-test', 'active') 
      RETURNING id
    `);
    const tenantId = tenantRes.rows[0].id;

    // Valid insert
    await db.query(`
      INSERT INTO public.tenant_domains (tenant_id, hostname, status)
      VALUES ('${tenantId}', 'academy.example.com', 'active')
    `);

    // Reject duplicate hostname
    await expect(
      db.query(`
        INSERT INTO public.tenant_domains (tenant_id, hostname, status)
        VALUES ('${tenantId}', 'academy.example.com', 'pending')
      `)
    ).rejects.toThrow(/uq_tenant_domains_hostname/);

    // Reject non-lowercase hostname
    await expect(
      db.query(`
        INSERT INTO public.tenant_domains (tenant_id, hostname, status)
        VALUES ('${tenantId}', 'Upper.Example.Com', 'pending')
      `)
    ).rejects.toThrow(/chk_tenant_domains_hostname_lowercase/);

    // Reject invalid domain state
    await expect(
      db.query(`
        INSERT INTO public.tenant_domains (tenant_id, hostname, status)
        VALUES ('${tenantId}', 'bad-status.example.com', 'invalid_state')
      `)
    ).rejects.toThrow();
  });

  it('Gate 6: tenants table enforces canonical lifecycle states', async () => {
    // Valid states: pending, active, suspended, deleting, deleted, trial, grace_period, locked
    for (const status of ['pending', 'active', 'suspended', 'deleting', 'deleted']) {
      const slug = `slug-${status}-${Date.now().toString(36)}`;
      await db.query(`
        INSERT INTO public.tenants (name, slug, status)
        VALUES ('Academy ${status}', '${slug}', '${status}')
      `);
    }

    // Invalid status rejected
    await expect(
      db.query(`
        INSERT INTO public.tenants (name, slug, status)
        VALUES ('Invalid Academy', 'invalid-slug', 'bogus_status')
      `)
    ).rejects.toThrow(/tenants_status_check/);
  });

  it('Gate 7: No ERP table contains application password hash columns', async () => {
    const res = await db.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND column_name IN ('password', 'password_hash', 'encrypted_password', 'passwd')
    `);

    expect(res.rows.length).toBe(0);
  });

  it('Gate 8: Modifying an applied migration file triggers DATABASE_MIGRATION_INTEGRITY_VIOLATION', async () => {
    const tempDir = fs.mkdtempSync(path.join(path.resolve(__dirname, '../..'), 'temp-migrations-'));
    try {
      const allFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
      for (const file of allFiles) {
        fs.copyFileSync(path.join(migrationsDir, file), path.join(tempDir, file));
      }

      // Tamper with applied migration 00001
      const tamperedFile = path.join(tempDir, '00001_tenants_and_core_auth.sql');
      fs.appendFileSync(tamperedFile, '\n-- TAMPERED FOR INTEGRITY TEST');

      await expect(runMigrationLedger(db, tempDir)).rejects.toThrow(
        /DATABASE_MIGRATION_INTEGRITY_VIOLATION: Migration 00001_tenants_and_core_auth\.sql checksum mismatch/
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('Gate 9: Historical baseline checksum whitelist permits known staging hash for 00028 without error', async () => {
    // If schema_migrations has 00028 recorded with historical staging hash 0d52b2b2...,
    // runMigrationLedger accepts it via HISTORICAL_CHECKSUM_WHITELIST
    await db.query(`
      UPDATE public.schema_migrations
      SET checksum = '0d52b2b205f068fc004650c3ae193c0a4aae7b52d1d43e246acb36789a531769'
      WHERE version = '00028'
    `);

    // Must not throw despite disk having 106d2c36...
    await expect(runMigrationLedger(db)).resolves.not.toThrow();

    // But if 00028 is altered to an un-whitelisted rogue checksum in DB, it fails
    await db.query(`
      UPDATE public.schema_migrations
      SET checksum = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      WHERE version = '00028'
    `);

    await expect(runMigrationLedger(db)).rejects.toThrow(
      /DATABASE_MIGRATION_INTEGRITY_VIOLATION: Migration 00028_safe_audit_log_teardown_and_resolver_hardening\.sql checksum mismatch/
    );

    // Restore canonical checksum
    await db.query(`
      UPDATE public.schema_migrations
      SET checksum = '106d2c36d2940fd79b52b477f083393aa5a1e6c45bb2d2f262d061aaa8bd2d26'
      WHERE version = '00028'
    `);
  });
});

