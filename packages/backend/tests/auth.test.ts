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
});
