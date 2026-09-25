import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';

describe('Strict Class and Batch Deletion Integrity', () => {
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

  it('1. Blocks deletion of class when active students are enrolled', async () => {
    // Pick an existing program with students
    const programs = await store.getPrograms(tenantId);
    expect(programs.length).toBeGreaterThan(0);
    const progWithStudents = programs[0];

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/programs/${progWithStudents.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CLASS_HAS_STUDENTS');
    expect(body.error.message).toContain('currently enrolled');
  });

  it('2. Blocks deletion of batch when active students are assigned', async () => {
    const batches = await store.getBatches(tenantId);
    expect(batches.length).toBeGreaterThan(0);
    const batchWithStudents = batches[0];

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/batches/${batchWithStudents.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('BATCH_HAS_STUDENTS');
    expect(body.error.message).toContain('currently enrolled');
  });

  it('3. Safely deletes an empty class and cascades empty dependencies', async () => {
    // Create an empty class
    const emptyClass = await store.createProgram({
      tenant_id: tenantId,
      name: 'Class Temporary Empty',
      code: 'TMP-EMPTY',
      description: 'Temporary class for deletion test',
      sort_order: 99,
    });

    // Create an empty batch for this class
    const emptyBatch = await store.createBatch({
      tenant_id: tenantId,
      program_id: emptyClass.id,
      name: 'Section Alpha Empty',
      shift: 'morning',
      academic_session: '2026-2027',
      max_capacity: 30,
    });

    // Create an empty subject group for this class
    const emptyGroup = await store.createSubjectGroup({
      tenant_id: tenantId,
      program_id: emptyClass.id,
      name: 'Compulsory Group',
      type: 'compulsory',
      subject_ids: [],
    });

    // Verify they exist
    expect(store.programs.some(p => p.id === emptyClass.id)).toBe(true);
    expect(store.batches.some(b => b.id === emptyBatch.id)).toBe(true);
    expect(store.subjectGroups.some(g => g.id === emptyGroup.id)).toBe(true);

    // Now delete the empty class
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/programs/${emptyClass.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // Verify program and its child batches and groups are cleanly removed
    expect(store.programs.some(p => p.id === emptyClass.id)).toBe(false);
    expect(store.batches.some(b => b.id === emptyBatch.id)).toBe(false);
    expect(store.subjectGroups.some(g => g.id === emptyGroup.id)).toBe(false);
  });

  it('4. Safely deletes an empty section', async () => {
    // Create an empty batch under an existing program
    const programs = await store.getPrograms(tenantId);
    const emptyBatch = await store.createBatch({
      tenant_id: tenantId,
      program_id: programs[0].id,
      name: 'Section Beta Empty',
      shift: 'evening',
      academic_session: '2026-2027',
      max_capacity: 25,
    });

    expect(store.batches.some(b => b.id === emptyBatch.id)).toBe(true);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/batches/${emptyBatch.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    expect(store.batches.some(b => b.id === emptyBatch.id)).toBe(false);
  });
});
