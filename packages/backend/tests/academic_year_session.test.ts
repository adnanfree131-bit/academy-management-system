import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { IMailerService } from '../src/services/mailer.js';
import { Tenant, StudentEnrollment } from '@apex/shared-types';

describe('Academic Year & Session Management (Phase 1)', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let teacherToken: string;
  let adminToken: string;
  let studentToken: string;

  const mockMailer: IMailerService = {
    async sendOTP() {
      return true;
    },
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    store = new InMemoryDataStore();

    // Ensure Apex tenant has a past inactive session for testing
    const apex = await store.getTenantBySlug('apex');
    if (apex && apex.settings) {
      if (!apex.settings.academic_sessions) {
        apex.settings.academic_sessions = [];
      }
      if (!apex.settings.academic_sessions.some(s => s.name === '2025-2026')) {
        apex.settings.academic_sessions.push({
          id: 'sess-2025',
          name: '2025-2026',
          start_year: 2025,
          end_year: 2026,
          is_active: false,
        });
      }
    }

    app = await buildApp({
      store,
      mailer: mockMailer,
      jwtSecret: 'test-secret-academic-year-session-min-32-chars',
    });
    await app.ready();

    // Teacher token (role: teacher)
    teacherToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000002',
      user_id: 'a1000000-0000-0000-0000-000000000002',
      tenant_id: apex!.id,
      email: 'tariq@apexacademy.edu.pk',
      role: 'teacher',
    });

    // Admin token (role: tenant_admin)
    adminToken = app.jwt.sign({
      sub: 'u0000000-0000-0000-0000-000000000001',
      user_id: 'u0000000-0000-0000-0000-000000000001',
      tenant_id: apex!.id,
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin',
      aal: 'aal2',
      amr: [{ method: 'totp', timestamp: Math.floor(Date.now() / 1000) }],
    });

    // Student token (role: student)
    studentToken = app.jwt.sign({
      sub: 'std-test-user-id',
      user_id: 'std-test-user-id',
      tenant_id: apex!.id,
      email: 'student@apexacademy.edu.pk',
      role: 'student',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. ensureTenantSessions keeps a session whose start_year is older than this calendar year when that session has a batch', async () => {
    const testTenantId = 't-old-session-tenant-1';
    const oldSessionName = '2020-2021';
    const testTenant: Tenant = {
      id: testTenantId,
      name: 'Historical Academy',
      slug: 'historical-academy',
      status: 'active',
      tier: 'standard',
      max_students: 500,
      max_staff: 50,
      trial_ends_at: new Date(Date.now() + 86400000).toISOString(),
      settings: {
        currency: 'PKR',
        timezone: 'Asia/Karachi',
        date_format: 'DD/MM/YYYY',
        academic_session: '2026-2027',
        campus_name: 'Main Campus',
        phone_country_code: '+92',
        academic_sessions: [
          { id: 'sess-2020', name: oldSessionName, start_year: 2020, end_year: 2021, is_active: false },
          { id: 'sess-2026', name: '2026-2027', start_year: 2026, end_year: 2027, is_active: true },
        ],
        features: { mobile_pwa_enabled: true, whatsapp_rapid_queue: true, geofence_attendance: true },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    (store as any).tenants.set(testTenantId, testTenant);

    // Add a batch belonging to the 2020-2021 session
    (store as any).batches.push({
      id: 'batch-2020-1',
      tenant_id: testTenantId,
      name: 'Class 9 2020',
      cohort_type: 'batch',
      shift: 'morning',
      academic_session: oldSessionName,
      max_capacity: 35,
      current_enrollment: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    store.ensureTenantSessions(testTenant);

    const hasOldSession = testTenant.settings.academic_sessions?.some(
      s => s.name === oldSessionName && s.start_year === 2020
    );
    expect(hasOldSession).toBe(true);
  });

  it('2. Enrollment missing academic_session is backfilled from its batch', async () => {
    const tenantId = 'a0000000-0000-0000-0000-000000000001';
    const batchId = 'batch-backfill-session-test';
    const batchSession = '2024-2025';

    (store as any).batches.push({
      id: batchId,
      tenant_id: tenantId,
      name: 'Section Backfill',
      cohort_type: 'section',
      shift: 'morning',
      academic_session: batchSession,
      max_capacity: 40,
      current_enrollment: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const enrollmentId = 'enr-backfill-session-test';
    const rawEnrollment: StudentEnrollment = {
      id: enrollmentId,
      tenant_id: tenantId,
      student_id: 'std-backfill-test',
      batch_id: batchId,
      academic_session: '', // intentionally empty
      subjects: [],
      status: 'active',
      is_primary: true,
      admission_date: '2024-09-01',
    };

    (store as any).studentEnrollments.push(rawEnrollment);

    store.backfillAcademicSessions();

    const updated = (store as any).studentEnrollments.find((e: StudentEnrollment) => e.id === enrollmentId);
    expect(updated).toBeDefined();
    expect(updated?.academic_session).toBe(batchSession);
  });

  it('3. Teacher PATCH working-session to a listed year returns that year and year_closed: true when it is not Active', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/academic/working-session',
      headers: {
        authorization: `Bearer ${teacherToken}`,
      },
      payload: {
        academic_session: '2025-2026',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    const data = body.data || body;
    expect(data.working_session).toBe('2025-2026');
    expect(data.year_closed).toBe(true);
    expect(data.academic_session).toBe('2026-2027');
    expect(Array.isArray(data.academic_sessions)).toBe(true);
  });

  it('4. Student token PATCH working-session returns 403', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/academic/working-session',
      headers: {
        authorization: `Bearer ${studentToken}`,
      },
      payload: {
        academic_session: '2025-2026',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN_ROLE');
    expect(body.error.message).toBe('Student and parent views stay on the active year.');
  });

  it('5. Unknown year name returns 400', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/academic/working-session',
      headers: {
        authorization: `Bearer ${teacherToken}`,
      },
      payload: {
        academic_session: '1970-1971',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('That year is not on this campus.');
  });

  it('6. /me before or without PATCH reflects active year as working session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${studentToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.user.working_session).toBe('2026-2027');
    expect(body.data.user.year_closed).toBe(false);
  });

  it('7. After PATCH working-session, GET /api/v1/auth/me shows the new working year and unchanged Active year', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${teacherToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.user.working_session).toBe('2025-2026');
    expect(body.data.user.year_closed).toBe(true);
    expect(body.data.tenant.academic_session).toBe('2026-2027');
    expect(Array.isArray(body.data.tenant.academic_sessions)).toBe(true);
    expect(body.data.tenant.academic_sessions.some((s: any) => s.name === '2026-2027' && s.is_active)).toBe(true);
  });

  it('8. Two batches (2025-2026 & 2026-2027). With working year 2025-2026, GET /academic/batches returns only 2025-2026 batches', async () => {
    const apex = await store.getTenantBySlug('apex');
    const tenantId = apex!.id;

    // Add 2 test batches
    const b25 = {
      id: 'batch-test-2025',
      tenant_id: tenantId,
      name: 'Class 9 2025-2026 Section A',
      cohort_type: 'batch',
      shift: 'morning',
      academic_session: '2025-2026',
      max_capacity: 30,
      current_enrollment: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const b26 = {
      id: 'batch-test-2026',
      tenant_id: tenantId,
      name: 'Class 9 2026-2027 Section A',
      cohort_type: 'batch',
      shift: 'morning',
      academic_session: '2026-2027',
      max_capacity: 30,
      current_enrollment: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).batches.push(b25, b26);

    // Ensure teacher working session is 2025-2026
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/academic/working-session',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { academic_session: '2025-2026' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/batches',
      headers: { authorization: `Bearer ${teacherToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    const batchList = body.data;
    expect(batchList.some((b: any) => b.id === 'batch-test-2025')).toBe(true);
    expect(batchList.some((b: any) => b.id === 'batch-test-2026')).toBe(false);
    expect(batchList.every((b: any) => b.academic_session === '2025-2026')).toBe(true);
  });

  it('9. Student enrolled only in 2025-2026 batch is omitted when working year is 2026-2027, and present when working year is 2025-2026 with batch_id overlaid', async () => {
    const apex = await store.getTenantBySlug('apex');
    const tenantId = apex!.id;

    const studentId = 'std-only-2025-test';
    const rawStudent = {
      id: studentId,
      tenant_id: tenantId,
      user_id: 'usr-only-2025-test',
      admission_number: 'ADM-2025-TEST',
      full_name: 'Historical Student 2025',
      date_of_birth: '2008-01-01',
      gender: 'male',
      guardian_name: 'Guardian Test',
      guardian_phone: '03001234567',
      status: 'active',
      enrollment_date: '2025-08-01',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).students.push(rawStudent);

    const enrollment: StudentEnrollment = {
      id: 'enr-only-2025-test',
      tenant_id: tenantId,
      student_id: studentId,
      batch_id: 'batch-test-2025',
      academic_session: '2025-2026',
      subjects: ['Maths'],
      status: 'active',
      is_primary: true,
      admission_date: '2025-08-01',
    };
    (store as any).studentEnrollments.push(enrollment);

    // Switch working year to 2026-2027 (Active)
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/academic/working-session',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { academic_session: '2026-2027' },
    });

    const resActive = await app.inject({
      method: 'GET',
      url: '/api/v1/sis/students',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(resActive.statusCode).toBe(200);
    const bodyActive = JSON.parse(resActive.body);
    expect(bodyActive.data.some((s: any) => s.id === studentId)).toBe(false);

    // Switch working year back to 2025-2026 (Closed)
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/academic/working-session',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { academic_session: '2025-2026' },
    });

    const resOld = await app.inject({
      method: 'GET',
      url: '/api/v1/sis/students',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(resOld.statusCode).toBe(200);
    const bodyOld = JSON.parse(resOld.body);
    const found = bodyOld.data.find((s: any) => s.id === studentId);
    expect(found).toBeDefined();
    expect(found.batch_id).toBe('batch-test-2025');
  });

  it('10. Student token GET /academic/batches uses Active year regardless of metadata or header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/batches',
      headers: {
        authorization: `Bearer ${studentToken}`,
        'x-kampus-session': '2025-2026',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    // Student should only see Active year (2026-2027) batches
    expect(body.data.some((b: any) => b.id === 'batch-test-2026')).toBe(true);
    expect(body.data.some((b: any) => b.id === 'batch-test-2025')).toBe(false);
  });

  it('11. Active-year invoice list includes an unpaid invoice whose academic_session is the previous year', async () => {
    const apex = await store.getTenantBySlug('apex');
    const tenantId = apex!.id;

    const unpaidOldInvoice = {
      id: 'inv-unpaid-2025-test',
      tenant_id: tenantId,
      invoice_number: 'INV-2025-UNPAID',
      student_id: 'std-only-2025-test',
      student_name: 'Historical Student 2025',
      program_id: 'prog-1',
      batch_id: 'batch-test-2025',
      academic_session: '2025-2026',
      billing_month: 'January 2026',
      issue_date: '2026-01-01',
      due_date: '2026-01-10',
      gross_amount: 6000,
      discount_amount: 0,
      net_amount: 6000,
      paid_amount: 0,
      balance_amount: 6000,
      status: 'unpaid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [],
    };

    const paidOldInvoice = {
      id: 'inv-paid-2025-test',
      tenant_id: tenantId,
      invoice_number: 'INV-2025-PAID',
      student_id: 'std-only-2025-test',
      student_name: 'Historical Student 2025',
      program_id: 'prog-1',
      batch_id: 'batch-test-2025',
      academic_session: '2025-2026',
      billing_month: 'February 2026',
      issue_date: '2026-02-01',
      due_date: '2026-02-10',
      gross_amount: 6000,
      discount_amount: 0,
      net_amount: 6000,
      paid_amount: 6000,
      balance_amount: 0,
      status: 'paid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [],
    };

    (store as any).invoices.push(unpaidOldInvoice, paidOldInvoice);

    // Switch working year to Active (2026-2027)
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/academic/working-session',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { academic_session: '2026-2027' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/finance/invoices',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    const invoiceList = body.data;

    // Unpaid previous year invoice MUST be included (arrears)
    expect(invoiceList.some((i: any) => i.id === 'inv-unpaid-2025-test')).toBe(true);
    // Paid previous year invoice MUST NOT be included in active year view
    expect(invoiceList.some((i: any) => i.id === 'inv-paid-2025-test')).toBe(false);
  });

  it('12. Teacher with working year in the past: POST /academic/batches returns 403 YEAR_CLOSED, GET batches returns 200', async () => {
    // Set teacher working session to past year 2025-2026
    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/academic/working-session',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { academic_session: '2025-2026' },
    });
    expect(patchRes.statusCode).toBe(200);

    // Attempt to create batch in past year
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/batches',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        name: 'Forbidden Section In Past Year',
        program_id: 'prog-1',
        cohort_type: 'standard',
        shift: 'morning',
        max_capacity: 30,
        start_time: '08:00',
        end_time: '13:00',
      },
    });

    expect(postRes.statusCode).toBe(403);
    const postBody = JSON.parse(postRes.body);
    expect(postBody.success).toBe(false);
    expect(postBody.error.code).toBe('YEAR_CLOSED');
    expect(postBody.error.message).toBe('This year is closed. Open the active year to make changes.');

    // GET batches in past year remains 200
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/batches',
      headers: { authorization: `Bearer ${teacherToken}` },
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.success).toBe(true);
    expect(Array.isArray(getBody.data)).toBe(true);
  });

  it('13. Same teacher POST a payment on an unpaid prior-year invoice returns 200/201', async () => {
    const apex = await store.getTenantBySlug('apex');
    const tenantId = apex!.id;

    // Grant teacher voucher: edit permission in user metadata so assertFeature passes
    const users = await store.getTenantUsers(tenantId);
    const teacherUser = users.find(u => u.email === 'tariq@apexacademy.edu.pk');
    if (teacherUser) {
      await store.updateUserMetadata(tenantId, teacherUser.id, {
        ...(teacherUser.metadata || {}),
        access: {
          ...(((teacherUser.metadata as any)?.access) || {}),
          voucher: 'edit',
        },
      });
    }

    // Ensure invoice has items with head_name and fee_head_id so allocations work
    const inv = await store.getInvoiceById(tenantId, 'inv-unpaid-2025-test');
    if (inv && (!inv.items || inv.items.length === 0)) {
      inv.items = [
        {
          id: 'item-1',
          invoice_id: 'inv-unpaid-2025-test',
          fee_head_id: 'head-tuition',
          head_name: 'Monthly Tuition',
          original_amount: 6000,
          discount_amount: 0,
          net_amount: 6000,
          paid_amount: 0,
          balance_due: 6000,
        },
      ];
      inv.balance_due = 6000;
      inv.balance_amount = 6000;
    }

    // Teacher working session is still 2025-2026 (closed)
    const payRes = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/payments',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        invoice_id: 'inv-unpaid-2025-test',
        amount_paid: 2000,
        payment_method: 'cash',
        payment_date: '2026-03-01',
      },
    });

    expect([200, 201]).toContain(payRes.statusCode);
    const payBody = JSON.parse(payRes.body);
    expect(payBody.success).toBe(true);
  });

  it('14. tenant_admin in Active year POST batch returns 201', async () => {
    // Set admin working session to active year (2026-2027)
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/academic/working-session',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { academic_session: '2026-2027' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/batches',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'New Active Section 14',
        program_id: 'prog-1',
        cohort_type: 'section',
        shift: 'morning',
        max_capacity: 35,
        start_time: '08:00',
        end_time: '13:00',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('New Active Section 14');
    expect(body.data.academic_session).toBe('2026-2027');
  });

  it('15. Copy from Active 2026-2027 creates batches in 2027-2028 with new ids and copied_from_batch_id set', async () => {
    const apex = await store.getTenantBySlug('apex');
    const tenantId = apex!.id;

    // Ensure we have at least 2 batches in active 2026-2027
    const activeBatchesBefore = (store as any).batches.filter(
      (b: any) => b.tenant_id === tenantId && b.academic_session === '2026-2027'
    );
    expect(activeBatchesBefore.length).toBeGreaterThanOrEqual(2);

    // Ensure 2027-2028 has 0 batches before copy
    (store as any).batches = (store as any).batches.filter(
      (b: any) => !(b.tenant_id === tenantId && b.academic_session === '2027-2028')
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/sessions/copy-classes',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        source_session: '2026-2027',
        target_session: '2027-2028',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.created_count).toBe(activeBatchesBefore.length);
    expect(body.batches.length).toBe(activeBatchesBefore.length);

    for (const copied of body.batches) {
      expect(copied.academic_session).toBe('2027-2028');
      expect(copied.copied_from_batch_id).toBeDefined();
      expect(copied.current_enrollment).toBe(0);
      expect(copied.status).toBe('active');
      const source = activeBatchesBefore.find((b: any) => b.id === copied.copied_from_batch_id);
      expect(source).toBeDefined();
      expect(copied.id).not.toBe(source.id);
      expect(copied.name).toBe(source.name);
      expect(copied.program_id).toBe(source.program_id);
    }
  });

  it('16. Second copy into 2027-2028 returns 400 YEAR_NOT_EMPTY', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/sessions/copy-classes',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        source_session: '2026-2027',
        target_session: '2027-2028',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('YEAR_NOT_EMPTY');
    expect(body.error.message).toContain('already has classes');
  });

  it('17. Teacher token POST copy-classes returns 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/sessions/copy-classes',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        source_session: '2026-2027',
        target_session: '2027-2028',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('18. Two students moved to copied batch get completed enrollment in source and active in target', async () => {
    const apex = await store.getTenantBySlug('apex');
    const tenantId = apex!.id;

    // Reset admin working session to active (2026-2027)
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/academic/working-session',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { academic_session: '2026-2027' },
    });

    const sourceBatchId = 'batch-test-2026';
    const targetBatch = (store as any).batches.find(
      (b: any) => b.tenant_id === tenantId && b.copied_from_batch_id === sourceBatchId
    );
    expect(targetBatch).toBeDefined();

    // Create 2 test students in source batch
    const std1Id = 'std-move-1';
    const std2Id = 'std-move-2';

    (store as any).students = (store as any).students.filter(
      (s: any) => s.id !== std1Id && s.id !== std2Id
    );
    (store as any).studentEnrollments = (store as any).studentEnrollments.filter(
      (e: any) => e.student_id !== std1Id && e.student_id !== std2Id
    );

    const s1 = {
      id: std1Id,
      tenant_id: tenantId,
      full_name: 'Move Student One',
      admission_number: 'ADM-MV-1',
      roll_number: 'MV-1',
      program_id: 'prog-1',
      batch_id: sourceBatchId,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const s2 = {
      id: std2Id,
      tenant_id: tenantId,
      full_name: 'Move Student Two',
      admission_number: 'ADM-MV-2',
      roll_number: 'MV-2',
      program_id: 'prog-1',
      batch_id: sourceBatchId,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).students.push(s1, s2);

    const enr1 = {
      id: 'enr-mv-1',
      tenant_id: tenantId,
      student_id: std1Id,
      batch_id: sourceBatchId,
      program_id: 'prog-1',
      academic_session: '2026-2027',
      roll_number: 'MV-1',
      status: 'active',
      is_primary: true,
      admission_date: '2026-08-01',
    };
    const enr2 = {
      id: 'enr-mv-2',
      tenant_id: tenantId,
      student_id: std2Id,
      batch_id: sourceBatchId,
      program_id: 'prog-1',
      academic_session: '2026-2027',
      roll_number: 'MV-2',
      status: 'active',
      is_primary: true,
      admission_date: '2026-08-01',
    };
    (store as any).studentEnrollments.push(enr1, enr2);
    (store as any).recalculateBatchSeats(tenantId);

    const moveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/sessions/move-students',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        source_session: '2026-2027',
        target_session: '2027-2028',
        mappings: [
          {
            source_batch_id: sourceBatchId,
            action: 'move',
            target_batch_id: targetBatch.id,
          },
        ],
      },
    });

    expect(moveRes.statusCode).toBe(200);
    const moveBody = JSON.parse(moveRes.body);
    expect(moveBody.success).toBe(true);
    expect(moveBody.moved).toBeGreaterThanOrEqual(2);

    // Verify enrollments on std1
    const s1Enrs = (store as any).studentEnrollments.filter((e: any) => e.student_id === std1Id);
    const s1OldEnr = s1Enrs.find((e: any) => e.batch_id === sourceBatchId);
    const s1NewEnr = s1Enrs.find((e: any) => e.batch_id === targetBatch.id);
    expect(s1OldEnr.status).toBe('completed');
    expect(s1NewEnr.status).toBe('active');
    expect(s1NewEnr.academic_session).toBe('2027-2028');

    // Master student record points to target batch B
    const updatedS1 = (store as any).students.find((s: any) => s.id === std1Id);
    expect(updatedS1.batch_id).toBe(targetBatch.id);

    // GET students in source year 2026-2027 overlays batch A
    const resSourceYear = await app.inject({
      method: 'GET',
      url: '/api/v1/sis/students',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-kampus-session': '2026-2027',
      },
    });
    expect(resSourceYear.statusCode).toBe(200);
    const s1InSource = JSON.parse(resSourceYear.body).data.find((s: any) => s.id === std1Id);
    expect(s1InSource).toBeDefined();
    expect(s1InSource.batch_id).toBe(sourceBatchId);

    // GET students in target year 2027-2028 overlays batch B
    const resTargetYear = await app.inject({
      method: 'GET',
      url: '/api/v1/sis/students',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-kampus-session': '2027-2028',
      },
    });
    expect(resTargetYear.statusCode).toBe(200);
    const s1InTarget = JSON.parse(resTargetYear.body).data.find((s: any) => s.id === std1Id);
    expect(s1InTarget).toBeDefined();
    expect(s1InTarget.batch_id).toBe(targetBatch.id);
  });

  it('19. Capacity check throws 400 when target batch exceeds max_capacity', async () => {
    const apex = await store.getTenantBySlug('apex');
    const tenantId = apex!.id;

    const capSrcBatch = {
      id: 'batch-cap-src',
      tenant_id: tenantId,
      name: 'Capacity Source Batch 2026',
      program_id: 'prog-1',
      shift: 'morning',
      academic_session: '2026-2027',
      max_capacity: 50,
      current_enrollment: 2,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).batches.push(capSrcBatch);

    const sCap1 = {
      id: 'std-cap-1',
      tenant_id: tenantId,
      full_name: 'Cap Student 1',
      batch_id: 'batch-cap-src',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const sCap2 = {
      id: 'std-cap-2',
      tenant_id: tenantId,
      full_name: 'Cap Student 2',
      batch_id: 'batch-cap-src',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).students.push(sCap1, sCap2);

    const enrCap1 = {
      id: 'enr-cap-1',
      tenant_id: tenantId,
      student_id: 'std-cap-1',
      batch_id: 'batch-cap-src',
      program_id: 'prog-1',
      academic_session: '2026-2027',
      status: 'active',
      is_primary: true,
      admission_date: '2026-08-01',
    };
    const enrCap2 = {
      id: 'enr-cap-2',
      tenant_id: tenantId,
      student_id: 'std-cap-2',
      batch_id: 'batch-cap-src',
      program_id: 'prog-1',
      academic_session: '2026-2027',
      status: 'active',
      is_primary: true,
      admission_date: '2026-08-01',
    };
    (store as any).studentEnrollments.push(enrCap1, enrCap2);

    const fullBatch = {
      id: 'batch-full-test',
      tenant_id: tenantId,
      name: 'Full Batch 2027',
      program_id: 'prog-1',
      shift: 'morning',
      academic_session: '2027-2028',
      max_capacity: 1,
      current_enrollment: 1,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).batches.push(fullBatch);

    const fullEnr = {
      id: 'enr-full-1',
      tenant_id: tenantId,
      student_id: 'std-already-there',
      batch_id: 'batch-full-test',
      program_id: 'prog-1',
      academic_session: '2027-2028',
      status: 'active',
      is_primary: true,
      admission_date: '2027-08-01',
    };
    (store as any).studentEnrollments.push(fullEnr);

    // Attempt to move 2 students into batch-full-test which only has max_capacity 1 and is full
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/sessions/move-students',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        source_session: '2026-2027',
        target_session: '2027-2028',
        mappings: [
          {
            source_batch_id: 'batch-cap-src',
            action: 'move',
            target_batch_id: 'batch-full-test',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.message.toLowerCase()).toContain('capacity');
  });

  it('20. leave on last class sets alumni and portal_blocked', async () => {
    const apex = await store.getTenantBySlug('apex');
    const tenantId = apex!.id;

    // Create a user account for student
    const studentUser = {
      id: 'user-std-leave',
      tenant_id: tenantId,
      email: 'std-leave@kampus.pk',
      full_name: 'Leaving Student',
      role: 'student',
      status: 'active',
      metadata: { portal_blocked: false },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).users.set('user-std-leave', studentUser);
    (store as any).users.set(`${tenantId}:std-leave@kampus.pk`, studentUser);

    const sLeave = {
      id: 'std-leave-1',
      tenant_id: tenantId,
      user_id: 'user-std-leave',
      full_name: 'Leaving Student',
      admission_number: 'ADM-LV-1',
      roll_number: 'LV-1',
      program_id: 'prog-1',
      batch_id: 'batch-leave-src',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).students.push(sLeave);

    const leaveBatch = {
      id: 'batch-leave-src',
      tenant_id: tenantId,
      name: 'Graduating Batch 2026',
      program_id: 'prog-1',
      shift: 'morning',
      academic_session: '2026-2027',
      max_capacity: 50,
      current_enrollment: 1,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).batches.push(leaveBatch);

    const enrLeave = {
      id: 'enr-lv-1',
      tenant_id: tenantId,
      student_id: 'std-leave-1',
      batch_id: 'batch-leave-src',
      program_id: 'prog-1',
      academic_session: '2026-2027',
      status: 'active',
      is_primary: true,
      admission_date: '2026-08-01',
    };
    (store as any).studentEnrollments.push(enrLeave);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/sessions/move-students',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        source_session: '2026-2027',
        target_session: '2027-2028',
        mappings: [
          {
            source_batch_id: 'batch-leave-src',
            action: 'leave',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.left).toBeGreaterThanOrEqual(1);

    const updatedStd = (store as any).students.find((s: any) => s.id === 'std-leave-1');
    expect(updatedStd.status).toBe('alumni');

    const updatedUser = (store as any).users.get('user-std-leave');
    expect(updatedUser.metadata.portal_blocked).toBe(true);
  });

  it('21. Running move-students twice does not duplicate enrollments (skipped)', async () => {
    const apex = await store.getTenantBySlug('apex');
    const tenantId = apex!.id;

    const sourceBatchId = 'batch-test-2026';
    const targetBatch = (store as any).batches.find(
      (b: any) => b.tenant_id === tenantId && b.copied_from_batch_id === sourceBatchId
    );

    const enrollmentsCountBefore = (store as any).studentEnrollments.length;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/sessions/move-students',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        source_session: '2026-2027',
        target_session: '2027-2028',
        mappings: [
          {
            source_batch_id: sourceBatchId,
            action: 'move',
            target_batch_id: targetBatch.id,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.skipped).toBeGreaterThanOrEqual(2);
    expect(body.moved).toBe(0);

    const enrollmentsCountAfter = (store as any).studentEnrollments.length;
    expect(enrollmentsCountAfter).toBe(enrollmentsCountBefore);
  });

  it('22. Delete batch with a completed enrollment returns 400', async () => {
    const apex = await store.getTenantBySlug('apex');
    const tenantId = apex!.id;

    // Reset admin working session to active (2026-2027)
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/academic/working-session',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { academic_session: '2026-2027' },
    });

    const delBatch = {
      id: 'batch-del-with-history',
      tenant_id: tenantId,
      name: 'History Section',
      program_id: 'prog-1',
      shift: 'morning',
      academic_session: '2026-2027',
      max_capacity: 40,
      current_enrollment: 0,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).batches.push(delBatch);

    const completedEnr = {
      id: 'enr-completed-del-test',
      tenant_id: tenantId,
      student_id: 'std-historical-1',
      batch_id: 'batch-del-with-history',
      program_id: 'prog-1',
      academic_session: '2026-2027',
      status: 'completed',
      is_primary: false,
      admission_date: '2026-08-01',
      ended_at: '2026-09-01',
    };
    (store as any).studentEnrollments.push(completedEnr);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/academic/batches/batch-del-with-history',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('student history');
  });

  it('23. In-year promote to a batch with a different academic_session returns 400 YEAR_MISMATCH', async () => {
    const apex = await store.getTenantBySlug('apex');
    const tenantId = apex!.id;

    // Create a student in a 2026-2027 batch
    const stdPromote = {
      id: 'std-promote-mismatch',
      tenant_id: tenantId,
      full_name: 'Mismatch Student',
      batch_id: 'batch-test-2026',
      program_id: 'prog-1',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).students.push(stdPromote);

    const enrPromote = {
      id: 'enr-promote-mismatch',
      tenant_id: tenantId,
      student_id: 'std-promote-mismatch',
      batch_id: 'batch-test-2026',
      program_id: 'prog-1',
      academic_session: '2026-2027',
      status: 'active',
      is_primary: true,
      admission_date: '2026-08-01',
    };
    (store as any).studentEnrollments.push(enrPromote);

    // Target batch is in 2027-2028 (different session!)
    const target2027 = (store as any).batches.find(
      (b: any) => b.tenant_id === tenantId && b.academic_session === '2027-2028'
    );
    expect(target2027).toBeDefined();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/academic/students/promote',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        student_ids: ['std-promote-mismatch'],
        target_batch_id: target2027.id,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('YEAR_MISMATCH');
    expect(body.error.message).toContain('Start next session');
  });

  it('24. GET /academic/batches current_enrollment equals active+on_leave enrollments for that batch', async () => {
    const apex = await store.getTenantBySlug('apex');
    const tenantId = apex!.id;

    // Recalculate seats
    (store as any).recalculateBatchSeats(tenantId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/academic/batches',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-kampus-session': '2026-2027',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    for (const batch of body.data) {
      const activeOrLeaveCount = (store as any).studentEnrollments.filter(
        (e: any) =>
          e.tenant_id === tenantId &&
          e.batch_id === batch.id &&
          (e.status === 'active' || e.status === 'on_leave')
      ).length;
      expect(batch.current_enrollment).toBe(activeOrLeaveCount);
    }
  });

  it('25. Parent portal overview classes array has no completed enrollment from a prior session', async () => {
    const apex = await store.getTenantBySlug('apex');
    const tenantId = apex!.id;

    const parentUser = {
      id: 'user-parent-test-25',
      tenant_id: tenantId,
      email: 'parent25@apex.test',
      role: 'parent',
      status: 'active',
      full_name: 'Portal Test Parent',
      metadata: { guardian_id_card: '42201-1234567-1' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).users.set(parentUser.id, parentUser);

    const testStudent = {
      id: 'student-portal-test-25',
      tenant_id: tenantId,
      full_name: 'Ali Tariq Portal Test',
      guardian_id_card: '42201-1234567-1',
      program_id: 'prog-1',
      batch_id: 'batch-test-2026',
      roll_number: 'R-25',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).students.push(testStudent);

    const pastEnrollment = {
      id: 'enr-past-2025-test-25',
      tenant_id: tenantId,
      student_id: testStudent.id,
      program_id: 'prog-1',
      batch_id: 'batch-past-2025',
      academic_session: '2025-2026',
      roll_number: 'R-25-OLD',
      status: 'completed',
      is_primary: false,
      admission_date: '2025-08-01',
      ended_at: '2026-05-31',
    };
    const activeEnrollment = {
      id: 'enr-active-2026-test-25',
      tenant_id: tenantId,
      student_id: testStudent.id,
      program_id: 'prog-1',
      batch_id: 'batch-test-2026',
      academic_session: '2026-2027',
      roll_number: 'R-25-NEW',
      status: 'active',
      is_primary: true,
      admission_date: '2026-08-01',
    };
    (store as any).studentEnrollments.push(pastEnrollment, activeEnrollment);

    const parentToken = app.jwt.sign({
      sub: parentUser.id,
      user_id: parentUser.id,
      tenant_id: tenantId,
      email: parentUser.email,
      role: 'parent',
      guardian_id_card: '42201-1234567-1',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/portal/student-parent?student_id=${testStudent.id}`,
      headers: { authorization: `Bearer ${parentToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    const classes = body.data.classes || body.data.linked_children?.[0]?.classes || [];
    expect(classes.length).toBeGreaterThan(0);
    for (const cls of classes) {
      expect(cls.status).not.toBe('completed');
      expect(cls.id).not.toBe(pastEnrollment.id);
    }

    if (body.data.linked_children && body.data.linked_children.length > 0) {
      const child = body.data.linked_children.find((c: any) => c.id === testStudent.id);
      expect(child).toBeDefined();
      for (const cls of child.classes) {
        expect(cls.status).not.toBe('completed');
        expect(cls.id).not.toBe(pastEnrollment.id);
      }
    }
  });

  it('26. Teacher GET portal with working year in the past returns homework only for that year batches', async () => {
    const apex = await store.getTenantBySlug('apex');
    const tenantId = apex!.id;

    const tariqUser = Array.from((store as any).users.values()).find(
      (u: any) => (u as any).email === 'tariq@apexacademy.edu.pk'
    ) as any;
    expect(tariqUser).toBeDefined();

    const batchPast = {
      id: 'batch-past-homework-2025',
      tenant_id: tenantId,
      name: 'Class 9 Past 2025',
      program_id: 'prog-1',
      shift: 'morning',
      academic_session: '2025-2026',
      max_capacity: 40,
      current_enrollment: 10,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const batchActive = {
      id: 'batch-active-homework-2026',
      tenant_id: tenantId,
      name: 'Class 10 Active 2026',
      program_id: 'prog-1',
      shift: 'morning',
      academic_session: '2026-2027',
      max_capacity: 40,
      current_enrollment: 10,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).batches.push(batchPast, batchActive);

    tariqUser.metadata = tariqUser.metadata || {};
    tariqUser.metadata.teaching_assignments = [
      { batch_id: batchPast.id, subject_id: 'sub-1', teacher_id: tariqUser.id },
      { batch_id: batchActive.id, subject_id: 'sub-1', teacher_id: tariqUser.id },
    ];

    const hwPast = {
      id: 'hw-past-2025',
      tenant_id: tenantId,
      batch_id: batchPast.id,
      teacher_id: tariqUser.id,
      title: 'Physics Chapter 1 Past Homework',
      description: 'Solve numericals 1-5',
      due_date: '2025-10-15',
      created_at: '2025-10-10T10:00:00.000Z',
    };
    const hwActive = {
      id: 'hw-active-2026',
      tenant_id: tenantId,
      batch_id: batchActive.id,
      teacher_id: tariqUser.id,
      title: 'Physics Chapter 1 Active Homework',
      description: 'Solve numericals 6-10',
      due_date: '2026-10-15',
      created_at: '2026-10-10T10:00:00.000Z',
    };
    (store as any).homeworkAssignments.push(hwPast, hwActive);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/teacher',
      headers: {
        authorization: `Bearer ${teacherToken}`,
        'x-kampus-session': '2025-2026',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    const diary = body.data.recent_diary_entries || body.data.homework || [];
    expect(diary.length).toBeGreaterThan(0);
    for (const entry of diary) {
      expect(entry.batch_id).toBe(batchPast.id);
      expect(entry.batch_id).not.toBe(batchActive.id);
    }
  });
});
