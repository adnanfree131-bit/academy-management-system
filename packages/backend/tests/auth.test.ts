import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { IMailerService } from '../src/services/mailer.js';

describe('Phase 1: Backend Fastify & Brevo OTP Authentication Engine', () => {
  let app: FastifyInstance;
  let sentOTPs: { toEmail: string; otp: string }[] = [];

  const mockMailer: IMailerService = {
    async sendOTP(params) {
      sentOTPs.push({ toEmail: params.toEmail, otp: params.otp });
      return true;
    },
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const store = new InMemoryDataStore();
    app = await buildApp({ store, mailer: mockMailer, jwtSecret: 'test-secret-min-32-chars-long-for-vitest' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Health check returns 200 OK', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('healthy');
  });

  it('2. Request OTP rejects non-existent tenant', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/request-otp',
      payload: {
        email: 'admin@unknown.edu',
        tenant_slug: 'non-existent-academy',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('does not exist');
  });

  it('3. Request OTP dispatches code for valid tenant user', async () => {
    sentOTPs = [];
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/request-otp',
      payload: {
        email: 'adnan@apexacademy.edu.pk',
        tenant_slug: 'apex',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.cooldown_seconds).toBe(60);
    expect(sentOTPs.length).toBe(1);
    expect(sentOTPs[0].toEmail).toBe('adnan@apexacademy.edu.pk');
    expect(sentOTPs[0].otp).toMatch(/^\d{6}$/);
  });

  it('4. Verify OTP rejects incorrect 6-digit code', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      payload: {
        email: 'adnan@apexacademy.edu.pk',
        otp: '999999',
        tenant_slug: 'apex',
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('Incorrect verification code');
  });

  it('5. Verify OTP succeeds with correct code and issues JWT token', async () => {
    const dispatchedOTP = sentOTPs[0].otp;

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      payload: {
        email: 'adnan@apexacademy.edu.pk',
        otp: dispatchedOTP,
        tenant_slug: 'apex',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
    expect(body.data.user.email).toBe('adnan@apexacademy.edu.pk');
    expect(body.data.user.role).toBe('tenant_admin');
    expect(body.data.tenant.name).toBe('Apex Academy Lahore');

    // 6. Test /me endpoint using the issued JWT
    const meResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${body.data.token}`,
      },
    });

    expect(meResponse.statusCode).toBe(200);
    const meBody = JSON.parse(meResponse.body);
    expect(meBody.success).toBe(true);
    expect(meBody.data.user.full_name).toBe('Director Adnan');
    expect(meBody.data.tenant.slug).toBe('apex');
  });

  it('7. Subdomain availability check returns status and domain', async () => {
    // Check available slug
    const resAvail = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/check-domain?slug=falcon-grammar',
    });
    expect(resAvail.statusCode).toBe(200);
    const bodyAvail = JSON.parse(resAvail.body);
    expect(bodyAvail.data.available).toBe(true);
    expect(bodyAvail.data.domain).toBe('falcon-grammar.edu.kampus.pk');

    // Check taken slug (apex)
    const resTaken = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/check-domain?slug=apex',
    });
    expect(resTaken.statusCode).toBe(200);
    const bodyTaken = JSON.parse(resTaken.body);
    expect(bodyTaken.data.available).toBe(false);
  });

  it('8. Daily Operational Sign In with Email & Password', async () => {
    // Successful login with seeded user
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'adnan@apexacademy.edu.pk',
        password: 'Admin@123',
        tenant_slug: 'apex',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
    expect(body.data.user.email).toBe('adnan@apexacademy.edu.pk');

    // Failed login with incorrect password
    const resFail = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'adnan@apexacademy.edu.pk',
        password: 'WrongPassword123',
        tenant_slug: 'apex',
      },
    });
    expect(resFail.statusCode).toBe(401);
    const bodyFail = JSON.parse(resFail.body);
    expect(bodyFail.success).toBe(false);
  });

  it('9. Register Academy with city, phone, logo, password, and verify via Brevo OTP', async () => {
    sentOTPs = [];
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        name: 'Falcon Science Academy',
        slug: 'falcon-sci',
        city: 'Lahore',
        phone: '+92 300 5551234',
        logo_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        admin_name: 'Director Farhan',
        admin_email: 'farhan@falconscience.edu.pk',
        password: 'FalconPassword@2026',
      },
    });

    expect(regRes.statusCode).toBe(201);
    const regBody = JSON.parse(regRes.body);
    expect(regBody.success).toBe(true);
    expect(regBody.data.tenant.slug).toBe('falcon-sci');
    expect(regBody.data.tenant.city).toBe('Lahore');
    expect(regBody.data.tenant.logo_url).toContain('data:image/png');
    expect(sentOTPs.length).toBe(1);
    expect(sentOTPs[0].toEmail).toBe('farhan@falconscience.edu.pk');

    // Verify registration OTP
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-registration-otp',
      payload: {
        email: 'farhan@falconscience.edu.pk',
        otp: sentOTPs[0].otp,
        tenant_slug: 'falcon-sci',
      },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = JSON.parse(verifyRes.body);
    expect(verifyBody.success).toBe(true);
    expect(verifyBody.data.token).toBeDefined();
    expect(verifyBody.data.user.role).toBe('tenant_admin');
    expect(verifyBody.data.tenant.status).toBe('active');

    // Subsequent daily login with password succeeds
    const dailyLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'farhan@falconscience.edu.pk',
        password: 'FalconPassword@2026',
        tenant_slug: 'falcon-sci',
      },
    });
    expect(dailyLoginRes.statusCode).toBe(200);
  });

  it('10. Branding endpoint returns white-labeled logo, city, phone, and domain', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/branding?slug=falcon-sci',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Falcon Science Academy');
    expect(body.data.slug).toBe('falcon-sci');
    expect(body.data.city).toBe('Lahore');
    expect(body.data.phone).toBe('+92 300 5551234');
    expect(body.data.logo_url).toContain('data:image/png');
    expect(body.data.domain).toBe('falcon-sci.edu.kampus.pk');
  });

  it('11. Password reset flow dispatches Brevo OTP and updates password', async () => {
    sentOTPs = [];
    const forgotRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: {
        email: 'farhan@falconscience.edu.pk',
        tenant_slug: 'falcon-sci',
      },
    });

    expect(forgotRes.statusCode).toBe(200);
    expect(sentOTPs.length).toBe(1);
    const resetOTP = sentOTPs[0].otp;

    // Reset password with code
    const resetRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: {
        email: 'farhan@falconscience.edu.pk',
        otp: resetOTP,
        new_password: 'NewFalconPassword@999',
        tenant_slug: 'falcon-sci',
      },
    });

    expect(resetRes.statusCode).toBe(200);

    // Login with new password succeeds
    const newLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'farhan@falconscience.edu.pk',
        password: 'NewFalconPassword@999',
        tenant_slug: 'falcon-sci',
      },
    });
    expect(newLoginRes.statusCode).toBe(200);
  });
});
