import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';

describe('Staff & Faculty Management Module: End-to-End API Verification', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let apexToken: string;
  let crescentToken: string;
  let createdStaffId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    store = new InMemoryDataStore();
    app = await buildApp({ store, jwtSecret: 'test-secret-min-32-chars-long-for-vitest' });
    await app.ready();

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

  it('1. POST /api/v1/academic/staff creates staff with full dossier and auto-generated employee_code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/staff',
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        full_name: 'Professor Rashid Minhas',
        email: 'rashid.minhas@apexacademy.edu.pk',
        phone: '03001234567',
        father_or_spouse_name: 'Abdul Rehman',
        cnic: '37405-1234567-1',
        gender: 'male',
        dob: '1985-04-12',
        whatsapp: '03001234567',
        emergency_contact: '03219876543',
        emergency_relation: 'Brother',
        address: 'House 42, Street 7, Islamabad',
        department: 'Science',
        designation: 'Senior Physics Lecturer',
        employment_type: 'permanent',
        joining_date: '2026-01-15',
        qualification: 'M.Phil Physics (QAU)',
        experience_years: 10,
        base_salary: 85000,
        bank_name: 'Meezan Bank Ltd',
        bank_account_title: 'Rashid Minhas',
        bank_account_number: '01020304050607',
        bank_iban: 'PK36MEZN0001020304050607',
        permissions: ['attendance', 'homework', 'examination'],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.full_name).toBe('Professor Rashid Minhas');
    expect(body.data.employee_code).toMatch(/^EMP-\d{4}$/);
    expect(body.data.department).toBe('Science');
    expect(body.data.base_salary).toBe(85000);
    expect(body.data.bank_name).toBe('Meezan Bank Ltd');
    expect(body.data.status).toBe('active');
    expect(body.temporary_password).toBeDefined();

    createdStaffId = body.data.id;
  });

  it('2. GET /api/v1/academic/staff filters by search query and department', async () => {
    // Search by name
    const searchRes = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/staff?search=Rashid',
      headers: { authorization: `Bearer ${apexToken}` },
    });
    expect(searchRes.statusCode).toBe(200);
    const searchBody = JSON.parse(searchRes.body);
    expect(searchBody.data.length).toBe(1);
    expect(searchBody.data[0].id).toBe(createdStaffId);

    // Filter by department
    const deptRes = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/staff?department=Science',
      headers: { authorization: `Bearer ${apexToken}` },
    });
    expect(deptRes.statusCode).toBe(200);
    const deptBody = JSON.parse(deptRes.body);
    expect(deptBody.data.some((s: any) => s.id === createdStaffId)).toBe(true);
  });

  it('3. PUT /api/v1/academic/staff/:id updates personal, qualifications, and compensation fields', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/academic/staff/${createdStaffId}`,
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        full_name: 'Professor Rashid Minhas (HOD)',
        designation: 'Head of Physics Department',
        base_salary: 95000,
        experience_years: 11,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.full_name).toBe('Professor Rashid Minhas (HOD)');
    expect(body.data.designation).toBe('Head of Physics Department');
    expect(body.data.base_salary).toBe(95000);
    expect(body.data.experience_years).toBe(11);
  });

  it('4. PUT /api/v1/academic/staff/:id/teaching-assignments persists assigned classes & subjects', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/academic/staff/${createdStaffId}/teaching-assignments`,
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        assignments: [
          {
            program_id: 'prog-1',
            program_name: 'Class 10 Matric',
            batch_id: 'batch-1',
            batch_name: 'Class 10 - Batch A',
            subject_id: 'sub-physics',
            subject_name: 'Physics',
            weekly_periods: 6,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.teaching_assignments.length).toBe(1);
    expect(body.data.teaching_assignments[0].subject_name).toBe('Physics');
  });

  it('5. PATCH /api/v1/academic/staff/:id/access updates portal permissions', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/academic/staff/${createdStaffId}/access`,
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        permissions: ['attendance', 'homework', 'examination', 'communication'],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.permissions).toContain('communication');
  });

  it('6. POST /api/v1/academic/staff/:id/reset-password resets credentials and returns temporary password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/academic/staff/${createdStaffId}/reset-password`,
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.temporary_password).toBeDefined();
    expect(body.temporary_password.length).toBeGreaterThanOrEqual(8);
  });

  it('7. POST /api/v1/academic/staff/:id/archive soft-archives staff member and sets status to archived', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/academic/staff/${createdStaffId}/archive`,
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        reason: 'Relieved on personal request',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('archived');
  });

  it('8. POST /api/v1/academic/staff/:id/restore restores archived staff member to active', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/academic/staff/${createdStaffId}/restore`,
      headers: { authorization: `Bearer ${apexToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('active');
  });

  it('9. DELETE /api/v1/academic/staff/:id prevents deletion when linked financial or exam records exist', async () => {
    // Attach a financial transaction recorded by this staff member
    await store.createFinancialTransaction({
      tenant_id: 'a0000000-0000-0000-0000-000000000001',
      date: '2026-09-10',
      type: 'income',
      account_head_id: 'ah-1',
      account_head_name: 'Tuition Fee',
      amount: 5000,
      payment_method: 'cash',
      recorded_by: createdStaffId,
      description: 'Test fee payment voucher',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/staff/${createdStaffId}`,
      headers: { authorization: `Bearer ${apexToken}` },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('STAFF_DELETE_BLOCKED');
    expect(body.error.message).toContain('financial vouchers');
  });

  it('10. DELETE /api/v1/academic/staff/:id successfully deletes a clean staff member with no linked records', async () => {
    // Create a temporary unlinked staff member
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/staff',
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        full_name: 'Temporary Lab Assistant',
        email: 'temp.assistant@apexacademy.edu.pk',
        department: 'Science',
        designation: 'Lab Assistant',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const tempId = JSON.parse(createRes.body).data.id;

    // Hard delete
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/staff/${tempId}`,
      headers: { authorization: `Bearer ${apexToken}` },
    });

    expect(deleteRes.statusCode).toBe(200);
    const body = JSON.parse(deleteRes.body);
    expect(body.success).toBe(true);

    // Verify staff no longer appears
    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/v1/academic/staff?search=temp.assistant`,
      headers: { authorization: `Bearer ${apexToken}` },
    });
    expect(JSON.parse(verifyRes.body).data.length).toBe(0);
  });

  it('11. Tenant isolation: Crescent Academy cannot view or mutate Apex staff', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/academic/staff?search=Rashid`,
      headers: { authorization: `Bearer ${crescentToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBe(0);
  });

  it('12. Blood group persistence and retrieval via POST and PUT', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/staff',
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        full_name: 'Dr. Ayesha Siddiqa',
        email: 'ayesha.siddiqa@apexacademy.edu.pk',
        department: 'Science',
        designation: 'Senior Biology Lecturer',
        blood_group: 'O+',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body).data;
    expect(created.blood_group).toBe('O+');

    // Update blood group
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/academic/staff/${created.id}`,
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        blood_group: 'AB-',
      },
    });

    expect(updateRes.statusCode).toBe(200);
    expect(JSON.parse(updateRes.body).data.blood_group).toBe('AB-');
  });

  it('13. Enforces unique employee_code per tenant on creation and update', async () => {
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/staff',
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        full_name: 'Tariq Mehmood',
        email: 'tariq.mehmood@apexacademy.edu.pk',
        employee_code: 'EMP-9999',
      },
    });
    expect(res1.statusCode).toBe(201);

    // Attempt duplicate employee_code on create
    const duplicateCreateRes = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/staff',
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        full_name: 'Usman Ali',
        email: 'usman.ali@apexacademy.edu.pk',
        employee_code: 'EMP-9999',
      },
    });
    expect(duplicateCreateRes.statusCode).toBe(400);
    const duplicateBody = JSON.parse(duplicateCreateRes.body);
    expect(duplicateBody.error.code).toBe('STAFF_CREATE_FAILED');
    expect(duplicateBody.error.message).toContain('already assigned');

    // Attempt duplicate employee_code on update
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/staff',
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        full_name: 'Usman Ali',
        email: 'usman.ali@apexacademy.edu.pk',
        employee_code: 'EMP-8888',
      },
    });
    expect(res2.statusCode).toBe(201);
    const staff2Id = JSON.parse(res2.body).data.id;

    const duplicateUpdateRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/academic/staff/${staff2Id}`,
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        employee_code: 'EMP-9999',
      },
    });
    expect(duplicateUpdateRes.statusCode).toBe(400);
    expect(JSON.parse(duplicateUpdateRes.body).error.code).toBe('STAFF_UPDATE_FAILED');
  });

  it('14. Disallows password reset on tenant_admin account via staff reset endpoint', async () => {
    const adminRes = await app.inject({
      method: 'POST',
      url: `/api/v1/academic/staff/u0000000-0000-0000-0000-000000000001/reset-password`,
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {},
    });

    expect(adminRes.statusCode).toBe(404);
    expect(JSON.parse(adminRes.body).error.code).toBe('NOT_FOUND');
  });

  it('15. Archived staff JWT token is immediately rejected with HTTP 403 ACCOUNT_ARCHIVED', async () => {
    // Create staff member
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/staff',
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        full_name: 'Zahid Hassan',
        email: 'zahid.hassan@apexacademy.edu.pk',
      },
    });
    const staff = JSON.parse(createRes.body).data;

    // Sign JWT token for this staff
    const staffToken = app.jwt.sign({
      sub: staff.id,
      tenant_id: 'a0000000-0000-0000-0000-000000000001',
      email: staff.email,
      role: 'teacher',
    });

    // Verify token works while active on an accessible endpoint
    const activeReq = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(activeReq.statusCode).toBe(200);

    // Archive staff member
    const archiveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/academic/staff/${staff.id}/archive`,
      headers: { authorization: `Bearer ${apexToken}` },
      payload: { reason: 'Resigned' },
    });
    expect(archiveRes.statusCode).toBe(200);

    // Verify subsequent request with unexpired token is rejected with 403 ACCOUNT_ARCHIVED
    const archivedReq = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(archivedReq.statusCode).toBe(403);
    const archivedBody = JSON.parse(archivedReq.body);
    expect(archivedBody.error.code).toBe('ACCOUNT_ARCHIVED');
    expect(archivedBody.error.message).toContain('archived');
  });

  it('16. DELETE /api/v1/academic/staff/:id is blocked if staff marked student attendance records', async () => {
    // Create staff member
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/staff',
      headers: { authorization: `Bearer ${apexToken}` },
      payload: {
        full_name: 'Naveed Akhtar',
        email: 'naveed.akhtar@apexacademy.edu.pk',
      },
    });
    const staff = JSON.parse(createRes.body).data;

    // Mark attendance with this staff ID
    await store.recordBatchAttendance(
      'a0000000-0000-0000-0000-000000000001',
      'batch-1',
      '2026-09-10',
      [{ student_id: 'std-1', status: 'present' }],
      staff.id
    );

    // Attempt to delete staff
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/staff/${staff.id}`,
      headers: { authorization: `Bearer ${apexToken}` },
    });
    expect(deleteRes.statusCode).toBe(400);
    const body = JSON.parse(deleteRes.body);
    expect(body.error.code).toBe('STAFF_DELETE_BLOCKED');
    expect(body.error.message).toContain('student attendance');
  });
});
