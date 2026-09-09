import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { InMemoryDataStore } from '../src/services/store';

describe('Phase 7: Multi-Portal Dashboards, SaaS Billing Lockout & Control Plane', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let superAdminToken: string;
  let crescentAdminToken: string;

  const TENANT_A_ID = 'a0000000-0000-0000-0000-000000000001'; // Apex
  const TENANT_B_ID = 'b0000000-0000-0000-0000-000000000002'; // Crescent (Locked)

  beforeAll(async () => {
    store = new InMemoryDataStore();
    app = await buildApp({ store });
    await app.ready();

    // 1. Authenticate Director Adnan (Admin, Tenant A)
    adminToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000001',
      user_id: 'a1000000-0000-0000-0000-000000000001',
      tenant_id: TENANT_A_ID,
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin'
    });

    // 2. Authenticate Sir Tariq (Teacher, Tenant A)
    teacherToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000002',
      user_id: 'a1000000-0000-0000-0000-000000000002',
      tenant_id: TENANT_A_ID,
      email: 'tariq@apexacademy.edu.pk',
      role: 'teacher'
    });

    // 3. Authenticate Student / Parent (Tenant A)
    studentToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000005',
      user_id: 'a1000000-0000-0000-0000-000000000005',
      tenant_id: TENANT_A_ID,
      email: 'student@apexacademy.edu.pk',
      role: 'student'
    });

    // 4. Authenticate Super Admin
    superAdminToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000006',
      user_id: 'a1000000-0000-0000-0000-000000000006',
      tenant_id: TENANT_A_ID,
      email: 'kampuserp@gmail.com',
      role: 'super_admin'
    });

    // 5. Authenticate Crescent Academy Admin (Locked Tenant)
    crescentAdminToken = app.jwt.sign({
      sub: 'b1000000-0000-0000-0000-000000000001',
      user_id: 'b1000000-0000-0000-0000-000000000001',
      tenant_id: TENANT_B_ID,
      email: 'admin@crescentacademy.edu.pk',
      role: 'tenant_admin'
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Tenant Trial Status: Apex active (unlocked), Crescent expired (locked)', async () => {
    // Apex Status
    const resApex = await app.inject({
      method: 'GET',
      url: `/api/v1/saas/trial-status?tenant_id=${TENANT_A_ID}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(resApex.statusCode).toBe(200);
    const dataApex = resApex.json().data;
    expect(dataApex.is_locked).toBe(false);
    expect(dataApex.status).toBe('active');
    expect(dataApex.banking_config.bank_name).toBe('Bank Alfalah Limited');

    // Crescent Status (Locked)
    const resCrescent = await app.inject({
      method: 'GET',
      url: `/api/v1/saas/trial-status?tenant_id=${TENANT_B_ID}`,
      headers: { authorization: `Bearer ${crescentAdminToken}` }
    });
    expect(resCrescent.statusCode).toBe(200);
    const dataCrescent = resCrescent.json().data;
    expect(dataCrescent.is_locked).toBe(true);
    expect(dataCrescent.lock_reason).toContain('30-day free trial has expired');
    expect(dataCrescent.pending_receipt).not.toBeNull();
  });

  it('2. Subscription Payment Proof: Submit new receipt for locked tenant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/saas/receipts',
      headers: { authorization: `Bearer ${crescentAdminToken}` },
      payload: {
        tenant_id: TENANT_B_ID,
        amount: 30000,
        plan_duration_months: 2,
        payment_method: 'RAAST_INSTANT',
        reference_number: 'RAAST-TRX-551902',
        notes: 'Paid 2 months subscription via Raast to Bank Alfalah.',
        receipt_image_url: 'https://example.com/receipt2.png'
      }
    });

    expect(res.statusCode).toBe(201);
    const receipt = res.json().data;
    expect(receipt.amount).toBe(30000);
    expect(receipt.plan_duration_months).toBe(2);
    expect(receipt.status).toBe('PENDING');
  });

  it('3. Super-Admin: Fetch and update platform banking configuration', async () => {
    const resGet = await app.inject({
      method: 'GET',
      url: '/api/v1/saas/banking-config',
      headers: { authorization: `Bearer ${superAdminToken}` }
    });
    expect(resGet.statusCode).toBe(200);
    expect(resGet.json().data.monthly_subscription_fee).toBe(15000);

    const resPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/saas/banking-config',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        monthly_subscription_fee: 18000,
        instructions: 'Please use Raast ID: billing@kampus.pk for zero-fee transfer.'
      }
    });
    expect(resPut.statusCode).toBe(200);
    expect(resPut.json().data.monthly_subscription_fee).toBe(18000);
  });

  it('4. Super-Admin: Approve receipt automatically unlocks and activates tenant', async () => {
    const receiptsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/saas/receipts?tenant_id=${TENANT_B_ID}`,
      headers: { authorization: `Bearer ${superAdminToken}` }
    });
    const receipts = receiptsRes.json().data;
    const target = receipts.find((r: any) => r.status === 'PENDING');
    expect(target).toBeDefined();

    const reviewRes = await app.inject({
      method: 'POST',
      url: `/api/v1/saas/receipts/${target.id}/review`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: { status: 'APPROVED' }
    });
    expect(reviewRes.statusCode).toBe(200);
    expect(reviewRes.json().data.status).toBe('APPROVED');

    // Verify Crescent is now active and unlocked!
    const resCrescentAfter = await app.inject({
      method: 'GET',
      url: `/api/v1/saas/trial-status?tenant_id=${TENANT_B_ID}`,
      headers: { authorization: `Bearer ${crescentAdminToken}` }
    });
    const statusAfter = resCrescentAfter.json().data;
    expect(statusAfter.status).toBe('active');
    expect(statusAfter.is_locked).toBe(false);
  });

  it('5. Super-Admin: 1-Click Activate Academy for 6 months', async () => {
    const activateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/saas/tenants/${TENANT_B_ID}/activate`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: { duration_months: 6 }
    });

    expect(activateRes.statusCode).toBe(200);
    expect(activateRes.json().data.status).toBe('active');
  });

  it('6. Super-Admin Global Overview: MRR, ARR, tenant summaries', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/saas/superadmin/overview',
      headers: { authorization: `Bearer ${superAdminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const overview = res.json().data;
    expect(overview.total_tenants).toBe(2);
    expect(overview.platform_mrr).toBeGreaterThan(0);
    expect(overview.platform_arr).toBe(overview.platform_mrr * 12);
    expect(overview.tenants.length).toBe(2);
  });

  it('7. Teacher Portal Overview: Today schedule, assigned batches, pending grading', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/teacher',
      headers: { authorization: `Bearer ${teacherToken}` }
    });

    expect(res.statusCode).toBe(200);
    const teacherPortal = res.json().data;
    expect(teacherPortal.teacher_name).toContain('Tariq');
    expect(teacherPortal.today_schedule).toBeDefined();
    expect(teacherPortal.assigned_batches.length).toBeGreaterThanOrEqual(1);
    expect(teacherPortal.geofence_status).toBeDefined();
  });

  it('8. Student / Parent Portal Overview: 360 profile, invoices, diary, exam report cards', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${studentToken}` }
    });

    expect(res.statusCode).toBe(200);
    const studentPortal = res.json().data;
    expect(studentPortal.student_profile.full_name).toBe('Muhammad Ali Raza');
    expect(studentPortal.student_profile.roll_number).toBe('A-101');
    expect(studentPortal.student_profile.monthly_attendance_pct).toBeGreaterThan(0);
    expect(studentPortal.today_schedule).toBeDefined();
    expect(studentPortal.recent_attendance.length).toBeGreaterThan(0);
  });
});
