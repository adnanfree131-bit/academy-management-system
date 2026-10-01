import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { runMigrationLedger } from '../scripts/migrate.js';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Historical Migration Upgrade Convergence Test (C05)
 *
 * Simulates an existing database initialized on the older 00028 definition:
 * - Has older 00028 hash in schema_migrations
 * - Has service_role with EXECUTE privilege on public.purge_staging_audit_logs
 *
 * Verifies that running forward migrations (00029 & 00030):
 * 1. Succeeds without drift error (preflight allows whitelisted historical 00028 hash)
 * 2. Applies forward-only migrations 00029 and 00030
 * 3. Converges function security: REVOKES EXECUTE from service_role
 * 4. Ensures only postgres/supabase_admin hold EXECUTE privilege
 */
describe('Historical Database Upgrade Convergence (C05)', () => {
  it('converges security permissions on upgraded database that previously ran older 00028', async () => {
    const db = new PGlite();

    // 1. Initialize schema_migrations ledger and basic roles
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS public;
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fastify_runtime') THEN
          CREATE ROLE fastify_runtime NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
          CREATE ROLE supabase_admin NOLOGIN;
        END IF;
      END $$;
    `);

    // 2. Apply migrations 00001 through 00027 directly
    const migrationsDir = path.resolve(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const version = file.split('_')[0];
      const versionNum = parseInt(version, 10);
      if (versionNum < 28) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        const hash = createHash('sha256').update(sql).digest('hex');
        await db.exec(sql);
        await db.query(
          `INSERT INTO public.schema_migrations (version, name, checksum, applied_at)
           VALUES ($1, $2, $3, NOW())`,
          [version, file, hash]
        );
      }
    }

    // 3. Simulate the historical 00028 state:
    // Insert the historical accepted checksum into schema_migrations:
    const historical00028Hash = '0d52b2b205f068fc004650c3ae193c0a4aae7b52d1d43e246acb36789a531769';
    await db.query(
      `INSERT INTO public.schema_migrations (version, name, checksum, applied_at)
       VALUES ('00028', '00028_safe_audit_log_teardown_and_resolver_hardening.sql', $1, NOW())`,
      [historical00028Hash]
    );

    // Create the purge function with the older grant to service_role (the exact bug probed by the auditor):
    await db.exec(`
      CREATE OR REPLACE FUNCTION public.purge_staging_audit_logs(
        target_log_ids UUID[],
        target_tenant_ids UUID[] DEFAULT NULL
      )
      RETURNS INTEGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        RETURN 0;
      END;
      $$;

      -- Simulate historical permissive grant to service_role:
      GRANT EXECUTE ON FUNCTION public.purge_staging_audit_logs(UUID[], UUID[]) TO service_role;
    `);

    // Assert that before running migrations, service_role has EXECUTE privilege:
    const preCheck = await db.query<any>(
      `SELECT has_function_privilege('service_role', 'public.purge_staging_audit_logs(UUID[], UUID[])', 'EXECUTE') AS has_priv;`
    );
    expect(preCheck.rows[0].has_priv).toBe(true);

    // 4. Run the actual migration runner against this existing database
    const migrationResult = await runMigrationLedger(db);

    // Assert that 00028 was skipped (already applied) and 00029 + 00030 were applied
    expect(migrationResult.skipped).toContain('00028_safe_audit_log_teardown_and_resolver_hardening.sql');
    expect(migrationResult.applied).toContain('00029_reconcile_migration_ledger.sql');
    expect(migrationResult.applied).toContain('00030_enforce_purge_function_security_and_grants.sql');

    // 5. Assert that after migration 00030 runs, service_role's EXECUTE privilege is REVOKED!
    const postCheckServiceRole = await db.query<any>(
      `SELECT has_function_privilege('service_role', 'public.purge_staging_audit_logs(UUID[], UUID[])', 'EXECUTE') AS has_priv;`
    );
    expect(postCheckServiceRole.rows[0].has_priv).toBe(false);

    // Assert fastify_runtime also does NOT have execute privilege:
    const postCheckFastify = await db.query<any>(
      `SELECT has_function_privilege('fastify_runtime', 'public.purge_staging_audit_logs(UUID[], UUID[])', 'EXECUTE') AS has_priv;`
    );
    expect(postCheckFastify.rows[0].has_priv).toBe(false);

    // Assert postgres has execute privilege:
    const postCheckPostgres = await db.query<any>(
      `SELECT has_function_privilege('postgres', 'public.purge_staging_audit_logs(UUID[], UUID[])', 'EXECUTE') AS has_priv;`
    );
    expect(postCheckPostgres.rows[0].has_priv).toBe(true);
  });
});
