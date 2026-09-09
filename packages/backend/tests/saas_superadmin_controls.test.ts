import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { InMemoryDataStore } from '../src/services/store';

describe('SuperAdmin Control Plane: Trial Policies, Aliasing, Suspension & Popups', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let superAdminToken: string;
  let directorToken: string;
  let teacherToken: string;
  let studentToken: string;

  const TENANT_A_ID = 'a0000000-0000-0000-0000-000000000001'; // Apex Academy
  const TENANT_B_ID = 'b0000000-0000-0000-0000-000000000002'; // Crescent Academy

  beforeAll(async () => {
    store = new InMemoryDataStore();
    app = await buildApp({ store });
    await app.ready();

    // Authenticate SuperAdmin
    superAdminToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000006',
      user_id: 'a1000000-0000-0000-0000-000000000006',
      tenant_id: TENANT_A_ID,
      email: 'kampuserp@gmail.com',
      role: 'super_admin'
    });

    // Authenticate Director
    directorToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000001',
      user_id: 'a1000000-0000-0000-0000-000000000001',
      tenant_id: TENANT_A_ID,
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin'
    });

    // Authenticate Teacher
    teacherToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000002',
      user_id: 'a1000000-0000-0000-0000-000000000002',
      tenant_id: TENANT_A_ID,
      email: 'tariq@apexacademy.edu.pk',
      role: 'teacher'
    });

    // Authenticate Student
    studentToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000005',
      user_id: 'a1000000-0000-0000-0000-000000000005',
      tenant_id: TENANT_A_ID,
      email: 'student@apexacademy.edu.pk',
      role: 'student'
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // 1. Permanent SuperAdmin Account Credentials Verification
  describe('Permanent SuperAdmin Credentials & Recovery', () => {
    it('allows permanent superadmin login via seeded kampuserp@gmail.com and Aliadnan786@', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'kampuserp@gmail.com',
          password: 'Aliadnan786@'
        }
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.user.role).toBe('super_admin');
      expect(json.data.user.email).toBe('kampuserp@gmail.com');
      expect(json.data.token).toBeDefined();
    });

    it('allows password reset request for kampuserp@gmail.com and restores original password', async () => {
      // 1. Request reset code
      const reqRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: {
          email: 'kampuserp@gmail.com'
        }
      });
      expect(reqRes.statusCode).toBe(200);
      const reqJson = JSON.parse(reqRes.body);
      expect(reqJson.success).toBe(true);
      const otp = reqJson.data.dev_otp_preview || '123456';

      // 2. Perform reset
      const resetRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: {
          email: 'kampuserp@gmail.com',
          otp,
          new_password: 'AliadnanNewPass2026@'
        }
      });
      expect(resetRes.statusCode).toBe(200);

      // 3. Verify login works with new password
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'kampuserp@gmail.com',
          password: 'AliadnanNewPass2026@'
        }
      });
      expect(loginRes.statusCode).toBe(200);

      // 4. Restore original password for downstream tests
      const restoreRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: { email: 'kampuserp@gmail.com' }
      });
      const restoreOtp = JSON.parse(restoreRes.body).data.dev_otp_preview || '123456';
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: {
          email: 'kampuserp@gmail.com',
          otp: restoreOtp,
          new_password: 'Aliadnan786@'
        }
      });
    });
  });

  // 2. Dynamic Free Trial Policy Configuration
  describe('Dynamic Free Trial Policy', () => {
    it('allows SuperAdmin to read and update default trial days', async () => {
      // 1. Read platform config
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/platform-config',
        headers: { authorization: `Bearer ${superAdminToken}` }
      });
      expect(getRes.statusCode).toBe(200);
      const getJson = JSON.parse(getRes.body);
      expect(getJson.data.default_trial_days).toBe(30);

      // 2. Update default trial days to 60 days
      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/saas/platform-config',
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          default_trial_days: 60,
          grace_period_days: 14
        }
      });
      expect(putRes.statusCode).toBe(200);
      const putJson = JSON.parse(putRes.body);
      expect(putJson.data.default_trial_days).toBe(60);
      expect(putJson.data.grace_period_days).toBe(14);

      // 3. Register a new academy and verify it receives a 60-day trial
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          name: 'Pioneer Horizon Academy',
          slug: 'pioneer-horizon',
          admin_name: 'Principal Qasim',
          admin_email: 'qasim@pioneerhorizon.edu.pk',
          password: 'PioneerPassword123!',
          phone: '+92 300 9876543',
          campus_name: 'Main Campus'
        }
      });
      expect(regRes.statusCode).toBe(201);
      const regJson = JSON.parse(regRes.body);
      expect(regJson.success).toBe(true);
      
      const createdTenant = await store.getTenantById(regJson.data.tenant.id);
      expect(createdTenant).not.toBeNull();
      const trialEnds = new Date(createdTenant!.trial_ends_at).getTime();
      const created = new Date(createdTenant!.created_at).getTime();
      const diffDays = Math.round((trialEnds - created) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(60);
    });
  });

  // 3. Subdomain Renaming with 301 Aliases
  describe('Subdomain Renaming with 301 Aliases', () => {
    it('renames academy slug and creates automatic 301 redirect alias', async () => {
      // 1. Rename 'apex' to 'apex-premier'
      const renameRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/saas/tenants/${TENANT_A_ID}/subdomain`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          new_slug: 'apex-premier'
        }
      });

      expect(renameRes.statusCode).toBe(200);
      const renameJson = JSON.parse(renameRes.body);
      expect(renameJson.success).toBe(true);
      expect(renameJson.data.tenant.slug).toBe('apex-premier');
      expect(renameJson.data.previous_slug).toBe('apex');

      // 2. Resolve the new slug directly
      const newSlugRes = await store.resolveTenantBySlugOrAlias('apex-premier');
      expect(newSlugRes).not.toBeNull();
      expect(newSlugRes?.is_alias).toBe(false);
      expect(newSlugRes?.primary_slug).toBe('apex-premier');
      expect(newSlugRes?.tenant?.id).toBe(TENANT_A_ID);

      // 3. Resolve the OLD slug 'apex' -> should return is_alias: true and primary_slug
      const oldSlugRes = await store.resolveTenantBySlugOrAlias('apex');
      expect(oldSlugRes).not.toBeNull();
      expect(oldSlugRes?.is_alias).toBe(true);
      expect(oldSlugRes?.primary_slug).toBe('apex-premier');
      expect(oldSlugRes?.tenant?.id).toBe(TENANT_A_ID);
    });
  });

  // 4. Academy Suspension & Role-Segregated Gatekeeping
  describe('Academy Suspension & Role Segregation', () => {
    it('suspends academy and enforces role-segregated access', async () => {
      // 1. SuperAdmin suspends Apex Academy
      const suspendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/saas/tenants/${TENANT_A_ID}/suspend`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          reason: 'Terms of Service review pending annual license renewal.'
        }
      });
      expect(suspendRes.statusCode).toBe(200);
      const suspendJson = JSON.parse(suspendRes.body);
      expect(suspendJson.data.status).toBe('suspended');
      expect(suspendJson.data.suspended_reason).toContain('Terms of Service review');

      // 2. Teacher attempts to access class management -> 403 ACADEMY_SUSPENDED
      const teacherReq = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: { authorization: `Bearer ${teacherToken}` }
      });
      expect(teacherReq.statusCode).toBe(403);
      const teacherJson = JSON.parse(teacherReq.body);
      expect(teacherJson.error.code).toBe('ACADEMY_SUSPENDED');
      expect(teacherJson.error.suspended_reason).toBeDefined();

      // 3. Student attempts to access portal -> 403 ACADEMY_SUSPENDED
      const studentReq = await app.inject({
        method: 'GET',
        url: '/api/v1/portal/student-parent',
        headers: { authorization: `Bearer ${studentToken}` }
      });
      expect(studentReq.statusCode).toBe(403);
      const studentJson = JSON.parse(studentReq.body);
      expect(studentJson.error.code).toBe('ACADEMY_SUSPENDED');

      // 4. Director attempts general operation -> 403
      const directorGeneralReq = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: { authorization: `Bearer ${directorToken}` }
      });
      expect(directorGeneralReq.statusCode).toBe(403);

      // 5. Director accesses Billing Settlement Desk (trial-status / banking-config) -> 200 ALLOWED
      const directorBillingReq = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/trial-status',
        headers: { authorization: `Bearer ${directorToken}` }
      });
      expect(directorBillingReq.statusCode).toBe(200);

      // 6. SuperAdmin reinstates academy
      const reinstateRes = await app.inject({
        method: 'POST',
        url: `/api/v1/saas/tenants/${TENANT_A_ID}/reinstate`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {}
      });
      expect(reinstateRes.statusCode).toBe(200);
      const reinstateJson = JSON.parse(reinstateRes.body);
      expect(reinstateJson.data.status).toBe('active');

      // 7. Teacher access is restored
      const teacherRestoredReq = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/programs',
        headers: { authorization: `Bearer ${teacherToken}` }
      });
      expect(teacherRestoredReq.statusCode).toBe(200);
    });
  });

  // 5. SuperAdmin Broadcast Announcement Popup & Read Receipts
  describe('SuperAdmin Broadcast Announcements & Read Receipts', () => {
    it('creates announcement, delivers to director, and honors once_dismissible persistence', async () => {
      // 1. SuperAdmin creates a dismissible system announcement
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/saas/announcements',
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          title: 'Scheduled Core Maintenance Notice',
          message: 'The platform database will undergo brief routine indexing on Sunday at 02:00 AM PKT.',
          type: 'warning',
          frequency: 'once_dismissible',
          target_audience: 'admin_only'
        }
      });
      expect(createRes.statusCode).toBe(201);
      const createJson = JSON.parse(createRes.body);
      const announcementId = createJson.data.id;
      expect(announcementId).toBeDefined();

      // 2. Director queries active popup
      const popupRes1 = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/tenant/active-popup',
        headers: { authorization: `Bearer ${directorToken}` }
      });
      expect(popupRes1.statusCode).toBe(200);
      const popup1Json = JSON.parse(popupRes1.body);
      expect(popup1Json.data).not.toBeNull();
      expect(popup1Json.data.id).toBe(announcementId);
      expect(popup1Json.data.title).toBe('Scheduled Core Maintenance Notice');

      // 3. Director dismisses the newly created announcement
      const dismissRes = await app.inject({
        method: 'POST',
        url: `/api/v1/saas/tenant/announcements/${announcementId}/dismiss`,
        headers: { authorization: `Bearer ${directorToken}` },
        payload: {
          tenant_id: TENANT_A_ID
        }
      });
      expect(dismissRes.statusCode).toBe(200);

      // Dismiss any other seeded announcements (e.g. ann-default-01)
      let nextPopup = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/tenant/active-popup',
        headers: { authorization: `Bearer ${directorToken}` }
      });
      let nextJson = JSON.parse(nextPopup.body);
      while (nextJson.data) {
        await app.inject({
          method: 'POST',
          url: `/api/v1/saas/tenant/announcements/${nextJson.data.id}/dismiss`,
          headers: { authorization: `Bearer ${directorToken}` },
          payload: { tenant_id: TENANT_A_ID }
        });
        nextPopup = await app.inject({
          method: 'GET',
          url: '/api/v1/saas/tenant/active-popup',
          headers: { authorization: `Bearer ${directorToken}` }
        });
        nextJson = JSON.parse(nextPopup.body);
      }

      // 4. All dismissible announcements are now dismissed -> returns null
      expect(nextJson.data).toBeNull();
    });

    it('always shows every_login announcement even if previously dismissed', async () => {
      // 1. SuperAdmin creates an every_login announcement
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/saas/announcements',
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          title: 'Urgent Biometric Device Sync',
          message: 'Please ensure your biometric attendance device sync daemon is updated to v2.4.',
          type: 'urgent',
          frequency: 'every_login',
          target_audience: 'all'
        }
      });
      expect(createRes.statusCode).toBe(201);
      const announcement = JSON.parse(createRes.body).data;

      // 2. Director queries active popup
      const popupRes1 = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/tenant/active-popup',
        headers: { authorization: `Bearer ${directorToken}` }
      });
      expect(popupRes1.statusCode).toBe(200);
      expect(JSON.parse(popupRes1.body).data?.id).toBe(announcement.id);

      // 3. Dismiss it
      await app.inject({
        method: 'POST',
        url: `/api/v1/saas/tenant/announcements/${announcement.id}/dismiss`,
        headers: { authorization: `Bearer ${directorToken}` },
        payload: { tenant_id: TENANT_A_ID }
      });

      // 4. Because frequency is 'every_login', it still appears on subsequent queries!
      const popupRes2 = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/tenant/active-popup',
        headers: { authorization: `Bearer ${directorToken}` }
      });
      expect(popupRes2.statusCode).toBe(200);
      expect(JSON.parse(popupRes2.body).data?.id).toBe(announcement.id);
    });

    it('allows SuperAdmin to update and delete announcements', async () => {
      // 1. Create an announcement
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/saas/announcements',
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          title: 'Draft Notice',
          message: 'This is a draft notice message.',
          type: 'warning',
          frequency: 'once_dismissible',
          target_audience: 'all'
        }
      });
      expect(createRes.statusCode).toBe(201);
      const ann = JSON.parse(createRes.body).data;

      // 2. Update the announcement
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/saas/announcements/${ann.id}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          title: 'Updated Official Advisory',
          message: 'Corrected instructions for all campus administrators.',
          action_label: 'View Guidelines',
          action_url: 'https://app.kampus.pk/docs'
        }
      });
      expect(updateRes.statusCode).toBe(200);
      const updatedData = JSON.parse(updateRes.body).data;
      expect(updatedData.title).toBe('Updated Official Advisory');
      expect(updatedData.action_label).toBe('View Guidelines');

      // 3. Delete the announcement
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/saas/announcements/${ann.id}`,
        headers: { authorization: `Bearer ${superAdminToken}` }
      });
      expect(deleteRes.statusCode).toBe(200);

      // 4. Verify it is gone
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/announcements',
        headers: { authorization: `Bearer ${superAdminToken}` }
      });
      const list = JSON.parse(listRes.body).data;
      expect(list.some((a: any) => a.id === ann.id)).toBe(false);
    });
  });

  // 6. Individual Academy Billing Controls & Advance Subscriptions
  describe('Individual Academy Management & Billing Controls', () => {
    it('updates custom monthly fee, anchor day, and individual grace period', async () => {
      const billingRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/saas/tenants/${TENANT_A_ID}/billing`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          custom_monthly_fee: 12500,
          individual_grace_period_days: 14,
          billing_cycle_anchor_day: 15
        }
      });

      expect(billingRes.statusCode).toBe(200);
      const json = JSON.parse(billingRes.body);
      expect(json.success).toBe(true);
      expect(json.data.custom_monthly_fee).toBe(12500);
      expect(json.data.individual_grace_period_days).toBe(14);
      expect(json.data.billing_cycle_anchor_day).toBe(15);

      // Verify reflected in SuperAdmin Overview
      const overviewRes = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
        headers: { authorization: `Bearer ${superAdminToken}` }
      });
      const overviewJson = JSON.parse(overviewRes.body);
      const tenantA = overviewJson.data.tenants.find((t: any) => t.id === TENANT_A_ID);
      expect(tenantA.custom_monthly_fee).toBe(12500);
      expect(tenantA.individual_grace_period_days).toBe(14);
      expect(tenantA.billing_cycle_anchor_day).toBe(15);
    });

    it('records 1-month auto-extend payment with anchored date calculation', async () => {
      const renewRes = await app.inject({
        method: 'POST',
        url: `/api/v1/saas/tenants/${TENANT_A_ID}/renew`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          duration_months: 1,
          payment_method: 'MEEZAN_BANK_IBFT',
          reference_number: 'MEEZAN-99281',
          notes: 'Regular 1-month monthly subscription payment received.'
        }
      });

      expect(renewRes.statusCode).toBe(200);
      const renewJson = JSON.parse(renewRes.body);
      expect(renewJson.success).toBe(true);
      expect(renewJson.data.tenant.status).toBe('active');
      expect(renewJson.data.receipt.amount).toBe(12500); // respects custom fee!
      expect(renewJson.data.receipt.status).toBe('APPROVED');
      expect(renewJson.data.receipt.reference_number).toBe('MEEZAN-99281');

      // Due date day should match anchor day 15
      const newExpiry = new Date(renewJson.data.tenant.subscription_renews_at);
      expect(newExpiry.getDate()).toBe(15);
    });

    it('records 3-month advance payment with custom negotiated amount', async () => {
      const advanceRes = await app.inject({
        method: 'POST',
        url: `/api/v1/saas/tenants/${TENANT_A_ID}/renew`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          duration_months: 3,
          custom_amount: 35000, // discounted from 37,500
          payment_method: 'CASH',
          reference_number: 'CASH-ADV-Q1',
          notes: 'Quarterly advance payment in cash at head office.'
        }
      });

      expect(advanceRes.statusCode).toBe(200);
      const advanceJson = JSON.parse(advanceRes.body);
      expect(advanceJson.success).toBe(true);
      expect(advanceJson.data.receipt.amount).toBe(35000);
      expect(advanceJson.data.receipt.plan_duration_months).toBe(3);
      expect(advanceJson.data.receipt.status).toBe('APPROVED');
      expect(advanceJson.data.receipt.payment_method).toBe('CASH');
    });

    it('soft archives academy and keeps records intact', async () => {
      const archiveRes = await app.inject({
        method: 'POST',
        url: `/api/v1/saas/tenants/${TENANT_B_ID}/archive`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          reason: 'Client requested seasonal hiatus for summer break.'
        }
      });

      expect(archiveRes.statusCode).toBe(200);
      const archiveJson = JSON.parse(archiveRes.body);
      expect(archiveJson.data.status).toBe('archived');
      expect(archiveJson.data.suspended_reason).toContain('summer break');

      // Status check should report archived lockout
      const statusRes = await store.getTenantTrialStatus(TENANT_B_ID);
      expect(statusRes.is_locked).toBe(true);
      expect(statusRes.lock_reason).toContain('summer break');

      // Overview reports archived_tenants count
      const overviewRes = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
        headers: { authorization: `Bearer ${superAdminToken}` }
      });
      const overviewJson = JSON.parse(overviewRes.body);
      expect(overviewJson.data.archived_tenants).toBeGreaterThanOrEqual(1);

      // Reinstate unarchives cleanly
      const reinstateRes = await app.inject({
        method: 'POST',
        url: `/api/v1/saas/tenants/${TENANT_B_ID}/reinstate`,
        headers: { authorization: `Bearer ${superAdminToken}` }
      });
      expect(reinstateRes.statusCode).toBe(200);
      expect(JSON.parse(reinstateRes.body).data.status).toBe('active');
    });

    it('hard deletes academy, wipes all child data, and immediately releases the subdomain slug for new registration', async () => {
      // 1. Create a dummy academy to wipe
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          name: 'Disposable Academy',
          slug: 'disposable-academy',
          admin_name: 'Director Disposable',
          admin_email: 'director@disposable.pk',
          password: 'Password123!',
          phone: '+923001112233',
          city: 'Rawalpindi'
        }
      });
      expect(regRes.statusCode).toBe(201);
      const dummyTenantId = JSON.parse(regRes.body).data.tenant.id;

      // Check slug is occupied
      const checkRes1 = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/check-domain?slug=disposable-academy'
      });
      expect(JSON.parse(checkRes1.body).data.available).toBe(false);

      // 2. Perform Hard Delete (Data Wipe & Domain Release)
      const purgeRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/saas/tenants/${dummyTenantId}/purge`,
        headers: { authorization: `Bearer ${superAdminToken}` }
      });

      expect(purgeRes.statusCode).toBe(200);
      const purgeJson = JSON.parse(purgeRes.body);
      expect(purgeJson.success).toBe(true);
      expect(purgeJson.data.freed_slug).toBe('disposable-academy');

      // 3. Subdomain is now AVAILABLE again immediately!
      const checkRes2 = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/check-domain?slug=disposable-academy'
      });
      expect(JSON.parse(checkRes2.body).data.available).toBe(true);

      // 4. Verify tenant is completely wiped from store
      const tenantCheck = await store.getTenantById(dummyTenantId);
      expect(tenantCheck).toBeNull();
    });
  });
});
