import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { dbContextStorage, getRequestContextDb, DatabaseRequestContext } from '../src/db/context.js';
import { withTenantTransaction, withPlatformTransaction } from '../src/db/transactions.js';
import { PostgresDataStore } from '../src/services/postgres-store.js';
import { InMemoryDataStore } from '../src/services/store.js';

describe('Phase 14: Request-Scoped Database Transaction Lifecycle & Bypass Elimination', () => {
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
    (store as any).getTenantById = vi.fn().mockResolvedValue(mockTenant);
    (store as any).getTenantBySlug = vi.fn().mockResolvedValue(mockTenant);
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

  it('Gate 1: Client checkout, BEGIN, role activation, and early commit in onSend for 2xx responses', async () => {
    const executedQueries: string[] = [];
    let releaseCalled = false;

    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
        executedQueries.push(sql);
        if (sql.includes('SELECT') && sql.includes('tenant_invitations')) {
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
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: dummyJwt,
        'x-tenant-id': 't-1',
      },
    });

    expect(res.statusCode).toBe(200);
    // Verify single checkout
    expect(mockPool.connect).toHaveBeenCalledTimes(1);

    // Verify lifecycle queries: BEGIN, set app.current_user_id, SET LOCAL ROLE, set app.current_tenant_id, COMMIT
    expect(executedQueries).toContain('BEGIN');
    expect(executedQueries.some((q) => q.includes("set_config('app.current_user_id'"))).toBe(true);
    expect(executedQueries).toContain('SET LOCAL ROLE authenticated');
    expect(executedQueries.some((q) => q.includes("set_config('app.current_tenant_id'"))).toBe(true);
    expect(executedQueries).toContain('COMMIT');

    // Verify client released back to pool
    expect(releaseCalled).toBe(true);
  });

  it('Gate 2: Early commit failure in onSend aborts request with HTTP 503 COMMIT_FAILED and executes rollback', async () => {
    const executedQueries: string[] = [];
    let releaseCalled = false;

    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        executedQueries.push(sql);
        if (sql === 'COMMIT') {
          const commitErr: any = new Error('simulated serialization failure on commit');
          commitErr.code = '40001';
          throw commitErr;
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
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        authorization: dummyJwt,
        'x-tenant-id': 't-1',
      },
    });

    // Request MUST fail closed with 503
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('COMMIT_FAILED');

    // Verify ROLLBACK was executed after COMMIT failure
    expect(executedQueries).toContain('COMMIT');
    expect(executedQueries).toContain('ROLLBACK');

    // Client released back to pool with zero leaks
    expect(releaseCalled).toBe(true);
  });

  it('Gate 3: Database pool connection checkout failure fails closed with HTTP 503 DATABASE_UNAVAILABLE', async () => {
    const mockPool = {
      connect: vi.fn().mockRejectedValue(new Error('Connection pool exhausted / connection timeout')),
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
  });

  it('Gate 4: Database initialization query failure rolls back, releases client, and returns HTTP 503', async () => {
    let releaseCalled = false;
    const executedQueries: string[] = [];

    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        executedQueries.push(sql);
        if (sql.includes('SET LOCAL ROLE authenticated')) {
          throw new Error('Role authenticated does not exist');
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
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('DATABASE_UNAVAILABLE');

    // Verify rollback and release
    expect(executedQueries).toContain('ROLLBACK');
    expect(releaseCalled).toBe(true);
  });

  it('Gate 5: Non-2xx response (4xx/5xx) executes ROLLBACK instead of COMMIT in onSend', async () => {
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
    // Simulate tenant not found (returns 404)
    (store as any).getTenantById = vi.fn().mockResolvedValue(null);

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
        'x-tenant-id': 'nonexistent-tenant',
      },
    });

    expect(res.statusCode).toBe(404);
    // Should NOT have committed
    expect(executedQueries).not.toContain('COMMIT');
    // MUST have rolled back
    expect(executedQueries).toContain('ROLLBACK');
    expect(releaseCalled).toBe(true);
  });

  it('Gate 6: SAVEPOINT nesting support in withTenantTransaction and withPlatformTransaction', async () => {
    const executedQueries: string[] = [];
    const client = {
      __in_transaction: true,
      __tx_depth: 1,
      query: vi.fn().mockImplementation(async (sql: string) => {
        executedQueries.push(sql);
        return { rows: [], rowCount: 0 };
      }),
    };

    // 1. Successful nested tenant transaction
    const res = await withTenantTransaction(client as any, 't-1', 'u-1', async (db) => {
      await db.query('INSERT INTO test_tbl VALUES (1)');
      return 'ok';
    });

    expect(res).toBe('ok');
    // Must use SAVEPOINT and RELEASE SAVEPOINT, NOT BEGIN / COMMIT
    expect(executedQueries.some((q) => q.startsWith('SAVEPOINT sp_'))).toBe(true);
    expect(executedQueries.some((q) => q.startsWith('RELEASE SAVEPOINT sp_'))).toBe(true);
    expect(executedQueries).not.toContain('BEGIN');
    expect(executedQueries).not.toContain('COMMIT');

    // 2. Failed nested tenant transaction: rolls back to SAVEPOINT, does not abort parent
    executedQueries.length = 0;
    await expect(
      withTenantTransaction(client as any, 't-1', 'u-1', async () => {
        throw new Error('Nested sub-operation failed');
      })
    ).rejects.toThrow('Nested sub-operation failed');

    expect(executedQueries.some((q) => q.startsWith('SAVEPOINT sp_'))).toBe(true);
    expect(executedQueries.some((q) => q.startsWith('ROLLBACK TO SAVEPOINT sp_'))).toBe(true);
    expect(executedQueries).not.toContain('ROLLBACK'); // Outer rollback must not be called

    // 3. Standalone transaction (depth 0): uses standard BEGIN/COMMIT
    executedQueries.length = 0;
    const standaloneClient = {
      __in_transaction: false,
      __tx_depth: 0,
      query: vi.fn().mockImplementation(async (sql: string) => {
        executedQueries.push(sql);
        return { rows: [], rowCount: 0 };
      }),
    };

    await withPlatformTransaction(standaloneClient as any, 'u-1', async (db) => {
      await db.query('SELECT 1');
    });

    expect(executedQueries).toContain('BEGIN');
    expect(executedQueries).toContain('COMMIT');
    expect(executedQueries.some((q) => q.startsWith('SAVEPOINT'))).toBe(false);
  });

  it('Gate 7: PostgresDataStore.getClient() reuses getRequestContextDb() with no-op release inside requests', async () => {
    let mockClientReleased = false;
    const mockRequestClient = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn().mockImplementation(() => {
        mockClientReleased = true;
      }),
    };

    const mockPool = {
      connect: vi.fn(),
      query: vi.fn(),
    };

    const store = new PostgresDataStore(mockPool as any);

    // 1. Outside request context: falls back to mockPool.connect
    (mockPool.connect as any).mockResolvedValue({
      query: vi.fn(),
      release: vi.fn(),
    });
    const clientOutside = await (store as any).getClient();
    expect(mockPool.connect).toHaveBeenCalledTimes(1);

    // 2. Inside request context: returns request client and release is no-op
    const reqContext: DatabaseRequestContext = { client: mockRequestClient as any };
    await dbContextStorage.run(reqContext, async () => {
      const clientInside = await (store as any).getClient();
      expect(mockPool.connect).toHaveBeenCalledTimes(1); // Not called again!

      // Execute a query on it
      await clientInside.query('SELECT 1');
      expect(mockRequestClient.query).toHaveBeenCalledWith('SELECT 1', undefined);

      // Call release - must NOT release the real client yet (Fastify lifecycle owns release)
      clientInside.release();
      expect(mockClientReleased).toBe(false);
    });
  });

  it('Gate 8: Concurrency & Context Isolation across parallel requests', async () => {
    const concurrentRequests = 15;
    const results: Array<{ authUserId: string; tenantId: string; matches: boolean }> = [];

    const promises = Array.from({ length: concurrentRequests }, (_, i) => {
      const expectedUser = `user-${i}`;
      const expectedTenant = `tenant-${i}`;
      const context: DatabaseRequestContext = {
        client: {
          query: vi.fn().mockImplementation(async () => {
            // Simulate random async I/O delay
            await new Promise((r) => setTimeout(r, Math.random() * 20 + 5));
            return { rows: [], rowCount: 0 };
          }),
        } as any,
        authUserId: expectedUser,
        tenantId: expectedTenant,
      };

      return dbContextStorage.run(context, async () => {
        // Yield control
        await new Promise((r) => setTimeout(r, Math.random() * 20 + 5));
        const activeDb = getRequestContextDb();
        const activeContext = dbContextStorage.getStore();

        results.push({
          authUserId: activeContext?.authUserId || '',
          tenantId: activeContext?.tenantId || '',
          matches:
            activeDb === context.client &&
            activeContext?.authUserId === expectedUser &&
            activeContext?.tenantId === expectedTenant,
        });
      });
    });

    await Promise.all(promises);

    expect(results).toHaveLength(concurrentRequests);
    expect(results.every((r) => r.matches)).toBe(true);
  });

  it('Gate 9: POST /api/v1/auth/invitations delegates to store.createInvitation without secondary checkout', async () => {
    let poolCheckoutCount = 0;
    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT') && sql.includes('tenant_invitations')) return { rows: [], rowCount: 0 };
        return { rows: [{ id: '1' }], rowCount: 1 };
      }),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn().mockImplementation(async () => {
        poolCheckoutCount++;
        return mockClient;
      }),
    };

    const store = createMockStore();
    (store as any).createInvitation = vi.fn().mockResolvedValue({
      invitation: { id: 'inv-123', email: 'teacher@test.com', role: 'teacher' },
      raw_token: 'secret-token-123',
    });

    const app = await buildApp({
      store,
      jwtVerifier: createMockVerifier(),
      pool: mockPool,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/invitations',
      headers: {
        authorization: dummyJwt,
        'x-tenant-id': 't-1',
      },
      payload: {
        email: 'teacher@test.com',
        role: 'teacher',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.invitation.id).toBe('inv-123');
    expect((store as any).createInvitation).toHaveBeenCalledTimes(1);

    // Exactly 1 checkout occurred (the request lifecycle checkout in authenticate), 0 secondary checkouts!
    expect(poolCheckoutCount).toBe(1);
  });

  it('Gate 10: POST /api/v1/auth/tenant/onboard delegates to store.onboardTenant without secondary checkout', async () => {
    let poolCheckoutCount = 0;
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: '1' }], rowCount: 1 }),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn().mockImplementation(async () => {
        poolCheckoutCount++;
        return mockClient;
      }),
    };

    const store = createMockStore();
    (store as any).onboardTenant = vi.fn().mockResolvedValue({
      tenant: { id: 't-new', name: 'New Academy', slug: 'new-academy' },
      membership: { id: 'm-new', role: 'tenant_admin' },
    });

    const app = await buildApp({
      store,
      jwtVerifier: createMockVerifier(),
      pool: mockPool,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboard-tenant',
      headers: {
        authorization: dummyJwt,
      },
      payload: {
        name: 'New Academy',
        slug: 'new-academy',
      },
    });

    expect(res.statusCode).toBe(201);
    expect((store as any).onboardTenant).toHaveBeenCalledTimes(1);
    // Exactly 1 checkout from request lifecycle, 0 from auth route
    expect(poolCheckoutCount).toBe(1);
  });

  it('Gate 11: Route handler exception triggers onError: executes ROLLBACK and releases client', async () => {
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
    (store as any).getPrograms = vi.fn().mockRejectedValue(new Error('Internal unexpected store crash'));

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
    expect(executedQueries).toContain('BEGIN');
    expect(executedQueries).toContain('ROLLBACK');
    expect(executedQueries).not.toContain('COMMIT');
    expect(releaseCalled).toBe(true);
  });
});
