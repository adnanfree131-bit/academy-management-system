import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { IMailerService } from '../src/services/mailer.js';

describe('Production Authentication, Subdomain Lockdown & Director Password Security', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let sentOTPs: { toEmail: string; otp: string }[] = [];

  const mockMailer: IMailerService = {
    async sendOTP(params) {
      sentOTPs.push({ toEmail: params.toEmail, otp: params.otp });
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

  // ---------------------------------------------------------------------------
  // Test 1: Non-Existent User Security Prohibition
  // ---------------------------------------------------------------------------
  it('Test 1: Non-existent user query returns null and rejects login with HTTP 401', async () => {
    // 1. Query store directly with an unknown email
    const unknownUser = await store.getUserByEmail(
      'a0000000-0000-0000-0000-000000000001',
      'unknown_intruder@apexacademy.edu.pk'
    );
    expect(unknownUser).toBeNull();

    // 2. Attempt login via /api/v1/auth/login with unknown email and backdoor password Admin@123
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'unknown_intruder@apexacademy.edu.pk',
        password: 'Admin@123',
        tenant_slug: 'apex',
      },
    });

    expect(loginRes.statusCode).toBe(401);
    const body = JSON.parse(loginRes.body);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('Invalid email or password');

    // 3. Attempt global login without tenant slug
    const globalLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'unknown_intruder@apexacademy.edu.pk',
        password: 'Admin@123',
      },
    });

    expect(globalLoginRes.statusCode).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // Test 2: Change Password OTP Generation & Cooldown
  // ---------------------------------------------------------------------------
  it('Test 2: Change password OTP issues code and enforces 60-second cooldown', async () => {
    sentOTPs = [];

    // Authenticate as director (adnan@apexacademy.edu.pk / Admin@123)
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'adnan@apexacademy.edu.pk',
        password: 'Admin@123',
        tenant_slug: 'apex',
      },
    });
    expect(loginRes.statusCode).toBe(200);
    const token = JSON.parse(loginRes.body).data.token;

    // First request: should succeed with 200 OK
    const otpRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password-otp',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(otpRes.statusCode).toBe(200);
    const otpBody = JSON.parse(otpRes.body);
    expect(otpBody.success).toBe(true);
    expect(otpBody.data.cooldown_seconds).toBe(60);
    expect(sentOTPs.length).toBe(1);
    expect(sentOTPs[0].toEmail).toBe('adnan@apexacademy.edu.pk');

    // Immediate second request: should be throttled by 60s cooldown (400 or 429)
    const throttledRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password-otp',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect([400, 429]).toContain(throttledRes.statusCode);
    const throttledBody = JSON.parse(throttledRes.body);
    expect(throttledBody.success).toBe(false);
    expect(throttledBody.error.message).toMatch(/wait \d+ seconds/);
  });

  // ---------------------------------------------------------------------------
  // Test 3: Incorrect Current Password Rejection
  // ---------------------------------------------------------------------------
  it('Test 3: Wrong current password is rejected with 401 without consuming OTP attempts', async () => {
    // Authenticate as director
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'adnan@apexacademy.edu.pk',
        password: 'Admin@123',
        tenant_slug: 'apex',
      },
    });
    const token = JSON.parse(loginRes.body).data.token;
    const latestOTP = sentOTPs[sentOTPs.length - 1].otp;

    // Check current active OTP attempts in store
    const activeOTPBefore = await store.getActiveOTP(
      'a0000000-0000-0000-0000-000000000001',
      'adnan@apexacademy.edu.pk'
    );
    expect(activeOTPBefore).not.toBeNull();
    const attemptsBefore = activeOTPBefore!.attempts;

    // Submit change-password with wrong current password
    const changeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        current_password: 'WrongCurrentPassword!@#',
        new_password: 'NewDirectorPassword@2026',
        otp: latestOTP,
      },
    });

    expect(changeRes.statusCode).toBe(401);
    const changeBody = JSON.parse(changeRes.body);
    expect(changeBody.success).toBe(false);
    expect(changeBody.error.code).toBe('INVALID_CURRENT_PASSWORD');

    // Assert OTP attempts were NOT incremented
    const activeOTPAfter = await store.getActiveOTP(
      'a0000000-0000-0000-0000-000000000001',
      'adnan@apexacademy.edu.pk'
    );
    expect(activeOTPAfter!.attempts).toBe(attemptsBefore);
  });

  // ---------------------------------------------------------------------------
  // Test 4: OTP Brute Force Protection
  // ---------------------------------------------------------------------------
  it('Test 4: OTP brute force locks after 5 failed attempts and rejects subsequent attempts', async () => {
    // Authenticate as director
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'adnan@apexacademy.edu.pk',
        password: 'Admin@123',
        tenant_slug: 'apex',
      },
    });
    const token = JSON.parse(loginRes.body).data.token;

    // Submit 4 incorrect OTP attempts
    for (let i = 1; i <= 4; i++) {
      const failRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          current_password: 'Admin@123',
          new_password: 'NewDirectorPassword@2026',
          otp: `00000${i}`,
        },
      });

      expect(failRes.statusCode).toBe(400);
      const failBody = JSON.parse(failRes.body);
      expect(failBody.error.message).toContain('attempts remaining');
    }

    // 5th incorrect attempt should lock the OTP
    const fifthRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        current_password: 'Admin@123',
        new_password: 'NewDirectorPassword@2026',
        otp: '000005',
      },
    });

    expect([400, 429]).toContain(fifthRes.statusCode);
    const fifthBody = JSON.parse(fifthRes.body);
    expect(fifthBody.error.message).toContain('locked');

    // 6th attempt should be rejected as locked immediately
    const sixthRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        current_password: 'Admin@123',
        new_password: 'NewDirectorPassword@2026',
        otp: sentOTPs[sentOTPs.length - 1].otp, // Even with correct code, it's locked!
      },
    });

    expect([400, 429]).toContain(sixthRes.statusCode);
    const sixthBody = JSON.parse(sixthRes.body);
    expect(sixthBody.error.message).toContain('locked');
  });

  // ---------------------------------------------------------------------------
  // Test 5: Cross-Flow Purpose Binding
  // ---------------------------------------------------------------------------
  it('Test 5: OTP generated for password_change cannot be used on reset-password', async () => {
    sentOTPs = [];

    // Clear previous locked OTPs for a fresh user
    // Register a secondary teacher/staff user to test cross-flow cleanly
    const tenantId = 'a0000000-0000-0000-0000-000000000001';
    const cleanEmail = 'target_user@apexacademy.edu.pk';
    const user = {
      id: 'test-user-uuid-1',
      tenant_id: tenantId,
      email: cleanEmail,
      full_name: 'Target Staff',
      role: 'teacher' as const,
      status: 'active' as const,
      password_hash: '$scrypt$dummy',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).users.set(`${tenantId}:${cleanEmail}`, user);

    // Request change password OTP directly through service
    const otpRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password-otp',
      headers: {
        authorization: `Bearer ${app.jwt.sign({
          sub: user.id,
          tenant_id: tenantId,
          email: user.email,
          role: user.role,
        })}`,
      },
    });
    expect(otpRes.statusCode).toBe(200);
    const changePasswordOTP = sentOTPs[sentOTPs.length - 1].otp;

    // Attempt to submit this OTP to /api/v1/auth/reset-password without current password
    const resetRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: {
        email: cleanEmail,
        otp: changePasswordOTP,
        new_password: 'AttackerNewPassword@123',
        tenant_slug: 'apex',
      },
    });

    expect(resetRes.statusCode).toBe(400);
    const resetBody = JSON.parse(resetRes.body);
    expect(resetBody.success).toBe(false);
    expect(resetBody.error.code).toBe('INVALID_OR_EXPIRED_CODE');
  });

  // ---------------------------------------------------------------------------
  // Test 6: Successful Password Change & JWT Refresh
  // ---------------------------------------------------------------------------
  it('Test 6: Successful password change updates scrypt hash, issues fresh JWT, and old password fails', async () => {
    sentOTPs = [];

    // Create a fresh director user
    const tenantId = 'a0000000-0000-0000-0000-000000000001';
    const directorEmail = 'director_fresh@apexacademy.edu.pk';
    const { hashPassword } = await import('../src/services/password.js');
    const initialHash = hashPassword('InitialPass@123');

    const freshDirector = {
      id: 'fresh-director-uuid',
      tenant_id: tenantId,
      email: directorEmail,
      full_name: 'Fresh Director',
      role: 'tenant_admin' as const,
      status: 'active' as const,
      password_hash: initialHash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).users.set(`${tenantId}:${directorEmail}`, freshDirector);

    // 1. Login with initial password to obtain JWT
    const initialLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: directorEmail,
        password: 'InitialPass@123',
        tenant_slug: 'apex',
      },
    });
    expect(initialLoginRes.statusCode).toBe(200);
    const oldToken = JSON.parse(initialLoginRes.body).data.token;

    // 2. Request change password OTP
    const otpRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password-otp',
      headers: {
        authorization: `Bearer ${oldToken}`,
      },
    });
    expect(otpRes.statusCode).toBe(200);
    const validOTP = sentOTPs[sentOTPs.length - 1].otp;

    // 3. Submit change-password with correct credentials
    const changeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: {
        authorization: `Bearer ${oldToken}`,
      },
      payload: {
        current_password: 'InitialPass@123',
        new_password: 'BrandNewSecurePassword@2026',
        otp: validOTP,
      },
    });

    expect(changeRes.statusCode).toBe(200);
    const changeBody = JSON.parse(changeRes.body);
    expect(changeBody.success).toBe(true);
    expect(changeBody.data.token).toBeDefined();
    expect(changeBody.data.token).not.toBe(oldToken);
    expect(changeBody.data.message).toContain('Password updated successfully');

    // 4. Verify login with OLD password now fails (401)
    const oldLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: directorEmail,
        password: 'InitialPass@123',
        tenant_slug: 'apex',
      },
    });
    expect(oldLoginRes.statusCode).toBe(401);

    // 5. Verify login with NEW password succeeds (200 OK)
    const newLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: directorEmail,
        password: 'BrandNewSecurePassword@2026',
        tenant_slug: 'apex',
      },
    });
    expect(newLoginRes.statusCode).toBe(200);
    const newLoginBody = JSON.parse(newLoginRes.body);
    expect(newLoginBody.data.user.email).toBe(directorEmail);
  });

  // ---------------------------------------------------------------------------
  // Test 7: Registration Timeout Idempotent Recovery
  // ---------------------------------------------------------------------------
  it('Test 7: Pending verification registration retries idempotently for matching email, rejects different email with 409', async () => {
    sentOTPs = [];
    const retrySlug = 'cadet-academy';
    const adminEmail = 'director@cadetacademy.pk';

    // 1. First registration attempt: creates tenant in pending_verification
    const firstRegRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        name: 'Cadet Academy Initial',
        slug: retrySlug,
        city: 'Rawalpindi',
        phone: '+92 300 1112233',
        admin_name: 'Director Cadet',
        admin_email: adminEmail,
        password: 'CadetPassword@123',
      },
    });

    expect(firstRegRes.statusCode).toBe(201);
    const tenantInStore = await store.getTenantBySlug(retrySlug);
    expect(tenantInStore).not.toBeNull();
    expect(tenantInStore!.status).toBe('pending_verification');

    // 2. Retry registration with SAME slug and SAME admin email (idempotent recovery)
    sentOTPs = [];
    const retryRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        name: 'Cadet Academy Updated Name',
        slug: retrySlug,
        city: 'Islamabad',
        phone: '+92 300 9998877',
        admin_name: 'Director Cadet Updated',
        admin_email: adminEmail,
        password: 'CadetPasswordNew@456',
      },
    });

    expect(retryRes.statusCode).toBe(201);
    const retryBody = JSON.parse(retryRes.body);
    expect(retryBody.success).toBe(true);
    expect(retryBody.data.tenant.name).toBe('Cadet Academy Updated Name');
    expect(sentOTPs.length).toBe(1);
    expect(sentOTPs[0].toEmail).toBe(adminEmail);

    // 3. Retry registration with SAME slug but DIFFERENT admin email (should be rejected with 409)
    const intruderRetryRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        name: 'Intruder Academy',
        slug: retrySlug,
        city: 'Lahore',
        phone: '+92 300 0000000',
        admin_name: 'Intruder',
        admin_email: 'intruder@otherdomain.pk',
        password: 'IntruderPassword@123',
      },
    });

    expect(intruderRetryRes.statusCode).toBe(409);
    const intruderBody = JSON.parse(intruderRetryRes.body);
    expect(intruderBody.success).toBe(false);
    expect(intruderBody.error.code).toBe('SLUG_IN_USE');
  });
});
