import dotenv from 'dotenv';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { getDatabaseSslConfig, parseDatabaseConfig } from '../db/connection.js';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

export interface PreflightReport {
  databaseHost: string;
  databaseName: string;
  connectedUser: string;
  sessionUser: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
  rolcreaterole: boolean;
  rolcreatedb: boolean;
  isAuthenticatedMember: boolean;
  publicSchemaUsage: boolean;
  publicSchemaCreateBlocked: boolean;
  authUsersPrivilegesBlocked: boolean;
  tenantsTableSelect: boolean;
  ddlBlocked: boolean;
  schemaOwnershipSafe: boolean;
  tableOwnershipSafe: boolean;
  status: 'PASS' | 'FAIL';
  failureReason?: string;
}

export function maskConnectionString(raw: string): string {
  if (!raw) return '[EMPTY]';
  try {
    const u = new URL(raw);
    if (u.password) {
      u.password = '***';
    }
    return u.toString();
  } catch {
    return raw.replace(/((?:postgres|postgresql):\/\/[^:\s\/]+:)[^@\s\/]+(@)/gi, '$1***$2');
  }
}

export async function runPreflight(clientOrPool: pg.Pool | pg.PoolClient): Promise<PreflightReport> {
  const isPool = ('totalCount' in clientOrPool) || (clientOrPool instanceof pg.Pool);
  const client: pg.PoolClient = isPool ? await (clientOrPool as pg.Pool).connect() : (clientOrPool as pg.PoolClient);

  try {
    // 1. Inspect role and database identity
    const idRes = await client.query<{
      current_user: string;
      session_user: string;
      current_database: string;
    }>('SELECT CURRENT_USER AS current_user, SESSION_USER AS session_user, current_database() AS current_database');

    const currentUser = idRes.rows[0]?.current_user ?? '';
    const sessionUser = idRes.rows[0]?.session_user ?? '';
    const currentDatabase = idRes.rows[0]?.current_database ?? '';

    // Prohibit execution under superuser/admin identity
    if (currentUser === 'postgres' || currentUser === 'supabase_admin') {
      throw new Error(
        `PREFLIGHT SECURITY VIOLATION: Connected as restricted administrator role '${currentUser}'. ` +
        `Application runtime must connect as 'fastify_runtime' with NOBYPASSRLS.`
      );
    }

    // Role name must be fastify_runtime or fastify_runtime.<PROJECT_REF> for Supabase poolers
    const isExactRuntimeRole = /^fastify_runtime(\.[a-z0-9_-]+)?$/.test(currentUser);
    if (!isExactRuntimeRole) {
      throw new Error(
        `PREFLIGHT SECURITY VIOLATION: Connected as unexpected role '${currentUser}'. ` +
        `Expected exact role 'fastify_runtime' or 'fastify_runtime.<PROJECT_REF>'.`
      );
    }

    // 2. Query pg_roles for security flags
    const roleRes = await client.query<{
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
    }>(
      'SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = $1',
      [currentUser]
    );

    if (roleRes.rows.length === 0) {
      throw new Error(`PREFLIGHT SECURITY VIOLATION: Role record for '${currentUser}' not found in pg_roles.`);
    }

    const { rolsuper, rolbypassrls, rolcreaterole, rolcreatedb } = roleRes.rows[0];

    if (rolsuper === true) {
      throw new Error(`PREFLIGHT SECURITY VIOLATION: Role '${currentUser}' has rolsuper=true. Least privilege violated.`);
    }

    if (rolbypassrls === true) {
      throw new Error(`PREFLIGHT SECURITY VIOLATION: Role '${currentUser}' has rolbypassrls=true. Row Level Security bypass prohibited.`);
    }

    if (rolcreaterole === true) {
      throw new Error(`PREFLIGHT SECURITY VIOLATION: Role '${currentUser}' has rolcreaterole=true. Role creation privilege prohibited.`);
    }

    if (rolcreatedb === true) {
      throw new Error(`PREFLIGHT SECURITY VIOLATION: Role '${currentUser}' has rolcreatedb=true. Database creation privilege prohibited.`);
    }

    // 3. Verify role membership in 'authenticated' for SET LOCAL ROLE in tenant transactions
    const memberRes = await client.query<{ is_member: boolean }>(
      `SELECT pg_has_role($1, 'authenticated', 'MEMBER') AS is_member`,
      [currentUser]
    );
    const isAuthenticatedMember = memberRes.rows[0]?.is_member ?? false;
    if (!isAuthenticatedMember) {
      throw new Error(
        `PREFLIGHT SECURITY VIOLATION: Role '${currentUser}' is not a member of 'authenticated'. ` +
        `SET LOCAL ROLE authenticated inside tenant transactions will fail with error 42501.`
      );
    }

    // 4. Verify Schema USAGE permissions
    const schemaPrivRes = await client.query<{ public_usage: boolean }>(
      `SELECT has_schema_privilege($1, 'public', 'USAGE') AS public_usage`,
      [currentUser]
    );
    const publicSchemaUsage = schemaPrivRes.rows[0]?.public_usage ?? false;
    if (!publicSchemaUsage) {
      throw new Error(`PREFLIGHT PRIVILEGE FAILURE: Role '${currentUser}' lacks USAGE privilege on schema 'public'.`);
    }

    // 4b. Verify Public Schema CREATE Privilege is Denied (Least Privilege)
    const schemaCreateRes = await client.query<{ public_create: boolean }>(
      `SELECT has_schema_privilege($1, 'public', 'CREATE') AS public_create`,
      [currentUser]
    );
    const publicSchemaCreate = schemaCreateRes.rows[0]?.public_create ?? false;
    if (publicSchemaCreate) {
      throw new Error(
        `PREFLIGHT SECURITY VIOLATION: Role '${currentUser}' has prohibited CREATE privilege on schema 'public'. ` +
        `DDL execution must be restricted.`
      );
    }
    const publicSchemaCreateBlocked = !publicSchemaCreate;

    // 4c. Verify auth.users direct table privileges are completely denied
    const authUsersPrivRes = await client.query<{
      has_auth_users: boolean;
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(
      `SELECT
         to_regclass('auth.users') IS NOT NULL AS has_auth_users,
         CASE WHEN to_regclass('auth.users') IS NOT NULL THEN has_table_privilege($1, 'auth.users', 'SELECT') ELSE false END AS can_select,
         CASE WHEN to_regclass('auth.users') IS NOT NULL THEN has_table_privilege($1, 'auth.users', 'INSERT') ELSE false END AS can_insert,
         CASE WHEN to_regclass('auth.users') IS NOT NULL THEN has_table_privilege($1, 'auth.users', 'UPDATE') ELSE false END AS can_update,
         CASE WHEN to_regclass('auth.users') IS NOT NULL THEN has_table_privilege($1, 'auth.users', 'DELETE') ELSE false END AS can_delete`,
      [currentUser]
    );
    const authPrivs = authUsersPrivRes.rows[0];
    let authUsersPrivilegesBlocked = true;
    if (authPrivs?.has_auth_users) {
      const prohibited: string[] = [];
      if (authPrivs.can_select) prohibited.push('SELECT');
      if (authPrivs.can_insert) prohibited.push('INSERT');
      if (authPrivs.can_update) prohibited.push('UPDATE');
      if (authPrivs.can_delete) prohibited.push('DELETE');

      if (prohibited.length > 0) {
        authUsersPrivilegesBlocked = false;
        throw new Error(
          `PREFLIGHT SECURITY VIOLATION: Role '${currentUser}' has prohibited direct table privilege(s) [${prohibited.join(', ')}] on 'auth.users'. ` +
          `Application must access auth identities strictly via Supabase GoTrue or narrow security definer functions.`
        );
      }
    }

    // 5. Verify Table SELECT permissions
    const tablePrivRes = await client.query<{ tenants_select: boolean }>(
      `SELECT has_table_privilege($1, 'public.tenants', 'SELECT') AS tenants_select`,
      [currentUser]
    );
    const tenantsTableSelect = tablePrivRes.rows[0]?.tenants_select ?? false;
    if (!tenantsTableSelect) {
      throw new Error(`PREFLIGHT PRIVILEGE FAILURE: Role '${currentUser}' lacks SELECT privilege on table 'public.tenants'.`);
    }

    // 6. Negative DDL Probe: attempt CREATE TABLE inside transaction and assert error 42501
    let ddlBlocked = false;
    let ddlErrorCode: string | null = null;
    await client.query('BEGIN');
    try {
      await client.query('CREATE TABLE public.__probe_boundary (id int)');
      await client.query('ROLLBACK');
    } catch (err: any) {
      ddlErrorCode = err.code;
      if (err.code === '42501') {
        ddlBlocked = true;
      }
      try {
        await client.query('ROLLBACK');
      } catch {}
    }

    if (!ddlBlocked) {
      throw new Error(
        `PREFLIGHT SECURITY VIOLATION: Role '${currentUser}' was able to execute DDL table creation. ` +
        `Expected error 42501 (insufficient_privilege), got code: ${ddlErrorCode ?? 'SUCCESS'}.`
      );
    }

    // 7. Verify Schema and Table Ownership Safety
    const schemaOwnerRes = await client.query<{ schema_owner: string }>(
      `SELECT schema_owner FROM information_schema.schemata WHERE schema_name = 'public'`
    );
    const schemaOwner = schemaOwnerRes.rows[0]?.schema_owner ?? '';
    const schemaOwnershipSafe = schemaOwner !== currentUser;
    if (!schemaOwnershipSafe) {
      throw new Error(`PREFLIGHT SECURITY VIOLATION: Public schema is owned by runtime role '${currentUser}'.`);
    }

    const tableOwnerRes = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM pg_tables WHERE schemaname = 'public' AND tableowner = $1`,
      [currentUser]
    );
    const tableOwnershipCount = parseInt(tableOwnerRes.rows[0]?.count ?? '0', 10);
    const tableOwnershipSafe = tableOwnershipCount === 0;
    if (!tableOwnershipSafe) {
      throw new Error(
        `PREFLIGHT SECURITY VIOLATION: Runtime role '${currentUser}' owns ${tableOwnershipCount} tables in schema 'public'.`
      );
    }

    return {
      databaseHost: client.host || 'remote-host',
      databaseName: currentDatabase,
      connectedUser: currentUser,
      sessionUser,
      rolsuper,
      rolbypassrls,
      rolcreaterole,
      rolcreatedb,
      isAuthenticatedMember,
      publicSchemaUsage,
      publicSchemaCreateBlocked,
      authUsersPrivilegesBlocked,
      tenantsTableSelect,
      ddlBlocked,
      schemaOwnershipSafe,
      tableOwnershipSafe,
      status: 'PASS',
    };
  } finally {
    if (isPool) {
      client.release();
    }
  }
}

export async function main(): Promise<void> {
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (!dbUrl) {
    console.error('\n================================================================================');
    console.error('              PREFLIGHT CHECK FAILED: MISSING DATABASE_URL                      ');
    console.error('================================================================================');
    console.error('DATABASE_URL environment variable is required to run database preflight.');
    console.error('Application fails closed to prevent unauthenticated execution.');
    process.exit(1);
  }

  const maskedUrl = maskConnectionString(dbUrl);
  console.log('\n================================================================================');
  console.log('                 DATABASE RUNTIME ROLE PREFLIGHT CHECK                          ');
  console.log('================================================================================');
  console.log(`Target Connection:  ${maskedUrl}`);
  console.log(`TLS Verification:   Strict (rejectUnauthorized: true)`);

  const poolConfig = parseDatabaseConfig(dbUrl);
  const pool = new pg.Pool({
    ...poolConfig,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 5000,
  });

  try {
    const report = await runPreflight(pool);

    console.log('\n[ROLE & PRIVILEGE VERIFICATION]');
    console.log(`  Connected Role:    ${report.connectedUser}`);
    console.log(`  Session User:      ${report.sessionUser}`);
    console.log(`  Database Name:     ${report.databaseName}`);
    console.log(`  rolsuper:          ${report.rolsuper} [PASS]`);
    console.log(`  rolbypassrls:      ${report.rolbypassrls} [PASS]`);
    console.log(`  rolcreaterole:     ${report.rolcreaterole} [PASS]`);
    console.log(`  rolcreatedb:       ${report.rolcreatedb} [PASS]`);
    console.log(`  authenticated mem: ${report.isAuthenticatedMember} [PASS]`);
    console.log(`  Schema USAGE:      ${report.publicSchemaUsage} [PASS]`);
    console.log(`  Schema CREATE:     blocked (has_schema_privilege=false) [PASS]`);
    console.log(`  auth.users Access: blocked (no SELECT, INSERT, UPDATE, DELETE) [PASS]`);
    console.log(`  Table SELECT:      ${report.tenantsTableSelect} [PASS]`);
    console.log(`  Negative DDL Probe:CREATE TABLE denied with 42501 [PASS]`);
    console.log(`  Schema Ownership:  Safe (not owned by runtime role) [PASS]`);
    console.log(`  Table Ownership:   Safe (0 tables owned by runtime role) [PASS]`);
    console.log('\n================================================================================');
    console.log('PREFLIGHT STATUS: PASS (Runtime Role Enforces Least Privilege & RLS)');
    console.log('================================================================================\n');
  } catch (err: any) {
    console.error('\n================================================================================');
    console.error('                      PREFLIGHT VERIFICATION FAILED                             ');
    console.error('================================================================================');
    console.error(`Error: ${err.message}`);
    console.error('Application fails closed: database connection does not satisfy security boundaries.');
    console.error('================================================================================\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Execute main if run directly from CLI
const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && (invokedPath === currentFilePath || invokedPath.endsWith('db-preflight.ts') || invokedPath.endsWith('db-preflight.js'))) {
  main().catch((err) => {
    console.error('Preflight unhandled fatal error:', err.message);
    process.exit(1);
  });
}
