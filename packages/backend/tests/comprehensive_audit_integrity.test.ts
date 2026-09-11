import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { IMailerService } from '../src/services/mailer.js';

describe('Comprehensive ERP Audit Remediation & Integrity Test Suite', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;

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
      jwtSecret: 'test-secret-min-32-chars-long-for-vitest',
    });
    await app.ready();

    // 1. Admin Token
    adminToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000001',
      user_id: 'a1000000-0000-0000-0000-000000000001',
      tenant_id: tenantId,
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin',
    });

    // 2. Teacher Token
    teacherToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000002',
      user_id: 'a1000000-0000-0000-0000-000000000002',
      tenant_id: tenantId,
      email: 'tariq@apexacademy.edu.pk',
      role: 'teacher',
    });

    // 3. Student Token
    studentToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000005',
      user_id: 'a1000000-0000-0000-0000-000000000005',
      tenant_id: tenantId,
      email: 'student@apexacademy.edu.pk',
      role: 'student',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // 1. RBAC Lockdown: Attendance, Exams, Homework & Timetable Mutations
  // ---------------------------------------------------------------------------
  it('1. Rejects student role from recording batch attendance with 403 FORBIDDEN_ROLE', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/students/batch',
      headers: { Authorization: `Bearer ${studentToken}` },
      payload: {
        batch_id: 'a3000000-0000-0000-0000-000000000001',
        date: '2026-09-11',
        records: [{ student_id: 'stud-1', status: 'present' }]
      }
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error.code).toBe('FORBIDDEN_ROLE');
  });

  it('2. Rejects student role from exam creation, questions, and evaluation with 403', async () => {
    // Exam creation blocked
    const createExamRes = await app.inject({
      method: 'POST',
      url: '/api/v1/exams',
      headers: { Authorization: `Bearer ${studentToken}` },
      payload: {
        title: 'Unauthorized Exam',
        exam_type: 'MONTHLY',
        batch_id: 'a3000000-0000-0000-0000-000000000001',
        subject_id: 'sub-phy-1',
        date: '2026-09-20',
        start_time: '10:00',
        end_time: '11:00'
      }
    });
    expect(createExamRes.statusCode).toBe(403);

    // Exam evaluation blocked
    const evalRes = await app.inject({
      method: 'POST',
      url: '/api/v1/exams/exam-1/evaluate',
      headers: { Authorization: `Bearer ${studentToken}` },
      payload: {
        student_id: 'stud-1',
        short_score: 20
      }
    });
    expect(evalRes.statusCode).toBe(403);
  });

  it('3. Rejects student role from homework creation and notebook checking with 403', async () => {
    const hwRes = await app.inject({
      method: 'POST',
      url: '/api/v1/homework',
      headers: { Authorization: `Bearer ${studentToken}` },
      payload: {
        batch_id: 'a3000000-0000-0000-0000-000000000001',
        subject_id: 'sub-phy-1',
        title: 'Unauthorized HW',
        description: 'Read chapter 1',
        assigned_date: '2026-09-11',
        due_date: '2026-09-12'
      }
    });
    expect(hwRes.statusCode).toBe(403);

    const checkRes = await app.inject({
      method: 'POST',
      url: '/api/v1/homework/hw-1/checks',
      headers: { Authorization: `Bearer ${studentToken}` },
      payload: {
        records: []
      }
    });
    expect(checkRes.statusCode).toBe(403);
  });

  it('4. Rejects student role from timetable room and slot management with 403', async () => {
    const roomRes = await app.inject({
      method: 'POST',
      url: '/api/v1/timetable/rooms',
      headers: { Authorization: `Bearer ${studentToken}` },
      payload: { name: 'Unauthorized Room', capacity: 30 }
    });
    expect(roomRes.statusCode).toBe(403);

    const slotRes = await app.inject({
      method: 'POST',
      url: '/api/v1/timetable',
      headers: { Authorization: `Bearer ${studentToken}` },
      payload: {
        batch_id: 'a3000000-0000-0000-0000-000000000001',
        subject_id: 'sub-phy-1',
        teacher_id: 'a1000000-0000-0000-0000-000000000002',
        day_of_week: 'monday',
        start_time: '14:00',
        end_time: '15:00'
      }
    });
    expect(slotRes.statusCode).toBe(403);
  });

  // ---------------------------------------------------------------------------
  // 2. IDOR Portal Isolation
  // ---------------------------------------------------------------------------
  it('5. Prevents student from viewing another student profile via IDOR query param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent?student_id=stud-fake-or-other',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error.code).toBe('UNAUTHORIZED_STUDENT_ACCESS');
  });

  // ---------------------------------------------------------------------------
  // 3. Admissions & Waitlist Invoicing Suppression
  // ---------------------------------------------------------------------------
  it('6. Suppresses auto-invoicing when student status is waitlisted', async () => {
    const waitlistedStudent = await store.createStudent({
      tenant_id: tenantId,
      admission_number: 'ADM-WAITLIST-001',
      roll_number: 'W-01',
      full_name: 'Zainab Waitlist',
      phone: '+923007788990',
      guardian_name: 'Waitlist Father',
      guardian_phone: '+923007788991',
      program_id: 'a2000000-0000-0000-0000-000000000001',
      batch_id: 'a3000000-0000-0000-0000-000000000001',
      status: 'waitlisted',
      custom_field_values: {},
      subjects: [],
      admission_date: '2026-09-11',
      fee_structure: {
        tuition_fee: 10000,
        first_month_total: 15000
      }
    });

    expect(waitlistedStudent.status).toBe('waitlisted');
    expect(waitlistedStudent.first_invoice_id).toBeUndefined();

    // Verify no invoice generated for waitlisted student
    const invoices = await store.getInvoices(tenantId, { studentId: waitlistedStudent.id });
    expect(invoices.length).toBe(0);

    // Verify invoice creation throws if attempted directly for non-active student
    await expect(
      store.generateInvoice(tenantId, {
        student_id: waitlistedStudent.id,
        billing_month: 'October 2026',
        due_date: '2026-10-15'
      })
    ).rejects.toThrow(/Invoices can only be generated for active students/);
  });

  // ---------------------------------------------------------------------------
  // 4. Batch Capacity Tracking on Exit & Reactivation
  // ---------------------------------------------------------------------------
  it('7. Decrements batch enrollment on student withdrawal and checks capacity on reactivation', async () => {
    const batch = (await store.getBatches(tenantId)).find(b => b.id === 'a3000000-0000-0000-0000-000000000001')!;
    const initialEnrollment = batch.current_enrollment;

    // Withdraw active student
    await store.updateStudentStatus(
      tenantId,
      'stud-1',
      'withdrawn',
      'Student relocating to another city',
      'Director Adnan',
      false // Keep invoices for test hygiene
    );

    const updatedBatch = (await store.getBatches(tenantId)).find(b => b.id === 'a3000000-0000-0000-0000-000000000001')!;
    expect(updatedBatch.current_enrollment).toBe(initialEnrollment - 1);

    // Reactivate student
    await store.updateStudentStatus(
      tenantId,
      'stud-1',
      'active',
      'Re-admitted after relocation cancelled',
      'Director Adnan'
    );

    const reactivatedBatch = (await store.getBatches(tenantId)).find(b => b.id === 'a3000000-0000-0000-0000-000000000001')!;
    expect(reactivatedBatch.current_enrollment).toBe(initialEnrollment);
  });

  // ---------------------------------------------------------------------------
  // 5. Inactive Student Exam Evaluation Blocking
  // ---------------------------------------------------------------------------
  it('8. Throws error when evaluating exams for inactive or suspended students', async () => {
    // Suspend student
    await store.updateStudentStatus(
      tenantId,
      'stud-1',
      'suspended',
      'Disciplinary suspension pending review',
      'Director Adnan'
    );

    try {
      await expect(
        store.evaluateStudentExam(tenantId, {
          exam_id: 'exam-1',
          student_id: 'stud-1',
          short_score: 15
        })
      ).rejects.toThrow(/Evaluations are restricted to active students/);
    } finally {
      // Restore student to active
      await store.updateStudentStatus(
        tenantId,
        'stud-1',
        'active',
        'Suspension lifted',
        'Director Adnan'
      );
    }
  });

  // ---------------------------------------------------------------------------
  // 6. Fee Payment Receipt Voiding & Cashbook Reversal
  // ---------------------------------------------------------------------------
  it('9. Cashier voiding a fee payment reverses invoice balance and auto-posts reversing voucher', async () => {
    // 1. Generate a new active invoice
    const newInvoice = await store.generateInvoice(tenantId, {
      student_id: 'stud-1',
      billing_month: 'November 2026',
      due_date: '2026-11-15'
    });

    const initialPaid = newInvoice.paid_amount;
    const initialBalance = newInvoice.balance_amount;

    // 2. Collect payment
    const { payment, invoice: updatedInvoice } = await store.recordPayment(tenantId, {
      invoice_id: newInvoice.id,
      amount_paid: 2000,
      payment_method: 'cash',
      collected_by: 'Cashier Ali'
    });

    expect(updatedInvoice.paid_amount).toBe(initialPaid + 2000);
    expect(payment.status).toBeUndefined(); // Active receipt

    // 3. Void payment via API
    const voidRes = await app.inject({
      method: 'POST',
      url: `/api/v1/finance/payments/${payment.id}/void`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        void_reason: 'Erroneous double collection entered by cashier'
      }
    });

    expect(voidRes.statusCode).toBe(200);
    const voidBody = JSON.parse(voidRes.body);
    expect(voidBody.success).toBe(true);
    expect(voidBody.data.payment.status).toBe('voided');
    expect(voidBody.data.payment.void_reason).toBe('Erroneous double collection entered by cashier');
    expect(voidBody.data.invoice.paid_amount).toBe(initialPaid);
    expect(voidBody.data.invoice.balance_amount).toBe(initialBalance);

    // 4. Verify Cashbook contains the reversing expense voucher
    const transactions = await store.getFinancialTransactions(tenantId);
    const reversalVoucher = transactions.find(t => t.reference_number === `VOID-${payment.receipt_number}`);
    expect(reversalVoucher).toBeDefined();
    expect(reversalVoucher?.type).toBe('expense');
    expect(reversalVoucher?.amount).toBe(2000);

    // 5. Duplicate void rejection
    const repeatVoidRes = await app.inject({
      method: 'POST',
      url: `/api/v1/finance/payments/${payment.id}/void`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { void_reason: 'Trying again' }
    });
    expect(repeatVoidRes.statusCode).toBe(400);
    expect(JSON.parse(repeatVoidRes.body).error.message).toContain('already voided');
  });

  // ---------------------------------------------------------------------------
  // 7. Dated Timetable Substitution Overrides
  // ---------------------------------------------------------------------------
  it('10. Records dated timetable substitution in substitutions array without altering weekly master teacher', async () => {
    const slots = await store.getTimetable(tenantId);
    const targetSlot = slots[0];
    const originalTeacherId = targetSlot.teacher_id;

    // Assign substitute for specific date
    const updatedSlot = await store.assignSubstitute(
      tenantId,
      targetSlot.id,
      'a1000000-0000-0000-0000-000000000004', // Dr. Ayesha
      '2026-09-15',
      'Teacher on official duty at board center'
    );

    // Master slot teacher remains unchanged
    expect(updatedSlot.teacher_id).toBe(originalTeacherId);
    expect(updatedSlot.substitutions).toBeDefined();
    expect(updatedSlot.substitutions?.length).toBeGreaterThan(0);

    const sub = updatedSlot.substitutions?.find(s => s.date === '2026-09-15');
    expect(sub).toBeDefined();
    expect(sub?.substitute_teacher_id).toBe('a1000000-0000-0000-0000-000000000004');
    expect(sub?.reason).toBe('Teacher on official duty at board center');
  });

  // ---------------------------------------------------------------------------
  // 8. Student Attendance Modification Audit Log
  // ---------------------------------------------------------------------------
  it('11. Logs attendance audit log when existing student attendance status is modified', async () => {
    const batchId = 'a3000000-0000-0000-0000-000000000001';
    const testDate = '2026-09-12';

    // Step 1: Mark initial attendance as present
    await store.recordBatchAttendance(
      tenantId,
      batchId,
      testDate,
      [{ student_id: 'stud-1', status: 'present' }],
      'Teacher Tariq'
    );

    // Step 2: Modify attendance to absent with administrative remark
    await store.recordBatchAttendance(
      tenantId,
      batchId,
      testDate,
      [{ student_id: 'stud-1', status: 'absent', remarks: 'Left campus early without gate pass' }],
      'Director Adnan'
    );

    // Step 3: Verify audit log recorded
    const auditLogs = await store.getAttendanceAuditLogs(tenantId, 'stud-1', testDate);
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].previous_status).toBe('present');
    expect(auditLogs[0].new_status).toBe('absent');
    expect(auditLogs[0].reason).toBe('Left campus early without gate pass');
    expect(auditLogs[0].changed_by).toBe('Director Adnan');
  });
});
