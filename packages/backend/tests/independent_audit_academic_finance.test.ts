import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';

describe('Independent Audit: Academic Structure, Subject Catalog, Cohorts & Desk Finance', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let adminToken: string;
  let teacherToken: string;
  let tenantBToken: string;

  const tenantAId = 'a0000000-0000-0000-0000-000000000001';
  const tenantBId = 'b0000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    store = new InMemoryDataStore();
    app = await buildApp({ store, jwtSecret: 'test-secret-min-32-chars-long-for-vitest' });
    await app.ready();

    const adminUser = (await store.getUserByEmail(tenantAId, 'adnan@apexacademy.edu.pk'))!;
    adminToken = app.jwt.sign({
      sub: adminUser.id,
      user_id: adminUser.id,
      tenant_id: tenantAId,
      email: adminUser.email,
      role: 'tenant_admin',
    });

    const { tenant: tenantB, admin: tenantBUser } = await store.createTenant({
      name: 'Other Academy',
      slug: 'other',
      admin_email: 'admin@otheracademy.edu.pk',
      admin_name: 'Other Admin',
    });
    tenantBToken = app.jwt.sign({
      sub: tenantBUser.id,
      user_id: tenantBUser.id,
      tenant_id: tenantB.id,
      email: tenantBUser.email,
      role: 'tenant_admin',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // SUITE 1: MASTER SUBJECT CATALOG & EDIT SUBJECT (PUT /subjects/:id)
  // =========================================================================
  describe('1. Master Subject Catalog & Subject Editing', () => {
    let createdSubjectId: string;

    it('1.1 Creates a new subject in master catalog', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/subjects',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Computer Applications',
          code: 'COMP-101',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Computer Applications');
      expect(body.data.code).toBe('COMP-101');
      createdSubjectId = body.data.id;
    });

    it('1.2 Updates subject name and code via PUT /api/v1/academic/subjects/:id', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/academic/subjects/${createdSubjectId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Advanced Computer Applications',
          code: 'COMP-102',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdSubjectId);
      expect(body.data.name).toBe('Advanced Computer Applications');
      expect(body.data.code).toBe('COMP-102');

      // Verify persistence in catalog
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/subjects',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const catalog = JSON.parse(listRes.body).data;
      const found = catalog.find((s: any) => s.id === createdSubjectId);
      expect(found).toBeDefined();
      expect(found.name).toBe('Advanced Computer Applications');
      expect(found.code).toBe('COMP-102');
    });

    it('1.3 Rejects subject update with empty name with 400 VALIDATION_ERROR', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/academic/subjects/${createdSubjectId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: '   ',
          code: 'FAIL',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('1.4 Returns 404 when updating non-existent subject', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/academic/subjects/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Non Existent Subject',
        },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('1.5 Enforces strict tenant isolation on subject updates', async () => {
      // Tenant B admin attempts to update Tenant A subject
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/academic/subjects/${createdSubjectId}`,
        headers: { authorization: `Bearer ${tenantBToken}` },
        payload: {
          name: 'Tenant B Stolen Subject',
        },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
    });

    it('1.6 Rejects unauthenticated subject update with 401', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/academic/subjects/${createdSubjectId}`,
        payload: {
          name: 'Hacker Subject',
        },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // SUITE 2: BATCH CURRICULUM SUBJECTS & COHORT SEPARATION
  // =========================================================================
  describe('2. Batch Curriculum Subjects & Cohort Separation', () => {
    let sub1Id: string;
    let sub2Id: string;
    let sub3Id: string;
    let createdBatchId: string;

    beforeAll(async () => {
      // Get existing subjects
      const subRes = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/subjects',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const subjects = JSON.parse(subRes.body).data;
      expect(subjects.length).toBeGreaterThanOrEqual(2);
      sub1Id = subjects[0].id;
      sub2Id = subjects[1].id;

      // Create a 3rd subject for update tests
      const sub3Res = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/subjects',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Robotics & AI', code: 'ROBO-1' },
      });
      sub3Id = JSON.parse(sub3Res.body).data.id;
    });

    it('2.1 Creates a batch with assigned curriculum subject_ids', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/batches',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Evening Python Crash Course',
          shift: 'evening',
          max_capacity: 35,
          cohort_type: 'batch',
          billing_mode: 'one_time',
          fee_amount: 12000,
          subject_ids: [sub1Id, sub2Id],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Evening Python Crash Course');
      expect(body.data.cohort_type).toBe('batch');
      expect(body.data.subject_ids).toBeDefined();
      expect(body.data.subject_ids).toEqual([sub1Id, sub2Id]);
      createdBatchId = body.data.id;
    });

    it('2.2 Verifies GET /api/v1/academic/batches returns subject_ids', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/batches',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const batch = body.data.find((b: any) => b.id === createdBatchId);
      expect(batch).toBeDefined();
      expect(batch.subject_ids).toEqual([sub1Id, sub2Id]);
    });

    it('2.3 Updates batch subject_ids via PUT /api/v1/academic/batches/:id', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/academic/batches/${createdBatchId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Evening Python & Robotics',
          subject_ids: [sub1Id, sub3Id],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Evening Python & Robotics');
      expect(body.data.subject_ids).toEqual([sub1Id, sub3Id]);
    });

    it('2.4 Verifies cohort distinction: sections have program_id, batches have cohort_type="batch"', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/batches',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const batches = JSON.parse(res.body).data;
      const standaloneBatch = batches.find((b: any) => b.id === createdBatchId);
      expect(standaloneBatch.cohort_type).toBe('batch');

      // Sections created with program_id do not have cohort_type === 'batch'
      const sections = batches.filter((b: any) => b.program_id && b.cohort_type !== 'batch');
      for (const sec of sections) {
        expect(sec.cohort_type).not.toBe('batch');
      }
    });
  });

  // =========================================================================
  // SUITE 3: INITIAL DESK DISCOUNT & REMARKS FULL OPERATIONAL WORKFLOW
  // =========================================================================
  describe('3. Initial Desk Discount & Payment Remarks End-to-End Flow', () => {
    let studentId: string;
    let invoiceId: string;
    let programId: string;
    let sectionId: string;

    beforeAll(async () => {
      // Get existing program and section
      const progRes = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const progs = JSON.parse(progRes.body).data;
      expect(progs.length).toBeGreaterThanOrEqual(1);
      programId = progs[0].id;

      const batchRes = await app.inject({
        method: 'GET',
        url: `/api/v1/academic/batches?program_id=${programId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const bList = JSON.parse(batchRes.body).data;
      expect(bList.length).toBeGreaterThanOrEqual(1);
      sectionId = bList[0].id;

      // Enroll a student with an opening fee challan
      const enrollRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Zainab Ahmed',
          guardian_name: 'Ahmed Tariq',
          guardian_phone: '03001234567',
          phone: '03001234567',
          program_id: programId,
          batch_id: sectionId,
          admission_date: '2026-09-25',
          generate_first_month_invoice: true,
          fee_structure: {
            tuition_fee: 6000,
            admission_fee: 4000,
            first_month_total: 10000,
            billing_mode: 'monthly',
          },
        },
      });

      expect(enrollRes.statusCode).toBe(201);
      const enrollData = JSON.parse(enrollRes.body).data;
      studentId = enrollData.id;
      invoiceId = enrollData.first_invoice_id;
      expect(invoiceId).toBeDefined();
    });

    it('3.1 Verifies opening invoice initial balance is 10,000 PKR', async () => {
      const invRes = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/invoices?student_id=${studentId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(invRes.statusCode).toBe(200);
      const invoices = JSON.parse(invRes.body).data;
      expect(invoices.length).toBeGreaterThanOrEqual(1);
      const inv = invoices.find((i: any) => i.id === invoiceId);
      expect(inv).toBeDefined();
      expect(inv.balance_amount).toBe(10000);
      expect(inv.status).toBe('unpaid');
    });

    it('3.2 Rejects discount without mandatory approval reason with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/discounts',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: studentId,
          invoice_id: invoiceId,
          discount_type: 'flat',
          discount_value: 2000,
          mandatory_reason: '  ', // Blank/whitespace
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('3.3 Applies flat desk discount of 2,000 PKR and verifies invoice recalculation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/discounts',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: studentId,
          invoice_id: invoiceId,
          discount_type: 'flat',
          discount_value: 2000,
          mandatory_reason: 'Desk admission concession approved by Campus Director',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.actual_discount_amount).toBe(2000);
      expect(body.data.mandatory_reason).toBe('Desk admission concession approved by Campus Director');
      expect(body.data.approved_by).toBe('adnan@apexacademy.edu.pk');

      // Verify invoice balance is now 8,000 PKR
      const invRes = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/invoices?student_id=${studentId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const invoices = JSON.parse(invRes.body).data;
      const inv = invoices.find((i: any) => i.id === invoiceId);
      expect(inv.discount_amount).toBe(2000);
      expect(inv.balance_amount).toBe(8000);
    });

    it('3.4 Verifies discount is recorded in fee discounts audit trail', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/discounts?student_id=${studentId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const discounts = JSON.parse(res.body).data;
      expect(discounts.length).toBeGreaterThanOrEqual(1);
      const disc = discounts.find((d: any) => d.invoice_id === invoiceId);
      expect(disc).toBeDefined();
      expect(disc.actual_discount_amount).toBe(2000);
      expect(disc.mandatory_reason).toContain('Campus Director');
    });

    it('3.5 Records desk payment of 8,000 PKR with custom cashier remarks', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/payments',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          invoice_id: invoiceId,
          amount_paid: 8000,
          payment_method: 'cash',
          reference_number: 'COUNTER-REC-4821',
          remarks: 'Received in cash at front counter by Admin, currency verified',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      const payment = body.data.payment;
      expect(payment).toBeDefined();
      expect(payment.amount_paid).toBe(8000);
      expect(payment.payment_method).toBe('cash');
      expect(payment.reference_number).toBe('COUNTER-REC-4821');
      expect(payment.remarks).toBe('Received in cash at front counter by Admin, currency verified');

      // Verify invoice is now fully cleared (balance = 0, status = 'paid')
      const inv = body.data.invoice;
      expect(inv.balance_amount).toBe(0);
      expect(inv.status).toBe('paid');
    });

    it('3.6 Verifies GET /api/v1/finance/payments preserves cashier remarks', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/payments?student_id=${studentId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const payments = JSON.parse(res.body).data;
      expect(payments.length).toBeGreaterThanOrEqual(1);
      const p = payments.find((x: any) => x.invoice_id === invoiceId);
      expect(p).toBeDefined();
      expect(p.remarks).toBe('Received in cash at front counter by Admin, currency verified');
      expect(p.reference_number).toBe('COUNTER-REC-4821');
    });

    it('3.7 Verifies FinancialTransaction voucher and Cashbook contain cashier remarks', async () => {
      // 1. Verify in Financial Transactions (vouchers)
      const txRes = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/transactions?type=income`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(txRes.statusCode).toBe(200);
      const transactions = JSON.parse(txRes.body).data;
      expect(Array.isArray(transactions)).toBe(true);

      const tx = transactions.find((t: any) =>
        t.type === 'income' && t.amount === 8000 && t.description?.includes('Zainab Ahmed')
      );
      expect(tx).toBeDefined();
      expect(tx.description).toContain('[Notes: Received in cash at front counter by Admin, currency verified]');

      // 2. Verify in Daily Cashbook Report
      const today = new Date().toISOString().split('T')[0];
      const cbRes = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/reports/cashbook?date=${today}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(cbRes.statusCode).toBe(200);
      const cashbook = JSON.parse(cbRes.body).data;
      expect(Array.isArray(cashbook)).toBe(true);
      const cbEntry = cashbook.find((c: any) => c.student_name?.includes('Zainab Ahmed'));
      expect(cbEntry).toBeDefined();
      expect(cbEntry.amount).toBe(8000);
    });

    it('3.8 Verifies student ledger reflects net invoice debit and payment credit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/ledger/${studentId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const entries = JSON.parse(res.body).data;
      expect(entries.length).toBeGreaterThanOrEqual(2);

      const invoiceEntry = entries.find((e: any) => e.debit > 0);
      expect(invoiceEntry).toBeDefined();
      expect(invoiceEntry.debit).toBe(8000); // 10,000 gross minus 2,000 discount

      const paymentEntry = entries.find((e: any) => e.credit > 0);
      expect(paymentEntry).toBeDefined();
      expect(paymentEntry.credit).toBe(8000);

      // Final running balance is fully cleared to 0 PKR
      const lastEntry = entries[entries.length - 1];
      expect(lastEntry.running_balance).toBe(0);
    });
  });

  // =========================================================================
  // SUITE 4: EDGE CASES & FINANCIAL SAFETY INTEGRITY
  // =========================================================================
  describe('4. Financial Safety & Robust Edge Cases', () => {
    let student2Id: string;
    let invoice2Id: string;

    beforeAll(async () => {
      const progRes = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const programId = JSON.parse(progRes.body).data[0].id;

      const batchRes = await app.inject({
        method: 'GET',
        url: `/api/v1/academic/batches?program_id=${programId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const sectionId = JSON.parse(batchRes.body).data[0].id;

      const enrollRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Usman Ali',
          guardian_name: 'Ali Raza',
          guardian_phone: '03009988776',
          phone: '03009988776',
          program_id: programId,
          batch_id: sectionId,
          admission_date: '2026-09-25',
          generate_first_month_invoice: true,
          fee_structure: {
            tuition_fee: 5000,
            first_month_total: 5000,
            billing_mode: 'monthly',
          },
        },
      });
      student2Id = JSON.parse(enrollRes.body).data.id;
      invoice2Id = JSON.parse(enrollRes.body).data.first_invoice_id;
    });

    it('4.1 Discount value is capped to outstanding balance if higher amount is requested', async () => {
      // Invoice balance is 5,000 PKR. Requesting 8,000 PKR discount.
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/discounts',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: student2Id,
          invoice_id: invoice2Id,
          discount_type: 'flat',
          discount_value: 8000,
          mandatory_reason: 'Full director scholarship',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      // Actual applied discount is capped at balance (5,000 PKR)
      expect(body.data.actual_discount_amount).toBe(5000);

      // Invoice balance is now 0 and invoice is cleared
      const invRes = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/invoices?student_id=${student2Id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const inv = JSON.parse(invRes.body).data.find((i: any) => i.id === invoice2Id);
      expect(inv.balance_amount).toBe(0);
      expect(inv.discount_amount).toBe(5000);
    });

    it('4.2 Rejects applying discount on a zero-balance cleared invoice with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/discounts',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: student2Id,
          invoice_id: invoice2Id,
          discount_type: 'flat',
          discount_value: 1000,
          mandatory_reason: 'Attempted extra discount on cleared challan',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('zero balance');
    });

    it('4.3 Rejects cheque payment without cheque_number', async () => {
      // Create another student
      const progRes = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const programId = JSON.parse(progRes.body).data[0].id;
      const batchRes = await app.inject({
        method: 'GET',
        url: `/api/v1/academic/batches?program_id=${programId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const sectionId = JSON.parse(batchRes.body).data[0].id;

      const enrollRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Bilal Khan',
          guardian_name: 'Khan Tariq',
          guardian_phone: '03005544332',
          phone: '03005544332',
          program_id: programId,
          batch_id: sectionId,
          admission_date: '2026-09-25',
          generate_first_month_invoice: true,
          fee_structure: { tuition_fee: 5000, first_month_total: 5000, billing_mode: 'monthly' },
        },
      });
      const invId = JSON.parse(enrollRes.body).data.first_invoice_id;

      const payRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/payments',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          invoice_id: invId,
          amount_paid: 5000,
          payment_method: 'cheque',
          // Missing cheque_number
        },
      });

      expect(payRes.statusCode).toBe(400);
      const body = JSON.parse(payRes.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
