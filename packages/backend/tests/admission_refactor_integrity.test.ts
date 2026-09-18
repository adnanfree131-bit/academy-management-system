import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fjwt from '@fastify/jwt';
import { InMemoryDataStore } from '../src/services/store.js';
import { sisRoutes } from '../src/routes/sis.ts';
import { financeRoutes } from '../src/routes/finance.ts';
import { authRoutes } from '../src/routes/auth.ts';
import { portalRoutes } from '../src/routes/portal.ts';
import { academicRoutes } from '../src/routes/academic.ts';
import { IMailerService } from '../src/services/mailer.js';
import { JWTPayload } from '@apex/shared-types';

describe('Student Admission Refactor & Bug Fixes: Verification', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let adminToken: string;
  const tenantId = 'a0000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    store = new InMemoryDataStore();

    app = Fastify();
    await app.register(fjwt, { secret: 'test-secret-key-1234567890123456' });

    app.decorate('authenticate', async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    });

    const mailer: IMailerService = {
      sendOTP: async () => true,
      sendCustom: async () => true,
    };
    await app.register(authRoutes(store, mailer), { prefix: '/api/v1/auth' });
    await app.register(sisRoutes(store), { prefix: '/api/v1/sis' });
    await app.register(financeRoutes(store), { prefix: '/api/v1/finance' });
    await app.register(portalRoutes(store), { prefix: '/api/v1/portal' });
    await app.register(academicRoutes(store), { prefix: '/api/v1/academic' });

    await app.ready();

    const payload: JWTPayload = {
      sub: 'admin-user-id',
      tenant_id: tenantId,
      email: 'admin@apexacademy.edu.pk',
      role: 'tenant_admin',
    };
    adminToken = app.jwt.sign(payload);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Manual roll_number is honored and persisted', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        roll_number: '2026-MED-888',
        full_name: 'Zainab Fatima',
        phone: '03001122334',
        father_name: 'Muhammad Tariq',
        father_cnic: '35201-1122334-1',
        father_phone: '03001122334',
        primary_contact: 'father',
        guardian_name: 'Muhammad Tariq',
        guardian_relation: 'Father',
        guardian_phone: '03001122334',
        program_id: targetBatch.program_id,
        batch_id: targetBatch.id,
        status: 'active',
        fee_structure: {
          base_tuition: 6000,
          net_tuition: 6000,
          concession_type: 'none',
          concession_val: 0,
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.roll_number).toBe('2026-MED-888');
  });

  it('2. Admission captures previous_school, religion, and submitted_documents', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];

    const documentsPayload = {
      B_FORM: 'submitted' as const,
      FATHER_CNIC: 'submitted' as const,
      PHOTOS: 'submitted' as const,
      SLC_ORIGINAL: 'pending' as const,
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        full_name: 'Danish Khan',
        phone: '03009988776',
        father_name: 'Aslam Khan',
        father_cnic: '35201-9988776-1',
        father_phone: '03009988776',
        primary_contact: 'father',
        guardian_name: 'Aslam Khan',
        guardian_relation: 'Father',
        guardian_phone: '03009988776',
        program_id: targetBatch.program_id,
        batch_id: targetBatch.id,
        previous_school: 'Lahore Grammar School',
        religion: 'Christian',
        submitted_documents: documentsPayload,
        status: 'active',
        fee_structure: {
          base_tuition: 7000,
          net_tuition: 7000,
          concession_type: 'none',
          concession_val: 0,
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.previous_school).toBe('Lahore Grammar School');
    expect(body.data.religion).toBe('Christian');
    expect(body.data.submitted_documents).toEqual(documentsPayload);
  });

  it('3. generate_first_month_invoice: false strictly prevents invoice creation', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        full_name: 'Amina Noor',
        phone: '03004455667',
        father_name: 'Rashid Noor',
        father_cnic: '35201-4455667-1',
        father_phone: '03004455667',
        primary_contact: 'father',
        guardian_name: 'Rashid Noor',
        guardian_relation: 'Father',
        guardian_phone: '03004455667',
        program_id: targetBatch.program_id,
        batch_id: targetBatch.id,
        generate_first_month_invoice: false,
        status: 'active',
        fee_structure: {
          base_tuition: 5000,
          net_tuition: 5000,
          concession_type: 'none',
          concession_val: 0,
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.first_invoice_id).toBeUndefined();
  });

  it('4. Mother as primary contact uses mother_cnic for guardian account linkage', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];
    const motherCnic = '35201-7788990-2';

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        full_name: 'Bilal Farooq',
        mother_name: 'Saima Farooq',
        mother_cnic: motherCnic,
        mother_phone: '03214433221',
        primary_contact: 'mother',
        guardian_name: 'Saima Farooq',
        guardian_relation: 'Mother',
        guardian_phone: '03214433221',
        program_id: targetBatch.program_id,
        batch_id: targetBatch.id,
        status: 'active',
        fee_structure: {
          base_tuition: 5500,
          net_tuition: 5500,
          concession_type: 'none',
          concession_val: 0,
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.guardian_id_card).toBe(motherCnic);

    // Verify parent login account exists for mother's CNIC
    const cleanCnic = motherCnic.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
    const allUsers = Array.from((store as any).users.values()) as any[];
    const parentUser = allUsers.find(u => u.tenant_id === tenantId && u.role === 'parent' && u.metadata?.clean_guardian_id_card === cleanCnic);
    expect(parentUser).toBeDefined();
    expect(parentUser?.role).toBe('parent');
    expect(parentUser?.full_name).toBe('Saima Farooq');
  });

  it('5. PATCH /students/:id updates previous_school, religion, and submitted_documents', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];

    // Create student first
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        full_name: 'Hamza Shahid',
        father_name: 'Shahid Mehmood',
        father_cnic: '35201-3344556-1',
        father_phone: '03003344556',
        primary_contact: 'father',
        guardian_name: 'Shahid Mehmood',
        guardian_relation: 'Father',
        guardian_phone: '03003344556',
        program_id: targetBatch.program_id,
        batch_id: targetBatch.id,
        status: 'active',
        fee_structure: {
          base_tuition: 5000,
          net_tuition: 5000,
          concession_type: 'none',
          concession_val: 0,
        },
      },
    });

    const studentId = JSON.parse(createRes.body).data.id;

    // Update with PATCH
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sis/students/${studentId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        previous_school: 'Divisional Public School (DPS)',
        religion: 'Muslim',
        submitted_documents: {
          B_FORM: 'submitted',
          FATHER_CNIC: 'submitted',
          SLC_ORIGINAL: 'exempted',
        },
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchBody = JSON.parse(patchRes.body);
    expect(patchBody.success).toBe(true);
    expect(patchBody.data.previous_school).toBe('Divisional Public School (DPS)');
    expect(patchBody.data.religion).toBe('Muslim');
    expect(patchBody.data.submitted_documents?.SLC_ORIGINAL).toBe('exempted');
  });

  it('6. Admission with inquiry_id updates inquiry stage to admitted', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];

    // Create an inquiry
    const inqRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/inquiries',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        student_name: 'Usman Ali',
        phone: '03112233445',
        guardian_name: 'Ali Raza',
        guardian_phone: '03112233445',
        guardian_id_card: '35201-9988112-1',
        source: 'Walk-in',
        priority: 'high',
      },
    });

    expect(inqRes.statusCode).toBe(201);
    const inqId = JSON.parse(inqRes.body).data.id;

    // Enroll with inquiry_id
    const admitRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        inquiry_id: inqId,
        full_name: 'Usman Ali',
        guardian_name: 'Ali Raza',
        guardian_phone: '03112233445',
        guardian_id_card: '35201-9988112-1',
        program_id: targetBatch.program_id,
        batch_id: targetBatch.id,
        status: 'active',
      },
    });

    expect(admitRes.statusCode).toBe(201);

    // Verify inquiry stage in store is now 'admitted'
    const inquiries = await store.getInquiries(tenantId);
    const updatedInq = inquiries.find(i => i.id === inqId);
    expect(updatedInq?.stage).toBe('admitted');
  });

  it('7. Roll number collision prevention rejects duplicate roll number in same batch', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];
    targetBatch.max_capacity = 100;

    // Enroll first student with manual roll number
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        roll_number: 'ROLL-UNIQ-01',
        full_name: 'Test Roll One',
        guardian_name: 'Parent One',
        guardian_phone: '03001230001',
        program_id: targetBatch.program_id,
        batch_id: targetBatch.id,
        status: 'active',
      },
    });
    expect(res1.statusCode).toBe(201);

    // Attempt to enroll second student in SAME batch with identical roll number
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        roll_number: 'ROLL-UNIQ-01',
        full_name: 'Test Roll Two',
        guardian_name: 'Parent Two',
        guardian_phone: '03001230002',
        program_id: targetBatch.program_id,
        batch_id: targetBatch.id,
        status: 'active',
      },
    });
    expect(res2.statusCode).toBe(400);
    const errBody = JSON.parse(res2.body);
    expect(errBody.error?.code).toBe('DUPLICATE_ROLL_NUMBER');
  });

  it('8. Bulk CSV import creates students with demographics and previous school', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];
    targetBatch.max_capacity = 100;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students/bulk-import',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        students: [
          {
            full_name: 'Bulk Student A',
            guardian_name: 'Bulk Father A',
            guardian_phone: '03009990001',
            guardian_id_card: '35201-9990001-1',
            batch_id: targetBatch.id,
            date_of_birth: '2010-05-15',
            gender: 'female',
            student_b_form: '35201-8880001-2',
            previous_school: 'City School Campus',
            religion: 'Muslim',
            residential_address: 'House 12, Street 3',
            city: 'Lahore',
            father_name: 'Bulk Father A',
            father_cnic: '35201-9990001-1',
            father_phone: '03009990001',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.imported_count).toBe(1);

    // Verify student records
    const students = await store.getStudents(tenantId);
    const imported = students.find(s => s.full_name === 'Bulk Student A');
    expect(imported).toBeDefined();
    expect(imported?.previous_school).toBe('City School Campus');
    expect(imported?.date_of_birth).toBe('2010-05-15');
    expect(imported?.gender).toBe('female');
    expect(imported?.student_b_form).toBe('35201-8880001-2');
    expect(imported?.city).toBe('Lahore');
  });
});
