import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';

describe('Phase 2: Academic Hierarchy, Custom Form Fields, Inquiries & SIS API', () => {
  let app: FastifyInstance;
  let apexToken: string;
  let crescentToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const store = new InMemoryDataStore();
    app = await buildApp({ store, jwtSecret: 'test-secret-min-32-chars-long-for-vitest' });
    await app.ready();

    // Sign JWT tokens directly for Apex and Crescent tenant admins
    apexToken = app.jwt.sign({
      sub: 'u0000000-0000-0000-0000-000000000001',
      tenant_id: 'a0000000-0000-0000-0000-000000000001',
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin',
    });

    crescentToken = app.jwt.sign({
      sub: 'u0000000-0000-0000-0000-000000000002',
      tenant_id: 'b0000000-0000-0000-0000-000000000002',
      email: 'principal@crescent.edu.pk',
      role: 'tenant_admin',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. GET /api/v1/academic/programs returns seeded programs for Apex', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: { authorization: `Bearer ${apexToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    expect(body.data.some((p: any) => p.name === 'FSc Pre-Engineering')).toBe(true);
  });

  it('2. Tenant isolation: Crescent sees its own programs, not Apex programs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: { authorization: `Bearer ${crescentToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe('O-Level Science Track');
  });

  it('3. GET /api/v1/academic/subjects and /groups returns subject hierarchy', async () => {
    const subRes = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/subjects',
      headers: { authorization: `Bearer ${apexToken}` },
    });
    expect(subRes.statusCode).toBe(200);
    const subjects = JSON.parse(subRes.body).data;
    expect(subjects.length).toBeGreaterThanOrEqual(4);

    const groupRes = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/groups',
      headers: { authorization: `Bearer ${apexToken}` },
    });
    expect(groupRes.statusCode).toBe(200);
    const groups = JSON.parse(groupRes.body).data;
    expect(groups.some((g: any) => g.type === 'compulsory')).toBe(true);
    expect(groups.some((g: any) => g.type === 'elective_track')).toBe(true);
  });

  it('4. Dynamic Form Builder: GET /api/v1/academic/custom-fields returns tenant configured fields', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/custom-fields?entity_type=student',
      headers: { authorization: `Bearer ${apexToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.some((f: any) => f.field_key === 'blood_group')).toBe(true);
    expect(body.data.some((f: any) => f.field_key === 'transport_route')).toBe(true);
  });

  it('5. Inquiries Desk: POST inquiry and PATCH stage progression', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/inquiries',
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        student_name: 'Zayn Malik',
        phone: '0300-1112233',
        email: 'zayn@example.com',
        guardian_name: 'Yaser Malik',
        notes: 'Interested in evening pre-engineering batch',
        source: 'Walk-in',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const inq = JSON.parse(createRes.body).data;
    expect(inq.inquiry_number).toMatch(/^INQ-2026-\d{3}$/);
    expect(inq.stage).toBe('new');

    // Progress stage to fee_discussion
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sis/inquiries/${inq.id}/stage`,
      headers: { authorization: `Bearer ${apexToken}` },
      payload: { stage: 'fee_discussion' },
    });

    expect(patchRes.statusCode).toBe(200);
    const updated = JSON.parse(patchRes.body).data;
    expect(updated.stage).toBe('fee_discussion');
  });

  it('6. 1-Click Admit: Admits inquiry into batch, updates stage and generates student record', async () => {
    // Get Apex batches
    const batchRes = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/batches',
      headers: { authorization: `Bearer ${apexToken}` },
    });
    const batches = JSON.parse(batchRes.body).data;
    const morningBatch = batches.find((b: any) => b.name === 'Batch 2026-A');
    expect(morningBatch).toBeDefined();

    // Create a new inquiry to admit
    const inqRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/inquiries',
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        student_name: 'Ayla Tariq',
        phone: '0321-9988776',
        guardian_name: 'Tariq Mehmood',
      },
    });
    const inquiry = JSON.parse(inqRes.body).data;

    // 1-Click Admit
    const admitRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sis/inquiries/${inquiry.id}/admit`,
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        batch_id: morningBatch.id,
      },
    });

    expect(admitRes.statusCode).toBe(201);
    const student = JSON.parse(admitRes.body).data;
    expect(student.full_name).toBe('Ayla Tariq');
    expect(student.admission_number).toMatch(/^ADM-2026-\d{3}$/);
    expect(student.roll_number).toBeDefined();
    expect(student.batch_id).toBe(morningBatch.id);
    expect(student.subjects.length).toBeGreaterThanOrEqual(1);

    // Verify student is in GET /api/v1/sis/students
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/sis/students',
      headers: { authorization: `Bearer ${apexToken}` },
    });
    const students = JSON.parse(listRes.body).data;
    expect(students.some((s: any) => s.id === student.id)).toBe(true);
  });
});
