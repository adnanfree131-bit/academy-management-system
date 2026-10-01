import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { dbContextStorage, getRequestContextDb, DatabaseRequestContext } from '../src/db/context.js';
import { InMemoryDataStore } from '../src/services/store.js';

describe('Phase 14 Adversarial Challenge: Concurrency, Context Crosstalk & Connection Pool Leaks', () => {

  // Helper to create simulated pool with strict tracking of counters and checkouts
  function createTrackedPool(maxConnections: number = 20) {
    let connectionCounter = 0;
    const allClients = new Map<number, {
      id: number;
      inUse: boolean;
      queries: string[];
      checkouts: number;
      releases: number;
      rollbacks: number;
      commits: number;
      configs: Map<string, string>;
    }>();

    const pool = {
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
      get activeCount() {
        return this.totalCount - this.idleCount;
      },
      connect: vi.fn().mockImplementation(async () => {
        // Find idle client or create new one up to max
        let clientRecord = Array.from(allClients.values()).find((c) => !c.inUse);
        if (!clientRecord) {
          connectionCounter++;
          const newId = connectionCounter;
          const newRecord = {
            id: newId,
            inUse: true,
            queries: [] as string[],
            checkouts: 1,
            releases: 0,
            rollbacks: 0,
            commits: 0,
            configs: new Map<string, string>(),
          };
          allClients.set(newId, newRecord);
          pool.totalCount++;
          clientRecord = newRecord;
        } else {
          clientRecord.inUse = true;
          clientRecord.checkouts++;
          pool.idleCount--;
        }

        const rec = clientRecord;

        const clientObj = {
          id: rec.id,
          __in_transaction: false,
          __tx_depth: 0,
          query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
            rec.queries.push(sql);

            // Parse set_config
            const configMatch = sql.match(/set_config\('([^']+)',\s*\$1/);
            if (configMatch && params && params[0]) {
              rec.configs.set(configMatch[1], String(params[0]));
            }

            if (sql === 'COMMIT') {
              rec.commits++;
            }
            if (sql === 'ROLLBACK') {
              rec.rollbacks++;
            }

            // Simulate realistic micro-delay
            await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 8) + 2));

            if (sql.includes('SELECT') && sql.includes('programs')) {
              return { rows: [{ id: 'prog-1', name: 'Science' }], rowCount: 1 };
            }
            return { rows: [{ id: '1' }], rowCount: 1 };
          }),
          release: vi.fn().mockImplementation(() => {
            if (!rec.inUse) {
              throw new Error(`Double-release detected on client #${rec.id}`);
            }
            rec.inUse = false;
            rec.releases++;
            pool.idleCount++;
          }),
        };

        return clientObj;
      }),
      getAllClients: () => Array.from(allClients.values()),
    };

    return pool;
  }

  describe('Adversarial Challenge 1: Concurrency & Context Crosstalk (50 Concurrent Requests)', () => {
    it('fires 50 concurrent requests with distinct tenant and user IDs and asserts 0 crosstalk', async () => {
      const CONCURRENCY = 50;
      const trackedPool = createTrackedPool(CONCURRENCY);

      // Create a store that validates context inside its methods
      const store = new InMemoryDataStore();
      const inFlightObservations: Array<{
        reqIndex: number;
        expectedUser: string;
        expectedTenant: string;
        observedUser: string;
        observedTenant: string;
        observedClient: any;
        isContextIsolated: boolean;
      }> = [];

      (store as any).getProfileByAuthId = vi.fn().mockImplementation(async (authUserId: string) => {
        // Asynchronous delay to force event-loop interleaving
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 15) + 5));
        const indexStr = authUserId.replace('user_adversarial_', '');
        return {
          id: `profile_${indexStr}`,
          auth_user_id: authUserId,
          email: `user_${indexStr}@adversarial.test`,
          display_name: `User ${indexStr}`,
          platform_role: 'user',
          status: 'active',
        };
      });

      (store as any).getTenantById = vi.fn().mockImplementation(async (tenantId: string) => {
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 15) + 5));
        const indexStr = tenantId.replace('tenant_adversarial_', '');
        return {
          id: tenantId,
          name: `Academy ${indexStr}`,
          slug: `academy-${indexStr}`,
          status: 'active',
          tier: 'starter',
        };
      });

      (store as any).getMembership = vi.fn().mockImplementation(async (tenantId: string, authUserId: string) => {
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 15) + 5));
        const indexStr = authUserId.replace('user_adversarial_', '');
        return {
          id: `membership_${indexStr}`,
          tenant_id: tenantId,
          auth_user_id: authUserId,
          role: 'tenant_admin',
          status: 'active',
        };
      });

      (store as any).getPrograms = vi.fn().mockImplementation(async (tenantId: string) => {
        // Deep assertion inside the store method where business logic executes
        const currentStore = dbContextStorage.getStore();
        const activeDb = getRequestContextDb();
        const indexStr = tenantId.replace('tenant_adversarial_', '');
        const expectedUser = `user_adversarial_${indexStr}`;

        // Artificial async delay to simulate multi-query database latency
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 20) + 10));

        inFlightObservations.push({
          reqIndex: Number(indexStr),
          expectedUser,
          expectedTenant: tenantId,
          observedUser: currentStore?.authUserId || '',
          observedTenant: currentStore?.tenantId || '',
          observedClient: activeDb,
          isContextIsolated:
            currentStore?.authUserId === expectedUser &&
            currentStore?.tenantId === tenantId &&
            Boolean(activeDb),
        });

        return [
          {
            id: `prog-${indexStr}`,
            tenant_id: tenantId,
            name: `Curriculum ${indexStr}`,
            code: `CURR-${indexStr}`,
            status: 'active',
          },
        ];
      });

      const jwtVerifier = {
        verify: vi.fn().mockImplementation(async (token: string) => {
          const match = token.match(/sub-user-(\d+)/);
          const idx = match ? match[1] : '0';
          return {
            sub: `user_adversarial_${idx}`,
            email: `user_${idx}@adversarial.test`,
            user_id: `user_adversarial_${idx}`,
          };
        }),
      };

      const app = await buildApp({
        store,
        jwtVerifier,
        pool: trackedPool,
      });

      // Launch 50 simultaneous requests
      const requestPromises = Array.from({ length: CONCURRENCY }, (_, i) => {
        const token = `Bearer valid.sub-user-${i}.token`;
        const tenantId = `tenant_adversarial_${i}`;

        return app.inject({
          method: 'GET',
          url: '/api/v1/academic/programs',
          headers: {
            authorization: token,
            'x-tenant-id': tenantId,
          },
        });
      });

      const responses = await Promise.all(requestPromises);

      // 1. Verify all 50 responses returned HTTP 200
      expect(responses).toHaveLength(CONCURRENCY);
      for (let i = 0; i < CONCURRENCY; i++) {
        const res = responses[i];
        expect(res.statusCode).toBe(200);
        const payload = JSON.parse(res.payload);
        expect(payload.success).toBe(true);
        expect(payload.data[0].tenant_id).toBe(`tenant_adversarial_${i}`);
        expect(payload.data[0].name).toBe(`Curriculum ${i}`);
      }

      // 2. Verify all in-flight store context checks observed 100% strict isolation
      expect(inFlightObservations).toHaveLength(CONCURRENCY);
      const contaminatedObservations = inFlightObservations.filter((obs) => !obs.isContextIsolated);
      expect(contaminatedObservations).toEqual([]);

      // 3. Verify that each request had a distinct DB client assigned or properly serialized
      // and that NO client executed queries for more than one tenant simultaneously
      const clients = trackedPool.getAllClients();
      for (const client of clients) {
        const configs = client.configs;
        const tenantConfig = configs.get('app.current_tenant_id');
        const userConfig = configs.get('app.current_user_id');

        if (tenantConfig && userConfig) {
          const userIdx = userConfig.replace('user_adversarial_', '');
          const tenantIdx = tenantConfig.replace('tenant_adversarial_', '');
          // User and Tenant configured on the same client must strictly match
          expect(userIdx).toBe(tenantIdx);
        }
      }

      // 4. Verify that total checkouts equals total releases (0 leak during 50 concurrent requests)
      let totalCheckouts = 0;
      let totalReleases = 0;
      for (const client of clients) {
        totalCheckouts += client.checkouts;
        totalReleases += client.releases;
        expect(client.inUse).toBe(false);
      }
      expect(totalCheckouts).toBe(CONCURRENCY);
      expect(totalReleases).toBe(CONCURRENCY);
      expect(trackedPool.activeCount).toBe(0);
      expect(trackedPool.idleCount).toBe(trackedPool.totalCount);
    });
  });

  describe('Adversarial Challenge 2: Connection Pool Exhaustion & Leak Verification', () => {
    it('rapid batch of 50 mixed-outcome requests (200, 404, 403, 500, 503) leaves 0 connection leaks', async () => {
      const BATCH_SIZE = 50;
      const trackedPool = createTrackedPool(25);

      const store = new InMemoryDataStore();

      // Configure distinct behaviors based on request index:
      // Index 0..9: Normal 200 OK
      // Index 10..19: Tenant Not Found (404)
      // Index 20..29: Forbidden Membership (403)
      // Index 30..39: Internal Unexpected Store Crash (500)
      // Index 40..49: Commit Failure / Serialization Failure (503)

      (store as any).getProfileByAuthId = vi.fn().mockImplementation(async (authUserId: string) => {
        const idx = Number(authUserId.replace('user_batch_', ''));
        return {
          id: `profile_${idx}`,
          auth_user_id: authUserId,
          email: `user_${idx}@batch.test`,
          display_name: `Batch User ${idx}`,
          platform_role: 'user',
          status: 'active',
        };
      });

      (store as any).getTenantById = vi.fn().mockImplementation(async (tenantId: string) => {
        const idx = Number(tenantId.replace('tenant_batch_', ''));
        if (idx >= 10 && idx < 20) {
          // Simulate missing tenant -> 404
          return null;
        }
        return {
          id: tenantId,
          name: `Batch Academy ${idx}`,
          slug: `batch-academy-${idx}`,
          status: 'active',
          tier: 'starter',
        };
      });

      (store as any).getMembership = vi.fn().mockImplementation(async (tenantId: string, authUserId: string) => {
        const match = authUserId.match(/\d+/);
        const idx = match ? Number(match[0]) : NaN;
        if (idx >= 20 && idx < 30) {
          // Simulate no membership -> 403
          return null;
        }
        return {
          id: `membership_${idx}`,
          tenant_id: tenantId,
          auth_user_id: authUserId,
          role: 'tenant_admin',
          status: 'active',
        };
      });

      (store as any).getPrograms = vi.fn().mockImplementation(async (tenantId: string) => {
        const idx = Number(tenantId.replace('tenant_batch_', ''));
        if (idx >= 30 && idx < 40) {
          // Simulate unhandled route crash -> 500
          throw new Error(`Unexpected fatal store crash for request ${idx}`);
        }
        return [{ id: `prog-${idx}`, tenant_id: tenantId, name: `Prog ${idx}` }];
      });

      // Wrap connect to inject commit failure for index 40..49
      const originalConnect = trackedPool.connect;
      trackedPool.connect = vi.fn().mockImplementation(async () => {
        const client = await originalConnect();
        const originalQuery = client.query;
        client.query = vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
          if (sql === 'COMMIT') {
            const context = dbContextStorage.getStore();
            const authId = context?.authUserId || '';
            const idx = Number(authId.replace('user_batch_', ''));
            if (idx >= 40 && idx < 50) {
              const serializationErr: any = new Error(`Serialization conflict error code 40001 on commit for request ${idx}`);
              serializationErr.code = '40001';
              throw serializationErr;
            }
          }
          return originalQuery(sql, params);
        });
        return client;
      });

      const jwtVerifier = {
        verify: vi.fn().mockImplementation(async (token: string) => {
          const match = token.match(/sub-batch-(\d+)/);
          const idx = match ? match[1] : '0';
          return {
            sub: `user_batch_${idx}`,
            email: `user_${idx}@batch.test`,
            user_id: `user_batch_${idx}`,
          };
        }),
      };

      const app = await buildApp({
        store,
        jwtVerifier,
        pool: trackedPool,
      });

      // Record baseline pool counters
      const baselineTotal = trackedPool.totalCount;
      const baselineIdle = trackedPool.idleCount;
      expect(trackedPool.activeCount).toBe(0);

      // Fire 50 simultaneous requests across all failure regimes
      const batchPromises = Array.from({ length: BATCH_SIZE }, (_, i) => {
        return app.inject({
          method: 'GET',
          url: '/api/v1/academic/programs',
          headers: {
            authorization: `Bearer valid.sub-batch-${i}.token`,
            'x-tenant-id': `tenant_batch_${i}`,
          },
        });
      });

      const responses = await Promise.all(batchPromises);

      // Verify status code distribution
      const statusCounts = responses.reduce((acc: Record<number, number>, r) => {
        acc[r.statusCode] = (acc[r.statusCode] || 0) + 1;
        return acc;
      }, {});

      expect(statusCounts[200]).toBe(10); // 0..9
      expect(statusCounts[404]).toBe(10); // 10..19
      expect(statusCounts[403]).toBe(10); // 20..29
      expect(statusCounts[500]).toBe(10); // 30..39
      expect(statusCounts[503]).toBe(10); // 40..49 (COMMIT_FAILED)

      // CRITICAL ASSERTION: Zero connection leaks!
      expect(trackedPool.activeCount).toBe(0);
      expect(trackedPool.idleCount).toBe(trackedPool.totalCount);

      const clients = trackedPool.getAllClients();
      for (const client of clients) {
        expect(client.inUse).toBe(false);
        expect(client.checkouts).toBe(client.releases);
      }

      // Verify that all 40 failed requests resulted in ROLLBACK, while only 10 succeeded in COMMIT
      let totalCommits = 0;
      let totalRollbacks = 0;
      for (const client of clients) {
        totalCommits += client.commits;
        totalRollbacks += client.rollbacks;
      }
      expect(totalCommits).toBe(10);
      // 10 (from 404) + 10 (from 403) + 10 (from 500) + 10 (from commit failure rollback) = 40 rollbacks
      expect(totalRollbacks).toBe(40);
    });

    it('survives 5 successive rapid bursts of 20 concurrent requests with zero pool degradation or leak', async () => {
      const BURST_COUNT = 5;
      const BURST_SIZE = 20;
      const trackedPool = createTrackedPool(15);

      const store = new InMemoryDataStore();
      (store as any).getProfileByAuthId = vi.fn().mockImplementation(async (id: string) => ({
        id: `profile_${id}`,
        auth_user_id: id,
        email: `${id}@burst.test`,
        platform_role: 'user',
        status: 'active',
      }));
      (store as any).getTenantById = vi.fn().mockImplementation(async (id: string) => ({
        id,
        name: `Burst Tenant ${id}`,
        slug: `burst-${id}`,
        status: 'active',
        tier: 'starter',
      }));
      (store as any).getMembership = vi.fn().mockImplementation(async (tid: string, uid: string) => ({
        id: `m_${uid}`,
        tenant_id: tid,
        auth_user_id: uid,
        role: 'tenant_admin',
        status: 'active',
      }));
      (store as any).getPrograms = vi.fn().mockResolvedValue([{ id: 'p-1', name: 'Science' }]);

      const jwtVerifier = {
        verify: vi.fn().mockImplementation(async (token: string) => {
          const uid = token.split('.')[1] || 'user-default';
          return { sub: uid, email: `${uid}@burst.test`, user_id: uid };
        }),
      };

      const app = await buildApp({
        store,
        jwtVerifier,
        pool: trackedPool,
      });

      for (let burst = 0; burst < BURST_COUNT; burst++) {
        const promises = Array.from({ length: BURST_SIZE }, (_, i) => {
          const uid = `burst_${burst}_user_${i}`;
          const tid = `burst_${burst}_tenant_${i}`;
          return app.inject({
            method: 'GET',
            url: '/api/v1/academic/programs',
            headers: {
              authorization: `Bearer header.${uid}.signature`,
              'x-tenant-id': tid,
            },
          });
        });

        const results = await Promise.all(promises);
        for (const res of results) {
          expect(res.statusCode).toBe(200);
        }

        // After every burst, verify zero active connections
        expect(trackedPool.activeCount).toBe(0);
        expect(trackedPool.idleCount).toBe(trackedPool.totalCount);
      }

      // Total 100 requests served across 5 bursts
      const clients = trackedPool.getAllClients();
      const totalCheckouts = clients.reduce((sum, c) => sum + c.checkouts, 0);
      const totalReleases = clients.reduce((sum, c) => sum + c.releases, 0);
      expect(totalCheckouts).toBe(BURST_COUNT * BURST_SIZE);
      expect(totalReleases).toBe(BURST_COUNT * BURST_SIZE);
      expect(trackedPool.activeCount).toBe(0);
    });
  });
});
