import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  teardownStagingFixtures,
  createEmptyRegistry,
  type StagingFixtureRegistry,
  type TeardownReport,
} from '../src/scripts/run-staging-boundary.js';

describe('Challenger 2 Empirical Verification: R2 & R4 Teardown Resilience & Trigger Safety', () => {
  let originalMigrationUrl: string | undefined;

  beforeEach(() => {
    originalMigrationUrl = process.env.MIGRATION_DATABASE_URL;
  });

  afterEach(() => {
    if (originalMigrationUrl !== undefined) {
      process.env.MIGRATION_DATABASE_URL = originalMigrationUrl;
    } else {
      delete process.env.MIGRATION_DATABASE_URL;
    }
  });

  // ===========================================================================
  // 1. Probe Early User Creation, Sign-in, and JWKS Failure Injection
  // ===========================================================================
  describe('1. Probe Early User Creation, Sign-in, and JWKS Failure Injection (R2)', () => {
    it('Scenario 1.1: User 1 succeeds, User 2 creation throws network rate limit -> User 1 is purged', async () => {
      const registry = createEmptyRegistry();
      const deletedUserIds: string[] = [];

      const mockSupabaseAdmin: any = {
        auth: {
          admin: {
            deleteUser: vi.fn().mockImplementation(async (id: string) => {
              deletedUserIds.push(id);
              return { error: null };
            }),
          },
        },
      };

      let failed = false;
      let report: TeardownReport | null = null;

      try {
        // Step 1: User 1 created
        const u1Id = 'u1-uuid-1111';
        registry.authUserIds.add(u1Id);

        // Step 2: User 2 fails
        throw new Error('Supabase GoTrue rate limit 429 on user 2 creation');
      } catch (err) {
        failed = true;
      } finally {
        report = await teardownStagingFixtures(registry, undefined, undefined, mockSupabaseAdmin);
      }

      expect(failed).toBe(true);
      expect(deletedUserIds).toEqual(['u1-uuid-1111']);
      expect(report?.purgedAuthUsers).toBe(1);
      expect(report?.orphanIds.authUsers).toEqual([]);
      expect(report?.clean).toBe(true); // Auth user cleanly purged, no DB entities created
    });

    it('Scenario 1.2: Users 1 and 2 succeed, User 3 creation throws -> Users 1 and 2 are purged', async () => {
      const registry = createEmptyRegistry();
      const deletedUserIds: string[] = [];

      const mockSupabaseAdmin: any = {
        auth: {
          admin: {
            deleteUser: vi.fn().mockImplementation(async (id: string) => {
              deletedUserIds.push(id);
              return { error: null };
            }),
          },
        },
      };

      let failed = false;
      let report: TeardownReport | null = null;

      try {
        registry.authUserIds.add('user-1-id');
        registry.authUserIds.add('user-2-id');
        throw new Error('Failed to create GoTrue auth user staging-teacher-a: connection timeout');
      } catch (err) {
        failed = true;
      } finally {
        report = await teardownStagingFixtures(registry, undefined, undefined, mockSupabaseAdmin);
      }

      expect(failed).toBe(true);
      expect(deletedUserIds).toEqual(['user-1-id', 'user-2-id']);
      expect(report?.purgedAuthUsers).toBe(2);
      expect(report?.orphanIds.authUsers).toEqual([]);
    });

    it('Scenario 1.3: User 1 created, but signInWithPassword fails -> User 1 is purged', async () => {
      const registry = createEmptyRegistry();
      const deletedUserIds: string[] = [];

      const mockSupabaseAdmin: any = {
        auth: {
          admin: {
            deleteUser: vi.fn().mockImplementation(async (id: string) => {
              deletedUserIds.push(id);
              return { error: null };
            }),
          },
        },
      };

      let failed = false;
      let report: TeardownReport | null = null;

      try {
        registry.authUserIds.add('user-1-signin-fail');
        throw new Error('Failed to sign in GoTrue auth user: invalid grant / credentials');
      } catch (err) {
        failed = true;
      } finally {
        report = await teardownStagingFixtures(registry, undefined, undefined, mockSupabaseAdmin);
      }

      expect(failed).toBe(true);
      expect(deletedUserIds).toEqual(['user-1-signin-fail']);
      expect(report?.purgedAuthUsers).toBe(1);
    });

    it('Scenario 1.4: Users 1 and 2 signed in, User 3 signInWithPassword fails -> All 3 users are purged', async () => {
      const registry = createEmptyRegistry();
      const deletedUserIds: string[] = [];

      const mockSupabaseAdmin: any = {
        auth: {
          admin: {
            deleteUser: vi.fn().mockImplementation(async (id: string) => {
              deletedUserIds.push(id);
              return { error: null };
            }),
          },
        },
      };

      let failed = false;
      let report: TeardownReport | null = null;

      try {
        registry.authUserIds.add('user-admin-a');
        registry.authUserIds.add('user-admin-b');
        registry.authUserIds.add('user-teacher-a');
        throw new Error('Failed to sign in GoTrue auth user staging-teacher-a: 503 Backend unavailable');
      } catch (err) {
        failed = true;
      } finally {
        report = await teardownStagingFixtures(registry, undefined, undefined, mockSupabaseAdmin);
      }

      expect(failed).toBe(true);
      expect(deletedUserIds).toEqual(['user-admin-a', 'user-admin-b', 'user-teacher-a']);
      expect(report?.purgedAuthUsers).toBe(3);
    });

    it('Scenario 1.5: User 1 signed in, JWKS verification signature mismatch throws -> User 1 is purged', async () => {
      const registry = createEmptyRegistry();
      const deletedUserIds: string[] = [];

      const mockSupabaseAdmin: any = {
        auth: {
          admin: {
            deleteUser: vi.fn().mockImplementation(async (id: string) => {
              deletedUserIds.push(id);
              return { error: null };
            }),
          },
        },
      };

      let failed = false;
      let report: TeardownReport | null = null;

      try {
        registry.authUserIds.add('user-jwks-fail');
        throw new Error('JWKS verification signature mismatch: JWSSignatureVerificationFailed');
      } catch (err) {
        failed = true;
      } finally {
        report = await teardownStagingFixtures(registry, undefined, undefined, mockSupabaseAdmin);
      }

      expect(failed).toBe(true);
      expect(deletedUserIds).toEqual(['user-jwks-fail']);
      expect(report?.purgedAuthUsers).toBe(1);
    });

    it('Scenario 1.6: JWKS subject claim mismatch on User 2 -> Users 1 and 2 are purged', async () => {
      const registry = createEmptyRegistry();
      const deletedUserIds: string[] = [];

      const mockSupabaseAdmin: any = {
        auth: {
          admin: {
            deleteUser: vi.fn().mockImplementation(async (id: string) => {
              deletedUserIds.push(id);
              return { error: null };
            }),
          },
        },
      };

      let failed = false;
      let report: TeardownReport | null = null;

      try {
        registry.authUserIds.add('user-1-ok');
        registry.authUserIds.add('user-2-mismatch');
        throw new Error('JWKS verification subject mismatch for staging-admin-b. Expected user-2-mismatch, got fake-sub');
      } catch (err) {
        failed = true;
      } finally {
        report = await teardownStagingFixtures(registry, undefined, undefined, mockSupabaseAdmin);
      }

      expect(failed).toBe(true);
      expect(deletedUserIds).toEqual(['user-1-ok', 'user-2-mismatch']);
      expect(report?.purgedAuthUsers).toBe(2);
    });

    it('Scenario 1.7: Partial deleteUser failure (User 2 fails with 500, Users 1 & 3 succeed) -> isolates error & tracks orphan', async () => {
      const registry = createEmptyRegistry();
      registry.authUserIds.add('user-1');
      registry.authUserIds.add('user-2-fail');
      registry.authUserIds.add('user-3');

      const mockSupabaseAdmin: any = {
        auth: {
          admin: {
            deleteUser: vi.fn().mockImplementation(async (id: string) => {
              if (id === 'user-2-fail') {
                return { error: { status: 500, message: 'Internal Server Error deleting user' } };
              }
              return { error: null };
            }),
          },
        },
      };

      const report = await teardownStagingFixtures(registry, undefined, undefined, mockSupabaseAdmin);

      expect(mockSupabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledTimes(3);
      expect(report.purgedAuthUsers).toBe(2);
      expect(report.orphanIds.authUsers).toEqual(['user-2-fail']);
      expect(report.clean).toBe(false);
      expect(report.errors).toContain('Failed to delete GoTrue auth user user-2-fail: Internal Server Error deleting user');
    });

    it('Scenario 1.8: deleteUser throws unexpected exception -> caught and isolates to orphanIds.authUsers without halting', async () => {
      const registry = createEmptyRegistry();
      registry.authUserIds.add('user-throw');
      registry.authUserIds.add('user-ok');

      const mockSupabaseAdmin: any = {
        auth: {
          admin: {
            deleteUser: vi.fn().mockImplementation(async (id: string) => {
              if (id === 'user-throw') {
                throw new Error('Network socket disconnected during HTTP DELETE');
              }
              return { error: null };
            }),
          },
        },
      };

      const report = await teardownStagingFixtures(registry, undefined, undefined, mockSupabaseAdmin);

      expect(report.purgedAuthUsers).toBe(1);
      expect(report.orphanIds.authUsers).toEqual(['user-throw']);
      expect(report.clean).toBe(false);
      expect(report.errors).toContain('Exception deleting GoTrue auth user user-throw: Network socket disconnected during HTTP DELETE');
    });

    it('Scenario 1.9: deleteUser returns 404 or "User not found" -> handled idempotently without error', async () => {
      const registry = createEmptyRegistry();
      registry.authUserIds.add('user-already-deleted-1');
      registry.authUserIds.add('user-already-deleted-2');

      const mockSupabaseAdmin: any = {
        auth: {
          admin: {
            deleteUser: vi.fn()
              .mockResolvedValueOnce({ error: { status: 404, message: 'User not found' } })
              .mockResolvedValueOnce({ error: { status: 400, message: 'Error: User not found in auth.users' } }),
          },
        },
      };

      const report = await teardownStagingFixtures(registry, undefined, undefined, mockSupabaseAdmin);

      expect(report.purgedAuthUsers).toBe(2);
      expect(report.orphanIds.authUsers).toEqual([]);
    });
  });

  // ===========================================================================
  // 2. Probe Independent Table Deletion Resilience (Cascade Failure Isolation)
  // ===========================================================================
  describe('2. Probe Independent Table Deletion Resilience (R4)', () => {
    it('Scenario 2.1: Failure deleting students does NOT halt batches, programs, audit logs, memberships, profiles, tenants', async () => {
      const registry = createEmptyRegistry();
      registry.studentIds.add('s-1');
      registry.batchIds.add('b-1');
      registry.programIds.add('p-1');
      registry.auditLogIds.add('al-1');
      registry.membershipIds.add('m-1');
      registry.profileIds.add('pr-1');
      registry.tenantIds.add('t-1');

      const executedDeletes: string[] = [];

      const mockClient: any = {
        query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
          if (sql.includes('DELETE FROM public.students')) {
            executedDeletes.push('students');
            throw new Error('ForeignKeyViolation: Table students locked or referenced');
          }
          if (sql.includes('DELETE FROM public.batches')) {
            executedDeletes.push('batches');
            return { rowCount: 1 };
          }
          if (sql.includes('DELETE FROM public.programs')) {
            executedDeletes.push('programs');
            return { rowCount: 1 };
          }
          if (sql.includes('purge_staging_audit_logs')) {
            executedDeletes.push('audit_logs');
            return { rows: [{ purged: 1 }] };
          }
          if (sql.includes('DELETE FROM public.tenant_memberships')) {
            executedDeletes.push('tenant_memberships');
            return { rowCount: 1 };
          }
          if (sql.includes('DELETE FROM public.profiles')) {
            executedDeletes.push('profiles');
            return { rowCount: 1 };
          }
          if (sql.includes('DELETE FROM public.tenants')) {
            executedDeletes.push('tenants');
            return { rowCount: 1 };
          }

          // Orphan checks
          if (sql.includes('SELECT id FROM public.students')) {
            return { rows: [{ id: 's-1' }] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      };

      const mockSupabaseAdmin: any = {
        auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } },
      };

      const report = await teardownStagingFixtures(mockClient, registry, undefined, mockSupabaseAdmin);

      expect(executedDeletes).toEqual([
        'students',
        'batches',
        'programs',
        'audit_logs',
        'tenant_memberships',
        'profiles',
        'tenants',
      ]);
      expect(report.purgedStudents).toBe(0);
      expect(report.purgedBatches).toBe(1);
      expect(report.purgedPrograms).toBe(1);
      expect(report.purgedAuditLogs).toBe(1);
      expect(report.purgedMemberships).toBe(1);
      expect(report.purgedProfiles).toBe(1);
      expect(report.purgedTenants).toBe(1);
      expect(report.clean).toBe(false);
      expect(report.orphanIds.students).toEqual(['s-1']);
      expect(report.orphanIds.batches).toEqual([]);
      expect(report.orphanIds.programs).toEqual([]);
      expect(report.orphanIds.auditLogs).toEqual([]);
      expect(report.orphanIds.memberships).toEqual([]);
      expect(report.orphanIds.profiles).toEqual([]);
      expect(report.orphanIds.tenants).toEqual([]);
    });

    it('Scenario 2.2: Failure deleting batches does NOT halt remaining tables', async () => {
      const registry = createEmptyRegistry();
      registry.studentIds.add('s-1');
      registry.batchIds.add('b-1');
      registry.programIds.add('p-1');
      registry.auditLogIds.add('al-1');
      registry.membershipIds.add('m-1');
      registry.profileIds.add('pr-1');
      registry.tenantIds.add('t-1');

      const mockClient: any = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('DELETE FROM public.students')) return { rowCount: 1 };
          if (sql.includes('DELETE FROM public.batches')) throw new Error('Simulated batch deletion failure');
          if (sql.includes('DELETE FROM public.programs')) return { rowCount: 1 };
          if (sql.includes('purge_staging_audit_logs')) return { rows: [{ purged: 1 }] };
          if (sql.includes('DELETE FROM public.tenant_memberships')) return { rowCount: 1 };
          if (sql.includes('DELETE FROM public.profiles')) return { rowCount: 1 };
          if (sql.includes('DELETE FROM public.tenants')) return { rowCount: 1 };

          if (sql.includes('SELECT id FROM public.batches')) return { rows: [{ id: 'b-1' }] };
          return { rows: [] };
        }),
        release: vi.fn(),
      };

      const mockSupabaseAdmin: any = { auth: { admin: { deleteUser: vi.fn() } } };
      const report = await teardownStagingFixtures(mockClient, registry, undefined, mockSupabaseAdmin);

      expect(report.purgedStudents).toBe(1);
      expect(report.purgedBatches).toBe(0);
      expect(report.purgedPrograms).toBe(1);
      expect(report.purgedAuditLogs).toBe(1);
      expect(report.purgedMemberships).toBe(1);
      expect(report.purgedProfiles).toBe(1);
      expect(report.purgedTenants).toBe(1);
      expect(report.orphanIds.batches).toEqual(['b-1']);
      expect(report.orphanIds.students).toEqual([]);
    });

    it('Scenario 2.3: Failure deleting audit logs (both function & fallback fail) does NOT halt memberships, profiles, tenants', async () => {
      const registry = createEmptyRegistry();
      registry.auditLogIds.add('al-1');
      registry.membershipIds.add('m-1');
      registry.profileIds.add('pr-1');
      registry.tenantIds.add('t-1');

      const mockClient: any = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('purge_staging_audit_logs')) throw new Error('Function unavailable');
          if (sql.includes('DELETE FROM public.audit_logs')) throw new Error('Trigger violation fallback');
          if (sql.includes('DELETE FROM public.tenant_memberships')) return { rowCount: 1 };
          if (sql.includes('DELETE FROM public.profiles')) return { rowCount: 1 };
          if (sql.includes('DELETE FROM public.tenants')) return { rowCount: 1 };

          if (sql.includes('SELECT id FROM public.audit_logs')) return { rows: [{ id: 'al-1' }] };
          return { rows: [] };
        }),
        release: vi.fn(),
      };

      const mockSupabaseAdmin: any = { auth: { admin: { deleteUser: vi.fn() } } };
      const report = await teardownStagingFixtures(mockClient, registry, undefined, mockSupabaseAdmin);

      expect(report.purgedAuditLogs).toBe(0);
      expect(report.purgedMemberships).toBe(1);
      expect(report.purgedProfiles).toBe(1);
      expect(report.purgedTenants).toBe(1);
      expect(report.orphanIds.auditLogs).toEqual(['al-1']);
      expect(report.orphanIds.memberships).toEqual([]);
    });

    it('Scenario 2.4: All database table deletions fail -> runner handles gracefully, logs all errors, cleans auth users', async () => {
      const registry = createEmptyRegistry();
      registry.studentIds.add('s-fail');
      registry.batchIds.add('b-fail');
      registry.programIds.add('p-fail');
      registry.auditLogIds.add('al-fail');
      registry.membershipIds.add('m-fail');
      registry.profileIds.add('pr-fail');
      registry.tenantIds.add('t-fail');
      registry.authUserIds.add('auth-survivor');

      const mockClient: any = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.startsWith('DELETE FROM') || sql.includes('purge_staging_audit_logs')) {
            throw new Error(`Catastrophic DB failure on: ${sql.slice(0, 30)}`);
          }
          if (sql.startsWith('SELECT id FROM')) {
            return { rows: [{ id: 'some-orphan' }] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      };

      const deletedAuthUsers: string[] = [];
      const mockSupabaseAdmin: any = {
        auth: {
          admin: {
            deleteUser: vi.fn().mockImplementation(async (id: string) => {
              deletedAuthUsers.push(id);
              return { error: null };
            }),
          },
        },
      };

      const report = await teardownStagingFixtures(mockClient, registry, undefined, mockSupabaseAdmin);

      expect(report.clean).toBe(false);
      expect(report.errors.length).toBeGreaterThanOrEqual(7);
      expect(deletedAuthUsers).toEqual(['auth-survivor']);
      expect(report.purgedAuthUsers).toBe(1);
    });
  });

  // ===========================================================================
  // 3. Probe Exact Orphan UUID Reporting (R4)
  // ===========================================================================
  describe('3. Probe Exact Orphan UUID Reporting (R4)', () => {
    it('Scenario 3.1: Captures multiple surviving UUIDs in exact array rather than count', async () => {
      const registry = createEmptyRegistry();
      registry.studentIds.add('student-uuid-aaa');
      registry.studentIds.add('student-uuid-bbb');
      registry.batchIds.add('batch-uuid-xxx');
      registry.tenantIds.add('tenant-uuid-ttt');

      const mockClient: any = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT id FROM public.students')) {
            return { rows: [{ id: 'student-uuid-aaa' }, { id: 'student-uuid-bbb' }] };
          }
          if (sql.includes('SELECT id FROM public.batches')) {
            return { rows: [{ id: 'batch-uuid-xxx' }] };
          }
          if (sql.includes('SELECT id FROM public.tenants')) {
            return { rows: [{ id: 'tenant-uuid-ttt' }] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      };

      const mockSupabaseAdmin: any = { auth: { admin: { deleteUser: vi.fn() } } };
      const report = await teardownStagingFixtures(mockClient, registry, undefined, mockSupabaseAdmin);

      expect(report.clean).toBe(false);
      expect(report.orphanIds.students).toEqual(['student-uuid-aaa', 'student-uuid-bbb']);
      expect(report.orphanIds.batches).toEqual(['batch-uuid-xxx']);
      expect(report.orphanIds.tenants).toEqual(['tenant-uuid-ttt']);
      expect(report.orphanIds.programs).toEqual([]);
      expect(report.orphanIds.auditLogs).toEqual([]);
      expect(report.orphanIds.memberships).toEqual([]);
      expect(report.orphanIds.profiles).toEqual([]);

      expect(report.errors).toContain('Orphaned students remained after teardown (2): [student-uuid-aaa, student-uuid-bbb]');
      expect(report.errors).toContain('Orphaned batches remained after teardown (1): [batch-uuid-xxx]');
      expect(report.errors).toContain('Orphaned tenants remained after teardown (1): [tenant-uuid-ttt]');
    });

    it('Scenario 3.2: Orphan query itself throws -> caught with ROLLBACK, reported in errors', async () => {
      const registry = createEmptyRegistry();
      registry.studentIds.add('student-uuid-1');

      const mockClient: any = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('DELETE FROM public.students')) return { rowCount: 1 };
          if (sql.includes('SELECT id FROM public.students')) {
            throw new Error('Connection reset by peer during orphan select');
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      };

      const mockSupabaseAdmin: any = { auth: { admin: { deleteUser: vi.fn() } } };
      const report = await teardownStagingFixtures(mockClient, registry, undefined, mockSupabaseAdmin);

      expect(report.clean).toBe(false);
      expect(report.errors).toContain('Failed to verify student orphans: Connection reset by peer during orphan select');
    });

    it('Scenario 3.3: 100% clean teardown -> orphanIds all empty arrays and clean is true', async () => {
      const registry = createEmptyRegistry();
      registry.studentIds.add('s1');
      registry.batchIds.add('b1');
      registry.programIds.add('p1');
      registry.auditLogIds.add('a1');
      registry.membershipIds.add('m1');
      registry.profileIds.add('pr1');
      registry.tenantIds.add('t1');
      registry.authUserIds.add('au1');

      const mockClient: any = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.startsWith('DELETE FROM')) return { rowCount: 1 };
          if (sql.includes('purge_staging_audit_logs')) return { rows: [{ purged: 1 }] };
          if (sql.startsWith('SELECT id FROM')) return { rows: [] };
          return { rows: [] };
        }),
        release: vi.fn(),
      };

      const mockSupabaseAdmin: any = {
        auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } },
      };

      const report = await teardownStagingFixtures(mockClient, registry, undefined, mockSupabaseAdmin);

      expect(report.clean).toBe(true);
      expect(report.errors).toHaveLength(0);
      expect(report.purgedStudents).toBe(1);
      expect(report.purgedBatches).toBe(1);
      expect(report.purgedPrograms).toBe(1);
      expect(report.purgedAuditLogs).toBe(1);
      expect(report.purgedMemberships).toBe(1);
      expect(report.purgedProfiles).toBe(1);
      expect(report.purgedTenants).toBe(1);
      expect(report.purgedAuthUsers).toBe(1);

      expect(report.orphanIds).toEqual({
        students: [],
        batches: [],
        programs: [],
        auditLogs: [],
        memberships: [],
        profiles: [],
        tenants: [],
        authUsers: [],
      });
    });
  });

  // ===========================================================================
  // 4. Verify Global DISABLE TRIGGER Elimination
  // ===========================================================================
  describe('4. Verify Global DISABLE TRIGGER Elimination (R3)', () => {
    it('Scenario 4.1: run-staging-boundary.ts contains 0 occurrences of DISABLE TRIGGER or session_replication_role', () => {
      const filePath = path.resolve(__dirname, '../src/scripts/run-staging-boundary.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).not.toMatch(/DISABLE\s+TRIGGER/i);
      expect(content).not.toMatch(/ENABLE\s+TRIGGER/i);
      expect(content).not.toMatch(/session_replication_role/i);
      expect(content).toContain('purge_staging_audit_logs');
      expect(content).toContain("SET LOCAL app.allow_staging_audit_purge = 'on'");
    });

    it('Scenario 4.2: Zero occurrences of DISABLE TRIGGER in entire backend source tree (src/)', () => {
      const srcDir = path.resolve(__dirname, '../src');
      function scanDir(dir: string): string[] {
        const files = fs.readdirSync(dir);
        let matches: string[] = [];
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            matches = matches.concat(scanDir(fullPath));
          } else if (file.endsWith('.ts') || file.endsWith('.js')) {
            const text = fs.readFileSync(fullPath, 'utf-8');
            if (/DISABLE\s+TRIGGER/i.test(text)) {
              matches.push(fullPath);
            }
          }
        }
        return matches;
      }

      const violatingFiles = scanDir(srcDir);
      expect(violatingFiles).toEqual([]);
    });

    it('Scenario 4.3: Migration 00028 defines purge_staging_audit_logs with is_local=true and restricts access', () => {
      const migPath = path.resolve(__dirname, '../../supabase/migrations/00028_safe_audit_log_teardown_and_resolver_hardening.sql');
      const migContent = fs.readFileSync(migPath, 'utf-8');

      // Assert set_config with 3rd argument true (transaction-local)
      expect(migContent).toMatch(/set_config\(\s*'app\.allow_staging_audit_purge'\s*,\s*'on'\s*,\s*true\s*\)/);
      // Assert revoked from PUBLIC, anon, authenticated, fastify_runtime, service_role
      expect(migContent).toContain('REVOKE ALL ON FUNCTION public.purge_staging_audit_logs(UUID[], UUID[]) FROM PUBLIC, anon, authenticated, fastify_runtime, service_role;');
      // Assert granted only to postgres, supabase_admin
      expect(migContent).toContain('GRANT EXECUTE ON FUNCTION public.purge_staging_audit_logs(UUID[], UUID[]) TO postgres, supabase_admin;');
    });
  });
});
