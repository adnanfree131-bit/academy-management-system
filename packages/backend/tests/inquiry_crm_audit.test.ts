import { describe, it, expect, beforeAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fjwt from '@fastify/jwt';
import { InMemoryDataStore } from '../src/services/store.js';
import { sisRoutes } from '../src/routes/sis.ts';
import { JWTPayload } from '@apex/shared-types';

describe('Advanced Inquiry CRM & Admissions Desk Audit', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let adminToken: string;
  let studentToken: string;
  const tenantId = 'tenant-test-inq';

  beforeAll(async () => {
    store = new InMemoryDataStore();
    app = Fastify();
    await app.register(fjwt, { secret: 'test-secret-key-1234567890123456' });

    app.decorate('authenticate', async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    });

    await app.register(sisRoutes(store), { prefix: '/api/v1/sis' });
    await app.ready();

    // Create test tenant and admin
    const { tenant, admin: adminUser } = await store.createTenant({
      name: 'The Smart Academy',
      slug: 'tsa-inq',
      admin_email: 'admin@tsa.edu.pk',
      admin_name: 'Adnan Director',
    });

    const adminPayload: JWTPayload = {
      sub: adminUser.id,
      user_id: adminUser.id,
      tenant_id: tenant.id,
      email: adminUser.email,
      role: 'tenant_admin',
      full_name: adminUser.full_name,
    };
    adminToken = app.jwt.sign(adminPayload);

    const studentPayload: JWTPayload = {
      sub: 'student-user-123',
      tenant_id: tenant.id,
      email: 'student@tsa.edu.pk',
      role: 'student',
    };
    studentToken = app.jwt.sign(studentPayload);
  });

  it('1. Create new inquiry with full institutional particulars & auto-generated follow-up history', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/inquiries',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        student_name: 'Hamza Khan',
        phone: '03001234567',
        email: 'hamza@gmail.com',
        guardian_name: 'Tariq Khan',
        guardian_phone: '03219876543',
        guardian_id_card: '35201-1234567-1',
        source: 'Walk-in',
        priority: 'high',
        preferred_shift: 'morning',
        notes: 'Inquiring for 10th science with pre-medical subjects',
        next_follow_up_date: '2026-09-28',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.student_name).toBe('Hamza Khan');
    expect(body.data.priority).toBe('high');
    expect(body.data.inquiry_number).toMatch(/^INQ-2026-\d{3}$/);
    expect(body.data.follow_up_history).toBeDefined();
    expect(body.data.follow_up_history.length).toBe(1);
    expect(body.data.follow_up_history[0].notes).toContain('Inquiring for 10th science');
  });

  it('2. PUT /api/v1/sis/inquiries/:id updates prospective student details', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/sis/inquiries',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const inq = listRes.json().data[0];

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/sis/inquiries/${inq.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        student_name: 'Hamza Tariq Khan',
        priority: 'medium',
        preferred_shift: 'evening',
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json().data;
    expect(updated.student_name).toBe('Hamza Tariq Khan');
    expect(updated.priority).toBe('medium');
    expect(updated.preferred_shift).toBe('evening');
  });

  it('3. POST /api/v1/sis/inquiries/:id/follow-ups appends counselor conversation logs & updates next follow-up date', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/sis/inquiries',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const inq = listRes.json().data[0];

    const followUpRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sis/inquiries/${inq.id}/follow-ups`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        notes: 'Called father. Agreed to attend trial demo class on Monday 9 AM.',
        outcome: 'demo_scheduled',
        next_date: '2026-09-29',
      },
    });

    expect(followUpRes.statusCode).toBe(200);
    const updated = followUpRes.json().data;
    expect(updated.next_follow_up_date).toBe('2026-09-29');
    expect(updated.follow_up_history.length).toBe(2);
    expect(updated.follow_up_history[1].outcome).toBe('demo_scheduled');
    expect(updated.follow_up_history[1].recorded_by_name).toBe('Adnan Director');
  });

  it('4. PATCH /api/v1/sis/inquiries/:id/stage updates stage and captures closed reason', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/sis/inquiries',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const inq = listRes.json().data[0];

    // Transition to trial_scheduled
    const stageRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sis/inquiries/${inq.id}/stage`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        stage: 'trial_scheduled',
        stage_note: 'Scheduled for demo batch Alpha',
      },
    });

    expect(stageRes.statusCode).toBe(200);
    expect(stageRes.json().data.stage).toBe('trial_scheduled');

    // Close inquiry with reason
    const closeRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sis/inquiries/${inq.id}/stage`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        stage: 'closed',
        closed_reason: 'Fee Constraints / Requested discount beyond policy',
      },
    });

    expect(closeRes.statusCode).toBe(200);
    const closed = closeRes.json().data;
    expect(closed.stage).toBe('closed');
    expect(closed.closed_reason).toContain('Fee Constraints');
  });

  it('5. RBAC Protection: Non-staff users are blocked from inquiry mutations', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/inquiries',
      headers: { Authorization: `Bearer ${studentToken}` },
      payload: { student_name: 'Malicious', phone: '03000000000' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('6. DELETE /api/v1/sis/inquiries/:id removes inquiry cleanly', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/inquiries',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        student_name: 'Duplicate Entry',
        phone: '03110000000',
      },
    });
    const idToDelete = createRes.json().data.id;

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/sis/inquiries/${idToDelete}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/sis/inquiries',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const found = listRes.json().data.find((i: any) => i.id === idToDelete);
    expect(found).toBeUndefined();
  });
});
