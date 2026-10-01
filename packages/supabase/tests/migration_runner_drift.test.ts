import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { runMigrationLedger } from '../scripts/migrate.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Migration Runner Drift Detection Acceptance Suite (B12)
 * 
 * Verifies:
 * 1. Modified historical migration files are detected and rejected with DATABASE_MIGRATION_INTEGRITY_VIOLATION.
 * 2. Unwhitelisted rogue checksums in schema_migrations trigger drift violations.
 * 3. Legitimate historical aliases (e.g. 00028 staging baseline) are permitted.
 * 4. All migrations apply cleanly and idempotently.
 */

describe('Migration Runner Checksum Drift Hardening (B12)', () => {
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

  it('1. Clean database applies all migration files from 00001 through latest version', async () => {
    const result = await runMigrationLedger(db);
    expect(result.applied.length).toBe(totalMigrationFiles);
    expect(result.skipped.length).toBe(0);

    const ledger = await db.query<any>('SELECT COUNT(*) FROM public.schema_migrations');
    expect(parseInt(ledger.rows[0].count as string, 10)).toBe(totalMigrationFiles);
  });

  it('2. Tampering with an applied migration file on disk triggers DATABASE_MIGRATION_INTEGRITY_VIOLATION', async () => {
    const tempDir = fs.mkdtempSync(path.join(path.resolve(__dirname, '../..'), 'temp-drift-test-'));
    try {
      const allFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
      for (const file of allFiles) {
        fs.copyFileSync(path.join(migrationsDir, file), path.join(tempDir, file));
      }

      // Tamper with historical migration 00002
      const tamperedFile = path.join(tempDir, '00002_academic_hierarchy_and_sis.sql');
      fs.appendFileSync(tamperedFile, '\n-- MALICIOUS DRIFT INJECTION');

      await expect(runMigrationLedger(db, tempDir)).rejects.toThrow(
        /DATABASE_MIGRATION_INTEGRITY_VIOLATION/
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('3. Recognizes historical baseline alias for 00028 without error', async () => {
    // Simulate remote staging ledger state where 00028 was recorded with pre-test hash
    await db.query(`
      UPDATE public.schema_migrations
      SET checksum = '0d52b2b205f068fc004650c3ae193c0a4aae7b52d1d43e246acb36789a531769'
      WHERE version = '00028'
    `);

    // Must resolve cleanly via historical alias whitelist
    await expect(runMigrationLedger(db)).resolves.not.toThrow();
  });

  it('4. Rejects unwhitelisted arbitrary checksum drift in database ledger', async () => {
    // Alter 00028 to an arbitrary unrecognized hash
    await db.query(`
      UPDATE public.schema_migrations
      SET checksum = '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff'
      WHERE version = '00028'
    `);

    await expect(runMigrationLedger(db)).rejects.toThrow(
      /DATABASE_MIGRATION_INTEGRITY_VIOLATION/
    );

    // Restore canonical checksum
    await db.query(`
      UPDATE public.schema_migrations
      SET checksum = '106d2c36d2940fd79b52b477f083393aa5a1e6c45bb2d2f262d061aaa8bd2d26'
      WHERE version = '00028'
    `);
  });

  it('5. Re-running migration ledger on clean database is strictly idempotent', async () => {
    const result = await runMigrationLedger(db);
    expect(result.applied.length).toBe(0);
    expect(result.skipped.length).toBe(totalMigrationFiles);
  });
});
