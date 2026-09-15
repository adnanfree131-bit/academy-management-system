import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';

describe('Fees Overhaul & Financial Integrity Verification', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let financeManagerToken: string;
  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  const programId = 'a2000000-0000-0000-0000-000000000001';
  const batchId = 'a3000000-0000-0000-0000-000000000001';

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

    financeManagerToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000003',
      user_id: 'a1000000-0000-0000-0000-000000000003',
      tenant_id: tenantId,
      email: 'finance@apexacademy.edu.pk',
      role: 'finance_manager',
    });

    // Enroll a second active student so tenant has multiple active students for batch & family tests
    await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        full_name: 'Zubair Tariq',
        guardian_name: 'Tariq Mehmood',
        guardian_phone: '03007654321',
        program_id: programId,
        batch_id: batchId,
      },
    });
  });

  // =========================================================================
  // 1. ABSOLUTE ZERO LATE FEES VERIFICATION
  // =========================================================================
  describe('Zero Late Fees Mandate', () => {
    it('ensures no late fees exist in settings, invoices, or structures', async () => {
      const invRes = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/invoices',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(invRes.statusCode).toBe(200);
      const invoices = invRes.json().data;
      for (const inv of invoices) {
        expect(inv.late_fee).toBeUndefined();
        expect(inv.late_fine).toBeUndefined();
      }

      const settingsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/settings',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(settingsRes.statusCode).toBe(200);
      const settings = settingsRes.json().data.settings;
      expect(settings.late_fee_per_day).toBeUndefined();
      expect(settings.liquidation_rules).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. BATCH INVOICE GENERATION BY SCOPE
  // =========================================================================
  describe('Batch Invoice Generation with Scopes', () => {
    it('generates batch invoices for a specific batch', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate-batch',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          scope: 'batch',
          target_id: batchId,
          billing_month: 'January 2027',
          due_date: '2027-01-10',
          issue_date: '2027-01-01',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.count).toBeGreaterThanOrEqual(2);
      expect(body.invoices_created).toBe(body.count);

      // Verify each generated invoice belongs to students in batch
      for (const inv of body.data) {
        expect(inv.billing_month).toBe('January 2027');
        expect(inv.due_date).toBe('2027-01-10');
        expect(inv.status).toBe('unpaid');
        expect(inv.late_fee).toBeUndefined();
      }
    });

    it('generates batch invoices for an entire program', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate-batch',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          scope: 'program',
          target_id: programId,
          billing_month: 'February 2027',
          due_date: '2027-02-10',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.count).toBeGreaterThanOrEqual(2);
      expect(body.invoices_created).toBe(body.count);
    });

    it('generates batch invoices academy-wide with scope: all', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/batch',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          scope: 'all',
          billing_month: 'March 2027',
          due_date: '2027-03-10',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.count).toBeGreaterThanOrEqual(2);
      expect(body.invoices_created).toBe(body.count);
    });
  });

  // =========================================================================
  // 3. ARREARS ROLLOVER & SINGLE-DEBIT LEDGER INTEGRITY
  // =========================================================================
  describe('Arrears Rollover & Single-Debit Ledger Math', () => {
    it('prevents exponential compounding across 3 successive unpaid billing cycles', async () => {
      // Create a fresh test student
      const studentRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Test Ledger Student',
          guardian_name: 'Parent Ledger',
          guardian_phone: '03001234567',
          program_id: programId,
          batch_id: batchId,
        },
      });
      expect(studentRes.statusCode).toBe(201);
      const studentId = studentRes.json().data.id;

      // Cycle 1: Month 1 (June 2027) - 5000 Tuition
      const m1Res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: studentId,
          billing_month: 'June 2027',
          due_date: '2027-06-15',
          include_arrears: false,
          custom_items: [{ fee_head_id: 'head-tuition', amount: 5000 }],
        },
      });
      expect(m1Res.statusCode).toBe(201);
      const m1Inv = m1Res.json().data;
      expect(m1Inv.net_amount).toBe(5000);
      expect(m1Inv.arrears_amount).toBe(0);

      // Cycle 2: Month 2 (July 2027) - with include_arrears: true
      const m2Res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: studentId,
          billing_month: 'July 2027',
          due_date: '2027-07-15',
          include_arrears: true,
          custom_items: [{ fee_head_id: 'head-tuition', amount: 5000 }],
        },
      });
      expect(m2Res.statusCode).toBe(201);
      const m2Inv = m2Res.json().data;
      expect(m2Inv.arrears_amount).toBe(5000);
      expect(m2Inv.net_amount).toBe(10000); // 5000 new tuition + 5000 rolled arrears

      // Verify m1 invoice was marked as 'rolled_over'
      const m1Check = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/invoices/${m1Inv.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(m1Check.json().data.status).toBe('rolled_over');
      expect(m1Check.json().data.rolled_into_invoice_id).toBe(m2Inv.id);

      // Cycle 3: Month 3 (August 2027) - with include_arrears: true
      // CRITICAL: arrears must be 10000 (from m2 only), NOT 15000 (which would happen if m1 was counted again)
      const m3Res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: studentId,
          billing_month: 'August 2027',
          due_date: '2027-08-15',
          include_arrears: true,
          custom_items: [{ fee_head_id: 'head-tuition', amount: 5000 }],
        },
      });
      expect(m3Res.statusCode).toBe(201);
      const m3Inv = m3Res.json().data;
      expect(m3Inv.arrears_amount).toBe(10000); // exactly 10,000, NO DOUBLE COUNTING
      expect(m3Inv.net_amount).toBe(15000); // 5000 new + 10000 rolled

      // Verify m2 was rolled over
      const m2Check = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/invoices/${m2Inv.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(m2Check.json().data.status).toBe('rolled_over');

      // Now verify the Student Ledger!
      const ledgerRes = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/ledger/${studentId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(ledgerRes.statusCode).toBe(200);
      const ledger = ledgerRes.json().data;

      // Cumulative debits across all 3 months must be 15,000 (5000 per month),
      // NOT 5000 + 10000 + 15000 = 30000!
      const totalDebits = ledger.reduce((sum: number, e: any) => sum + e.debit, 0);
      const totalCredits = ledger.reduce((sum: number, e: any) => sum + e.credit, 0);
      const finalBalance = ledger.length > 0 ? ledger[ledger.length - 1].running_balance : 0;
      expect(totalDebits).toBe(15000);
      expect(totalCredits).toBe(0);
      expect(finalBalance).toBe(15000);

      // When m3 invoice is paid in full:
      const payRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/payments',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          invoice_id: m3Inv.id,
          amount_paid: 15000,
          payment_method: 'bank_transfer',
          reference_number: 'TXN-LEDGER-FULL',
        },
      });
      expect(payRes.statusCode).toBe(201);

      // Both m1 and m2 should now also be marked 'paid'
      const m1AfterPay = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/invoices/${m1Inv.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(m1AfterPay.json().data.status).toBe('paid');

      const m2AfterPay = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/invoices/${m2Inv.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(m2AfterPay.json().data.status).toBe('paid');

      // Check updated ledger
      const ledgerAfterPay = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/ledger/${studentId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const ledgerAfter = ledgerAfterPay.json().data;
      const totalDebitsAfter = ledgerAfter.reduce((sum: number, e: any) => sum + e.debit, 0);
      const totalCreditsAfter = ledgerAfter.reduce((sum: number, e: any) => sum + e.credit, 0);
      const finalBalanceAfter = ledgerAfter.length > 0 ? ledgerAfter[ledgerAfter.length - 1].running_balance : 0;
      expect(totalDebitsAfter).toBe(15000);
      expect(totalCreditsAfter).toBe(15000);
      expect(finalBalanceAfter).toBe(0);
    });
  });

  // =========================================================================
  // 4. INVOICE CANCELLATION & RESTORATION
  // =========================================================================
  describe('Invoice Cancellation / Voiding Lifecycle', () => {
    it('cancels an unpaid invoice with mandatory audit reason', async () => {
      // Create student and invoice
      const studentRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Cancel Test Student',
          guardian_name: 'Parent Cancel',
          guardian_phone: '03009998877',
          program_id: programId,
          batch_id: batchId,
        },
      });
      const studentId = studentRes.json().data.id;

      const invRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: studentId,
          billing_month: 'September 2027',
          due_date: '2027-09-15',
          custom_items: [{ fee_head_id: 'head-tuition', amount: 6000 }],
        },
      });
      const invId = invRes.json().data.id;

      // Fail cancellation if reason is omitted or whitespace
      const failRes = await app.inject({
        method: 'POST',
        url: `/api/v1/finance/invoices/${invId}/cancel`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reason: '   ' },
      });
      expect(failRes.statusCode).toBe(400);

      // Cancel with valid reason
      const cancelRes = await app.inject({
        method: 'POST',
        url: `/api/v1/finance/invoices/${invId}/cancel`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reason: 'Duplicate invoice issued by mistake during test run' },
      });
      expect(cancelRes.statusCode).toBe(200);
      const cancelledInv = cancelRes.json().data;
      expect(cancelledInv.status).toBe('cancelled');
      expect(cancelledInv.cancel_reason).toBe('Duplicate invoice issued by mistake during test run');
      expect(cancelledInv.cancelled_by).toBe('adnan@apexacademy.edu.pk');
      expect(cancelledInv.cancelled_at).toBeDefined();

      // Ensure cancelled invoice cannot be paid
      const payCancelled = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/payments',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          invoice_id: invId,
          amount_paid: 6000,
          payment_method: 'cash',
        },
      });
      expect(payCancelled.statusCode).toBe(400);
    });

    it('restores rolled-over invoices when the composite invoice is cancelled', async () => {
      // Create student
      const studentRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Rollback Test Student',
          guardian_name: 'Parent Rollback',
          guardian_phone: '03001112233',
          program_id: programId,
          batch_id: batchId,
        },
      });
      const studentId = studentRes.json().data.id;

      // Base invoice 1
      const inv1Res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: studentId,
          billing_month: 'October 2027',
          due_date: '2027-10-15',
          custom_items: [{ fee_head_id: 'head-tuition', amount: 4000 }],
        },
      });
      const inv1Id = inv1Res.json().data.id;

      // Composite invoice 2 (rolls inv1)
      const inv2Res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: studentId,
          billing_month: 'November 2027',
          due_date: '2027-11-15',
          include_arrears: true,
          custom_items: [{ fee_head_id: 'head-tuition', amount: 4000 }],
        },
      });
      const inv2Id = inv2Res.json().data.id;

      // Verify inv1 is rolled over
      const inv1Before = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/invoices/${inv1Id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(inv1Before.json().data.status).toBe('rolled_over');

      // Cancel composite invoice 2
      const cancel2Res = await app.inject({
        method: 'POST',
        url: `/api/v1/finance/invoices/${inv2Id}/cancel`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reason: 'Incorrect fee calculation on November invoice' },
      });
      expect(cancel2Res.statusCode).toBe(200);

      // Verify inv1 has been restored back to 'unpaid' and unlinked!
      const inv1After = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/invoices/${inv1Id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(inv1After.json().data.status).toBe('unpaid');
      expect(inv1After.json().data.rolled_into_invoice_id).toBeFalsy();
    });
  });

  // =========================================================================
  // 5. ROLE-BASED ACCESS & FAMILY PAYMENTS
  // =========================================================================
  describe('Role-Based Access for Finance Manager on Family Payments', () => {
    it('allows finance_manager to process family payments without 403 Forbidden', async () => {
      // Retrieve students
      const studentsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const students = studentsRes.json().data;
      expect(students.length).toBeGreaterThanOrEqual(2);

      // Create an invoice for each student
      const inv1Res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: students[0].id,
          billing_month: 'December 2027',
          due_date: '2027-12-15',
          custom_items: [{ fee_head_id: 'head-tuition', amount: 3000 }],
        },
      });
      const inv2Res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: students[1].id,
          billing_month: 'December 2027',
          due_date: '2027-12-15',
          custom_items: [{ fee_head_id: 'head-tuition', amount: 3500 }],
        },
      });

      // Submit family payment using financeManagerToken
      const familyPayRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/payments/family',
        headers: { authorization: `Bearer ${financeManagerToken}` },
        payload: {
          payment_method: 'easypaisa',
          reference_number: 'EP-FAM-9988',
          payments: [
            {
              invoice_id: inv1Res.json().data.id,
              amount_paid: 3000,
            },
            {
              invoice_id: inv2Res.json().data.id,
              amount_paid: 3500,
            },
          ],
        },
      });

      expect(familyPayRes.statusCode).toBe(201);
      const familyBody = familyPayRes.json();
      expect(familyBody.success).toBe(true);
      expect(familyBody.data.results.length).toBe(2);
      expect(familyBody.data.total_amount).toBe(6500);
    });
  });

  // =========================================================================
  // 6. DUPLICATE CHALLAN SHIELD & INVOICE MANAGEMENT
  // =========================================================================
  describe('Duplicate Challan Shield & Invoice Lifecycle', () => {
    let studentId: string;
    let invoiceId: string;

    beforeAll(async () => {
      const studentsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      studentId = studentsRes.json().data[0].id;
    });

    it('generates an initial challan for single student', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: studentId,
          billing_month: 'August 2028',
          due_date: '2028-08-10',
          custom_items: [{ fee_head_id: 'head-tuition', amount: 5000 }],
          notes: 'Initial test challan',
        },
      });
      expect(res.statusCode).toBe(201);
      invoiceId = res.json().data.id;
    });

    it('blocks duplicate invoice generation for same student & billing month', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: studentId,
          billing_month: 'August 2028',
          due_date: '2028-08-10',
          custom_items: [{ fee_head_id: 'head-tuition', amount: 5000 }],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.message).toMatch(/already exists/i);
    });

    it('allows updating due date, notes, and items when unpaid', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/finance/invoices/${invoiceId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          due_date: '2028-08-20',
          notes: 'Updated due date and items',
          items: [{ fee_head_id: 'head-tuition', amount: 6000 }],
        },
      });
      expect(res.statusCode).toBe(200);
      const inv = res.json().data;
      expect(inv.due_date).toBe('2028-08-20');
      expect(inv.notes).toBe('Updated due date and items');
      expect(inv.net_amount).toBe(6000);
      expect(inv.balance_amount).toBe(6000);
    });

    it('blocks line item editing once a partial payment is recorded', async () => {
      // Record partial payment of 2000
      const payRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/payments',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          invoice_id: invoiceId,
          amount_paid: 2000,
          payment_method: 'cash',
        },
      });
      expect(payRes.statusCode).toBe(201);

      // Attempt to modify items -> should fail
      const editRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/finance/invoices/${invoiceId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          items: [{ fee_head_id: 'head-tuition', amount: 7000 }],
        },
      });
      expect(editRes.statusCode).toBe(400);
      expect(editRes.json().error.message).toMatch(/cannot modify line items/i);

      // But updating due date / notes should still be permitted
      const noteRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/finance/invoices/${invoiceId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          notes: 'Allowed note edit on partially paid invoice',
        },
      });
      expect(noteRes.statusCode).toBe(200);
      expect(noteRes.json().data.notes).toBe('Allowed note edit on partially paid invoice');
    });

    it('blocks cancelling invoice while it has recorded payments', async () => {
      const cancelRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/finance/invoices/${invoiceId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reason: 'Mistake in generation' },
      });
      expect(cancelRes.statusCode).toBe(400);
      expect(cancelRes.json().error.message).toMatch(/cannot cancel invoice with recorded payments/i);
    });

    it('allows 1-click payment reversal and then allows invoice deletion', async () => {
      // Fetch payments for this invoice
      const paymentsRes = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/payments?invoice_id=${invoiceId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const payment = paymentsRes.json().data[0];
      expect(payment).toBeDefined();

      // Reverse payment
      const voidRes = await app.inject({
        method: 'POST',
        url: `/api/v1/finance/payments/${payment.id}/void`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          void_reason: 'Bank bounced or cashier error reversal',
        },
      });
      expect(voidRes.statusCode).toBe(200);
      expect(voidRes.json().data.payment.status).toBe('voided');
      expect(voidRes.json().data.invoice.balance_amount).toBe(6000);

      // Now delete/cancel the invoice
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/finance/invoices/${invoiceId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reason: 'Cancelled after payment void' },
      });
      expect(delRes.statusCode).toBe(200);
      expect(delRes.json().data.status).toBe('cancelled');
    });

    it('allows new invoice for same month once previous invoice is cancelled', async () => {
      const reGenRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          student_id: studentId,
          billing_month: 'August 2028',
          due_date: '2028-08-25',
          custom_items: [{ fee_head_id: 'head-tuition', amount: 5500 }],
        },
      });
      expect(reGenRes.statusCode).toBe(201);
      expect(reGenRes.json().data.billing_month).toBe('August 2028');
    });
  });

  // =========================================================================
  // 7. DYNAMIC ADMISSION FEE HEADS ITEMIZATION
  // =========================================================================
  describe('Dynamic Fee Heads on Admission', () => {
    it('creates student with dynamic fee heads and itemizes first invoice correctly', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Dynamic Heads Student',
          guardian_name: 'Parent Name',
          guardian_phone: '03001122334',
          program_id: programId,
          batch_id: batchId,
          generate_first_month_invoice: true,
          fee_structure: {
            base_tuition: 7000,
            admission_fee: 0,
            exam_fee: 0,
            additional_heads: [
              { fee_head_id: 'head-admission', amount: 2500 },
              { fee_head_id: 'head-exam', amount: 1200 }
            ],
            first_month_total: 10700,
          },
        },
      });

      expect(res.statusCode).toBe(201);
      const student = res.json().data;

      // Verify generated invoice has items for tuition and both dynamic heads
      const invoicesRes = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/invoices?student_id=${student.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(invoicesRes.statusCode).toBe(200);
      const invoices = invoicesRes.json().data;
      expect(invoices.length).toBeGreaterThanOrEqual(1);

      const firstInvoice = invoices[0];
      const headCodes = firstInvoice.items.map((i: any) => i.head_code);
      expect(headCodes).toContain('TUITION');
      expect(headCodes).toContain('ADMISSION');
      expect(headCodes).toContain('EXAM');
      expect(firstInvoice.net_amount).toBe(10700);
    });
  });
});
