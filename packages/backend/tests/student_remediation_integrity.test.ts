import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fjwt from '@fastify/jwt';
import { InMemoryDataStore } from '../src/services/store.js';
import { sisRoutes } from '../src/routes/sis.ts';
import { financeRoutes } from '../src/routes/finance.ts';
import { authRoutes } from '../src/routes/auth.ts';
import { attendanceRoutes } from '../src/routes/attendance.ts';
import { examRoutes } from '../src/routes/exams.ts';
import { academicRoutes } from '../src/routes/academic.ts';
import { IMailerService } from '../src/services/mailer.js';
import { AuthService } from '../src/services/auth.js';
import { JWTPayload, Student, StudentInvoice } from '@apex/shared-types';

describe('SIS Remediation & Security Integrity Verification', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  const tenantId = 'a0000000-0000-0000-0000-000000000001';

  let adminToken: string;
  let academicHeadToken: string;
  let teacherToken: string;
  let studentAToken: string;
  let studentBToken: string;
  let parentAToken: string;

  let studentA: Student;
  let studentB: Student;
  let invoiceA: StudentInvoice;
  let invoiceB: StudentInvoice;

  beforeAll(async () => {
    store = new InMemoryDataStore();
    app = Fastify();
    await app.register(fjwt, { secret: 'test-secret-key-1234567890123456' });

    app.decorate('authenticate', async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      if (request.user && request.user.tenant_id && request.user.email && request.user.role !== 'super_admin') {
        const dbUser = await store.getUserByEmail(request.user.tenant_id, request.user.email);
        const isMustChange = Boolean(
          request.user.must_change_password ||
          (dbUser?.metadata as any)?.must_change_password ||
          (dbUser?.metadata as any)?.requires_password_change
        );
        if (isMustChange) {
          const reqPath = request.url.split('?')[0];
          const allowedPaths = [
            '/api/v1/auth/change-password',
            '/api/v1/auth/session',
            '/api/v1/auth/me',
            '/api/v1/auth/logout',
          ];
          if (!allowedPaths.includes(reqPath)) {
            return reply.status(403).send({
              success: false,
              error: {
                code: 'MUST_CHANGE_PASSWORD',
                message: 'You must change your default password before accessing the system.',
              },
            });
          }
        }
      }
    });

    const mailer: IMailerService = {
      sendOTP: async () => true,
      sendCustom: async () => true,
    };

    await app.register(authRoutes(store, mailer), { prefix: '/api/v1/auth' });
    await app.register(sisRoutes(store), { prefix: '/api/v1/sis' });
    await app.register(financeRoutes(store), { prefix: '/api/v1/finance' });
    await app.register(attendanceRoutes(store), { prefix: '/api/v1/attendance' });
    await app.register(examRoutes(store), { prefix: '/api/v1/exams' });
    await app.register(academicRoutes(store), { prefix: '/api/v1/academic' });

    await app.ready();

    // Create Admin Token
    adminToken = app.jwt.sign({
      sub: 'admin-1',
      tenant_id: tenantId,
      email: 'admin@apex.edu.pk',
      role: 'tenant_admin',
    } as JWTPayload);

    // Create Academic Head Token
    academicHeadToken = app.jwt.sign({
      sub: 'academic-head-1',
      tenant_id: tenantId,
      email: 'head@apex.edu.pk',
      role: 'academic_head',
    } as JWTPayload);

    // Create Teacher Token
    teacherToken = app.jwt.sign({
      sub: 'teacher-1',
      tenant_id: tenantId,
      email: 'teacher@apex.edu.pk',
      role: 'teacher',
    } as JWTPayload);

    // Get an initial batch
    const batches = await store.getBatches(tenantId);
    const batch = batches[0];

    // 1. Admit Student A
    studentA = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Student Alpha',
      phone: '+92 300 1111111',
      email: 'alpha@apex.edu.pk',
      guardian_name: 'Guardian Alpha',
      guardian_phone: '+92 300 2222222',
      guardian_email: 'g.alpha@apex.edu.pk',
      guardian_id_card: '35201-1111111-1',
      program_id: batch.program_id,
      batch_id: batch.id,
      roll_number: 'ROL-ALPHA-1',
    });

    // 2. Admit Student B
    studentB = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Student Beta',
      phone: '+92 300 3333333',
      email: 'beta@apex.edu.pk',
      guardian_name: 'Guardian Beta',
      guardian_phone: '+92 300 4444444',
      guardian_email: 'g.beta@apex.edu.pk',
      guardian_id_card: '35201-2222222-2',
      program_id: batch.program_id,
      batch_id: batch.id,
      roll_number: 'ROL-BETA-2',
    });

    const userA = await store.getUserByEmail(tenantId, 'alpha@apex.edu.pk');
    if (userA && userA.metadata) {
      userA.metadata.must_change_password = false;
    }
    const userB = await store.getUserByEmail(tenantId, 'beta@apex.edu.pk');
    if (userB && userB.metadata) {
      userB.metadata.must_change_password = false;
    }

    // Student A Token
    studentAToken = app.jwt.sign({
      sub: studentA.user_id || 'user-alpha',
      tenant_id: tenantId,
      email: 'alpha@apex.edu.pk',
      role: 'student',
      student_id: studentA.id,
      admission_number: studentA.admission_number,
      cnic: studentA.guardian_id_card,
      must_change_password: false,
    } as JWTPayload);

    // Student B Token
    studentBToken = app.jwt.sign({
      sub: studentB.user_id || 'user-beta',
      tenant_id: tenantId,
      email: 'beta@apex.edu.pk',
      role: 'student',
      student_id: studentB.id,
      admission_number: studentB.admission_number,
      cnic: studentB.guardian_id_card,
      must_change_password: false,
    } as JWTPayload);

    // Parent A Token
    parentAToken = app.jwt.sign({
      sub: 'parent-alpha-id',
      tenant_id: tenantId,
      email: 'g.alpha@apex.edu.pk',
      role: 'parent',
      cnic: studentA.guardian_id_card,
    } as JWTPayload);

    // Create an invoice for Student A
    invoiceA = await store.generateInvoice(tenantId, {
      student_id: studentA.id,
      billing_month: '2026-09',
      due_date: '2026-09-10',
    });

    // Create an invoice for Student B
    invoiceB = await store.generateInvoice(tenantId, {
      student_id: studentB.id,
      billing_month: '2026-09',
      due_date: '2026-09-10',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // 1. AUTHORIZATION & IDOR PREVENTION
  // =========================================================================
  describe('1. Authorization & IDOR Gating', () => {
    it('Blocks students from listing all students (GET /api/v1/sis/students)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${studentAToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Allows staff to list students (GET /api/v1/sis/students)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('Allows student to view own profile, but blocks viewing another student profile', async () => {
      // Student A views Student A -> Allowed
      const ownRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${studentA.id}`,
        headers: { authorization: `Bearer ${studentAToken}` },
      });
      expect(ownRes.statusCode).toBe(200);

      // Student A views Student B -> Forbidden
      const idorRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${studentB.id}`,
        headers: { authorization: `Bearer ${studentAToken}` },
      });
      expect(idorRes.statusCode).toBe(403);
    });

    it('Blocks student from viewing another student academic summary', async () => {
      const idorSummary = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${studentB.id}/academic-summary`,
        headers: { authorization: `Bearer ${studentAToken}` },
      });
      expect(idorSummary.statusCode).toBe(403);
    });

    it('Restricts student audit logs to tenant_admin and academic_head', async () => {
      // Teacher -> Forbidden
      const teacherRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${studentA.id}/audit-logs`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(teacherRes.statusCode).toBe(403);

      // Student -> Forbidden
      const studentRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${studentA.id}/audit-logs`,
        headers: { authorization: `Bearer ${studentAToken}` },
      });
      expect(studentRes.statusCode).toBe(403);

      // Admin -> Allowed
      const adminRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${studentA.id}/audit-logs`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(adminRes.statusCode).toBe(200);
    });

    it('Blocks direct status mutation via PATCH /students/:id', async () => {
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/sis/students/${studentA.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          status: 'withdrawn',
        },
      });
      expect(patchRes.statusCode).toBe(400);
      const body = patchRes.json();
      expect(body.error.message).toContain('/status');
    });

    it('Seals IDOR on Invoices: Student A only sees own invoices', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/invoices',
        headers: { authorization: `Bearer ${studentAToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.every((inv: StudentInvoice) => inv.student_id === studentA.id)).toBe(true);
    });

    it('Seals IDOR on Single Invoice: Student A cannot fetch Student B invoice', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/invoices/${invoiceB.id}`,
        headers: { authorization: `Bearer ${studentAToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Seals IDOR on Ledger: Student A cannot query Student B ledger', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/ledger/${studentB.id}`,
        headers: { authorization: `Bearer ${studentAToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Seals IDOR on Attendance: Student A cannot access Student B attendance', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/attendance/students/${studentB.id}`,
        headers: { authorization: `Bearer ${studentAToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Seals IDOR on Exam Report Cards: Student A cannot access Student B report card', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/exams/exam-1/report-card/${studentB.id}`,
        headers: { authorization: `Bearer ${studentAToken}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // 2. AUTHENTICATION & LOGIN HARDENING
  // =========================================================================
  describe('2. Authentication Security', () => {
    it('Rejects login with invalid password (no default password bypass)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'alpha@apex.edu.pk',
          password: 'WrongPassword123!',
          tenant_id: tenantId,
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it('Embeds student_id, admission_number, and cnic into issued JWT upon login', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: studentA.guardian_id_card,
          password: 'Student@123',
          tenant_id: tenantId,
        },
      });
      expect(loginRes.statusCode).toBe(200);
      const token = loginRes.json().data.token;
      const decoded = app.jwt.decode(token) as JWTPayload;
      expect(decoded.student_id).toBe(studentA.id);
      expect(decoded.admission_number).toBe(studentA.admission_number);
      expect(decoded.cnic).toBe(studentA.guardian_id_card);
    });
  });

  // =========================================================================
  // 3. LIFECYCLE & CAPACITY INTEGRITY
  // =========================================================================
  describe('3. Student Status & Capacity Lifecycle', () => {
    it('Preserves seat capacity on on_leave transition, and decrements on withdrawn', async () => {
      const batchBefore = (await store.getBatches(tenantId)).find(b => b.id === studentA.batch_id)!;
      const initialEnrollment = batchBefore.current_enrollment;

      // Transition to on_leave
      await store.updateStudentStatus(
        tenantId,
        studentA.id,
        'on_leave',
        'Medical leave approved by doctor',
        false,
        'admin-1'
      );
      const batchOnLeave = (await store.getBatches(tenantId)).find(b => b.id === studentA.batch_id)!;
      expect(batchOnLeave.current_enrollment).toBe(initialEnrollment);

      // Transition to withdrawn
      await store.updateStudentStatus(
        tenantId,
        studentA.id,
        'withdrawn',
        'Relocating to another city',
        false,
        'admin-1'
      );
      const batchWithdrawn = (await store.getBatches(tenantId)).find(b => b.id === studentA.batch_id)!;
      expect(batchWithdrawn.current_enrollment).toBe(initialEnrollment - 1);

      // Portal user should now be inactive
      const users = await store.getTenantUsers(tenantId);
      const alphaUser = users.find(u => u.id === studentA.user_id);
      expect(alphaUser?.status).toBe('inactive');

      // Logging in as withdrawn/inactive user should now be blocked
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: studentA.guardian_id_card,
          password: 'Student@123',
          tenant_id: tenantId,
        },
      });
      expect(loginRes.statusCode).toBe(401);
      expect(loginRes.json().success).toBe(false);
    });

    it('Reactivating student enforces batch capacity checks', async () => {
      // Create a batch with max_capacity = 1
      const program = (await store.getPrograms(tenantId))[0];
      const tightBatch = await store.createBatch({
        tenant_id: tenantId,
        program_id: program.id,
        name: 'Tight Capacity Batch',
        shift: 'morning',
        max_capacity: 1,
        academic_session: '2026-2027',
      });

      // Fill the batch with an active student
      const occupant = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Occupant Student',
        phone: '+92 300 7777777',
        guardian_name: 'Guardian Occupant',
        guardian_phone: '+92 300 8888888',
        guardian_id_card: '35201-7777777-7',
        program_id: program.id,
        batch_id: tightBatch.id,
      });
      expect(occupant.status).toBe('active');

      // Attempt to move another student to tightBatch should throw because capacity is reached
      await expect(
        store.updateStudent(tenantId, studentB.id, { batch_id: tightBatch.id })
      ).rejects.toThrow(/capacity/i);
    });
  });

  // =========================================================================
  // 4. SIBLING GRAPH RECIPROCAL LINKING & CLEANUP
  // =========================================================================
  describe('4. Sibling Graph Reciprocal Consistency', () => {
    it('Establishes bidirectional linking on student creation and clears on deletion', async () => {
      const batches = await store.getBatches(tenantId);
      const batch = batches[0];

      // Create Sibling 1
      const s1 = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Sibling Primary',
        guardian_name: 'Family Parent',
        guardian_phone: '+92 333 1112233',
        guardian_id_card: '35201-9999999-1',
        program_id: batch.program_id,
        batch_id: batch.id,
      });

      // Create Sibling 2 linked to Sibling 1
      const s2 = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Sibling Secondary',
        guardian_name: 'Family Parent',
        guardian_phone: '+92 333 1112233',
        guardian_id_card: '35201-9999999-1',
        program_id: batch.program_id,
        batch_id: batch.id,
        sibling_student_id: s1.id,
      });

      expect(s2.sibling_student_id).toBe(s1.id);

      // Verify Sibling 1 was reciprocally linked to Sibling 2
      const updatedS1 = (await store.getStudents(tenantId)).find(s => s.id === s1.id);
      expect(updatedS1?.sibling_student_id).toBe(s2.id);

      // Delete Sibling 2: Sibling 1 should have sibling_student_id cleared
      const delRes = await store.deleteStudent(tenantId, s2.id, { force: false });
      expect(delRes.success).toBe(true);
      const s1AfterDelete = (await store.getStudents(tenantId)).find(s => s.id === s1.id);
      expect(s1AfterDelete?.sibling_student_id).toBeFalsy();
    });
  });

  // =========================================================================
  // 5. DOUBLE-ENTRY FINANCIAL INVARIANTS & EXAM BOUNDS
  // =========================================================================
  describe('5. Financial Double-Entry Invariants & Examination Bounds', () => {
    it('Never deletes paid invoices or payments even on force student deletion', async () => {
      const batches = await store.getBatches(tenantId);
      const batch = batches[0];

      const paidStudent = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Paid Ledger Student',
        guardian_name: 'Ledger Parent',
        guardian_phone: '+92 345 9988776',
        guardian_id_card: '35201-5555555-5',
        program_id: batch.program_id,
        batch_id: batch.id,
      });

      const inv = await store.generateInvoice(tenantId, {
        student_id: paidStudent.id,
        billing_month: '2026-09',
        due_date: '2026-09-10',
      });
      await store.recordPayment(tenantId, {
        invoice_id: inv.id,
        amount_paid: inv.total_amount,
        payment_method: 'cash',
        collected_by: 'admin-1',
      });

      // Attempting to delete student with paid invoice without force must return success: false and hasPaidTransactions: true
      const failedDel = await store.deleteStudent(tenantId, paidStudent.id, { force: false });
      expect(failedDel.success).toBe(false);
      expect(failedDel.hasPaidTransactions).toBe(true);

      // Deleting with force: true removes the student record, but keeps the paid invoice in financial ledger
      const forceDel = await store.deleteStudent(tenantId, paidStudent.id, { force: true });
      expect(forceDel.success).toBe(true);
      const remainingInvoices = await store.getInvoices(tenantId);
      const preservedInvoice = remainingInvoices.find(i => i.id === inv.id);
      expect(preservedInvoice).toBeDefined();
      expect(preservedInvoice?.status).toBe('paid');
    });

    it('Rejects exam evaluations exceeding total possible marks', async () => {
      const batches = await store.getBatches(tenantId);
      const batch = batches[0];
      const subjects = await store.getSubjects(tenantId);
      const subject = subjects[0];

      // Ensure studentB is enrolled in the exam subject
      await store.updateStudent(tenantId, studentB.id, { subjects: [subject.id] });

      const exam = await store.createExam(tenantId, {
        title: 'Midterm Physics',
        exam_type: 'midterm',
        subject_id: subject.id,
        batch_ids: [batch.id],
        total_marks: 100,
        passing_marks: 40,
        start_date: '2026-09-20',
      });

      // Evaluation with short_score (110) > total_marks (100) must throw
      await expect(
        store.evaluateStudentExam(tenantId, {
          exam_id: exam.id,
          student_id: studentB.id,
          short_score: 110,
          evaluated_by: 'teacher-1',
        })
      ).rejects.toThrow(/exceed/i);
    });
  });

  // =========================================================================
  // 6. CRITICAL C1 & M9: LOGIN BACKDOOR ELIMINATION & IDENTITY SAFETY
  // =========================================================================
  describe('6. Critical C1 & M9: Backdoor Elimination & Identity Isolation', () => {
    it('C1: Cannot auto-provision user on login when student has no linked user (roll/CNIC login fails with 401)', async () => {
      const batches = await store.getBatches(tenantId);
      const batch = batches[0];

      // Create an active student record
      const orphanStudent = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Orphan Pupil',
        guardian_name: 'Orphan Guardian',
        guardian_phone: '+92 300 9999999',
        guardian_id_card: '35201-9999999-9',
        program_id: batch.program_id,
        batch_id: batch.id,
        roll_number: 'ORPHAN-001',
      });

      // Deliberately remove any user accounts created for orphanStudent to simulate unlinked pupil
      if (orphanStudent.user_id) {
        const u = (store as any).users.get(orphanStudent.user_id);
        if (u) {
          (store as any).users.delete(`${tenantId}:${u.email.toLowerCase()}`);
        }
        (store as any).users.delete(orphanStudent.user_id);
        orphanStudent.user_id = undefined as any;
      }

      // Attempting to log in using roll number + default password 'Student@123' must NOT auto-provision an account
      const loginByRoll = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'ORPHAN-001',
          password: 'Student@123',
          tenant_id: tenantId,
        },
      });

      expect(loginByRoll.statusCode).toBe(401);
      expect(loginByRoll.json().success).toBe(false);

      // Verify no user account was dynamically created in store
      const allUsers = await store.getTenantUsers(tenantId);
      const matchedUser = allUsers.find(u => u.metadata?.roll_number === 'ORPHAN-001' || u.metadata?.admission_number === orphanStudent.admission_number);
      expect(matchedUser).toBeUndefined();
    });

    it('C1: Does not store default_password in user metadata on student creation', async () => {
      const batches = await store.getBatches(tenantId);
      const batch = batches[0];

      const testStudent = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'No Default Pwd Pupil',
        guardian_name: 'Parent Pwd',
        guardian_phone: '+92 300 1234567',
        guardian_id_card: '35201-8888888-8',
        program_id: batch.program_id,
        batch_id: batch.id,
      });

      expect(testStudent.user_id).toBeDefined();
      const allUsers = await store.getTenantUsers(tenantId);
      const user = allUsers.find(u => u.id === testStudent.user_id)!;
      expect(user).toBeDefined();
      expect(user.metadata?.default_password).toBeUndefined();
      expect((user.metadata as any)?.must_change_password).toBe(true);
    });

    it('C1: Flags must_change_password on first login with default password and blocks operational endpoints until changed', async () => {
      const batches = await store.getBatches(tenantId);
      const testFreshStudent = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Default Pwd Login Student',
        phone: '+92 300 9988776',
        guardian_name: 'Guardian Default',
        guardian_phone: '+92 300 9988775',
        guardian_id_card: '35201-9988776-1',
        program_id: batches[0].program_id,
        batch_id: batches[0].id,
        roll_number: 'ROL-MUST-CHANGE-1',
      });

      // 1. First login with default password Student@123 succeeds and flags must_change_password
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testFreshStudent.guardian_id_card,
          password: 'Student@123',
          tenant_id: tenantId,
        },
      });

      expect(loginRes.statusCode).toBe(200);
      const body = loginRes.json();
      expect(body.data.user.must_change_password).toBe(true);
      const defaultToken = body.data.token;
      const decoded = app.jwt.decode(defaultToken) as JWTPayload;
      expect(decoded.must_change_password).toBe(true);

      // 2. Operational endpoint (e.g. GET /api/v1/sis/students/:id) is blocked with 403 MUST_CHANGE_PASSWORD
      const blockedRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${testFreshStudent.id}`,
        headers: { authorization: `Bearer ${defaultToken}` },
      });
      expect(blockedRes.statusCode).toBe(403);
      expect(blockedRes.json().error.code).toBe('MUST_CHANGE_PASSWORD');

      // 3. Whitelisted endpoint (e.g. GET /api/v1/auth/me) is accessible
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${defaultToken}` },
      });
      expect(meRes.statusCode).toBe(200);
      expect(meRes.json().data.user.must_change_password).toBe(true);

      // 4. Update password via POST /api/v1/auth/change-password
      const changeRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: { authorization: `Bearer ${defaultToken}` },
        payload: {
          current_password: 'Student@123',
          new_password: 'SecuredPassword@2026',
        },
      });
      expect(changeRes.statusCode).toBe(200);
      const changeBody = changeRes.json();
      expect(changeBody.data.user.must_change_password).toBe(false);
      const newToken = changeBody.data.token;

      // 5. With new token, operational endpoint is now accessible!
      const unblockedRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${testFreshStudent.id}`,
        headers: { authorization: `Bearer ${newToken}` },
      });
      expect(unblockedRes.statusCode).toBe(200);
      expect(unblockedRes.json().data.id).toBe(testFreshStudent.id);

      // 6. Old default password can no longer log in
      const failedRelogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testFreshStudent.guardian_id_card,
          password: 'Student@123',
          tenant_id: tenantId,
        },
      });
      expect(failedRelogin.statusCode).toBe(401);

      // 7. New password logs in cleanly without must_change_password flag
      const successRelogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testFreshStudent.guardian_id_card,
          password: 'SecuredPassword@2026',
          tenant_id: tenantId,
        },
      });
      expect(successRelogin.statusCode).toBe(200);
      expect(successRelogin.json().data.user.must_change_password).toBe(false);
    });

    it('M9: Prevents attaching student record to staff/admin user when email collides', async () => {
      const batches = await store.getBatches(tenantId);
      const batch = batches[0];
      const adminEmail = 'admin@apex.edu.pk';

      // Verify admin user exists
      const allUsersBefore = await store.getTenantUsers(tenantId);
      const adminUser = allUsersBefore.find(u => u.email.toLowerCase() === adminEmail)!;
      expect(adminUser).toBeDefined();
      expect(adminUser.role).toBe('tenant_admin');

      // Create student with same email as admin
      const collidingStudent = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Colliding Pupil',
        guardian_name: 'Colliding Guardian',
        guardian_phone: '+92 300 5555555',
        guardian_id_card: '35201-4444444-4',
        program_id: batch.program_id,
        batch_id: batch.id,
        email: adminEmail,
      });

      // Student must NOT be attached to adminUser.id
      expect(collidingStudent.user_id).not.toBe(adminUser.id);

      // Student should have a separate student user account
      const allUsersAfter = await store.getTenantUsers(tenantId);
      const studentUser = allUsersAfter.find(u => u.id === collidingStudent.user_id)!;
      expect(studentUser).toBeDefined();
      expect(studentUser.role).toBe('student');
      expect(studentUser.id).not.toBe(adminUser.id);
    });
  });

  // =========================================================================
  // 7. CRITICAL C2: INQUIRY APIS ROLE GATING
  // =========================================================================
  describe('7. Critical C2: Inquiry Desk Role Gating', () => {
    it('Blocks student from listing inquiries (GET /api/v1/sis/inquiries -> 403)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/sis/inquiries',
        headers: { authorization: `Bearer ${studentAToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Blocks parent from listing inquiries (GET /api/v1/sis/inquiries -> 403)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/sis/inquiries',
        headers: { authorization: `Bearer ${parentAToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Blocks student from creating an inquiry (POST /api/v1/sis/inquiries -> 403)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/inquiries',
        headers: { authorization: `Bearer ${studentAToken}` },
        payload: {
          student_name: 'Prospective Pupil',
          phone: '+92 300 0000000',
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Blocks parent from updating inquiry stage (PATCH /api/v1/sis/inquiries/inq-1/stage -> 403)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/sis/inquiries/inq-1/stage',
        headers: { authorization: `Bearer ${parentAToken}` },
        payload: { stage: 'follow_up' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Allows staff (tenant_admin & academic_head) to create and list inquiries', async () => {
      // 1. Create inquiry as admin
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/inquiries',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_name: 'Authorized Lead',
          phone: '+92 312 9988776',
          source: 'Walk-in',
        },
      });
      expect(postRes.statusCode).toBe(201);
      const createdInquiry = postRes.json().data;

      // 2. Academic head lists inquiries
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/sis/inquiries',
        headers: { authorization: `Bearer ${academicHeadToken}` },
      });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().data.some((inq: any) => inq.id === createdInquiry.id)).toBe(true);

      // 3. Academic head updates inquiry stage
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/sis/inquiries/${createdInquiry.id}/stage`,
        headers: { authorization: `Bearer ${academicHeadToken}` },
        payload: { stage: 'trial_scheduled' },
      });
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json().data.stage).toBe('trial_scheduled');
    });
  });

  // =========================================================================
  // 8. HIGH H2: STUDENT PASSWORD RESET NEVER OVERWRITES PARENT ACCOUNT
  // =========================================================================
  describe('8. High H2: Sibling & Parent Password Isolation', () => {
    it('Resetting student password never overwrites the parent password hash', async () => {
      const batches = await store.getBatches(tenantId);
      const batch = batches[0];
      const sharedFamilyCnic = '35201-7777777-1';

      // Sibling 1
      const sib1 = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Family Sibling One',
        guardian_name: 'Parent Shared',
        guardian_phone: '+92 321 1111111',
        guardian_id_card: sharedFamilyCnic,
        program_id: batch.program_id,
        batch_id: batch.id,
      });

      // Sibling 2
      const sib2 = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Family Sibling Two',
        guardian_name: 'Parent Shared',
        guardian_phone: '+92 321 1111111',
        guardian_id_card: sharedFamilyCnic,
        program_id: batch.program_id,
        batch_id: batch.id,
      });

      // Fetch users
      const allUsers = await store.getTenantUsers(tenantId);
      const parentUser = allUsers.find(u => u.role === 'parent' && (u.metadata as any)?.clean_guardian_id_card === sharedFamilyCnic.replace(/[^0-9a-zA-Z]/g, '').toLowerCase())!;
      expect(parentUser).toBeDefined();
      const originalParentHash = parentUser.password_hash;

      const sib1User = allUsers.find(u => u.id === sib1.user_id)!;
      const originalSib1Hash = sib1User.password_hash;
      const sib2User = allUsers.find(u => u.id === sib2.user_id)!;
      const originalSib2Hash = sib2User.password_hash;

      // Perform administrative password reset on Sibling 1
      await store.resetStudentPassword(tenantId, sib1.id, {
        newPassword: 'BrandNewPassword123!',
        adminUserId: 'admin-1',
        adminName: 'Principal Administrator',
      });

      // Sibling 1 password must be updated
      const updatedSib1User = (await store.getTenantUsers(tenantId)).find(u => u.id === sib1.user_id)!;
      expect(updatedSib1User.password_hash).not.toBe(originalSib1Hash);

      // Parent password must NOT be touched or overwritten!
      const refreshedParentUser = (await store.getTenantUsers(tenantId)).find(u => u.id === parentUser.id)!;
      expect(refreshedParentUser.password_hash).toBe(originalParentHash);

      // Sibling 2 password must also remain untouched
      const refreshedSib2User = (await store.getTenantUsers(tenantId)).find(u => u.id === sib2.user_id)!;
      expect(refreshedSib2User.password_hash).toBe(originalSib2Hash);
    });
  });

  // =========================================================================
  // 9. HIGH H3: PORTAL BLOCKING METADATA & LIFECYCLE
  // =========================================================================
  describe('9. High H3: Portal Blocking Metadata & Lifecycle Handling', () => {
    it('Sets user.metadata.portal_blocked = true on alumni/withdrawn/suspended and restores on active', async () => {
      // Transition studentB to alumni
      await store.updateStudentStatus(
        tenantId,
        studentB.id,
        'alumni',
        'Graduated high school',
        false,
        'admin-1'
      );

      const allUsers = await store.getTenantUsers(tenantId);
      const userB = allUsers.find(u => u.id === studentB.user_id)!;
      expect(userB.status).toBe('inactive');
      expect((userB.metadata as any)?.portal_blocked).toBe(true);

      // Transition studentB back to active
      await store.updateStudentStatus(
        tenantId,
        studentB.id,
        'active',
        'Enrolled for higher certificate',
        false,
        'admin-1'
      );

      const reactivatedUsers = await store.getTenantUsers(tenantId);
      const reactivatedUserB = reactivatedUsers.find(u => u.id === studentB.user_id)!;
      expect(reactivatedUserB.status).toBe('active');
      expect((reactivatedUserB.metadata as any)?.portal_blocked).toBe(false);
    });
  });

  // =========================================================================
  // 10. HIGH H4: KINSHIP CONCESSION ENFORCEMENT
  // =========================================================================
  describe('10. High H4: Kinship Concession Enforcement', () => {
    it('Rejects kinship concession when require_active_sibling is enabled and sibling is not active', async () => {
      const tenant = (await store.getTenantById(tenantId))!;
      if (!tenant.settings) tenant.settings = {} as any;
      if (!tenant.settings.fee_rules) tenant.settings.fee_rules = {} as any;
      tenant.settings.fee_rules.kinship_rules = {
        enabled: true,
        discount_percentage: 25,
        require_active_sibling: true,
      };

      const batches = await store.getBatches(tenantId);
      const batch = batches[0];

      // 1. Rejects if kinship concession has no sibling_student_id
      await expect(
        store.createStudent({
          tenant_id: tenantId,
          full_name: 'Kinship Applicant Without Sibling',
          guardian_name: 'Parent Kin',
          guardian_phone: '+92 300 8881111',
          guardian_id_card: '35201-8881111-1',
          program_id: batch.program_id,
          batch_id: batch.id,
          fee_structure: {
            concession_category: 'kinship',
            concession_val: 25,
          },
        })
      ).rejects.toThrow(/requires an active sibling/i);

      // 2. Rejects if linked sibling is not active (e.g. withdrawn)
      const inactiveSibling = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Inactive Older Sibling',
        guardian_name: 'Parent Kin',
        guardian_phone: '+92 300 8881111',
        guardian_id_card: '35201-8881111-1',
        program_id: batch.program_id,
        batch_id: batch.id,
        status: 'withdrawn',
      });

      await expect(
        store.createStudent({
          tenant_id: tenantId,
          full_name: 'Kinship Applicant With Withdrawn Sibling',
          guardian_name: 'Parent Kin',
          guardian_phone: '+92 300 8881111',
          guardian_id_card: '35201-8881111-1',
          program_id: batch.program_id,
          batch_id: batch.id,
          sibling_student_id: inactiveSibling.id,
          fee_structure: {
            concession_category: 'kinship',
            concession_val: 25,
          },
        })
      ).rejects.toThrow(/must be active/i);

      // 3. Succeeds if linked sibling is active
      const activeSibling = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Active Older Sibling',
        guardian_name: 'Parent Kin',
        guardian_phone: '+92 300 8881111',
        guardian_id_card: '35201-8881111-1',
        program_id: batch.program_id,
        batch_id: batch.id,
        status: 'active',
      });

      const successfulKinshipStudent = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Approved Kinship Student',
        guardian_name: 'Parent Kin',
        guardian_phone: '+92 300 8881111',
        guardian_id_card: '35201-8881111-1',
        program_id: batch.program_id,
        batch_id: batch.id,
        sibling_student_id: activeSibling.id,
        fee_structure: {
          concession_category: 'kinship',
          concession_val: 25,
        },
      });

      expect(successfulKinshipStudent).toBeDefined();
      expect(successfulKinshipStudent.sibling_student_id).toBe(activeSibling.id);
    });
  });

  // =========================================================================
  // 11. MEDIUM M7: EXAM ACADEMIC SUMMARY MULTI-BATCH ROLLUP
  // =========================================================================
  describe('11. Medium M7: Exam Academic Summary Multi-Batch Rollup', () => {
    it('Includes exam evaluations in academic summary even when exam batch_ids is an array or from past batches', async () => {
      const batches = await store.getBatches(tenantId);
      const batch1 = batches[0];
      const subjects = await store.getSubjects(tenantId);
      const subject = subjects[0];

      // Create an active student for exam evaluation
      const examStudent = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Exam Summary Student',
        phone: '+92 300 1239999',
        guardian_name: 'Guardian Exam',
        guardian_phone: '+92 300 1238888',
        guardian_id_card: '35201-9876543-1',
        program_id: batch1.program_id,
        batch_id: batch1.id,
        subjects: [subject.id],
      });

      // Ensure student has evaluated exam
      const pastExam = await store.createExam(tenantId, {
        title: 'Term 1 Chemistry',
        exam_type: 'midterm',
        subject_id: subject.id,
        batch_ids: [batch1.id],
        total_marks: 100,
        passing_marks: 50,
        start_date: '2026-08-01',
      });

      await store.evaluateStudentExam(tenantId, {
        exam_id: pastExam.id,
        student_id: examStudent.id,
        short_score: 88,
        evaluated_by: 'teacher-1',
      });

      const summary = await store.getStudentAcademicSummary(tenantId, examStudent.id);
      expect(summary.exams.length).toBeGreaterThan(0);
      const foundExam = summary.exams.find(e => e.id === pastExam.id);
      expect(foundExam).toBeDefined();
      expect(foundExam?.total_obtained).toBe(88);
      expect(foundExam?.status).toBe('evaluated');
    });
  });

  // =========================================================================
  // 12. HIGH H6: DYNAMIC TENANT DOMAIN IN PASSWORD RESET & AUTHENTICATION
  // =========================================================================
  describe('12. High H6: Dynamic Tenant Domain Isolation', () => {
    it('Creates and resolves student portal users using custom tenant domain instead of @kampus.pk', async () => {
      // 1. Provision a custom tenant with custom domain
      const { tenant: customTenant } = await store.createTenant({
        name: 'Beaconhouse Custom Campus',
        slug: 'beacon-custom',
        admin_name: 'Director Beacon',
        admin_email: 'director@beaconhouse-custom.edu.pk',
      });
      // Explicitly set custom domain on tenant
      customTenant.domain = 'beaconhouse-custom.edu.pk';
      await (store as any).schedulePersist?.();

      const customProgram = await store.createProgram({
        tenant_id: customTenant.id,
        name: 'Matriculation Science',
        code: 'MAT-SCI',
      });
      const customBatch = await store.createBatch({
        tenant_id: customTenant.id,
        program_id: customProgram.id,
        name: 'Matric 2026 Batch A',
        capacity: 40,
        start_date: '2026-09-01',
        end_date: '2027-06-30',
      });

      // 2. Admit student in custom domain tenant
      const customStudent = await store.createStudent({
        tenant_id: customTenant.id,
        full_name: 'Custom Domain Scholar',
        phone: '+92 300 7771122',
        guardian_name: 'Custom Guardian',
        guardian_phone: '+92 300 7771133',
        guardian_id_card: '35201-7771122-1',
        program_id: customProgram.id,
        batch_id: customBatch.id,
        roll_number: 'ROL-BEACON-001',
      });

      // 3. Reset student password via store
      const resetResult = await store.resetStudentPassword(customTenant.id, customStudent.id);
      expect(resetResult.user.email).toContain('@beaconhouse-custom.edu.pk');
      expect(resetResult.user.email).not.toContain('@kampus.pk');

      // 4. Verify the student user account was created with custom domain
      const studentUser = await store.getUserByEmail(customTenant.id, resetResult.user.email);
      expect(studentUser).toBeDefined();
      expect(studentUser?.email).toBe(resetResult.user.email);
      expect(studentUser?.email.endsWith('@beaconhouse-custom.edu.pk')).toBe(true);

      // 5. Authenticate via /api/v1/auth/login using student's CNIC and the temporary password
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: customStudent.guardian_id_card,
          password: resetResult.default_password,
          tenant_slug: customTenant.slug,
        },
      });

      expect(loginRes.statusCode).toBe(200);
      const loginBody = loginRes.json();
      expect(loginBody.data.user.email).toBe(resetResult.user.email);
      expect(loginBody.data.user.email).toContain('@beaconhouse-custom.edu.pk');
      expect(loginBody.data.user.email).not.toContain('@kampus.pk');

      // 6. Test status update: ensure parent matching does not fall back to @kampus.pk
      const updatedStudent = await store.updateStudentStatus(customTenant.id, customStudent.id, 'withdrawn', 'Family relocation');
      expect(updatedStudent?.status).toBe('withdrawn');
    });
  });

  // =========================================================================
  // 13. MEDIUM M2: CONCESSION CATEGORY API & STORE PERSISTENCE
  // =========================================================================
  describe('13. Medium M2: Concession Category End-to-End Persistence', () => {
    it('Preserves concession_category sent by admission form through API validation and persists to student & fee_structure', async () => {
      const batches = await store.getBatches(tenantId);
      const batch = batches[0];

      // 1. Submit admission request with concession_category via POST /api/v1/sis/students
      const admissionRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          first_name: 'Aisha',
          last_name: 'Tariq',
          guardian_name: 'Tariq Mehmood',
          guardian_phone: '+92 300 4455667',
          guardian_id_card: '35201-4455667-1',
          batch_id: batch.id,
          concession_category: 'merit_scholarship',
          fee_structure: {
            tuition_fee: 8000,
            concession_category: 'merit_scholarship',
            concession_val: 50,
          },
        },
      });

      expect(admissionRes.statusCode).toBe(201);
      const createdStudent = admissionRes.json().data;
      expect(createdStudent).toBeDefined();
      expect(createdStudent.concession_category).toBe('merit_scholarship');
      expect(createdStudent.fee_structure.concession_category).toBe('merit_scholarship');

      // 2. Fetch the created student via GET /api/v1/sis/students/:id to verify persistence
      const fetchRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${createdStudent.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(fetchRes.statusCode).toBe(200);
      const fetchedStudent = fetchRes.json().data;
      expect(fetchedStudent.concession_category).toBe('merit_scholarship');
      expect(fetchedStudent.fee_structure.concession_category).toBe('merit_scholarship');

      // 3. Verify in store directly
      const storeStudent = await store.getStudentById(tenantId, createdStudent.id);
      expect(storeStudent?.concession_category).toBe('merit_scholarship');
      expect(storeStudent?.fee_structure?.concession_category).toBe('merit_scholarship');
    });
  });

  // =========================================================================
  // 14. STRICT STUDENT ID FEE & LEDGER MATCHING (NO ROLL NUMBER CROSS-SECTION CONTAMINATION)
  // =========================================================================
  describe('14. Strict Student ID Fee Matching (No Roll Number Cross-Section Contamination)', () => {
    it('Never attributes invoices across students with identical roll numbers in different sections/batches', async () => {
      const programs = await store.getPrograms(tenantId);
      const program = programs[0];

      // Create two distinct sections
      const sectionA = await store.createBatch({
        tenant_id: tenantId,
        program_id: program.id,
        name: 'Section A - 2026',
        capacity: 30,
        start_date: '2026-09-01',
        end_date: '2027-06-30',
      });
      const sectionB = await store.createBatch({
        tenant_id: tenantId,
        program_id: program.id,
        name: 'Section B - 2026',
        capacity: 30,
        start_date: '2026-09-01',
        end_date: '2027-06-30',
      });

      // Student 1 in Section A with roll 'R-101'
      const student1 = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Student Section A',
        phone: '+92 300 1110001',
        guardian_name: 'Guardian One',
        guardian_phone: '+92 300 2220001',
        guardian_id_card: '35201-1110001-1',
        program_id: program.id,
        batch_id: sectionA.id,
        roll_number: 'R-101',
        fee_structure: {
          base_tuition: 15000,
        },
      });

      // Student 2 in Section B with SAME roll 'R-101'
      const student2 = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Student Section B',
        phone: '+92 300 1110002',
        guardian_name: 'Guardian Two',
        guardian_phone: '+92 300 2220002',
        guardian_id_card: '35201-1110002-2',
        program_id: program.id,
        batch_id: sectionB.id,
        roll_number: 'R-101',
      });

      // 1. Generate PKR 15,000 invoice for Student 1
      const inv1 = await store.generateInvoice(tenantId, {
        student_id: student1.id,
        billing_month: '2026-10',
        due_date: '2026-10-10',
        custom_amount: 15000,
      });

      // 2. Query directory & profile for Student 1: unpaid balance must be 15,000
      const fetchedS1 = await store.getStudentById(tenantId, student1.id);
      expect(fetchedS1?.unpaid_balance).toBe(15000);
      expect(fetchedS1?.fee_clearance_status).not.toBe('cleared');

      // 3. Query directory & profile for Student 2: unpaid balance MUST BE 0 and fee clearance status cleared!
      const fetchedS2 = await store.getStudentById(tenantId, student2.id);
      expect(fetchedS2?.unpaid_balance).toBe(0);
      expect(fetchedS2?.fee_clearance_status).toBe('cleared');

      // 4. Portal overview for Student 2: 0 unpaid balance, 0 invoices
      const portalS2 = await store.getStudentParentPortalOverview(tenantId, student2.id);
      expect(portalS2.unpaid_balance).toBe(0);
      expect(portalS2.invoices.length).toBe(0);

      // 5. Updating Student 2 status with cancelUnpaidInvoices: true does NOT cancel Student 1's invoice
      await store.updateStudentStatus(tenantId, student2.id, 'withdrawn', 'Moving abroad', true);
      const invCheck = await store.getInvoiceById(tenantId, inv1.id);
      expect(invCheck?.status).toBe('unpaid');
      expect(invCheck?.balance_due ?? invCheck?.balance_amount).toBe(15000);

      // 6. Deleting Student 2 does NOT delete Student 1's invoice
      const delResult = await store.deleteStudent(tenantId, student2.id);
      expect(delResult.success).toBe(true);
      const invStillExists = await store.getInvoiceById(tenantId, inv1.id);
      expect(invStillExists).toBeDefined();
      expect(invStillExists?.student_id).toBe(student1.id);
    });
  });

  // =========================================================================
  // 15. PASSWORD RESET IDENTITY ISOLATION (NO SIBLING OR WILDCARD STEALING)
  // =========================================================================
  describe('15. Password Reset Identity Isolation Across Sibling and Portal Accounts', () => {
    it('Never attaches a sibling or unrelated student user account when resetting password for student without user_id', async () => {
      const batches = await store.getBatches(tenantId);
      const batch = batches[0];
      const sharedCnic = '35201-9999888-1';

      // 1. Admit Sibling 1 (user account auto-provisioned)
      const sibling1 = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Older Sibling Zara',
        guardian_name: 'Parent Tariq',
        guardian_phone: '+92 300 9999888',
        guardian_id_card: sharedCnic,
        program_id: batch.program_id,
        batch_id: batch.id,
        roll_number: 'ROL-SIB-1',
      });
      const sibling1UserId = sibling1.user_id;
      expect(sibling1UserId).toBeDefined();
      const sibling1User = (await store.getUserByEmail(tenantId, (sibling1 as any).email || `std.${sibling1.admission_number.toLowerCase().replace(/[^a-z0-9]/g, '')}@apex.edu.pk`)) || (await store.getTenantUsers(tenantId)).find(u => u.id === sibling1UserId);
      expect(sibling1User).toBeDefined();
      const originalSib1PasswordHash = sibling1User?.password_hash;

      // 2. Admit Sibling 2 sharing SAME guardian and CNIC, but deliberately clear user_id to simulate unlinked state
      const sibling2 = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Younger Sibling Bilal',
        guardian_name: 'Parent Tariq',
        guardian_phone: '+92 300 9999888',
        guardian_id_card: sharedCnic,
        program_id: batch.program_id,
        batch_id: batch.id,
        roll_number: 'ROL-SIB-2',
      });
      // Detach user_id from sibling2 to test password reset recovery without stealing Sibling 1's user
      sibling2.user_id = undefined;

      // 3. Reset password for Sibling 2
      const resetResult = await store.resetStudentPassword(tenantId, sibling2.id, {
        newPassword: 'BilalNewPassword@2026',
        adminName: 'Exam Controller',
        adminUserId: 'admin-1',
      });

      // 4. Sibling 2 MUST NOT have stolen Sibling 1's user account!
      expect(resetResult.user.id).not.toBe(sibling1UserId);
      expect(sibling2.user_id).not.toBe(sibling1UserId);
      expect(resetResult.user.email).not.toContain(sibling1.admission_number.toLowerCase());

      // 5. Sibling 1's password hash and user record MUST remain completely unchanged!
      const sibling1UserAfter = (await store.getTenantUsers(tenantId)).find(u => u.id === sibling1UserId);
      expect(sibling1UserAfter?.password_hash).toBe(originalSib1PasswordHash);

      // 6. Sibling 2 has their own distinct user account linked to sibling2
      expect(sibling2.user_id).toBe(resetResult.user.id);
      expect(resetResult.user.metadata?.admission_number).toBe(sibling2.admission_number);

      // 7. Both siblings can authenticate independently with their own passwords
      const authService = new AuthService(store, { sendOTP: async () => true, sendCustom: async () => true });
      const tenantObj = await store.getTenantById(tenantId);
      const sib1Login = await authService.loginWithPassword(sharedCnic, 'Student@123', tenantObj?.slug);
      expect(sib1Login.user.id).toBe(sibling1UserId);

      const sib2Login = await authService.loginWithPassword(sharedCnic, 'BilalNewPassword@2026', tenantObj?.slug);
      expect(sib2Login.user.id).toBe(resetResult.user.id);

      await expect(authService.loginWithPassword(sibling2.admission_number, 'BilalNewPassword@2026', tenantObj?.slug)).rejects.toThrow(/invalid email or password/i);
      await expect(authService.loginWithPassword(sibling2.email || `std.${sibling2.admission_number}@kampus.pk`, 'BilalNewPassword@2026', tenantObj?.slug)).rejects.toThrow(/invalid email or password/i);
    });
  });
});
