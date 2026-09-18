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
import { JWTPayload, Student, StudentInvoice } from '@apex/shared-types';

describe('SIS Remediation & Security Integrity Verification', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  const tenantId = 'a0000000-0000-0000-0000-000000000001';

  let adminToken: string;
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
        reply.status(401).send({ success: false, error: 'Unauthorized' });
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

    // Student A Token
    studentAToken = app.jwt.sign({
      sub: studentA.user_id || 'user-alpha',
      tenant_id: tenantId,
      email: 'alpha@apex.edu.pk',
      role: 'student',
      student_id: studentA.id,
      admission_number: studentA.admission_number,
      cnic: studentA.guardian_id_card,
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
});
