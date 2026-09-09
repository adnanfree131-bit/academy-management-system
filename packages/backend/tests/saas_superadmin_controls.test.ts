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

  beforeAll(async () => {
    store = new InMemoryDataStore();
    app = await buildApp({ store });
    await app.ready();

    // Authenticate SuperAdmin
    superAdminToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000006',
      user_id: 'a1000000-0000-0000-0000-000000000006',
      tenant_id: TENANT_A_ID,
      email: 'superadmin@kampus.pk',
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
    it('allows permanent superadmin login via seeded superadmin@kampus.pk credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'superadmin@kampus.pk',
          password: 'SuperAdmin@12345'
        }
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.user.role).toBe('super_admin');
      expect(json.data.token).toBeDefined();
    });

    it('allows superadmin login via kampuserp@gmail.com credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'kampuserp@gmail.com',
          password: 'SuperAdmin@12345'
        }
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.user.role).toBe('super_admin');
      expect(json.data.token).toBeDefined();
    });

    it('allows password reset request for kampuserp@gmail.com and synchronizes superadmin credentials', async () => {
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
          new_password: 'SuperAdmin@NewPass2026'
        }
      });
      expect(resetRes.statusCode).toBe(200);

      // 3. Verify login works with new password for both superadmin accounts
      const loginRes1 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'kampuserp@gmail.com',
          password: 'SuperAdmin@NewPass2026'
        }
      });
      expect(loginRes1.statusCode).toBe(200);

      const loginRes2 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'superadmin@kampus.pk',
          password: 'SuperAdmin@NewPass2026'
        }
      });
      expect(loginRes2.statusCode).toBe(200);

      // 4. Restore original password for downstream tests
      const restoreRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: { email: 'superadmin@kampus.pk' }
      });
      const restoreOtp = JSON.parse(restoreRes.body).data.dev_otp_preview || '123456';
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: {
          email: 'superadmin@kampus.pk',
          otp: restoreOtp,
          new_password: 'SuperAdmin@12345'
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
  });
});
