import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';

describe('Phase 4: Finance, Fee Vouchers, Priority Auto-Distribution & Staff Payroll', () => {
  let app: FastifyInstance;
  let token: string;
  const tenantId = 'a0000000-0000-0000-0000-000000000001'; // Apex Academy

  beforeAll(async () => {
    const store = new InMemoryDataStore();
    app = await buildApp({ store });

    token = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000001',
      user_id: 'a1000000-0000-0000-0000-000000000001',
      tenant_id: tenantId,
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin',
    });
  });

  // =========================================================================
  // 1. FEE HEADS & PRIORITY CONFIGURATION
  // =========================================================================
  describe('Module 7: Itemized Fee Heads & Drag-and-Drop Priority Rules', () => {
    it('retrieves pre-seeded itemized fee heads with priority order', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/heads',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(5);

      const codes = body.data.map((h: any) => h.code);
      expect(codes).toContain('ARREARS');
      expect(codes).toContain('TUITION');
      expect(codes).toContain('ANNUAL');
      expect(codes).toContain('LAB');
    });

    it('creates a new custom fee head without hardcoded schemas', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/heads',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Generator Fuel Surcharge',
          code: 'GEN_FUEL',
          is_system_default: false,
          default_amount: 1200,
          priority_order: 7
        }
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.code).toBe('GEN_FUEL');
      expect(body.data.default_amount).toBe(1200);
    });

    it('retrieves and updates global fee allocation priority configuration', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/priority-config',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.statusCode).toBe(200);
      const prioData = getRes.json().data;
      expect(prioData.priority_order).toBeDefined();

      // Reverse priority order and update
      const reversed = [...prioData.priority_order].reverse();
      const updateRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/priority-config',
        headers: { authorization: `Bearer ${token}` },
        payload: { priority_order: reversed }
      });

      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.json().data.priority_order).toEqual(reversed);

      // Restore original priority order (Arrears first, then Tuition, etc.)
      await app.inject({
        method: 'POST',
        url: '/api/v1/finance/priority-config',
        headers: { authorization: `Bearer ${token}` },
        payload: { priority_order: prioData.priority_order }
      });
    });
  });

  // =========================================================================
  // 2. INVOICE GENERATION & FEE CHALLANS
  // =========================================================================
  describe('Module 7: Multi-Head Invoicing & Challan Generation', () => {
    it('retrieves seeded invoice for student Muhammad Ali Raza', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/invoices',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);

      const inv = body.data[0];
      expect(inv.student_name).toBe('Muhammad Ali Raza');
      expect(inv.status).toBe('unpaid');
      expect(inv.net_amount).toBe(11500);
      expect(inv.items.length).toBe(3); // Arrears 2000, Tuition 8000, Lab 1500
    });

    it('generates a new monthly fee invoice with custom item breakdown', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          student_id: 'stud-1',
          billing_month: 'October 2026',
          due_date: '2026-10-15',
          custom_items: [
            { fee_head_id: 'head-tuition', amount: 8000 },
            { fee_head_id: 'head-exam', amount: 2500 }
          ],
          notes: 'Standard October fee with mid-term examination charge'
        }
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.billing_month).toBe('October 2026');
      expect(body.data.net_amount).toBe(10500);
      expect(body.data.status).toBe('unpaid');
    });

    it('rolls over prior unpaid arrears when generating a subsequent monthly invoice', async () => {
      // stud-1 already has inv-1 with balance 11,500. A new invoice for November 2026 should roll over 11,500 arrears!
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          student_id: 'stud-1',
          billing_month: 'November 2026',
          due_date: '2026-11-15',
          include_arrears: true,
          custom_items: [
            { fee_head_id: 'head-tuition', amount: 8000 }
          ]
        }
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      // Arrears item should have been rolled over
      const arrearsItem = body.data.items.find((it: any) => it.head_code === 'ARREARS');
      expect(arrearsItem).toBeDefined();
      expect(arrearsItem.net_amount).toBeGreaterThanOrEqual(11500);
      expect(body.data.arrears_amount).toBeGreaterThanOrEqual(11500);
    });

    it('saves and retrieves batch fee structures correctly', async () => {
      const saveRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/structures',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          batch_id: 'batch-fsc-1',
          academic_session: '2026-2027',
          items: [
            { fee_head_id: 'head-tuition', head_name: 'Monthly Tuition Fee', amount: 9000 },
            { fee_head_id: 'head-lab', head_name: 'Science & Computer Lab Fee', amount: 1500 }
          ]
        }
      });

      expect(saveRes.statusCode).toBe(200);
      const savedBody = saveRes.json();
      expect(savedBody.success).toBe(true);
      expect(savedBody.data.batch_id).toBe('batch-fsc-1');
      expect(savedBody.data.items.length).toBe(2);

      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/structures',
        headers: { authorization: `Bearer ${token}` },
        query: { batch_id: 'batch-fsc-1' }
      });

      expect(getRes.statusCode).toBe(200);
      const getBody = getRes.json();
      expect(getBody.data.length).toBe(1);
      expect(getBody.data[0].items[0].amount).toBe(9000);
    });
  });

  // =========================================================================
  // 3. SMART AUTO-DISTRIBUTION & REVIEW OVERRIDE ENGINE
  // =========================================================================
  describe('Module 7: Priority Auto-Distribution & Cashier Review Override', () => {
    it('accurately auto-distributes partial payment according to priority rule', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/invoices',
        headers: { authorization: `Bearer ${token}` },
        query: { student_id: 'stud-1' },
      });
      const openInv = (listRes.json().data || []).find((i: any) =>
        i.status === 'unpaid' || i.status === 'partially_paid'
      );
      expect(openInv).toBeDefined();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/distribute-preview',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          invoice_id: openInv.id,
          amount: 4000
        }
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      const allocs = body.data as Array<{ allocated_amount: number }>;
      const sum = allocs.reduce((s, a) => s + Number(a.allocated_amount), 0);
      expect(sum).toBe(4000);
    });

    it('allows cashier to review and apply single-transaction override without altering global rule', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/invoices',
        headers: { authorization: `Bearer ${token}` },
        query: { student_id: 'stud-1' },
      });
      const openInv = (listRes.json().data || []).find((i: any) =>
        i.status === 'unpaid' || i.status === 'partially_paid'
      );
      expect(openInv).toBeDefined();
      const firstHead = openInv.items[0];
      const secondHead = openInv.items[1] || openInv.items[0];
      const allocations = openInv.items.map((it: any, idx: number) => ({
        fee_head_id: it.fee_head_id,
        head_name: it.head_name,
        allocated_amount: idx === 0 ? 1000 : (idx === 1 ? 3000 : 0),
        invoice_item_id: it.id,
      }));
      if (openInv.items.length === 1) {
        allocations[0].allocated_amount = 4000;
      }

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/payments',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          invoice_id: openInv.id,
          amount_paid: 4000,
          payment_method: 'cash',
          is_override: true,
          override_reason: 'Parent requested a specific head split',
          allocations,
        }
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.payment.is_override).toBe(true);
      expect(body.data.payment.receipt_number).toMatch(/^REC-2026-\d{5}$/);
      expect(body.data.invoice.status).toBe('partially_paid');
      expect(body.data.invoice.paid_amount).toBe(4000);
      expect(body.data.invoice.balance_amount).toBe(openInv.net_amount - 4000);

      // Verify global priority config remained unchanged
      const prioRes = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/priority-config',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(prioRes.json().data.priority_order[0]).toBe('head-arrears');
    });

    it('rejects payment committal if sum of allocations does not match payment amount', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/payments',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          invoice_id: 'inv-1',
          amount_paid: 5000,
          payment_method: 'cash',
          allocations: [
            { fee_head_id: 'head-arrears', head_name: 'Previous Arrears', allocated_amount: 1000 },
            { fee_head_id: 'head-tuition', head_name: 'Monthly Tuition Fee', allocated_amount: 2000 }
            // Total is 3,000 which does not match 5,000
          ]
        }
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('PAYMENT_FAILED');
    });

    it('records payment successfully with cheque metadata and clearing particulars', async () => {
      const invRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          student_id: 'stud-1',
          billing_month: 'December 2026',
          due_date: '2026-12-15',
          include_arrears: false,
          custom_items: [{ fee_head_id: 'head-tuition', amount: 8000 }]
        }
      });
      const testInvoiceId = invRes.json().data.id;

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/payments',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          invoice_id: testInvoiceId,
          amount_paid: 2000,
          payment_method: 'cheque',
          bank_name: 'Meezan Bank Ltd',
          cheque_number: 'CHQ-2026-99124',
          clearing_date: '2026-10-18',
          reference_number: 'DEP-88412'
        }
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.payment.payment_method).toBe('cheque');
      expect(body.data.payment.bank_name).toBe('Meezan Bank Ltd');
      expect(body.data.payment.cheque_number).toBe('CHQ-2026-99124');
    });

    it('records payment successfully using easypaisa payment method', async () => {
      const invRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/generate',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          student_id: 'stud-1',
          billing_month: 'January 2027',
          due_date: '2027-01-15',
          include_arrears: false,
          custom_items: [{ fee_head_id: 'head-tuition', amount: 8000 }]
        }
      });
      const testInvoiceId = invRes.json().data.id;

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/payments',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          invoice_id: testInvoiceId,
          amount_paid: 1000,
          payment_method: 'easypaisa',
          reference_number: 'TID-9920194812'
        }
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.payment.payment_method).toBe('easypaisa');
      expect(body.data.payment.reference_number).toBe('TID-9920194812');
    });
  });

  // =========================================================================
  // 4. AD-HOC DISCOUNTS & AUDIT LOGGING
  // =========================================================================
  describe('Module 7: Ad-Hoc Discounts & Mandatory Audit Rationale', () => {
    it('blocks discount application when mandatory approval reason is omitted', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/discounts',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          student_id: 'stud-1',
          invoice_id: 'inv-1',
          discount_type: 'flat',
          discount_value: 1500,
          mandatory_reason: '' // Empty reason must be rejected!
        }
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('successfully grants discount with mandatory audit remark and adjusts invoice balance', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/invoices',
        headers: { authorization: `Bearer ${token}` },
        query: { student_id: 'stud-1' },
      });
      const openInv = (listRes.json().data || []).find((i: any) =>
        (i.status === 'unpaid' || i.status === 'partially_paid') && Number(i.balance_amount) > 1500
      );
      expect(openInv).toBeDefined();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/discounts',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          student_id: 'stud-1',
          invoice_id: openInv.id,
          discount_type: 'flat',
          discount_value: 1500,
          mandatory_reason: 'Approved by Director for 2nd sibling academic merit concession'
        }
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.actual_discount_amount).toBe(1500);
      expect(body.data.mandatory_reason).toBe('Approved by Director for 2nd sibling academic merit concession');

      const invRes = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/invoices/${openInv.id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      const inv = invRes.json().data;
      expect(inv.discount_amount).toBeGreaterThanOrEqual(1500);
      expect(inv.balance_amount).toBe(openInv.balance_amount - 1500);
    });

    it('retrieves full discount audit history across academy', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/discounts',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.data[0].approved_by).toBeDefined();
      expect(body.data[0].mandatory_reason).toContain('merit concession');
    });
  });

  // =========================================================================
  // 5. FINANCIAL REPORTS & LEDGERS
  // =========================================================================
  describe('Module 8: Daily Cashbook Register & Student Ledger', () => {
    it('retrieves daily cashbook collection entries', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/reports/cashbook',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.data.some((row: any) => Number(row.amount) === 4000 && row.payment_method === 'cash')).toBe(true);
    });

    it('generates chronological student ledger with running balance', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/reports/student-ledger/stud-1',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2); // Invoice + Payment
      
      const lastEntry = body.data[body.data.length - 1];
      expect(lastEntry.running_balance).toBeDefined();
    });

    it('generates fee head collection summary', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/reports/fee-head-summary',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(4);
    });
  });

  // =========================================================================
  // 6. STAFF PAYROLL DESK & INTERACTIVE SALARY PROCESSING
  // =========================================================================
  describe('Module 14: Interactive Staff Payroll Desk & Payslips', () => {
    it('retrieves staff salary profiles', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/payroll/profiles',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2);

      const tariq = body.data.find((p: any) => p.staff_name === 'Sir Tariq Physics');
      expect(tariq.base_amount).toBe(85000);
      expect(tariq.contract_type).toBe('fixed_monthly');
    });

    it('interactively processes month-end salary with dynamic earnings and deductions', async () => {
      // Sir Tariq base salary: 85,000
      // Earnings: 6 hours overtime @ 1,200 = 7,200
      // Deductions: 2 late arrivals @ 1,000 = 2,000
      // Net salary = 85,000 + 7,200 - 2,000 = 90,200
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/payroll/payslips/generate',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          staff_id: 'a1000000-0000-0000-0000-000000000002',
          payroll_month: 'September 2026',
          earnings: [
            { name: 'Overtime Evening Coaching', quantity: 6, unit_rate: 1200 }
          ],
          deductions: [
            { name: 'Late Arrival Deductions', quantity: 2, unit_rate: 1000 }
          ],
          admin_notes: 'Verified against campus geofence clock-in records'
        }
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      
      const payslip = body.data;
      expect(payslip.slip_number).toContain('PAY-September2026');
      expect(payslip.base_salary).toBe(85000);
      expect(payslip.total_earnings).toBe(7200);
      expect(payslip.total_deductions).toBe(2000);
      expect(payslip.net_salary).toBe(90200);
      expect(payslip.status).toBe('processed');
      expect(payslip.attendance_summary.present_days).toBeGreaterThanOrEqual(0);
    });

    it('marks payslip as paid upon bank disbursement', async () => {
      // Retrieve payslips to find newly created payslip
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/payroll/payslips',
        headers: { authorization: `Bearer ${token}` },
        query: { payroll_month: 'September 2026' }
      });
      const payslip = listRes.json().data[0];

      const payRes = await app.inject({
        method: 'POST',
        url: `/api/v1/payroll/payslips/${payslip.id}/pay`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          payment_method: 'bank_transfer',
          reference: 'HBL-FT-99482017'
        }
      });

      expect(payRes.statusCode).toBe(200);
      const updated = payRes.json().data;
      expect(updated.status).toBe('paid');
      expect(updated.payment_method).toBe('bank_transfer');
      expect(updated.transaction_reference).toBe('HBL-FT-99482017');
    });
  });
});
