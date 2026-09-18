import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';

describe('Academic Hierarchy: Permanent Class & Batch Deletion & No Resurrection', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let adminToken: string;
  const tenantId = 'a0000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    store = new InMemoryDataStore();
    app = await buildApp({ store, jwtSecret: 'test-secret-min-32-chars-long-for-vitest' });
    await app.ready();

    adminToken = app.jwt.sign({
      sub: 'u0000000-0000-0000-0000-000000000001',
      tenant_id: tenantId,
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Fetches initial programs and confirms classes exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('2. Deletes each program and verifies cascade deletion of sections and groups', async () => {
    // First get all programs
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const programs = JSON.parse(res.body).data;

    for (const prog of programs) {
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/academic/programs/${prog.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(delRes.statusCode).toBe(200);
      const delBody = JSON.parse(delRes.body);
      expect(delBody.success).toBe(true);
    }

    // Now verify programs list is completely empty
    const checkRes = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(checkRes.statusCode).toBe(200);
    const checkBody = JSON.parse(checkRes.body);
    expect(checkBody.success).toBe(true);
    expect(checkBody.data.length).toBe(0);

    // Verify child batches belonging to deleted programs are also gone
    const batches = await store.getBatches(tenantId);
    expect(batches.length).toBe(0);

    // Verify child subject groups belonging to deleted programs are also gone
    const groups = await store.getSubjectGroups(tenantId);
    expect(groups.length).toBe(0);
  });

  it('3. Repeated GET /programs remains empty and NEVER resurrects hardcoded classes', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    }
  });

  it('4. Administrator can create their own custom classes cleanly', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/programs',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Grade 9 - SSC I',
        code: 'G9-SSC1',
        description: 'Secondary School Part 1',
        sort_order: 1,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body).data;
    expect(created.name).toBe('Grade 9 - SSC I');

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const progs = JSON.parse(getRes.body).data;
    expect(progs.length).toBe(1);
    expect(progs[0].name).toBe('Grade 9 - SSC I');
  });
});
