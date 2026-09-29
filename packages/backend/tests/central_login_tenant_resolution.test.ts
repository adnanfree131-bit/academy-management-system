import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { IMailerService } from '../src/services/mailer.js';

describe('Central Login Tenant Resolution Audit (app.kampus.pk & root host)', () => {
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
      jwtSecret: 'test-secret-central-login-resolution-min-32-chars',
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Successfully logs in with email and password without tenant_slug or tenant_id (auto-resolves TSA tenant)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'amirpersonal135@gmail.com',
        password: 'smart786',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.token).toBeDefined();
    expect(body.data.user.email).toBe('amirpersonal135@gmail.com');
    expect(body.data.user.role).toBe('tenant_admin');
    expect(body.data.tenant.slug).toBe('tsa');
    expect(body.data.tenant.name).toBe('The Smart Academy');
  });

  it('2. Returns 401 AUTH_FAILED when correct email is provided without tenant but password is incorrect', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'amirpersonal135@gmail.com',
        password: 'wrong_password_123',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AUTH_FAILED');
    expect(body.error.message).toBe('Invalid email or password.');
  });

  it('3. Returns 400 TENANT_REQUIRED when CNIC identifier is used without tenant_slug or tenant_id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: '35202-1234567-1',
        password: 'Parent@123',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TENANT_REQUIRED');
    expect(body.error.message).toBe('Academy identifier (tenant_slug or tenant_id) is required.');
  });

  it('4. Returns 400 TENANT_REQUIRED when unknown email is used without tenant_slug or tenant_id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'nonexistent.user@unknownacademy.edu.pk',
        password: 'Password123',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TENANT_REQUIRED');
  });

  it('5. Successfully requests password reset for known email without tenant_slug (auto-resolves tenant)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: {
        email: 'amirpersonal135@gmail.com',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('amirpersonal135@gmail.com');
  });
});
