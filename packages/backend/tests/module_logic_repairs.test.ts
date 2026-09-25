import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { IMailerService } from '../src/services/mailer.js';
import { campusToday } from '../src/lib/campus-date.js';

describe('Module Logic Repairs - Phase 1: Sign-in Truth Verification', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Login without tenant_slug or tenant_id returns 400 TENANT_REQUIRED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@apexacademy.edu.pk',
        password: 'Password123',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('TENANT_REQUIRED');
    expect(body.error.message).toBe('Academy identifier (tenant_slug or tenant_id) is required.');
  });

  it('2. Login with empty string tenant_slug and tenant_id returns 400 TENANT_REQUIRED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@apexacademy.edu.pk',
        password: 'Password123',
        tenant_slug: '   ',
        tenant_id: '',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TENANT_REQUIRED');
  });

  it('3. Login with platform email skips tenant requirement (does not return 400 TENANT_REQUIRED)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'kampuserp@gmail.com',
        password: 'WrongPassword',
      },
    });

    // Skips tenant check; failure is due to credentials or user check (401 AUTH_FAILED), not 400 TENANT_REQUIRED
    expect(res.statusCode).not.toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error?.code).not.toBe('TENANT_REQUIRED');
  });

  it('4. Login with valid tenant_slug does not return 400 TENANT_REQUIRED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@apexacademy.edu.pk',
        password: 'WrongPassword',
        tenant_slug: 'tsa',
      },
    });

    expect(res.statusCode).not.toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error?.code).not.toBe('TENANT_REQUIRED');
  });
});

describe('Module Logic Repairs - Phase 2: Student and Parent Portal Logic', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  const tenantId = 'a0000000-0000-0000-0000-000000000001';

  function registerUser(user: any) {
    (store as any).users.set(`${user.tenant_id}:${user.email.toLowerCase()}`, user);
    (store as any).users.set(user.id, user);
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    store = new InMemoryDataStore();
    app = await buildApp({
      store,
      jwtSecret: 'test-secret-min-32-chars-long-for-vitest',
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Student token cannot load another student ID (returns 403 UNAUTHORIZED_STUDENT_ACCESS)', async () => {
    // Seed student 2
    const student2 = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Other Student',
      admission_number: 'ADM-TEST-002',
      roll_number: 'R-TEST-002',
      program_id: 'a2000000-0000-0000-0000-000000000001',
      batch_id: 'batch-2026-a',
      status: 'active',
      guardian_name: 'Other Guardian',
      guardian_phone: '03001234567',
      guardian_id_card: '35201-7654321-1',
    });

    // Sign token for student 1 (stud-1)
    const student1Token = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000005',
      user_id: 'a1000000-0000-0000-0000-000000000005',
      tenant_id: tenantId,
      email: 'student@apexacademy.edu.pk',
      role: 'student',
    });

    // Student 1 tries to access student 2
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/portal/student-parent?student_id=${student2.id}`,
      headers: { authorization: `Bearer ${student1Token}` },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED_STUDENT_ACCESS');
  });

  it('2. Two students with same roll number do not steal user_id', async () => {
    // Student A has duplicate roll number in batch A, user_id is undefined
    const studentA = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Duplicate Roll Student A',
      admission_number: 'ADM-DUP-A',
      roll_number: 'ROLL-DUP-999',
      program_id: 'a2000000-0000-0000-0000-000000000001',
      batch_id: 'batch-2026-a',
      status: 'active',
      email: 'student_a@example.com',
      guardian_name: 'Guardian A',
      guardian_phone: '03001111111',
      guardian_id_card: '35201-1111111-1',
    });

    // Student B has same roll number in batch B, with existing user_id
    const studentB = await store.createStudent({
      tenant_id: tenantId,
      user_id: 'user-b-original-id',
      full_name: 'Duplicate Roll Student B',
      admission_number: 'ADM-DUP-B',
      roll_number: 'ROLL-DUP-999',
      program_id: 'a2000000-0000-0000-0000-000000000001',
      batch_id: 'batch-2026-b',
      status: 'active',
      email: 'student_b@example.com',
      guardian_name: 'Guardian B',
      guardian_phone: '03002222222',
      guardian_id_card: '35201-2222222-1',
    });

    // Register User C
    const userC = {
      id: 'user-c-attacker-id',
      tenant_id: tenantId,
      email: 'student_c_unlinked@example.com',
      full_name: 'Attacker Student C',
      role: 'student' as const,
      status: 'active' as const,
      password_hash: 'hash',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    registerUser(userC);

    // Token for an unlinked student user C who shares no user_id or email
    const studentCToken = app.jwt.sign({
      sub: 'user-c-attacker-id',
      user_id: 'user-c-attacker-id',
      tenant_id: tenantId,
      email: 'student_c_unlinked@example.com',
      role: 'student',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${studentCToken}` },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error?.code).toBe('STUDENT_UNLINKED');

    // Confirm neither Student A nor Student B had user_id stolen
    const freshA = (await store.getStudents(tenantId)).find(s => s.id === studentA.id);
    const freshB = (await store.getStudents(tenantId)).find(s => s.id === studentB.id);
    expect(freshA?.user_id).not.toBe('user-c-attacker-id');
    expect(freshB?.user_id).toBe('user-b-original-id');
  });

  it('3. Month with no attendance records returns null monthly_attendance_pct (not 100)', async () => {
    // Register student user
    const noAttUser = {
      id: 'user-no-attendance-id',
      tenant_id: tenantId,
      email: 'no_attendance@apexacademy.edu.pk',
      full_name: 'No Attendance Student',
      role: 'student' as const,
      status: 'active' as const,
      password_hash: 'hash',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    registerUser(noAttUser);

    // Create new student with zero attendance records
    await store.createStudent({
      tenant_id: tenantId,
      user_id: 'user-no-attendance-id',
      full_name: 'No Attendance Student',
      admission_number: 'ADM-NO-ATT',
      roll_number: 'R-NO-ATT',
      program_id: 'a2000000-0000-0000-0000-000000000001',
      batch_id: 'batch-2026-a',
      status: 'active',
      email: 'no_attendance@apexacademy.edu.pk',
      guardian_name: 'Guardian NoAtt',
      guardian_phone: '03003333333',
      guardian_id_card: '35201-3333333-1',
    });

    const token = app.jwt.sign({
      sub: 'user-no-attendance-id',
      user_id: 'user-no-attendance-id',
      tenant_id: tenantId,
      email: 'no_attendance@apexacademy.edu.pk',
      role: 'student',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.student_profile.monthly_attendance_pct).toBeNull();
  });

  it('4. Parent binding skips portal_blocked first child and opens next unblocked child', async () => {
    const parentCnic = '35201-8888888-1';

    // First child is portal_blocked
    const child1 = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Blocked Child 1',
      admission_number: 'ADM-BLK-1',
      roll_number: 'R-BLK-1',
      program_id: 'a2000000-0000-0000-0000-000000000001',
      batch_id: 'batch-2026-a',
      status: 'withdrawn',
      guardian_name: 'Parent Testing',
      guardian_phone: '03004444444',
      guardian_id_card: parentCnic,
    });
    (child1 as any).portal_blocked = true;

    // Second child is active and unblocked
    const child2 = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Active Child 2',
      admission_number: 'ADM-ACT-2',
      roll_number: 'R-ACT-2',
      program_id: 'a2000000-0000-0000-0000-000000000001',
      batch_id: 'batch-2026-b',
      status: 'active',
      guardian_name: 'Parent Testing',
      guardian_phone: '03004444444',
      guardian_id_card: parentCnic,
    });

    // Register parent user
    const parentUserId = 'user-parent-test-id';
    const parentUser = {
      id: parentUserId,
      tenant_id: tenantId,
      email: 'parent.testing@example.com',
      password_hash: 'hash123',
      full_name: 'Parent Testing',
      role: 'parent' as const,
      status: 'active' as const,
      metadata: {
        guardian_id_card: parentCnic,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    registerUser(parentUser);

    const parentToken = app.jwt.sign({
      sub: parentUserId,
      user_id: parentUserId,
      tenant_id: tenantId,
      email: 'parent.testing@example.com',
      role: 'parent',
      cnic: parentCnic,
    });

    // Request without student_id should automatically skip child1 and open child2
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${parentToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.student_profile.id).toBe(child2.id);
    expect(body.data.linked_children).toHaveLength(1);
    expect(body.data.linked_children[0].id).toBe(child2.id);

    // If child2 is also blocked, returns NO_LINKED_CHILDREN
    (child2 as any).portal_blocked = true;
    const resAllBlocked = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${parentToken}` },
    });

    expect(resAllBlocked.statusCode).toBe(403);
    const blockedBody = resAllBlocked.json();
    expect(blockedBody.error?.code).toBe('NO_LINKED_CHILDREN');
  });
});

describe('Module Logic Repairs - Phase 3: Seats, opening challan, and failed challan after save', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  const tenantId = 'a0000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    store = new InMemoryDataStore();
    app = await buildApp({
      store,
      jwtSecret: 'test-secret-min-32-chars-long-for-vitest',
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Waitlisted student releases seat, enrollment becomes withdrawn, portal is blocked', async () => {
    const batch = (await store.getBatches(tenantId))[0];
    const initialSeats = batch.current_enrollment;

    const student = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Waitlist Test Student',
      admission_number: 'ADM-WL-001',
      roll_number: 'R-WL-001',
      program_id: batch.program_id,
      batch_id: batch.id,
      status: 'active',
      guardian_name: 'Waitlist Guardian',
      guardian_phone: '03009999001',
      guardian_id_card: '35201-9999001-1',
    });

    // Seat increased
    expect(batch.current_enrollment).toBe(initialSeats + 1);

    // Update status to waitlisted
    const updated = await store.updateStudentStatus(tenantId, student.id, 'waitlisted', 'Moved to waitlist');
    expect(updated?.status).toBe('waitlisted');
    expect((updated as any).portal_blocked).toBe(true);

    // Batch seat count decrements back (seat released)
    expect(batch.current_enrollment).toBe(initialSeats);

    // Enrollment status is 'withdrawn'
    const enrollments = await store.getStudentEnrollments(tenantId, student.id);
    expect(enrollments[0].status).toBe('withdrawn');

    // User portal is blocked
    const user = (store as any).users.get(student.user_id);
    expect(user.status).toBe('inactive');
    expect(user.metadata.portal_blocked).toBe(true);

    // Portal login attempt using guardian CNIC is blocked
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: '35201-9999001-1',
        password: 'Student@123',
        tenant_id: tenantId,
      },
    });
    expect(loginRes.statusCode).toBe(401);
    const loginBody = loginRes.json();
    expect(loginBody.error?.message).toMatch(/portal access has been restricted|inactive/);

    // Creating a student directly with status 'waitlisted'
    const wlStudent = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Direct Waitlist Student',
      admission_number: 'ADM-WL-002',
      roll_number: 'R-WL-002',
      program_id: batch.program_id,
      batch_id: batch.id,
      status: 'waitlisted',
      guardian_name: 'Waitlist Guardian 2',
      guardian_phone: '03009999002',
      guardian_id_card: '35201-9999002-1',
    });

    // Seat must NOT increase
    expect(batch.current_enrollment).toBe(initialSeats);
    const wlEnrollments = await store.getStudentEnrollments(tenantId, wlStudent.id);
    expect(wlEnrollments[0].status).toBe('withdrawn');
    expect((wlStudent as any).portal_blocked).toBe(true);
  });

  it('2. First installment with amount 0 creates no invoice (does not bill PKR 1000 fallback)', async () => {
    const batch = (await store.getBatches(tenantId))[0];
    const student = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Zero Installment Student',
      admission_number: 'ADM-ZERO-001',
      roll_number: 'R-ZERO-001',
      program_id: batch.program_id,
      batch_id: batch.id,
      status: 'active',
      guardian_name: 'Zero Guardian',
      guardian_phone: '03008888001',
      guardian_id_card: '35201-8888001-1',
      billing_mode: 'installment',
      generate_first_month_invoice: true,
      installment_plan: {
        total_installments: 3,
        installments: [
          {
            installment_number: 1,
            amount: 0,
            due_date: '2026-10-15',
            status: 'pending',
            invoice_id: null,
          },
          {
            installment_number: 2,
            amount: 5000,
            due_date: '2026-11-15',
            status: 'pending',
            invoice_id: null,
          },
          {
            installment_number: 3,
            amount: 5000,
            due_date: '2026-12-15',
            status: 'pending',
            invoice_id: null,
          },
        ],
      },
      fee_structure: {
        base_tuition: 10000,
        net_tuition: 0,
        admission_fee: 0,
        exam_fee: 0,
        recurring_monthly: 0,
        first_month_total: 0,
      } as any,
    });

    // Verify no invoice was created for this student (no PKR 1000 fallback)
    expect(student.first_invoice_id).toBeFalsy();
    const invoices = (await store.getInvoices(tenantId)).filter(i => i.student_id === student.id);
    expect(invoices).toHaveLength(0);
  });

  it('3. Section at capacity blocks promotion of an on-leave student', async () => {
    // Create a target batch with max_capacity = 2
    const targetBatch = await store.createBatch({
      tenant_id: tenantId,
      name: 'Full Target Batch',
      program_id: 'a2000000-0000-0000-0000-000000000001',
      academic_session: '2026-2027',
      max_capacity: 2,
      shift: 'Morning',
      is_active: true,
    } as any);

    // Create 1 active student and 1 on_leave student in the target batch
    const studentA = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Target Batch Student A',
      admission_number: 'ADM-TGT-001',
      roll_number: 'R-TGT-001',
      program_id: targetBatch.program_id,
      batch_id: targetBatch.id,
      status: 'active',
      guardian_name: 'Target Guardian A',
      guardian_phone: '03007777001',
      guardian_id_card: '35201-7777001-1',
    });

    const studentB = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Target Batch Student B',
      admission_number: 'ADM-TGT-002',
      roll_number: 'R-TGT-002',
      program_id: targetBatch.program_id,
      batch_id: targetBatch.id,
      status: 'on_leave',
      guardian_name: 'Target Guardian B',
      guardian_phone: '03007777002',
      guardian_id_card: '35201-7777002-1',
    });

    // Capacity is now 2/2 (1 active + 1 on_leave)
    const enrollmentsInTarget = (await store.getStudentEnrollments(tenantId, studentA.id))
      .concat(await store.getStudentEnrollments(tenantId, studentB.id))
      .filter(e => e.batch_id === targetBatch.id && (e.status === 'active' || e.status === 'on_leave'));
    expect(enrollmentsInTarget).toHaveLength(2);

    // Create another student who is on_leave in a different batch
    const sourceStudent = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Source On-Leave Student',
      admission_number: 'ADM-SRC-001',
      roll_number: 'R-SRC-001',
      program_id: targetBatch.program_id,
      batch_id: 'batch-2026-a',
      status: 'on_leave',
      guardian_name: 'Source Guardian',
      guardian_phone: '03007777003',
      guardian_id_card: '35201-7777003-1',
    });

    // Attempt to promote the on_leave student into the full targetBatch
    await expect(
      store.promoteStudents(tenantId, {
        student_ids: [sourceStudent.id],
        target_batch_id: targetBatch.id,
        fee_adjustment_type: 'keep',
      })
    ).rejects.toThrow(/Target batch capacity exceeded/);

    // Ensure the on_leave student was NOT moved
    const refreshedSource = (await store.getStudents(tenantId)).find(s => s.id === sourceStudent.id);
    expect(refreshedSource?.batch_id).not.toBe(targetBatch.id);
  });

  it('4. Admission and Add Class return success and surface challan_error if opening invoice generation throws', async () => {
    // Mock generateInvoice to throw for this test
    const originalGenerateInvoice = store.generateInvoice.bind(store);
    (store as any).generateInvoice = async () => {
      throw new Error('Billing configuration error: tuition head missing');
    };

    try {
      const adminToken = app.jwt.sign({
        sub: 'a1000000-0000-0000-0000-000000000099',
        user_id: 'a1000000-0000-0000-0000-000000000099',
        tenant_id: tenantId,
        email: 'admin@apex.edu.pk',
        role: 'tenant_admin',
      });

      // 4a. Admission with failing invoice generation returns HTTP 201 + challan_error
      const admRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Challan Error Student',
          admission_number: 'ADM-CH-ERR-001',
          roll_number: 'R-CH-ERR-001',
          program_id: 'a2000000-0000-0000-0000-000000000001',
          batch_id: 'a3000000-0000-0000-0000-000000000001',
          guardian_name: 'Challan Guardian',
          guardian_phone: '03006666001',
          guardian_id_card: '35201-6666001-1',
          generate_first_month_invoice: true,
          fee_structure: {
            base_tuition: 5000,
            net_tuition: 5000,
            first_month_total: 5000,
          },
        },
      });

      expect(admRes.statusCode).toBe(201);
      const admBody = admRes.json();
      expect(admBody.success).toBe(true);
      expect(admBody.data.id).toBeDefined();
      expect(admBody.challan_error).toBe('Billing configuration error: tuition head missing');

      // 4b. Add Class with failing invoice generation returns HTTP 201 + challan_error
      const addClassRes = await app.inject({
        method: 'POST',
        url: `/api/v1/sis/students/${admBody.data.id}/enrollments`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          batch_id: 'a3000000-0000-0000-0000-000000000002',
          generate_opening_challan: true,
        },
      });

      expect(addClassRes.statusCode).toBe(201);
      const addClassBody = addClassRes.json();
      expect(addClassBody.success).toBe(true);
      expect(addClassBody.data.id).toBeDefined();
      expect(addClassBody.challan_error).toBe('Billing configuration error: tuition head missing');
    } finally {
      (store as any).generateInvoice = originalGenerateInvoice;
    }
  });
});

describe('Module Logic Repairs - Phase 4: Fee Ledger, Receipts, Challans & Concessions', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  const tenantId = 'a0000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    store = new InMemoryDataStore();
    app = await buildApp({
      store,
      jwtSecret: 'test-secret-min-32-chars-long-for-vitest',
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Concession updates balance_due, net_total, total_amount, and line item balance_due', async () => {
    const student = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Concession Test Student',
      admission_number: 'ADM-CONC-001',
      roll_number: 'R-CONC-001',
      program_id: 'a2000000-0000-0000-0000-000000000001',
      batch_id: 'a3000000-0000-0000-0000-000000000001',
      guardian_name: 'Guardian',
      guardian_phone: '03001234567',
    });

    const tuitionHead = (await store.getFeeHeads(tenantId))[0];
    const invoice = await store.generateInvoice(tenantId, {
      student_id: student.id,
      billing_month: '2026-08',
      due_date: '2026-08-10',
      custom_items: [{ fee_head_id: tuitionHead.id, amount: 5000 }],
    });

    expect(invoice.net_amount).toBe(5000);
    expect(invoice.balance_due).toBe(5000);

    const discount = await store.applyDiscount(tenantId, {
      student_id: student.id,
      invoice_id: invoice.id,
      fee_head_id: tuitionHead.id,
      discount_type: 'flat',
      discount_value: 1000,
      mandatory_reason: 'Merit scholarship approved by principal',
      approved_by: 'Principal',
    });

    expect(discount.actual_discount_amount).toBe(1000);
    expect(invoice.discount_amount).toBe(1000);
    expect(invoice.net_amount).toBe(4000);
    expect(invoice.net_total).toBe(4000);
    expect(invoice.total_amount).toBe(4000);
    expect(invoice.balance_amount).toBe(4000);
    expect(invoice.balance_due).toBe(4000);
    expect(invoice.items[0].net_amount).toBe(4000);
    expect(invoice.items[0].balance_due).toBe(4000);
    expect(invoice.items[0].discount_amount).toBe(1000);
    expect(invoice.status).toBe('unpaid');
  });

  it('2. Empty-line edit rejects; zeroed edit leaves status unpaid', async () => {
    const student = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Edit Test Student',
      admission_number: 'ADM-EDIT-001',
      roll_number: 'R-EDIT-001',
      program_id: 'a2000000-0000-0000-0000-000000000001',
      batch_id: 'a3000000-0000-0000-0000-000000000001',
      guardian_name: 'Guardian',
      guardian_phone: '03001234571',
    });
    const tuitionHead = (await store.getFeeHeads(tenantId))[0];
    const invoice = await store.generateInvoice(tenantId, {
      student_id: student.id,
      billing_month: '2026-09',
      due_date: '2026-09-10',
      custom_items: [{ fee_head_id: tuitionHead.id, amount: 3000 }],
    });

    // Empty line edit must throw
    await expect(
      store.updateInvoice(tenantId, invoice.id, {
        items: [],
      })
    ).rejects.toThrow('At least one fee line item is required.');

    // Zeroed edit: items with amount 0
    const updated = await store.updateInvoice(tenantId, invoice.id, {
      items: [{ fee_head_id: tuitionHead.id, amount: 0 }],
    });

    expect(updated.net_amount).toBe(0);
    expect(updated.balance_amount).toBe(0);
    expect(updated.balance_due).toBe(0);
    expect(updated.paid_amount).toBe(0);
    expect(updated.status).toBe('unpaid');
  });

  it('3. Monotonic Invoice and Receipt numbers are never reused upon deletion', async () => {
    const student = (await store.getStudents(tenantId))[0];
    const tuitionHead = (await store.getFeeHeads(tenantId))[0];

    const inv1 = await store.generateInvoice(tenantId, {
      student_id: student.id,
      billing_month: '2026-10',
      due_date: '2026-10-10',
      custom_items: [{ fee_head_id: tuitionHead.id, amount: 2000 }],
    });
    const inv1Num = inv1.invoice_number;
    const inv1Suffix = parseInt(inv1Num.split('-')[2], 10);

    // Delete invoice 1
    await store.deleteInvoice(tenantId, inv1.id, 'Test deletion', 'admin');

    // Next invoice must have a higher suffix, never reusing inv1Num
    const inv2 = await store.generateInvoice(tenantId, {
      student_id: student.id,
      billing_month: '2026-10',
      due_date: '2026-10-10',
      custom_items: [{ fee_head_id: tuitionHead.id, amount: 2000 }],
    });
    const inv2Num = inv2.invoice_number;
    const inv2Suffix = parseInt(inv2Num.split('-')[2], 10);
    expect(inv2Suffix).toBeGreaterThan(inv1Suffix);

    // Record payment 1
    const { payment: p1 } = await store.recordPayment(tenantId, {
      invoice_id: inv2.id,
      amount_paid: 1000,
      payment_method: 'cash',
      collected_by: 'Cashier',
    });
    const p1Num = p1.receipt_number;
    const p1Suffix = parseInt(p1Num.split('-')[2], 10);

    // Void/revert payment 1
    await store.voidPayment(tenantId, p1.id, 'Test reversal', 'admin');

    // Record payment 2
    const { payment: p2 } = await store.recordPayment(tenantId, {
      invoice_id: inv2.id,
      amount_paid: 1000,
      payment_method: 'cash',
      collected_by: 'Cashier',
    });
    const p2Num = p2.receipt_number;
    const p2Suffix = parseInt(p2Num.split('-')[2], 10);
    expect(p2Suffix).toBeGreaterThan(p1Suffix);
  });

  it('4. Rolled-over balance restoration restores net minus paid on cancel/delete', async () => {
    const student = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Rollover Test Student',
      admission_number: 'ADM-ROLL-001',
      roll_number: 'R-ROLL-001',
      program_id: 'a2000000-0000-0000-0000-000000000001',
      batch_id: 'a3000000-0000-0000-0000-000000000001',
      guardian_name: 'Guardian',
      guardian_phone: '03001234568',
    });
    const tuitionHead = (await store.getFeeHeads(tenantId))[0];

    // Invoice 1: 5000 net, pay 2000 => 3000 balance
    const inv1 = await store.generateInvoice(tenantId, {
      student_id: student.id,
      billing_month: '2026-01',
      due_date: '2026-01-10',
      custom_items: [{ fee_head_id: tuitionHead.id, amount: 5000 }],
    });
    await store.recordPayment(tenantId, {
      invoice_id: inv1.id,
      amount_paid: 2000,
      payment_method: 'cash',
      collected_by: 'Cashier',
    });
    expect(inv1.balance_amount).toBe(3000);

    // Invoice 2: include_arrears rolls over inv1
    const inv2 = await store.generateInvoice(tenantId, {
      student_id: student.id,
      billing_month: '2026-02',
      due_date: '2026-02-10',
      include_arrears: true,
      custom_items: [{ fee_head_id: tuitionHead.id, amount: 5000 }],
    });
    expect(inv1.status).toBe('rolled_over');
    expect(inv1.balance_amount).toBe(0);

    // Cancel Invoice 2
    await store.cancelInvoice(tenantId, inv2.id, 'Cancelled billing', 'admin');

    // Inv1 should be restored to 3000 (net - paid), NOT 5000!
    expect(inv1.status).toBe('unpaid');
    expect(inv1.balance_amount).toBe(3000);
    expect(inv1.balance_due).toBe(3000);
  });

  it('5. Batch invoice generation skips zero-amount installments and bills separate enrollments', async () => {
    const batch = (await store.getBatches(tenantId))[0];
    const zeroStudent = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Zero Installment Student',
      admission_number: 'ADM-ZERO-001',
      roll_number: 'R-ZERO-001',
      program_id: batch.program_id,
      batch_id: batch.id,
      guardian_name: 'Guardian',
      guardian_phone: '03001234569',
      billing_mode: 'installment',
      installment_plan: {
        total_installments: 2,
        installments: [
          { installment_number: 1, amount: 0, due_date: '2026-11-05', status: 'pending' },
          { installment_number: 2, amount: 4000, due_date: '2026-12-05', status: 'pending' },
        ],
      },
    });

    const generated = await store.generateBatchInvoices(tenantId, {
      batch_id: batch.id,
      billing_month: '2026-11',
      due_date: '2026-11-10',
    });

    // Zero installment student must be in skipped and have no invoice created
    const skipped = (generated as any).skipped || [];
    expect(skipped).toContain('Zero Installment Student');
    const createdForZero = generated.find(i => i.student_id === zeroStudent.id);
    expect(createdForZero).toBeUndefined();

    // Multi-enrollment student billed in both batches without hiding
    const batch2 = (await store.getBatches(tenantId))[1];
    const multiStudent = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Multi Batch Student',
      admission_number: 'ADM-MULTI-001',
      roll_number: 'R-MULTI-001',
      program_id: batch.program_id,
      batch_id: batch.id,
      guardian_name: 'Guardian',
      guardian_phone: '03001234570',
    });

    // Add second enrollment in batch 2
    await store.createStudentEnrollment(tenantId, multiStudent.id, {
      batch_id: batch2.id,
      roll_number: 'R-MULTI-002',
    });

    const genBatch1 = await store.generateBatchInvoices(tenantId, {
      batch_id: batch.id,
      billing_month: '2026-12',
      due_date: '2026-12-10',
    });
    const invBatch1 = genBatch1.find(i => i.student_id === multiStudent.id);
    expect(invBatch1).toBeDefined();

    const genBatch2 = await store.generateBatchInvoices(tenantId, {
      batch_id: batch2.id,
      billing_month: '2026-12',
      due_date: '2026-12-10',
    });
    const invBatch2 = genBatch2.find(i => i.student_id === multiStudent.id);
    expect(invBatch2).toBeDefined();
    expect(invBatch2?.id).not.toBe(invBatch1?.id);
  });

  it('6. Discount endpoint returns 403 for student/parent tokens and 200 for staff', async () => {
    const studentToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000005',
      user_id: 'a1000000-0000-0000-0000-000000000005',
      tenant_id: tenantId,
      email: 'student@apexacademy.edu.pk',
      role: 'student',
    });

    const parentUserId = 'p1000000-0000-0000-0000-000000000001';
    (store as any).users.set(parentUserId, {
      id: parentUserId,
      tenant_id: tenantId,
      email: 'parent.testing@example.com',
      full_name: 'Test Parent',
      role: 'parent',
      status: 'active',
      password_hash: 'hash',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const parentToken = app.jwt.sign({
      sub: parentUserId,
      user_id: parentUserId,
      tenant_id: tenantId,
      email: 'parent.testing@example.com',
      role: 'parent',
    });

    const adminToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000001',
      user_id: 'a1000000-0000-0000-0000-000000000001',
      tenant_id: tenantId,
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin',
    });

    // Student GET /discounts -> 403
    const sRes = await app.inject({
      method: 'GET',
      url: '/api/v1/finance/discounts',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(sRes.statusCode).toBe(403);

    // Parent GET /discounts -> 403
    const pRes = await app.inject({
      method: 'GET',
      url: '/api/v1/finance/discounts',
      headers: { authorization: `Bearer ${parentToken}` },
    });
    expect(pRes.statusCode).toBe(403);

    // Admin GET /discounts -> 200
    const aRes = await app.inject({
      method: 'GET',
      url: '/api/v1/finance/discounts',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(aRes.statusCode).toBe(200);
  });

  it('7. Cheque payments require cheque_number and family payments rollback atomically on child failure', async () => {
    const student1 = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Family Sibling 1',
      admission_number: 'ADM-FAM-001',
      roll_number: 'R-FAM-001',
      program_id: 'a2000000-0000-0000-0000-000000000001',
      batch_id: 'a3000000-0000-0000-0000-000000000001',
      guardian_name: 'Family Parent',
      guardian_phone: '03009999001',
      billing_mode: 'installment',
      installment_plan: {
        total_installments: 2,
        installments: [
          { installment_number: 1, amount: 2000, due_date: '2026-03-05', status: 'pending' },
          { installment_number: 2, amount: 2000, due_date: '2026-04-05', status: 'pending' },
        ],
      },
    });

    const tuitionHead = (await store.getFeeHeads(tenantId))[0];
    const inv1 = await store.generateInvoice(tenantId, {
      student_id: student1.id,
      billing_month: '2026-03',
      due_date: '2026-03-10',
      installment_number: 1,
      custom_items: [{ fee_head_id: tuitionHead.id, amount: 2000 }],
    });
    student1.installment_plan!.installments[0].status = 'billed';
    student1.installment_plan!.installments[0].invoice_id = inv1.id;

    // Cheque payment without cheque_number throws error
    await expect(
      store.recordPayment(tenantId, {
        invoice_id: inv1.id,
        amount_paid: 2000,
        payment_method: 'cheque',
        collected_by: 'Cashier',
      })
    ).rejects.toThrow('Cheque number is required for cheque payments.');

    // Cheque payment with cheque_number succeeds and stores cheque_number
    const famSuccess = await store.recordFamilyPayment(tenantId, {
      payment_method: 'cheque',
      cheque_number: 'CHQ-998877',
      bank_name: 'Meezan Bank',
      collected_by: 'Cashier',
      payments: [
        {
          invoice_id: inv1.id,
          amount_paid: 2000,
        },
      ],
    });

    expect(famSuccess.results[0].payment.cheque_number).toBe('CHQ-998877');
    expect(student1.installment_plan!.installments[0].status).toBe('paid');
    expect(inv1.status).toBe('paid');

    // Create Sibling 2
    const student2 = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Family Sibling 2',
      admission_number: 'ADM-FAM-002',
      roll_number: 'R-FAM-002',
      program_id: 'a2000000-0000-0000-0000-000000000001',
      batch_id: 'a3000000-0000-0000-0000-000000000001',
      guardian_name: 'Family Parent',
      guardian_phone: '03009999001',
      billing_mode: 'installment',
      installment_plan: {
        total_installments: 2,
        installments: [
          { installment_number: 1, amount: 3000, due_date: '2026-04-05', status: 'pending' },
        ],
      },
    });

    const inv1_milestone2 = await store.generateInvoice(tenantId, {
      student_id: student1.id,
      billing_month: '2026-04',
      due_date: '2026-04-10',
      installment_number: 2,
      custom_items: [{ fee_head_id: tuitionHead.id, amount: 2000 }],
    });
    student1.installment_plan!.installments[1].status = 'billed';
    student1.installment_plan!.installments[1].invoice_id = inv1_milestone2.id;

    const inv2 = await store.generateInvoice(tenantId, {
      student_id: student2.id,
      billing_month: '2026-04',
      due_date: '2026-04-10',
      installment_number: 1,
      custom_items: [{ fee_head_id: tuitionHead.id, amount: 3000 }],
    });
    student2.installment_plan!.installments[0].status = 'billed';
    student2.installment_plan!.installments[0].invoice_id = inv2.id;

    // Trigger family payment where child 1 succeeds but child 2 fails (e.g. overpayment without override -> throws)
    await expect(
      store.recordFamilyPayment(tenantId, {
        payment_method: 'cash',
        collected_by: 'Cashier',
        payments: [
          {
            invoice_id: inv1_milestone2.id,
            amount_paid: 2000,
          },
          {
            invoice_id: inv2.id,
            amount_paid: 99999, // exceeds outstanding without override -> throws!
          },
        ],
      })
    ).rejects.toThrow(/Amount exceeds outstanding/);

    // Verify Child 1 is rolled back: milestone remains 'billed', invoice remains 'unpaid'
    expect(student1.installment_plan!.installments[1].status).toBe('billed');
    expect(inv1_milestone2.status).toBe('unpaid');
    expect(inv1_milestone2.paid_amount).toBe(0);
    expect(inv1_milestone2.balance_due).toBe(2000);
  });
});

describe('Module Logic Repairs - Phase 5: Examinations & Question Security', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let tenantId: string;
  let batch1: any;
  let batch2: any;
  let subject1: any;
  let student1: any;
  let student2: any;
  let exam1: any;
  let exam2: any;
  let q1: any;
  let q2: any;
  let adminToken: string;
  let teacherBatch1Token: string;
  let student1Token: string;
  let parentToken: string;

  beforeAll(async () => {
    store = new InMemoryDataStore();
    app = await buildApp({
      store,
      jwtSecret: 'test-secret-min-32-chars-long-for-vitest',
    });
    await app.ready();

    const tenant = await store.createTenant({
      name: 'Exam Security Academy',
      slug: 'exam-security',
      campus_name: 'Main Campus',
      admin_email: 'admin@examsec.edu.pk',
      admin_name: 'Admin User',
      status: 'active',
    });
    tenantId = tenant.id;

    const program = await store.createProgram({
      tenant_id: tenantId,
      name: 'Class 10',
      code: 'C10',
      status: 'active',
      curriculum_type: 'single_tier',
      default_fee_cadence: 'monthly',
      duration_months: 12,
    });

    batch1 = await store.createBatch({
      tenant_id: tenantId,
      name: 'Section A',
      program_id: program.id,
      capacity: 30,
      shift: 'Morning',
      academic_session: '2026-2027',
      status: 'active',
      term_structure: 'TWO_TERMS',
      subject_ids: [],
    });

    batch2 = await store.createBatch({
      tenant_id: tenantId,
      name: 'Section B',
      program_id: program.id,
      capacity: 30,
      shift: 'Morning',
      academic_session: '2026-2027',
      status: 'active',
      term_structure: 'TWO_TERMS',
      subject_ids: [],
    });

    subject1 = await store.createSubject({
      tenant_id: tenantId,
      name: 'Physics',
      code: 'PHY-10',
      program_id: program.id,
      status: 'active',
    });

    // Create students
    student1 = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Ahmed Khan',
      guardian_name: 'Tariq Khan',
      guardian_id_card: '42101-1111111-1',
      program_id: program.id,
      batch_id: batch1.id,
      status: 'active',
      admission_number: 'ADM-101',
      roll_number: '101',
      subjects: [subject1.id],
    });

    student2 = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Bilal Khan',
      guardian_name: 'Tariq Khan',
      guardian_id_card: '42101-1111111-1',
      program_id: program.id,
      batch_id: batch1.id,
      status: 'active',
      admission_number: 'ADM-102',
      roll_number: '102',
      subjects: [subject1.id],
    });

    // Exam 1 for Section A
    exam1 = await store.createExam(tenantId, {
      batch_id: batch1.id,
      subject_id: subject1.id,
      title: 'Physics Midterm Paper',
      exam_date: '2026-05-15',
      duration_minutes: 60,
      total_marks: 100,
      mcq_count: 2,
      mcq_marks_per_q: 10,
      mcq_total_marks: 20,
      short_total_marks: 40,
      long_total_marks: 40,
      section_labels: {
        mcq: 'Q.1 MCQs',
        short: 'Q.2 Short Questions',
        long: 'Q.3 Long Questions',
      },
      status: 'PUBLISHED',
    });

    const questions = await store.addExamQuestions(tenantId, exam1.id, [
      {
        section_type: 'MCQ',
        display_order: 1,
        question_text: 'SI unit of force is?',
        marks: 10,
        options: [
          { key: 'A', text: 'Newton' },
          { key: 'B', text: 'Joule' },
        ],
        correct_option: 'A',
      },
      {
        section_type: 'MCQ',
        display_order: 2,
        question_text: 'Acceleration due to gravity near Earth surface is?',
        marks: 10,
        options: [
          { key: 'A', text: '9.8 m/s^2' },
          { key: 'B', text: '100 m/s^2' },
        ],
        correct_option: 'A',
      },
      {
        section_type: 'SHORT',
        display_order: 3,
        question_text: 'Define Newton First Law of Motion.',
        marks: 40,
      },
      {
        section_type: 'LONG',
        display_order: 4,
        question_text: 'State and derive Newton Second Law of Motion.',
        marks: 40,
      },
    ]);
    q1 = questions[0];
    q2 = questions[1];

    // Exam 2 for Section B
    exam2 = await store.createExam(tenantId, {
      batch_id: batch2.id,
      subject_id: subject1.id,
      title: 'Physics Section B Midterm Paper',
      exam_date: '2026-05-16',
      duration_minutes: 60,
      total_marks: 100,
      mcq_count: 0,
      mcq_marks_per_q: 0,
      mcq_total_marks: 0,
      short_total_marks: 50,
      long_total_marks: 50,
      section_labels: {
        mcq: 'Q.1 MCQs',
        short: 'Q.2 Short Questions',
        long: 'Q.3 Long Questions',
      },
      status: 'PUBLISHED',
    });

    const adminUser = {
      id: 'admin-user-id',
      tenant_id: tenantId,
      email: 'admin@examsec.edu.pk',
      full_name: 'Admin User',
      role: 'tenant_admin',
      status: 'active',
      password_hash: 'hash',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).users.set(adminUser.id, adminUser);
    (store as any).users.set(`${tenantId}:${adminUser.email.toLowerCase()}`, adminUser);

    const teacherUser = {
      id: 'teacher-user-id',
      tenant_id: tenantId,
      email: 'teacher@examsec.edu.pk',
      full_name: 'Physics Teacher',
      role: 'teacher',
      status: 'active',
      password_hash: 'hash',
      metadata: {
        access: {
          exams_marks: 'edit',
          exams_reports: 'view',
        },
        teaching_assignments: [{ batch_id: batch1.id }],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).users.set(teacherUser.id, teacherUser);
    (store as any).users.set(`${tenantId}:${teacherUser.email.toLowerCase()}`, teacherUser);

    const studentUser = {
      id: 'student-user-id',
      tenant_id: tenantId,
      email: 'student1@examsec.edu.pk',
      full_name: 'Ahmed Khan',
      role: 'student',
      status: 'active',
      password_hash: 'hash',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).users.set(studentUser.id, studentUser);
    (store as any).users.set(`${tenantId}:${studentUser.email.toLowerCase()}`, studentUser);
    student1.user_id = studentUser.id;
    student1.email = studentUser.email;

    const parentUser = {
      id: 'parent-user-id',
      tenant_id: tenantId,
      email: 'parent1@examsec.edu.pk',
      full_name: 'Tariq Khan',
      role: 'parent',
      status: 'active',
      password_hash: 'hash',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).users.set(parentUser.id, parentUser);
    (store as any).users.set(`${tenantId}:${parentUser.email.toLowerCase()}`, parentUser);

    adminToken = app.jwt.sign({
      sub: adminUser.id,
      tenant_id: tenantId,
      email: adminUser.email,
      role: 'tenant_admin',
    });

    student1Token = app.jwt.sign({
      sub: studentUser.id,
      tenant_id: tenantId,
      email: studentUser.email,
      student_id: student1.id,
      admission_number: student1.admission_number,
      role: 'student',
    });

    parentToken = app.jwt.sign({
      sub: parentUser.id,
      tenant_id: tenantId,
      email: parentUser.email,
      cnic: '42101-1111111-1',
      role: 'parent',
    });

    teacherBatch1Token = app.jwt.sign({
      sub: teacherUser.id,
      tenant_id: tenantId,
      email: teacherUser.email,
      role: 'teacher',
      metadata: teacherUser.metadata,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. GET /api/v1/exams and GET /api/v1/exams/:id strip correct_option for student and parent tokens, but include for admin', async () => {
    // 1a. Student token GET /api/v1/exams
    const resStudent = await app.inject({
      method: 'GET',
      url: '/api/v1/exams',
      headers: { authorization: `Bearer ${student1Token}` },
    });
    expect(resStudent.statusCode).toBe(200);
    const bodyStudent = JSON.parse(resStudent.body);
    expect(bodyStudent.success).toBe(true);
    const ex1Student = bodyStudent.data.find((e: any) => e.id === exam1.id);
    expect(ex1Student).toBeDefined();
    expect(ex1Student.questions).toBeDefined();
    expect(ex1Student.questions.length).toBeGreaterThan(0);
    for (const q of ex1Student.questions) {
      expect(q.correct_option).toBeUndefined();
    }

    // 1b. Student token GET /api/v1/exams/:id
    const resStudentSingle = await app.inject({
      method: 'GET',
      url: `/api/v1/exams/${exam1.id}`,
      headers: { authorization: `Bearer ${student1Token}` },
    });
    expect(resStudentSingle.statusCode).toBe(200);
    const bodyStudentSingle = JSON.parse(resStudentSingle.body);
    for (const q of bodyStudentSingle.data.questions) {
      expect(q.correct_option).toBeUndefined();
    }

    // 1c. Parent token GET /api/v1/exams
    const resParent = await app.inject({
      method: 'GET',
      url: '/api/v1/exams',
      headers: { authorization: `Bearer ${parentToken}` },
    });
    expect(resParent.statusCode).toBe(200);
    const bodyParent = JSON.parse(resParent.body);
    const ex1Parent = bodyParent.data.find((e: any) => e.id === exam1.id);
    expect(ex1Parent).toBeDefined();
    for (const q of ex1Parent.questions) {
      expect(q.correct_option).toBeUndefined();
    }

    // 1d. Admin token GET /api/v1/exams/:id includes correct_option
    const resAdmin = await app.inject({
      method: 'GET',
      url: `/api/v1/exams/${exam1.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(resAdmin.statusCode).toBe(200);
    const bodyAdmin = JSON.parse(resAdmin.body);
    const mcq1 = bodyAdmin.data.questions.find((q: any) => q.section_type === 'MCQ');
    expect(mcq1.correct_option).toBe('A');
  });

  it('2. GET /api/v1/exams for teacher is limited to batchScope', async () => {
    const resTeacher = await app.inject({
      method: 'GET',
      url: '/api/v1/exams',
      headers: { authorization: `Bearer ${teacherBatch1Token}` },
    });
    expect(resTeacher.statusCode).toBe(200);
    const bodyTeacher = JSON.parse(resTeacher.body);
    const examIds = bodyTeacher.data.map((e: any) => e.id);
    expect(examIds).toContain(exam1.id);
    expect(examIds).not.toContain(exam2.id); // batch2 exam must not appear for batch1-scoped teacher
  });

  it('3. An 85% score saves and returns grade A+ when no custom scale is set', async () => {
    // MCQ total: 2 * 10 = 20 (both answered correctly -> 20)
    // Short score: 35
    // Long score: 30
    // Total: 85 / 100 = 85%
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/exams/${exam1.id}/evaluate`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        student_id: student1.id,
        mcq_answers: {
          [q1.id]: 'A',
          [q2.id]: 'A',
        },
        short_score: 35,
        short_remarks: 'Well written answers.',
        long_score: 30,
        long_remarks: 'Good derivation.',
        status: 'GRADED',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.total_obtained).toBe(85);
    expect(body.data.percentage).toBe(85);
    expect(body.data.grade).toBe('A+'); // Standard scale 80+ is A+
  });

  it('4. Short score exceeding short_total_marks returns 400 with "Short marks cannot exceed the short total."', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/exams/${exam1.id}/evaluate`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        student_id: student1.id,
        short_score: 45, // Cap is 40!
        long_score: 10,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.message).toBe('Short marks cannot exceed the short total.');
  });

  it('5. Long score exceeding long_total_marks returns 400 with "Long marks cannot exceed the long total."', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/exams/${exam1.id}/evaluate`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        student_id: student1.id,
        short_score: 10,
        long_score: 45, // Cap is 40!
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.message).toBe('Long marks cannot exceed the long total.');
  });

  it('6. Student with no evaluation returns 404 with "Result is not published." (not rank 1 or fake F record)', async () => {
    // Student 2 has not been evaluated
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/exams/${exam1.id}/report-card/${student2.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.message).toBe('Result is not published.');

    // Verify in store that no fake evaluation was created
    const inStore = store.studentExamEvaluations.find(
      (ev) => ev.exam_id === exam1.id && ev.student_id === student2.id
    );
    expect(inStore).toBeUndefined();
  });

  it('7. Report card GET /api/v1/exams/:id/report-card/:studentId strips correct_option for student and parent tokens', async () => {
    // 7a. Student viewing their own report card
    const resStudent = await app.inject({
      method: 'GET',
      url: `/api/v1/exams/${exam1.id}/report-card/${student1.id}`,
      headers: { authorization: `Bearer ${student1Token}` },
    });
    expect(resStudent.statusCode).toBe(200);
    const bodyStudent = JSON.parse(resStudent.body);
    expect(bodyStudent.success).toBe(true);
    expect(bodyStudent.data.evaluation.grade).toBe('A+');
    expect(bodyStudent.data.exam.questions).toBeDefined();
    for (const q of bodyStudent.data.exam.questions) {
      expect(q.correct_option).toBeUndefined();
    }

    // 7b. Parent viewing child's report card
    const resParent = await app.inject({
      method: 'GET',
      url: `/api/v1/exams/${exam1.id}/report-card/${student1.id}`,
      headers: { authorization: `Bearer ${parentToken}` },
    });
    expect(resParent.statusCode).toBe(200);
    const bodyParent = JSON.parse(resParent.body);
    expect(bodyParent.success).toBe(true);
    for (const q of bodyParent.data.exam.questions) {
      expect(q.correct_option).toBeUndefined();
    }
  });

  it('8. Question import skips MCQ rows with blank answer key without assigning A', async () => {
    const importRes = await app.inject({
      method: 'POST',
      url: '/api/v1/exams/questions/import-excel',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        subject_id: subject1.id,
        program_id: batch1.program_id,
        rows: [
          {
            chapter_number: 1,
            chapter_name: 'Kinematics',
            question_type: 'MCQ',
            question_text: 'Valid MCQ Question 1',
            marks: 1,
            option_a: 'Opt A',
            option_b: 'Opt B',
            correct_option: 'B',
          },
          {
            chapter_number: 1,
            chapter_name: 'Kinematics',
            question_type: 'MCQ',
            question_text: 'Invalid MCQ Question with blank key',
            marks: 1,
            option_a: 'Opt A',
            option_b: 'Opt B',
            correct_option: '   ', // Blank key!
          },
          {
            chapter_number: 1,
            chapter_name: 'Kinematics',
            question_type: 'SHORT',
            question_text: 'Valid Short Question',
            marks: 4,
          },
        ],
      },
    });

    expect(importRes.statusCode).toBe(201);
    const body = JSON.parse(importRes.body);
    expect(body.success).toBe(true);
    expect(body.data.imported_count).toBe(2);
    expect(body.data.skipped_count).toBe(1);
    expect(body.message).toContain('Skipped 1 row(s)');

    // Ensure the blank key question was NOT stored with 'A'
    const storedBadQ = store.bankQuestions.find(
      (q) => q.question_text === 'Invalid MCQ Question with blank key'
    );
    expect(storedBadQ).toBeUndefined();

    // Ensure the valid MCQ was stored with its proper key 'B'
    const storedGoodQ = store.bankQuestions.find(
      (q) => q.question_text === 'Valid MCQ Question 1'
    );
    expect(storedGoodQ).toBeDefined();
    expect(storedGoodQ?.correct_option).toBe('B');
  });
});

describe('Module Logic Repairs - Phase 6: Payroll and Expense Vouchers', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let adminToken: string;
  let tenantId: string;
  let staffUserMonthly: any;
  let staffUserLecture: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    store = new InMemoryDataStore();
    app = await buildApp({
      store,
      mailer: { async sendOTP() { return true; } },
      jwtSecret: 'test-secret-min-32-chars-long-for-vitest',
    });
    await app.ready();

    // Create tenant
    const { tenant: createdTenant, admin: createdAdmin } = await store.createTenant({
      name: 'Phase 6 Academy',
      slug: 'phase6',
      domain: 'phase6.edu.pk',
      admin_email: 'admin@phase6.edu.pk',
      admin_name: 'Admin Phase 6',
      admin_password: 'Password123',
    });
    tenantId = createdTenant.id;

    adminToken = app.jwt.sign({
      sub: createdAdmin.id,
      tenant_id: tenantId,
      email: createdAdmin.email,
      role: 'tenant_admin',
    });

    // Create staff user 1 (Fixed monthly)
    staffUserMonthly = {
      id: 'p6-staff-monthly',
      tenant_id: tenantId,
      email: 'monthly.teacher@phase6.edu.pk',
      full_name: 'Monthly Teacher',
      role: 'teacher',
      status: 'active',
      password_hash: 'hash',
      metadata: {
        leave_balance: {
          casual_allowed: 12,
          casual_used: 2,
          sick_allowed: 8,
          sick_used: 0,
          annual_allowed: 10,
          annual_used: 0,
        },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).users.set(staffUserMonthly.id, staffUserMonthly);
    (store as any).users.set(`${tenantId}:${staffUserMonthly.email.toLowerCase()}`, staffUserMonthly);

    await store.saveStaffSalaryProfile({
      tenant_id: tenantId,
      staff_id: staffUserMonthly.id,
      staff_name: staffUserMonthly.full_name,
      designation: 'Senior Lecturer',
      contract_type: 'fixed_monthly',
      base_amount: 52000,
    });

    // Create staff user 2 (Per-lecture)
    staffUserLecture = {
      id: 'p6-staff-lecture',
      tenant_id: tenantId,
      email: 'lecture.teacher@phase6.edu.pk',
      full_name: 'Visiting Lecturer',
      role: 'teacher',
      status: 'active',
      password_hash: 'hash',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).users.set(staffUserLecture.id, staffUserLecture);
    (store as any).users.set(`${tenantId}:${staffUserLecture.email.toLowerCase()}`, staffUserLecture);

    await store.saveStaffSalaryProfile({
      tenant_id: tenantId,
      staff_id: staffUserLecture.id,
      staff_name: staffUserLecture.full_name,
      designation: 'Visiting Faculty',
      contract_type: 'per_lecture',
      base_amount: 2500, // PKR 2500 per lecture
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Per-lecture net pay calculates unit_rate * lecture_count + earnings - deductions', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payroll/payslips/generate',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        staff_id: staffUserLecture.id,
        payroll_month: 'September 2026',
        lecture_count: 20,
        earnings: [
          { name: 'Special Seminar Bonus', quantity: 1, unit_rate: 3000, total: 3000 },
        ],
        deductions: [
          { name: 'Income Tax Deduction', quantity: 1, unit_rate: 1000, total: 1000 },
        ],
        admin_notes: '20 lectures verified by Academic Coordinator',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    // 2500 * 20 = 50,000 base salary
    expect(body.data.base_salary).toBe(50000);
    expect(body.data.lecture_count).toBe(20);
    // 50,000 + 3,000 - 1,000 = 52,000 net
    expect(body.data.net_salary).toBe(52000);
    expect(body.data.total_earnings).toBe(3000);
    expect(body.data.total_deductions).toBe(1000);
  });

  it('2. Per-lecture contract rejects missing lecture_count with 400 "Lecture count is required."', async () => {
    // 2a. Via API
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payroll/payslips/generate',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        staff_id: staffUserLecture.id,
        payroll_month: 'October 2026',
        earnings: [],
        deductions: [],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.message).toBe('Lecture count is required.');

    // 2b. Direct store invocation
    await expect(
      store.generatePayslip(tenantId, {
        staff_id: staffUserLecture.id,
        payroll_month: 'October 2026',
        earnings: [],
        deductions: [],
        processed_by: 'admin@phase6.edu.pk',
      })
    ).rejects.toThrow('Lecture count is required.');
  });

  it('3. Attendance deduction preview parity on store function matches generated payslip deduction', async () => {
    // Configure geofence penalty rule
    await store.updateGeofenceConfig(tenantId, {
      late_penalty_rule: 'deduct_half_day_salary',
      lates_for_leave_deduction: 3,
    });

    // Add attendance records for staffUserMonthly in 2026-10:
    // 1 absent (1.0 day) + 1 half_day (0.5 day) + 3 late arrivals (1 penalty group * 0.5 = 0.5 day) = 2.0 days unpaid
    const records = [
      {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        staff_id: staffUserMonthly.id,
        staff_name: staffUserMonthly.full_name,
        date: '2026-10-05',
        status: 'absent' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        staff_id: staffUserMonthly.id,
        staff_name: staffUserMonthly.full_name,
        date: '2026-10-06',
        status: 'half_day' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        staff_id: staffUserMonthly.id,
        staff_name: staffUserMonthly.full_name,
        date: '2026-10-07',
        status: 'late' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        staff_id: staffUserMonthly.id,
        staff_name: staffUserMonthly.full_name,
        date: '2026-10-08',
        status: 'late' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        staff_id: staffUserMonthly.id,
        staff_name: staffUserMonthly.full_name,
        date: '2026-10-09',
        status: 'late' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    store.staffAttendance.push(...records);

    // Test preview calculation directly on store function
    const preview = await store.calculateStaffAttendanceDeduction(tenantId, staffUserMonthly.id, 'October 2026');
    expect(preview.unpaidEquivalent).toBe(2.0);
    // Working days for October 2026 excluding Sundays = 27 days
    // Unit rate = 52,000 / 27 = 1925.9259...
    const expectedUnitRate = 52000 / preview.workingDays;
    const expectedDeduction = 2.0 * expectedUnitRate;
    expect(preview.unitRate).toBeCloseTo(expectedUnitRate, 2);
    expect(preview.totalDeduction).toBeCloseTo(expectedDeduction, 2);

    // Verify preview endpoint parity
    const previewRes = await app.inject({
      method: 'GET',
      url: `/api/v1/payroll/attendance-preview?staff_id=${staffUserMonthly.id}&payroll_month=October%202026`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(previewRes.statusCode).toBe(200);
    const previewBody = JSON.parse(previewRes.body);
    expect(previewBody.success).toBe(true);
    expect(previewBody.data.totalDeduction).toBeCloseTo(expectedDeduction, 2);

    // Generate payslip and assert that the automatic attendance deduction matches the preview exactly
    const generated = await store.generatePayslip(tenantId, {
      staff_id: staffUserMonthly.id,
      payroll_month: 'October 2026',
      earnings: [],
      deductions: [],
      processed_by: 'admin@phase6.edu.pk',
    });

    const attDeductionItem = generated.deductions.find((d) => d.name === 'Attendance deduction');
    expect(attDeductionItem).toBeDefined();
    expect(attDeductionItem?.quantity).toBe(preview.unpaidEquivalent);
    expect(attDeductionItem?.total).toBeCloseTo(preview.totalDeduction, 2);
    expect(generated.net_salary).toBeCloseTo(52000 - preview.totalDeduction, 2);
  });

  it('4. Casual leave balance is unchanged after generate, and only updated after markPayslipPaid', async () => {
    // Configure geofence penalty rule to deduct casual leave (3 lates = 1 casual leave)
    await store.updateGeofenceConfig(tenantId, {
      late_penalty_rule: 'deduct_casual_leave',
      lates_for_leave_deduction: 3,
    });

    // Add 3 late punches for staffUserMonthly in 2026-11
    store.staffAttendance.push(
      {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        staff_id: staffUserMonthly.id,
        staff_name: staffUserMonthly.full_name,
        date: '2026-11-02',
        status: 'late' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        staff_id: staffUserMonthly.id,
        staff_name: staffUserMonthly.full_name,
        date: '2026-11-03',
        status: 'late' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        staff_id: staffUserMonthly.id,
        staff_name: staffUserMonthly.full_name,
        date: '2026-11-04',
        status: 'late' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );

    // Initial casual leave state: casual_used = 2
    expect(staffUserMonthly.metadata.leave_balance.casual_used).toBe(2);

    // Generate payslip for November 2026
    const payslipNov = await store.generatePayslip(tenantId, {
      staff_id: staffUserMonthly.id,
      payroll_month: 'November 2026',
      earnings: [],
      deductions: [],
      processed_by: 'admin@phase6.edu.pk',
    });

    // Casual leave balance MUST be completely unchanged after generation!
    const userAfterGen = Array.from(store.users.values()).find((u) => u.id === staffUserMonthly.id);
    expect(userAfterGen?.metadata?.leave_balance?.casual_used).toBe(2);
    expect(payslipNov.casual_leave_deducted).toBe(1);

    // Now mark payslip paid
    await store.markPayslipPaid(tenantId, payslipNov.id, 'bank_transfer', 'TXN-NOV-001');

    // After markPayslipPaid, casual_used MUST be updated by 1 (2 + 1 = 3)
    const userAfterPaid = Array.from(store.users.values()).find((u) => u.id === staffUserMonthly.id);
    expect(userAfterPaid?.metadata?.leave_balance?.casual_used).toBe(3);
  });

  it('5. Marking paid without a salary account head returns 400 "Add a salary head before marking paid."', async () => {
    // Create a tenant with no salary head
    const { tenant: noHeadTenant, admin: noHeadAdmin } = await store.createTenant({
      name: 'No Salary Head Academy',
      slug: 'nosalary',
      domain: 'nosalary.edu.pk',
      admin_email: 'admin@nosalary.edu.pk',
      admin_name: 'No Head Admin',
      admin_password: 'Password123',
    });
    const noHeadTenantId = noHeadTenant.id;

    // Deactivate/remove any seeded expense heads with salary/salaries/payroll/wage
    store.accountHeads = store.accountHeads.filter(
      (h) => h.tenant_id !== noHeadTenantId || !/salaries|salary|payroll|wage/i.test(`${h.name} ${h.code || ''}`)
    );

    const noHeadUser = {
      id: 'staff-no-head',
      tenant_id: noHeadTenantId,
      email: 'nohead@nosalary.edu.pk',
      full_name: 'No Head Staff',
      role: 'teacher',
      status: 'active',
      password_hash: 'hash',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).users.set(noHeadUser.id, noHeadUser);
    (store as any).users.set(`${noHeadTenantId}:${noHeadUser.email.toLowerCase()}`, noHeadUser);

    await store.saveStaffSalaryProfile({
      tenant_id: noHeadTenantId,
      staff_id: noHeadUser.id,
      staff_name: noHeadUser.full_name,
      designation: 'Teacher',
      contract_type: 'fixed_monthly',
      base_amount: 30000,
    });

    const slip = await store.generatePayslip(noHeadTenantId, {
      staff_id: noHeadUser.id,
      payroll_month: 'September 2026',
      earnings: [],
      deductions: [],
      processed_by: 'admin',
    });

    const tokenNoHead = app.jwt.sign({
      sub: noHeadAdmin.id,
      tenant_id: noHeadTenantId,
      email: noHeadAdmin.email,
      role: 'tenant_admin',
    });

    const payRes = await app.inject({
      method: 'POST',
      url: `/api/v1/payroll/payslips/${slip.id}/pay`,
      headers: { authorization: `Bearer ${tokenNoHead}` },
      payload: {
        payment_method: 'bank_transfer',
      },
    });

    expect(payRes.statusCode).toBe(400);
    const payBody = JSON.parse(payRes.body);
    expect(payBody.success).toBe(false);
    expect(payBody.error.message).toBe('Add a salary head before marking paid.');

    // Verify slip remains processed (not marked paid)
    const refreshedSlip = (await store.getPayslips(noHeadTenantId)).find((p) => p.id === slip.id);
    expect(refreshedSlip?.status).toBe('processed');

    // Verify no transaction was posted under 'head-salaries'
    const transactions = await store.getFinancialTransactions(noHeadTenantId);
    expect(transactions.filter((t) => t.account_head_id === 'head-salaries')).toHaveLength(0);
  });

  it('6. POST /api/v1/finance/transactions requires account_head_id that exists and matches voucher type, otherwise returns 400 "Choose an account head."', async () => {
    // 6a. Missing account_head_id
    const resMissing = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/transactions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        type: 'expense',
        amount: 5000,
        description: 'Test expense without head',
      },
    });
    expect(resMissing.statusCode).toBe(400);
    const bodyMissing = JSON.parse(resMissing.body);
    expect(bodyMissing.success).toBe(false);
    expect(bodyMissing.error.message).toBe('Choose an account head.');

    // 6b. Non-existent account_head_id
    const resNonExistent = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/transactions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        type: 'expense',
        account_head_id: 'non-existent-head-id-999',
        amount: 5000,
      },
    });
    expect(resNonExistent.statusCode).toBe(400);
    const bodyNonExistent = JSON.parse(resNonExistent.body);
    expect(bodyNonExistent.success).toBe(false);
    expect(bodyNonExistent.error.message).toBe('Choose an account head.');

    // 6c. Mismatched type: account head is income, but voucher type is expense
    const incomeHead = await store.createAccountHead({
      tenant_id: tenantId,
      type: 'income',
      name: 'Event Sponsorship Income',
      code: 'INC-EVENT',
      is_active: true,
    });

    const resMismatched = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/transactions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        type: 'expense',
        account_head_id: incomeHead.id,
        amount: 5000,
      },
    });
    expect(resMismatched.statusCode).toBe(400);
    const bodyMismatched = JSON.parse(resMismatched.body);
    expect(bodyMismatched.success).toBe(false);
    expect(bodyMismatched.error.message).toBe('Choose an account head.');

    // 6d. Valid account head matching voucher type succeeds and does not save "General"
    const expenseHead = await store.createAccountHead({
      tenant_id: tenantId,
      type: 'expense',
      name: 'Lab Chemicals & Equipment',
      code: 'EXP-LAB',
      is_active: true,
    });

    const resValid = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/transactions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        type: 'expense',
        account_head_id: expenseHead.id,
        amount: 15000,
        paid_to_or_received_from: 'Apex Scientific Suppliers',
        description: 'Physics & Chemistry practical apparatus',
      },
    });
    expect(resValid.statusCode).toBe(201);
    const bodyValid = JSON.parse(resValid.body);
    expect(bodyValid.success).toBe(true);
    expect(bodyValid.data.head_name).toBe('Lab Chemicals & Equipment');
    expect(bodyValid.data.head_name).not.toBe('General');
    expect(bodyValid.data.amount).toBe(15000);
  });
});

describe('Module Logic Repairs - Phase 7: Correct Facts & Clean Boundaries', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let tenantId: string;
  let adminToken: string;
  let teacherToken: string;
  let teacherUser: any;
  let adminUser: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    store = new InMemoryDataStore();
    app = await buildApp({
      store,
      mailer: { async sendOTP() { return true; } },
      jwtSecret: 'test-secret-min-32-chars-long-for-vitest',
    });
    await app.ready();

    // Create tenant with timezone and bank settings
    const { tenant: createdTenant, admin: createdAdmin } = await store.createTenant({
      name: 'Phase 7 Boundary Academy',
      slug: 'phase-7-academy',
      admin_email: 'admin.phase7@apexacademy.edu.pk',
      admin_name: 'Phase 7 Admin',
      admin_password: 'Password123',
    });
    tenantId = createdTenant.id;
    adminUser = createdAdmin;

    // Set timezone and banking details in tenant settings
    await store.updateTenantSettings(tenantId, {
      settings: {
        timezone: 'Asia/Karachi',
        bank_name: 'Meezan Bank Ltd',
        account_title: 'Phase 7 Boundary Academy',
        account_number: '01020304050607',
        iban: 'PK12MEZN0001020304050607',
        branch_code: '0102',
        raast_id: '03001234567',
        payment_settings: {
          bank_name: 'Meezan Bank Ltd',
          account_title: 'Phase 7 Boundary Academy',
          account_number: '01020304050607',
          iban: 'PK12MEZN0001020304050607',
          branch_code: '0102',
          raast_id: '03001234567',
          cash_enabled: true,
        },
      } as any,
    });

    adminToken = app.jwt.sign({
      sub: adminUser.id,
      tenant_id: tenantId,
      email: adminUser.email,
      role: 'tenant_admin',
    });

    // Create a teacher user
    teacherUser = {
      id: 'teacher-user-phase7-id',
      tenant_id: tenantId,
      email: 'teacher.phase7@apexacademy.edu.pk',
      full_name: 'Teacher Phase 7',
      role: 'teacher',
      status: 'active' as const,
      password_hash: 'hash',
      permissions: {
        classes: 'view',
        absentee: 'view',
        complaints: 'view',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).users.set(teacherUser.id, teacherUser);
    (store as any).users.set(`${tenantId}:${teacherUser.email.toLowerCase()}`, teacherUser);

    teacherToken = app.jwt.sign({
      sub: teacherUser.id,
      tenant_id: tenantId,
      email: teacherUser.email,
      role: 'teacher',
      permissions: teacherUser.permissions,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Absentee KPI defaults to campus-today when date parameter is omitted', async () => {
    const todayStr = campusToday('Asia/Karachi');

    // Add an absentee record for campus today
    (store as any).absenteeFollowups.push({
      id: 'absentee-p7-today',
      tenant_id: tenantId,
      student_id: 'std-p7-1',
      student_name: 'Student Absent Today',
      roll_number: 'R-701',
      batch_id: 'batch-p7-1',
      batch_name: 'Class 10',
      parent_phone: '03001112233',
      date: todayStr,
      status: 'PENDING',
      consecutive_days: 1,
      total_absences: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Add an absentee record for an old date
    (store as any).absenteeFollowups.push({
      id: 'absentee-p7-old',
      tenant_id: tenantId,
      student_id: 'std-p7-2',
      student_name: 'Student Absent Past',
      roll_number: 'R-702',
      batch_id: 'batch-p7-1',
      batch_name: 'Class 10',
      parent_phone: '03001112244',
      date: '2020-01-01',
      status: 'PENDING',
      consecutive_days: 1,
      total_absences: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Query without date parameter -> should match todayStr
    const resNoDate = await app.inject({
      method: 'GET',
      url: '/api/v1/absentee/kpi',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(resNoDate.statusCode).toBe(200);
    const bodyNoDate = JSON.parse(resNoDate.body);
    expect(bodyNoDate.success).toBe(true);
    expect(bodyNoDate.data.total_absentees).toBe(1);
    expect(bodyNoDate.data.pending_count).toBe(1);

    // Query for old date -> should match 2020-01-01
    const resOldDate = await app.inject({
      method: 'GET',
      url: '/api/v1/absentee/kpi?date=2020-01-01',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(resOldDate.statusCode).toBe(200);
    const bodyOldDate = JSON.parse(resOldDate.body);
    expect(bodyOldDate.data.total_absentees).toBe(1);

    // Query for a date with no records -> returns 0
    const resEmptyDate = await app.inject({
      method: 'GET',
      url: '/api/v1/absentee/kpi?date=2019-12-31',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(resEmptyDate.statusCode).toBe(200);
    const bodyEmptyDate = JSON.parse(resEmptyDate.body);
    expect(bodyEmptyDate.data.total_absentees).toBe(0);
  });

  it('2. Homework student diary matches parent by guardian email', async () => {
    // Create a batch
    const batch = await store.createBatch({
      tenant_id: tenantId,
      name: 'Class 9 Science',
      program_id: 'prog-p7-hw',
      academic_session: '2026-2027',
      is_active: true,
    } as any);

    // Create a student whose guardian_email is set (no CNIC match)
    const student = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Child Student HW',
      admission_number: 'ADM-P7-HW1',
      roll_number: 'R-P7-HW1',
      program_id: batch.program_id,
      batch_id: batch.id,
      status: 'active',
      guardian_name: 'Parent HW Guardian',
      guardian_email: 'guardian.phase7@apexacademy.edu.pk',
      guardian_phone: '03001239999',
    });

    // Create parent user account with matching email
    const parentUser = {
      id: 'parent-hw-user-p7',
      tenant_id: tenantId,
      email: 'guardian.phase7@apexacademy.edu.pk',
      full_name: 'Parent HW User',
      role: 'parent',
      status: 'active' as const,
      password_hash: 'hash',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).users.set(parentUser.id, parentUser);
    (store as any).users.set(`${tenantId}:${parentUser.email.toLowerCase()}`, parentUser);

    const parentToken = app.jwt.sign({
      sub: parentUser.id,
      tenant_id: tenantId,
      email: parentUser.email,
      role: 'parent',
    });

    // Create homework assignment for the batch
    await store.createHomework({
      tenant_id: tenantId,
      batch_id: batch.id,
      subject: 'Physics',
      title: 'Newton Laws Numericals',
      description: 'Complete numerical questions 1 to 5',
      assigned_date: '2026-09-25',
      due_date: '2026-09-26',
      teacher_id: teacherUser.id,
    } as any);

    // Call /api/v1/homework as parent
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/homework',
      headers: { authorization: `Bearer ${parentToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    const hwItem = body.data.find((h: any) => h.title === 'Newton Laws Numericals');
    expect(hwItem).toBeDefined();
    expect(hwItem.subject).toBe('Physics');

    // 2b. Homework create rejects blank batch_id with 400
    const resBlankBatch = await app.inject({
      method: 'POST',
      url: '/api/v1/homework',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: '',
        subject_id: 'sub-p7-1',
        title: 'Blank Batch Test',
        description: 'Testing blank batch rejection',
        assigned_date: '2026-09-25',
        due_date: '2026-09-26',
      },
    });
    expect(resBlankBatch.statusCode).toBe(400);
    const bodyBlank = JSON.parse(resBlankBatch.body);
    expect(bodyBlank.success).toBe(false);

    // 2c. Homework create with whitespace-only batch_id rejects with 400
    const resSpacesBatch = await app.inject({
      method: 'POST',
      url: '/api/v1/homework',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: '   ',
        subject_id: 'sub-p7-1',
        title: 'Spaces Batch Test',
        description: 'Testing spaces batch rejection',
        assigned_date: '2026-09-25',
        due_date: '2026-09-26',
      },
    });
    expect(resSpacesBatch.statusCode).toBe(400);

    // 2d. Teacher with no assigned classes is rejected with 400 when submitting blank batch
    const resTeacherBlank = await app.inject({
      method: 'POST',
      url: '/api/v1/homework',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        batch_id: '',
        subject_id: 'sub-p7-1',
        title: 'Teacher Blank Batch Test',
        description: 'Testing teacher blank batch rejection',
        assigned_date: '2026-09-25',
        due_date: '2026-09-26',
      },
    });
    expect(resTeacherBlank.statusCode).toBe(400);

    // 2e. Teacher with no assigned classes is rejected with 403 when submitting an unassigned batch
    const resTeacherUnassigned = await app.inject({
      method: 'POST',
      url: '/api/v1/homework',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        batch_id: batch.id,
        subject_id: 'sub-p7-1',
        title: 'Teacher Unassigned Test',
        description: 'Testing teacher unassigned batch',
        assigned_date: '2026-09-25',
        due_date: '2026-09-26',
      },
    });
    expect(resTeacherUnassigned.statusCode).toBe(403);
  });

  it('3. GET /api/v1/saas/banking-config returns 401 without authentication token', async () => {
    // 3a. GET /api/v1/saas/banking-config without token
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/v1/saas/banking-config',
    });
    expect(res1.statusCode).toBe(401);

    // 3b. GET /api/v1/saas/saas/banking-config without token
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/v1/saas/saas/banking-config',
    });
    expect(res2.statusCode).toBe(401);

    // 3c. GET with non-super_admin token returns 403
    const resForbidden = await app.inject({
      method: 'GET',
      url: '/api/v1/saas/banking-config',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(resForbidden.statusCode).toBe(403);
  });

  it('4. GET /api/v1/academic/settings omits bank fields for teacher token but includes them for admin', async () => {
    // 4a. Teacher token: bank fields omitted
    const resTeacher = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/settings',
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(resTeacher.statusCode).toBe(200);
    const bodyTeacher = JSON.parse(resTeacher.body);
    expect(bodyTeacher.success).toBe(true);
    const settingsTeacher = bodyTeacher.data.settings;

    expect(settingsTeacher.bank_name).toBeUndefined();
    expect(settingsTeacher.account_title).toBeUndefined();
    expect(settingsTeacher.account_number).toBeUndefined();
    expect(settingsTeacher.iban).toBeUndefined();
    expect(settingsTeacher.branch_code).toBeUndefined();
    expect(settingsTeacher.raast_id).toBeUndefined();

    if (settingsTeacher.payment_settings) {
      expect(settingsTeacher.payment_settings.bank_name).toBeUndefined();
      expect(settingsTeacher.payment_settings.account_title).toBeUndefined();
      expect(settingsTeacher.payment_settings.account_number).toBeUndefined();
      expect(settingsTeacher.payment_settings.iban).toBeUndefined();
      expect(settingsTeacher.payment_settings.branch_code).toBeUndefined();
      expect(settingsTeacher.payment_settings.raast_id).toBeUndefined();
      expect(settingsTeacher.payment_settings.cash_enabled).toBe(true);
    }
    // General non-banking settings remain present
    expect(settingsTeacher.timezone).toBe('Asia/Karachi');

    // 4b. Also test /academy-settings endpoint for teacher
    const resTeacherAcademy = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/academy-settings',
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(resTeacherAcademy.statusCode).toBe(200);
    const bodyTeacherAcademy = JSON.parse(resTeacherAcademy.body);
    expect(bodyTeacherAcademy.data.settings.bank_name).toBeUndefined();
    expect(bodyTeacherAcademy.data.settings.account_number).toBeUndefined();

    // 4c. Admin token: bank fields fully retained
    const resAdmin = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/settings',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(resAdmin.statusCode).toBe(200);
    const bodyAdmin = JSON.parse(resAdmin.body);
    expect(bodyAdmin.success).toBe(true);
    const settingsAdmin = bodyAdmin.data.settings;

    expect(settingsAdmin.bank_name).toBe('Meezan Bank Ltd');
    expect(settingsAdmin.account_title).toBe('Phase 7 Boundary Academy');
    expect(settingsAdmin.account_number).toBe('01020304050607');
    expect(settingsAdmin.iban).toBe('PK12MEZN0001020304050607');
    expect(settingsAdmin.branch_code).toBe('0102');
    expect(settingsAdmin.raast_id).toBe('03001234567');
  });

  it('5. Timetable create rejects periods when end time is not after start time', async () => {
    const resEqual = await app.inject({
      method: 'POST',
      url: '/api/v1/timetable',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: 'batch-p7-tt',
        subject_id: 'sub-p7-tt',
        teacher_id: teacherUser.id,
        day_of_week: 'monday',
        start_time: '10:00',
        end_time: '10:00',
      },
    });
    expect(resEqual.statusCode).toBe(400);
    const bodyEqual = JSON.parse(resEqual.body);
    expect(bodyEqual.error.message).toBe('End time must be after start time.');

    const resEarlier = await app.inject({
      method: 'POST',
      url: '/api/v1/timetable',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: 'batch-p7-tt',
        subject_id: 'sub-p7-tt',
        teacher_id: teacherUser.id,
        day_of_week: 'monday',
        start_time: '11:00',
        end_time: '10:00',
      },
    });
    expect(resEarlier.statusCode).toBe(400);
    const bodyEarlier = JSON.parse(resEarlier.body);
    expect(bodyEarlier.error.message).toBe('End time must be after start time.');
  });

  it('6. Staff user without complaints edit permission cannot create complaint tickets (403)', async () => {
    // teacherUser only has 'complaints': 'view' permission
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/complaints',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        category: 'facility',
        priority: 'normal',
        subject: 'Broken AC Unit in Lab 2',
        description: 'AC in Physics lab is making loud noise and not cooling properly.',
      },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN_ROLE');
    expect(body.error.message).toContain('complaints edit permission');
  });
});



