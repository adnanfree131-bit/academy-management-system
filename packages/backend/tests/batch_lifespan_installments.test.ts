import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore, isBatchEndedForBillingMonth } from '../src/services/store.js';

describe('Batch Lifespan, One-Time Packages & Installment Milestones Integrity', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let installmentBatchId: string;
  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  const programId = 'a2000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    const store = new InMemoryDataStore();
    app = await buildApp({ store });

    adminToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000001',
      user_id: 'a1000000-0000-0000-0000-000000000001',
      tenant_id: tenantId,
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin',
    });
  });

  // =========================================================================
  // 1. UNIT TESTING: isBatchEndedForBillingMonth Helper
  // =========================================================================
  describe('Helper: isBatchEndedForBillingMonth', () => {
    it('returns false when batchEndDate is undefined, null, or whitespace', () => {
      expect(isBatchEndedForBillingMonth(undefined, 'January 2027')).toBe(false);
      expect(isBatchEndedForBillingMonth(null, 'January 2027')).toBe(false);
      expect(isBatchEndedForBillingMonth('', 'January 2027')).toBe(false);
      expect(isBatchEndedForBillingMonth('   ', 'January 2027')).toBe(false);
    });

    it('returns true when batch ended before the billing month begins', () => {
      // October 31, 2026 ended before November 1, 2026
      expect(isBatchEndedForBillingMonth('2026-10-31', 'November 2026')).toBe(true);
      expect(isBatchEndedForBillingMonth('2026-10-31', '2026-11')).toBe(true);
      expect(isBatchEndedForBillingMonth('2026-09-30', 'January 2027')).toBe(true);
    });

    it('returns false when batch is active during the billing month', () => {
      // Ended mid-month October (e.g. Oct 15) is NOT ended before October 1
      expect(isBatchEndedForBillingMonth('2026-10-15', 'October 2026')).toBe(false);
      expect(isBatchEndedForBillingMonth('2026-10-31', 'October 2026')).toBe(false);
      expect(isBatchEndedForBillingMonth('2026-10-31', '2026-10')).toBe(false);
    });

    it('returns false when batch ends in a future month', () => {
      expect(isBatchEndedForBillingMonth('2027-05-31', 'January 2027')).toBe(false);
      expect(isBatchEndedForBillingMonth('2027-05-31', 'February 2027')).toBe(false);
    });

    it('handles YYYY-MM formatted end dates safely', () => {
      // Batch ending 2026-10 (October 2026) is active in October 2026, but ended for November 2026
      expect(isBatchEndedForBillingMonth('2026-10', 'October 2026')).toBe(false);
      expect(isBatchEndedForBillingMonth('2026-10', 'November 2026')).toBe(true);
    });
  });

  // =========================================================================
  // 2. BATCH LIFESPAN SKIPPING (Edge Case 2.7: No Ghost Post-Course Billing)
  // =========================================================================
  describe('Batch Lifespan Edge Case 2.7', () => {
    let endedBatchId: string;
    let activeBatchId: string;
    let noEndDateBatchId: string;

    beforeAll(async () => {
      // 1. Create a batch that ended on 2026-09-30
      const endedBatchRes = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/batches',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          program_id: programId,
          name: 'Summer Crash 2026 (Ended)',
          shift: 'morning',
          start_date: '2026-06-01',
          end_date: '2026-09-30',
          billing_mode: 'monthly',
          fee_amount: 12000,
        },
      });
      expect(endedBatchRes.statusCode).toBe(201);
      endedBatchId = endedBatchRes.json().data.id;

      // Enroll student in ended batch
      await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Student In Ended Batch',
          guardian_name: 'Guardian Ended',
          guardian_phone: '03001112233',
          program_id: programId,
          batch_id: endedBatchId,
          fee_structure: {
            base_tuition: 12000,
            net_tuition: 12000,
            first_month_total: 12000,
          },
          generate_first_month_invoice: false,
        },
      });

      // 2. Create an active batch ending in 2027-06-30
      const activeBatchRes = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/batches',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          program_id: programId,
          name: 'Regular Annual 2026-2027 (Active)',
          shift: 'morning',
          start_date: '2026-08-01',
          end_date: '2027-06-30',
          billing_mode: 'monthly',
          fee_amount: 9000,
        },
      });
      expect(activeBatchRes.statusCode).toBe(201);
      activeBatchId = activeBatchRes.json().data.id;

      // Enroll student in active batch
      await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Student In Active Batch',
          guardian_name: 'Guardian Active',
          guardian_phone: '03004445566',
          program_id: programId,
          batch_id: activeBatchId,
          fee_structure: {
            base_tuition: 9000,
            net_tuition: 9000,
            first_month_total: 9000,
          },
          generate_first_month_invoice: false,
        },
      });

      // 3. Create a batch with no end_date
      const noEndRes = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/batches',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          program_id: programId,
          name: 'Open Ongoing Batch',
          shift: 'morning',
          start_date: '2026-01-01',
          billing_mode: 'monthly',
          fee_amount: 7000,
        },
      });
      expect(noEndRes.statusCode).toBe(201);
      noEndDateBatchId = noEndRes.json().data.id;

      await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Student In Open Batch',
          guardian_name: 'Guardian Open',
          guardian_phone: '03007778899',
          program_id: programId,
          batch_id: noEndDateBatchId,
          fee_structure: {
            base_tuition: 7000,
            net_tuition: 7000,
            first_month_total: 7000,
          },
          generate_first_month_invoice: false,
        },
      });
    });

    it('skips concluded batch from monthly batch generation', async () => {
      // Attempt to generate batch invoices for ended batch for October 2026 (course ended Sept 30)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate-batch',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          scope: 'batch',
          target_id: endedBatchId,
          billing_month: 'October 2026',
          due_date: '2026-10-10',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      // Ended batch must have 0 invoices generated
      expect(body.count).toBe(0);
      expect(body.data.length).toBe(0);
    });

    it('allows billing for active batch within lifespan', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate-batch',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          scope: 'batch',
          target_id: activeBatchId,
          billing_month: 'October 2026',
          due_date: '2026-10-10',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.count).toBeGreaterThanOrEqual(1);
      expect(body.data.some((i: any) => i.batch_id === activeBatchId)).toBe(true);
    });

    it('allows billing for batch with no end_date', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate-batch',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          scope: 'batch',
          target_id: noEndDateBatchId,
          billing_month: 'October 2026',
          due_date: '2026-10-10',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.count).toBeGreaterThanOrEqual(1);
      expect(body.data.some((i: any) => i.batch_id === noEndDateBatchId)).toBe(true);
    });
  });

  // =========================================================================
  // 3. ONE-TIME PACKAGE BILLING SKIPPING
  // =========================================================================
  describe('One-Time Package Billing', () => {
    let oneTimeBatchId: string;
    let oneTimeStudentId: string;

    beforeAll(async () => {
      // Create batch
      const batchRes = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/batches',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          program_id: programId,
          name: 'One-Time Package Batch',
          shift: 'morning',
          start_date: '2026-08-01',
          end_date: '2027-05-31',
          billing_mode: 'monthly',
          fee_amount: 15000,
        },
      });
      oneTimeBatchId = batchRes.json().data.id;

      // Enroll student with billing_mode: 'one_time'
      const studRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'One-Time Package Student',
          guardian_name: 'Guardian OneTime',
          guardian_phone: '03001234567',
          program_id: programId,
          batch_id: oneTimeBatchId,
          billing_mode: 'one_time',
          fee_structure: {
            base_tuition: 50000,
            net_tuition: 50000,
            first_month_total: 50000,
          },
          generate_first_month_invoice: false,
        },
      });
      expect(studRes.statusCode).toBe(201);
      oneTimeStudentId = studRes.json().data.id;
    });

    it('skips student with billing_mode: one_time from monthly batch invoicing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate-batch',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          scope: 'batch',
          target_id: oneTimeBatchId,
          billing_month: 'November 2026',
          due_date: '2026-11-10',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.some((inv: any) => inv.student_id === oneTimeStudentId)).toBe(false);
    });
  });

  // =========================================================================
  // 4. INSTALLMENT PLAN MILESTONES & LIFECYCLE
  // =========================================================================
  describe('Installment Plan Milestones & Lifecycle', () => {
    let installmentStudentId: string;

    beforeAll(async () => {
      const batchRes = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/batches',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          program_id: programId,
          name: 'MDCAT Installment Batch 2028',
          shift: 'morning',
          start_date: '2028-01-01',
          end_date: '2028-12-31',
          billing_mode: 'installment',
          fee_amount: 45000,
        },
      });
      installmentBatchId = batchRes.json().data.id;

      // Enroll student with installment plan
      const studRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Installment Track Student',
          guardian_name: 'Guardian Installment',
          guardian_phone: '03009871234',
          program_id: programId,
          batch_id: installmentBatchId,
          billing_mode: 'installment',
          fee_structure: {
            base_tuition: 45000,
            net_tuition: 45000,
            first_month_total: 15000,
          },
          installment_plan: {
            total_fee: 45000,
            total_installments: 3,
            installments: [
              { installment_number: 1, due_date: '2028-02-10', amount: 15000, status: 'pending' },
              { installment_number: 2, due_date: '2028-03-10', amount: 15000, status: 'pending' },
              { installment_number: 3, due_date: '2028-04-10', amount: 15000, status: 'pending' },
            ],
          },
          generate_first_month_invoice: true,
        },
      });

      expect(studRes.statusCode).toBe(201);
      installmentStudentId = studRes.json().data.id;
    });

    it('issues Installment 1 immediately upon admission and marks it billed', async () => {
      const studRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${installmentStudentId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(studRes.statusCode).toBe(200);
      const student = studRes.json().data;

      expect(student.billing_mode).toBe('installment');
      expect(student.installment_plan).toBeDefined();
      expect(student.installment_plan.installments[0].status).toBe('billed');
      expect(student.installment_plan.installments[0].invoice_id).toBeDefined();
      expect(student.installment_plan.installments[1].status).toBe('pending');
      expect(student.installment_plan.installments[2].status).toBe('pending');

      // Verify the opening invoice attributes
      const invRes = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/invoices/${student.first_invoice_id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(invRes.statusCode).toBe(200);
      const inv = invRes.json().data;
      expect(inv.installment_number).toBe(1);
      expect(inv.total_installments).toBe(3);
      expect(inv.billing_mode).toBe('installment');
      expect(inv.net_amount).toBe(15000);
    });

    it('marks milestone as paid when challan payment is recorded', async () => {
      // Get student's first invoice ID
      const studRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${installmentStudentId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const firstInvId = studRes.json().data.installment_plan.installments[0].invoice_id;

      // Pay full PKR 15000
      const payRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/payments',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          invoice_id: firstInvId,
          amount_paid: 15000,
          payment_method: 'cash',
        },
      });
      expect(payRes.statusCode).toBe(201);

      // Verify installment 1 status is updated to 'paid'
      const updatedStudRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${installmentStudentId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const student = updatedStudRes.json().data;
      expect(student.installment_plan.installments[0].status).toBe('paid');
    });

    it('generates next milestone (Installment 2) during batch billing for next month', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate-batch',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          scope: 'batch',
          target_id: installmentBatchId,
          billing_month: 'March 2028',
          due_date: '2028-03-10',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      const inst2Inv = body.data.find((i: any) => i.student_id === installmentStudentId);
      expect(inst2Inv).toBeDefined();
      expect(inst2Inv.installment_number).toBe(2);
      expect(inst2Inv.total_installments).toBe(3);
      expect(inst2Inv.net_amount).toBe(15000);
      expect(inst2Inv.notes).toContain('Installment 2 of 3');

      // Check student installment milestone 2 status is now billed
      const studRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${installmentStudentId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const student = studRes.json().data;
      expect(student.installment_plan.installments[1].status).toBe('billed');
      expect(student.installment_plan.installments[2].status).toBe('pending');
    });

    it('generates final milestone (Installment 3) during batch billing for month 3', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate-batch',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          scope: 'batch',
          target_id: installmentBatchId,
          billing_month: 'April 2028',
          due_date: '2028-04-10',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      const inst3Inv = body.data.find((i: any) => i.student_id === installmentStudentId);
      expect(inst3Inv).toBeDefined();
      expect(inst3Inv.installment_number).toBe(3);
      expect(inst3Inv.total_installments).toBe(3);

      const studRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${installmentStudentId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const student = studRes.json().data;
      expect(student.installment_plan.installments[2].status).toBe('billed');
    });

    it('stops generating invoices when all milestones are billed (no ghost 4th invoice)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate-batch',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          scope: 'batch',
          target_id: installmentBatchId,
          billing_month: 'May 2028',
          due_date: '2028-05-10',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      // No invoice should be generated for this student because all 3 installments are already billed
      expect(body.data.some((i: any) => i.student_id === installmentStudentId)).toBe(false);
    });

    it('does not bill future installment milestones prematurely when billing month is prior to due date', async () => {
      const studRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Future Milestone Student',
          guardian_name: 'Guardian Future',
          guardian_phone: '03001239876',
          program_id: programId,
          batch_id: installmentBatchId,
          billing_mode: 'installment',
          fee_structure: {
            base_tuition: 30000,
            net_tuition: 30000,
            first_month_total: 15000,
          },
          installment_plan: {
            total_fee: 30000,
            total_installments: 2,
            installments: [
              { installment_number: 1, due_date: '2028-05-10', amount: 15000, status: 'pending' },
              { installment_number: 2, due_date: '2028-07-10', amount: 15000, status: 'pending' },
            ],
          },
          generate_first_month_invoice: true,
        },
      });
      expect(studRes.statusCode).toBe(201);
      const futureStudent = studRes.json().data;
      expect(futureStudent.installment_plan.installments[0].status).toBe('billed');
      expect(futureStudent.installment_plan.installments[1].status).toBe('pending');

      // Batch billing for June 2028: milestone 2 is scheduled for July 2028, so it should NOT be billed
      const juneBatchRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate-batch',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          scope: 'batch',
          target_id: installmentBatchId,
          billing_month: 'June 2028',
          due_date: '2028-06-10',
        },
      });
      expect(juneBatchRes.statusCode).toBe(201);
      expect(juneBatchRes.json().data.some((inv: any) => inv.student_id === futureStudent.id)).toBe(false);

      // Check student record: milestone 2 must remain pending
      const checkRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${futureStudent.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(checkRes.json().data.installment_plan.installments[1].status).toBe('pending');

      // Batch billing for July 2028: milestone 2 IS due and should be billed
      const julyBatchRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate-batch',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          scope: 'batch',
          target_id: installmentBatchId,
          billing_month: 'July 2028',
          due_date: '2028-07-10',
        },
      });
      expect(julyBatchRes.statusCode).toBe(201);
      const julyInv = julyBatchRes.json().data.find((inv: any) => inv.student_id === futureStudent.id);
      expect(julyInv).toBeDefined();
      expect(julyInv.installment_number).toBe(2);
    });
  });

  // =========================================================================
  // 5. OPENING INVOICE WITH DYNAMIC HEADS & CANCELLATION / VOID ROLLBACK
  // =========================================================================
  describe('Installment Dynamic Heads & Reversal Integrity', () => {
    let testStudentId: string;
    let openingInvoiceId: string;

    it('includes admission fee, exam fee, and additional heads on installment opening invoice', async () => {
      const headsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/heads',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const heads = headsRes.json().data;
      const labHead = heads.find((h: any) => h.code === 'LAB' || h.name.toLowerCase().includes('lab')) || heads[0];

      const studRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Composite Heads Installment Student',
          guardian_name: 'Guardian Composite',
          guardian_phone: '03005554433',
          program_id: programId,
          batch_id: installmentBatchId,
          billing_mode: 'installment',
          fee_structure: {
            base_tuition: 20000,
            net_tuition: 20000,
            admission_fee: 5000,
            exam_fee: 2000,
            additional_heads: [
              { fee_head_id: labHead.id, amount: 1500 }
            ],
            first_month_total: 18500,
          },
          installment_plan: {
            total_fee: 20000,
            total_installments: 2,
            installments: [
              { installment_number: 1, due_date: '2028-06-10', amount: 10000, status: 'pending' },
              { installment_number: 2, due_date: '2028-07-10', amount: 10000, status: 'pending' },
            ],
          },
          generate_first_month_invoice: true,
        },
      });
      expect(studRes.statusCode).toBe(201);
      const student = studRes.json().data;
      testStudentId = student.id;
      openingInvoiceId = student.first_invoice_id;

      const invRes = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/invoices/${openingInvoiceId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(invRes.statusCode).toBe(200);
      const inv = invRes.json().data;
      expect(inv.net_amount).toBe(18500);
      expect(inv.items.some((it: any) => it.net_amount === 10000)).toBe(true);
      expect(inv.items.some((it: any) => it.net_amount === 5000)).toBe(true);
      expect(inv.items.some((it: any) => it.net_amount === 2000)).toBe(true);
      expect(inv.items.some((it: any) => it.net_amount === 1500)).toBe(true);
    });

    it('reverts milestone status from billed to pending when installment invoice is cancelled', async () => {
      const cancelRes = await app.inject({
        method: 'POST',
        url: `/api/v1/finance/invoices/${openingInvoiceId}/cancel`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          reason: 'Administrative adjustment to payment schedule',
        },
      });
      expect(cancelRes.statusCode).toBe(200);

      const studRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${testStudentId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const student = studRes.json().data;
      expect(student.installment_plan.installments[0].status).toBe('pending');
      expect(student.installment_plan.installments[0].invoice_id).toBeNull();
    });

    it('reverts milestone status from paid to billed when installment payment is voided', async () => {
      const batchRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate-batch',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          scope: 'batch',
          target_id: installmentBatchId,
          billing_month: 'June 2028',
          due_date: '2028-06-10',
        },
      });
      expect(batchRes.statusCode).toBe(201);
      const reInv = batchRes.json().data.find((i: any) => i.student_id === testStudentId);
      expect(reInv).toBeDefined();
      expect(reInv.installment_number).toBe(1);

      const payRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/payments',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          invoice_id: reInv.id,
          amount_paid: reInv.net_amount,
          payment_method: 'cash',
        },
      });
      expect(payRes.statusCode).toBe(201);
      const paymentId = payRes.json().data.payment.id;

      let studRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${testStudentId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(studRes.json().data.installment_plan.installments[0].status).toBe('paid');

      const voidRes = await app.inject({
        method: 'POST',
        url: `/api/v1/finance/payments/${paymentId}/void`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          void_reason: 'Dishonored payment reversal',
        },
      });
      expect(voidRes.statusCode).toBe(200);

      studRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${testStudentId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(studRes.json().data.installment_plan.installments[0].status).toBe('billed');
    });
  });

  // =========================================================================
  // 6. DUE DATE BOUNDARY HANDLING & DEFAULTER CONSISTENCY
  // =========================================================================
  describe('Due Date Defaulter Status Boundary Integrity', () => {
    it('student is active / partial on due date and only becomes defaulter after due date expires', async () => {
      const todayIso = new Date().toISOString().split('T')[0];
      const studRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Due Date Boundary Student',
          guardian_name: 'Guardian Boundary',
          guardian_phone: '03009998877',
          program_id: programId,
          batch_id: installmentBatchId,
          fee_structure: {
            base_tuition: 8000,
            net_tuition: 8000,
            first_month_total: 0,
          },
          generate_first_month_invoice: false,
        },
      });
      expect(studRes.statusCode).toBe(201);
      const student = studRes.json().data;

      const invRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: student.id,
          billing_month: 'September 2026',
          due_date: todayIso,
        },
      });
      expect(invRes.statusCode).toBe(201);

      // getStudents (list)
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students?batch_id=${installmentBatchId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const inList = listRes.json().data.find((s: any) => s.id === student.id);
      expect(inList).toBeDefined();
      // On the due date, fee_clearance_status must be 'partial', NOT 'defaulter'
      expect(inList.fee_clearance_status).toBe('partial');

      // getStudentById (single) must match getStudents exactly: 'partial', NOT 'defaulter'
      const singleRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${student.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const single = singleRes.json().data;
      expect(single.fee_clearance_status).toBe('partial');

      // Now generate an invoice with past due date (e.g. 2026-08-01)
      const pastDueRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: student.id,
          billing_month: 'August 2026',
          due_date: '2026-08-10',
        },
      });
      expect(pastDueRes.statusCode).toBe(201);

      // Verify student now becomes 'defaulter' in both list and detail endpoints
      const updatedListRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students?batch_id=${installmentBatchId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const updatedInList = updatedListRes.json().data.find((s: any) => s.id === student.id);
      expect(updatedInList.fee_clearance_status).toBe('defaulter');

      const updatedSingleRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sis/students/${student.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(updatedSingleRes.json().data.fee_clearance_status).toBe('defaulter');
    });
  });

  // =========================================================================
  // 7. MID-TERM BATCH & BILLING MODE TRANSFER INTEGRITY
  // =========================================================================
  describe('Mid-Term Batch & Billing Mode Transfer Integrity', () => {
    it('preserves prior installment invoices when student transfers to a monthly batch', async () => {
      const monthlyBatchRes = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/batches',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          program_id: programId,
          name: 'Transfer Target Monthly Batch',
          shift: 'morning',
          start_date: '2028-01-01',
          end_date: '2028-12-31',
          billing_mode: 'monthly',
          fee_amount: 8000,
        },
      });
      expect(monthlyBatchRes.statusCode).toBe(201);
      const monthlyBatchId = monthlyBatchRes.json().data.id;

      const studRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Transfer Student',
          guardian_name: 'Guardian Transfer',
          guardian_phone: '03004443322',
          program_id: programId,
          batch_id: installmentBatchId,
          billing_mode: 'installment',
          fee_structure: {
            base_tuition: 30000,
            net_tuition: 30000,
            first_month_total: 10000,
          },
          installment_plan: {
            total_fee: 30000,
            total_installments: 3,
            installments: [
              { installment_number: 1, due_date: '2028-02-10', amount: 10000, status: 'pending' },
              { installment_number: 2, due_date: '2028-03-10', amount: 10000, status: 'pending' },
              { installment_number: 3, due_date: '2028-04-10', amount: 10000, status: 'pending' },
            ],
          },
          generate_first_month_invoice: true,
        },
      });
      expect(studRes.statusCode).toBe(201);
      const student = studRes.json().data;

      const inst2Res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate-batch',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          scope: 'batch',
          target_id: installmentBatchId,
          billing_month: 'March 2028',
          due_date: '2028-03-10',
        },
      });
      expect(inst2Res.statusCode).toBe(201);

      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/sis/students/${student.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          batch_id: monthlyBatchId,
          billing_mode: 'monthly',
          fee_structure: {
            base_tuition: 8000,
            net_tuition: 8000,
            first_month_total: 8000,
          },
        },
      });
      expect(updateRes.statusCode).toBe(200);

      const monthlyAprilRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate-batch',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          scope: 'batch',
          target_id: monthlyBatchId,
          billing_month: 'April 2028',
          due_date: '2028-04-10',
        },
      });
      expect(monthlyAprilRes.statusCode).toBe(201);
      const aprilInv = monthlyAprilRes.json().data.find((i: any) => i.student_id === student.id);
      expect(aprilInv).toBeDefined();
      expect(aprilInv.billing_mode).toBe('monthly');
      expect(aprilInv.installment_number).toBeNull();
      expect(aprilInv.net_amount).toBe(8000);

      const studInvsRes = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/invoices?student_id=${student.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(studInvsRes.statusCode).toBe(200);
      const allInvs = studInvsRes.json().data.filter((i: any) => i.student_id === student.id);
      expect(allInvs.length).toBe(3);
      const inst1 = allInvs.find((i: any) => i.installment_number === 1);
      const inst2 = allInvs.find((i: any) => i.installment_number === 2);
      expect(inst1).toBeDefined();
      expect(inst2).toBeDefined();
      expect(inst1.total_installments).toBe(3);
      expect(inst2.total_installments).toBe(3);
    });
  });
});
