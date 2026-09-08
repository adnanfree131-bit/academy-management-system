import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';

describe('Phase 6: WhatsApp Messaging Engine & Absentee Retention Desk', () => {
  let app: FastifyInstance;
  let token: string;
  let tenantBToken: string;
  const tenantId = 'a0000000-0000-0000-0000-000000000001'; // Apex Academy
  const tenantBId = 'b0000000-0000-0000-0000-000000000002'; // Crescent College

  beforeAll(async () => {
    const store = new InMemoryDataStore();
    app = await buildApp({ store });

    token = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000001',
      user_id: 'a1000000-0000-0000-0000-000000000001',
      tenant_id: tenantId,
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin',
    });

    tenantBToken = app.jwt.sign({
      sub: 'b1000000-0000-0000-0000-000000000001',
      user_id: 'b1000000-0000-0000-0000-000000000001',
      tenant_id: tenantBId,
      email: 'fatima@crescent.edu.pk',
      role: 'tenant_admin',
    });
  });

  // =========================================================================
  // 1. WHATSAPP ENGINE: SANITIZATION, DYNAMIC TAGS & LINK GENERATOR
  // =========================================================================
  describe('Module 15: WhatsApp Direct Messaging Engine', () => {
    it('Gate 1: Sanitizes Pakistani phone numbers by stripping zeros and formatting with 92', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/whatsapp/generate-link',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          phone: '0300-1234567',
          message: 'Hello Parent',
          country_code: '92'
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.clean_phone).toBe('923001234567');
      expect(body.data.is_valid).toBe(true);
      expect(body.data.encoded_url).toContain('https://wa.me/923001234567?text=Hello%20Parent');
    });

    it('Gate 2: Retrieves pre-seeded templates with default badges', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/whatsapp/templates',
        headers: { authorization: `Bearer ${token}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.length).toBeGreaterThanOrEqual(4);
      const categories = body.data.map((t: any) => t.category);
      expect(categories).toContain('ABSENCE');
      expect(categories).toContain('FEE_REMINDER');
      expect(categories).toContain('EXAM_RESULT');
    });

    it('Gate 3: Creates, updates and deletes a custom WhatsApp template', async () => {
      // Create
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/whatsapp/templates',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'Special Parent Orientation Invitation',
          category: 'GENERAL',
          body: 'Dear {guardian_name}, you are cordially invited to the annual orientation for {batch_name}.',
          is_default: false
        }
      });
      expect(createRes.statusCode).toBe(201);
      const created = JSON.parse(createRes.payload).data;
      expect(created.title).toBe('Special Parent Orientation Invitation');

      // Update
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/whatsapp/templates/${created.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'Updated Parent Orientation Invitation'
        }
      });
      expect(updateRes.statusCode).toBe(200);
      expect(JSON.parse(updateRes.payload).data.title).toBe('Updated Parent Orientation Invitation');

      // Delete
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/whatsapp/templates/${created.id}`,
        headers: { authorization: `Bearer ${token}` }
      });
      expect(delRes.statusCode).toBe(200);
    });

    it('Gate 4: Checks duplicate message warning today and dispatches audit log', async () => {
      // 1. Initial check - should not be dispatched today
      const checkRes = await app.inject({
        method: 'GET',
        url: '/api/v1/whatsapp/check-duplicate?student_id=stud-2&category=ABSENCE',
        headers: { authorization: `Bearer ${token}` }
      });
      expect(checkRes.statusCode).toBe(200);
      expect(JSON.parse(checkRes.payload).data.wasDispatchedToday).toBe(false);

      // 2. Dispatch log
      const dispatchRes = await app.inject({
        method: 'POST',
        url: '/api/v1/whatsapp/dispatch',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          student_id: 'stud-2',
          recipient_phone: '+923001234567',
          phone_type: 'PRIMARY',
          message_body: 'Dear Tariq, Hamza was marked absent today.',
          status: 'SENT'
        }
      });
      expect(dispatchRes.statusCode).toBe(201);
      const dispatched = JSON.parse(dispatchRes.payload).data;
      expect(dispatched.link.clean_phone).toBe('923001234567');
      expect(dispatched.log.status).toBe('SENT');

      // 3. Subsequent check - should flag as dispatched today
      const recheckRes = await app.inject({
        method: 'GET',
        url: '/api/v1/whatsapp/check-duplicate?student_id=stud-2&category=ABSENCE',
        headers: { authorization: `Bearer ${token}` }
      });
      expect(recheckRes.statusCode).toBe(200);
      expect(JSON.parse(recheckRes.payload).data.wasDispatchedToday).toBe(true);
    });
  });

  // =========================================================================
  // 2. ABSENTEE DESK: FOLLOW-UP, CONSECUTIVE DAYS & RETENTION
  // =========================================================================
  describe('Module 16: Absentee Follow-Up & Retention Desk', () => {
    it('Gate 5: Retrieves morning absentee follow-ups with consecutive days indicator', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/absentee?date=${today}`,
        headers: { authorization: `Bearer ${token}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.length).toBeGreaterThanOrEqual(3);

      // Find critical student (Bilal Khan with 4 consecutive days)
      const bilal = body.data.find((f: any) => f.student_name === 'Bilal Khan');
      expect(bilal).toBeDefined();
      expect(bilal.consecutive_days).toBe(4);
      expect(bilal.status).toBe('UNREACHABLE');
    });

    it('Gate 6: Computes Director Live Follow-Up KPI summary', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/absentee/kpi?date=${today}`,
        headers: { authorization: `Bearer ${token}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.total_absentees).toBeGreaterThanOrEqual(3);
      expect(body.data.contacted_percentage).toBeGreaterThanOrEqual(0);
      expect(body.data.unreachable_count).toBeGreaterThanOrEqual(1);
    });

    it('Gate 7: Logs parent response with 1-click Medical Leave conversion', async () => {
      // Find Hamza Tariq follow-up (af-1)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/absentee/af-1/response',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          call_outcome: 'CONNECTED',
          reason_category: 'MEDICAL',
          parent_remarks: 'Father confirmed typhoid, doctor advised complete rest until Friday.',
          expected_return_date: '2026-09-18',
          convert_to_medical_leave: true
        }
      });

      expect(res.statusCode).toBe(200);
      const updated = JSON.parse(res.payload).data;
      expect(updated.status).toBe('RESOLVED_EXCUSED');
      expect(updated.is_snoozed).toBe(true);
      expect(updated.snooze_until).toBe('2026-09-18');
      expect(updated.parent_remarks).toContain('typhoid');
    });

    it('Gate 8: Identifies chronic dropout cases and schedules counseling meeting', async () => {
      // Get retention cases
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/absentee/retention',
        headers: { authorization: `Bearer ${token}` }
      });

      expect(res.statusCode).toBe(200);
      const cases = JSON.parse(res.payload).data;
      expect(cases.length).toBeGreaterThanOrEqual(1);

      const caseItem = cases[0];
      expect(caseItem.risk_level).toBe('CRITICAL');

      // Schedule Meeting
      const schedRes = await app.inject({
        method: 'POST',
        url: `/api/v1/absentee/retention/${caseItem.id}/meeting`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          meeting_date: '2026-09-20T10:00:00Z',
          notes: 'Director in-person interview with father regarding 4-day truancy.'
        }
      });

      expect(schedRes.statusCode).toBe(200);
      const updated = JSON.parse(schedRes.payload).data;
      expect(updated.status).toBe('SCHEDULED');
      expect(updated.counseling_notes).toContain('Director in-person interview');
    });

    it('Gate 9: Generates monthly absentee resolution audit report', async () => {
      const thisMonth = new Date().toISOString().substring(0, 7);
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/absentee/reports/resolution?month=${thisMonth}`,
        headers: { authorization: `Bearer ${token}` }
      });

      expect(res.statusCode).toBe(200);
      const report = JSON.parse(res.payload).data;
      expect(report.total_absences).toBeGreaterThanOrEqual(2);
      expect(report.medical_leave_converted).toBeGreaterThanOrEqual(1);
      expect(report.reason_breakdown).toBeDefined();
    });

    it('Gate 10: Multi-Tenant Containment: Tenant B cannot see Tenant A templates or absentees', async () => {
      // Tenant B queries templates
      const tmplRes = await app.inject({
        method: 'GET',
        url: '/api/v1/whatsapp/templates',
        headers: { authorization: `Bearer ${tenantBToken}` }
      });
      expect(tmplRes.statusCode).toBe(200);
      expect(JSON.parse(tmplRes.payload).data.length).toBe(0);

      // Tenant B queries absentees
      const absRes = await app.inject({
        method: 'GET',
        url: '/api/v1/absentee',
        headers: { authorization: `Bearer ${tenantBToken}` }
      });
      expect(absRes.statusCode).toBe(200);
      expect(JSON.parse(absRes.payload).data.length).toBe(0);
    });
  });
});
