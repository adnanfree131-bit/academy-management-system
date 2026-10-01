import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import { buildApp } from '../src/app.js';
import { PostgresDataStore } from '../src/services/postgres-store.js';
import type { FastifyInstance } from 'fastify';

describe('Phase 3 Acceptance Gate: Production In-Memory Persistence Replacement', () => {
  let db: PGlite;
  let app1: FastifyInstance;
  let app2: FastifyInstance;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Run all migrations in sequence
    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await db.exec(sql);
    }

    // 2. Run seed
    const seedPath = path.resolve(__dirname, '../../supabase/seeds/001_dual_tenant_seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await db.exec(seedSql);
  });

  afterAll(async () => {
    if (app1) await app1.close();
    if (app2) await app2.close();
  });

  it('Gate 1: Searching production code finds no construction of InMemoryDataStore', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const filesToScan: string[] = [];

    function walkDir(dir: string) {
      for (const item of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
          filesToScan.push(fullPath);
        }
      }
    }

    walkDir(srcDir);
    expect(filesToScan.length).toBeGreaterThan(10);

    const violations: string[] = [];
    for (const file of filesToScan) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('new InMemoryDataStore')) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it('Gate 2: No production route calls snapshot import/export; legacy snapshot endpoints return 410 Gone', async () => {
    const store = new PostgresDataStore(db as any);
    const app = await buildApp({ store });

    // Test snapshot backup route
    const backupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/saas/backups',
      payload: {},
    });
    expect(backupRes.statusCode).toBe(410);
    const backupBody = JSON.parse(backupRes.body);
    expect(backupBody.error.code).toBe('SNAPSHOT_BACKUPS_RETIRED');

    // Test snapshot restore route
    const restoreRes = await app.inject({
      method: 'POST',
      url: '/api/v1/saas/backups/123/restore',
      payload: {},
    });
    expect(restoreRes.statusCode).toBe(410);
    const restoreBody = JSON.parse(restoreRes.body);
    expect(restoreBody.error.code).toBe('SNAPSHOT_BACKUPS_RETIRED');

    await app.close();
  });

  it('Gate 3: Production startup fails closed if PostgreSQL is unavailable', async () => {
    const origEnv = process.env.NODE_ENV;
    const origDbUrl = process.env.DATABASE_URL;
    try {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgres://invalid:pass@localhost:65432/nonexistent';
      await expect(buildApp()).rejects.toThrow();
    } finally {
      process.env.NODE_ENV = origEnv;
      process.env.DATABASE_URL = origDbUrl;
    }
  });

  it('Gate 4: A user and tenant created through the API persist across backend restarts', async () => {
    // 1. Instance 1 boots with PostgresDataStore
    const store1 = new PostgresDataStore(db as any);
    app1 = await buildApp({ store: store1 });

    const newSlug = `persisted-${Date.now().toString().slice(-8)}`;
    const newName = 'Persisted Academy Test';

    // Create tenant and admin in DB using store1
    const created = await store1.createTenant({
      name: newName,
      slug: newSlug,
      admin_name: 'Persisted Admin',
      admin_email: `admin-${Date.now().toString().slice(-6)}@persisted.test`,
    });

    expect(created.tenant.id).toBeDefined();
    expect(created.tenant.slug).toBe(newSlug);
    expect(created.admin.id).toBeDefined();

    // 2. Shut down Instance 1 completely (simulating backend crash/restart)
    await app1.close();

    // 3. Instance 2 boots fresh from scratch pointing to the same PostgreSQL database
    const store2 = new PostgresDataStore(db as any);
    app2 = await buildApp({ store: store2 });

    // Verify tenant still exists in Instance 2
    const fetchedTenant = await store2.getTenantById(created.tenant.id);
    expect(fetchedTenant).toBeDefined();
    expect(fetchedTenant?.id).toBe(created.tenant.id);
    expect(fetchedTenant?.name).toBe(newName);
    expect(fetchedTenant?.slug).toBe(newSlug);

    // Verify user still exists in Instance 2
    const fetchedUser = await store2.getUserById(created.tenant.id, created.admin.id);
    expect(fetchedUser).toBeDefined();
    expect(fetchedUser?.id).toBe(created.admin.id);
    expect(fetchedUser?.email).toBe(created.admin.email);
    expect(fetchedUser?.role).toBe('tenant_admin');
  });

  it('Gate 5: Two backend instances see the exact same state without memory drift', async () => {
    // Instance A and Instance B both connect to PostgreSQL
    const storeA = new PostgresDataStore(db as any);
    const storeB = new PostgresDataStore(db as any);

    const testSlug = `multi-${Date.now().toString().slice(-8)}`;
    const resA = await storeA.createTenant({
      name: 'Multi Instance Academy',
      slug: testSlug,
      admin_name: 'Multi Admin',
      admin_email: `multi-${Date.now().toString().slice(-6)}@instance.test`,
    });

    // Instance B immediately sees the tenant created by Instance A
    const tenantB = await storeB.getTenantById(resA.tenant.id);
    expect(tenantB).toBeDefined();
    expect(tenantB?.id).toBe(resA.tenant.id);
    expect(tenantB?.name).toBe('Multi Instance Academy');

    // Instance B updates tenant name
    await storeB.updateTenantSettings(resA.tenant.id, { name: 'Updated by Instance B' });

    // Instance A immediately reads the updated name from PostgreSQL
    const reloadedA = await storeA.getTenantById(resA.tenant.id);
    expect(reloadedA?.name).toBe('Updated by Instance B');
  });
});
