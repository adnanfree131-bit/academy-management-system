import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';

describe('Phase 3 Core ERP Operations & Collision Engine', () => {
  let app: FastifyInstance;
  let token: string;
  const tenantId = 'a0000000-0000-0000-0000-000000000001'; // Apex Academy

  beforeAll(async () => {
    const store = new InMemoryDataStore();
    app = await buildApp({ store });

    // Authenticate as Apex Academy admin
    token = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000001',
      user_id: 'a1000000-0000-0000-0000-000000000001',
      tenant_id: tenantId,
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin',
    });
  });

  // =========================================================================
  // 1. TIMETABLE & 4-WAY COLLISION ENGINE
  // =========================================================================
  describe('Module 5: Timetable & Collision Engine', () => {
    it('retrieves pre-seeded timetable slots', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/timetable/timetable',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
      expect(body.data[0].subject_name).toBeDefined();
    });

    it('blocks batch collision when attempting to schedule overlapping slot for same batch', async () => {
      // Pre-seeded slot is Monday 08:30-09:45 for Batch 2026-A
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/timetable/timetable',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          batch_id: 'a3000000-0000-0000-0000-000000000001', // Batch 2026-A
          subject_id: 's2', // Chemistry
          teacher_id: 'a1000000-0000-0000-0000-000000000003', // Sir Hamza
          day_of_week: 'monday',
          start_time: '09:00', // overlaps with 08:30-09:45
          end_time: '10:15',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('COLLISION_ERROR');
      expect(body.error.message).toContain('Batch collision');
    });

    it('blocks teacher collision when teacher is already booked with another batch', async () => {
      // Sir Tariq ('a1000000-0000-0000-0000-000000000002') has slot Monday 08:30-09:45
      // Attempt to schedule him for FSc Morning Alpha ('a3000000-0000-0000-0000-000000000002') at same time
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/timetable/timetable',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          batch_id: 'a3000000-0000-0000-0000-000000000002', // Different batch
          subject_id: 's1', // Physics
          teacher_id: 'a1000000-0000-0000-0000-000000000002', // Same teacher (Sir Tariq)
          day_of_week: 'monday',
          start_time: '08:45', // overlaps with 08:30-09:45
          end_time: '09:30',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('COLLISION_ERROR');
      expect(body.error.message).toContain('Teacher collision');
    });

    it('successfully schedules slot when no collision exists', async () => {
      // Schedule Chemistry for Batch 2026-A on Tuesday 09:00-10:15
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/timetable/timetable',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          batch_id: 'a3000000-0000-0000-0000-000000000001',
          subject_id: 's2',
          teacher_id: 'a1000000-0000-0000-0000-000000000003', // Sir Hamza
          day_of_week: 'tuesday',
          start_time: '09:00',
          end_time: '10:15',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.day_of_week).toBe('tuesday');
    });

    it('allows pre-flight collision check before saving', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/timetable/timetable/check-collision',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          batchId: 'a3000000-0000-0000-0000-000000000001',
          teacherId: 'a1000000-0000-0000-0000-000000000002',
          dayOfWeek: 'monday',
          startTime: '08:30',
          endTime: '09:45',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.has_conflict).toBe(true);
      expect(body.data.conflict_type).toBe('batch_conflict');
    });

    it('successfully assigns a substitute teacher to an existing slot', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/timetable/timetable/slot-1/substitute',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          substitute_teacher_id: 'a1000000-0000-0000-0000-000000000003', // Sir Hamza
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.substitute_teacher_id).toBe('a1000000-0000-0000-0000-000000000003');
      expect(body.data.substitute_teacher_name).toBe('Sir Hamza Math');
    });
  });

  // =========================================================================
  // 2. STUDENT ATTENDANCE & LEAVES
  // =========================================================================
  describe('Module 6: Student Attendance & Leaves', () => {
    it('records rapid batch attendance for enrolled students', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/attendance/students/batch',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          batch_id: 'a3000000-0000-0000-0000-000000000001',
          date: today,
          records: [
            { student_id: 'stud-1', status: 'present', remarks: 'On time' },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data[0].status).toBe('present');
      expect(body.data[0].student_name).toBe('Muhammad Ali Raza');
    });

    it('auto-excuses student attendance when leave application is approved', async () => {
      const today = new Date().toISOString().split('T')[0];
      const nextDay = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      // 1. Submit leave
      const leaveRes = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/leaves',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          student_id: 'stud-1',
          start_date: today,
          end_date: nextDay,
          category: 'medical',
          reason: 'Severe fever and medical rest prescribed by physician.',
        },
      });

      expect(leaveRes.statusCode).toBe(201);
      const leave = leaveRes.json().data;
      expect(leave.status).toBe('pending');

      // 2. Approve leave
      const reviewRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/attendance/leaves/${leave.id}/review`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          status: 'approved',
          review_notes: 'Medical certificate verified and accepted.',
        },
      });

      expect(reviewRes.statusCode).toBe(200);
      expect(reviewRes.json().data.status).toBe('approved');

      // 3. Mark batch attendance - student should now be auto-excused
      const attRes = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/attendance/students/batch',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          batch_id: 'a3000000-0000-0000-0000-000000000001',
          date: today,
          records: [
            { student_id: 'stud-1', status: 'absent' }, // Marked absent by teacher
          ],
        },
      });

      expect(attRes.statusCode).toBe(201);
      const records = attRes.json().data;
      expect(records[0].status).toBe('excused');
      expect(records[0].remarks).toContain('Auto-Excused');
    });
  });

  // =========================================================================
  // 3. CAMPUS GEOFENCE & STAFF ATTENDANCE
  // =========================================================================
  describe('Module 13: Campus Geofence & Staff Attendance', () => {
    it('retrieves campus geofence settings', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/geofence/geofence/config',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const config = res.json().data;
      expect(config.campus_name).toBe('Gulberg III Campus');
      expect(config.latitude).toBeCloseTo(31.5204);
      expect(config.longitude).toBeCloseTo(74.3587);
      expect(config.radius_meters).toBe(150);
    });

    it('successfully clocks in when within campus geofence boundary (<= 150m)', async () => {
      // Gulberg III Campus is at (31.5204, 74.3587). Clock in very close (e.g. 31.52045, 74.35872, approx 6m away)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/geofence/attendance/staff/clock-in',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          latitude: 31.52045,
          longitude: 74.35872,
        },
      });

      expect(res.statusCode).toBe(201);
      const record = res.json().data;
      expect(record.is_geofence_verified).toBe(true);
      expect(record.distance_meters).toBeLessThanOrEqual(150);
      expect(['on_time', 'late']).toContain(record.status);
    });

    it('rejects staff clock-in when outside campus boundary (> 150m)', async () => {
      // Provide coordinates in another district (~10 km away)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/geofence/attendance/staff/clock-in',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          latitude: 31.6000,
          longitude: 74.4500,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('GEOFENCE_REJECTED');
      expect(body.error.message).toContain('Outside campus boundary');
    });

    it('allows administrator to adjust staff attendance record with audit trail', async () => {
      // First get existing staff attendance
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/geofence/attendance/staff',
        headers: { authorization: `Bearer ${token}` },
      });

      const records = listRes.json().data;
      expect(records.length).toBeGreaterThan(0);
      const recordId = records[0].id;

      // Adjust record
      const adjustRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/geofence/attendance/staff/${recordId}/adjust`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          status: 'on_time',
          notes: 'Biometric device synchronization adjustment approved by Principal.',
        },
      });

      expect(adjustRes.statusCode).toBe(200);
      const updated = adjustRes.json().data;
      expect(updated.status).toBe('on_time');
      expect(updated.admin_adjusted).toBe(true);
      expect(updated.admin_adjustment_notes).toContain('Biometric device');
    });
  });

  // =========================================================================
  // 4. HOMEWORK & PHYSICAL NOTEBOOK CHECKING
  // =========================================================================
  describe('Module 9: Homework Diary & Physical Notebook Checking', () => {
    it('creates homework assignment with physical checking instructions', async () => {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/homework/homework',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          batch_id: 'a3000000-0000-0000-0000-000000000001',
          subject_id: 's1',
          title: 'Rotational Motion Conceptual Questions',
          description: 'Answer questions 1-5 in physical notebook. Strict verification in tomorrow class.',
          assigned_date: today,
          due_date: tomorrow,
        },
      });

      expect(res.statusCode).toBe(201);
      const hw = res.json().data;
      expect(hw.id).toBeDefined();
      expect(hw.title).toContain('Rotational Motion');
    });

    it('records physical notebook check records with done/incomplete/missing statuses', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/homework/homework/hw-1/checks',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          checks: [
            { student_id: 'stud-1', status: 'done', remarks: 'Neat diagrams and complete solutions' },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const checks = res.json().data;
      expect(checks[0].status).toBe('done');
      expect(checks[0].student_name).toBe('Muhammad Ali Raza');
      expect(checks[0].checked_by).toBe('adnan@apexacademy.edu.pk');
    });
  });

  // =========================================================================
  // 5. COMPLAINTS & FEEDBACK TICKETING
  // =========================================================================
  describe('Complaints & Feedback Ticketing', () => {
    it('creates a complaint ticket and updates its resolution status', async () => {
      // 1. Create ticket
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/complaints/complaints',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          category: 'facility',
          priority: 'high',
          subject: 'Projector resolution in Room 204',
          description: 'The projector in Room 204 flickers when displaying complex slides.',
        },
      });

      expect(createRes.statusCode).toBe(201);
      const ticket = createRes.json().data;
      expect(ticket.status).toBe('open');

      // 2. Resolve ticket
      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/complaints/complaints/${ticket.id}/status`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          status: 'resolved',
          resolution_reply: 'HDMI cable and bulb replaced by IT maintenance team. Verified clear output.',
          internal_notes: 'Replaced with spare brand new gold-plated HDMI cable.',
        },
      });

      expect(updateRes.statusCode).toBe(200);
      const resolved = updateRes.json().data;
      expect(resolved.status).toBe('resolved');
      expect(resolved.resolution_reply).toContain('HDMI cable and bulb replaced');
      expect(resolved.resolved_at).toBeDefined();
    });
  });
});
