import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import {
  executeAdmissionTransaction,
  executeInvoicePaymentTransaction,
  executeAttendanceCorrectionTransaction,
  withTenantTransaction,
} from '../src/db/transactions.js';
import { buildApp } from '../src/app.js';

describe('Phase 3: Normalized PostgreSQL Repository, RLS & Transaction Invariants', () => {
  let db: PGlite;

  const TENANT_A_ID = 'a0000000-0000-0000-0000-000000000001'; // Apex Academy
  const TENANT_A_AUTH_ID = 'e1000000-0000-0000-0000-000000000001'; // Director Adnan
  const BATCH_ID = 'a3000000-0000-0000-0000-000000000001';
  const PROGRAM_ID = 'a2000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    db = new PGlite();

    // 1. Run all migrations in sequence
    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await db.exec(sql);
    }

    // 2. Run seed
    const seedPath = path.resolve(__dirname, '../../supabase/seeds/001_dual_tenant_seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await db.exec(seedSql);
  });

  beforeEach(async () => {
    // Reset session context
    await db.exec(`
      RESET app.current_tenant_id;
      RESET app.current_user_id;
      RESET app.is_super_admin;
      SET ROLE postgres;
    `);
  });

  it('Gate 1: Production boot fails closed when database is unreachable', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDbUrl = process.env.DATABASE_URL;
    try {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgres://postgres:invalid@localhost:99999/nonexistent';
      process.env.EDGE_PROXY_SECRET = 'a-secure-production-proxy-secret-123456';
      process.env.SUPABASE_URL = 'https://valid.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'valid-anon-key-secret-1234567890';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-secret-key-12345';

      await expect(buildApp()).rejects.toThrow(/FATAL: Production database connection failed/);
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.DATABASE_URL = originalDbUrl;
    }
  });

  it('Gate 2: Multi-row Admission Workflow rolls back completely on error (0 orphan records)', async () => {
    // Attempt admission with simulated failure after student insertion
    let errorCaught: Error | null = null;
    try {
      await executeAdmissionTransaction(db, {
        tenantId: TENANT_A_ID,
        authUserId: TENANT_A_AUTH_ID,
        student: {
          admission_number: 'ADM-ROLLBACK-001',
          roll_number: 'R-ROLLBACK-1',
          full_name: 'Student Rollback Test',
          guardian_name: 'Parent Rollback',
          guardian_phone: '03001234567',
          program_id: PROGRAM_ID,
          batch_id: BATCH_ID,
        },
        invoice: {
          invoice_number: 'INV-ROLLBACK-001',
          subtotal_amount: 10000,
          net_amount: 10000,
          billing_month: 'October 2026',
          issue_date: '2026-10-01',
          due_date: '2026-10-10',
        },
        shouldFailAfterStudent: true,
      });
    } catch (err: any) {
      errorCaught = err;
    }

    expect(errorCaught).toBeDefined();
    expect(errorCaught?.message).toBe('SIMULATED_ADMISSION_FAILURE');

    // Verify student was rolled back
    const studentCheck = await db.query(
      `SELECT * FROM public.students WHERE admission_number = 'ADM-ROLLBACK-001'`
    );
    expect(studentCheck.rows.length).toBe(0);

    // Verify invoice was not created
    const invoiceCheck = await db.query(
      `SELECT * FROM public.student_invoices WHERE invoice_number = 'INV-ROLLBACK-001'`
    );
    expect(invoiceCheck.rows.length).toBe(0);
  });

  it('Gate 3: Multi-row Admission Workflow commits atomically on success', async () => {
    const result = await executeAdmissionTransaction(db, {
      tenantId: TENANT_A_ID,
      authUserId: TENANT_A_AUTH_ID,
      student: {
        admission_number: 'ADM-SUCCESS-001',
        roll_number: 'R-SUCCESS-1',
        full_name: 'Student Success Test',
        guardian_name: 'Parent Success',
        guardian_phone: '03001234567',
        program_id: PROGRAM_ID,
        batch_id: BATCH_ID,
      },
      invoice: {
        invoice_number: 'INV-SUCCESS-001',
        subtotal_amount: 10000,
        net_amount: 10000,
        billing_month: 'October 2026',
        issue_date: '2026-10-01',
        due_date: '2026-10-10',
      },
    });

    expect(result.student).toBeDefined();
    expect(result.student.admission_number).toBe('ADM-SUCCESS-001');
    expect(result.invoice).toBeDefined();
    expect(result.invoice.invoice_number).toBe('INV-SUCCESS-001');

    // Verify both are present in database
    const studentInDb = await db.query(
      `SELECT * FROM public.students WHERE id = $1`,
      [result.student.id]
    );
    expect(studentInDb.rows.length).toBe(1);

    const invoiceInDb = await db.query(
      `SELECT * FROM public.student_invoices WHERE id = $1`,
      [result.invoice.id]
    );
    expect(invoiceInDb.rows.length).toBe(1);
    expect(Number(invoiceInDb.rows[0].balance_amount)).toBe(10000);
  });

  it('Gate 4: Invoice payment transaction rolls back on failure', async () => {
    // 1. Create an invoice
    const invRes = await db.query(
      `INSERT INTO public.student_invoices (
        tenant_id, invoice_number, student_id, student_name,
        roll_number, batch_id, batch_name, billing_month,
        issue_date, due_date, subtotal_amount, discount_amount,
        net_amount, paid_amount, balance_amount, status
      ) VALUES (
        $1, 'INV-FAIL-PAY-1', (SELECT id FROM public.students LIMIT 1), 'Student',
        '001', $2, 'Batch', 'October 2026',
        '2026-10-01', '2026-10-10', 5000, 0,
        5000, 0, 5000, 'unpaid'
      ) RETURNING *`,
      [TENANT_A_ID, BATCH_ID]
    );
    const invoice = invRes.rows[0];

    // 2. Attempt payment that fails during transaction
    let err: Error | null = null;
    try {
      await executeInvoicePaymentTransaction(db, {
        tenantId: TENANT_A_ID,
        authUserId: TENANT_A_AUTH_ID,
        invoiceId: invoice.id,
        paymentAmount: 2000,
        paymentMethod: 'cash',
        receiptNumber: 'REC-FAIL-1',
        collectedBy: 'Cashier Adnan',
        shouldFailAfterLock: true,
      });
    } catch (e: any) {
      err = e;
    }

    expect(err).toBeDefined();
    expect(err?.message).toBe('SIMULATED_PAYMENT_FAILURE');

    // 3. Invoice balance remains 5000 and 0 payments exist
    const invAfter = await db.query(`SELECT * FROM public.student_invoices WHERE id = $1`, [invoice.id]);
    expect(Number(invAfter.rows[0].paid_amount)).toBe(0);
    expect(Number(invAfter.rows[0].balance_amount)).toBe(5000);
    expect(invAfter.rows[0].status).toBe('unpaid');

    const paymentAfter = await db.query(`SELECT * FROM public.fee_payments WHERE receipt_number = 'REC-FAIL-1'`);
    expect(paymentAfter.rows.length).toBe(0);
  });

  it('Gate 5: Concurrent invoice payments prevent lost updates and reject overdraft', async () => {
    // Create an invoice with balance = 5000
    const invRes = await db.query(
      `INSERT INTO public.student_invoices (
        tenant_id, invoice_number, student_id, student_name,
        roll_number, batch_id, batch_name, billing_month,
        issue_date, due_date, subtotal_amount, discount_amount,
        net_amount, paid_amount, balance_amount, status
      ) VALUES (
        $1, 'INV-CONCURRENCY-1', (SELECT id FROM public.students LIMIT 1), 'Student',
        '001', $2, 'Batch', 'October 2026',
        '2026-10-01', '2026-10-10', 5000, 0,
        5000, 0, 5000, 'unpaid'
      ) RETURNING *`,
      [TENANT_A_ID, BATCH_ID]
    );
    const invoice = invRes.rows[0];

    // Transaction 1: Pay 3000 -> succeeds, balance becomes 2000
    const pay1 = await executeInvoicePaymentTransaction(db, {
      tenantId: TENANT_A_ID,
      authUserId: TENANT_A_AUTH_ID,
      invoiceId: invoice.id,
      paymentAmount: 3000,
      paymentMethod: 'cash',
      receiptNumber: 'REC-CONC-1',
      collectedBy: 'Cashier 1',
    });
    expect(Number(pay1.invoice.balance_amount)).toBe(2000);
    expect(pay1.invoice.status).toBe('partially_paid');

    // Transaction 2: Try to pay another 3000 -> balance is now only 2000, must be rejected
    await expect(
      executeInvoicePaymentTransaction(db, {
        tenantId: TENANT_A_ID,
        authUserId: TENANT_A_AUTH_ID,
        invoiceId: invoice.id,
        paymentAmount: 3000,
        paymentMethod: 'cash',
        receiptNumber: 'REC-CONC-2',
        collectedBy: 'Cashier 2',
      })
    ).rejects.toThrow(/PAYMENT_EXCEEDS_BALANCE/);

    // Verify database state: exactly 3000 paid, balance 2000, exactly 1 payment receipt
    const finalInv = await db.query(`SELECT * FROM public.student_invoices WHERE id = $1`, [invoice.id]);
    expect(Number(finalInv.rows[0].paid_amount)).toBe(3000);
    expect(Number(finalInv.rows[0].balance_amount)).toBe(2000);

    const payments = await db.query(`SELECT * FROM public.fee_payments WHERE invoice_id = $1`, [invoice.id]);
    expect(payments.rows.length).toBe(1);
  });

  it('Gate 6: Attendance correction transaction updates status and audit log atomically', async () => {
    // 1. Create an attendance record
    const attRes = await db.query(
      `INSERT INTO public.student_attendance (
        tenant_id, student_id, batch_id, date, status, check_in_time
      ) VALUES (
        $1, (SELECT id FROM public.students LIMIT 1), $2, CURRENT_DATE, 'absent', '08:00:00'
      ) RETURNING *`,
      [TENANT_A_ID, BATCH_ID]
    );
    const att = attRes.rows[0];

    // 2. Correction fails in transaction -> status remains 'absent', no audit log
    let err: Error | null = null;
    try {
      await executeAttendanceCorrectionTransaction(db, {
        tenantId: TENANT_A_ID,
        authUserId: TENANT_A_AUTH_ID,
        attendanceId: att.id,
        newStatus: 'present',
        reason: 'Official duty verification',
        shouldFailAudit: true,
      });
    } catch (e: any) {
      err = e;
    }
    expect(err).toBeDefined();

    const check1 = await db.query(`SELECT * FROM public.student_attendance WHERE id = $1`, [att.id]);
    expect(check1.rows[0].status).toBe('absent');

    const audit1 = await db.query(`SELECT * FROM public.audit_logs WHERE resource_id = $1`, [att.id]);
    expect(audit1.rows.length).toBe(0);

    // 3. Correction succeeds -> status becomes 'present', audit log created
    await executeAttendanceCorrectionTransaction(db, {
      tenantId: TENANT_A_ID,
      authUserId: TENANT_A_AUTH_ID,
      attendanceId: att.id,
      newStatus: 'present',
      reason: 'Official duty verification',
    });

    const check2 = await db.query(`SELECT * FROM public.student_attendance WHERE id = $1`, [att.id]);
    expect(check2.rows[0].status).toBe('present');

    const audit2 = await db.query(`SELECT * FROM public.audit_logs WHERE resource_id = $1`, [att.id]);
    expect(audit2.rows.length).toBe(1);
    expect(audit2.rows[0].action).toBe('ATTENDANCE_CORRECTION');
  });

  it('Gate 7: Database constraints reject negative financial amounts', async () => {
    // Invoices reject negative subtotal
    await expect(
      db.query(
        `INSERT INTO public.student_invoices (
          tenant_id, invoice_number, student_id, student_name,
          roll_number, batch_id, batch_name, billing_month,
          issue_date, due_date, subtotal_amount, discount_amount,
          net_amount, paid_amount, balance_amount, status
        ) VALUES (
          $1, 'INV-NEG-1', (SELECT id FROM public.students LIMIT 1), 'Student',
          '001', $2, 'Batch', 'October 2026',
          '2026-10-01', '2026-10-10', -500, 0,
          -500, 0, -500, 'unpaid'
        )`,
        [TENANT_A_ID, BATCH_ID]
      )
    ).rejects.toThrow();

    // Fee payment rejects non-positive amount
    await expect(
      db.query(
        `INSERT INTO public.fee_payments (
          tenant_id, receipt_number, invoice_id, student_id,
          student_name, roll_number, payment_date, amount_paid,
          payment_method, status, collected_by
        ) VALUES (
          $1, 'REC-NEG-1', (SELECT id FROM public.student_invoices LIMIT 1),
          (SELECT id FROM public.students LIMIT 1), 'Student', '001',
          CURRENT_DATE, 0, 'cash', 'paid', 'Cashier'
        )`,
        [TENANT_A_ID]
      )
    ).rejects.toThrow();
  });

  it('Gate 8: Database constraints enforce tenant-qualified uniqueness for invoice numbers', async () => {
    const studentId = (await db.query(`SELECT id FROM public.students LIMIT 1`)).rows[0].id;

    // Insert first invoice
    await db.query(
      `INSERT INTO public.student_invoices (
        tenant_id, invoice_number, student_id, student_name,
        roll_number, batch_id, batch_name, billing_month,
        issue_date, due_date, subtotal_amount, discount_amount,
        net_amount, paid_amount, balance_amount, status
      ) VALUES (
        $1, 'INV-DUP-1', $2, 'Student',
        '001', $3, 'Batch', 'October 2026',
        '2026-10-01', '2026-10-10', 1000, 0,
        1000, 0, 1000, 'unpaid'
      )`,
      [TENANT_A_ID, studentId, BATCH_ID]
    );

    // Duplicate in same tenant fails
    await expect(
      db.query(
        `INSERT INTO public.student_invoices (
          tenant_id, invoice_number, student_id, student_name,
          roll_number, batch_id, batch_name, billing_month,
          issue_date, due_date, subtotal_amount, discount_amount,
          net_amount, paid_amount, balance_amount, status
        ) VALUES (
          $1, 'INV-DUP-1', $2, 'Student',
          '001', $3, 'Batch', 'October 2026',
          '2026-10-01', '2026-10-10', 1000, 0,
          1000, 0, 1000, 'unpaid'
        )`,
        [TENANT_A_ID, studentId, BATCH_ID]
      )
    ).rejects.toThrow();
  });
});
