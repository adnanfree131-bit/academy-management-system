import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { createTestSupabaseToken } from '../src/lib/jwt-verifier.js';

describe('Phase 7: MFA (AAL2) Enforcement, Live Session Security & Legacy Auth Deprecation', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;

  const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
  const SUSPEND_TARGET_TENANT_ID = 'b0000000-0000-0000-0000-000000000002';
  const DIRECTOR_AUTH_ID = 'e1000000-0000-0000-0000-000000000001';
  const SUPER_ADMIN_AUTH_ID = 'e1000000-0000-0000-0000-000000000000';
  const SUSPENDED_USER_AUTH_ID = 'e1000000-0000-0000-0000-000000000055';
  const DYNAMIC_USER_AUTH_ID = 'e1000000-0000-0000-0000-000000000077';
  const STAFF_MEMBER_ID = 'st-00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SUPABASE_JWT_ISSUER = 'https://test-project.supabase.co/auth/v1';
    process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
    process.env.TEST_JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long';

    store = new InMemoryDataStore();

    // 1. Setup Tenants
    await store.createTenant({
      name: 'Apex Academy',
      slug: 'apex',
      admin_name: 'Director Adnan',
      admin_email: 'adnan@apexacademy.edu.pk',
    });

    await store.createTenant({
      name: 'Target Academy',
      slug: 'target',
      admin_name: 'Director Target',
      admin_email: 'target@example.com',
    });

    // 2. Setup Profiles
    await store.saveProfile({
      id: DIRECTOR_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
      display_name: 'Director Adnan',
      platform_role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await store.saveProfile({
      id: SUPER_ADMIN_AUTH_ID,
      email: 'superadmin@kampus.pk',
      display_name: 'Platform Super Admin',
      platform_role: 'super_admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await store.saveProfile({
      id: SUSPENDED_USER_AUTH_ID,
      email: 'suspended@example.com',
      display_name: 'Suspended User',
      platform_role: 'user',
      status: 'suspended',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await store.saveProfile({
      id: DYNAMIC_USER_AUTH_ID,
      email: 'dynamic@example.com',
      display_name: 'Dynamic Lifecycle User',
      platform_role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 3. Setup Memberships
    (store as any).users.set(`${TENANT_ID}:adnan@apexacademy.edu.pk`, {
      id: 'm-director-001',
      tenant_id: TENANT_ID,
      auth_user_id: DIRECTOR_AUTH_ID,
      email: 'adnan@apexacademy.edu.pk',
      full_name: 'Director Adnan',
      role: 'tenant_admin',
      status: 'active',
      created_at: new Date().toISOString(),
    });

    (store as any).users.set(`${TENANT_ID}:dynamic@example.com`, {
      id: 'm-dynamic-001',
      tenant_id: TENANT_ID,
      auth_user_id: DYNAMIC_USER_AUTH_ID,
      email: 'dynamic@example.com',
      full_name: 'Dynamic Lifecycle User',
      role: 'teacher',
      status: 'active',
      created_at: new Date().toISOString(),
    });

    // 4. Setup dummy Staff
    (store as any).users.set(`${TENANT_ID}:tariq@apexacademy.edu.pk`, {
      id: STAFF_MEMBER_ID,
      tenant_id: TENANT_ID,
      full_name: 'Senior Teacher Tariq',
      email: 'tariq@apexacademy.edu.pk',
      role: 'teacher',
      status: 'active',
      access: { classes: 'view' },
      permissions: ['classes:view'],
    });

    // 5. Setup dummy Invoice & Payment
    (store as any).invoices.push({
      id: 'inv-test-mfa-001',
      tenant_id: TENANT_ID,
      invoice_number: 'INV-MFA-001',
      student_id: 'std-001',
      billing_month: '2026-09',
      status: 'unpaid',
      total_amount: 5000,
      payable_amount: 5000,
      paid_amount: 0,
      due_date: '2026-09-15',
      items: [{ id: 'item-1', head_id: 'tui', head_name: 'Tuition Fee', amount: 5000, paid_amount: 0 }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);

    (store as any).feePayments.push({
      id: 'pay-test-mfa-001',
      tenant_id: TENANT_ID,
      invoice_id: 'inv-test-mfa-001',
      student_id: 'std-001',
      amount: 5000,
      payment_method: 'cash',
      payment_date: '2026-09-10',
      status: 'completed',
      allocations: [],
      created_at: new Date().toISOString(),
    } as any);

    // 6. Setup salary account head and dummy Payslip
    (store as any).accountHeads.push({
      id: 'head-salary',
      tenant_id: TENANT_ID,
      name: 'Staff Salaries',
      code: 'SALARY',
      type: 'expense',
      is_active: true,
      created_at: new Date().toISOString(),
    });

    (store as any).staffPayslips.push({
      id: 'payslip-mfa-001',
      tenant_id: TENANT_ID,
      staff_id: STAFF_MEMBER_ID,
      payroll_month: '2026-09',
      net_salary: 45000,
      gross_salary: 45000,
      status: 'draft',
      created_at: new Date().toISOString(),
      earnings: [],
      deductions: [],
    });

    app = await buildApp({ store });
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // ---------------------------------------------------------------------------
  // Gate 1: Financial Fee Reversals Require AAL2 (MFA)
  // ---------------------------------------------------------------------------
  describe('Gate 1: Financial Fee Reversals (aal2 required)', () => {
    it('rejects invoice void / cancellation when session is AAL1', async () => {
      const aal1Token = await createTestSupabaseToken({
        sub: DIRECTOR_AUTH_ID,
        email: 'adnan@apexacademy.edu.pk',
        aal: 'aal1',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/inv-test-mfa-001/cancel',
        headers: {
          authorization: `Bearer ${aal1Token}`,
          'x-tenant-id': TENANT_ID,
        },
        payload: {
          reason: 'Duplicate erroneous billing entry',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('MFA_REQUIRED');
    });

    it('rejects payment void / reverse when session is AAL1', async () => {
      const aal1Token = await createTestSupabaseToken({
        sub: DIRECTOR_AUTH_ID,
        email: 'adnan@apexacademy.edu.pk',
        aal: 'aal1',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/payments/pay-test-mfa-001/void',
        headers: {
          authorization: `Bearer ${aal1Token}`,
          'x-tenant-id': TENANT_ID,
        },
        payload: {
          reason: 'Customer requested refund / reversal',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('MFA_REQUIRED');
    });

    it('allows invoice cancellation when session is elevated to AAL2', async () => {
      const aal2Token = await createTestSupabaseToken({
        sub: DIRECTOR_AUTH_ID,
        email: 'adnan@apexacademy.edu.pk',
        aal: 'aal2',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/finance/invoices/inv-test-mfa-001/cancel',
        headers: {
          authorization: `Bearer ${aal2Token}`,
          'x-tenant-id': TENANT_ID,
        },
        payload: {
          reason: 'Verified administrative correction',
        },
      });

      // Does NOT fail with MFA_REQUIRED (status 200 or business logic success)
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data?.status).toBe('cancelled');
    });
  });

  // ---------------------------------------------------------------------------
  // Gate 2: Salary Disbursement Requires AAL2 (MFA)
  // ---------------------------------------------------------------------------
  describe('Gate 2: Salary Disbursement (aal2 required)', () => {
    it('rejects payslip payment when session is AAL1', async () => {
      const aal1Token = await createTestSupabaseToken({
        sub: DIRECTOR_AUTH_ID,
        email: 'adnan@apexacademy.edu.pk',
        aal: 'aal1',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/payroll/payslips/payslip-mfa-001/pay',
        headers: {
          authorization: `Bearer ${aal1Token}`,
          'x-tenant-id': TENANT_ID,
        },
        payload: {
          payment_method: 'bank_transfer',
          reference: 'TXN-998877',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('MFA_REQUIRED');
    });

    it('allows payslip disbursement when session is elevated to AAL2', async () => {
      const aal2Token = await createTestSupabaseToken({
        sub: DIRECTOR_AUTH_ID,
        email: 'adnan@apexacademy.edu.pk',
        aal: 'aal2',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/payroll/payslips/payslip-mfa-001/pay',
        headers: {
          authorization: `Bearer ${aal2Token}`,
          'x-tenant-id': TENANT_ID,
        },
        payload: {
          payment_method: 'bank_transfer',
          reference: 'TXN-998877',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data?.status).toBe('paid');
    });
  });

  // ---------------------------------------------------------------------------
  // Gate 3: Platform Superadmin Mutations Require AAL2 (MFA)
  // ---------------------------------------------------------------------------
  describe('Gate 3: Platform Superadmin Mutations (aal2 required)', () => {
    it('rejects tenant suspension when super admin session is AAL1', async () => {
      const aal1Token = await createTestSupabaseToken({
        sub: SUPER_ADMIN_AUTH_ID,
        email: 'superadmin@kampus.pk',
        aal: 'aal1',
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/saas/tenants/${SUSPEND_TARGET_TENANT_ID}/suspend`,
        headers: {
          authorization: `Bearer ${aal1Token}`,
        },
        payload: {
          reason: 'Terms of service violation',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('MFA_REQUIRED');
    });

    it('rejects platform banking config update when super admin session is AAL1', async () => {
      const aal1Token = await createTestSupabaseToken({
        sub: SUPER_ADMIN_AUTH_ID,
        email: 'superadmin@kampus.pk',
        aal: 'aal1',
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/saas/banking-config',
        headers: {
          authorization: `Bearer ${aal1Token}`,
        },
        payload: {
          bank_name: 'Meezan Bank Limited',
          account_title: 'Apex SaaS Escrow',
          account_number: '010203040506',
          iban: 'PK36MEZN00010203040506',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('MFA_REQUIRED');
    });

    it('allows tenant suspension when super admin session is elevated to AAL2', async () => {
      const aal2Token = await createTestSupabaseToken({
        sub: SUPER_ADMIN_AUTH_ID,
        email: 'superadmin@kampus.pk',
        aal: 'aal2',
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/saas/tenants/${SUSPEND_TARGET_TENANT_ID}/suspend`,
        headers: {
          authorization: `Bearer ${aal2Token}`,
        },
        payload: {
          reason: 'Confirmed administrative suspension',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data?.status).toBe('suspended');
    });
  });

  // ---------------------------------------------------------------------------
  // Gate 4: Staff Role & Access Modification Requires AAL2 (MFA)
  // ---------------------------------------------------------------------------
  describe('Gate 4: Staff Access Modifications (aal2 required)', () => {
    it('rejects staff access modification when admin session is AAL1', async () => {
      const aal1Token = await createTestSupabaseToken({
        sub: DIRECTOR_AUTH_ID,
        email: 'adnan@apexacademy.edu.pk',
        aal: 'aal1',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/academic/staff/${STAFF_MEMBER_ID}/access`,
        headers: {
          authorization: `Bearer ${aal1Token}`,
          'x-tenant-id': TENANT_ID,
        },
        payload: {
          access: { finance: 'edit', attendance: 'edit' },
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('MFA_REQUIRED');
    });

    it('allows staff access modification when admin session is elevated to AAL2', async () => {
      const aal2Token = await createTestSupabaseToken({
        sub: DIRECTOR_AUTH_ID,
        email: 'adnan@apexacademy.edu.pk',
        aal: 'aal2',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/academic/staff/${STAFF_MEMBER_ID}/access`,
        headers: {
          authorization: `Bearer ${aal2Token}`,
          'x-tenant-id': TENANT_ID,
        },
        payload: {
          access: { attendance: 'edit' },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Gate 5: Immediate Session & Membership Suspension
  // ---------------------------------------------------------------------------
  describe('Gate 5: Live Membership & Profile Suspension Enforcement', () => {
    it('immediately rejects token for suspended user profile with 403 ACCOUNT_NOT_ACTIVE', async () => {
      const suspendedUserToken = await createTestSupabaseToken({
        sub: SUSPENDED_USER_AUTH_ID,
        email: 'suspended@example.com',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/session',
        headers: {
          authorization: `Bearer ${suspendedUserToken}`,
          'x-tenant-id': TENANT_ID,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('ACCOUNT_NOT_ACTIVE');
    });

    it('immediately reflects live profile suspension on an existing valid token', async () => {
      const liveUserToken = await createTestSupabaseToken({
        sub: DYNAMIC_USER_AUTH_ID,
        email: 'dynamic@example.com',
      });

      // 1. Initial request succeeds
      const initialRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/session',
        headers: {
          authorization: `Bearer ${liveUserToken}`,
          'x-tenant-id': TENANT_ID,
        },
      });
      expect(initialRes.statusCode).toBe(200);
      expect(initialRes.json().success).toBe(true);

      // 2. Suspend profile in database/store
      const updatedProfile = await store.updateProfileStatus(DYNAMIC_USER_AUTH_ID, 'suspended');
      expect(updatedProfile).toBeDefined();

      // 3. Exact same token without expiring is immediately rejected
      const nextRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/session',
        headers: {
          authorization: `Bearer ${liveUserToken}`,
          'x-tenant-id': TENANT_ID,
        },
      });
      expect(nextRes.statusCode).toBe(403);
      expect(nextRes.json().error?.code).toBe('ACCOUNT_NOT_ACTIVE');
    });
  });

  // ---------------------------------------------------------------------------
  // Gate 6: Deprecated Legacy Custom Auth Endpoints (410 Gone)
  // ---------------------------------------------------------------------------
  describe('Gate 6: Legacy Auth Retirement (410 Gone)', () => {
    const deprecatedEndpoints = [
      { method: 'POST' as const, url: '/api/v1/auth/login' },
      { method: 'POST' as const, url: '/api/v1/auth/register' },
      { method: 'POST' as const, url: '/api/v1/auth/verify-registration-otp' },
      { method: 'POST' as const, url: '/api/v1/auth/forgot-password' },
      { method: 'POST' as const, url: '/api/v1/auth/reset-password' },
      { method: 'POST' as const, url: '/api/v1/auth/change-password' },
      { method: 'POST' as const, url: '/api/v1/auth/change-password-otp' },
      { method: 'POST' as const, url: '/api/v1/auth/request-otp' },
      { method: 'POST' as const, url: '/api/v1/auth/verify-otp' },
    ];

    for (const ep of deprecatedEndpoints) {
      it(`returns 410 Gone for legacy endpoint: ${ep.method} ${ep.url}`, async () => {
        const res = await app.inject({
          method: ep.method,
          url: ep.url,
          payload: { dummy: 'data' },
        });

        expect(res.statusCode).toBe(410);
        const body = res.json();
        expect(body.success).toBe(false);
        expect(body.error?.code).toBe('LEGACY_AUTH_DEPRECATED');
      });
    }
  });
});
