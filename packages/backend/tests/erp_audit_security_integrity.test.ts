import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { IMailerService } from '../src/services/mailer.js';

describe('ERP Audit Remediation: RBAC, Isolation, Financial Linkage & Student Lifecycle', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  let adminToken: string;
  let teacherToken: string;

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

    // Sign admin token
    adminToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000001',
      user_id: 'a1000000-0000-0000-0000-000000000001',
      tenant_id: tenantId,
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin',
    });

    // Sign teacher token
    teacherToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000002',
      user_id: 'a1000000-0000-0000-0000-000000000002',
      tenant_id: tenantId,
      email: 'tariq@apexacademy.edu.pk',
      role: 'teacher',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // 1. RBAC Guard Enforcement
  // ---------------------------------------------------------------------------
  it('1. Rejects teacher role from payroll, finance mutations, and student creation with 403', async () => {
    // Payroll endpoint blocked
    const payrollRes = await app.inject({
      method: 'GET',
      url: '/api/v1/payroll/profiles',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(payrollRes.statusCode).toBe(403);
    expect(JSON.parse(payrollRes.body).error.code).toBe('FORBIDDEN_ROLE');

    // Finance invoice generation blocked
    const genInvoiceRes = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/invoices/generate',
      headers: { Authorization: `Bearer ${teacherToken}` },
      payload: {
        student_id: 's0000000-0000-0000-0000-000000000001',
        billing_month: '2026-10',
        due_date: '2026-10-10',
      },
    });
    expect(genInvoiceRes.statusCode).toBe(403);
    expect(JSON.parse(genInvoiceRes.body).error.code).toBe('FORBIDDEN_ROLE');

    // Student creation blocked for teacher
    const createStudentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { Authorization: `Bearer ${teacherToken}` },
      payload: {
        full_name: 'Unauthorized Student',
        phone: '+92 300 1112233',
        guardian_name: 'Guardian Test',
        guardian_phone: '+92 300 2223344',
        program_id: 'p0000000-0000-0000-0000-000000000001',
        batch_id: 'b0000000-0000-0000-0000-000000000001',
      },
    });
    expect(createStudentRes.statusCode).toBe(403);
    expect(JSON.parse(createStudentRes.body).error.code).toBe('FORBIDDEN_ROLE');
  });

  // ---------------------------------------------------------------------------
  // 2. Account Status Check & Token Invalidation
  // ---------------------------------------------------------------------------
  it('2. Denies access immediately if account status is suspended or inactive', async () => {
    // Suspend the teacher user in store
    const user = await store.getUserByEmail(tenantId, 'tariq@apexacademy.edu.pk');
    expect(user).toBeDefined();
    if (user) {
      user.status = 'suspended';
    }

    const testRes = await app.inject({
      method: 'GET',
      url: '/api/v1/sis/students',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(testRes.statusCode).toBe(403);
    const body = JSON.parse(testRes.body);
    expect(body.error.code).toBe('ACCOUNT_NOT_ACTIVE');

    // Restore for subsequent test hygiene
    if (user) {
      user.status = 'active';
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Cross-Tenant Data Isolation
  // ---------------------------------------------------------------------------
  it('3. Prevents cross-tenant leaking when resolving portal overview and batches', async () => {
    // Unknown tenant trying to query portal overview
    const fakeTenantId = 'f0000000-0000-0000-0000-000000000000';
    await expect(store.getStudentParentPortalOverview(fakeTenantId)).rejects.toThrow(
      /Student not found in tenant/
    );
  });

  // ---------------------------------------------------------------------------
  // 4. Financial Cashbook Auto-Posting on Fee Collection
  // ---------------------------------------------------------------------------
  it('4. Automatically records an Income FinancialTransaction voucher upon fee payment', async () => {
    // 1. Get an existing invoice for tenant
    const invoices = await store.getInvoices(tenantId);
    expect(invoices.length).toBeGreaterThan(0);
    const targetInvoice = invoices[0];

    const initialTransactions = await store.getFinancialTransactions(tenantId);
    const initialCount = initialTransactions.length;

    // 2. Record fee payment
    const paymentResult = await store.recordPayment(tenantId, {
      invoice_id: targetInvoice.id,
      amount_paid: 1000,
      payment_method: 'cash',
      collected_by: 'Test Cashier',
      notes: 'Monthly fee test collection',
    });

    expect(paymentResult).toBeDefined();
    expect(paymentResult.payment).toBeDefined();
    expect(paymentResult.payment.receipt_number).toBeDefined();

    // 3. Verify FinancialTransaction was created in cashbook
    const updatedTransactions = await store.getFinancialTransactions(tenantId);
    expect(updatedTransactions.length).toBe(initialCount + 1);

    const autoVoucher = updatedTransactions.find(t => t.reference_number === paymentResult.payment.receipt_number);
    expect(autoVoucher).toBeDefined();
    expect(autoVoucher?.type).toBe('income');
    expect(autoVoucher?.head_name).toBe('Student Fee Collection');
    expect(autoVoucher?.amount).toBe(1000);
    expect(autoVoucher?.voucher_number).toMatch(/^VCH-INC-/);
  });

  // ---------------------------------------------------------------------------
  // 5. Staff Salary Payslip Payment Auto-Posting
  // ---------------------------------------------------------------------------
  it('5. Automatically records an Expense FinancialTransaction voucher upon payslip disbursement', async () => {
    const initialTransactions = await store.getFinancialTransactions(tenantId);
    const initialCount = initialTransactions.length;

    // 1. Configure salary profile and generate payslip
    const user = await store.getUserByEmail(tenantId, 'tariq@apexacademy.edu.pk');
    expect(user).toBeDefined();

    await store.saveStaffSalaryProfile({
      tenant_id: tenantId,
      staff_id: user!.id,
      base_salary: 50000,
      allowances: [],
      deductions: [],
      payment_method: 'bank_transfer',
    });

    const payslip = await store.generatePayslip(tenantId, {
      staff_id: user!.id,
      payroll_month: '2026-09',
      earnings: [{ title: 'Base Salary', amount: 50000 }],
      deductions: [],
      processed_by: 'System Admin',
    });
    expect(payslip).toBeDefined();

    // 2. Mark payslip paid
    const paidPayslip = await store.markPayslipPaid(
      tenantId,
      payslip.id,
      'bank_transfer',
      'TRX-SALARY-TEST-999',
      'HR Director'
    );
    expect(paidPayslip.status).toBe('paid');

    // 3. Verify Expense Transaction was created
    const updatedTransactions = await store.getFinancialTransactions(tenantId);
    expect(updatedTransactions.length).toBe(initialCount + 1);

    const expenseVoucher = updatedTransactions.find(t => t.reference_number === 'TRX-SALARY-TEST-999');
    expect(expenseVoucher).toBeDefined();
    expect(expenseVoucher?.type).toBe('expense');
    expect(expenseVoucher?.head_name).toBe('Staff Salaries & Payroll');
    expect(expenseVoucher?.voucher_number).toMatch(/^VCH-EXP-/);
  });

  // ---------------------------------------------------------------------------
  // 6. Student Lifecycle, Status Transition & Exit Regularization
  // ---------------------------------------------------------------------------
  it('6. Updates student status, cancels unpaid invoices with PKR 0 balance, and writes audit history', async () => {
    // 1. Create a student with an unpaid invoice
    const newStudent = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Zainab Bibi',
      phone: '+92 311 9876543',
      guardian_name: 'Muhammad Aslam',
      guardian_phone: '+92 321 9876543',
      program_id: 'p0000000-0000-0000-0000-000000000001',
      batch_id: 'b0000000-0000-0000-0000-000000000001',
      generate_first_month_invoice: true,
      fee_structure: {
        base_tuition: 5000,
        admission_fee: 1000,
        exam_fee: 500,
        concession_type: 'flat',
        concession_val: 0,
        net_tuition: 5000,
        first_month_total: 6500,
      },
    });

    expect(newStudent).toBeDefined();
    expect(newStudent.status).toBe('active');

    // Verify unpaid invoice exists specifically for this student
    const invoicesBefore = await store.getInvoices(tenantId, { studentId: newStudent.id });
    expect(invoicesBefore.length).toBeGreaterThan(0);
    expect(invoicesBefore[0].status.toLowerCase()).toBe('unpaid');
    expect(invoicesBefore[0].balance_amount).toBeGreaterThan(0);

    // 2. Perform withdrawal via endpoint
    const withdrawRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sis/students/${newStudent.id}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        status: 'withdrawn',
        reason: 'Family relocated to Rawalpindi; formal clearance issued.',
        cancel_unpaid_invoices: true,
      },
    });

    expect(withdrawRes.statusCode).toBe(200);
    const updated = JSON.parse(withdrawRes.body).data;
    expect(updated.status).toBe('withdrawn');
    expect(updated.status_reason).toContain('Family relocated to Rawalpindi');
    expect(updated.status_change_history).toHaveLength(1);
    expect(updated.status_change_history[0].previous_status).toBe('active');
    expect(updated.status_change_history[0].new_status).toBe('withdrawn');

    // 3. Verify unpaid invoices for this student are cancelled and balance is zeroed
    const invoicesAfter = await store.getInvoices(tenantId, { studentId: newStudent.id });
    expect(invoicesAfter.length).toBeGreaterThan(0);
    for (const inv of invoicesAfter) {
      expect(inv.status).toBe('cancelled');
      expect(inv.balance_amount).toBe(0);
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Dynamic Examination Grading Scale Calculation
  // ---------------------------------------------------------------------------
  it('7. Dynamically evaluates student exam results according to Pakistani grading tiers', async () => {
    // Evaluate an exam with 85% score -> A+
    const exam = await store.createExam(tenantId, {
      title: 'Midterm Physics Exam',
      batch_id: 'b0000000-0000-0000-0000-000000000001',
      subject_id: 's0000000-0000-0000-0000-000000000001',
      exam_date: '2026-09-15',
      total_marks: 100,
      passing_marks: 33,
    });

    const students = await store.getStudents(tenantId);
    const student = students[0];

    // Score 85 -> A+
    const evalAplus = await store.evaluateStudentExam(tenantId, {
      exam_id: exam.id,
      student_id: student.id,
      short_score: 85,
      short_remarks: 'Excellent performance',
    });
    expect(evalAplus.grade).toBe('A+');

    // Score 72 -> A
    const evalA = await store.evaluateStudentExam(tenantId, {
      exam_id: exam.id,
      student_id: student.id,
      short_score: 72,
    });
    expect(evalA.grade).toBe('A');

    // Score 55 -> C
    const evalC = await store.evaluateStudentExam(tenantId, {
      exam_id: exam.id,
      student_id: student.id,
      short_score: 55,
    });
    expect(evalC.grade).toBe('C');

    // Score 25 -> F
    const evalF = await store.evaluateStudentExam(tenantId, {
      exam_id: exam.id,
      student_id: student.id,
      short_score: 25,
    });
    expect(evalF.grade).toBe('F');
  });
});
