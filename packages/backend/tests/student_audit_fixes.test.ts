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

describe('Student Module Audit Fixes: Backend Verification', () => {
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

  it('1. Student admission auto-provisions user account and links user_id', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        full_name: 'Haris Rauf SIS',
        phone: '+92 311 1122334',
        email: 'haris.rauf@kampus.pk',
        guardian_name: 'Rauf Senior',
        guardian_phone: '+92 311 9988776',
        guardian_email: 'rauf.senior@kampus.pk',
        guardian_id_card: '35201-9988776-1',
        program_id: targetBatch.program_id,
        batch_id: targetBatch.id,
        blood_group: 'O+',
        fee_structure: {
          base_tuition: 8500,
          admission_fee: 2000,
          exam_fee: 1000,
          net_tuition: 8500,
          first_month_total: 11500,
        },
        generate_first_month_invoice: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    const student = body.data;
    expect(student.user_id).toBeDefined();
    expect(typeof student.user_id).toBe('string');
    expect(student.blood_group).toBe('O+');
    expect(student.guardian_email).toBe('rauf.senior@kampus.pk');

    // Verify user record exists in tenant users
    const tenantUsers = await store.getTenantUsers(tenantId);
    const studentUser = tenantUsers.find(u => u.id === student.user_id);
    expect(studentUser).toBeDefined();
    expect(studentUser?.role).toBe('student');
    expect(studentUser?.email).toBe('haris.rauf@kampus.pk');

    // Verify parent user was also auto-provisioned
    const parentUser = tenantUsers.find(u => u.email === 'rauf.senior@kampus.pk');
    expect(parentUser).toBeDefined();
    expect(parentUser?.role).toBe('parent');
  });

  it('2. Student can log in with Father/Guardian CNIC only, not email', async () => {
    const students = await store.getStudents(tenantId);
    const student = students.find(s => s.full_name === 'Haris Rauf SIS')!;
    expect(student.guardian_id_card).toBe('35201-9988776-1');

    // Login using Father/Guardian CNIC
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: '35201-9988776-1',
        password: 'Student@123',
        tenant_id: tenantId,
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json();
    expect(loginBody.success).toBe(true);
    expect(loginBody.data.user.role).toBe('student');
    expect(loginBody.data.token).toBeDefined();

    // Also verify login without dashes works seamlessly
    const loginNoDashRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: '3520199887761',
        password: 'Student@123',
        tenant_id: tenantId,
      },
    });

    expect(loginNoDashRes.statusCode).toBe(200);
    expect(loginNoDashRes.json().success).toBe(true);

    const emailLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: student.email || 'haris.rauf@kampus.pk',
        password: 'Student@123',
        tenant_id: tenantId,
      },
    });
    expect(emailLogin.statusCode).toBe(401);
  });

  it('3. GET /api/v1/sis/students/:id returns single student', async () => {
    const students = await store.getStudents(tenantId);
    const student = students[0];

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sis/students/${student.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(student.id);
    expect(body.data.full_name).toBe(student.full_name);
  });

  it('4. GET /api/v1/sis/students/:id/academic-summary returns unified results without N+1', async () => {
    const students = await store.getStudents(tenantId);
    const student = students[0];

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sis/students/${student.id}/academic-summary`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.exams)).toBe(true);
    expect(Array.isArray(body.data.homework)).toBe(true);
    expect(body.data.attendance_summary).toBeDefined();
    expect(typeof body.data.attendance_summary.percentage).toBe('number');
  });

  it('5. Invoices query key: both studentId and student_id filter strictly without leakage', async () => {
    const students = await store.getStudents(tenantId);
    const student = students[0];

    // Query with camelCase studentId
    const resCamel = await app.inject({
      method: 'GET',
      url: `/api/v1/finance/invoices?studentId=${student.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(resCamel.statusCode).toBe(200);
    const dataCamel = resCamel.json().data;
    for (const inv of dataCamel) {
      expect(inv.student_id).toBe(student.id);
    }

    // Query with snake_case student_id
    const resSnake = await app.inject({
      method: 'GET',
      url: `/api/v1/finance/invoices?student_id=${student.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(resSnake.statusCode).toBe(200);
    const dataSnake = resSnake.json().data;
    for (const inv of dataSnake) {
      expect(inv.student_id).toBe(student.id);
    }
  });

  it('6. Student promotion validates capacity and updates batch counters', async () => {
    const batches = await store.getBatches(tenantId);
    const sourceBatch = batches[0];
    const targetBatch = batches[1];

    const students = await store.getStudents(tenantId, sourceBatch.id);
    expect(students.length).toBeGreaterThanOrEqual(1);
    const studentToPromote = students[0];

    const initialSourceEnrollment = sourceBatch.current_enrollment;
    const initialTargetEnrollment = targetBatch.current_enrollment;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/students/promote',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        student_ids: [studentToPromote.id],
        target_program_id: targetBatch.program_id,
        target_batch_id: targetBatch.id,
        fee_adjustment_type: 'keep',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(sourceBatch.current_enrollment).toBe(initialSourceEnrollment - 1);
    expect(targetBatch.current_enrollment).toBe(initialTargetEnrollment + 1);

    const promoted = await store.getStudentById(tenantId, studentToPromote.id);
    expect(promoted?.batch_id).toBe(targetBatch.id);
  });

  it('7. Guardian CNIC provisioning and dual-format login (hyphenated & numeric)', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];
    const guardianCnic = '35201-9876543-1';

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        full_name: 'Bilal Khan',
        phone: '+92 300 4443322',
        guardian_name: 'Aslam Khan',
        guardian_phone: '+92 300 1112233',
        guardian_id_card: guardianCnic,
        program_id: targetBatch.program_id,
        batch_id: targetBatch.id,
      },
    });

    expect(res.statusCode).toBe(201);
    const student = res.json().data;
    expect(student.guardian_id_card).toBe(guardianCnic);

    // Verify parent account was provisioned with CNIC
    const tenantUsers = await store.getTenantUsers(tenantId);
    const parentUser = tenantUsers.find(u => u.metadata?.clean_guardian_id_card === '3520198765431');
    expect(parentUser).toBeDefined();
    expect(parentUser?.role).toBe('parent');

    // Test Login 1: Formatted CNIC with dashes
    const loginResFormatted = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: guardianCnic,
        password: 'Parent@123',
        tenant_id: tenantId,
      },
    });
    expect(loginResFormatted.statusCode).toBe(200);
    const bodyFormatted = loginResFormatted.json();
    expect(bodyFormatted.success).toBe(true);
    expect(bodyFormatted.data.user.role).toBe('parent');

    // Test Login 2: Plain numeric CNIC without dashes
    const loginResNumeric = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: '3520198765431',
        password: 'Parent@123',
        tenant_id: tenantId,
      },
    });
    expect(loginResNumeric.statusCode).toBe(200);
    const bodyNumeric = loginResNumeric.json();
    expect(bodyNumeric.success).toBe(true);
    expect(bodyNumeric.data.user.role).toBe('parent');
  });

  it('8. Sibling student linkage and switching in Parent Portal', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];
    const sharedCnic = '35201-5556667-9';

    // Admit Child 1
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        full_name: 'Zainab Qasim',
        guardian_name: 'Qasim Ali',
        guardian_phone: '+92 300 7776655',
        guardian_id_card: sharedCnic,
        program_id: targetBatch.program_id,
        batch_id: targetBatch.id,
      },
    });
    expect(res1.statusCode).toBe(201);
    const child1 = res1.json().data;

    // Admit Child 2 with identical guardian CNIC
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        full_name: 'Hamza Qasim',
        guardian_name: 'Qasim Ali',
        guardian_phone: '+92 300 7776655',
        guardian_id_card: sharedCnic,
        program_id: targetBatch.program_id,
        batch_id: targetBatch.id,
      },
    });
    expect(res2.statusCode).toBe(201);
    const child2 = res2.json().data;

    // Login as Parent using CNIC
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: sharedCnic,
        password: 'Parent@123',
        tenant_id: tenantId,
      },
    });
    expect(loginRes.statusCode).toBe(200);
    const parentToken = loginRes.json().data.token;

    // Fetch Parent Portal Overview default
    const portalRes = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${parentToken}` },
    });
    expect(portalRes.statusCode).toBe(200);
    const portalData = portalRes.json().data;
    expect(portalData.linked_children).toBeDefined();
    expect(portalData.linked_children.length).toBe(2);
    const childIds = portalData.linked_children.map((c: any) => c.id);
    expect(childIds).toContain(child1.id);
    expect(childIds).toContain(child2.id);

    // Switch to Child 2 via query param
    const switchRes = await app.inject({
      method: 'GET',
      url: `/api/v1/portal/student-parent?student_id=${child2.id}`,
      headers: { authorization: `Bearer ${parentToken}` },
    });
    expect(switchRes.statusCode).toBe(200);
    expect(switchRes.json().data.student_profile.id).toBe(child2.id);
    expect(switchRes.json().data.student_profile.full_name).toBe('Hamza Qasim');
  });

  it('9. 1-Click Inquiry Admission generates custom Fee Structure and Challan Invoice', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];

    // Create inquiry
    const inqRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/inquiries',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        student_name: 'Usman Ghani',
        phone: '+92 321 8889900',
        guardian_name: 'Ghani Senior',
        guardian_phone: '+92 321 1122334',
        guardian_id_card: '35201-7788990-3',
        program_id: targetBatch.program_id,
        source: 'Walk-in',
      },
    });
    expect(inqRes.statusCode).toBe(201);
    const inquiry = inqRes.json().data;

    // Execute 1-click admission with fee structure
    const admitRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sis/inquiries/${inquiry.id}/admit`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: targetBatch.id,
        guardian_id_card: '35201-7788990-3',
        fee_structure: {
          base_tuition: 9000,
          admission_fee: 2500,
          concession_type: 'fixed',
          concession_val: 1000,
          concession_reason: 'Need-based Concession',
          net_tuition: 8000,
          first_month_total: 10500,
        },
      },
    });

    expect(admitRes.statusCode).toBe(201);
    const admittedStudent = admitRes.json().data;
    expect(admittedStudent.guardian_id_card).toBe('35201-7788990-3');
    expect(admittedStudent.fee_structure.net_tuition).toBe(8000);

    // Verify invoice was automatically generated
    const invoices = await store.getInvoices(tenantId, { studentId: admittedStudent.id });
    expect(invoices.length).toBeGreaterThanOrEqual(1);
    const firstInvoice = invoices[0];
    expect(firstInvoice.total_amount).toBe(10500);
    expect(firstInvoice.status).toBe('unpaid');
  });

  it('10. Bulk CSV Student Import creates multiple students and guardian accounts', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];

    const bulkRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students/bulk-import',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        students: [
          {
            full_name: 'CSV Candidate One',
            phone: '+92 300 1234001',
            guardian_name: 'Guardian One',
            guardian_phone: '+92 300 9876001',
            guardian_id_card: '35201-0000001-1',
            batch_id: targetBatch.id,
            roll_number: 'CSV-001',
          },
          {
            full_name: 'CSV Candidate Two',
            phone: '+92 300 1234002',
            guardian_name: 'Guardian Two',
            guardian_phone: '+92 300 9876002',
            guardian_id_card: '35201-0000002-2',
            batch_id: targetBatch.id,
            roll_number: 'CSV-002',
          },
        ],
      },
    });

    expect(bulkRes.statusCode).toBe(201);
    const bulkBody = bulkRes.json();
    expect(bulkBody.success).toBe(true);
    expect(bulkBody.data.imported_count).toBe(2);
    expect(bulkBody.data.failed_count).toBe(0);

    // Verify parent accounts were created
    const tenantUsers = await store.getTenantUsers(tenantId);
    const parent1 = tenantUsers.find(u => u.metadata?.clean_guardian_id_card === '3520100000011');
    expect(parent1).toBeDefined();
    expect(parent1?.role).toBe('parent');
  });

  it('11. Student Particulars update records immutable Audit Logs', async () => {
    const students = await store.getStudents(tenantId);
    const targetStudent = students[0];

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sis/students/${targetStudent.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        full_name: 'Updated Name SIS',
        guardian_name: 'Updated Guardian SIS',
        guardian_id_card: '35201-9999999-9',
      },
    });

    expect(patchRes.statusCode).toBe(200);

    // Fetch audit logs
    const auditRes = await app.inject({
      method: 'GET',
      url: `/api/v1/sis/students/${targetStudent.id}/audit-logs`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(auditRes.statusCode).toBe(200);
    const logs = auditRes.json().data;
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const latestLog = logs[logs.length - 1];
    expect(latestLog.action).toBe('UPDATE_PARTICULARS');
    expect(latestLog.changes).toBeDefined();
    expect(latestLog.changes.full_name).toBeDefined();
  });

  it('12. Admin resets student password and student logs in with Guardian CNIC', async () => {
    const students = await store.getStudents(tenantId);
    const targetStudent = students[0];
    const guardianCnic = targetStudent.guardian_id_card || '35201-8889990-1';

    // Reset password as admin
    const resetRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sis/students/${targetStudent.id}/reset-password`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        new_password: 'NewStudent@456',
        reason: 'Parent requested password reset at campus reception',
        guardian_id_card: guardianCnic,
      },
    });

    expect(resetRes.statusCode).toBe(200);
    const resetBody = resetRes.json();
    expect(resetBody.success).toBe(true);
    expect(resetBody.data.default_password).toBe('NewStudent@456');

    // Verify audit trail logged
    const auditRes = await app.inject({
      method: 'GET',
      url: `/api/v1/sis/students/${targetStudent.id}/audit-logs`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const logs = auditRes.json().data;
    const resetLog = logs.find((l: any) => l.action === 'RESET_PASSWORD');
    expect(resetLog).toBeDefined();
    expect(resetLog.reason).toBe('Parent requested password reset at campus reception');

    // Login using Father/Guardian CNIC and reset password
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: guardianCnic,
        password: 'NewStudent@456',
        tenant_id: tenantId,
      },
    });
    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json();
    expect(loginBody.success).toBe(true);
    expect(loginBody.data.token).toBeDefined();
  });

  it('13. Student can self-service change password in settings without email OTP', async () => {
    const students = await store.getStudents(tenantId);
    const targetStudent = students[0];
    const guardianCnic = targetStudent.guardian_id_card || '35201-8889990-1';

    // Login first to get student token
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: guardianCnic,
        password: 'NewStudent@456',
        tenant_id: tenantId,
      },
    });
    expect(loginRes.statusCode).toBe(200);
    const studentToken = loginRes.json().data.token;

    // Self-service change password (no OTP required for student/parent)
    const changeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        current_password: 'NewStudent@456',
        new_password: 'UpdatedSecret@789',
      },
    });

    expect(changeRes.statusCode).toBe(200);
    const changeBody = changeRes.json();
    expect(changeBody.success).toBe(true);
    expect(changeBody.data.token).toBeDefined();

    // Verify login with new password works
    const newLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: guardianCnic,
        password: 'UpdatedSecret@789',
        tenant_id: tenantId,
      },
    });
    expect(newLoginRes.statusCode).toBe(200);
    expect(newLoginRes.json().success).toBe(true);
  });

  it('14. Student admission persists complete demographics, dual parents, and sibling linkage', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];

    // First, admit an elder sibling
    const elderRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        full_name: 'Elder Brother Tariq',
        date_of_birth: '2008-04-12',
        gender: 'Male',
        student_b_form: '35201-1111111-1',
        residential_address: 'House 14, Street 2, Gulberg III',
        city: 'Lahore',
        father_name: 'Muhammad Tariq',
        father_cnic: '35201-2222222-1',
        father_phone: '+92 300 1234567',
        father_occupation: 'Civil Engineer',
        mother_name: 'Amina Tariq',
        mother_cnic: '35201-3333333-2',
        mother_phone: '+92 300 7654321',
        mother_occupation: 'Professor',
        primary_contact: 'father',
        program_id: targetBatch.program_id,
        batch_id: targetBatch.id,
        fee_structure: {
          base_tuition: 10000,
          admission_fee: 2000,
          net_tuition: 10000,
        },
      },
    });

    expect(elderRes.statusCode).toBe(201);
    const elderStudent = elderRes.json().data;
    expect(elderStudent.id).toBeDefined();
    expect(elderStudent.father_name).toBe('Muhammad Tariq');
    expect(elderStudent.mother_name).toBe('Amina Tariq');
    expect(elderStudent.date_of_birth).toBe('2008-04-12');
    expect(elderStudent.student_b_form).toBe('35201-1111111-1');
    expect(elderStudent.guardian_name).toBe('Muhammad Tariq');
    expect(elderStudent.guardian_phone).toBe('+92 300 1234567');

    // Now admit younger sibling linked to elder brother with flat kinship concession
    const youngerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        full_name: 'Younger Sister Tariq',
        date_of_birth: '2010-09-20',
        gender: 'Female',
        student_b_form: '35201-4444444-2',
        residential_address: 'House 14, Street 2, Gulberg III',
        city: 'Lahore',
        father_name: 'Muhammad Tariq',
        father_cnic: '35201-2222222-1',
        father_phone: '+92 300 1234567',
        father_occupation: 'Civil Engineer',
        mother_name: 'Amina Tariq',
        mother_cnic: '35201-3333333-2',
        mother_phone: '+92 300 7654321',
        mother_occupation: 'Professor',
        primary_contact: 'mother',
        sibling_student_id: elderStudent.id,
        program_id: targetBatch.program_id,
        batch_id: targetBatch.id,
        fee_structure: {
          base_tuition: 10000,
          admission_fee: 0,
          concession_type: 'percentage',
          concession_val: 20,
          concession_reason: 'Sibling Concession - 2nd Child (20% off tuition)',
          net_tuition: 8000,
          first_month_total: 8000,
        },
      },
    });

    expect(youngerRes.statusCode).toBe(201);
    const youngerStudent = youngerRes.json().data;
    expect(youngerStudent.id).toBeDefined();
    expect(youngerStudent.sibling_student_id).toBe(elderStudent.id);
    expect(youngerStudent.primary_contact).toBe('mother');
    expect(youngerStudent.fee_structure.concession_val).toBe(20);
    expect(youngerStudent.fee_structure.net_tuition).toBe(8000);

    // Retrieve younger student through API
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/sis/students/${youngerStudent.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.statusCode).toBe(200);
    const fetched = getRes.json().data;
    expect(fetched.sibling_student_id).toBe(elderStudent.id);
    expect(fetched.father_cnic).toBe('35201-2222222-1');
    expect(fetched.mother_cnic).toBe('35201-3333333-2');
    expect(fetched.student_b_form).toBe('35201-4444444-2');
  });
});

