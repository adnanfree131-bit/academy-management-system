import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { FastifyInstance } from 'fastify';

describe('Phase 8: Academy Settings, Income/Expense Operations & Admission Financials', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    adminToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000001',
      user_id: 'a1000000-0000-0000-0000-000000000001',
      tenant_id: 'a0000000-0000-0000-0000-000000000001',
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin',
    });
  });

  describe('1. Academy & Campus Settings API', () => {
    it('GET /api/v1/academic/academy-settings returns default tenant configuration', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/academy-settings',
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBeDefined();
      expect(body.data.settings).toBeDefined();
    });

    it('PUT /api/v1/academic/academy-settings updates institutional profile, bank details & policies', async () => {
      const updatePayload = {
        name: 'Apex Premier Science Academy',
        settings: {
          campus_name: 'Gulberg Executive Campus',
          academic_session: '2026-2027',
          phone: '+92 300 9876543',
          email: 'principal@apexpremier.edu.pk',
          address: 'Main Boulevard, Gulberg III, Lahore',
          affiliation_number: 'BISE/LHR-2026/9988',
          bank_name: 'Meezan Bank Limited',
          account_title: 'Apex Premier Academy Collection A/C',
          account_number: '0102-0104882910',
          iban: 'PK36MEZN0001020104882910',
          branch_code: 'Gulberg Branch (0102)',
          liquidation_rules: {
            due_day: 10,
            grace_days: 5,
            late_fee_per_day: 50,
            priority_order: ['admission_fee', 'exam_fee', 'tuition_fee']
          },
          shifts: {
            morning: { start: '08:00', end: '13:30' },
            evening: { start: '15:00', end: '19:30' }
          }
        }
      };

      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/academic/academy-settings',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: updatePayload
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Apex Premier Science Academy');
      expect(body.data.settings.campus_name).toBe('Gulberg Executive Campus');
      expect(body.data.settings.bank_name).toBe('Meezan Bank Limited');
      expect(body.data.settings.iban).toBe('PK36MEZN0001020104882910');
      expect(body.data.settings.liquidation_rules.due_day).toBe(10);
      expect(body.data.settings.shifts.morning.start).toBe('08:00');

      // Verify persistence via subsequent GET
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/academy-settings',
        headers: { authorization: `Bearer ${adminToken}` }
      });
      const getBody = getRes.json();
      expect(getBody.data.name).toBe('Apex Premier Science Academy');
      expect(getBody.data.settings.campus_name).toBe('Gulberg Executive Campus');
    });
  });

  describe('2. Operational Income & Expense Management', () => {
    let expenseHeadId: string;
    let incomeHeadId: string;

    it('POST /api/v1/finance/account-heads creates dynamic account heads (zero hardcoding)', async () => {
      // 1. Create dynamic Expense head
      const expRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/account-heads',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Physics Lab Consumables',
          type: 'expense',
          description: 'Reagents and apparatus for science experiments'
        }
      });
      expect(expRes.statusCode).toBe(201);
      const expBody = expRes.json();
      expect(expBody.success).toBe(true);
      expect(expBody.data.id).toBeDefined();
      expect(expBody.data.type).toBe('expense');
      expenseHeadId = expBody.data.id;

      // 2. Create dynamic Income head
      const incRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/account-heads',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Prospectus & Entry Test Forms',
          type: 'income',
          description: 'Sales of entrance admission forms'
        }
      });
      expect(incRes.statusCode).toBe(201);
      const incBody = incRes.json();
      expect(incBody.success).toBe(true);
      incomeHeadId = incBody.data.id;
    });

    it('GET /api/v1/finance/account-heads lists user-created account heads', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/account-heads',
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      const headNames = body.data.map((h: any) => h.name);
      expect(headNames).toContain('Physics Lab Consumables');
      expect(headNames).toContain('Prospectus & Entry Test Forms');
    });

    it('POST /api/v1/finance/transactions records expense and income vouchers', async () => {
      // Record Expense Voucher
      const expTxRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/transactions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          account_head_id: expenseHeadId,
          type: 'expense',
          amount: 8500,
          payment_method: 'cash',
          payee_payer: 'Modern Scientific Supplies',
          reference_number: 'INV-PHY-401',
          description: 'Glass beakers and optical prisms',
          date: '2026-10-02'
        }
      });
      expect(expTxRes.statusCode).toBe(201);
      const expTxBody = expTxRes.json();
      expect(expTxBody.success).toBe(true);
      expect(expTxBody.data.voucher_number).toBeDefined();
      expect(expTxBody.data.amount).toBe(8500);

      // Record Income Voucher
      const incTxRes = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/transactions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          account_head_id: incomeHeadId,
          type: 'income',
          amount: 25000,
          payment_method: 'bank_transfer',
          payee_payer: 'New Applicant Pool Batch A',
          reference_number: 'SLIP-OCT-102',
          description: 'Bulk prospectus fee deposit',
          date: '2026-10-03'
        }
      });
      expect(incTxRes.statusCode).toBe(201);
      const incTxBody = incTxRes.json();
      expect(incTxBody.success).toBe(true);
      expect(incTxBody.data.amount).toBe(25000);
    });

    it('GET /api/v1/finance/reports/profit-loss reconciles monthly revenue and net surplus', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/finance/reports/profit-loss?month=2026-10',
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.total_income).toBeGreaterThanOrEqual(25000);
      expect(body.data.total_expense).toBeGreaterThanOrEqual(8500);
      expect(body.data.net_profit).toBe(body.data.total_income - body.data.total_expense);
    });
  });

  describe('3. Student Admission with Batch Fee Baseline & First Month Invoice', () => {
    it('POST /api/v1/sis/students with fee_structure automatically creates first month invoice', async () => {
      const admissionPayload = {
        first_name: 'Hamza',
        last_name: 'Zafar',
        gender: 'male',
        date_of_birth: '2009-04-12',
        guardian_name: 'Zafar Iqbal',
        guardian_phone: '+92 300 5554321',
        guardian_relation: 'Father',
        current_address: 'Model Town, Block C, Lahore',
        program_id: 'prog-1',
        batch_id: 'batch-1',
        blood_group: 'B+',
        fee_structure: {
          tuition_fee: 12000,
          concession_type: 'kinship',
          concession_value: 20,
          concession_reason: 'Elder brother enrolled in FSc Part 2 Batch A',
          net_tuition: 9600,
          admission_fee: 5000,
          exam_lab_charges: 2000,
          first_month_total: 16600
        },
        generate_first_month_invoice: true
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: admissionPayload
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.blood_group).toBe('B+');
      expect(body.data.first_invoice_id).toBeDefined();

      // Verify the generated first month invoice
      const invRes = await app.inject({
        method: 'GET',
        url: `/api/v1/finance/invoices/${body.data.first_invoice_id}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(invRes.statusCode).toBe(200);
      const invBody = invRes.json();
      expect(invBody.success).toBe(true);
      expect(invBody.data.net_amount).toBe(16600);
      expect(invBody.data.student_id).toBe(body.data.id);
    });

    it('POST /api/v1/sis/students supports partial subjects enrollment', async () => {
      const partialAdmissionPayload = {
        full_name: 'Bilal Ahmed',
        phone: '+92 312 3456789',
        guardian_name: 'Ahmed Noor',
        guardian_phone: '+92 312 9876543',
        program_id: 'prog-1',
        batch_id: 'batch-1',
        subjects: ['sub-physics', 'sub-chemistry'], // Only 2 subjects
        fee_structure: {
          base_tuition: 6000,
          net_tuition: 6000,
          admission_fee: 2000,
          first_month_total: 8000,
        },
        generate_first_month_invoice: true
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: partialAdmissionPayload
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.subjects).toEqual(['sub-physics', 'sub-chemistry']);
      expect(body.data.subjects.length).toBe(2);

      // Verify PATCH /api/v1/sis/students/:id to add a subject post-admission
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/sis/students/${body.data.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          subjects: ['sub-physics', 'sub-chemistry', 'sub-math'],
          fee_structure: {
            ...body.data.fee_structure,
            base_tuition: 9000,
            net_tuition: 9000,
          }
        }
      });

      expect(patchRes.statusCode).toBe(200);
      const patchBody = patchRes.json();
      expect(patchBody.success).toBe(true);
      expect(patchBody.data.subjects).toEqual(['sub-physics', 'sub-chemistry', 'sub-math']);
      expect(patchBody.data.fee_structure.net_tuition).toBe(9000);
    });
  });
});
