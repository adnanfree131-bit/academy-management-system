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

  it('1. Legacy /api/v1/auth/login returns 410 Gone (retired in favor of Supabase Auth)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'amirpersonal135@gmail.com',
        password: 'smart786',
      },
    });

    expect(res.statusCode).toBe(410);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('LEGACY_AUTH_DEPRECATED');
  });

  it('2. Legacy /api/v1/auth/login returns 410 Gone even when wrong password is provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'amirpersonal135@gmail.com',
        password: 'wrong_password_123',
      },
    });

    expect(res.statusCode).toBe(410);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('LEGACY_AUTH_DEPRECATED');
  });

  it('3. Legacy /api/v1/auth/login returns 410 Gone when CNIC identifier is used', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: '35202-1234567-1',
        password: 'Parent@123',
      },
    });

    expect(res.statusCode).toBe(410);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('LEGACY_AUTH_DEPRECATED');
  });

  it('4. Legacy /api/v1/auth/login returns 410 Gone when unknown email is used', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'nonexistent.user@unknownacademy.edu.pk',
        password: 'Password123',
      },
    });

    expect(res.statusCode).toBe(410);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('LEGACY_AUTH_DEPRECATED');
  });

  it('5. Legacy /api/v1/auth/forgot-password returns 410 Gone (Supabase Auth manages password recovery)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: {
        email: 'amirpersonal135@gmail.com',
      },
    });

    expect(res.statusCode).toBe(410);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('LEGACY_AUTH_DEPRECATED');
  });
});
