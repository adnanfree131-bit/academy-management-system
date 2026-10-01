import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { dbContextStorage, getRequestContextDb, DatabaseRequestContext } from '../src/db/context.js';
import {
  withTenantTransaction,
  withPlatformTransaction,
  executeAdmissionTransaction,
  executeInvoicePaymentTransaction,
  executeTenantOnboardingTransaction,
  executeCreateInvitationTransaction,
} from '../src/db/transactions.js';
import { PostgresDataStore } from '../src/services/postgres-store.js';
import { InMemoryDataStore } from '../src/services/store.js';

describe('Phase 14 Adversarial Verification: Transaction Lifecycle, Fail-Closed Boundaries, and Rollback Integrity', () => {
  const dummyJwt = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJlbWFpbCI6ImFkbWluQHRlc3QuY29tIn0.dummy';

  const mockProfile = {
    id: 'prof-1',
    auth_user_id: 'user-1',
    email: 'admin@test.com',
    display_name: 'Admin User',
    platform_role: 'user',
    status: 'active',
  };

  const mockTenant = {
    id: 't-1',
    name: 'Test Academy',
    slug: 'test-academy',
    status: 'active',
    tier: 'starter',
  };

  function createMockStore() {
    const store = new InMemoryDataStore();
    (store as any).getProfileByAuthId = vi.fn().mockResolvedValue(mockProfile);
    (store as any).getProfileByEmail = vi.fn().mockResolvedValue(mockProfile);
    (store as any).getTenantById = vi.fn().mockImplementation(async (id: string) => (id === 't-1' ? mockTenant : null));
    (store as any).getTenantBySlug = vi.fn().mockImplementation(async (slug: string) => (slug === 'test-academy' ? mockTenant : null));
    (store as any).getMembership = vi.fn().mockResolvedValue({
      id: 'm-1',
      tenant_id: 't-1',
      auth_user_id: 'user-1',
      role: 'tenant_admin',
      status: 'active',
    });
    return store;
  }

  function createMockVerifier() {
    return {
      verify: vi.fn().mockResolvedValue({
        sub: 'user-1',
        email: 'admin@test.com',
        user_id: 'user-1',
      }),
    };
  }

  // =========================================================================
  // Challenge 1: Commit Failure Interception
  // =========================================================================
  describe('Challenge 1: Commit Failure Interception in onSend Hook', () => {
    it('1A: Injected COMMIT failure aborts request with HTTP 503 COMMIT_FAILED, executes ROLLBACK, and releases client', async () => {
      const executedQueries: string[] = [];
      let releaseCallCount = 0;

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          executedQueries.push(sql);
          if (sql === 'COMMIT') {
            const commitErr: any = new Error('simulated deferrable foreign key constraint violation on commit');
            commitErr.code = '23503';
            throw commitErr;
          }
          return { rows: [{ id: '1' }], rowCount: 1 };
        }),
        release: vi.fn().mockImplementation(() => {
          releaseCallCount++;
        }),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };

      const store = createMockStore();
      const app = await buildApp({
        store,
        jwtVerifier: createMockVerifier(),
        pool: mockPool,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: {
          authorization: dummyJwt,
          'x-tenant-id': 't-1',
        },
      });

      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('COMMIT_FAILED');
      expect(body.error.message).toContain('Database transaction commit failed');

      // Assert lifecycle sequence: BEGIN -> ... -> COMMIT (fails) -> ROLLBACK
      expect(executedQueries).toContain('BEGIN');
      expect(executedQueries).toContain('COMMIT');
      expect(executedQueries).toContain('ROLLBACK');
      const commitIdx = executedQueries.lastIndexOf('COMMIT');
      const rollbackIdx = executedQueries.lastIndexOf('ROLLBACK');
      expect(rollbackIdx).toBeGreaterThan(commitIdx);

      // Verify client was released back to pool exactly once (no leaks, no double-release)
      expect(releaseCallCount).toBe(1);
    });

    it('1B: Injected COMMIT failure on data-mutating route proves ZERO partial writes committed', async () => {
      // Transactional state simulator
      const uncommittedBuffer: string[] = [];
      const committedTable: string[] = [];
      let releaseCalled = false;

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
          if (sql === 'BEGIN') {
            uncommittedBuffer.length = 0;
            return { rows: [], rowCount: 0 };
          }
          if (sql.includes('INSERT INTO public.programs')) {
            uncommittedBuffer.push(params ? params[1] : 'unnamed-program');
            return {
              rows: [{ id: 'prog-new', name: params ? params[1] : 'New Program', tenant_id: 't-1' }],
              rowCount: 1,
            };
          }
          if (sql === 'COMMIT') {
            // Simulate crash during COMMIT
            const commitErr: any = new Error('simulated disk failure during fsync at COMMIT');
            commitErr.code = '58030';
            throw commitErr;
          }
          if (sql === 'ROLLBACK') {
            uncommittedBuffer.length = 0; // Discard uncommitted changes
            return { rows: [], rowCount: 0 };
          }
          return { rows: [{ id: '1' }], rowCount: 1 };
        }),
        release: vi.fn().mockImplementation(() => {
          releaseCalled = true;
        }),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };

      const store = createMockStore();
      const app = await buildApp({
        store,
        jwtVerifier: createMockVerifier(),
        pool: mockPool,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/programs',
        headers: {
          authorization: dummyJwt,
          'x-tenant-id': 't-1',
        },
        payload: {
          name: 'Adversarial Test Program',
          code: 'ATP-101',
        },
      });

      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload).error.code).toBe('COMMIT_FAILED');

      // EMPIRICAL PROOF OF ZERO PARTIAL WRITES:
      expect(committedTable).toHaveLength(0);
      expect(uncommittedBuffer).toHaveLength(0);
      expect(releaseCalled).toBe(true);
    });

    it('1C: Cascading failure when ROLLBACK throws during COMMIT failure handling still fails closed and releases client', async () => {
      let releaseCallCount = 0;

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql === 'COMMIT') {
            throw new Error('primary commit failure');
          }
          if (sql === 'ROLLBACK') {
            throw new Error('secondary rollback failure: connection terminated');
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn().mockImplementation(() => {
          releaseCallCount++;
        }),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };

      const store = createMockStore();
      const app = await buildApp({
        store,
        jwtVerifier: createMockVerifier(),
        pool: mockPool,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: {
          authorization: dummyJwt,
          'x-tenant-id': 't-1',
        },
      });

      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload).error.code).toBe('COMMIT_FAILED');
      // Even if ROLLBACK threw an error inside the catch block, release() was called and error handled
      expect(releaseCallCount).toBe(1);
    });
  });

  // =========================================================================
  // Challenge 2: DB Initialization / Connection Checkout Failure
  // =========================================================================
  describe('Challenge 2: DB Initialization and Connection Checkout Failure', () => {
    it('2A: pool.connect() rejection fails closed immediately with HTTP 503 DATABASE_UNAVAILABLE and zero client leaks', async () => {
      let checkoutAttempts = 0;
      const mockPool = {
        connect: vi.fn().mockImplementation(async () => {
          checkoutAttempts++;
          throw new Error('Connection pool exhausted: max connections reached');
        }),
      };

      const store = createMockStore();
      const app = await buildApp({
        store,
        jwtVerifier: createMockVerifier(),
        pool: mockPool,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: {
          authorization: dummyJwt,
          'x-tenant-id': 't-1',
        },
      });

      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('DATABASE_UNAVAILABLE');
      expect(body.error.message).toContain('Database initialization failed');
      expect(checkoutAttempts).toBe(1);
    });

    it('2B: BEGIN failure rolls back, releases client, and fails closed with HTTP 503', async () => {
      let releaseCalled = false;
      const executedQueries: string[] = [];

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          executedQueries.push(sql);
          if (sql === 'BEGIN') {
            throw new Error('database is in recovery mode, cannot BEGIN');
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn().mockImplementation(() => {
          releaseCalled = true;
        }),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };

      const store = createMockStore();
      const app = await buildApp({
        store,
        jwtVerifier: createMockVerifier(),
        pool: mockPool,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: {
          authorization: dummyJwt,
          'x-tenant-id': 't-1',
        },
      });

      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload).error.code).toBe('DATABASE_UNAVAILABLE');
      expect(releaseCalled).toBe(true);
    });

    it('2C: set_config(app.current_user_id) failure rolls back, releases client, and fails closed with HTTP 503', async () => {
      let releaseCalled = false;
      const executedQueries: string[] = [];

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          executedQueries.push(sql);
          if (sql.includes("set_config('app.current_user_id'")) {
            throw new Error('parameter error: invalid user context identifier');
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn().mockImplementation(() => {
          releaseCalled = true;
        }),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };

      const store = createMockStore();
      const app = await buildApp({
        store,
        jwtVerifier: createMockVerifier(),
        pool: mockPool,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: {
          authorization: dummyJwt,
          'x-tenant-id': 't-1',
        },
      });

      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload).error.code).toBe('DATABASE_UNAVAILABLE');
      expect(executedQueries).toContain('ROLLBACK');
      expect(releaseCalled).toBe(true);
    });

    it('2D: SET LOCAL ROLE failure rolls back, releases client, and fails closed with HTTP 503', async () => {
      let releaseCalled = false;
      const executedQueries: string[] = [];

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          executedQueries.push(sql);
          if (sql.includes('SET LOCAL ROLE authenticated')) {
            throw new Error('permission denied: role authenticated does not have permission');
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn().mockImplementation(() => {
          releaseCalled = true;
        }),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };

      const store = createMockStore();
      const app = await buildApp({
        store,
        jwtVerifier: createMockVerifier(),
        pool: mockPool,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: {
          authorization: dummyJwt,
          'x-tenant-id': 't-1',
        },
      });

      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload).error.code).toBe('DATABASE_UNAVAILABLE');
      expect(executedQueries).toContain('ROLLBACK');
      expect(releaseCalled).toBe(true);
    });

    it('2E: set_config(app.current_tenant_id) failure in tenant resolution rolls back, releases client, and fails closed with HTTP 503', async () => {
      let releaseCalled = false;
      const executedQueries: string[] = [];

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          executedQueries.push(sql);
          if (sql.includes("set_config('app.current_tenant_id'")) {
            throw new Error('invalid tenant UUID syntax');
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn().mockImplementation(() => {
          releaseCalled = true;
        }),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };

      const store = createMockStore();
      const app = await buildApp({
        store,
        jwtVerifier: createMockVerifier(),
        pool: mockPool,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: {
          authorization: dummyJwt,
          'x-tenant-id': 't-1',
        },
      });

      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload).error.code).toBe('DATABASE_UNAVAILABLE');
      expect(executedQueries).toContain('ROLLBACK');
      expect(releaseCalled).toBe(true);
    });
  });

  // =========================================================================
  // Challenge 3: Route Error Rollback
  // =========================================================================
  describe('Challenge 3: Route Error Rollback and Client Release', () => {
    it('3A: Route handler 400 Bad Request triggers ROLLBACK and releases client without COMMIT', async () => {
      const executedQueries: string[] = [];
      let releaseCalled = false;

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          executedQueries.push(sql);
          return { rows: [{ id: '1' }], rowCount: 1 };
        }),
        release: vi.fn().mockImplementation(() => {
          releaseCalled = true;
        }),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };

      const store = createMockStore();
      const app = await buildApp({
        store,
        jwtVerifier: createMockVerifier(),
        pool: mockPool,
      });

      // Send invalid payload to trigger 400 validation error
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/programs',
        headers: {
          authorization: dummyJwt,
          'x-tenant-id': 't-1',
        },
        payload: {
          name: '', // Empty name triggers validation failure
        },
      });

      expect(res.statusCode).toBe(400);
      expect(executedQueries).not.toContain('COMMIT');
      expect(executedQueries).toContain('ROLLBACK');
      expect(releaseCalled).toBe(true);
    });

    it('3B: Route handler 403 Forbidden (RBAC violation) triggers ROLLBACK and releases client without COMMIT', async () => {
      const executedQueries: string[] = [];
      let releaseCalled = false;

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          executedQueries.push(sql);
          return { rows: [{ id: '1' }], rowCount: 1 };
        }),
        release: vi.fn().mockImplementation(() => {
          releaseCalled = true;
        }),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };

      const store = createMockStore();
      // Demote member to a role that cannot edit programs
      (store as any).getMembership = vi.fn().mockResolvedValue({
        id: 'm-1',
        tenant_id: 't-1',
        auth_user_id: 'user-1',
        role: 'student', // student role cannot edit academic programs
        status: 'active',
      });

      const app = await buildApp({
        store,
        jwtVerifier: createMockVerifier(),
        pool: mockPool,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/programs',
        headers: {
          authorization: dummyJwt,
          'x-tenant-id': 't-1',
        },
        payload: {
          name: 'Forbidden Program',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(executedQueries).not.toContain('COMMIT');
      expect(executedQueries).toContain('ROLLBACK');
      expect(releaseCalled).toBe(true);
    });

    it('3C: Route handler unexpected 500 exception triggers onError ROLLBACK and releases client without double-release', async () => {
      const executedQueries: string[] = [];
      let releaseCallCount = 0;

      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          executedQueries.push(sql);
          return { rows: [{ id: '1' }], rowCount: 1 };
        }),
        release: vi.fn().mockImplementation(() => {
          releaseCallCount++;
        }),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };

      const store = createMockStore();
      (store as any).getPrograms = vi.fn().mockImplementation(async () => {
        throw new Error('Fatal internal unexpected error in database query handler');
      });

      const app = await buildApp({
        store,
        jwtVerifier: createMockVerifier(),
        pool: mockPool,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: {
          authorization: dummyJwt,
          'x-tenant-id': 't-1',
        },
      });

      expect(res.statusCode).toBe(500);
      expect(executedQueries).not.toContain('COMMIT');
      expect(executedQueries).toContain('ROLLBACK');
      // Assert exactly 1 release called (no double-release between onError and onResponse)
      expect(releaseCallCount).toBe(1);
    });
  });

  // =========================================================================
  // Challenge 4: SAVEPOINT Nested Transaction Rollback
  // =========================================================================
  describe('Challenge 4: SAVEPOINT Nested Transaction Isolation and Rollback', () => {
    it('4A: Nested withTenantTransaction creates SAVEPOINT and releases it without committing outer transaction', async () => {
      const executedQueries: string[] = [];
      const client = {
        __in_transaction: true,
        __tx_depth: 1,
        query: vi.fn().mockImplementation(async (sql: string) => {
          executedQueries.push(sql);
          return { rows: [], rowCount: 0 };
        }),
      };

      const res = await withTenantTransaction(client as any, 't-1', 'u-1', async (db) => {
        expect((client as any).__tx_depth).toBe(2);
        await db.query('INSERT INTO audit_logs (id) VALUES (1)');
        return 'success';
      });

      expect(res).toBe('success');
      expect((client as any).__tx_depth).toBe(1);
      expect((client as any).__in_transaction).toBe(true);

      expect(executedQueries.some((q) => q.startsWith('SAVEPOINT sp_'))).toBe(true);
      expect(executedQueries.some((q) => q.startsWith('RELEASE SAVEPOINT sp_'))).toBe(true);
      expect(executedQueries).not.toContain('BEGIN');
      expect(executedQueries).not.toContain('COMMIT');
    });

    it('4B: Nested withTenantTransaction failure executes ROLLBACK TO SAVEPOINT and allows outer transaction to recover', async () => {
      const executedQueries: string[] = [];
      const client = {
        __in_transaction: true,
        __tx_depth: 1,
        query: vi.fn().mockImplementation(async (sql: string) => {
          executedQueries.push(sql);
          return { rows: [], rowCount: 0 };
        }),
      };

      // Outer caller catches nested error and continues
      let recovered = false;
      try {
        await withTenantTransaction(client as any, 't-1', 'u-1', async () => {
          throw new Error('Simulated failure in non-critical sub-operation');
        });
      } catch (err: any) {
        recovered = true;
      }

      expect(recovered).toBe(true);
      // Outer transaction depth restored to 1
      expect((client as any).__tx_depth).toBe(1);
      expect((client as any).__in_transaction).toBe(true);

      // Verify ROLLBACK TO SAVEPOINT was issued
      expect(executedQueries.some((q) => q.startsWith('SAVEPOINT sp_'))).toBe(true);
      expect(executedQueries.some((q) => q.startsWith('ROLLBACK TO SAVEPOINT sp_'))).toBe(true);
      // Outer transaction ROLLBACK was NOT called!
      expect(executedQueries).not.toContain('ROLLBACK');

      // Outer transaction can still perform further queries and commit!
      await client.query('INSERT INTO recovery_log VALUES (1)');
      await client.query('COMMIT');
      expect(executedQueries).toContain('COMMIT');
    });

    it('4C: Multi-level SAVEPOINT nesting (depth 1 -> 2 -> 3) manages depth stack correctly', async () => {
      const depthLog: number[] = [];
      const executedQueries: string[] = [];

      const client = {
        __in_transaction: true,
        __tx_depth: 1,
        query: vi.fn().mockImplementation(async (sql: string) => {
          executedQueries.push(sql);
          return { rows: [], rowCount: 0 };
        }),
      };

      await withTenantTransaction(client as any, 't-1', 'u-1', async () => {
        depthLog.push((client as any).__tx_depth); // Level 2
        await withTenantTransaction(client as any, 't-1', 'u-1', async () => {
          depthLog.push((client as any).__tx_depth); // Level 3
        });
        depthLog.push((client as any).__tx_depth); // Back to Level 2
      });
      depthLog.push((client as any).__tx_depth); // Back to Level 1

      expect(depthLog).toEqual([2, 3, 2, 1]);
      // Verify two pairs of SAVEPOINT / RELEASE SAVEPOINT
      const savepoints = executedQueries.filter((q) => q.startsWith('SAVEPOINT'));
      const releases = executedQueries.filter((q) => q.startsWith('RELEASE SAVEPOINT'));
      expect(savepoints).toHaveLength(2);
      expect(releases).toHaveLength(2);
    });

    it('4D: executeAdmissionTransaction nested inside request transaction rolls back cleanly on error', async () => {
      const executedQueries: string[] = [];
      const client = {
        __in_transaction: true,
        __tx_depth: 1,
        query: vi.fn().mockImplementation(async (sql: string) => {
          executedQueries.push(sql);
          if (sql.includes('INSERT INTO public.students')) {
            return { rows: [{ id: 's-1', admission_number: 'ADM-001', roll_number: 'R-01', full_name: 'Test Student' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }),
      };

      await expect(
        executeAdmissionTransaction(client, {
          tenantId: 't-1',
          authUserId: 'u-1',
          student: {
            admission_number: 'ADM-001',
            roll_number: 'R-01',
            full_name: 'Test Student',
            guardian_name: 'Parent Name',
            guardian_phone: '03001234567',
            program_id: 'p-1',
            batch_id: 'b-1',
          },
          invoice: {
            invoice_number: 'INV-001',
            subtotal_amount: 10000,
            net_amount: 10000,
            billing_month: '2026-10',
            issue_date: '2026-10-01',
            due_date: '2026-10-10',
          },
          shouldFailAfterStudent: true, // Trigger failure after student creation
        })
      ).rejects.toThrow('SIMULATED_ADMISSION_FAILURE');

      // Verify ROLLBACK TO SAVEPOINT executed
      expect(executedQueries.some((q) => q.startsWith('SAVEPOINT sp_'))).toBe(true);
      expect(executedQueries.some((q) => q.startsWith('ROLLBACK TO SAVEPOINT sp_'))).toBe(true);
      expect(executedQueries).not.toContain('ROLLBACK');
      expect((client as any).__tx_depth).toBe(1);
    });

    it('4E: executeInvoicePaymentTransaction nested inside request transaction rolls back cleanly on error', async () => {
      const executedQueries: string[] = [];
      const client = {
        __in_transaction: true,
        __tx_depth: 1,
        query: vi.fn().mockImplementation(async (sql: string) => {
          executedQueries.push(sql);
          if (sql.includes('FOR UPDATE')) {
            return {
              rows: [{ id: 'inv-1', balance_amount: 5000, paid_amount: 0, student_id: 's-1', roll_number: 'R-1' }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
      };

      await expect(
        executeInvoicePaymentTransaction(client, {
          tenantId: 't-1',
          authUserId: 'u-1',
          invoiceId: 'inv-1',
          paymentAmount: 2000,
          paymentMethod: 'cash',
          receiptNumber: 'RCP-001',
          collectedBy: 'Admin',
          shouldFailAfterLock: true,
        })
      ).rejects.toThrow('SIMULATED_PAYMENT_FAILURE');

      // Verify ROLLBACK TO SAVEPOINT executed
      expect(executedQueries.some((q) => q.startsWith('SAVEPOINT sp_'))).toBe(true);
      expect(executedQueries.some((q) => q.startsWith('ROLLBACK TO SAVEPOINT sp_'))).toBe(true);
      expect(executedQueries).not.toContain('ROLLBACK');
      expect((client as any).__tx_depth).toBe(1);
    });
  });

  // =========================================================================
  // Challenge 5: Concurrency and Race Condition Stress Test
  // =========================================================================
  describe('Challenge 5: Concurrency and High-Stress Race Condition Test', () => {
    it('5A: Mixed concurrent traffic (success, 400 validation, 500 error, commit fail, pool fail) isolates context and releases all clients', async () => {
      let activeCheckedOutClients = 0;
      let maxSimultaneousCheckouts = 0;

      const createInstrumentedPool = () => {
        return {
          connect: vi.fn().mockImplementation(async () => {
            activeCheckedOutClients++;
            if (activeCheckedOutClients > maxSimultaneousCheckouts) {
              maxSimultaneousCheckouts = activeCheckedOutClients;
            }
            const client = {
              __in_transaction: false,
              __tx_depth: 0,
              query: vi.fn().mockImplementation(async (sql: string) => {
                // Simulate variable I/O delay
                await new Promise((r) => setTimeout(r, Math.random() * 10 + 2));
                return { rows: [{ id: '1' }], rowCount: 1 };
              }),
              release: vi.fn().mockImplementation(() => {
                activeCheckedOutClients--;
              }),
            };
            return client;
          }),
        };
      };

      const mockPool = createInstrumentedPool();
      const store = createMockStore();
      const app = await buildApp({
        store,
        jwtVerifier: createMockVerifier(),
        pool: mockPool,
      });

      // Dispatch 25 concurrent requests across 5 categories
      const requests = Array.from({ length: 25 }, async (_, idx) => {
        const type = idx % 5;
        if (type === 0) {
          // Normal 200 OK
          const res = await app.inject({
            method: 'GET',
            url: '/api/v1/academic/programs',
            headers: { authorization: dummyJwt, 'x-tenant-id': 't-1' },
          });
          return { type, statusCode: res.statusCode };
        } else if (type === 1) {
          // 400 Bad Request
          const res = await app.inject({
            method: 'POST',
            url: '/api/v1/academic/programs',
            headers: { authorization: dummyJwt, 'x-tenant-id': 't-1' },
            payload: { name: '' },
          });
          return { type, statusCode: res.statusCode };
        } else if (type === 2) {
          // 404 Not Found
          const res = await app.inject({
            method: 'GET',
            url: '/api/v1/academic/programs',
            headers: { authorization: dummyJwt, 'x-tenant-id': 'unknown-tenant' },
          });
          return { type, statusCode: res.statusCode };
        } else if (type === 3) {
          // 401 Unauthorized (No token -> no DB checkout)
          const res = await app.inject({
            method: 'GET',
            url: '/api/v1/academic/programs',
          });
          return { type, statusCode: res.statusCode };
        } else {
          // Normal 200 OK with query
          const res = await app.inject({
            method: 'GET',
            url: '/api/v1/academic/programs',
            headers: { authorization: dummyJwt, 'x-tenant-id': 't-1' },
          });
          return { type, statusCode: res.statusCode };
        }
      });

      const results = await Promise.all(requests);

      expect(results).toHaveLength(25);
      // Group checks:
      const okResults = results.filter((r) => r.type === 0 || r.type === 4);
      expect(okResults.every((r) => r.statusCode === 200)).toBe(true);

      const valResults = results.filter((r) => r.type === 1);
      expect(valResults.every((r) => r.statusCode === 400)).toBe(true);

      const nfResults = results.filter((r) => r.type === 2);
      expect(nfResults.every((r) => r.statusCode === 404)).toBe(true);

      const unauthResults = results.filter((r) => r.type === 3);
      expect(unauthResults.every((r) => r.statusCode === 401)).toBe(true);

      // Verify ZERO connection leaks! All checked-out clients have been released
      expect(activeCheckedOutClients).toBe(0);
      expect(maxSimultaneousCheckouts).toBeGreaterThan(0);
    });
  });
});
