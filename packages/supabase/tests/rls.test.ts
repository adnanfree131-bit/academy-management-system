import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 1 & 2: Multi-Tenant Row-Level Security (RLS) Isolation Suite', () => {
  let db: PGlite;

  const TENANT_A_ID = 'a0000000-0000-0000-0000-000000000001'; // Apex Academy
  const TENANT_B_ID = 'b0000000-0000-0000-0000-000000000002'; // Crescent Academy

  // Real Auth user IDs from seed
  const TENANT_A_AUTH_ID = 'e1000000-0000-0000-0000-000000000001'; // Director Adnan
  const TENANT_B_AUTH_ID = 'e1000000-0000-0000-0000-0000000000b1'; // Principal Fatima

  const asTenantA = async (authId = TENANT_A_AUTH_ID) => {
    await db.exec(`
      SET ROLE authenticated;
      SET app.current_tenant_id = '${TENANT_A_ID}';
      SET app.current_user_id = '${authId}';
      RESET app.is_super_admin;
    `);
  };

  const asTenantB = async (authId = TENANT_B_AUTH_ID) => {
    await db.exec(`
      SET ROLE authenticated;
      SET app.current_tenant_id = '${TENANT_B_ID}';
      SET app.current_user_id = '${authId}';
      RESET app.is_super_admin;
    `);
  };

  beforeAll(async () => {
    db = new PGlite();

    // Execute all migrations in sequence
    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await db.exec(sql);
    }

    // Execute Dual-Tenant Seed Fixture
    const seedPath = path.join(__dirname, '../seeds/001_dual_tenant_seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await db.exec(seedSql);
  });

  beforeEach(async () => {
    // Reset session context and switch to authenticated role to enforce RLS
    await db.exec(`
      RESET app.current_tenant_id;
      RESET app.current_user_id;
      RESET app.is_super_admin;
      SET ROLE authenticated;
    `);
  });

  it('Gate 1: Should return 0 rows when queried with NO tenant context set', async () => {
    const res = await db.query<{ count: string }>('SELECT count(*)::text as count FROM tenant_memberships');
    expect(res.rows[0].count).toBe('0');

    const tenantsRes = await db.query<{ count: string }>('SELECT count(*)::text as count FROM tenants');
    expect(tenantsRes.rows[0].count).toBe('0');
  });

  it('Gate 2: Tenant A context must ONLY see Tenant A memberships and tenants', async () => {
    await asTenantA();

    const usersRes = await db.query<{ email: string; tenant_id: string }>(
      'SELECT email, tenant_id FROM tenant_memberships ORDER BY email'
    );
    expect(usersRes.rows.length).toBe(4);
    
    // Validate only Apex users exist
    const emails = usersRes.rows.map(r => r.email);
    expect(emails).toContain('adnan@apexacademy.edu.pk');
    expect(emails).toContain('tariq@apexacademy.edu.pk');
    expect(emails).toContain('parent.hamza@gmail.com');
    expect(emails).toContain('kampuserp@gmail.com');
    expect(emails).not.toContain('fatima@crescent.edu.pk');

    // Validate tenant_id strictly matches Tenant A
    usersRes.rows.forEach(r => {
      expect(r.tenant_id).toBe(TENANT_A_ID);
    });

    const tenantRes = await db.query<{ id: string; name: string }>(
      'SELECT id, name FROM tenants'
    );
    expect(tenantRes.rows.length).toBe(1);
    expect(tenantRes.rows[0].id).toBe(TENANT_A_ID);
    expect(tenantRes.rows[0].name).toBe('Apex Academy Lahore');
  });

  it('Gate 3: Tenant B context must ONLY see Tenant B memberships and tenants', async () => {
    await asTenantB();

    const usersRes = await db.query<{ email: string; tenant_id: string }>(
      'SELECT email, tenant_id FROM tenant_memberships ORDER BY email'
    );
    expect(usersRes.rows.length).toBe(2);

    const emails = usersRes.rows.map(r => r.email);
    expect(emails).toContain('fatima@crescent.edu.pk');
    expect(emails).toContain('ayesha@crescent.edu.pk');
    expect(emails).not.toContain('adnan@apexacademy.edu.pk');

    usersRes.rows.forEach(r => {
      expect(r.tenant_id).toBe(TENANT_B_ID);
    });

    const tenantRes = await db.query<{ id: string; name: string }>(
      'SELECT id, name FROM tenants'
    );
    expect(tenantRes.rows.length).toBe(1);
    expect(tenantRes.rows[0].id).toBe(TENANT_B_ID);
    expect(tenantRes.rows[0].name).toBe('Crescent Academy Karachi');
  });

  it('Gate 4: Cross-Tenant Injection: Tenant A must be BLOCKED from inserting row for Tenant B', async () => {
    await asTenantA();

    // Attempt to write into Tenant B while authenticated as Tenant A
    await expect(
      db.exec(`
        INSERT INTO tenant_memberships (tenant_id, auth_user_id, email, full_name, role)
        VALUES ('${TENANT_B_ID}', '${TENANT_A_AUTH_ID}', 'hacker@crescent.edu.pk', 'Infiltrator', 'teacher');
      `)
    ).rejects.toThrow(/new row violates row-level security policy/i);
  });

  it('Gate 5: Super Admin bypass allows full cross-tenant visibility', async () => {
    await db.exec(`SET app.is_super_admin = 'true';`);

    const usersRes = await db.query<{ count: string }>('SELECT count(*)::text as count FROM tenant_memberships');
    expect(usersRes.rows[0].count).toBe('6');

    const tenantsRes = await db.query<{ count: string }>('SELECT count(*)::text as count FROM tenants');
    expect(tenantsRes.rows[0].count).toBe('2');
  });

  it('Gate 6: Phase 2 - Tenant A context must ONLY see Tenant A students, programs, and inquiries', async () => {
    await asTenantA();

    const studentsRes = await db.query<{ full_name: string; roll_number: string }>(
      'SELECT full_name, roll_number FROM students'
    );
    expect(studentsRes.rows.length).toBe(1);
    expect(studentsRes.rows[0].full_name).toBe('Muhammad Ali Raza');
    expect(studentsRes.rows[0].roll_number).toBe('A-101');

    const inquiriesRes = await db.query<{ student_name: string }>(
      'SELECT student_name FROM student_inquiries'
    );
    expect(inquiriesRes.rows.length).toBe(1);
    expect(inquiriesRes.rows[0].student_name).toBe('Prospective Hamza');

    const programsRes = await db.query<{ name: string }>(
      'SELECT name FROM programs'
    );
    expect(programsRes.rows.length).toBe(1);
    expect(programsRes.rows[0].name).toBe('MDCAT Comprehensive Prep');
  });

  it('Gate 7: Phase 2 - Tenant B context must ONLY see Tenant B students, programs, and batches', async () => {
    await asTenantB();

    const studentsRes = await db.query<{ full_name: string; roll_number: string }>(
      'SELECT full_name, roll_number FROM students'
    );
    expect(studentsRes.rows.length).toBe(1);
    expect(studentsRes.rows[0].full_name).toBe('Zoya Tariq');
    expect(studentsRes.rows[0].roll_number).toBe('B-101');

    const programsRes = await db.query<{ name: string }>(
      'SELECT name FROM programs'
    );
    expect(programsRes.rows.length).toBe(1);
    expect(programsRes.rows[0].name).toBe('O-Levels Science Track');
  });

  it('Gate 8: Phase 2 - Cross-Tenant Student Injection must be blocked by RLS', async () => {
    await asTenantA();

    // Attempt to inject a student into Tenant B
    await expect(
      db.exec(`
        INSERT INTO students (
          tenant_id, admission_number, roll_number, full_name, guardian_name, guardian_phone, program_id, batch_id
        ) VALUES (
          '${TENANT_B_ID}', 'INJECT-001', 'X-999', 'Spy Student', 'Guardian', '+923000000000',
          'b2000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001'
        );
      `)
    ).rejects.toThrow(/new row violates row-level security policy/i);
  });

  it('Gate 9: Phase 3 - Timetable Slots & Rooms Tenant Isolation', async () => {
    // Insert Room and Timetable slot for Tenant A
    await asTenantA();
    await db.exec(`
      INSERT INTO rooms (id, tenant_id, name, capacity)
      VALUES ('a4000000-0000-0000-0000-000000000001', '${TENANT_A_ID}', 'Hall 1 - Apex', 60);
    `);

    const roomResA = await db.query<{ name: string }>('SELECT name FROM rooms');
    expect(roomResA.rows.length).toBe(1);
    expect(roomResA.rows[0].name).toBe('Hall 1 - Apex');

    // Switch to Tenant B -> should see 0 rooms
    await asTenantB();
    const roomResB = await db.query<{ name: string }>('SELECT name FROM rooms');
    expect(roomResB.rows.length).toBe(0);
  });

  it('Gate 10: Phase 3 - Student Attendance & Staff Geofence Clock-in RLS', async () => {
    // Tenant A configures geofence
    await asTenantA();
    await db.exec(`
      INSERT INTO campus_geofence_configs (tenant_id, campus_name, latitude, longitude, radius_meters)
      VALUES ('${TENANT_A_ID}', 'Gulberg Main Campus', 31.5204000, 74.3587000, 100);
    `);

    const geoA = await db.query<{ campus_name: string }>('SELECT campus_name FROM campus_geofence_configs');
    expect(geoA.rows.length).toBe(1);
    expect(geoA.rows[0].campus_name).toBe('Gulberg Main Campus');

    // Switch to Tenant B -> should see 0 geofence configs
    await asTenantB();
    const geoB = await db.query<{ campus_name: string }>('SELECT campus_name FROM campus_geofence_configs');
    expect(geoB.rows.length).toBe(0);
  });

  it('Gate 11: Phase 3 - Homework & Physical Notebook Check Tenant Isolation', async () => {
    await asTenantA();
    await db.exec(`
      INSERT INTO homework_assignments (id, tenant_id, batch_id, subject_id, teacher_id, title, description, due_date)
      VALUES (
        'a5000000-0000-0000-0000-000000000001', '${TENANT_A_ID}', 'a3000000-0000-0000-0000-000000000001',
        'PHY-101', 'a1000000-0000-0000-0000-000000000002', 'Vectors & Kinematics Ex 2.1', 'Solve in notebook',
        '2026-09-15'
      );
    `);

    const hwA = await db.query<{ title: string }>('SELECT title FROM homework_assignments');
    expect(hwA.rows.length).toBe(1);
    expect(hwA.rows[0].title).toBe('Vectors & Kinematics Ex 2.1');

    // Switch to Tenant B -> should see 0 assignments
    await asTenantB();
    const hwB = await db.query<{ title: string }>('SELECT title FROM homework_assignments');
    expect(hwB.rows.length).toBe(0);
  });

  it('Gate 12: Phase 3 - Cross-Tenant Attendance Injection blocked by RLS', async () => {
    await asTenantA();

    // Infiltrator trying to insert staff attendance into Tenant B
    await expect(
      db.exec(`
        INSERT INTO staff_attendance (
          tenant_id, staff_id, date, clock_in_time, clock_in_lat, clock_in_lng, distance_meters, status
        ) VALUES (
          '${TENANT_B_ID}', 'b1000000-0000-0000-0000-000000000001', '2026-09-08', now(), 31.5204, 74.3587, 12.5, 'on_time'
        );
      `)
    ).rejects.toThrow(/new row violates row-level security policy/i);
  });

  it('Gate 13: Phase 4 - Fee Heads & Multi-Head Invoicing RLS Tenant Isolation', async () => {
    // Tenant A creates fee heads and an invoice
    await asTenantA();
    await db.exec(`
      INSERT INTO fee_heads (id, tenant_id, name, code, is_system_default, default_amount, priority_order)
      VALUES 
        ('f1000000-0000-0000-0000-000000000001', '${TENANT_A_ID}', 'Monthly Tuition Fee', 'TUITION', true, 8000, 2),
        ('f1000000-0000-0000-0000-000000000002', '${TENANT_A_ID}', 'Previous Arrears', 'ARREARS', true, 0, 1);

      INSERT INTO student_invoices (
        id, tenant_id, invoice_number, student_id, student_name, roll_number,
        batch_id, batch_name, billing_month, issue_date, due_date,
        subtotal_amount, discount_amount, net_amount, paid_amount, balance_amount, status
      ) VALUES (
        'f2000000-0000-0000-0000-000000000001', '${TENANT_A_ID}', 'INV-2026-0001',
        'a5000000-0000-0000-0000-000000000001', 'Muhammad Ali Raza', 'A-101',
        'a3000000-0000-0000-0000-000000000001', 'MDCAT Morning - Batch A', 'September 2026',
        '2026-09-01', '2026-09-15', 8000, 0, 8000, 0, 8000, 'unpaid'
      );
    `);

    const headsA = await db.query<{ name: string }>('SELECT name FROM fee_heads');
    expect(headsA.rows.length).toBe(2);
    const invA = await db.query<{ invoice_number: string }>('SELECT invoice_number FROM student_invoices');
    expect(invA.rows.length).toBe(1);
    expect(invA.rows[0].invoice_number).toBe('INV-2026-0001');

    // Tenant B queries -> must see 0 fee heads and 0 invoices
    await asTenantB();
    const headsB = await db.query<{ name: string }>('SELECT name FROM fee_heads');
    expect(headsB.rows.length).toBe(0);
    const invB = await db.query<{ invoice_number: string }>('SELECT invoice_number FROM student_invoices');
    expect(invB.rows.length).toBe(0);
  });

  it('Gate 14: Phase 4 - Staff Salary Profile & Payslip Cross-Tenant Containment', async () => {
    // Tenant A creates staff salary profile and payslip
    await asTenantA();
    await db.exec(`
      INSERT INTO staff_salary_profiles (
        id, tenant_id, staff_id, staff_name, designation, contract_type, base_amount
      ) VALUES (
        'c1000000-0000-0000-0000-000000000001', '${TENANT_A_ID}',
        'a1000000-0000-0000-0000-000000000002', 'Prof. Tariq Mehmood', 'Senior Physics Lecturer',
        'fixed_monthly', 75000
      );

      INSERT INTO staff_payslips (
        id, tenant_id, slip_number, staff_id, staff_name, designation,
        payroll_month, base_salary, net_salary, status, processed_by
      ) VALUES (
        'c2000000-0000-0000-0000-000000000001', '${TENANT_A_ID}', 'PAY-2026-08-01',
        'a1000000-0000-0000-0000-000000000002', 'Prof. Tariq Mehmood', 'Senior Physics Lecturer',
        'August 2026', 75000, 75000, 'processed', 'Finance Admin'
      );
    `);

    // Verify Tenant A access
    const payA = await db.query<{ slip_number: string }>('SELECT slip_number FROM staff_payslips');
    expect(payA.rows.length).toBe(1);
    expect(payA.rows[0].slip_number).toBe('PAY-2026-08-01');

    // Verify Tenant B has 0 access to Tenant A's payroll data
    await asTenantB();
    const payB = await db.query<{ slip_number: string }>('SELECT slip_number FROM staff_payslips');
    expect(payB.rows.length).toBe(0);

    // Cross-tenant payslip insertion must be rejected by PostgreSQL RLS
    await expect(
      db.exec(`
        INSERT INTO staff_payslips (
          tenant_id, slip_number, staff_id, staff_name, designation,
          payroll_month, base_salary, net_salary, status, processed_by
        ) VALUES (
          '${TENANT_A_ID}', 'PAY-HACK',
          'b1000000-0000-0000-0000-000000000001', 'Hacked Staff', 'Teacher',
          'August 2026', 99999, 99999, 'processed', 'Malicious Actor'
        );
      `)
    ).rejects.toThrow(/new row violates row-level security policy/i);
  });

  it('Gate 15: Phase 5 Question Bank & Chapters RLS Tenant Isolation (question_chapters, bank_questions)', async () => {
    // 1. Insert Subject for Tenant A
    await asTenantA();
    await db.exec(`
      INSERT INTO subjects (id, tenant_id, name, code, is_core)
      VALUES ('a6000000-0000-0000-0000-000000000001', '${TENANT_A_ID}', 'Physics', 'PHY-A', true)
      ON CONFLICT DO NOTHING;
    `);

    // Insert Chapter and Question in Tenant A
    await db.exec(`
      INSERT INTO question_chapters (id, tenant_id, program_id, subject_id, chapter_number, chapter_name)
      VALUES ('a7000000-0000-0000-0000-000000000001', '${TENANT_A_ID}', 'a2000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 1, 'Vectors & Equilibrium');

      INSERT INTO bank_questions (id, tenant_id, chapter_id, subject_id, question_type, question_text, marks, options, correct_option)
      VALUES ('a8000000-0000-0000-0000-000000000001', '${TENANT_A_ID}', 'a7000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'MCQ', 'Unit vector has magnitude:', 1.0, '[{"key": "A", "text": "Zero"}, {"key": "B", "text": "Unity"}]'::jsonb, 'B');
    `);

    // Verify Tenant A sees their chapter and question
    const qA = await db.query<{ question_text: string }>('SELECT question_text FROM bank_questions');
    expect(qA.rows.length).toBe(1);
    expect(qA.rows[0].question_text).toContain('Unit vector');

    // Switch to Tenant B - should see 0 chapters and 0 questions
    await asTenantB();
    const qB = await db.query<{ question_text: string }>('SELECT question_text FROM bank_questions');
    expect(qB.rows.length).toBe(0);

    // Cross-tenant insertion must fail
    await expect(
      db.exec(`
        INSERT INTO bank_questions (tenant_id, subject_id, question_type, question_text, marks)
        VALUES ('${TENANT_A_ID}', 'a6000000-0000-0000-0000-000000000001', 'MCQ', 'Malicious question', 1.0);
      `)
    ).rejects.toThrow(/new row violates row-level security policy/i);
  });

  it('Gate 16: Phase 5 Exams, Questions & Evaluations RLS Tenant Isolation (exams, student_exam_evaluations)', async () => {
    // Tenant A creates Exam and Records Student Evaluation
    await asTenantA();
    await db.exec(`
      INSERT INTO exams (id, tenant_id, batch_id, subject_id, title, exam_date, total_marks, mcq_count, mcq_marks_per_q, mcq_total_marks, short_total_marks, long_total_marks)
      VALUES ('a9000000-0000-0000-0000-000000000001', '${TENANT_A_ID}', 'a3000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'Mid-Term Physics Assessment 2026', '2026-09-15', 50, 10, 1.0, 10, 20, 20);

      INSERT INTO student_exam_evaluations (id, tenant_id, exam_id, student_id, mcq_score, short_score, short_remarks, long_score, long_remarks, total_obtained, percentage, grade, status)
      VALUES ('aa000000-0000-0000-0000-000000000001', '${TENANT_A_ID}', 'a9000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 9, 18, 'Excellent derivation', 17, 'Great diagram', 44, 88.0, 'A', 'GRADED');
    `);

    // Verify Tenant A can read
    const evalA = await db.query<{ total_obtained: string }>('SELECT total_obtained::text FROM student_exam_evaluations');
    expect(evalA.rows.length).toBe(1);
    expect(evalA.rows[0].total_obtained).toBe('44.00');

    // Tenant B context
    await asTenantB();
    const evalB = await db.query<{ total_obtained: string }>('SELECT total_obtained::text FROM student_exam_evaluations');
    expect(evalB.rows.length).toBe(0);

    // Cross-tenant exam evaluation insert must be blocked
    await expect(
      db.exec(`
        INSERT INTO student_exam_evaluations (tenant_id, exam_id, student_id, mcq_score, total_obtained, percentage, grade)
        VALUES ('${TENANT_A_ID}', 'a9000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 10, 50, 100, 'A*');
      `)
    ).rejects.toThrow(/new row violates row-level security policy/i);
  });

  it('Gate 17: Phase 6 - Tenant Isolation on WhatsApp Templates & Audit Logs', async () => {
    // Tenant A creates a WhatsApp template and dispatches an audit log
    await asTenantA();
    await db.exec(`
      INSERT INTO whatsapp_templates (id, tenant_id, title, category, body, is_default)
      VALUES (
        'aa100000-0000-0000-0000-000000000001',
        '${TENANT_A_ID}',
        'Morning Absence Alert',
        'ABSENCE',
        'Dear {guardian_name}, {student_name} was marked absent today.',
        true
      );

      INSERT INTO whatsapp_audit_logs (
        id, tenant_id, student_id, recipient_phone, phone_type, template_id, message_body, status
      ) VALUES (
        'aa200000-0000-0000-0000-000000000001',
        '${TENANT_A_ID}',
        'a5000000-0000-0000-0000-000000000001',
        '+923001234567',
        'PRIMARY',
        'aa100000-0000-0000-0000-000000000001',
        'Dear Tariq, Hamza was marked absent today.',
        'SENT'
      );
    `);

    // Tenant A queries templates & audit logs
    const tmplA = await db.query<{ title: string }>('SELECT title FROM whatsapp_templates');
    expect(tmplA.rows.length).toBe(1);
    expect(tmplA.rows[0].title).toBe('Morning Absence Alert');

    const logsA = await db.query<{ recipient_phone: string }>('SELECT recipient_phone FROM whatsapp_audit_logs');
    expect(logsA.rows.length).toBe(1);
    expect(logsA.rows[0].recipient_phone).toBe('+923001234567');

    // Tenant B context
    await asTenantB();
    const tmplB = await db.query<{ title: string }>('SELECT title FROM whatsapp_templates');
    expect(tmplB.rows.length).toBe(0);

    const logsB = await db.query<{ recipient_phone: string }>('SELECT recipient_phone FROM whatsapp_audit_logs');
    expect(logsB.rows.length).toBe(0);

    // Cross-tenant template insert must be blocked
    await expect(
      db.exec(`
        INSERT INTO whatsapp_templates (tenant_id, title, category, body)
        VALUES ('${TENANT_A_ID}', 'Illegal Template', 'PAYMENT', 'Hacked body');
      `)
    ).rejects.toThrow(/new row violates row-level security policy/i);
  });

  it('Gate 18: Phase 6 - Tenant Isolation on Daily Absentee Follow-Ups & Retention Cases', async () => {
    // Tenant A creates an Absentee Follow-Up and a Retention Counseling Case
    await asTenantA();
    await db.exec(`
      INSERT INTO absentee_followups (
        id, tenant_id, student_id, batch_id, date, consecutive_days, status
      ) VALUES (
        'aa300000-0000-0000-0000-000000000001',
        '${TENANT_A_ID}',
        'a5000000-0000-0000-0000-000000000001',
        'a3000000-0000-0000-0000-000000000001',
        '2026-09-08',
        3,
        'PENDING'
      );

      INSERT INTO retention_counseling_cases (
        id, tenant_id, student_id, risk_level, status
      ) VALUES (
        'aa400000-0000-0000-0000-000000000001',
        '${TENANT_A_ID}',
        'a5000000-0000-0000-0000-000000000001',
        'HIGH',
        'OPEN'
      );
    `);

    // Verify Tenant A read
    const absA = await db.query<{ status: string }>('SELECT status FROM absentee_followups');
    expect(absA.rows.length).toBe(1);
    expect(absA.rows[0].status).toBe('PENDING');

    const retA = await db.query<{ risk_level: string }>('SELECT risk_level FROM retention_counseling_cases');
    expect(retA.rows.length).toBe(1);
    expect(retA.rows[0].risk_level).toBe('HIGH');

    // Tenant B context - must see 0 followups and 0 retention cases
    await asTenantB();
    const absB = await db.query<{ status: string }>('SELECT status FROM absentee_followups');
    expect(absB.rows.length).toBe(0);

    const retB = await db.query<{ risk_level: string }>('SELECT risk_level FROM retention_counseling_cases');
    expect(retB.rows.length).toBe(0);

    // Cross-tenant insertion blocked
    await expect(
      db.exec(`
        INSERT INTO absentee_followups (tenant_id, student_id, batch_id, date, consecutive_days)
        VALUES ('${TENANT_A_ID}', 'b5000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', '2026-09-08', 1);
      `)
    ).rejects.toThrow(/new row violates row-level security policy/i);
  });

  it('Gate 19: Subscription Payment Proof Receipts table must enforce strict tenant isolation', async () => {
    // 1. Tenant A uploads subscription proof
    await asTenantA();
    await db.exec(`
      INSERT INTO subscription_payment_receipts (
        id,
        tenant_id,
        amount,
        plan_duration_months,
        payment_method,
        reference_number,
        receipt_image_url,
        notes,
        status
      ) VALUES (
        'aa500000-0000-0000-0000-000000000001',
        '${TENANT_A_ID}',
        15000.00,
        1,
        'BANK_TRANSFER',
        'ALFALAH-REF-99201',
        'https://storage.kampus.pk/receipts/proof-a01.jpg',
        'Monthly subscription payment for Apex Academy',
        'PENDING'
      );
    `);

    // Tenant A queries -> can see 1 receipt
    const receiptsA = await db.query<{ reference_number: string }>('SELECT reference_number FROM subscription_payment_receipts');
    expect(receiptsA.rows.length).toBe(1);
    expect(receiptsA.rows[0].reference_number).toBe('ALFALAH-REF-99201');

    // 2. Switch to Tenant B -> must see 0 receipts (cannot spy on other tenant financial proofs)
    await asTenantB();
    const receiptsB = await db.query<{ reference_number: string }>('SELECT reference_number FROM subscription_payment_receipts');
    expect(receiptsB.rows.length).toBe(0);

    // 3. Cross-Tenant write injection: Tenant B tries to insert receipt under Tenant A id
    await expect(
      db.exec(`
        INSERT INTO subscription_payment_receipts (
          tenant_id,
          amount,
          plan_duration_months,
          payment_method,
          reference_number
        ) VALUES (
          '${TENANT_A_ID}',
          15000.00,
          1,
          'BANK_TRANSFER',
          'ILLEGAL-CROSS-TENANT'
        );
      `)
    ).rejects.toThrow(/new row violates row-level security policy/i);
  });

  it('Gate 20: Super Admin bypass allows full global view across all tenant subscription receipts', async () => {
    // Super-Admin context
    await db.exec(`
      RESET app.current_tenant_id;
      SET app.is_super_admin = 'true';
    `);

    const allReceipts = await db.query<{ reference_number: string }>('SELECT reference_number FROM subscription_payment_receipts');
    expect(allReceipts.rows.length).toBeGreaterThanOrEqual(1);
    expect(allReceipts.rows[0].reference_number).toBe('ALFALAH-REF-99201');
  });

  it('Gate 21: Tenant Slug Aliases table enforces strict tenant isolation', async () => {
    // SuperAdmin creates alias for Tenant A
    await db.exec(`
      RESET app.current_tenant_id;
      SET app.is_super_admin = 'true';
      INSERT INTO tenant_slug_aliases (original_slug, target_tenant_id)
      VALUES ('apex-old', '${TENANT_A_ID}');
    `);

    // Tenant A context
    await asTenantA();
    const aliasesA = await db.query<{ original_slug: string }>('SELECT original_slug FROM tenant_slug_aliases');
    expect(aliasesA.rows.length).toBe(1);
    expect(aliasesA.rows[0].original_slug).toBe('apex-old');

    // Tenant B context cannot see Tenant A's alias
    await asTenantB();
    const aliasesB = await db.query<{ original_slug: string }>('SELECT original_slug FROM tenant_slug_aliases');
    expect(aliasesB.rows.length).toBe(0);

    // Cross-tenant alias insertion must be rejected
    await expect(
      db.exec(`
        INSERT INTO tenant_slug_aliases (original_slug, target_tenant_id)
        VALUES ('illegal-cross', '${TENANT_A_ID}');
      `)
    ).rejects.toThrow(/new row violates row-level security policy/i);
  });

  it('Gate 22: Platform Announcements & Announcement Receipts RLS isolation', async () => {
    // 1. SuperAdmin inserts a global announcement
    await db.exec(`
      RESET app.current_tenant_id;
      SET app.is_super_admin = 'true';
      INSERT INTO platform_announcements (id, title, message, type, frequency, target_audience)
      VALUES ('00000000-0000-0000-0000-000000000099', 'System Notice', 'Maintenance tonight', 'system', 'every_login', 'all');
    `);

    // 2. Tenant A user reads the announcement (allowed)
    await asTenantA();
    const notices = await db.query<{ title: string }>('SELECT title FROM platform_announcements WHERE is_active = true');
    expect(notices.rows.length).toBeGreaterThanOrEqual(1);

    // 3. Tenant A user records a read receipt
    await db.exec(`
      INSERT INTO platform_announcement_receipts (announcement_id, user_id, tenant_id)
      VALUES (
        '00000000-0000-0000-0000-000000000099',
        'a1000000-0000-0000-0000-000000000001',
        '${TENANT_A_ID}'
      );
    `);

    // 4. Tenant B context cannot see Tenant A's read receipt
    await asTenantB();
    const receiptsB = await db.query<{ id: string }>('SELECT id FROM platform_announcement_receipts');
    expect(receiptsB.rows.length).toBe(0);

    // 5. Cross-tenant receipt insertion rejected
    await expect(
      db.exec(`
        INSERT INTO platform_announcement_receipts (announcement_id, user_id, tenant_id)
        VALUES (
          '00000000-0000-0000-0000-000000000099',
          'a1000000-0000-0000-0000-000000000001',
          '${TENANT_A_ID}'
        );
      `)
    ).rejects.toThrow(/new row violates row-level security policy/i);
  });

  it('Gate 23: anon role cannot read membership, invitation, profile, or audit tables', async () => {
    await db.exec(`SET ROLE anon;`);
    await expect(db.query('SELECT * FROM tenant_memberships')).rejects.toThrow(/permission denied/i);
    await expect(db.query('SELECT * FROM tenant_invitations')).rejects.toThrow(/permission denied/i);
    await expect(db.query('SELECT * FROM profiles')).rejects.toThrow(/permission denied/i);
    await expect(db.query('SELECT * FROM audit_logs')).rejects.toThrow(/permission denied/i);
  });

  it('Gate 24: fastify_runtime role has least privilege (NOSUPERUSER and NOBYPASSRLS)', async () => {
    await db.exec(`RESET ROLE;`);
    const roleRes = await db.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'fastify_runtime';"
    );
    expect(roleRes.rows.length).toBe(1);
    expect(roleRes.rows[0].rolsuper).toBe(false);
    expect(roleRes.rows[0].rolbypassrls).toBe(false);
  });

  it('Gate 25: Suspended tenant membership loses access immediately without waiting for token refresh', async () => {
    await db.exec(`RESET ROLE;`);
    // Suspend Tariq's membership
    await db.exec(`
      UPDATE tenant_memberships
      SET status = 'suspended'
      WHERE id = 'a1000000-0000-0000-0000-000000000002';
    `);

    // Tariq attempts to query Tenant A
    await db.exec(`
      SET ROLE authenticated;
      SET app.current_tenant_id = '${TENANT_A_ID}';
      SET app.current_user_id = 'e1000000-0000-0000-0000-000000000002';
    `);

    const res = await db.query('SELECT * FROM students');
    expect(res.rows.length).toBe(0);

    // Revert Tariq to active
    await db.exec(`RESET ROLE; UPDATE tenant_memberships SET status = 'active' WHERE id = 'a1000000-0000-0000-0000-000000000002';`);
  });

  it('Gate 26: Cross-tenant attack with forged current_tenant_id fails closed via is_active_tenant_member', async () => {
    // Tenant A user tries to query Tenant B by forging tenant context
    await db.exec(`
      SET ROLE authenticated;
      SET app.current_tenant_id = '${TENANT_B_ID}';
      SET app.current_user_id = '${TENANT_A_AUTH_ID}';
    `);

    const res = await db.query('SELECT * FROM students');
    expect(res.rows.length).toBe(0);

    await expect(
      db.exec(`
        INSERT INTO students (
          tenant_id, admission_number, roll_number, full_name, guardian_name, guardian_phone, program_id, batch_id
        ) VALUES (
          '${TENANT_B_ID}', 'ADM-FORGED', 'F-001', 'Forged Student', 'Guardian', '+923000000000',
          'b2000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001'
        );
      `)
    ).rejects.toThrow(/new row violates row-level security policy/i);
  });

  it('Gate 27: fastify_runtime role cannot read public.profiles without matching auth user ID or super admin', async () => {
    await db.exec(`
      SET ROLE fastify_runtime;
      RESET app.current_user_id;
      RESET app.current_tenant_id;
      RESET app.is_super_admin;
    `);

    // Direct SELECT on public.profiles under fastify_runtime with NO auth context returns 0 rows
    const res = await db.query('SELECT * FROM profiles');
    expect(res.rows.length).toBe(0);

    // Setting an auth user ID allows selecting ONLY that user's profile
    await db.exec(`SET app.current_user_id = '${TENANT_A_AUTH_ID}';`);
    const userRes = await db.query<{ id: string }>('SELECT id FROM profiles');
    expect(userRes.rows.length).toBe(1);
    expect(userRes.rows[0].id).toBe(TENANT_A_AUTH_ID);
  });

  it('Gate 28: fastify_runtime role cannot read public.tenants without matching tenant context and active membership', async () => {
    await db.exec(`
      SET ROLE fastify_runtime;
      RESET app.current_user_id;
      RESET app.current_tenant_id;
      RESET app.is_super_admin;
    `);

    // Direct SELECT on public.tenants under fastify_runtime with NO tenant context returns 0 rows
    const res = await db.query('SELECT * FROM tenants');
    expect(res.rows.length).toBe(0);

    // Setting Tenant A context without active membership returns 0 rows
    await db.exec(`
      SET app.current_tenant_id = '${TENANT_A_ID}';
      SET app.current_user_id = 'e1000000-0000-0000-0000-000000000099';
    `);
    const nonMemberRes = await db.query('SELECT * FROM tenants');
    expect(nonMemberRes.rows.length).toBe(0);

    // Setting Tenant A context with active member returns only Tenant A
    await db.exec(`SET app.current_user_id = '${TENANT_A_AUTH_ID}';`);
    const memberRes = await db.query<{ id: string }>('SELECT id FROM tenants');
    expect(memberRes.rows.length).toBe(1);
    expect(memberRes.rows[0].id).toBe(TENANT_A_ID);
  });

  it('Gate 29: Narrow lookup_tenant_by_slug and lookup_tenant_by_custom_domain SECURITY DEFINER functions return tenant metadata safely', async () => {
    await db.exec(`
      SET ROLE fastify_runtime;
      RESET app.current_user_id;
      RESET app.current_tenant_id;
      RESET app.is_super_admin;
    `);

    // Lookup tenant by slug works for fastify_runtime without session context
    const slugRes = await db.query<{ id: string; name: string; slug: string; status: string }>(
      `SELECT id, name, slug, status FROM public.lookup_tenant_by_slug('apex')`
    );
    expect(slugRes.rows.length).toBe(1);
    expect(slugRes.rows[0].id).toBe(TENANT_A_ID);
    expect(slugRes.rows[0].slug).toBe('apex');
    expect(slugRes.rows[0].status).toBe('active');

    // Non-existent slug returns 0 rows
    const missingRes = await db.query(`SELECT * FROM public.lookup_tenant_by_slug('nonexistent-academy')`);
    expect(missingRes.rows.length).toBe(0);
  });

  it('Gate 30: Narrow lookup_profile_by_auth_id and lookup_profile_by_email SECURITY DEFINER functions return profile data safely', async () => {
    await db.exec(`
      SET ROLE fastify_runtime;
      RESET app.current_user_id;
      RESET app.current_tenant_id;
      RESET app.is_super_admin;
    `);

    // Lookup profile by auth user ID works for fastify_runtime
    const idRes = await db.query<{ id: string; email: string }>(
      `SELECT id, email FROM public.lookup_profile_by_auth_id('${TENANT_A_AUTH_ID}')`
    );
    expect(idRes.rows.length).toBe(1);
    expect(idRes.rows[0].id).toBe(TENANT_A_AUTH_ID);

    // Lookup profile by email works for fastify_runtime
    const emailRes = await db.query<{ id: string; email: string }>(
      `SELECT id, email FROM public.lookup_profile_by_email('adnan@apexacademy.edu.pk')`
    );
    expect(emailRes.rows.length).toBe(1);
    expect(emailRes.rows[0].id).toBe(TENANT_A_AUTH_ID);

    // Non-existent email returns 0 rows
    const nonExistentRes = await db.query(
      `SELECT * FROM public.lookup_profile_by_email('doesnotexist@nowhere.com')`
    );
    expect(nonExistentRes.rows.length).toBe(0);
  });

  it('Gate 31: Anonymous role (anon) cannot execute lookup_profile_by_auth_id (fails with 42501)', async () => {
    await db.exec(`
      SET ROLE anon;
      RESET app.current_user_id;
      RESET app.current_tenant_id;
      RESET app.is_super_admin;
    `);

    await expect(
      db.query(`SELECT * FROM public.lookup_profile_by_auth_id('${TENANT_A_AUTH_ID}')`)
    ).rejects.toThrow(/(permission denied|42501)/i);
  });

  it('Gate 32: Anonymous role (anon) cannot execute lookup_profile_by_email (fails with 42501)', async () => {
    await db.exec(`
      SET ROLE anon;
      RESET app.current_user_id;
      RESET app.current_tenant_id;
      RESET app.is_super_admin;
    `);

    await expect(
      db.query(`SELECT * FROM public.lookup_profile_by_email('adnan@apexacademy.edu.pk')`)
    ).rejects.toThrow(/(permission denied|42501)/i);
  });

  it('Gate 33: Authenticated role cannot directly execute lookup_profile_by_auth_id or lookup_profile_by_email (fails with 42501)', async () => {
    await db.exec(`
      SET ROLE authenticated;
      SET app.current_tenant_id = '${TENANT_A_ID}';
      SET app.current_user_id = '${TENANT_A_AUTH_ID}';
      RESET app.is_super_admin;
    `);

    await expect(
      db.query(`SELECT * FROM public.lookup_profile_by_auth_id('${TENANT_A_AUTH_ID}')`)
    ).rejects.toThrow(/(permission denied|42501)/i);

    await expect(
      db.query(`SELECT * FROM public.lookup_profile_by_email('adnan@apexacademy.edu.pk')`)
    ).rejects.toThrow(/(permission denied|42501)/i);
  });

  it('Gate 34: service_role cannot execute purge_staging_audit_logs (fails with 42501)', async () => {
    await db.exec(`
      SET ROLE service_role;
      RESET app.current_user_id;
      RESET app.current_tenant_id;
      RESET app.is_super_admin;
    `);

    await expect(
      db.query(`SELECT public.purge_staging_audit_logs(ARRAY['00000000-0000-0000-0000-000000000001'::uuid])`)
    ).rejects.toThrow(/(permission denied|42501)/i);
  });

  it('Gate 35: fastify_runtime and authenticated cannot execute purge_staging_audit_logs (fails with 42501)', async () => {
    await db.exec(`
      SET ROLE fastify_runtime;
      RESET app.current_user_id;
      RESET app.current_tenant_id;
      RESET app.is_super_admin;
    `);

    await expect(
      db.query(`SELECT public.purge_staging_audit_logs(ARRAY['00000000-0000-0000-0000-000000000001'::uuid])`)
    ).rejects.toThrow(/(permission denied|42501)/i);

    await db.exec(`
      SET ROLE authenticated;
      SET app.current_tenant_id = '${TENANT_A_ID}';
      SET app.current_user_id = '${TENANT_A_AUTH_ID}';
      RESET app.is_super_admin;
    `);

    await expect(
      db.query(`SELECT public.purge_staging_audit_logs(ARRAY['00000000-0000-0000-0000-000000000001'::uuid])`)
    ).rejects.toThrow(/(permission denied|42501)/i);
  });

  it('Gate 36: postgres role can execute purge_staging_audit_logs safely', async () => {
    await db.exec(`
      SET ROLE postgres;
      RESET app.current_user_id;
      RESET app.current_tenant_id;
      RESET app.is_super_admin;
    `);

    const res = await db.query<{ purged: number }>(
      `SELECT public.purge_staging_audit_logs(ARRAY['00000000-0000-0000-0000-000000000000'::uuid]) as purged`
    );
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].purged).toBe(0);
  });
});
