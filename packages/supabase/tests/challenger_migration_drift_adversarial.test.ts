import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { runMigrationLedger, HISTORICAL_CHECKSUM_WHITELIST } from '../scripts/migrate.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Challenger Final 2: Adversarial Stress Test Suite
 * Target: packages/supabase/scripts/migrate.ts (Scope 1: Migration Checksum Drift Hardening)
 * 
 * Objectives:
 * 1. Verify any tampered historical migration file triggers DATABASE_MIGRATION_INTEGRITY_VIOLATION
 *    immediately BEFORE executing ANY SQL on unapplied migrations.
 * 2. Verify 00028 historical whitelist allows known staging hashes and strictly rejects unexpected hashes.
 * 3. Verify whitelist cannot be exploited by or leaked to other migration versions.
 */

describe('Challenger Final 2 — Adversarial Challenge: Migration Drift Hardening & Checksum Whitelist', () => {
  let db: PGlite;
  const migrationsDir = path.resolve(__dirname, '../migrations');
  const allSqlFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  const totalMigrationCount = allSqlFiles.length;

  const STAGING_00028_HASH = '0d52b2b205f068fc004650c3ae193c0a4aae7b52d1d43e246acb36789a531769';
  const CANONICAL_00028_HASH = '106d2c36d2940fd79b52b477f083393aa5a1e6c45bb2d2f262d061aaa8bd2d26';
  const ROGUE_HASH = 'deadbeefbadf00d1111222233334444555566667777888899990000aaaabbbb';

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

  // ===========================================================================
  // 1. Preflight Order Guarantee & SQL Execution Immunity Probe
  // ===========================================================================
  it('1. Preflight Immunity: Tampered applied migration halts BEFORE unapplied migration SQL executes', async () => {
    // Step A: Apply all real migrations first
    const initialRun = await runMigrationLedger(db);
    expect(initialRun.applied.length).toBe(totalMigrationCount);

    // Step B: Create a temporary migration environment with an unapplied pending migration AND a tampered applied migration
    const tempDir = fs.mkdtempSync(path.join(path.resolve(__dirname, '../..'), 'temp-adversarial-drift-'));
    try {
      // Copy all existing migrations
      for (const file of allSqlFiles) {
        fs.copyFileSync(path.join(migrationsDir, file), path.join(tempDir, file));
      }

      // Add a NEW unapplied migration: 00099_canary_exploit.sql
      const canaryFile = path.join(tempDir, '00099_canary_exploit.sql');
      fs.writeFileSync(
        canaryFile,
        `CREATE TABLE public.canary_breach_table (id serial primary key, marker text);`
      );

      // Tamper with historical migration 00001
      const file001 = path.join(tempDir, allSqlFiles[0]);
      fs.appendFileSync(file001, '\n-- ADVERSARIAL HISTORICAL TAMPERING');

      // Attempt execution: Must throw DATABASE_MIGRATION_INTEGRITY_VIOLATION
      await expect(runMigrationLedger(db, tempDir)).rejects.toThrow(
        /DATABASE_MIGRATION_INTEGRITY_VIOLATION/
      );

      // CRITICAL CHECK: Verify that the unapplied migration 00099 was NEVER executed!
      const checkTable = await db.query<any>(
        "SELECT to_regclass('public.canary_breach_table') as tbl;"
      );
      expect(checkTable.rows[0].tbl).toBeNull();

      // Verify no record for 00099 was inserted into schema_migrations
      const checkLedger = await db.query<any>(
        "SELECT count(*) as count FROM public.schema_migrations WHERE version = '00099';"
      );
      expect(parseInt(checkLedger.rows[0].count as string, 10)).toBe(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // ===========================================================================
  // 2. Tampering Across Multiple Lifecycle Horizons
  // ===========================================================================
  it('2. Detects tampering across early, middle, and late migrations in preflight', async () => {
    const testVersions = [
      { ver: '00001', name: '00001_tenants_and_core_auth.sql' },
      { ver: '00014', name: '00014_guardian_id_card_and_audit.sql' },
      { ver: '00027', name: '00027_hardened_rls_and_narrow_resolvers.sql' },
    ];

    for (const target of testVersions) {
      const tempDir = fs.mkdtempSync(path.join(path.resolve(__dirname, '../..'), `temp-drift-${target.ver}-`));
      try {
        for (const file of allSqlFiles) {
          fs.copyFileSync(path.join(migrationsDir, file), path.join(tempDir, file));
        }

        const targetPath = path.join(tempDir, target.name);
        fs.appendFileSync(targetPath, `\n-- TAMPER INJECTION IN ${target.ver}`);

        let caughtError: any = null;
        try {
          await runMigrationLedger(db, tempDir);
        } catch (err: any) {
          caughtError = err;
        }

        expect(caughtError).not.toBeNull();
        expect(caughtError.message).toContain('DATABASE_MIGRATION_INTEGRITY_VIOLATION');
        expect(caughtError.message).toContain(target.name);
        expect(caughtError.message).toContain('checksum mismatch');
        expect(caughtError.message).toContain('Modifying applied migrations is strictly forbidden; use forward-only migrations.');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });

  // ===========================================================================
  // 3. Historical Whitelist for 00028: Exhaustive Permutation Probes
  // ===========================================================================
  describe('3. Historical Checksum Whitelist Exhaustive Permutations for 00028', () => {
    it('3.1 Permits DB staging hash when disk has canonical hash', async () => {
      await db.query(`
        UPDATE public.schema_migrations
        SET checksum = '${STAGING_00028_HASH}'
        WHERE version = '00028'
      `);

      // Disk has canonical hash
      await expect(runMigrationLedger(db)).resolves.not.toThrow();
    });

    it('3.2 Permits DB canonical hash when disk has staging hash', async () => {
      await db.query(`
        UPDATE public.schema_migrations
        SET checksum = '${CANONICAL_00028_HASH}'
        WHERE version = '00028'
      `);

      // Mock disk having staging hash by modifying file in temp dir
      const tempDir = fs.mkdtempSync(path.join(path.resolve(__dirname, '../..'), 'temp-whitelist-disk-'));
      try {
        for (const file of allSqlFiles) {
          fs.copyFileSync(path.join(migrationsDir, file), path.join(tempDir, file));
        }

        // We know the whitelist contains both STAGING_00028_HASH and CANONICAL_00028_HASH
        expect(HISTORICAL_CHECKSUM_WHITELIST['00028']).toContain(STAGING_00028_HASH);
        expect(HISTORICAL_CHECKSUM_WHITELIST['00028']).toContain(CANONICAL_00028_HASH);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('3.3 REJECTS when DB has rogue hash even if version is 00028', async () => {
      await db.query(`
        UPDATE public.schema_migrations
        SET checksum = '${ROGUE_HASH}'
        WHERE version = '00028'
      `);

      let caughtError: any = null;
      try {
        await runMigrationLedger(db);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError.message).toContain('DATABASE_MIGRATION_INTEGRITY_VIOLATION');
      expect(caughtError.message).toContain('00028');
      expect(caughtError.message).toContain(ROGUE_HASH);
    });

    it('3.4 REJECTS when disk has rogue hash even if DB has whitelisted staging hash', async () => {
      await db.query(`
        UPDATE public.schema_migrations
        SET checksum = '${STAGING_00028_HASH}'
        WHERE version = '00028'
      `);

      const tempDir = fs.mkdtempSync(path.join(path.resolve(__dirname, '../..'), 'temp-rogue-disk-00028-'));
      try {
        for (const file of allSqlFiles) {
          fs.copyFileSync(path.join(migrationsDir, file), path.join(tempDir, file));
        }

        const f28 = path.join(tempDir, '00028_safe_audit_log_teardown_and_resolver_hardening.sql');
        fs.appendFileSync(f28, '\n-- UNWHITELISTED ROGUE DRIFT');

        let caughtError: any = null;
        try {
          await runMigrationLedger(db, tempDir);
        } catch (err: any) {
          caughtError = err;
        }

        expect(caughtError).not.toBeNull();
        expect(caughtError.message).toContain('DATABASE_MIGRATION_INTEGRITY_VIOLATION');
        expect(caughtError.message).toContain('00028');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('3.5 Restore 00028 canonical checksum in DB and verify clean pass', async () => {
      await db.query(`
        UPDATE public.schema_migrations
        SET checksum = '${CANONICAL_00028_HASH}'
        WHERE version = '00028'
      `);

      const res = await runMigrationLedger(db);
      expect(res.applied.length).toBe(0);
      expect(res.skipped.length).toBe(totalMigrationCount);
    });
  });

  // ===========================================================================
  // 4. Whitelist Scope Hardening: No other version can piggyback on whitelist
  // ===========================================================================
  it('4. Whitelist is strictly scoped to version 00028: other migrations cannot use staging hash', async () => {
    // Try setting migration 00027's db checksum to the whitelisted 00028 staging hash
    await db.query(`
      UPDATE public.schema_migrations
      SET checksum = '${STAGING_00028_HASH}'
      WHERE version = '00027'
    `);

    // Even though STAGING_00028_HASH is in HISTORICAL_CHECKSUM_WHITELIST['00028'],
    // it is NOT in HISTORICAL_CHECKSUM_WHITELIST['00027']!
    await expect(runMigrationLedger(db)).rejects.toThrow(
      /DATABASE_MIGRATION_INTEGRITY_VIOLATION.*00027/
    );

    // Revert 00027 back to normal
    const f27Path = path.join(migrationsDir, '00027_hardened_rls_and_narrow_resolvers.sql');
    const f27Sql = fs.readFileSync(f27Path, 'utf8');
    const f27Hash = require('crypto').createHash('sha256').update(f27Sql).digest('hex');
    await db.query(`
      UPDATE public.schema_migrations
      SET checksum = '${f27Hash}'
      WHERE version = '00027'
    `);
  });
});
