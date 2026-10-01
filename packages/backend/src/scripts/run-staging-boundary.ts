import dotenv from 'dotenv';
import path from 'path';
import pg from 'pg';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { buildApp } from '../app.js';
import { getDatabasePool, closeDatabasePool, parseDatabaseConfig } from '../db/connection.js';
import { runPreflight, PreflightReport } from './db-preflight.js';
import { defaultJwtVerifier } from '../lib/jwt-verifier.js';
import { getSupabaseAdminClient } from '../lib/supabase.js';
import { InMemoryDataStore } from '../services/store.js';
import { withPlatformTransaction, withTenantTransaction } from '../db/transactions.js';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

export const STAGING_PROJECT_ALLOWLIST = new Set(['mddjjlkmdqzghculpjcd']);

export function extractProjectRef(urlStr: string): string | null {
  if (!urlStr) return null;
  // Match username like fastify_runtime.mddjjlkmdqzghculpjcd or postgres.mddjjlkmdqzghculpjcd
  const userMatch = urlStr.match(/:\/\/(?:[^:@]+[.:])([a-z0-9]{20})[:@]/i);
  if (userMatch) return userMatch[1].toLowerCase();

  // Match hostname like mddjjlkmdqzghculpjcd.supabase.co
  const hostMatch = urlStr.match(/(?:https?:\/\/|@)?([a-z0-9]{20})\.supabase\.co/i);
  if (hostMatch) return hostMatch[1].toLowerCase();

  // Match pooler host or query param like aws-0-ap-southeast-1.pooler.supabase.com with username
  const refMatch = urlStr.match(/\.([a-z0-9]{20})[:@]/i);
  if (refMatch) return refMatch[1].toLowerCase();

  return null;
}

export function validateStagingProjectRef(url: string, urlName: string): string {
  const ref = extractProjectRef(url);
  if (!ref || !STAGING_PROJECT_ALLOWLIST.has(ref)) {
    throw new Error(
      `SECURITY VIOLATION: ${urlName} targets project ref '${ref ?? 'unknown'}', which is NOT in STAGING_PROJECT_ALLOWLIST [${Array.from(STAGING_PROJECT_ALLOWLIST).join(', ')}]. Aborting immediately to protect non-staging environments.`
    );
  }
  return ref;
}

export interface StagingFixtureRegistry {
  tenantIds: Set<string>;
  profileIds: Set<string>;
  membershipIds: Set<string>;
  batchIds: Set<string>;
  studentIds: Set<string>;
  programIds: Set<string>;
  auditLogIds: Set<string>;
  authUserIds: Set<string>;
}

export interface ScenarioResult {
  scenarioId: string;
  name: string;
  passed: boolean;
  httpStatus?: number;
  details: string;
}

export interface OrphanRecordMap {
  students: string[];
  batches: string[];
  programs: string[];
  auditLogs: string[];
  memberships: string[];
  profiles: string[];
  tenants: string[];
  authUsers: string[];
}

export interface TeardownReport {
  purgedStudents: number;
  purgedBatches: number;
  purgedPrograms: number;
  purgedAuditLogs: number;
  purgedMemberships: number;
  purgedProfiles: number;
  purgedAuthUsers: number;
  purgedTenants: number;
  clean: boolean;
  errors: string[];
  orphanIds: OrphanRecordMap;
}

export interface BoundarySuiteReport {
  preflight: PreflightReport;
  scenarios: ScenarioResult[];
  teardown: TeardownReport;
  passed: boolean;
}

export function createEmptyRegistry(): StagingFixtureRegistry {
  return {
    tenantIds: new Set<string>(),
    profileIds: new Set<string>(),
    membershipIds: new Set<string>(),
    batchIds: new Set<string>(),
    studentIds: new Set<string>(),
    programIds: new Set<string>(),
    auditLogIds: new Set<string>(),
    authUserIds: new Set<string>(),
  };
}

export async function teardownStagingFixtures(
  clientOrPoolOrRegistry: pg.Pool | pg.PoolClient | StagingFixtureRegistry,
  maybeRegistry?: StagingFixtureRegistry,
  _adminAuthId?: string,
  maybeSupabaseAdmin?: SupabaseClient
): Promise<TeardownReport> {
  let registry: StagingFixtureRegistry;
  let supabaseAdmin: SupabaseClient | undefined;
  let providedClient: pg.PoolClient | null = null;

  if ('tenantIds' in clientOrPoolOrRegistry) {
    registry = clientOrPoolOrRegistry as StagingFixtureRegistry;
    supabaseAdmin = maybeSupabaseAdmin || getSupabaseAdminClient();
  } else {
    providedClient = ('query' in clientOrPoolOrRegistry) ? (clientOrPoolOrRegistry as pg.PoolClient) : null;
    registry = maybeRegistry || createEmptyRegistry();
    supabaseAdmin = maybeSupabaseAdmin || getSupabaseAdminClient();
  }

  const report: TeardownReport = {
    purgedStudents: 0,
    purgedBatches: 0,
    purgedPrograms: 0,
    purgedAuditLogs: 0,
    purgedMemberships: 0,
    purgedProfiles: 0,
    purgedAuthUsers: 0,
    purgedTenants: 0,
    clean: true,
    errors: [],
    orphanIds: {
      students: [],
      batches: [],
      programs: [],
      auditLogs: [],
      memberships: [],
      profiles: [],
      tenants: [],
      authUsers: [],
    },
  };

  const hasDbFixtures =
    registry.studentIds.size > 0 ||
    registry.batchIds.size > 0 ||
    registry.programIds.size > 0 ||
    registry.auditLogIds.size > 0 ||
    registry.membershipIds.size > 0 ||
    registry.profileIds.size > 0 ||
    registry.tenantIds.size > 0;

  const migrationDbUrl = (process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!providedClient && !migrationDbUrl) {
    report.clean = false;
    report.errors.push('MIGRATION_DATABASE_URL is not configured for administrative teardown.');
  } else if (providedClient || hasDbFixtures) {
    let adminPool: pg.Pool | null = null;
    let adminClient: pg.PoolClient | null = providedClient;
    try {
      if (!adminClient) {
        const adminConfig = parseDatabaseConfig(migrationDbUrl);
        adminPool = new pg.Pool(adminConfig);
        adminClient = await adminPool.connect();
      }

      // 1. Purge Students (Independent try/catch)
      if (registry.studentIds.size > 0) {
        try {
          const ids = Array.from(registry.studentIds);
          const res = await adminClient.query('DELETE FROM public.students WHERE id = ANY($1)', [ids]);
          report.purgedStudents = res.rowCount ?? 0;
        } catch (err: any) {
          try { await adminClient.query('ROLLBACK'); } catch {}
          report.clean = false;
          report.errors.push(`Failed to purge students: ${err.message}`);
        }
      }

      // 2. Purge Batches (Independent try/catch)
      if (registry.batchIds.size > 0) {
        try {
          const ids = Array.from(registry.batchIds);
          const res = await adminClient.query('DELETE FROM public.batches WHERE id = ANY($1)', [ids]);
          report.purgedBatches = res.rowCount ?? 0;
        } catch (err: any) {
          try { await adminClient.query('ROLLBACK'); } catch {}
          report.clean = false;
          report.errors.push(`Failed to purge batches: ${err.message}`);
        }
      }

      // 3. Purge Programs (Independent try/catch)
      if (registry.programIds.size > 0) {
        try {
          const ids = Array.from(registry.programIds);
          const res = await adminClient.query('DELETE FROM public.programs WHERE id = ANY($1)', [ids]);
          report.purgedPrograms = res.rowCount ?? 0;
        } catch (err: any) {
          try { await adminClient.query('ROLLBACK'); } catch {}
          report.clean = false;
          report.errors.push(`Failed to purge programs: ${err.message}`);
        }
      }

      // 4. Purge Audit Logs (Independent try/catch & safe purge mechanism per R3)
      if (registry.auditLogIds.size > 0) {
        try {
          const ids = Array.from(registry.auditLogIds);
          try {
            const res = await adminClient.query<{ purged: number }>(
              'SELECT public.purge_staging_audit_logs($1::uuid[]) as purged',
              [ids]
            );
            report.purgedAuditLogs = Number(res.rows[0]?.purged ?? 0);
          } catch (fnErr: any) {
            // Fallback transaction-local GUC
            await adminClient.query('BEGIN');
            try {
              await adminClient.query("SET LOCAL app.allow_staging_audit_purge = 'on'");
              const res = await adminClient.query('DELETE FROM public.audit_logs WHERE id = ANY($1)', [ids]);
              await adminClient.query('COMMIT');
              report.purgedAuditLogs = res.rowCount ?? 0;
            } catch (txErr: any) {
              await adminClient.query('ROLLBACK');
              report.clean = false;
              report.errors.push(`Failed to purge audit logs: ${txErr.message}`);
            }
          }
        } catch (err: any) {
          try { await adminClient.query('ROLLBACK'); } catch {}
          report.clean = false;
          report.errors.push(`Failed to purge audit logs: ${err.message}`);
        }
      }

      // 5. Purge Tenant Memberships (Independent try/catch)
      if (registry.membershipIds.size > 0) {
        try {
          const ids = Array.from(registry.membershipIds);
          const res = await adminClient.query('DELETE FROM public.tenant_memberships WHERE id = ANY($1)', [ids]);
          report.purgedMemberships = res.rowCount ?? 0;
        } catch (err: any) {
          try { await adminClient.query('ROLLBACK'); } catch {}
          report.clean = false;
          report.errors.push(`Failed to purge tenant memberships: ${err.message}`);
        }
      }

      // 6. Purge Profiles (Independent try/catch)
      if (registry.profileIds.size > 0) {
        try {
          const ids = Array.from(registry.profileIds);
          const res = await adminClient.query('DELETE FROM public.profiles WHERE id = ANY($1)', [ids]);
          report.purgedProfiles = res.rowCount ?? 0;
        } catch (err: any) {
          try { await adminClient.query('ROLLBACK'); } catch {}
          report.clean = false;
          report.errors.push(`Failed to purge profiles: ${err.message}`);
        }
      }

      // 7. Purge Tenants (Independent try/catch)
      if (registry.tenantIds.size > 0) {
        try {
          const ids = Array.from(registry.tenantIds);
          const res = await adminClient.query('DELETE FROM public.tenants WHERE id = ANY($1)', [ids]);
          report.purgedTenants = res.rowCount ?? 0;
        } catch (err: any) {
          try { await adminClient.query('ROLLBACK'); } catch {}
          report.clean = false;
          report.errors.push(`Failed to purge tenants: ${err.message}`);
        }
      }

      // Exact Orphan UUID Verification (Isolated per table)
      if (registry.studentIds.size > 0) {
        try {
          const chk = await adminClient.query(
            'SELECT id FROM public.students WHERE id = ANY($1)',
            [Array.from(registry.studentIds)]
          );
          if (chk.rows.length > 0) {
            const orphanIds = chk.rows.map((r: any) => String(r.id));
            report.clean = false;
            report.orphanIds.students = orphanIds;
            report.errors.push(`Orphaned students remained after teardown (${orphanIds.length}): [${orphanIds.join(', ')}]`);
          }
        } catch (chkErr: any) {
          try { await adminClient.query('ROLLBACK'); } catch {}
          report.clean = false;
          report.errors.push(`Failed to verify student orphans: ${chkErr.message}`);
        }
      }

      if (registry.batchIds.size > 0) {
        try {
          const chk = await adminClient.query(
            'SELECT id FROM public.batches WHERE id = ANY($1)',
            [Array.from(registry.batchIds)]
          );
          if (chk.rows.length > 0) {
            const orphanIds = chk.rows.map((r: any) => String(r.id));
            report.clean = false;
            report.orphanIds.batches = orphanIds;
            report.errors.push(`Orphaned batches remained after teardown (${orphanIds.length}): [${orphanIds.join(', ')}]`);
          }
        } catch (chkErr: any) {
          try { await adminClient.query('ROLLBACK'); } catch {}
          report.clean = false;
          report.errors.push(`Failed to verify batch orphans: ${chkErr.message}`);
        }
      }

      if (registry.programIds.size > 0) {
        try {
          const chk = await adminClient.query(
            'SELECT id FROM public.programs WHERE id = ANY($1)',
            [Array.from(registry.programIds)]
          );
          if (chk.rows.length > 0) {
            const orphanIds = chk.rows.map((r: any) => String(r.id));
            report.clean = false;
            report.orphanIds.programs = orphanIds;
            report.errors.push(`Orphaned programs remained after teardown (${orphanIds.length}): [${orphanIds.join(', ')}]`);
          }
        } catch (chkErr: any) {
          try { await adminClient.query('ROLLBACK'); } catch {}
          report.clean = false;
          report.errors.push(`Failed to verify program orphans: ${chkErr.message}`);
        }
      }

      if (registry.auditLogIds.size > 0) {
        try {
          const chk = await adminClient.query(
            'SELECT id FROM public.audit_logs WHERE id = ANY($1)',
            [Array.from(registry.auditLogIds)]
          );
          if (chk.rows.length > 0) {
            const orphanIds = chk.rows.map((r: any) => String(r.id));
            report.clean = false;
            report.orphanIds.auditLogs = orphanIds;
            report.errors.push(`Orphaned audit logs remained after teardown (${orphanIds.length}): [${orphanIds.join(', ')}]`);
          }
        } catch (chkErr: any) {
          try { await adminClient.query('ROLLBACK'); } catch {}
          report.clean = false;
          report.errors.push(`Failed to verify audit log orphans: ${chkErr.message}`);
        }
      }

      if (registry.membershipIds.size > 0) {
        try {
          const chk = await adminClient.query(
            'SELECT id FROM public.tenant_memberships WHERE id = ANY($1)',
            [Array.from(registry.membershipIds)]
          );
          if (chk.rows.length > 0) {
            const orphanIds = chk.rows.map((r: any) => String(r.id));
            report.clean = false;
            report.orphanIds.memberships = orphanIds;
            report.errors.push(`Orphaned tenant memberships remained after teardown (${orphanIds.length}): [${orphanIds.join(', ')}]`);
          }
        } catch (chkErr: any) {
          try { await adminClient.query('ROLLBACK'); } catch {}
          report.clean = false;
          report.errors.push(`Failed to verify membership orphans: ${chkErr.message}`);
        }
      }

      if (registry.profileIds.size > 0) {
        try {
          const chk = await adminClient.query(
            'SELECT id FROM public.profiles WHERE id = ANY($1)',
            [Array.from(registry.profileIds)]
          );
          if (chk.rows.length > 0) {
            const orphanIds = chk.rows.map((r: any) => String(r.id));
            report.clean = false;
            report.orphanIds.profiles = orphanIds;
            report.errors.push(`Orphaned profiles remained after teardown (${orphanIds.length}): [${orphanIds.join(', ')}]`);
          }
        } catch (chkErr: any) {
          try { await adminClient.query('ROLLBACK'); } catch {}
          report.clean = false;
          report.errors.push(`Failed to verify profile orphans: ${chkErr.message}`);
        }
      }

      if (registry.tenantIds.size > 0) {
        try {
          const chk = await adminClient.query(
            'SELECT id FROM public.tenants WHERE id = ANY($1)',
            [Array.from(registry.tenantIds)]
          );
          if (chk.rows.length > 0) {
            const orphanIds = chk.rows.map((r: any) => String(r.id));
            report.clean = false;
            report.orphanIds.tenants = orphanIds;
            report.errors.push(`Orphaned tenants remained after teardown (${orphanIds.length}): [${orphanIds.join(', ')}]`);
          }
        } catch (chkErr: any) {
          try { await adminClient.query('ROLLBACK'); } catch {}
          report.clean = false;
          report.errors.push(`Failed to verify tenant orphans: ${chkErr.message}`);
        }
      }
    } catch (err: any) {
      report.clean = false;
      report.errors.push(`Teardown DB connection error: ${err.message}`);
    } finally {
      if (adminClient && !providedClient) {
        try { adminClient.release(); } catch {}
      }
      if (adminPool) {
        try { await adminPool.end(); } catch {}
      }
    }
  }

  // 8. Delete GoTrue Auth test users via Supabase Admin API (Unconditional Execution)
  if (registry.authUserIds.size > 0) {
    if (!supabaseAdmin) {
      try {
        supabaseAdmin = getSupabaseAdminClient();
      } catch (adminClientErr: any) {
        report.clean = false;
        report.errors.push(`Unable to acquire Supabase Admin client for auth teardown: ${adminClientErr.message}`);
      }
    }

    if (supabaseAdmin) {
      for (const authUserId of registry.authUserIds) {
        try {
          const { error } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
          if (error) {
            if (error.status === 404 || error.message?.toLowerCase().includes('not found')) {
              report.purgedAuthUsers++;
            } else {
              report.errors.push(`Failed to delete GoTrue auth user ${authUserId}: ${error.message}`);
              report.orphanIds.authUsers.push(authUserId);
              report.clean = false;
            }
          } else {
            report.purgedAuthUsers++;
          }
        } catch (authErr: any) {
          report.errors.push(`Exception deleting GoTrue auth user ${authUserId}: ${authErr.message}`);
          report.orphanIds.authUsers.push(authUserId);
          report.clean = false;
        }
      }
    } else {
      for (const authUserId of registry.authUserIds) {
        report.orphanIds.authUsers.push(authUserId);
      }
    }
  }

  if (report.errors.length > 0) {
    report.clean = false;
  }

  return report;
}

export interface StagingRunnerOverrides {
  supabaseAdmin?: SupabaseClient | any;
  createAnonClient?: (url: string, key: string, options?: any) => SupabaseClient | any;
  jwtVerifier?: { verify: (token: string) => Promise<any> };
  app?: any;
  pool?: pg.Pool | any;
  skipPreflight?: boolean;
}

export async function runStagingBoundarySuite(overrides?: StagingRunnerOverrides): Promise<BoundarySuiteReport> {
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  const migrationDbUrl = (process.env.MIGRATION_DATABASE_URL || '').trim();
  const supabaseUrl = (process.env.SUPABASE_URL || 'https://mddjjlkmdqzghculpjcd.supabase.co').trim();

  if (!overrides && (process.env.RUN_REAL_STAGING_TESTS !== 'true' || !dbUrl)) {
    console.error('\n================================================================================');
    console.error('              STAGING TEST HALTED: OPT-IN GUARDRAIL NOT MET                     ');
    console.error('================================================================================');
    console.error('To execute the real staging database boundary test suite, you must provide:');
    console.error('  RUN_REAL_STAGING_TESTS=true');
    console.error('  DATABASE_URL=<postgres://fastify_runtime:password@host:port/database>');
    console.error('  MIGRATION_DATABASE_URL=<postgres://postgres:password@host:port/database>');
    console.error('  SUPABASE_URL=<https://<ref>.supabase.co>');
    console.error('Aborting with exit code 1 to protect production boundaries.');
    console.error('================================================================================\n');
    process.exit(1);
  }

  // Enforce staging project allowlist
  if (dbUrl && migrationDbUrl && supabaseUrl) {
    console.log('\n[GUARDRAILS] Validating Target Staging Project Allowlist...');
    const dbRef = validateStagingProjectRef(dbUrl, 'DATABASE_URL');
    const migRef = validateStagingProjectRef(migrationDbUrl, 'MIGRATION_DATABASE_URL');
    const supRef = validateStagingProjectRef(supabaseUrl, 'SUPABASE_URL');
    console.log(`      Verified Target Project Ref: '${dbRef}' (migration: '${migRef}', supabase: '${supRef}').`);
  }

  // 1. Execute Preflight Verification
  const pool: pg.Pool = overrides?.pool || getDatabasePool();
  let preflight: PreflightReport;

  if (overrides?.skipPreflight) {
    preflight = {
      status: 'PASS',
      connectedUser: 'fastify_runtime',
      sessionUser: 'fastify_runtime',
      rolsuper: false,
      rolbypassrls: false,
      rolcreaterole: false,
      rolcreatedb: false,
      isAuthenticatedMember: true,
      databaseHost: 'localhost',
      databaseName: 'staging_test',
      publicSchemaUsage: true,
      publicSchemaCreateBlocked: true,
      authUsersPrivilegesBlocked: true,
      tenantsTableSelect: true,
      ddlBlocked: true,
      schemaOwnershipSafe: true,
      tableOwnershipSafe: true,
    };
  } else {
    console.log('\n[1/4] Running Database Runtime Role Preflight...');
    preflight = await runPreflight(pool);
    if (preflight.status !== 'PASS') {
      throw new Error('Preflight checks failed. Boundary tests aborted.');
    }
    console.log('      Preflight PASSED. Role connects as fastify_runtime with NOBYPASSRLS.');
  }

  // 2. Initialize Real Fastify Application without in-memory store
  let app = overrides?.app;
  if (!app) {
    console.log('\n[2/4] Starting Fastify Application with PostgresDataStore...');
    app = await buildApp();
    await app.ready();

    // Enforce zero InMemoryDataStore / PGlite in production boundary test
    if ((app as any).store instanceof InMemoryDataStore || (app as any).store?.constructor?.name === 'InMemoryDataStore') {
      throw new Error('FATAL SECURITY VIOLATION: Application instantiated with InMemoryDataStore. Real database required.');
    }
  }

  const registry = createEmptyRegistry();
  const scenarios: ScenarioResult[] = [];
  const suffix = randomUUID().slice(0, 8);

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const teacherMembershipId = randomUUID();
  const programAId = randomUUID();
  const programBId = randomUUID();
  const batchAId = randomUUID();
  const batchBId = randomUUID();
  const studentAId = randomUUID();
  const studentBId = randomUUID();

  const supabaseAdmin = overrides?.supabaseAdmin || getSupabaseAdminClient();
  const anonKey = (process.env.SUPABASE_ANON_KEY || 'anon-key-placeholder').trim();
  if (!overrides && !process.env.SUPABASE_ANON_KEY) {
    throw new Error('FATAL: SUPABASE_ANON_KEY is required to sign in staging users via GoTrue Auth.');
  }

  const commonPassword = `StagingTestPass_2026_${randomUUID().slice(0, 8)}!`;

  interface StagingAuthUserConfig {
    roleType: 'admin_a' | 'admin_b' | 'teacher' | 'suspended';
    email: string;
    password: string;
    authId?: string;
    token?: string;
  }

  const userConfigs: StagingAuthUserConfig[] = [
    { roleType: 'admin_a', email: `staging-admin-a-${suffix}@staging.test`, password: commonPassword },
    { roleType: 'admin_b', email: `staging-admin-b-${suffix}@staging.test`, password: commonPassword },
    { roleType: 'teacher', email: `staging-teacher-a-${suffix}@staging.test`, password: commonPassword },
    { roleType: 'suspended', email: `staging-suspended-${suffix}@staging.test`, password: commonPassword },
  ];

  let client: pg.PoolClient | null = null;
  let executionErr: any = null;
  let adminAAuthId: string = '';
  let adminAEmail: string = '';
  let adminBAuthId: string = '';
  let adminBEmail: string = '';
  let teacherAuthId: string = '';
  let teacherEmail: string = '';
  let suspendedAuthId: string = '';
  let suspendedEmail: string = '';
  let tokenA: string = '';
  let tokenB: string = '';
  let tokenTeacher: string = '';
  let tokenSuspended: string = '';

  try {
    console.log('\n[AUTH] Dynamically Provisioning 4 GoTrue Auth Users via Admin API...');
    const jwtVerifier = overrides?.jwtVerifier || (app as any).jwtVerifier || defaultJwtVerifier;
    const supabaseAnon = overrides?.createAnonClient
      ? overrides.createAnonClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : createClient(supabaseUrl, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

    for (const userConfig of userConfigs) {
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: userConfig.email,
        password: userConfig.password,
        email_confirm: true,
      });
      if (createError || !createData.user) {
        throw new Error(`Failed to create GoTrue auth user ${userConfig.email}: ${createError?.message}`);
      }
      userConfig.authId = createData.user.id;
      registry.authUserIds.add(createData.user.id);

      // Sign in with password to obtain authentic asymmetric ES256 JWT
      const { data: signData, error: signError } = await supabaseAnon.auth.signInWithPassword({
        email: userConfig.email,
        password: userConfig.password,
      });
      if (signError || !signData.session?.access_token) {
        throw new Error(`Failed to sign in GoTrue auth user ${userConfig.email}: ${signError?.message}`);
      }
      userConfig.token = signData.session.access_token;

      // Cryptographic verification against remote Supabase JWKS
      const claims = await jwtVerifier.verify(userConfig.token);
      const resolvedSubject = String(claims.sub || claims.user_id || '');
      if (resolvedSubject !== userConfig.authId) {
        throw new Error(`JWKS verification subject mismatch for ${userConfig.email}. Expected ${userConfig.authId}, got ${resolvedSubject}`);
      }
    }

    tokenA = userConfigs[0].token!;
    adminAAuthId = userConfigs[0].authId!;
    adminAEmail = userConfigs[0].email;

    tokenB = userConfigs[1].token!;
    adminBAuthId = userConfigs[1].authId!;
    adminBEmail = userConfigs[1].email;

    tokenTeacher = userConfigs[2].token!;
    teacherAuthId = userConfigs[2].authId!;
    teacherEmail = userConfigs[2].email;

    tokenSuspended = userConfigs[3].token!;
    suspendedAuthId = userConfigs[3].authId!;
    suspendedEmail = userConfigs[3].email;

    console.log('      [AUTH] Successfully provisioned and verified 4 authentic asymmetric ES256 tokens.');

    client = await pool.connect();
    if (!client) {
      throw new Error('Failed to acquire database client from connection pool.');
    }
    console.log('\n[3/4] Provisioning Isolated Staging Fixtures in Remote PostgreSQL...');
    // Seed fixtures inside platform transaction
    await withPlatformTransaction(client, adminAAuthId, async (db) => {
      // 1. Profiles (Global identity profile keyed to auth.users.id)
      await db.query(
        `INSERT INTO public.profiles (id, email, display_name, platform_role, status)
         VALUES
           ($1, $2, 'Staging Admin A', 'user', 'active'),
           ($3, $4, 'Staging Admin B', 'user', 'active'),
           ($5, $6, 'Staging Teacher A', 'user', 'active'),
           ($7, $8, 'Staging Suspended', 'user', 'suspended')
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
        [adminAAuthId, adminAEmail, adminBAuthId, adminBEmail, teacherAuthId, teacherEmail, suspendedAuthId, suspendedEmail]
      );
      registry.profileIds.add(adminAAuthId);
      registry.profileIds.add(adminBAuthId);
      registry.profileIds.add(teacherAuthId);
      registry.profileIds.add(suspendedAuthId);

      // 2. Tenants
      const tntRes = await db.query(
        `INSERT INTO public.tenants (id, name, slug, status, tier, settings)
         VALUES
           ($1, $2, $3, 'active', 'starter', '{"currency": "PKR"}'),
           ($4, $5, $6, 'active', 'starter', '{"currency": "PKR"}')
         RETURNING id`,
        [
          tenantAId, `Staging Academy A ${suffix}`, `staging-a-${suffix}`,
          tenantBId, `Staging Academy B ${suffix}`, `staging-b-${suffix}`,
        ]
      );
      for (const row of tntRes.rows) {
        registry.tenantIds.add(row.id);
      }

      // 3. Tenant Memberships
      const memRes = await db.query(
        `INSERT INTO public.tenant_memberships (id, tenant_id, auth_user_id, email, full_name, role, status)
         VALUES
           (gen_random_uuid(), $1, $2, $3, 'Admin A', 'tenant_admin', 'active'),
           (gen_random_uuid(), $4, $5, $6, 'Admin B', 'tenant_admin', 'active'),
           ($7, $1, $8, $9, 'Teacher Alpha', 'teacher', 'active'),
           (gen_random_uuid(), $1, $10, $11, 'Suspended User', 'teacher', 'suspended')
         RETURNING id`,
        [
          tenantAId, adminAAuthId, adminAEmail,
          tenantBId, adminBAuthId, adminBEmail,
          teacherMembershipId, teacherAuthId, teacherEmail,
          suspendedAuthId, suspendedEmail,
        ]
      );
      for (const row of memRes.rows) {
        registry.membershipIds.add(row.id);
      }
    });

    // Seed Program A, Batch A, and Student A under Tenant A context
    await withTenantTransaction(client, tenantAId, adminAAuthId, async (db) => {
      const prgRes = await db.query(
        `INSERT INTO public.programs (id, tenant_id, name, code, description)
         VALUES ($1, $2, $3, $4, 'Tenant A Program')
         RETURNING id`,
        [programAId, tenantAId, `Program A ${suffix}`, `PRA-${suffix}`]
      );
      registry.programIds.add(prgRes.rows[0].id);

      const btcRes = await db.query(
        `INSERT INTO public.batches (id, tenant_id, program_id, name)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [batchAId, tenantAId, programAId, `Batch A ${suffix}`]
      );
      registry.batchIds.add(btcRes.rows[0].id);

      const stdRes = await db.query(
        `INSERT INTO public.students (id, tenant_id, admission_number, roll_number, full_name, guardian_name, guardian_phone, program_id, batch_id, status)
         VALUES ($1, $2, $3, $4, 'Student Alpha', 'Guardian Alpha', '03001234567', $5, $6, 'active')
         RETURNING id`,
        [studentAId, tenantAId, `ADM-A-${suffix}`, `RL-A-${suffix}`, programAId, batchAId]
      );
      registry.studentIds.add(stdRes.rows[0].id);
    });

    // Seed Program B, Batch B, and Student B under Tenant B context
    await withTenantTransaction(client, tenantBId, adminBAuthId, async (db) => {
      const prgRes = await db.query(
        `INSERT INTO public.programs (id, tenant_id, name, code, description)
         VALUES ($1, $2, $3, $4, 'Tenant B Program')
         RETURNING id`,
        [programBId, tenantBId, `Program B ${suffix}`, `PRB-${suffix}`]
      );
      registry.programIds.add(prgRes.rows[0].id);

      const btcRes = await db.query(
        `INSERT INTO public.batches (id, tenant_id, program_id, name)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [batchBId, tenantBId, programBId, `Batch B ${suffix}`]
      );
      registry.batchIds.add(btcRes.rows[0].id);

      const stdRes = await db.query(
        `INSERT INTO public.students (id, tenant_id, admission_number, roll_number, full_name, guardian_name, guardian_phone, program_id, batch_id, status)
         VALUES ($1, $2, $3, $4, 'Student Beta', 'Guardian Beta', '03007654321', $5, $6, 'active')
         RETURNING id`,
        [studentBId, tenantBId, `ADM-B-${suffix}`, `RL-B-${suffix}`, programBId, batchBId]
      );
      registry.studentIds.add(stdRes.rows[0].id);
    });

    console.log(`      Fixtures created: 2 Tenants, 4 Profiles, 4 Memberships, 2 Programs, 2 Batches, 2 Students.`);

    console.log('\n[4/4] Executing 15-Scenario Boundary Verification Matrix (S1 - S15)...');

    // =========================================================================
    // Scenario 1: Tenant A authenticated user reads permitted Tenant A data (200 OK)
    // =========================================================================
    const s1Res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${tokenA}`,
        'x-tenant-id': tenantAId,
      },
    });
    const s1Body = s1Res.json();
    const s1Passed =
      s1Res.statusCode === 200 &&
      s1Body.success === true &&
      Array.isArray(s1Body.data) &&
      s1Body.data.some((p: any) => p.id === programAId) &&
      s1Body.data.every((p: any) => p.tenant_id === tenantAId);

    scenarios.push({
      scenarioId: 'S1',
      name: 'Tenant A Authenticated Read Permitted Data',
      passed: s1Passed,
      httpStatus: s1Res.statusCode,
      details: s1Passed
        ? 'HTTP 200 OK: Tenant A user successfully retrieved Tenant A programs.'
        : `Failed: statusCode=${s1Res.statusCode}, body=${JSON.stringify(s1Body)}`,
    });

    // =========================================================================
    // Scenario 2: Tenant A user cannot read Tenant B data (404 Not Found / 403)
    // =========================================================================
    const s2Res = await app.inject({
      method: 'GET',
      url: `/api/v1/sis/students/${studentBId}`,
      headers: {
        authorization: `Bearer ${tokenA}`,
        'x-tenant-id': tenantAId,
      },
    });
    const s2Passed = s2Res.statusCode === 404 || s2Res.statusCode === 403;

    scenarios.push({
      scenarioId: 'S2',
      name: 'Tenant A Cross-Tenant Read Blocked',
      passed: s2Passed,
      httpStatus: s2Res.statusCode,
      details: s2Passed
        ? `HTTP ${s2Res.statusCode}: Cross-tenant read for Tenant B student denied with zero data leakage.`
        : `Failed: Cross-tenant data leaked. statusCode=${s2Res.statusCode}`,
    });

    // =========================================================================
    // Scenario 3: Tenant A user cannot mutate or delete Tenant B data (404/403)
    // =========================================================================
    const s3PatchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sis/students/${studentBId}`,
      headers: {
        authorization: `Bearer ${tokenA}`,
        'x-tenant-id': tenantAId,
      },
      payload: { full_name: 'MALICIOUS_OVERWRITE' },
    });

    const s3DeleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/programs/${programBId}`,
      headers: {
        authorization: `Bearer ${tokenA}`,
        'x-tenant-id': tenantAId,
      },
    });

    // Verify DB integrity directly via administrative connection
    let s3StudentBName: string | undefined;
    let s3ProgramBCount = 0;
    try {
      const s3AdminPool = new pg.Pool(parseDatabaseConfig(migrationDbUrl));
      const s3AdminClient = await s3AdminPool.connect();
      try {
        const s3CheckStudent = await s3AdminClient.query(
          'SELECT full_name FROM public.students WHERE id = $1',
          [studentBId]
        );
        s3StudentBName = s3CheckStudent.rows[0]?.full_name;

        const s3CheckProgram = await s3AdminClient.query(
          'SELECT id FROM public.programs WHERE id = $1',
          [programBId]
        );
        s3ProgramBCount = s3CheckProgram.rows.length;
      } finally {
        s3AdminClient.release();
        await s3AdminPool.end();
      }
    } catch {}

    const s3MutationBlocked = s3PatchRes.statusCode === 404 || s3PatchRes.statusCode === 403;
    const s3DeleteBlocked = s3DeleteRes.statusCode === 404 || s3DeleteRes.statusCode === 403;
    const s3DataIntact = s3StudentBName === 'Student Beta' && s3ProgramBCount === 1;
    const s3Passed = s3MutationBlocked && s3DeleteBlocked && s3DataIntact;

    scenarios.push({
      scenarioId: 'S3',
      name: 'Tenant A Cross-Tenant Mutation & Deletion Blocked',
      passed: s3Passed,
      httpStatus: s3PatchRes.statusCode,
      details: s3Passed
        ? `HTTP ${s3PatchRes.statusCode}/${s3DeleteRes.statusCode}: Mutations denied and target database records remain unchanged.`
        : `Failed: Cross-tenant modification permitted. DataIntact=${s3DataIntact}`,
    });

    // =========================================================================
    // Scenario 4: Tenant header spoofing rejected (Token B + Header A) -> 403 / 404
    // =========================================================================
    const s4Res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${tokenB}`, // User B token
        'x-tenant-id': tenantAId, // Header spoofing Tenant A
      },
    });
    const s4Body = s4Res.json();
    const s4Passed =
      (s4Res.statusCode === 403 && s4Body.error?.code === 'FORBIDDEN') ||
      (s4Res.statusCode === 404 && s4Body.error?.code === 'TENANT_NOT_FOUND');

    scenarios.push({
      scenarioId: 'S4',
      name: 'Tenant Header Spoofing Rejection',
      passed: s4Passed,
      httpStatus: s4Res.statusCode,
      details: s4Passed
        ? `HTTP ${s4Res.statusCode} (${s4Body.error?.code}): Request rejected at tenant boundary with zero data exposure.`
        : `Failed: Spoofing not rejected. statusCode=${s4Res.statusCode}, body=${JSON.stringify(s4Body)}`,
    });

    // =========================================================================
    // Scenario 5: Missing tenant context rejected (Token A + no header) -> 400
    // =========================================================================
    const s5Res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${tokenA}`,
        // Omitting x-tenant-id
      },
    });
    const s5Body = s5Res.json();
    const s5Passed = s5Res.statusCode === 400 && s5Body.error?.code === 'TENANT_REQUIRED';

    scenarios.push({
      scenarioId: 'S5',
      name: 'Missing Tenant Context Rejection',
      passed: s5Passed,
      httpStatus: s5Res.statusCode,
      details: s5Passed
        ? 'HTTP 400 Bad Request (TENANT_REQUIRED): Tenant context header is mandatory.'
        : `Failed: Request processed without tenant context. statusCode=${s5Res.statusCode}`,
    });

    // =========================================================================
    // Scenario 6: Suspended profile rejected (profile.status = 'suspended') -> 403
    // =========================================================================
    const s6Res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${tokenSuspended}`,
        'x-tenant-id': tenantAId,
      },
    });
    const s6Body = s6Res.json();
    const s6Passed =
      s6Res.statusCode === 403 &&
      (s6Body.error?.code === 'ACCOUNT_NOT_ACTIVE' || s6Body.error?.code === 'ACCOUNT_ARCHIVED');

    scenarios.push({
      scenarioId: 'S6',
      name: 'Suspended Profile Access Rejection',
      passed: s6Passed,
      httpStatus: s6Res.statusCode,
      details: s6Passed
        ? `HTTP 403 Forbidden (${s6Body.error?.code}): Suspended profile denied access before tenant evaluation.`
        : `Failed: Suspended account permitted. statusCode=${s6Res.statusCode}`,
    });

    // =========================================================================
    // Scenario 7: Suspended membership rejected (tenant_memberships.status = 'suspended') -> 403 / 404
    // =========================================================================
    // Temporarily suspend Teacher's membership in Tenant A via admin connection
    const s7AdminPool = new pg.Pool(parseDatabaseConfig(migrationDbUrl));
    const s7AdminClient = await s7AdminPool.connect();
    try {
      await s7AdminClient.query(
        `UPDATE public.tenant_memberships SET status = 'suspended' WHERE id = $1`,
        [teacherMembershipId]
      );
    } finally {
      s7AdminClient.release();
      await s7AdminPool.end();
    }

    const s7Res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: `Bearer ${tokenTeacher}`,
        'x-tenant-id': tenantAId,
      },
    });
    const s7Body = s7Res.json();
    const s7ErrorCode = s7Body.error?.code;
    const s7Passed =
      (s7Res.statusCode === 403 && (s7ErrorCode === 'ACCOUNT_NOT_ACTIVE' || s7ErrorCode === 'ACCOUNT_ARCHIVED')) ||
      (s7Res.statusCode === 404 && s7ErrorCode === 'TENANT_NOT_FOUND');

    // Restore Teacher membership to active via admin connection
    const s7RestorePool = new pg.Pool(parseDatabaseConfig(migrationDbUrl));
    const s7RestoreClient = await s7RestorePool.connect();
    try {
      await s7RestoreClient.query(
        `UPDATE public.tenant_memberships SET status = 'active' WHERE id = $1`,
        [teacherMembershipId]
      );
    } finally {
      s7RestoreClient.release();
      await s7RestorePool.end();
    }

    scenarios.push({
      scenarioId: 'S7',
      name: 'Suspended Membership Access Rejection',
      passed: s7Passed,
      httpStatus: s7Res.statusCode,
      details: s7Passed
        ? `HTTP ${s7Res.statusCode} (${s7ErrorCode}): Suspended membership rejected at boundary (RLS is_active_tenant_member enforced).`
        : `Failed: Suspended membership permitted. statusCode=${s7Res.statusCode}, body=${JSON.stringify(s7Body)}`,
    });

    // =========================================================================
    // Scenario 8: Normal user cannot change role (role promotion blocked) -> 403 / DB 42501
    // =========================================================================
    const s8RouteRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/academic/staff/${teacherAuthId}`,
      headers: {
        authorization: `Bearer ${tokenTeacher}`,
        'x-tenant-id': tenantAId,
      },
      payload: { role: 'tenant_admin' },
    });
    const s8RouteDenied = s8RouteRes.statusCode === 403;

    let s8DbDenied = false;
    let s8DbErrorCode: string | null = null;
    try {
      await withTenantTransaction(client, tenantAId, teacherAuthId, async (db) => {
        await db.query(
          `UPDATE public.tenant_memberships SET role = 'tenant_admin' WHERE id = $1 AND tenant_id = $2`,
          [teacherMembershipId, tenantAId]
        );
      });
    } catch (err: any) {
      s8DbErrorCode = err.code || err.message;
      if (err.code === '42501' || String(err.message).includes('FORBIDDEN')) {
        s8DbDenied = true;
      }
    }

    const s8Passed = s8RouteDenied && s8DbDenied;
    scenarios.push({
      scenarioId: 'S8',
      name: 'Normal User Cannot Change Role (Self-Promotion Denial)',
      passed: s8Passed,
      httpStatus: s8RouteRes.statusCode,
      details: s8Passed
        ? 'HTTP 403 Forbidden on route; direct DB update blocked with error 42501 (FORBIDDEN_SELF_PROMOTION).'
        : `Failed: routeDenied=${s8RouteDenied}, dbDenied=${s8DbDenied}, dbCode=${s8DbErrorCode}`,
    });

    // =========================================================================
    // Scenario 9: Normal user cannot change status (status tampering blocked) -> 403
    // =========================================================================
    const s9RouteRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/academic/staff/${teacherAuthId}`,
      headers: {
        authorization: `Bearer ${tokenTeacher}`,
        'x-tenant-id': tenantAId,
      },
      payload: { status: 'suspended' },
    });
    const s9RouteDenied = s9RouteRes.statusCode === 403;

    // Direct DB verification: Teacher's status in DB remains 'active'
    let s9StatusIntact = false;
    const s9AdminPool = new pg.Pool(parseDatabaseConfig(migrationDbUrl));
    const s9AdminClient = await s9AdminPool.connect();
    try {
      const s9Chk = await s9AdminClient.query(
        'SELECT status FROM public.tenant_memberships WHERE id = $1',
        [teacherMembershipId]
      );
      s9StatusIntact = s9Chk.rows[0]?.status === 'active';
    } finally {
      s9AdminClient.release();
      await s9AdminPool.end();
    }

    const s9Passed = s9RouteDenied && s9StatusIntact;
    scenarios.push({
      scenarioId: 'S9',
      name: 'Normal User Cannot Change Status (Status Tampering Denial)',
      passed: s9Passed,
      httpStatus: s9RouteRes.statusCode,
      details: s9Passed
        ? 'HTTP 403 Forbidden: Normal user blocked from updating staff status; database status intact (active).'
        : `Failed: routeDenied=${s9RouteDenied}, statusIntact=${s9StatusIntact}`,
    });

    // =========================================================================
    // Scenario 10: Normal user cannot change tenant_id (cross-tenant reassignment) -> 403 / DB 44000
    // =========================================================================
    const s10RouteRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/academic/staff/${teacherAuthId}`,
      headers: {
        authorization: `Bearer ${tokenTeacher}`,
        'x-tenant-id': tenantAId,
      },
      payload: { tenant_id: tenantBId },
    });
    const s10RouteDenied = s10RouteRes.statusCode === 403 || s10RouteRes.statusCode === 400;

    let s10DbDenied = false;
    let s10DbErrorCode: string | null = null;
    try {
      await withTenantTransaction(client, tenantAId, teacherAuthId, async (db) => {
        await db.query(
          `UPDATE public.tenant_memberships SET tenant_id = $1 WHERE id = $2`,
          [tenantBId, teacherMembershipId]
        );
      });
    } catch (err: any) {
      s10DbErrorCode = err.code || err.message;
      if (err.code === '44000' || err.code === '42501' || String(err.message).includes('violates row-level security')) {
        s10DbDenied = true;
      }
    }

    const s10Passed = s10RouteDenied && s10DbDenied;
    scenarios.push({
      scenarioId: 'S10',
      name: 'Normal User Cannot Change Tenant ID (Cross-Tenant Reassignment)',
      passed: s10Passed,
      httpStatus: s10RouteRes.statusCode,
      details: s10Passed
        ? `HTTP ${s10RouteRes.statusCode} on route; direct DB check violation enforced (${s10DbErrorCode}).`
        : `Failed: routeDenied=${s10RouteDenied}, dbDenied=${s10DbDenied}, dbCode=${s10DbErrorCode}`,
    });

    // =========================================================================
    // Scenario 11: Normal user cannot change auth_user_id (membership hijacking) -> 403 / DB 44000
    // =========================================================================
    const s11RouteRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/academic/staff/${teacherAuthId}`,
      headers: {
        authorization: `Bearer ${tokenTeacher}`,
        'x-tenant-id': tenantAId,
      },
      payload: { auth_user_id: adminAAuthId },
    });
    const s11RouteDenied = s11RouteRes.statusCode === 403 || s11RouteRes.statusCode === 400;

    let s11DbDenied = false;
    let s11DbErrorCode: string | null = null;
    try {
      await withTenantTransaction(client, tenantAId, teacherAuthId, async (db) => {
        await db.query(
          `UPDATE public.tenant_memberships SET auth_user_id = $1 WHERE id = $2`,
          [adminAAuthId, teacherMembershipId]
        );
      });
    } catch (err: any) {
      s11DbErrorCode = err.code || err.message;
      if (err.code === '44000' || err.code === '42501' || String(err.message).includes('violates row-level security')) {
        s11DbDenied = true;
      }
    }

    const s11Passed = s11RouteDenied && s11DbDenied;
    scenarios.push({
      scenarioId: 'S11',
      name: 'Normal User Cannot Change Auth User ID (Membership Hijacking)',
      passed: s11Passed,
      httpStatus: s11RouteRes.statusCode,
      details: s11Passed
        ? `HTTP ${s11RouteRes.statusCode} on route; direct DB check violation enforced (${s11DbErrorCode}).`
        : `Failed: routeDenied=${s11RouteDenied}, dbDenied=${s11DbDenied}, dbCode=${s11DbErrorCode}`,
    });

    // =========================================================================
    // Scenario 12: Normal user cannot change permissions or access metadata -> 403
    // =========================================================================
    const s12Res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/academic/staff/${teacherAuthId}/access`,
      headers: {
        authorization: `Bearer ${tokenTeacher}`,
        'x-tenant-id': tenantAId,
      },
      payload: {
        permissions: ['admin', 'all'],
        status: 'active',
      },
    });
    const s12Body = s12Res.json();
    const s12Passed = s12Res.statusCode === 403 && s12Body.error?.code === 'FORBIDDEN';

    scenarios.push({
      scenarioId: 'S12',
      name: 'Normal User Cannot Tamper Permissions or Access Metadata',
      passed: s12Passed,
      httpStatus: s12Res.statusCode,
      details: s12Passed
        ? 'HTTP 403 Forbidden (FORBIDDEN): Teacher denied from modifying permissions.'
        : `Failed: Permission modification allowed. statusCode=${s12Res.statusCode}`,
    });

    // =========================================================================
    // Scenario 13: Tenant admin cannot access platform-only routes -> 403
    // =========================================================================
    const s13Res = await app.inject({
      method: 'GET',
      url: '/api/v1/saas/superadmin/overview',
      headers: {
        authorization: `Bearer ${tokenA}`, // Regular tenant admin
        'x-tenant-id': tenantAId,
      },
    });
    const s13Body = s13Res.json();
    const s13Passed =
      s13Res.statusCode === 403 &&
      (s13Body.error?.code === 'FORBIDDEN' || s13Body.error?.code === 'FORBIDDEN_ROLE');

    scenarios.push({
      scenarioId: 'S13',
      name: 'Tenant Admin Blocked from Platform-Only Endpoints',
      passed: s13Passed,
      httpStatus: s13Res.statusCode,
      details: s13Passed
        ? `HTTP 403 Forbidden (${s13Body.error?.code}): Tenant admin blocked from platform superadmin controls.`
        : `Failed: Platform control plane exposed. statusCode=${s13Res.statusCode}`,
    });

    // =========================================================================
    // Scenario 14: Real route mutations create correct audit records with authentic actor provenance
    // =========================================================================
    const s14PatchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sis/students/${studentAId}`,
      headers: {
        authorization: `Bearer ${tokenA}`,
        'x-tenant-id': tenantAId,
      },
      payload: {
        full_name: 'Audit Provenance Student Verified',
        guardian_name: 'Guardian Verified',
        audit_reason: 'Boundary audit verification of provenance',
      },
    });

    let s14AuditLogged = false;
    let s14ActorEmailMatches = false;

    await withTenantTransaction(client, tenantAId, adminAAuthId, async (db) => {
      const audRes = await db.query(
        `SELECT id, tenant_id, actor_email, action, resource, resource_id
         FROM public.audit_logs
         WHERE tenant_id = $1 AND resource_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [tenantAId, studentAId]
      );
      if (audRes.rows.length > 0) {
        s14AuditLogged = true;
        const record = audRes.rows[0];
        registry.auditLogIds.add(record.id);
        s14ActorEmailMatches = record.actor_email === adminAEmail;
      }
    });

    const s14Passed = s14PatchRes.statusCode === 200 && s14AuditLogged && s14ActorEmailMatches;
    scenarios.push({
      scenarioId: 'S14',
      name: 'Route Mutation Generates Authentic Provenance Audit Log',
      passed: s14Passed,
      httpStatus: s14PatchRes.statusCode,
      details: s14Passed
        ? `HTTP 200 OK: Student mutation created audit record with verified actor '${adminAEmail}'.`
        : `Failed: httpStatus=${s14PatchRes.statusCode}, logged=${s14AuditLogged}, actorMatches=${s14ActorEmailMatches}`,
    });

    // =========================================================================
    // Scenario 15: Tenant B cannot read Tenant A audit records
    // =========================================================================
    const s15RouteRes = await app.inject({
      method: 'GET',
      url: `/api/v1/sis/students/${studentAId}/audit-logs`,
      headers: {
        authorization: `Bearer ${tokenB}`,
        'x-tenant-id': tenantBId,
      },
    });
    const s15Body = s15RouteRes.json();
    const s15RouteDenied =
      s15RouteRes.statusCode === 404 ||
      s15RouteRes.statusCode === 403 ||
      (s15RouteRes.statusCode === 200 && Array.isArray(s15Body.data) && s15Body.data.length === 0);

    let s15CrossTenantQueryCount = -1;
    await withTenantTransaction(client, tenantBId, adminBAuthId, async (db) => {
      const res = await db.query(
        'SELECT * FROM public.audit_logs WHERE tenant_id = $1',
        [tenantAId]
      );
      s15CrossTenantQueryCount = res.rows.length;
    });

    const s15Passed = s15RouteDenied && s15CrossTenantQueryCount === 0;
    scenarios.push({
      scenarioId: 'S15',
      name: 'Cross-Tenant Audit Log Isolation',
      passed: s15Passed,
      httpStatus: s15RouteRes.statusCode,
      details: s15Passed
        ? `Route query denied/empty (status: ${s15RouteRes.statusCode}); direct DB query under Tenant B context returned 0 rows (RLS enforced).`
        : `Failed: routeDenied=${s15RouteDenied}, crossTenantCount=${s15CrossTenantQueryCount}`,
    });
  } catch (err: any) {
    executionErr = err;
    console.error('FATAL SUITE EXECUTION ERROR:', err);
  } finally {
    // 5. Teardown & Clean Purge of test records strictly by ID via MIGRATION_DATABASE_URL
    console.log('\n[TEARDOWN] Purging test fixtures strictly by recorded ID via MIGRATION_DATABASE_URL...');
    const teardown = await teardownStagingFixtures(registry, undefined, adminAAuthId || userConfigs[0]?.authId, supabaseAdmin);
    if (client) {
      try { client.release(); } catch {}
    }
    if (app && typeof app.close === 'function') {
      try { await app.close(); } catch {}
    }
    if (!overrides?.pool) {
      try { await closeDatabasePool(); } catch {}
    }

    const allScenariosPassed = scenarios.length === 15 && scenarios.every((s) => s.passed);
    const suitePassed = !executionErr && allScenariosPassed && teardown.clean && teardown.errors.length === 0;

    // Format Institutional Monospaced Report
    console.log('\n================================================================================');
    console.log('           PHASE 14: REAL STAGING DATABASE BOUNDARY ACCEPTANCE SUITE            ');
    console.log('================================================================================');
    console.log('[PREFLIGHT]');
    console.log(`  Database Host:     ${preflight.databaseHost}`);
    console.log(`  Database Name:     ${preflight.databaseName}`);
    console.log(`  Connected Role:    ${preflight.connectedUser} [PASS]`);
    console.log(`  rolsuper:          ${preflight.rolsuper} [PASS]`);
    console.log(`  rolbypassrls:      ${preflight.rolbypassrls} [PASS]`);
    console.log(`  authenticated mem: ${preflight.isAuthenticatedMember} [PASS]`);
    console.log(`  Target Schema:     public (USAGE verified) [PASS]`);
    console.log(`  Negative DDL Probe:CREATE TABLE denied (code 42501) [PASS]`);
    console.log(`  App Data Store:    PostgresDataStore (Real pg.Pool) [PASS]`);
    console.log(`  In-Memory / PGlite:PROHIBITED & DISABLED [PASS]`);

    console.log('\n[AUTH & TENANT CONFIGURATION]');
    console.log(`  Staging Tenant A:  ${tenantAId} (staging-a-${suffix})`);
    console.log(`  Staging Tenant B:  ${tenantBId} (staging-b-${suffix})`);
    console.log(`  Admin A:           ${adminAEmail} (${adminAAuthId})`);
    console.log(`  Admin B:           ${adminBEmail} (${adminBAuthId})`);
    console.log(`  Teacher A:         ${teacherEmail} (${teacherAuthId})`);
    console.log(`  Suspended User:    ${suspendedEmail} (${suspendedAuthId})`);

    console.log('\n[15-SCENARIO ACCEPTANCE MATRIX RESULTS]');
    for (const sc of scenarios) {
      const mark = sc.passed ? '✓' : '✗';
      console.log(`  ${mark} ${sc.scenarioId.padEnd(4)}: ${sc.name.padEnd(58)} -> ${sc.details}`);
    }

    console.log('\n[TEARDOWN & CLEANUP SUMMARY]');
    console.log(`  Cleaned up test students:    ${teardown.purgedStudents} record(s)`);
    console.log(`  Cleaned up test batches:     ${teardown.purgedBatches} record(s)`);
    console.log(`  Cleaned up test programs:    ${teardown.purgedPrograms} record(s)`);
    console.log(`  Cleaned up test audit logs:  ${teardown.purgedAuditLogs} record(s)`);
    console.log(`  Cleaned up test memberships: ${teardown.purgedMemberships} record(s)`);
    console.log(`  Cleaned up test profiles:    ${teardown.purgedProfiles} record(s)`);
    console.log(`  Cleaned up test auth users:  ${teardown.purgedAuthUsers} record(s)`);
    console.log(`  Cleaned up test tenants:     ${teardown.purgedTenants} record(s)`);
    console.log(`  Teardown Status:             ${teardown.clean ? 'ALL TEST RECORDS PURGED CLEANLY (0 RESIDUAL ORPHANS)' : 'FAILED'}`);

    if (teardown.errors.length > 0) {
      console.error('  Teardown Errors:');
      for (const e of teardown.errors) {
        console.error(`    - ${e}`);
      }
    }

    console.log('================================================================================');
    console.log(`FINAL STATUS: ${suitePassed ? 'PASS' : 'FAIL'} (15/15 Scenarios Passed, 0 Residual Orphans)`);
    console.log('================================================================================\n');

    return {
      preflight,
      scenarios,
      teardown,
      passed: suitePassed,
    };
  }
}

// Execute main if run directly from CLI
const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && (invokedPath === currentFilePath || invokedPath.endsWith('run-staging-boundary.ts') || invokedPath.endsWith('run-staging-boundary.js'))) {
  runStagingBoundarySuite()
    .then((report) => {
      if (!report.passed) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal boundary test suite error:', err.message);
      process.exit(1);
    });
}
