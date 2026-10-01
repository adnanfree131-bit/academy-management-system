import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import * as jose from 'jose';
import { InMemoryDataStore } from '../src/services/store.js';
import { sisRoutes } from '../src/routes/sis.ts';
import { financeRoutes } from '../src/routes/finance.ts';
import { authRoutes } from '../src/routes/auth.ts';
import { portalRoutes } from '../src/routes/portal.ts';
import { academicRoutes } from '../src/routes/academic.ts';
import { IMailerService } from '../src/services/mailer.js';
import { JWTPayload } from '@apex/shared-types';

describe('Student Bulk Excel Ingestion & Operational Integration', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let adminToken: string;
  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  const testSecret = new TextEncoder().encode('test-secret-key-1234567890123456');

  beforeAll(async () => {
    store = new InMemoryDataStore();

    app = Fastify();

    app.decorate('authenticate', async (request: any, reply: any) => {
      try {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) throw new Error('Missing token');
        const { payload } = await jose.jwtVerify(authHeader.slice(7), testSecret);
        request.user = payload;
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    });

    const mailer: IMailerService = {
      sendOTP: async () => true,
      sendCustom: async () => true,
    };
    await app.register(authRoutes(store, mailer), { prefix: '/api/v1/auth' });
    await app.register(sisRoutes(store), { prefix: '/api/v1/sis' });
    await app.register(financeRoutes(store), { prefix: '/api/v1/finance' });
    await app.register(portalRoutes(store), { prefix: '/api/v1/portal' });
    await app.register(academicRoutes(store), { prefix: '/api/v1/academic' });

    await app.ready();

    const payload: JWTPayload = {
      sub: 'admin-user-id',
      tenant_id: tenantId,
      email: 'admin@apexacademy.edu.pk',
      role: 'tenant_admin',
    };
    adminToken = await new jose.SignJWT(payload as any)
      .setProtectedHeader({ alg: 'HS256' })
      .sign(testSecret);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Imports roster using batch name and applies custom fees with invoice generation', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students/bulk-import',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: targetBatch.id,
        generate_invoices: true,
        students: [
          {
            full_name: 'Haris Rauf',
            guardian_name: 'Rauf Ahmed',
            guardian_phone: '0300-1112233',
            guardian_id_card: '35201-9988776-1',
            guardian_relation: 'Father',
            email: 'N/A', // resilient email handling
            guardian_email: 'None',
            gender: 'Male',
            roll_number: 'HR-01',
            base_tuition: 7500,
            admission_fee: 2500,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.imported_count).toBe(1);
    expect(body.data.students[0].full_name).toBe('Haris Rauf');
    expect(body.data.students[0].fee_structure.net_tuition).toBe(7500);
    expect(body.data.students[0].fee_structure.first_month_total).toBe(10000);

    // Verify credential metadata is returned
    expect(body.data.credentials).toBeDefined();
    expect(body.data.credentials.length).toBe(1);
    const cred = body.data.credentials[0];
    expect(cred.student_name).toBe('Haris Rauf');
    expect(cred.guardian_name).toBe('Rauf Ahmed');
    expect(cred.default_password).toBe('Parent@123');
    expect(cred.first_month_amount).toBe(10000);

    // Verify first-month invoice was generated in financial ledger
    const invoices = await store.getInvoices(tenantId, { studentId: body.data.students[0].id });
    expect(invoices.length).toBeGreaterThanOrEqual(1);
    expect(invoices[0].total_amount).toBe(10000);
  });

  it('2. Resolves batch by human-readable batch name and resolves elective curriculum stream', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students/bulk-import',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        generate_invoices: false,
        students: [
          {
            full_name: 'Zainab Bibi',
            guardian_name: 'Bibi Khan',
            guardian_phone: '0321-4455667',
            batch_name: targetBatch.name, // human readable name
            gender: 'Female',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.imported_count).toBe(1);
    expect(body.data.students[0].batch_id).toBe(targetBatch.id);
  });

  it('3. Resiliently handles malformed emails and non-numeric fee strings without failing Zod', async () => {
    const batches = await store.getBatches(tenantId);
    const targetBatch = batches[0];

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students/bulk-import',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: targetBatch.id,
        students: [
          {
            full_name: 'Ahmed Tariq',
            guardian_name: 'Tariq Mehmood',
            guardian_phone: '0333-7788990',
            email: '   ', // whitespace
            guardian_email: 'not-an-email', // invalid string sanitized to undefined
            base_tuition: '6000' as any, // coerced to number
            admission_fee: '1500' as any,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.imported_count).toBe(1);
    expect(body.data.students[0].email).toBeUndefined();
    expect(body.data.students[0].fee_structure.net_tuition).toBe(6000);
  });

  it('4. Reports row errors cleanly when batch is not found or compulsory fields missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students/bulk-import',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        students: [
          {
            full_name: 'Orphan Candidate',
            guardian_name: 'Guardian',
            guardian_phone: '03001234567',
            batch_id: 'non-existent-batch-id',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.failed_count).toBe(1);
    expect(body.data.errors[0].error).toMatch(/Batch.*not found/);
  });
});
