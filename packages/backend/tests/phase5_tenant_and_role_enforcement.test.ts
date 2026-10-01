import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { createTestSupabaseToken } from '../src/lib/jwt-verifier.js';
import { withTenantTransaction } from '../src/db/transactions.js';

describe('Phase 5: Backend Tenant and Role Enforcement Acceptance Gate', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let db: PGlite;
  let client: { query: (text: string, params?: any[]) => Promise<any> };

  const TENANT_A_ID = 'a0000000-0000-0000-0000-000000000001'; // apex (Apex Academy)
  const TENANT_B_ID = 'b0000000-0000-0000-0000-000000000002'; // crescent (Crescent Academy)
  const USER_A_AUTH_ID = 'e1000000-0000-0000-0000-000000000001'; // Member of Tenant A only
  const SUPER_ADMIN_AUTH_ID = 'e1000000-0000-0000-0000-000000000000'; // Platform Super Admin

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SUPABASE_JWT_ISSUER = 'https://test-project.supabase.co/auth/v1';
    process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
    process.env.TEST_JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long';
    process.env.BASE_DOMAIN = 'kampus.pk';

    // 1. Initialize PGlite database and run migrations
    db = new PGlite();
    client = {
      query: async (text: string, params: any[] = []) => {
        return db.query(text, params);
      },
    };

    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await db.exec(sql);
    }

    // 2. Initialize in-memory store for Fastify app tests
    store = new InMemoryDataStore();

    await store.createTenant({
      id: TENANT_A_ID,
      name: 'Apex Academy',
      slug: 'apex',
      admin_name: 'Adnan Apex',
      admin_email: 'adnan@apexacademy.edu.pk',
    });

    await store.createTenant({
      id: TENANT_B_ID,
      name: 'Crescent Academy',
      slug: 'crescent',
      admin_name: 'Principal Crescent',
      admin_email: 'principal@crescent.edu.pk',
    });

    await store.saveProfile({
      id: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
      display_name: 'Adnan Apex',
      platform_role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await store.saveProfile({
      id: SUPER_ADMIN_AUTH_ID,
      email: 'superadmin@kampus.pk',
      display_name: 'Super Admin',
      platform_role: 'super_admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Membership: User A is ONLY in Tenant A
    (store as any).users.set(`${TENANT_A_ID}:adnan@apexacademy.edu.pk`, {
      id: 'm1000000-0000-0000-0000-000000000001',
      tenant_id: TENANT_A_ID,
      auth_user_id: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
      full_name: 'Adnan Apex',
      role: 'tenant_admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    app = await buildApp({ store });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Gate 1: Authenticated user cannot access another tenant by spoofing X-Tenant-ID on central platform host (403 FORBIDDEN)', async () => {
    const token = await createTestSupabaseToken({
      sub: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
    });

    // User A attempts to access Tenant B on central host app.kampus.pk
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        host: 'app.kampus.pk',
        authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_B_ID, // Spoofed Tenant B
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('User does not belong to this academy');
  });

  it('Gate 2: Branded domain (apex.kampus.pk) rejects X-Tenant-ID targeting a different tenant (403 TENANT_HOST_MISMATCH)', async () => {
    const token = await createTestSupabaseToken({
      sub: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
    });

    // Request directed to apex.kampus.pk, but header specifies crescent tenant ID
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        host: 'apex.kampus.pk',
        authorization: `Bearer ${token}`,
        'x-tenant-id': TENANT_B_ID, // Mismatched tenant ID
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TENANT_HOST_MISMATCH');
    expect(body.error.message).toContain('Cross-tenant access prohibited');
  });

  it('Gate 3: Branded domain (apex.kampus.pk) allows authorized member without needing explicit X-Tenant-ID header', async () => {
    const token = await createTestSupabaseToken({
      sub: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
    });

    // Request to apex.kampus.pk without X-Tenant-ID header
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        host: 'apex.kampus.pk',
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });

  it('Gate 4: Request to unmapped/unrecognized host returns 404 UNMAPPED_HOST', async () => {
    const token = await createTestSupabaseToken({
      sub: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
    });

    // Unmapped subdomain: non-existent academy
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: {
        host: 'nonexistent-academy-random-12345.kampus.pk',
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNMAPPED_HOST');
  });

  it('Gate 5: Database transactions set app.current_tenant_id and app.current_user_id locally using SET LOCAL without connection pollution', async () => {
    // Before transaction: configs should be empty or default
    const preCheck = await client.query(`SELECT current_setting('app.current_tenant_id', true) as tenant_id`);
    expect(preCheck.rows[0].tenant_id).toBeFalsy();

    // Execute transaction setting tenant context
    const txResult = await withTenantTransaction(client, TENANT_A_ID, USER_A_AUTH_ID, async (dbCtx) => {
      const inTxCheck = await dbCtx.query(`
        SELECT 
          current_setting('app.current_tenant_id', true) as tenant_id,
          current_setting('app.current_user_id', true) as user_id
      `);
      return inTxCheck.rows[0];
    });

    expect(txResult.tenant_id).toBe(TENANT_A_ID);
    expect(txResult.user_id).toBe(USER_A_AUTH_ID);

    // After transaction completes: settings MUST NOT leak into the connection
    const postCheck = await client.query(`
      SELECT 
        current_setting('app.current_tenant_id', true) as tenant_id,
        current_setting('app.current_user_id', true) as user_id
    `);
    expect(postCheck.rows[0].tenant_id).toBeFalsy();
    expect(postCheck.rows[0].user_id).toBeFalsy();
  });

  it('Gate 6: Platform super admin can access platform SaaS routes, but normal tenant users receive 403 FORBIDDEN', async () => {
    const userToken = await createTestSupabaseToken({
      sub: USER_A_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
    });

    const superAdminToken = await createTestSupabaseToken({
      sub: SUPER_ADMIN_AUTH_ID,
      email: 'superadmin@kampus.pk',
    });

    // 1. Normal tenant admin attempts to access super admin overview
    const normalUserRes = await app.inject({
      method: 'GET',
      url: '/api/v1/saas/superadmin/overview',
      headers: {
        host: 'app.kampus.pk',
        authorization: `Bearer ${userToken}`,
      },
    });

    expect(normalUserRes.statusCode).toBe(403);
    const normalBody = JSON.parse(normalUserRes.body);
    expect(normalBody.success).toBe(false);
    expect(normalBody.error.code).toBe('FORBIDDEN');

    // 2. Platform Super Admin accesses the platform route
    const superAdminRes = await app.inject({
      method: 'GET',
      url: '/api/v1/saas/superadmin/overview',
      headers: {
        host: 'app.kampus.pk',
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(superAdminRes.statusCode).toBe(200);
    const superAdminBody = JSON.parse(superAdminRes.body);
    expect(superAdminBody.success).toBe(true);
    expect(superAdminBody.data).toBeDefined();
  });
});
