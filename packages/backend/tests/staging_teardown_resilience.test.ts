import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  runStagingBoundarySuite,
  teardownStagingFixtures,
  createEmptyRegistry,
  type StagingFixtureRegistry,
} from '../src/scripts/run-staging-boundary.js';

function createMockAppAndPool() {
  return {
    mockApp: {
      ready: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      inject: vi.fn().mockResolvedValue({ statusCode: 200, json: () => ({ success: true, data: [] }) }),
    },
    mockPool: {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [{ id: 'mock-id' }] }),
        release: vi.fn(),
      }),
      end: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('Phase 14 Remediation: Auth Provisioning & Independent Teardown Resilience', () => {
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

  describe('1. Outer Fail-Safe Auth User Provisioning Teardown', () => {
    it('purges already-created auth users in finally when provisioning fails on user 2 through the actual runner', async () => {
      const deletedUserIds: string[] = [];

      const mockSupabaseAdmin: any = {
        auth: {
          admin: {
            createUser: vi.fn()
              .mockResolvedValueOnce({ data: { user: { id: 'auth-user-1' } }, error: null })
              .mockRejectedValueOnce(new Error('Simulated network rate limit on user 2')),
            deleteUser: vi.fn().mockImplementation(async (id: string) => {
              deletedUserIds.push(id);
              return { error: null };
            }),
          },
        },
      };

      const mockAnonClient: any = {
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({
            data: { session: { access_token: 'mock-token-1' } },
            error: null,
          }),
        },
      };

      const mockJwtVerifier = {
        verify: vi.fn().mockResolvedValue({ sub: 'auth-user-1' }),
      };

      const { mockApp, mockPool } = createMockAppAndPool();

      // Execute through the ACTUAL staging runner
      const report = await runStagingBoundarySuite({
        supabaseAdmin: mockSupabaseAdmin,
        createAnonClient: () => mockAnonClient,
        jwtVerifier: mockJwtVerifier,
        skipPreflight: true,
        app: mockApp,
        pool: mockPool,
      });

      expect(report.passed).toBe(false);
      expect(deletedUserIds).toEqual(['auth-user-1']);
      expect(report.teardown.purgedAuthUsers).toBe(1);
      expect(report.teardown.clean).toBe(true);
      expect(report.teardown.orphanIds.authUsers).toEqual([]);
    });

    it('purges already-created auth users in finally when signInWithPassword fails through the actual runner', async () => {
      const deletedUserIds: string[] = [];

      const mockSupabaseAdmin: any = {
        auth: {
          admin: {
            createUser: vi.fn().mockResolvedValueOnce({ data: { user: { id: 'auth-user-signin-fail' } }, error: null }),
            deleteUser: vi.fn().mockImplementation(async (id: string) => {
              deletedUserIds.push(id);
              return { error: null };
            }),
          },
        },
      };

      const mockAnonClient: any = {
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Simulated sign-in invalid grant failure' },
          }),
        },
      };

      const mockJwtVerifier = {
        verify: vi.fn(),
      };

      const { mockApp, mockPool } = createMockAppAndPool();

      // Execute through the ACTUAL staging runner
      const report = await runStagingBoundarySuite({
        supabaseAdmin: mockSupabaseAdmin,
        createAnonClient: () => mockAnonClient,
        jwtVerifier: mockJwtVerifier,
        skipPreflight: true,
        app: mockApp,
        pool: mockPool,
      });

      expect(report.passed).toBe(false);
      expect(deletedUserIds).toEqual(['auth-user-signin-fail']);
      expect(report.teardown.purgedAuthUsers).toBe(1);
      expect(report.teardown.clean).toBe(true);
      expect(report.teardown.orphanIds.authUsers).toEqual([]);
    });

    it('purges already-created auth users in finally when JWKS verification fails through the actual runner', async () => {
      const deletedUserIds: string[] = [];

      const mockSupabaseAdmin: any = {
        auth: {
          admin: {
            createUser: vi.fn().mockResolvedValueOnce({ data: { user: { id: 'auth-user-jwks-fail' } }, error: null }),
            deleteUser: vi.fn().mockImplementation(async (id: string) => {
              deletedUserIds.push(id);
              return { error: null };
            }),
          },
        },
      };

      const mockAnonClient: any = {
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({
            data: { session: { access_token: 'invalid-jwt-token' } },
            error: null,
          }),
        },
      };

      const mockJwtVerifier = {
        verify: vi.fn().mockRejectedValue(new Error('JWKS verification signature mismatch')),
      };

      const { mockApp, mockPool } = createMockAppAndPool();

      // Execute through the ACTUAL staging runner
      const report = await runStagingBoundarySuite({
        supabaseAdmin: mockSupabaseAdmin,
        createAnonClient: () => mockAnonClient,
        jwtVerifier: mockJwtVerifier,
        skipPreflight: true,
        app: mockApp,
        pool: mockPool,
      });

      expect(report.passed).toBe(false);
      expect(deletedUserIds).toEqual(['auth-user-jwks-fail']);
      expect(report.teardown.purgedAuthUsers).toBe(1);
      expect(report.teardown.clean).toBe(true);
      expect(report.teardown.orphanIds.authUsers).toEqual([]);
    });

    it('purges all previously created users when provisioning fails on user 3 through the actual runner', async () => {
      const deletedUserIds: string[] = [];

      const mockSupabaseAdmin: any = {
        auth: {
          admin: {
            createUser: vi.fn()
              .mockResolvedValueOnce({ data: { user: { id: 'auth-user-1' } }, error: null })
              .mockResolvedValueOnce({ data: { user: { id: 'auth-user-2' } }, error: null })
              .mockRejectedValueOnce(new Error('Simulated network rate limit on user 3')),
            deleteUser: vi.fn().mockImplementation(async (id: string) => {
              deletedUserIds.push(id);
              return { error: null };
            }),
          },
        },
      };

      const mockAnonClient: any = {
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({
            data: { session: { access_token: 'mock-token' } },
            error: null,
          }),
        },
      };

      let tokenCounter = 0;
      const mockJwtVerifier = {
        verify: vi.fn().mockImplementation(async () => {
          tokenCounter++;
          return { sub: `auth-user-${tokenCounter}` };
        }),
      };

      const { mockApp, mockPool } = createMockAppAndPool();

      // Execute through the ACTUAL staging runner
      const report = await runStagingBoundarySuite({
        supabaseAdmin: mockSupabaseAdmin,
        createAnonClient: () => mockAnonClient,
        jwtVerifier: mockJwtVerifier,
        skipPreflight: true,
        app: mockApp,
        pool: mockPool,
      });

      expect(report.passed).toBe(false);
      expect(deletedUserIds).toEqual(['auth-user-1', 'auth-user-2']);
      expect(report.teardown.purgedAuthUsers).toBe(2);
      expect(report.teardown.clean).toBe(true);
      expect(report.teardown.orphanIds.authUsers).toEqual([]);
    });

    it('cleans up auth users unconditionally even when MIGRATION_DATABASE_URL is missing', async () => {
      delete process.env.MIGRATION_DATABASE_URL;

      const registry = createEmptyRegistry();
      registry.authUserIds.add('auth-user-isolated-1');
      registry.authUserIds.add('auth-user-isolated-2');

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

      const report = await teardownStagingFixtures(registry, undefined, undefined, mockSupabaseAdmin);

      expect(deletedUserIds).toEqual(['auth-user-isolated-1', 'auth-user-isolated-2']);
      expect(report.purgedAuthUsers).toBe(2);
      expect(report.clean).toBe(false);
      expect(report.errors).toContain('MIGRATION_DATABASE_URL is not configured for administrative teardown.');
    });

    it('tolerates 404 or User not found from Supabase Admin deleteUser idempotently', async () => {
      const registry = createEmptyRegistry();
      registry.authUserIds.add('already-deleted-user');

      const mockSupabaseAdmin: any = {
        auth: {
          admin: {
            deleteUser: vi.fn().mockResolvedValue({
              data: null,
              error: { status: 404, message: 'User not found' },
            }),
          },
        },
      };

      const report = await teardownStagingFixtures(registry, undefined, undefined, mockSupabaseAdmin);

      expect(report.purgedAuthUsers).toBe(1);
      expect(report.orphanIds.authUsers).toEqual([]);
    });
  });

  describe('2. Independent Resource Cleanup & Exact Orphan Reporting', () => {
    it('isolates table deletions so failure deleting students does not halt batches, programs, memberships, profiles, tenants', async () => {
      const registry = createEmptyRegistry();
      registry.studentIds.add('11111111-1111-1111-1111-111111111111');
      registry.batchIds.add('22222222-2222-2222-2222-222222222222');
      registry.programIds.add('33333333-3333-3333-3333-333333333333');
      registry.auditLogIds.add('44444444-4444-4444-4444-444444444444');
      registry.membershipIds.add('55555555-5555-5555-5555-555555555555');
      registry.profileIds.add('66666666-6666-6666-6666-666666666666');
      registry.tenantIds.add('77777777-7777-7777-7777-777777777777');

      const executedQueries: string[] = [];
      const mockClient: any = {
        query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
          executedQueries.push(sql);

          // Simulate students deletion deadlock / foreign key failure
          if (sql.includes('DELETE FROM public.students')) {
            throw new Error('Simulated deadlock or foreign key violation on students');
          }
          if (sql.includes('DELETE FROM public.batches')) {
            return { rowCount: 1 };
          }
          if (sql.includes('DELETE FROM public.programs')) {
            return { rowCount: 1 };
          }
          if (sql.includes('purge_staging_audit_logs')) {
            return { rows: [{ purged: 1 }] };
          }
          if (sql.includes('DELETE FROM public.tenant_memberships')) {
            return { rowCount: 1 };
          }
          if (sql.includes('DELETE FROM public.profiles')) {
            return { rowCount: 1 };
          }
          if (sql.includes('DELETE FROM public.tenants')) {
            return { rowCount: 1 };
          }

          // Orphan checks: students remained, all others cleanly deleted
          if (sql.includes('SELECT id FROM public.students')) {
            return { rows: [{ id: '11111111-1111-1111-1111-111111111111' }] };
          }
          if (sql.includes('SELECT id FROM public.')) {
            return { rows: [] };
          }

          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn(),
      };

      const mockSupabaseAdmin: any = {
        auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } },
      };

      const report = await teardownStagingFixtures(mockClient, registry, undefined, mockSupabaseAdmin);

      expect(report.clean).toBe(false);
      expect(report.purgedStudents).toBe(0);
      expect(report.purgedBatches).toBe(1);
      expect(report.purgedPrograms).toBe(1);
      expect(report.purgedAuditLogs).toBe(1);
      expect(report.purgedMemberships).toBe(1);
      expect(report.purgedProfiles).toBe(1);
      expect(report.purgedTenants).toBe(1);

      expect(report.orphanIds.students).toEqual(['11111111-1111-1111-1111-111111111111']);
      expect(report.orphanIds.batches).toEqual([]);
      expect(report.orphanIds.programs).toEqual([]);
      expect(report.orphanIds.auditLogs).toEqual([]);
      expect(report.orphanIds.memberships).toEqual([]);
      expect(report.orphanIds.profiles).toEqual([]);
      expect(report.orphanIds.tenants).toEqual([]);

      expect(report.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Failed to purge students: Simulated deadlock or foreign key violation on students'),
          expect.stringContaining('Orphaned students remained after teardown (1): [11111111-1111-1111-1111-111111111111]'),
        ])
      );
    });

    it('reports exact orphan UUIDs in orphanIds across multiple surviving entity types', async () => {
      const registry = createEmptyRegistry();
      registry.studentIds.add('st-uuid-a');
      registry.studentIds.add('st-uuid-b');
      registry.batchIds.add('bt-uuid-x');

      const mockClient: any = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT id FROM public.students')) {
            return { rows: [{ id: 'st-uuid-a' }, { id: 'st-uuid-b' }] };
          }
          if (sql.includes('SELECT id FROM public.batches')) {
            return { rows: [{ id: 'bt-uuid-x' }] };
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn(),
      };

      const mockSupabaseAdmin: any = {
        auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } },
      };

      const report = await teardownStagingFixtures(mockClient, registry, undefined, mockSupabaseAdmin);

      expect(report.clean).toBe(false);
      expect(report.orphanIds.students).toEqual(['st-uuid-a', 'st-uuid-b']);
      expect(report.orphanIds.batches).toEqual(['bt-uuid-x']);

      expect(report.errors).toEqual(
        expect.arrayContaining([
          'Orphaned students remained after teardown (2): [st-uuid-a, st-uuid-b]',
          'Orphaned batches remained after teardown (1): [bt-uuid-x]',
        ])
      );
    });
  });
});
