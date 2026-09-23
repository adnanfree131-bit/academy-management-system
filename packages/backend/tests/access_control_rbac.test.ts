import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { IMailerService } from '../src/services/mailer.js';
import { hashPassword } from '../src/services/password.js';

describe('Fine-Grained Role-Based Access Control (RBAC) & Security Enforcement', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;

  const TENANT_A_ID = 'a0000000-0000-0000-0000-000000000001';
  const TENANT_B_ID = 'b0000000-0000-0000-0000-000000000001';

  let studentToken: string;
  let teacherWithAbsenteeEditToken: string;
  let parentToken: string;
  let teacherAttendanceOnlyToken: string;
  let financeUserToken: string;
  let teacherAToken: string;
  let teacherBToken: string;
  let teacherAssignedBatchXToken: string;

  let teacherAUserId: string;
  let teacherBUserId: string;
  let financeUserId: string;
  let student1Id: string;
  let student2Id: string;
  let batchXId: string;
  let batchYId: string;

  const mockMailer: IMailerService = {
    async sendOTP() {
      return true;
    },
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    store = new InMemoryDataStore();
    app = await buildApp({
      store,
      mailer: mockMailer,
      jwtSecret: 'test-rbac-secret-minimum-32-chars-long-security',
    });
    await app.ready();

    // 1. Setup Student User in Tenant A
    const studentUser = (await store.getUserByEmail(TENANT_A_ID, 'student@apexacademy.edu.pk'))!;
    studentToken = app.jwt.sign({
      sub: studentUser.id,
      user_id: studentUser.id,
      email: studentUser.email,
      role: 'student',
      tenant_id: TENANT_A_ID,
    });

    // 2. Setup Parent User in Tenant A
    const parentUser = (await store.getUserByEmail(TENANT_A_ID, 'parent.hamza@gmail.com'))!;
    parentToken = app.jwt.sign({
      sub: parentUser.id,
      user_id: parentUser.id,
      email: parentUser.email,
      role: 'parent',
      tenant_id: TENANT_A_ID,
    });

    // 3. Create Teacher with Absentee Edit Access
    const teacherAbsentee = await store.createStaff({
      tenant_id: TENANT_A_ID,
      email: 'teacher.absentee@apexacademy.edu.pk',
      full_name: 'Sir Usman Absentee Incharge',
      role: 'teacher',
      access: {
        absentee: 'edit',
      },
    });
    teacherWithAbsenteeEditToken = app.jwt.sign({
      sub: teacherAbsentee.id,
      user_id: teacherAbsentee.id,
      email: teacherAbsentee.email,
      role: 'teacher',
      tenant_id: TENANT_A_ID,
    });

    // 4. Create Teacher with Attendance Edit Only (no finance, no staff)
    const teacherAttOnly = await store.createStaff({
      tenant_id: TENANT_A_ID,
      email: 'teacher.attonly@apexacademy.edu.pk',
      full_name: 'Sir Attendance Only',
      role: 'teacher',
      access: {
        attendance: 'edit',
      },
    });
    teacherAttendanceOnlyToken = app.jwt.sign({
      sub: teacherAttOnly.id,
      user_id: teacherAttOnly.id,
      email: teacherAttOnly.email,
      role: 'teacher',
      tenant_id: TENANT_A_ID,
    });

    // 5. Create Finance User with Voucher Edit Access
    const financeStaff = await store.createStaff({
      tenant_id: TENANT_A_ID,
      email: 'accountant.test@apexacademy.edu.pk',
      full_name: 'Accountant Test',
      role: 'finance_manager',
      access: {
        voucher: 'edit',
        expenses: 'view',
      },
    });
    financeUserId = financeStaff.id;
    financeUserToken = app.jwt.sign({
      sub: financeStaff.id,
      user_id: financeStaff.id,
      email: financeStaff.email,
      role: 'finance_manager',
      tenant_id: TENANT_A_ID,
    });

    // 6. Setup Teacher A and Teacher B for Teacher Portal Scoping
    const teacherA = await store.createStaff({
      tenant_id: TENANT_A_ID,
      email: 'teacher.alpha@apexacademy.edu.pk',
      full_name: 'Teacher Alpha',
      role: 'teacher',
      access: {
        attendance: 'edit',
      },
    });
    teacherAUserId = teacherA.id;
    teacherAToken = app.jwt.sign({
      sub: teacherA.id,
      user_id: teacherA.id,
      email: teacherA.email,
      role: 'teacher',
      tenant_id: TENANT_A_ID,
    });

    const teacherB = await store.createStaff({
      tenant_id: TENANT_A_ID,
      email: 'teacher.beta@apexacademy.edu.pk',
      full_name: 'Teacher Beta',
      role: 'teacher',
      access: {
        attendance: 'edit',
      },
    });
    teacherBUserId = teacherB.id;
    teacherBToken = app.jwt.sign({
      sub: teacherB.id,
      user_id: teacherB.id,
      email: teacherB.email,
      role: 'teacher',
      tenant_id: TENANT_A_ID,
    });

    // 7. Setup Batches and Scoped Teacher
    const programs = await store.getPrograms(TENANT_A_ID);
    const progId = programs[0]?.id || 'prog-1';

    const batchX = await store.createBatch({
      tenant_id: TENANT_A_ID,
      program_id: progId,
      name: 'Batch-X-RBAC',
      shift: 'Morning',
      capacity: 30,
      academic_session: '2026-2027',
    });

    const batchY = await store.createBatch({
      tenant_id: TENANT_A_ID,
      program_id: progId,
      name: 'Batch-Y-RBAC',
      shift: 'Morning',
      capacity: 30,
      academic_session: '2026-2027',
    });
    batchXId = batchX.id;
    batchYId = batchY.id;

    const subjects = await store.getSubjects(TENANT_A_ID);
    const subjId = subjects[0]?.id || 'subj-1';

    // Student X enrolled only in Batch X
    const studentX = await store.createStudent({
      tenant_id: TENANT_A_ID,
      program_id: progId,
      batch_id: batchX.id,
      full_name: 'Student In Batch X',
      gender: 'male',
      guardian_name: 'Guardian X',
      guardian_relationship: 'Father',
      guardian_phone: '03001234567',
      status: 'active',
      monthly_tuition_fee: 5000,
    });
    student1Id = studentX.id;

    // Student Y enrolled only in Batch Y
    const studentY = await store.createStudent({
      tenant_id: TENANT_A_ID,
      program_id: progId,
      batch_id: batchY.id,
      full_name: 'Student In Batch Y',
      gender: 'male',
      guardian_name: 'Guardian Y',
      guardian_relationship: 'Father',
      guardian_phone: '03007654321',
      status: 'active',
      monthly_tuition_fee: 5000,
    });
    student2Id = studentY.id;

    // Teacher assigned specifically to Batch X (without all_classes permission)
    const teacherAssignedBatchX = await store.createStaff({
      tenant_id: TENANT_A_ID,
      email: 'teacher.scoped@apexacademy.edu.pk',
      full_name: 'Teacher Scoped Batch X',
      role: 'teacher',
      access: {
        enrollment: 'view',
      },
      teaching_assignments: [
        {
          program_id: progId,
          batch_id: batchX.id,
          subject_id: subjId,
          weekly_periods: 5,
        },
      ],
    });
    teacherAssignedBatchXToken = app.jwt.sign({
      sub: teacherAssignedBatchX.id,
      user_id: teacherAssignedBatchX.id,
      email: teacherAssignedBatchX.email,
      role: 'teacher',
      tenant_id: TENANT_A_ID,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // Test 1: Student token on /api/v1/absentee -> 403. Teacher with absentee edit -> 200.
  // ---------------------------------------------------------------------------
  it('Test 1: Student token on /api/v1/absentee returns 403, while teacher with absentee edit returns 200', async () => {
    const studentRes = await app.inject({
      method: 'GET',
      url: '/api/v1/absentee',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(studentRes.statusCode).toBe(403);
    const studentBody = JSON.parse(studentRes.body);
    expect(studentBody.success).toBe(false);

    const teacherRes = await app.inject({
      method: 'GET',
      url: '/api/v1/absentee',
      headers: { authorization: `Bearer ${teacherWithAbsenteeEditToken}` },
    });
    expect(teacherRes.statusCode).toBe(200);
    const teacherBody = JSON.parse(teacherRes.body);
    expect(teacherBody.success).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Test 2: Student token GET /api/v1/exams/questions -> 403.
  // Body must not leak correct_option.
  // ---------------------------------------------------------------------------
  it('Test 2: Student token GET /api/v1/exams/questions returns 403 and never leaks correct_option', async () => {
    // Seed question with correct_option in bank
    const subjects = await store.getSubjects(TENANT_A_ID);
    await store.createBankQuestion(TENANT_A_ID, {
      subject_id: subjects[0]?.id || 'subj-1',
      question_type: 'MCQ',
      question_text: 'What is the velocity of light in vacuum?',
      marks: 1,
      options: [
        { key: 'A', text: '3 x 10^8 m/s' },
        { key: 'B', text: '3 x 10^6 m/s' },
      ],
      correct_option: 'A',
      is_quiz_bank: true,
      difficulty_level: 'EASY',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/exams/questions',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.body).not.toContain('3 x 10^8 m/s');
    expect(res.body).not.toContain('"correct_option":"A"');
  });

  // ---------------------------------------------------------------------------
  // Test 3: Anonymous GET /api/v1/saas/trial-status?tenant_id=A -> 401.
  // Parent token must not receive pending_receipt.
  // ---------------------------------------------------------------------------
  it('Test 3: Anonymous GET /api/v1/saas/trial-status returns 401; parent token does not receive pending_receipt', async () => {
    const anonRes = await app.inject({
      method: 'GET',
      url: `/api/v1/saas/trial-status?tenant_id=${TENANT_A_ID}`,
    });
    expect(anonRes.statusCode).toBe(401);

    const parentRes = await app.inject({
      method: 'GET',
      url: `/api/v1/saas/trial-status?tenant_id=${TENANT_A_ID}`,
      headers: { authorization: `Bearer ${parentToken}` },
    });
    expect(parentRes.statusCode).toBe(200);
    const parentBody = JSON.parse(parentRes.body);
    expect(parentBody.success).toBe(true);
    expect(parentBody.data.pending_receipt).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Test 4: Anonymous POST /api/v1/saas/receipts with tenant_id A -> 401.
  // ---------------------------------------------------------------------------
  it('Test 4: Anonymous POST /api/v1/saas/receipts with tenant_id A returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/saas/receipts',
      payload: {
        tenant_id: TENANT_A_ID,
        amount: 25000,
        plan_duration_months: 1,
        payment_method: 'BANK_TRANSFER',
        reference_number: 'TEST-REF-999',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // Test 5: Login with CNIC + Parent@123 and no tenant -> 400.
  // With tenant B only, must not return academy A.
  // ---------------------------------------------------------------------------
  it('Test 5: Login with CNIC and no tenant returns 400 TENANT_REQUIRED; login with tenant B rejects academy A user', async () => {
    const parentUser = (await store.getUserByEmail(TENANT_A_ID, 'parent.hamza@gmail.com'))!;
    parentUser.password_hash = hashPassword('Parent@123');
    parentUser.metadata = {
      ...parentUser.metadata,
      guardian_id_card: '35202-7777777-1',
      clean_guardian_id_card: '3520277777771',
    };

    // 1. Without tenant identifier -> 400 TENANT_REQUIRED
    const resNoTenant = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: '35202-7777777-1',
        password: 'Parent@123',
      },
    });
    expect(resNoTenant.statusCode).toBe(400);
    const bodyNoTenant = JSON.parse(resNoTenant.body);
    expect(bodyNoTenant.error.code).toBe('TENANT_REQUIRED');

    // 2. With Tenant B slug -> 401 invalid credentials (cannot resolve from Tenant A)
    const resTenantB = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: '35202-7777777-1',
        password: 'Parent@123',
        tenant_slug: 'crescent',
      },
    });
    expect(resTenantB.statusCode).toBe(401);
    const bodyTenantB = JSON.parse(resTenantB.body);
    expect(bodyTenantB.success).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Test 6: Student portal: email containing another student’s short roll 1
  // must not bind user_id to that student.
  // ---------------------------------------------------------------------------
  it('Test 6: Student portal: email containing another student short roll 1 does not bind user_id to that student', async () => {
    // Student 1 has roll_number: '1' and no user_id bound
    const programs = await store.getPrograms(TENANT_A_ID);
    const batches = await store.getBatches(TENANT_A_ID);
    const studentWithRoll1 = await store.createStudent({
      tenant_id: TENANT_A_ID,
      program_id: programs[0].id,
      batch_id: batches[0].id,
      full_name: 'Short Roll Student',
      gender: 'male',
      guardian_name: 'Father Roll 1',
      guardian_relationship: 'Father',
      guardian_phone: '03001111111',
      status: 'active',
      monthly_tuition_fee: 3000,
    });
    // Manually force roll_number to '1'
    studentWithRoll1.roll_number = '1';
    studentWithRoll1.user_id = null as any;

    // Create user with email 'roll100@test.com' (contains '1', but prefix is 'roll100', not '1')
    const roll100User = {
      id: crypto.randomUUID(),
      tenant_id: TENANT_A_ID,
      email: 'roll100@test.com',
      full_name: 'User Roll 100',
      role: 'student' as const,
      status: 'active' as const,
      password_hash: hashPassword('Student@123'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.users.set(roll100User.id, roll100User);
    store.users.set(`${TENANT_A_ID}:${roll100User.email.toLowerCase()}`, roll100User);

    const roll100Token = app.jwt.sign({
      sub: roll100User.id,
      user_id: roll100User.id,
      email: roll100User.email,
      role: 'student',
      tenant_id: TENANT_A_ID,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student',
      headers: { authorization: `Bearer ${roll100Token}` },
    });

    // Student with roll 1 must NOT have been bound to user roll100
    const refreshedStd1 = await store.getStudentById(TENANT_A_ID, studentWithRoll1.id);
    expect(refreshedStd1?.user_id).not.toBe(roll100User.id);
    expect(res.statusCode).toBe(403);
  });

  // ---------------------------------------------------------------------------
  // Test 7: Teacher with attendance edit only:
  // POST /api/v1/finance/invoices/generate -> 403.
  // GET /api/v1/academic/staff -> 403.
  // ---------------------------------------------------------------------------
  it('Test 7: Teacher with attendance edit only cannot generate invoices (403) or read staff directory (403)', async () => {
    const invRes = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/invoices/generate',
      headers: { authorization: `Bearer ${teacherAttendanceOnlyToken}` },
      payload: {
        batch_id: 'batch-test',
        billing_month: '2026-10',
        due_date: '2026-10-15',
      },
    });
    expect(invRes.statusCode).toBe(403);
    const invBody = JSON.parse(invRes.body);
    expect(invBody.success).toBe(false);

    const staffRes = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/staff',
      headers: { authorization: `Bearer ${teacherAttendanceOnlyToken}` },
    });
    expect(staffRes.statusCode).toBe(403);
    const staffBody = JSON.parse(staffRes.body);
    expect(staffBody.success).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Test 8: Director removes voucher from a finance user;
  // next request with the same old JWT -> 403 on collect fees.
  // ---------------------------------------------------------------------------
  it('Test 8: Revoking voucher access takes immediate effect on the same existing JWT (403 on collect fees)', async () => {
    // 1. Initial attempt: finance user has voucher edit -> passes permission check
    // (We test the collect payment endpoint /api/v1/finance/payments with invalid body to confirm feature check passes)
    const initialRes = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/payments',
      headers: { authorization: `Bearer ${financeUserToken}` },
      payload: {
        invoice_id: 'inv-test-dummy',
        amount_paid: 1000,
        payment_method: 'cash',
      },
    });
    // Permission check passed (did not return 403 FORBIDDEN_ROLE)
    expect(initialRes.statusCode).not.toBe(403);

    // 2. Director revokes voucher access from finance user in store
    const financeUserInStore = (await store.getUserById(TENANT_A_ID, financeUserId))!;
    financeUserInStore.metadata = {
      ...financeUserInStore.metadata,
      access: {
        expenses: 'edit', // voucher removed!
      },
      permissions: ['expenses'],
    };

    // 3. Next request with the EXACT same JWT token must return 403 immediately!
    const revokedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/payments',
      headers: { authorization: `Bearer ${financeUserToken}` },
      payload: {
        invoice_id: 'inv-test-dummy',
        amount_paid: 1000,
        payment_method: 'cash',
      },
    });
    expect(revokedRes.statusCode).toBe(403);
    const revokedBody = JSON.parse(revokedRes.body);
    expect(revokedBody.error.code).toBe('FORBIDDEN_ROLE');
  });

  // ---------------------------------------------------------------------------
  // Test 9: PATCH /api/v1/geofence/staff/:id/adjust with student token -> 403.
  // ---------------------------------------------------------------------------
  it('Test 9: PATCH /api/v1/geofence/staff/:id/adjust with student token returns 403', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/geofence/staff/${teacherAUserId}/adjust`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        status: 'on_time',
        notes: 'Unauthorized attempt by student',
      },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Test 10: GET /api/v1/portal/teacher?teacher_id=someoneElse with teacher token -> 403.
  // ---------------------------------------------------------------------------
  it('Test 10: GET /api/v1/portal/teacher with teacher_id of someone else returns 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/portal/teacher?teacher_id=${teacherBUserId}`,
      headers: { authorization: `Bearer ${teacherAToken}` },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  // ---------------------------------------------------------------------------
  // Test 11: Teacher with assignments on batch X:
  // GET /api/v1/sis/students must not include a student only in batch Y.
  // ---------------------------------------------------------------------------
  it('Test 11: Teacher with assignments on batch X cannot see students enrolled only in batch Y', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/sis/students',
      headers: { authorization: `Bearer ${teacherAssignedBatchXToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    const returnedStudents = body.data;
    const foundStudentX = returnedStudents.some((s: any) => s.id === student1Id);
    const foundStudentY = returnedStudents.some((s: any) => s.id === student2Id);

    expect(foundStudentX).toBe(true);
    expect(foundStudentY).toBe(false);

    // Opening Student Y profile directly must also return 403
    const directRes = await app.inject({
      method: 'GET',
      url: `/api/v1/sis/students/${student2Id}`,
      headers: { authorization: `Bearer ${teacherAssignedBatchXToken}` },
    });
    expect(directRes.statusCode).toBe(403);
  });

  // ---------------------------------------------------------------------------
  // Test 12: Production boot without JWT_SECRET throws / exits before listen.
  // ---------------------------------------------------------------------------
  it('Test 12: Production boot without JWT_SECRET throws before listen', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      await expect(
        buildApp({
          store,
          jwtSecret: undefined,
        })
      ).rejects.toThrow(/FATAL: JWT_SECRET environment variable is required in production/);
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalSecret) {
        process.env.JWT_SECRET = originalSecret;
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Test 13: Default teacher role template includes classes: 'view' and allows
  // loading programs, batches, subjects, and groups.
  // ---------------------------------------------------------------------------
  it('Test 13: Default teacher can load academic programs, batches, subjects, and groups', async () => {
    const defaultTeacher = await store.createStaff({
      tenant_id: TENANT_A_ID,
      email: 'default.teacher@apexacademy.edu.pk',
      full_name: 'Default Template Teacher',
      role: 'teacher',
    });
    expect((defaultTeacher.metadata?.access as any)?.classes).toBe('view');

    const defaultTeacherToken = app.jwt.sign({
      sub: defaultTeacher.id,
      user_id: defaultTeacher.id,
      email: defaultTeacher.email,
      role: 'teacher',
      tenant_id: TENANT_A_ID,
    });

    const resPrograms = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/programs',
      headers: { authorization: `Bearer ${defaultTeacherToken}` },
    });
    expect(resPrograms.statusCode).toBe(200);

    const resBatches = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/batches',
      headers: { authorization: `Bearer ${defaultTeacherToken}` },
    });
    expect(resBatches.statusCode).toBe(200);

    const resSubjects = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/subjects',
      headers: { authorization: `Bearer ${defaultTeacherToken}` },
    });
    expect(resSubjects.statusCode).toBe(200);

    const resGroups = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/groups',
      headers: { authorization: `Bearer ${defaultTeacherToken}` },
    });
    expect(resGroups.statusCode).toBe(200);
  });

  // ---------------------------------------------------------------------------
  // Test 14: SaaS routes verify live user from store and reject demoted tokens.
  // ---------------------------------------------------------------------------
  it('Test 14: Demoted super admin or director token is rejected on SaaS routes', async () => {
    const adminUser = await store.createStaff({
      tenant_id: TENANT_A_ID,
      email: 'temp.director@apexacademy.edu.pk',
      full_name: 'Temporary Director',
      role: 'tenant_admin',
    });

    const adminToken = app.jwt.sign({
      sub: adminUser.id,
      user_id: adminUser.id,
      email: adminUser.email,
      role: 'tenant_admin',
      tenant_id: TENANT_A_ID,
    });

    // Valid check first
    const okRes = await app.inject({
      method: 'GET',
      url: '/api/v1/saas/trial-status',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(okRes.statusCode).toBe(200);

    // Now demote user in store to teacher
    const liveAdmin = await store.getUserByEmail(TENANT_A_ID, adminUser.email);
    if (liveAdmin) liveAdmin.role = 'teacher';

    // Use old admin token -> receipt list requires director or super_admin
    const demotedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/saas/receipts',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(demotedRes.statusCode).toBe(403);
    const body = JSON.parse(demotedRes.body);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  // ---------------------------------------------------------------------------
  // Test 15: Teacher portal overview scopes batches, exams, and diary to assigned batches.
  // ---------------------------------------------------------------------------
  it('Test 15: Teacher portal overview scopes batches, exams, and diary to assigned batches', async () => {
    const teacherScoped = await store.createStaff({
      tenant_id: TENANT_A_ID,
      email: 'scoped.teacher@apexacademy.edu.pk',
      full_name: 'Sir Scoped Portal',
      role: 'teacher',
      teaching_assignments: [
        {
          batch_id: batchXId,
          batch_name: 'Batch-X-RBAC',
          subject_id: 'sub-phy',
          subject_name: 'Physics',
        },
      ],
    });

    const overview = await store.getTeacherPortalOverview(TENANT_A_ID, teacherScoped.id);
    expect(overview.assigned_batches.some(b => b.id === batchXId)).toBe(true);
    expect(overview.assigned_batches.some(b => b.id === batchYId)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Test 16: Student portal rejects local-part prefix match without exact link.
  // ---------------------------------------------------------------------------
  it('Test 16: Student portal rejects account without exact student link', async () => {
    const unlinkedUser = {
      id: crypto.randomUUID(),
      tenant_id: TENANT_A_ID,
      email: 'roll1.imposter@gmail.com',
      full_name: 'Roll 1 Imposter',
      role: 'student' as const,
      status: 'active' as const,
      password_hash: await hashPassword('Student@123'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.users.set(unlinkedUser.id, unlinkedUser);
    store.users.set(`${TENANT_A_ID}:${unlinkedUser.email.toLowerCase()}`, unlinkedUser);

    const unlinkedToken = app.jwt.sign({
      sub: unlinkedUser.id,
      user_id: unlinkedUser.id,
      email: unlinkedUser.email,
      role: 'student',
      tenant_id: TENANT_A_ID,
    });

    const portalRes = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student',
      headers: { authorization: `Bearer ${unlinkedToken}` },
    });
    expect(portalRes.statusCode).toBe(403);
    const body = JSON.parse(portalRes.body);
    expect(body.error.code).toBe('STUDENT_UNLINKED');
  });

  // ---------------------------------------------------------------------------
  // Test 17: Strict fail-closed: unassigned teacher with all_classes off sees 0
  // batches and 0 students, but gains full scope when all_classes is enabled.
  // ---------------------------------------------------------------------------
  it('Test 17: Strict fail-closed: unassigned teacher with all_classes off sees empty batches, not whole academy', async () => {
    const unassignedTeacher = await store.createStaff({
      tenant_id: TENANT_A_ID,
      email: 'unassigned.strict@apexacademy.edu.pk',
      full_name: 'Sir Unassigned Strict',
      role: 'teacher',
      // No teaching assignments, default template (all_classes off)
    });

    const unassignedToken = app.jwt.sign({
      sub: unassignedTeacher.id,
      user_id: unassignedTeacher.id,
      email: unassignedTeacher.email,
      role: 'teacher',
      tenant_id: TENANT_A_ID,
    });

    // 1. Teacher Portal Overview should have 0 assigned batches
    const overview = await store.getTeacherPortalOverview(TENANT_A_ID, unassignedTeacher.id);
    expect(overview.assigned_batches.length).toBe(0);
    expect(overview.pending_attendance_batches.length).toBe(0);
    expect(overview.pending_grading_exams.length).toBe(0);

    // 2. SIS Student List should return 0 students (since batchScope is [])
    const sisRes = await app.inject({
      method: 'GET',
      url: '/api/v1/sis/students',
      headers: { authorization: `Bearer ${unassignedToken}` },
    });
    expect(sisRes.statusCode).toBe(200);
    const sisBody = JSON.parse(sisRes.body);
    expect(sisBody.data.length).toBe(0);

    // 3. If administrator turns on all_classes: 'view', they immediately see whole academy
    const liveTeacher = await store.getUserByEmail(TENANT_A_ID, unassignedTeacher.email);
    if (liveTeacher && liveTeacher.metadata) {
      (liveTeacher.metadata as any).access.all_classes = 'view';
    }

    const overviewAll = await store.getTeacherPortalOverview(TENANT_A_ID, unassignedTeacher.id);
    expect(overviewAll.assigned_batches.length).toBeGreaterThan(0);

    const sisResAll = await app.inject({
      method: 'GET',
      url: '/api/v1/sis/students',
      headers: { authorization: `Bearer ${unassignedToken}` },
    });
    expect(sisResAll.statusCode).toBe(200);
    const sisBodyAll = JSON.parse(sisResAll.body);
    expect(sisBodyAll.data.length).toBeGreaterThan(0);
  });
});

