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

  it('7. Direct Admission Form: POST /api/v1/sis/students with elective group and subjects', async () => {
    // Fetch programs and batches
    const batchRes = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/batches',
      headers: { authorization: `Bearer ${apexToken}` },
    });
    const batches = JSON.parse(batchRes.body).data;
    const fscBatch = batches.find((b: any) => b.name === 'FSc Morning - Alpha');
    expect(fscBatch).toBeDefined();

    const enrollRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        full_name: 'Zubair Hashmi QA',
        phone: '0333-8889911',
        email: 'zubair.qa@example.com',
        guardian_name: 'Hashmi Senior',
        guardian_phone: '0321-9988776',
        program_id: fscBatch.program_id,
        batch_id: fscBatch.id,
        elective_group_id: 'g2',
        subjects: ['s1', 's2', 's4'],
        custom_field_values: {
          blood_group: 'O+',
          bus_route: 'Route 2 - DHA',
          prev_school: 'Lahore Grammar School',
        },
      },
    });

    expect(enrollRes.statusCode).toBe(201);
    const newStudent = JSON.parse(enrollRes.body).data;
    expect(newStudent.full_name).toBe('Zubair Hashmi QA');
    expect(newStudent.admission_number).toMatch(/^ADM-2026-\d{3}$/);
    expect(newStudent.roll_number).toBeDefined();
    expect(newStudent.custom_field_values.blood_group).toBe('O+');
    expect(newStudent.subjects).toContain('s1');
  });

  it('8. Academic Management CRUD: Create and delete program, batch, and subject', async () => {
    // Create new Program
    const createProgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/programs',
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        name: 'Class 9 - Matric Science',
        code: 'CLS-09',
        description: 'Secondary School Certificate Grade 9',
        sort_order: 1,
      },
    });
    expect(createProgRes.statusCode).toBe(201);
    const createdProg = JSON.parse(createProgRes.body).data;
    expect(createdProg.name).toBe('Class 9 - Matric Science');

    // Create Batch for this Program
    const createBatchRes = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/batches',
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        program_id: createdProg.id,
        name: 'Section Alpha - Morning',
        shift: 'morning',
        academic_session: '2026-2027',
        max_capacity: 45,
        room_number: 'Room 102',
      },
    });
    expect(createBatchRes.statusCode).toBe(201);
    const createdBatch = JSON.parse(createBatchRes.body).data;
    expect(createdBatch.name).toBe('Section Alpha - Morning');

    // Create Subject
    const createSubRes = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/subjects',
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        name: 'Computer Science',
        code: 'CS-101',
        is_core: false,
      },
    });
    expect(createSubRes.statusCode).toBe(201);
    const createdSub = JSON.parse(createSubRes.body).data;

    // Delete Batch
    const delBatchRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/batches/${createdBatch.id}`,
      headers: { authorization: `Bearer ${apexToken}` },
    });
    expect(delBatchRes.statusCode).toBe(200);

    // Delete Program
    const delProgRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/programs/${createdProg.id}`,
      headers: { authorization: `Bearer ${apexToken}` },
    });
    expect(delProgRes.statusCode).toBe(200);

    // Delete Subject
    const delSubRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/subjects/${createdSub.id}`,
      headers: { authorization: `Bearer ${apexToken}` },
    });
    expect(delSubRes.statusCode).toBe(200);
  });

  it('9. Interconnected Hierarchy: Subject group creation, retrieval by program_id, and deletion', async () => {
    // Create new Track Group for program
    const createGroupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/groups',
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        program_id: 'p1',
        name: 'Computer Science (ICS Track)',
        type: 'elective_track',
        subject_ids: ['s1', 's2'],
      },
    });
    expect(createGroupRes.statusCode).toBe(201);
    const createdGroup = JSON.parse(createGroupRes.body).data;
    expect(createdGroup.name).toBe('Computer Science (ICS Track)');

    // Query groups by program_id
    const queryGroupsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/groups?program_id=p1',
      headers: { authorization: `Bearer ${apexToken}` },
    });
    expect(queryGroupsRes.statusCode).toBe(200);
    const groups = JSON.parse(queryGroupsRes.body).data;
    expect(groups.some((g: any) => g.id === createdGroup.id)).toBe(true);

    // Delete group
    const delGroupRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/groups/${createdGroup.id}`,
      headers: { authorization: `Bearer ${apexToken}` },
    });
    expect(delGroupRes.statusCode).toBe(200);
  });
});
