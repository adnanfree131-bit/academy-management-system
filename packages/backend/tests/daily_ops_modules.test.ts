import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { campusToday, campusDayOfWeek, campusMinutes, getSundayExcludedWorkingDays } from '../src/lib/campus-date.js';
import { ROLE_DEFAULT_TEMPLATES, can } from '../src/lib/access.js';

describe('Daily Ops Modules: Phase 0 (Persist, campus date, permissions)', () => {
  const tenantId = 'a0000000-0000-0000-0000-000000000001';

  // =========================================================================
  // 1. PERSISTENCE & SNAPSHOT VERIFICATION
  // =========================================================================
  describe('Persistence across restart simulation', () => {
    it('persists complaint, logParentResponse, room, and whatsapp template through snapshotState and applySnapshot', async () => {
      const store1 = new InMemoryDataStore();

      // 1. Create a room
      const room = await store1.createRoom({
        tenant_id: tenantId,
        name: 'Lab 401',
        capacity: 45,
        is_active: true,
      });

      // 2. Create a complaint
      const complaint = await store1.createComplaint({
        tenant_id: tenantId,
        user_id: 'u1',
        user_name: 'Test Staff',
        user_role: 'teacher',
        category: 'academic',
        priority: 'high',
        subject: 'Projector malfunction in Lab 401',
        description: 'Bulb flickers continuously during lectures',
      });

      // 3. Create an absentee followup item and log a parent response
      const followupDate = campusToday('Asia/Karachi');
      await store1.syncDailyAbsenteeRoster(tenantId, followupDate);
      const followups = await store1.getAbsenteeFollowups(tenantId, { date: followupDate });
      
      // If none existed from seed, create one to test logParentResponse
      let targetFollowup = followups[0];
      if (!targetFollowup) {
        store1.absenteeFollowups.push({
          id: 'test-followup-1',
          tenant_id: tenantId,
          student_id: 's1',
          student_name: 'Test Student',
          admission_number: 'ADM-101',
          roll_number: 'R-101',
          guardian_name: 'Parent Name',
          guardian_phone: '+923001234567',
          backup_phone: '+923210000000',
          batch_id: 'batch-1',
          batch_name: 'Batch 10-A',
          date: followupDate,
          consecutive_days: 1,
          call_outcome: null,
          reason_category: null,
          parent_remarks: null,
          expected_return_date: null,
          is_snoozed: false,
          snooze_until: null,
          status: 'PENDING',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        targetFollowup = store1.absenteeFollowups[store1.absenteeFollowups.length - 1];
      }

      const updatedFollowup = await store1.logParentResponse(
        tenantId,
        targetFollowup.id,
        {
          call_outcome: 'CONNECTED',
          reason_category: 'MEDICAL',
          parent_remarks: 'Recovering from viral fever',
          expected_return_date: '2026-09-30',
        },
        'counselor-1'
      );
      expect(updatedFollowup).toBeDefined();
      expect(updatedFollowup?.status).toBe('CONTACTED');

      // 4. Create a WhatsApp template
      const template = await store1.createWhatsAppTemplate(tenantId, {
        title: 'Midterm Reminder',
        category: 'EXAM_RESULT',
        body: 'Dear {guardian_name}, midterm exams begin next week.',
        is_default: false,
      });

      // Simulate restart: serialize store1 state and apply into new store2
      const snapshot = store1.snapshotState();
      const store2 = new InMemoryDataStore();
      store2.applySnapshot(snapshot);

      // Verify Room is still there
      const roomsAfterRestart = await store2.getRooms(tenantId);
      const foundRoom = roomsAfterRestart.find(r => r.id === room.id);
      expect(foundRoom).toBeDefined();
      expect(foundRoom?.name).toBe('Lab 401');

      // Verify Complaint is still there
      const complaintsAfterRestart = await store2.getComplaints(tenantId);
      const foundComplaint = complaintsAfterRestart.find(c => c.id === complaint.id);
      expect(foundComplaint).toBeDefined();
      expect(foundComplaint?.subject).toBe('Projector malfunction in Lab 401');

      // Verify Parent Response is still there
      const followupsAfterRestart = store2.absenteeFollowups.filter(f => f.tenant_id === tenantId);
      const foundFollowup = followupsAfterRestart.find(f => f.id === targetFollowup.id);
      expect(foundFollowup).toBeDefined();
      expect(foundFollowup?.call_outcome).toBe('CONNECTED');
      expect(foundFollowup?.reason_category).toBe('MEDICAL');
      expect(foundFollowup?.parent_remarks).toBe('Recovering from viral fever');
      expect(foundFollowup?.is_snoozed).toBe(true);
      expect(foundFollowup?.snooze_until).toBe('2026-09-30');

      // Verify WhatsApp template is still there
      const templatesAfterRestart = await store2.getWhatsAppTemplates(tenantId);
      const foundTemplate = templatesAfterRestart.find(t => t.id === template.id);
      expect(foundTemplate).toBeDefined();
      expect(foundTemplate?.title).toBe('Midterm Reminder');
    });
  });

  // =========================================================================
  // 2. CAMPUS DATE HELPERS
  // =========================================================================
  describe('Campus Date Helpers', () => {
    it('campusToday at 2026-09-24T20:30:00.000Z (01:30 next day in Karachi) is 2026-09-25', () => {
      // 20:30 UTC on 2026-09-24 is 01:30 (+05:00) on 2026-09-25 in Karachi
      const result = campusToday('Asia/Karachi', '2026-09-24T20:30:00.000Z');
      expect(result).toBe('2026-09-25');

      // Also verify Date instance input
      const dateResult = campusToday('Asia/Karachi', new Date('2026-09-24T20:30:00.000Z'));
      expect(dateResult).toBe('2026-09-25');

      // Also verify when passed as single date argument
      expect(campusToday('2026-09-24T20:30:00.000Z')).toBe('2026-09-25');
      expect(campusToday(new Date('2026-09-24T20:30:00.000Z'))).toBe('2026-09-25');
    });

    it('campusDayOfWeek returns correct civil day without UTC shifting', () => {
      // 2026-09-25 is a Friday
      expect(campusDayOfWeek('2026-09-25', 'Asia/Karachi')).toBe('friday');
      // 2026-09-24 is a Thursday
      expect(campusDayOfWeek('2026-09-24', 'Asia/Karachi')).toBe('thursday');
      // 2026-09-27 is a Sunday
      expect(campusDayOfWeek('2026-09-27', 'Asia/Karachi')).toBe('sunday');
    });

    it('campusMinutes returns minutes from midnight in campus timezone', () => {
      // 20:30 UTC = 01:30 Karachi -> 1 * 60 + 30 = 90
      expect(campusMinutes('2026-09-24T20:30:00.000Z', 'Asia/Karachi')).toBe(90);
      // 03:15 UTC = 08:15 Karachi -> 8 * 60 + 15 = 495
      expect(campusMinutes('2026-09-24T03:15:00.000Z', 'Asia/Karachi')).toBe(495);
    });
  });

  // =========================================================================
  // 3. ROLE DEFAULT TEMPLATES & PERMISSIONS
  // =========================================================================
  describe('ROLE_DEFAULT_TEMPLATES permissions', () => {
    it('academic_head and finance_manager gain staff_attendance: view; teacher does not', () => {
      expect(ROLE_DEFAULT_TEMPLATES.academic_head?.staff_attendance).toBe('view');
      expect(ROLE_DEFAULT_TEMPLATES.finance_manager?.staff_attendance).toBe('view');
      expect(ROLE_DEFAULT_TEMPLATES.teacher?.staff_attendance).toBeUndefined();
    });
  });

  // =========================================================================
  // 4. STAFF ATTENDANCE /ME ENDPOINT & ZERO-SLOP OVERVIEW
  // =========================================================================
  describe('Staff attendance /me endpoint and teacher overview', () => {
    let app: FastifyInstance;
    let store: InMemoryDataStore;
    let teacherToken: string;
    let studentToken: string;
    let parentToken: string;

    const teacherUserId = 'a1000000-0000-0000-0000-000000000002'; // Tariq Mahmood

    beforeAll(async () => {
      store = new InMemoryDataStore();
      app = await buildApp({ store });

      teacherToken = app.jwt.sign({
        sub: teacherUserId,
        user_id: teacherUserId,
        tenant_id: tenantId,
        email: 'tariq.physics@apexacademy.edu.pk',
        role: 'teacher',
      });

      store.users.set('student-user-1', {
        id: 'student-user-1',
        tenant_id: tenantId,
        email: 'student@apexacademy.edu.pk',
        full_name: 'Student Name',
        role: 'student',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      store.users.set('parent-user-1', {
        id: 'parent-user-1',
        tenant_id: tenantId,
        email: 'parent@apexacademy.edu.pk',
        full_name: 'Parent Name',
        role: 'parent',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      studentToken = app.jwt.sign({
        sub: 'student-user-1',
        user_id: 'student-user-1',
        tenant_id: tenantId,
        email: 'student@apexacademy.edu.pk',
        role: 'student',
      });

      parentToken = app.jwt.sign({
        sub: 'parent-user-1',
        user_id: 'parent-user-1',
        tenant_id: tenantId,
        email: 'parent@apexacademy.edu.pk',
        role: 'parent',
      });
    });

    it('teacher without staff_attendance:view can call /me on both single and doubled routes', async () => {
      // 1. Single route
      const res1 = await app.inject({
        method: 'GET',
        url: '/api/v1/geofence/attendance/staff/me',
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(res1.statusCode).toBe(200);
      const body1 = JSON.parse(res1.payload);
      expect(body1.success).toBe(true);

      // 2. Doubled route
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/v1/geofence/geofence/attendance/staff/me',
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(res2.statusCode).toBe(200);
      const body2 = JSON.parse(res2.payload);
      expect(body2.success).toBe(true);
    });

    it('returns caller record when attendance exists, null otherwise', async () => {
      const today = campusToday('Asia/Karachi');

      // Record non-existent for today yet
      const res1 = await app.inject({
        method: 'GET',
        url: `/api/v1/geofence/attendance/staff/me?date=${today}`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(res1.statusCode).toBe(200);
      const body1 = JSON.parse(res1.payload);
      expect(body1.data).toBeNull();

      // Punch in within campus perimeter
      const config = await store.getGeofenceConfig(tenantId);
      await store.staffClockIn(tenantId, teacherUserId, 'Sir Tariq', config.latitude, config.longitude);

      // Call /me again
      const res2 = await app.inject({
        method: 'GET',
        url: `/api/v1/geofence/attendance/staff/me?date=${today}`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(res2.statusCode).toBe(200);
      const body2 = JSON.parse(res2.payload);
      expect(body2.data).toBeDefined();
      expect(body2.data.staff_id).toBe(teacherUserId);
      expect(body2.data.clock_in_time).toBeTruthy();
    });

    it('rejects student and parent with 403 FORBIDDEN_ROLE', async () => {
      const resStudent = await app.inject({
        method: 'GET',
        url: '/api/v1/geofence/attendance/staff/me',
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(resStudent.statusCode).toBe(403);

      const resParent = await app.inject({
        method: 'GET',
        url: '/api/v1/geofence/attendance/staff/me',
        headers: { authorization: `Bearer ${parentToken}` },
      });
      expect(resParent.statusCode).toBe(403);
    });

    it('teacher portal overview missing punch returns nulls, no fake defaults', async () => {
      const freshStore = new InMemoryDataStore();
      const overview = await freshStore.getTeacherPortalOverview(tenantId, teacherUserId, '2099-01-01');
      expect(overview.geofence_status.is_clocked_in).toBe(false);
      expect(overview.geofence_status.clocked_in_at).toBeNull();
      expect(overview.geofence_status.distance_meters).toBeNull();
    });
  });

  // =========================================================================
  // 5. PHASE 1: TIMETABLES & COLLISION ENGINE
  // =========================================================================
  describe('Daily Ops Modules: Phase 1 (Timetables & Collision Engine)', () => {
    let app: FastifyInstance;
    let store: InMemoryDataStore;
    let adminToken: string;
    let teacherToken: string;
    const adminUserId = 'a1000000-0000-0000-0000-000000000001';
    const teacherUserId = 'a1000000-0000-0000-0000-000000000002';
    const teacher2UserId = 'a1000000-0000-0000-0000-000000000003';
    let batchId: string;
    let subjectId: string;

    beforeAll(async () => {
      store = new InMemoryDataStore();
      app = await buildApp({ store });

      adminToken = app.jwt.sign({
        sub: adminUserId,
        user_id: adminUserId,
        tenant_id: tenantId,
        email: 'admin@apexacademy.edu.pk',
        role: 'tenant_admin',
      });

      teacherToken = app.jwt.sign({
        sub: teacherUserId,
        user_id: teacherUserId,
        tenant_id: tenantId,
        email: 'tariq.physics@apexacademy.edu.pk',
        role: 'teacher',
      });

      // Ensure teacher2 exists in store
      store.users.set(teacher2UserId, {
        id: teacher2UserId,
        tenant_id: tenantId,
        email: 'teacher2@apexacademy.edu.pk',
        full_name: 'Second Teacher',
        role: 'teacher',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Ensure batch exists - create isolated batch for Phase 1 tests
      const newBatch = await store.createBatch({
        tenant_id: tenantId,
        program_id: 'prog-1',
        name: 'Phase 1 Isolated Batch',
        code: 'P1-ISO',
        shift: 'morning',
        capacity: 40,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        is_active: true,
      });
      batchId = newBatch.id;

      // Ensure subject exists
      const subject = store.subjects.find(s => s.tenant_id === tenantId);
      if (subject) {
        subjectId = subject.id;
      } else {
        const newSub = await store.createSubject({
          tenant_id: tenantId,
          name: 'Physics',
          code: 'PHY-10',
          color: '#3B82F6',
          is_active: true,
        });
        subjectId = newSub.id;
      }
    });

    it('1 & 2: creates 09:00–10:00, rejects second slot 09:30–09:45 for same batch, edit moves first to 11:00–12:00, second then saves', async () => {
      // 1. Create first slot 09:00 - 10:00 on Tuesday
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/timetable/timetable',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          batch_id: batchId,
          subject_id: subjectId,
          teacher_id: teacherUserId,
          day_of_week: 'tuesday',
          start_time: '09:00',
          end_time: '10:00',
        },
      });
      expect(res1.statusCode).toBe(201);
      const body1 = JSON.parse(res1.payload);
      expect(body1.success).toBe(true);
      const slot1Id = body1.data.id;
      expect(body1.data.start_time).toBe('09:00');
      expect(body1.data.end_time).toBe('10:00');

      // Reject second slot 09:30 - 09:45 for the same batch on Tuesday (even with different teacher)
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/timetable/timetable',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          batch_id: batchId,
          subject_id: subjectId,
          teacher_id: teacher2UserId,
          day_of_week: 'tuesday',
          start_time: '09:30',
          end_time: '09:45',
        },
      });
      expect(res2.statusCode).toBe(409);
      const body2 = JSON.parse(res2.payload);
      expect(body2.success).toBe(false);
      expect(body2.error.code).toBe('COLLISION_ERROR');

      // 2. Edit moves the first slot to 11:00 - 12:00
      const editRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/timetable/timetable/${slot1Id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          batch_id: batchId,
          subject_id: subjectId,
          teacher_id: teacherUserId,
          day_of_week: 'tuesday',
          start_time: '11:00',
          end_time: '12:00',
        },
      });
      expect(editRes.statusCode).toBe(200);
      const editBody = JSON.parse(editRes.payload);
      expect(editBody.success).toBe(true);
      expect(editBody.data.start_time).toBe('11:00');
      expect(editBody.data.end_time).toBe('12:00');

      // The second slot (09:30 - 09:45) now saves successfully!
      const res2Retry = await app.inject({
        method: 'POST',
        url: '/api/v1/timetable/timetable',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          batch_id: batchId,
          subject_id: subjectId,
          teacher_id: teacher2UserId,
          day_of_week: 'tuesday',
          start_time: '09:30',
          end_time: '09:45',
        },
      });
      expect(res2Retry.statusCode).toBe(201);
      const body2Retry = JSON.parse(res2Retry.payload);
      expect(body2Retry.success).toBe(true);
    });

    it('3. Teacher overview on a Thursday does not include a Monday slot', async () => {
      // 2026-09-24 is a Thursday
      expect(campusDayOfWeek('2026-09-24', 'Asia/Karachi')).toBe('thursday');
      // 2026-09-28 is a Monday
      expect(campusDayOfWeek('2026-09-28', 'Asia/Karachi')).toBe('monday');

      const thursdayOverview = await store.getTeacherPortalOverview(tenantId, teacherUserId, '2026-09-24');
      expect(thursdayOverview.today_date).toBe('2026-09-24');
      // None of the Monday slots should be in thursday today_schedule
      const mondaySlotsOnThursday = thursdayOverview.today_schedule.filter(s => s.day_of_week === 'monday');
      expect(mondaySlotsOnThursday.length).toBe(0);

      // On Monday (2026-09-28), the Monday slot should be present
      const mondayOverview = await store.getTeacherPortalOverview(tenantId, teacherUserId, '2026-09-28');
      const mondaySlots = mondayOverview.today_schedule.filter(s => s.day_of_week === 'monday');
      expect(mondaySlots.length).toBeGreaterThan(0);
    });

    it('4. Delete returns 404 the second time', async () => {
      // Create a temporary slot to delete
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/timetable/timetable',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          batch_id: batchId,
          subject_id: subjectId,
          teacher_id: teacherUserId,
          day_of_week: 'friday',
          start_time: '14:00',
          end_time: '15:00',
        },
      });
      expect(createRes.statusCode).toBe(201);
      const slotId = JSON.parse(createRes.payload).data.id;

      // First delete succeeds
      const del1 = await app.inject({
        method: 'DELETE',
        url: `/api/v1/timetable/timetable/${slotId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(del1.statusCode).toBe(200);
      expect(JSON.parse(del1.payload).success).toBe(true);

      // Second delete returns 404
      const del2 = await app.inject({
        method: 'DELETE',
        url: `/api/v1/timetable/timetable/${slotId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(del2.statusCode).toBe(404);
      const del2Body = JSON.parse(del2.payload);
      expect(del2Body.success).toBe(false);
      expect(del2Body.error.code).toBe('NOT_FOUND');
    });

    it('Rooms API: PATCH updates room, DELETE returns 409 when slot uses room, 200 after slot removed', async () => {
      // Create a test room
      const createRoomRes = await app.inject({
        method: 'POST',
        url: '/api/v1/timetable/rooms',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Lab 501', capacity: 30, is_active: true },
      });
      expect(createRoomRes.statusCode).toBe(201);
      const roomId = JSON.parse(createRoomRes.payload).data.id;

      // PATCH /rooms/:id on doubled route
      const patchRoomRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/timetable/timetable/rooms/${roomId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Lab 501 (Updated)', capacity: 35 },
      });
      expect(patchRoomRes.statusCode).toBe(200);
      expect(JSON.parse(patchRoomRes.payload).data.name).toBe('Lab 501 (Updated)');
      expect(JSON.parse(patchRoomRes.payload).data.capacity).toBe(35);

      // Create a slot assigned to this room
      const slotWithRoomRes = await app.inject({
        method: 'POST',
        url: '/api/v1/timetable/timetable',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          batch_id: batchId,
          subject_id: subjectId,
          teacher_id: teacherUserId,
          room_id: roomId,
          day_of_week: 'saturday',
          start_time: '10:00',
          end_time: '11:00',
        },
      });
      expect(slotWithRoomRes.statusCode).toBe(201);
      const slotId = JSON.parse(slotWithRoomRes.payload).data.id;

      // DELETE /rooms/:id returns 409 because slot still has room_id
      const delRoomBlocked = await app.inject({
        method: 'DELETE',
        url: `/api/v1/timetable/rooms/${roomId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(delRoomBlocked.statusCode).toBe(409);
      expect(JSON.parse(delRoomBlocked.payload).error.code).toBe('ROOM_IN_USE');

      // Remove slot first
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/timetable/timetable/${slotId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      // Now DELETE /rooms/:id succeeds
      const delRoomSuccess = await app.inject({
        method: 'DELETE',
        url: `/api/v1/timetable/rooms/${roomId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(delRoomSuccess.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // PHASE 2 — ONE STAFF-ATTENDANCE TRUTH, AND PAYROLL READS IT
  // =========================================================================
  describe('Daily Ops Modules: Phase 2 (Staff Attendance Truth & Payroll)', () => {
    let app: FastifyInstance;
    let store: InMemoryDataStore;
    let adminToken: string;
    let teacherToken: string;
    const teacherUserId = 'a1000000-0000-0000-0000-000000000002'; // Tariq Mahmood

    beforeAll(async () => {
      store = new InMemoryDataStore();
      app = await buildApp({ store });

      adminToken = app.jwt.sign({
        sub: 'admin-1',
        user_id: 'admin-1',
        tenant_id: tenantId,
        email: 'admin@apexacademy.edu.pk',
        role: 'tenant_admin',
      });

      teacherToken = app.jwt.sign({
        sub: teacherUserId,
        user_id: teacherUserId,
        tenant_id: tenantId,
        email: 'tariq.physics@apexacademy.edu.pk',
        role: 'teacher',
      });
    });

    it('Finance manager can(user, "staff_attendance", "view") is true on the default template', () => {
      const financeUser = { role: 'finance_manager' };
      expect(can(financeUser as any, 'staff_attendance', 'view')).toBe(true);
      expect(ROLE_DEFAULT_TEMPLATES.finance_manager?.staff_attendance).toBe('view');
    });

    it('clocks a teacher out after 3 hours with a half-day head, monthly summary half_days === 1, generated slip working_days is the Sunday-excluded count, and net pay is base minus half a day', async () => {
      // 1. Configure geofence with heads including an active half-day head (trigger: hours_below 4, paid: false)
      await store.updateGeofenceConfig(tenantId, {
        heads: [
          {
            id: 'head-present',
            name: 'On Time Present',
            code: 'P',
            category: 'present',
            paid: true,
            priority: 1,
            trigger: { type: 'check_in_before', time: '10:00' },
            is_active: true,
          },
          {
            id: 'head-half-day',
            name: 'Half Day Short Shift',
            code: 'HD',
            category: 'half_day',
            paid: false,
            priority: 2,
            trigger: { type: 'hours_below', hours: 4 },
            is_active: true,
          },
          {
            id: 'head-absent',
            name: 'Unexcused Absent',
            code: 'A',
            category: 'absent',
            paid: false,
            priority: 3,
            trigger: { type: 'no_check_in' },
            is_active: true,
          }
        ]
      });

      // 2. Set up base salary profile (e.g. 52,000 PKR)
      const baseSalary = 52000;
      await store.saveStaffSalaryProfile({
        tenant_id: tenantId,
        staff_id: teacherUserId,
        staff_name: 'Tariq Mahmood',
        designation: 'Senior Physics Faculty',
        contract_type: 'fixed_monthly',
        base_amount: baseSalary,
      });

      // 3. Teacher clocks in, then session is clocked out after 3 hours (180 mins)
      const record = await store.staffClockIn(tenantId, teacherUserId, 'Tariq Mahmood', 31.5204, 74.3587);
      expect(record.clock_in_time).toBeTruthy();

      // Backdate the clock-in time to exactly 3 hours ago to simulate 3-hour shift
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      record.clock_in_time = threeHoursAgo;
      if (record.sessions && record.sessions.length > 0) {
        record.sessions[0].in = threeHoursAgo;
      }

      // Clock out
      const outRecord = await store.staffClockOut(tenantId, teacherUserId, 31.5204, 74.3587);
      expect(outRecord.status).toBe('half_day');
      expect(outRecord.head_id).toBe('head-half-day');
      expect(outRecord.work_duration_minutes).toBe(180);

      // 4. Monthly summary for current month
      const currentMonth = campusToday().slice(0, 7);
      const summaries = await store.getStaffMonthlySummary(tenantId, currentMonth);
      const teacherSummary = summaries.find(s => s.staff_id === teacherUserId);
      expect(teacherSummary).toBeDefined();
      expect(teacherSummary?.half_days).toBe(1);

      // 5. Generate payslip
      const slip = await store.generatePayslip(tenantId, {
        staff_id: teacherUserId,
        payroll_month: currentMonth,
        earnings: [],
        deductions: [],
        processed_by: 'finance-manager',
      });

      const sundayExcludedCount = getSundayExcludedWorkingDays(currentMonth);
      expect(slip.attendance_summary.working_days).toBe(sundayExcludedCount);
      expect(teacherSummary?.total_working_days).toBe(sundayExcludedCount);

      // Net pay is base minus half a day: base - 0.5 * (base / working_days)
      const halfDayRate = (baseSalary / sundayExcludedCount) * 0.5;
      const expectedNetSalary = baseSalary - halfDayRate;
      expect(slip.net_salary).toBeCloseTo(expectedNetSalary, 2);

      const attDeduction = slip.deductions.find(d => d.name === 'Attendance deduction');
      expect(attDeduction).toBeDefined();
      expect(attDeduction?.quantity).toBe(0.5);
    });

    it('approves a 2-day casual leave and casual_used increases by 2; rejects approval if leave exceeds balance', async () => {
      // 1. Ensure staff user exists with fresh leave_balance
      const user = await store.getUserByEmail(tenantId, 'tariq.physics@apexacademy.edu.pk');
      expect(user).toBeDefined();
      if (user) {
        if (!user.metadata) user.metadata = {};
        user.metadata.leave_balance = {
          casual_allowed: 12,
          casual_used: 0,
          sick_allowed: 8,
          sick_used: 0,
          annual_allowed: 10,
          annual_used: 0,
        };
      }

      // 2. Submit a 2-day casual leave (Thursday 2026-09-17 to Friday 2026-09-18)
      const leave = await store.submitStaffLeave({
        tenant_id: tenantId,
        staff_id: teacherUserId,
        start_date: '2026-09-17',
        end_date: '2026-09-18',
        category: 'casual',
        reason: 'Casual leave for domestic matters',
      });

      // 3. Approve the leave
      await store.reviewStaffLeave(tenantId, leave.id, 'approved', 'Leave approved by Academic Head', 'academic-head-1');

      // 4. Verify casual_used increases by 2
      const updatedUser = await store.getUserById(tenantId, teacherUserId);
      expect(updatedUser?.metadata?.leave_balance?.casual_used).toBe(2);

      // 5. Verify attendance records written for both non-Sunday dates
      const att1 = store.staffAttendance.find(a => a.tenant_id === tenantId && a.staff_id === teacherUserId && a.date === '2026-09-17');
      const att2 = store.staffAttendance.find(a => a.tenant_id === tenantId && a.staff_id === teacherUserId && a.date === '2026-09-18');
      expect(att1?.status).toBe('on_leave');
      expect(att1?.verification_mode).toBe('manual_regularization');
      expect(att1?.admin_adjusted).toBe(true);
      expect(att2?.status).toBe('on_leave');
      expect(att2?.verification_mode).toBe('manual_regularization');
      expect(att2?.admin_adjusted).toBe(true);

      // 6. Test INSUFFICIENT_LEAVE rejection:
      // Try to approve a leave that exceeds allowed balance (10 remaining, request 15 days)
      const excessLeave = await store.submitStaffLeave({
        tenant_id: tenantId,
        staff_id: teacherUserId,
        start_date: '2026-10-01',
        end_date: '2026-10-17', // > 10 non-Sunday days
        category: 'casual',
        reason: 'Casual extended travel',
      });

      await expect(
        store.reviewStaffLeave(tenantId, excessLeave.id, 'approved', 'Approved', 'academic-head-1')
      ).rejects.toThrow('INSUFFICIENT_LEAVE');
    });

    it('second clock-in while first session is still open returns existing record with already_open: true', async () => {
      // Create a fresh teacher for isolated clock-in testing
      const staffUser = await store.createStaff({
        tenant_id: tenantId,
        full_name: 'Farhan Ali',
        email: 'farhan.ali@apexacademy.edu.pk',
        department: 'Science',
        designation: 'Chemistry Lecturer',
      });

      const staffToken = app.jwt.sign({
        sub: staffUser.id,
        user_id: staffUser.id,
        tenant_id: tenantId,
        email: 'farhan.ali@apexacademy.edu.pk',
        role: 'teacher',
      });

      // 1. First Clock-In
      const firstPunch = await app.inject({
        method: 'POST',
        url: '/api/v1/geofence/attendance/staff/clock-in',
        headers: { authorization: `Bearer ${staffToken}` },
        payload: { latitude: 31.5204, longitude: 74.3587 },
      });
      expect(firstPunch.statusCode).toBe(201);
      const firstData = JSON.parse(firstPunch.payload);
      expect(firstData.success).toBe(true);
      const originalClockInTime = firstData.data.clock_in_time;
      expect(originalClockInTime).toBeTruthy();

      // 2. Second Clock-In while session is still open
      const secondPunch = await app.inject({
        method: 'POST',
        url: '/api/v1/geofence/attendance/staff/clock-in',
        headers: { authorization: `Bearer ${staffToken}` },
        payload: { latitude: 31.5204, longitude: 74.3587 },
      });
      expect([200, 201]).toContain(secondPunch.statusCode);
      const secondData = JSON.parse(secondPunch.payload);
      expect(secondData.success).toBe(true);
      expect(secondData.already_open).toBe(true);
      expect(secondData.data.already_open).toBe(true);
      expect(secondData.data.clock_in_time).toBe(originalClockInTime);
    });

    it('reviewStaffRegularizationRequest approval sets status from chosen head rather than hardcoding on_time', async () => {
      const regTeacherId = 'a1000000-0000-0000-0000-000000000002';

      // Submit regularization request
      const req = await store.submitStaffRegularizationRequest(tenantId, {
        staff_id: regTeacherId,
        staff_name: 'Tariq Mahmood',
        date: '2026-09-10',
        clock_in_time: '2026-09-10T09:30:00.000Z',
        clock_out_time: '2026-09-10T13:30:00.000Z',
        reason_type: 'device_battery',
        notes: 'Phone died during morning biometric sync',
      });

      // Approve with half-day head
      const reviewed = await store.reviewStaffRegularizationRequest(
        tenantId,
        req.id,
        'approved',
        'admin-1',
        'Approved by admin',
        'head-half-day'
      );
      expect(reviewed.status).toBe('approved');

      // Check attendance record created for that date: status must be 'half_day', NOT hardcoded 'on_time'
      const attRecord = store.staffAttendance.find(a => a.tenant_id === tenantId && a.staff_id === regTeacherId && a.date === '2026-09-10');
      expect(attRecord).toBeDefined();
      expect(attRecord?.status).toBe('half_day');
      expect(attRecord?.head_id).toBe('head-half-day');
      expect(attRecord?.clock_in_time).toBe('2026-09-10T09:30:00.000Z');
      expect(attRecord?.clock_out_time).toBe('2026-09-10T13:30:00.000Z');
    });

    it('evaluateHead assigns "A" (not "HD") fallback code for absent no_check_in trigger', () => {
      const heads = [
        {
          id: 'head-unmarked-absent',
          name: 'Absent without notice',
          category: 'absent' as const,
          paid: false,
          trigger: { type: 'no_check_in' as const },
        }
      ];

      const evaluated = store.evaluateHead(heads, { isClosedOrPastDate: true });
      expect(evaluated.status).toBe('absent');
      expect(evaluated.head_code).toBe('A');
    });

    it('reviewStaffLeave is idempotent when approved again and does not double-decrement leave balance', async () => {
      const staffUser = await store.createStaff({
        tenant_id: tenantId,
        full_name: 'Idempotent Teacher',
        email: 'idempotent@apexacademy.edu.pk',
      });
      staffUser.metadata = {
        leave_balance: {
          casual_allowed: 12,
          casual_used: 0,
          sick_allowed: 8,
          sick_used: 0,
          annual_allowed: 10,
          annual_used: 0,
        }
      };

      const leave = await store.submitStaffLeave({
        tenant_id: tenantId,
        staff_id: staffUser.id,
        start_date: '2026-09-21',
        end_date: '2026-09-22',
        category: 'casual',
        reason: 'Casual leave for appointment',
      });

      await store.reviewStaffLeave(tenantId, leave.id, 'approved', 'Approved', 'admin-1');
      expect((staffUser.metadata.leave_balance as any).casual_used).toBe(2);

      // Re-approving must be idempotent
      await store.reviewStaffLeave(tenantId, leave.id, 'approved', 'Re-approved', 'admin-1');
      expect((staffUser.metadata.leave_balance as any).casual_used).toBe(2);
    });

    it('clock-in and clock-out on a date with pre-approved leave updates the record in-place without duplicate rows', async () => {
      const today = campusToday();
      const staffUser = await store.createStaff({
        tenant_id: tenantId,
        full_name: 'Present On Leave Day Teacher',
        email: 'present.leave@apexacademy.edu.pk',
      });

      // 1. Pre-approve leave for today
      const leave = await store.submitStaffLeave({
        tenant_id: tenantId,
        staff_id: staffUser.id,
        start_date: today,
        end_date: today,
        category: 'casual',
        reason: 'Casual leave',
      });
      await store.reviewStaffLeave(tenantId, leave.id, 'approved', 'Approved', 'admin-1');

      const recordsBefore = store.staffAttendance.filter(a => a.tenant_id === tenantId && a.staff_id === staffUser.id && a.date === today);
      expect(recordsBefore.length).toBe(1);
      expect(recordsBefore[0].status).toBe('on_leave');

      // 2. Staff member shows up and clocks in
      const clockedIn = await store.staffClockIn(tenantId, staffUser.id, staffUser.full_name, 31.5204, 74.3587);
      expect(clockedIn.clock_in_time).toBeTruthy();

      const recordsAfterIn = store.staffAttendance.filter(a => a.tenant_id === tenantId && a.staff_id === staffUser.id && a.date === today);
      expect(recordsAfterIn.length).toBe(1); // No duplicate pushed

      // 3. Staff member clocks out
      const clockedOut = await store.staffClockOut(tenantId, staffUser.id, 31.5204, 74.3587);
      expect(clockedOut.clock_out_time).toBeTruthy();

      const recordsAfterOut = store.staffAttendance.filter(a => a.tenant_id === tenantId && a.staff_id === staffUser.id && a.date === today);
      expect(recordsAfterOut.length).toBe(1); // Single unified record
    });

    it('getStaffMonthlySummary aggregates leaves that span across month boundaries', async () => {
      const staffUser = await store.createStaff({
        tenant_id: tenantId,
        full_name: 'Spanning Leave Teacher',
        email: 'spanning.leave@apexacademy.edu.pk',
        joining_date: '2026-08-01',
      });
      staffUser.metadata = {
        leave_balance: {
          casual_allowed: 12,
          casual_used: 0,
          sick_allowed: 8,
          sick_used: 0,
          annual_allowed: 40,
          annual_used: 0,
        }
      };

      // Leave spanning from Aug 25 to Oct 5
      const leave = await store.submitStaffLeave({
        tenant_id: tenantId,
        staff_id: staffUser.id,
        start_date: '2026-08-25',
        end_date: '2026-10-05',
        category: 'annual',
        reason: 'Annual vacation trip',
      });
      await store.reviewStaffLeave(tenantId, leave.id, 'approved', 'Approved', 'admin-1');

      const summaries = await store.getStaffMonthlySummary(tenantId, '2026-09');
      const teacherSummary = summaries.find(s => s.staff_id === staffUser.id);
      expect(teacherSummary).toBeDefined();

      const workingDaysInSep = getSundayExcludedWorkingDays('2026-09');
      // All working days of September should be recognized as leave days
      expect(teacherSummary?.leave_days).toBe(workingDaysInSep);
      expect(teacherSummary?.absent_days).toBe(0);
    });

    it('evaluates late_penalty_rule options: deduct_half_day_salary, deduct_full_day_salary, and deduct_casual_leave', async () => {
      const penaltyTeacher = await store.createStaff({
        tenant_id: tenantId,
        full_name: 'Penalty Test Faculty',
        email: 'penalty.faculty@apexacademy.edu.pk',
        joining_date: '2026-08-01',
      });

      const baseSalary = 52000;
      await store.saveStaffSalaryProfile({
        tenant_id: tenantId,
        staff_id: penaltyTeacher.id,
        staff_name: 'Penalty Test Faculty',
        designation: 'Faculty Member',
        contract_type: 'fixed_monthly',
        base_amount: baseSalary,
      });

      // Simulate 6 late punches in 2026-09 (2 groups of 3)
      for (let day = 1; day <= 6; day++) {
        const dStr = `2026-09-${String(day).padStart(2, '0')}`;
        await store.manualStaffAttendance(tenantId, {
          staff_id: penaltyTeacher.id,
          date: dStr,
          status: 'late',
          reason: 'Traffic jam',
        });
      }

      const workingDays = getSundayExcludedWorkingDays('2026-09');
      const perDayRate = baseSalary / workingDays;

      // 1. deduct_half_day_salary: 2 groups * 0.5 = 1.0 day deduction
      await store.updateGeofenceConfig(tenantId, {
        late_penalty_rule: 'deduct_half_day_salary',
        lates_for_leave_deduction: 3,
      });
      const slipHalfDay = await store.generatePayslip(tenantId, {
        staff_id: penaltyTeacher.id,
        payroll_month: '2026-09',
        earnings: [],
        deductions: [],
        processed_by: 'finance-manager',
      });
      const dedHalf = slipHalfDay.deductions.find(d => d.name === 'Attendance deduction');
      expect(dedHalf).toBeDefined();
      expect(dedHalf?.quantity).toBe(1.0); // 2 * 0.5
      expect(slipHalfDay.net_salary).toBeCloseTo(baseSalary - 1.0 * perDayRate, 2);

      // Clean up payslips for next sub-tests
      store.staffPayslips = store.staffPayslips.filter(p => p.id !== slipHalfDay.id);

      // 2. deduct_full_day_salary: 2 groups * 1.0 = 2.0 days deduction
      await store.updateGeofenceConfig(tenantId, {
        late_penalty_rule: 'deduct_full_day_salary',
        lates_for_leave_deduction: 3,
      });
      const slipFullDay = await store.generatePayslip(tenantId, {
        staff_id: penaltyTeacher.id,
        payroll_month: '2026-09',
        earnings: [],
        deductions: [],
        processed_by: 'finance-manager',
      });
      const dedFull = slipFullDay.deductions.find(d => d.name === 'Attendance deduction');
      expect(dedFull).toBeDefined();
      expect(dedFull?.quantity).toBe(2.0); // 2 * 1.0
      expect(slipFullDay.net_salary).toBeCloseTo(baseSalary - 2.0 * perDayRate, 2);

      store.staffPayslips = store.staffPayslips.filter(p => p.id !== slipFullDay.id);

      // 3. deduct_casual_leave: 2 groups of lates
      // Initial casual balance: 12 allowed, 11 used -> 1 remaining.
      // 1 group deducted from casual (used becomes 12), remaining 1 group becomes 1.0 unpaid day salary deduction!
      penaltyTeacher.metadata = {
        leave_balance: {
          casual_allowed: 12,
          casual_used: 11,
          sick_allowed: 8,
          sick_used: 0,
          annual_allowed: 10,
          annual_used: 0,
        }
      };

      await store.updateGeofenceConfig(tenantId, {
        late_penalty_rule: 'deduct_casual_leave',
        lates_for_leave_deduction: 3,
      });
      const slipCasual = await store.generatePayslip(tenantId, {
        staff_id: penaltyTeacher.id,
        payroll_month: '2026-09',
        earnings: [],
        deductions: [],
        processed_by: 'finance-manager',
      });

      // casual_used should have incremented by 1 (to 12, exhausting balance)
      expect((penaltyTeacher.metadata.leave_balance as any).casual_used).toBe(12);

      // The leftover 1 group became 1 unpaid day
      const dedCasual = slipCasual.deductions.find(d => d.name === 'Attendance deduction');
      expect(dedCasual).toBeDefined();
      expect(dedCasual?.quantity).toBe(1.0);
      expect(slipCasual.net_salary).toBeCloseTo(baseSalary - 1.0 * perDayRate, 2);
    });
  });

  // =========================================================================
  // PHASE 3 — ABSENCE FOLLOW-UP USES THE REAL STUDENT
  // =========================================================================
  describe('Daily Ops Modules: Phase 3 (Absence follow-up uses the real student)', () => {
    let app: FastifyInstance;
    let store: InMemoryDataStore;
    let adminToken: string;
    const adminUserId = 'a1000000-0000-0000-0000-000000000001';

    beforeAll(async () => {
      store = new InMemoryDataStore();
      app = await buildApp({ store });

      adminToken = app.jwt.sign({
        sub: adminUserId,
        user_id: adminUserId,
        tenant_id: tenantId,
        email: 'admin@apexacademy.edu.pk',
        role: 'tenant_admin',
      });
    });

    it('marks a second-class enrollment absent: follow-up batch is the evening class, phone is real phone, backup is null', async () => {
      // Student stud-1 has primary batch batchA ("Batch 2026-A")
      // Create a second enrollment for stud-1 in an evening batch
      const eveningBatch = await store.createBatch({
        tenant_id: tenantId,
        program_id: store.programs.find(p => p.tenant_id === tenantId)!.id,
        name: 'Class 10 - Evening Session',
        shift: 'evening',
        start_time: '03:00 PM',
        end_time: '06:00 PM',
        fee_amount: 8000,
        max_capacity: 35,
      });

      const secondEnrollment = await store.createStudentEnrollment(tenantId, 'stud-1', {
        batch_id: eveningBatch.id,
        roll_number: 'EV-202',
      });
      expect(secondEnrollment.id).toBeDefined();

      const testDate = '2026-10-01';
      // Mark student absent specifically in the second (evening) batch
      await store.recordBatchAttendance(tenantId, eveningBatch.id, testDate, [
        {
          student_id: 'stud-1',
          status: 'absent',
          remarks: 'Uninformed absence in evening session',
        }
      ]);

      // Sync daily absentee roster for this date
      const followups = await store.syncDailyAbsenteeRoster(tenantId, testDate);
      const targetFollowup = followups.find(f => f.student_id === 'stud-1' && f.batch_id === eveningBatch.id);

      expect(targetFollowup).toBeDefined();
      expect(targetFollowup?.batch_id).toBe(eveningBatch.id);
      expect(targetFollowup?.batch_name).toBe(eveningBatch.name);
      expect(targetFollowup?.roll_number).toBe('EV-202');
      expect(targetFollowup?.guardian_phone).toBe('+923009876543');
      // guardian_whatsapp in seed for stud-1 is identical to guardian_phone ('+923009876543') -> backup_phone must be null
      expect(targetFollowup?.backup_phone).toBeNull();
    });

    it('a present the next day then an absent makes consecutive_days === 1', async () => {
      const eveningBatch = store.batches.find(b => b.name === 'Class 10 - Evening Session');
      expect(eveningBatch).toBeDefined();
      const batchBId = eveningBatch!.id;
      
      // Day 1 (2026-10-01) was absent (consecutive = 1)
      // Day 2 (2026-10-02): mark present
      await store.recordBatchAttendance(tenantId, batchBId, '2026-10-02', [
        {
          student_id: 'stud-1',
          status: 'present',
        }
      ]);

      // Day 3 (2026-10-03): mark absent again
      await store.recordBatchAttendance(tenantId, batchBId, '2026-10-03', [
        {
          student_id: 'stud-1',
          status: 'absent',
        }
      ]);

      const followups = await store.syncDailyAbsenteeRoster(tenantId, '2026-10-03');
      const followupDay3 = followups.find(f => f.student_id === 'stud-1' && f.batch_id === batchBId);

      expect(followupDay3).toBeDefined();
      // The present on Day 2 reset consecutive_days back to 1
      expect(followupDay3?.consecutive_days).toBe(1);
    });

    it('converts to medical leave: creates an approved LeaveApplication and resolves follow-ups', async () => {
      const eveningBatch = store.batches.find(b => b.name === 'Class 10 - Evening Session');
      const batchBId = eveningBatch!.id;
      const followups = await store.getAbsenteeFollowups(tenantId, { date: '2026-10-03', batchId: batchBId, include_snoozed: true });
      const targetFollowup = followups.find(f => f.student_id === 'stud-1' && f.batch_id === batchBId);
      expect(targetFollowup).toBeDefined();

      const updated = await store.logParentResponse(tenantId, targetFollowup!.id, {
        call_outcome: 'CONNECTED',
        reason_category: 'MEDICAL_EMERGENCY',
        parent_remarks: 'Admitted with acute bronchitis',
        convert_to_medical_leave: true,
        expected_return_date: '2026-10-05',
      }, adminUserId);

      expect(updated).toBeDefined();
      expect(updated?.status).toBe('RESOLVED_EXCUSED');

      // Verify approved LeaveApplication was created
      const leave = store.leaveApplications.find(
        l => l.tenant_id === tenantId && l.student_id === 'stud-1' && l.status === 'approved' && l.start_date === '2026-10-03'
      );
      expect(leave).toBeDefined();
      expect(leave?.end_date).toBe('2026-10-05');
      expect(leave?.status).toBe('approved');

      // Verify student attendance on 2026-10-03 became 'excused'
      const attRecord = store.studentAttendance.find(
        a => a.tenant_id === tenantId && a.student_id === 'stud-1' && a.batch_id === batchBId && a.date === '2026-10-03'
      );
      expect(attRecord?.status).toBe('excused');
    });

    it('snapshot round-trip retains call log, status, and medical leaves', async () => {
      const snapshot = store.snapshotState();
      const newStore = new InMemoryDataStore();
      newStore.applySnapshot(snapshot);

      const restoredFollowup = newStore.absenteeFollowups.find(
        f => f.tenant_id === tenantId && f.student_id === 'stud-1' && f.date === '2026-10-03'
      );
      expect(restoredFollowup).toBeDefined();
      expect(restoredFollowup?.status).toBe('RESOLVED_EXCUSED');
      expect(restoredFollowup?.call_outcome).toBe('CONNECTED');
      expect(restoredFollowup?.reason_category).toBe('MEDICAL_EMERGENCY');

      const restoredLeave = newStore.leaveApplications.find(
        l => l.tenant_id === tenantId && l.student_id === 'stud-1' && l.start_date === '2026-10-03'
      );
      expect(restoredLeave).toBeDefined();
      expect(restoredLeave?.status).toBe('approved');
    });

    it('excludes snoozed rows by default, includes with status=SNOOZED or include_snoozed=1', async () => {
      // Seed item af-2 is snoozed until 2099-12-31
      const defaultList = await store.getAbsenteeFollowups(tenantId, { date: '2026-09-24' });
      expect(defaultList.some(f => f.id === 'af-2')).toBe(false);

      const snoozedList = await store.getAbsenteeFollowups(tenantId, { date: '2026-09-24', status: 'SNOOZED' });
      expect(snoozedList.some(f => f.id === 'af-2')).toBe(true);

      const allIncludedList = await store.getAbsenteeFollowups(tenantId, { date: '2026-09-24', include_snoozed: true });
      expect(allIncludedList.some(f => f.id === 'af-2')).toBe(true);
    });

    it('attaches unpaid_balance from active invoices to follow-up DTO', async () => {
      // Create an invoice for stud-1 with unpaid balance
      await store.generateInvoice(tenantId, {
        student_id: 'stud-1',
        billing_month: '2026-10',
        fee_structure_id: store.feeStructures[0]?.id || 'fs-1',
        issue_date: '2026-10-01',
        due_date: '2026-10-10',
        custom_items: [
          { name: 'Monthly Tuition', amount: 8500 }
        ]
      });

      const followups = await store.getAbsenteeFollowups(tenantId, { date: '2026-10-03', include_snoozed: true });
      const stud1Followup = followups.find(f => f.student_id === 'stud-1');
      expect(stud1Followup).toBeDefined();
      expect(stud1Followup?.unpaid_balance).toBeGreaterThan(0);
    });

    it('syncDailyAbsenteeRoster cleans or revises follow-ups when attendance changes from absent', async () => {
      // Mark student absent on test date 2026-10-15
      const date = '2026-10-15';
      const batchId = 'a3000000-0000-0000-0000-000000000001'; // Batch 2026-A
      await store.recordBatchAttendance(tenantId, batchId, date, [
        { student_id: 'stud-1', status: 'absent' }
      ]);

      let followups = await store.syncDailyAbsenteeRoster(tenantId, date);
      let f = followups.find(item => item.student_id === 'stud-1' && item.date === date);
      expect(f).toBeDefined();
      expect(f?.status).toBe('PENDING');

      // Now change attendance to present without any call logged: row is cleaned/deleted
      await store.recordBatchAttendance(tenantId, batchId, date, [
        { student_id: 'stud-1', status: 'present' }
      ]);

      followups = await store.syncDailyAbsenteeRoster(tenantId, date);
      f = followups.find(item => item.student_id === 'stud-1' && item.date === date);
      expect(f).toBeUndefined();

      // Now test with call logged: re-mark absent, log a call, then change to present
      await store.recordBatchAttendance(tenantId, batchId, date, [
        { student_id: 'stud-1', status: 'absent' }
      ]);
      followups = await store.syncDailyAbsenteeRoster(tenantId, date);
      f = followups.find(item => item.student_id === 'stud-1' && item.date === date);
      expect(f).toBeDefined();

      await store.logParentResponse(tenantId, f!.id, {
        call_outcome: 'CONNECTED',
        reason_category: 'FAMILY_EVENT',
        parent_remarks: 'Attending cousin wedding',
      });

      // Change attendance to present
      await store.recordBatchAttendance(tenantId, batchId, date, [
        { student_id: 'stud-1', status: 'present' }
      ]);

      followups = await store.syncDailyAbsenteeRoster(tenantId, date);
      f = store.absenteeFollowups.find(item => item.student_id === 'stud-1' && item.date === date);
      expect(f).toBeDefined();
      expect(f?.parent_remarks).toContain('Attendance revised to present.');
    });
  });

  // =========================================================================
  // 5. PHASE 4: HOMEWORK AND NOTEBOOK
  // =========================================================================
  describe('Daily Ops Modules: Phase 4 (Homework and notebook)', () => {
    let app: FastifyInstance;
    let store: InMemoryDataStore;
    let adminToken: string;
    let teacherToken: string;
    const batchId = 'a3000000-0000-0000-0000-000000000001'; // Batch 2026-A
    const otherBatchId = 'a3000000-0000-0000-0000-000000000002'; // Batch 2026-B
    const subjectId = 's1';
    const teacherId = 'a1000000-0000-0000-0000-000000000002'; // Tariq Mahmood

    beforeAll(async () => {
      store = new InMemoryDataStore();
      app = await buildApp({ store });

      const teacherObj = {
        id: teacherId,
        tenant_id: tenantId,
        email: 'tariq@apexacademy.edu.pk',
        full_name: 'Sir Tariq Physics',
        role: 'teacher',
        status: 'active' as const,
        metadata: {
          access: { homework: 'edit', classes: 'view' },
          teaching_assignments: [{ batch_id: batchId, subject_id: subjectId, batch_name: 'Batch 2026-A', subject_name: 'Physics' }],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.users.set(`${tenantId}:tariq@apexacademy.edu.pk`, teacherObj);
      store.users.set(teacherId, teacherObj);

      adminToken = app.jwt.sign({
        sub: 'a1000000-0000-0000-0000-000000000001',
        user_id: 'a1000000-0000-0000-0000-000000000001',
        tenant_id: tenantId,
        email: 'adnan@apexacademy.edu.pk',
        role: 'tenant_admin',
      });

      teacherToken = app.jwt.sign({
        sub: teacherId,
        user_id: teacherId,
        tenant_id: tenantId,
        email: 'tariq@apexacademy.edu.pk',
        role: 'teacher',
      });
    });

    // 1. A test patches a title
    it('patches a title; teacher_id stays original author and teacher_name uses user full_name', async () => {
      // Create assignment
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/homework/homework',
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: {
          batch_id: batchId,
          subject_id: subjectId,
          title: 'Initial Assignment Title',
          description: 'Initial instructions for physical checking.',
          assigned_date: '2026-09-24',
          due_date: '2026-09-25',
        },
      });
      expect(createRes.statusCode).toBe(201);
      const created = createRes.json().data;
      expect(created.teacher_id).toBe(teacherId);
      expect(created.teacher_name).toBe('Sir Tariq Physics'); // User full_name, not 'tariq.physics'
      expect(created.teacher_name).not.toContain('@');

      // Admin patches the title
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/homework/${created.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          title: 'Patched Assignment Title: Advanced Vectors',
        },
      });
      expect(patchRes.statusCode).toBe(200);
      const patched = patchRes.json().data;
      expect(patched.title).toBe('Patched Assignment Title: Advanced Vectors');
      expect(patched.teacher_id).toBe(teacherId); // stays original author
      expect(patched.teacher_name).toBe('Sir Tariq Physics');
      expect(patched.batch_name).toBe('Batch 2026-A');
      expect(patched.subject_name).toBe('Physics');

      // Verify on doubled route GET
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/homework/homework?batch_id=${batchId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(getRes.statusCode).toBe(200);
      const found = getRes.json().data.find((h: any) => h.id === created.id);
      expect(found.title).toBe('Patched Assignment Title: Advanced Vectors');
    });

    // 2. Deletes it, sees the assignment and notebook checks gone
    it('deletes assignment and removes its notebook checks completely', async () => {
      // Create assignment
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/homework/homework',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          batch_id: batchId,
          subject_id: subjectId,
          title: 'Assignment To Be Deleted',
          description: 'Checking deletion lifecycle.',
          assigned_date: '2026-09-24',
          due_date: '2026-09-25',
        },
      });
      expect(createRes.statusCode).toBe(201);
      const hwId = createRes.json().data.id;

      // Add a notebook check for stud-1 (who is in batchId)
      const checkRes = await app.inject({
        method: 'POST',
        url: `/api/v1/homework/homework/${hwId}/checks`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          checks: [
            { student_id: 'stud-1', status: 'done', remarks: 'Good work' },
          ],
        },
      });
      expect(checkRes.statusCode).toBe(201);
      const checksBefore = await store.getNotebookChecks(tenantId, hwId);
      expect(checksBefore.length).toBe(1);

      // DELETE the assignment
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/homework/${hwId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(delRes.statusCode).toBe(200);

      // Verify assignment is gone
      const allHw = await store.getHomework(tenantId, batchId);
      expect(allHw.some(h => h.id === hwId)).toBe(false);

      // Verify notebook checks are gone
      const checksAfter = await store.getNotebookChecks(tenantId, hwId);
      expect(checksAfter.length).toBe(0);

      // Subsequent DELETE returns 404
      const secondDel = await app.inject({
        method: 'DELETE',
        url: `/api/v1/homework/homework/${hwId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(secondDel.statusCode).toBe(404);

      // Check submission on non-existent assignment returns 404
      const checkNonExistent = await app.inject({
        method: 'POST',
        url: `/api/v1/homework/homework/${hwId}/checks`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          checks: [{ student_id: 'stud-1', status: 'done' }],
        },
      });
      expect(checkNonExistent.statusCode).toBe(404);
    });

    // 3. Records a check for a student not in the class and gets 400
    it('records a check for a student not in the class and gets 400 STUDENT_NOT_IN_CLASS', async () => {
      // Create assignment for batchId
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/homework',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          batch_id: batchId,
          subject_id: subjectId,
          title: 'Class Specific Homework',
          description: 'Must enforce student enrollment truth.',
          assigned_date: '2026-09-24',
          due_date: '2026-09-25',
        },
      });
      expect(createRes.statusCode).toBe(201);
      const hwId = createRes.json().data.id;

      // Create an outside student enrolled ONLY in otherBatchId
      const outsideStudent = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Outsider Student',
        batch_id: otherBatchId,
        program_id: 'p1',
        admission_number: 'ADM-OUTSIDER-99',
        roll_number: '99',
        status: 'active',
        gender: 'male',
      });

      // Attempt to record notebook check for outsideStudent on assignment for batchId
      const checkRes = await app.inject({
        method: 'POST',
        url: `/api/v1/homework/${hwId}/checks`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          checks: [
            { student_id: outsideStudent.id, status: 'done', remarks: 'Should fail' },
          ],
        },
      });
      expect(checkRes.statusCode).toBe(400);
      const body = checkRes.json();
      expect(body.error.code).toBe('STUDENT_NOT_IN_CLASS');
    });

    // 4. A parent CNIC login receives the child’s class homework without an email on the user
    it('parent CNIC login receives child class homework without email on the user', async () => {
      const parentCnic = '35201-9988776-5';
      const cleanCnic = '3520199887765';

      // Create a student in batchId linked to this parent CNIC
      await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Child Of CNIC Parent',
        batch_id: batchId,
        program_id: 'p1',
        admission_number: 'ADM-CNIC-01',
        roll_number: '01',
        status: 'active',
        gender: 'female',
        guardian_id_card: parentCnic,
      });

      // Create a parent user with NO email
      const parentUserId = 'cnic-parent-user-no-email';
      store.users.set(parentUserId, {
        id: parentUserId,
        tenant_id: tenantId,
        email: '',
        full_name: 'CNIC Only Parent',
        role: 'parent',
        status: 'active',
        metadata: {
          guardian_id_card: parentCnic,
          clean_guardian_id_card: cleanCnic,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Parent signs JWT without email
      const cnicParentToken = app.jwt.sign({
        sub: parentUserId,
        user_id: parentUserId,
        tenant_id: tenantId,
        email: '',
        role: 'parent',
        guardian_id_card: parentCnic,
      });

      // Parent queries homework
      const parentHwRes = await app.inject({
        method: 'GET',
        url: '/api/v1/homework/homework',
        headers: { authorization: `Bearer ${cnicParentToken}` },
      });
      expect(parentHwRes.statusCode).toBe(200);
      const parentData = parentHwRes.json().data;
      expect(Array.isArray(parentData)).toBe(true);
      expect(parentData.length).toBeGreaterThan(0);
      // All returned assignments belong to the child's batch
      expect(parentData.every((h: any) => h.batch_id === batchId)).toBe(true);

      // Parent asking for an unrelated batch gets 403
      const forbiddenBatchRes = await app.inject({
        method: 'GET',
        url: `/api/v1/homework?batch_id=${otherBatchId}`,
        headers: { authorization: `Bearer ${cnicParentToken}` },
      });
      expect(forbiddenBatchRes.statusCode).toBe(403);
      expect(forbiddenBatchRes.json().error.code).toBe('FORBIDDEN');
    });

    // 5. Roster endpoint test
    it('returns active enrolled students via GET /roster without heavy queries', async () => {
      // Pick existing seed assignment hw-1
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/homework/hw-1/roster',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const roster = res.json().data;
      expect(Array.isArray(roster)).toBe(true);
      expect(roster.length).toBeGreaterThan(0);
      const stud1 = roster.find((s: any) => s.id === 'stud-1');
      expect(stud1).toBeDefined();
      expect(stud1.admission_number).toBe('ADM-2026-001');
      expect(stud1.full_name).toBe('Muhammad Ali Raza');
    });

    // 6. Student GET /homework uses student_id without email comparison
    it('student GET /homework uses user.student_id without email comparison and returns primary enrollment batch', async () => {
      // Create student enrolled in batchId
      const studentRecord = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Direct Bound Student',
        batch_id: batchId,
        program_id: 'p1',
        admission_number: 'ADM-STUD-88',
        roll_number: '88',
        status: 'active',
        gender: 'male',
      });

      const studentUserId = 'bound-student-user-id';
      const studentUser = {
        id: studentUserId,
        tenant_id: tenantId,
        email: 'completely-different-email@unknown.com',
        full_name: 'Direct Bound Student',
        role: 'student' as const,
        status: 'active' as const,
        metadata: {
          student_id: studentRecord.id,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.users.set(`${tenantId}:completely-different-email@unknown.com`, studentUser);
      store.users.set(studentUserId, studentUser);

      // Student token has mismatched email, but student_id in JWT
      const boundStudentToken = app.jwt.sign({
        sub: studentUserId,
        user_id: studentUserId,
        student_id: studentRecord.id,
        tenant_id: tenantId,
        email: 'completely-different-email@unknown.com',
        role: 'student',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/homework',
        headers: { authorization: `Bearer ${boundStudentToken}` },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(Array.isArray(data)).toBe(true);
      expect(data.some((h: any) => h.batch_id === batchId)).toBe(true);

      // Student querying a batch they are not enrolled in receives 403
      const forbiddenRes = await app.inject({
        method: 'GET',
        url: `/api/v1/homework?batch_id=${otherBatchId}`,
        headers: { authorization: `Bearer ${boundStudentToken}` },
      });
      expect(forbiddenRes.statusCode).toBe(403);
    });

    // 7. Blocks due_date < assigned_date
    it('rejects create when due_date is before assigned_date with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/homework',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          batch_id: batchId,
          subject_id: subjectId,
          title: 'Invalid Date Assignment',
          description: 'Due before assigned.',
          assigned_date: '2026-09-25',
          due_date: '2026-09-24',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    // 8. Scope check for teacher
    it('enforces batch scope on homework creation and patch', async () => {
      // teacherToken only has batchId, not otherBatchId
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/homework',
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: {
          batch_id: otherBatchId,
          subject_id: subjectId,
          title: 'Out of scope homework',
          description: 'Should be rejected',
          assigned_date: '2026-09-24',
          due_date: '2026-09-25',
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN_BATCH');
    });

    // 9. Rejects withdrawn student in recordNotebookChecks
    it('rejects withdrawn student in recordNotebookChecks with 400 STUDENT_NOT_IN_CLASS', async () => {
      const createHwRes = await app.inject({
        method: 'POST',
        url: '/api/v1/homework/homework',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          batch_id: batchId,
          subject_id: subjectId,
          title: 'Withdrawn Check Homework',
          description: 'Testing inactive enrollment rejection.',
          assigned_date: '2026-09-24',
          due_date: '2026-09-25',
        },
      });
      expect(createHwRes.statusCode).toBe(201);
      const hwId = createHwRes.json().data.id;

      // Create a student in batchId, then set enrollment to withdrawn
      const withdrawnStudent = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Withdrawn Batch Student',
        batch_id: batchId,
        program_id: 'p1',
        admission_number: 'ADM-WITHDRAWN-01',
        roll_number: '77',
        status: 'withdrawn',
        gender: 'female',
      });

      const checkRes = await app.inject({
        method: 'POST',
        url: `/api/v1/homework/homework/${hwId}/checks`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          checks: [{ student_id: withdrawnStudent.id, status: 'done' }],
        },
      });
      expect(checkRes.statusCode).toBe(400);
      expect(checkRes.json().error.code).toBe('STUDENT_NOT_IN_CLASS');
    });

    // 10. getHomeworkRoster includes all active batch students regardless of elective stream
    it('getHomeworkRoster includes all active students in batch without dropping electives', async () => {
      const createHwRes = await app.inject({
        method: 'POST',
        url: '/api/v1/homework/homework',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          batch_id: batchId,
          subject_id: subjectId, // Physics (s1)
          title: 'Core Subject Homework',
          description: 'Roster completeness verification.',
          assigned_date: '2026-09-24',
          due_date: '2026-09-25',
        },
      });
      expect(createHwRes.statusCode).toBe(201);
      const hwId = createHwRes.json().data.id;

      // Create a student in batchId with specific elective subjects not matching s1
      const electiveStudent = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Elective Focus Student',
        batch_id: batchId,
        program_id: 'p1',
        admission_number: 'ADM-ELECTIVE-42',
        roll_number: '42',
        status: 'active',
        gender: 'male',
        subjects: ['other-elective-subject'],
      });

      const rosterRes = await app.inject({
        method: 'GET',
        url: `/api/v1/homework/${hwId}/roster`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(rosterRes.statusCode).toBe(200);
      const roster = rosterRes.json().data;
      expect(roster.some((s: any) => s.id === electiveStudent.id)).toBe(true);
    });

    // 11. PATCH rejects due_date earlier than existing assigned_date
    it('PATCH rejects due_date earlier than existing assigned_date with 400', async () => {
      const createHwRes = await app.inject({
        method: 'POST',
        url: '/api/v1/homework',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          batch_id: batchId,
          subject_id: subjectId,
          title: 'Patch Date Homework',
          description: 'Testing patch due date constraints.',
          assigned_date: '2026-09-24',
          due_date: '2026-09-26',
        },
      });
      expect(createHwRes.statusCode).toBe(201);
      const hwId = createHwRes.json().data.id;

      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/homework/${hwId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          due_date: '2026-09-20', // before assigned_date 2026-09-24
        },
      });
      expect(patchRes.statusCode).toBe(400);
      expect(patchRes.json().error.code).toBe('VALIDATION_ERROR');
    });

    // 12. Author full_name re-evaluation on PATCH
    it('re-evaluates teacher_name on PATCH when author user full_name updates', async () => {
      // Create assignment by teacher
      const createHwRes = await app.inject({
        method: 'POST',
        url: '/api/v1/homework/homework',
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: {
          batch_id: batchId,
          subject_id: subjectId,
          title: 'Author Update Homework',
          description: 'Testing author full_name refresh.',
          assigned_date: '2026-09-24',
          due_date: '2026-09-26',
        },
      });
      expect(createHwRes.statusCode).toBe(201);
      const hwId = createHwRes.json().data.id;
      expect(createHwRes.json().data.teacher_name).toBe('Sir Tariq Physics');

      // Update teacher's full_name in the user directory
      const teacherUser = store.users.get(teacherId);
      if (teacherUser) {
        teacherUser.full_name = 'Prof. Dr. Tariq Physics, Ph.D.';
      }

      // Admin patches the assignment
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/homework/homework/${hwId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          title: 'Author Update Homework (Revised)',
        },
      });
      expect(patchRes.statusCode).toBe(200);
      const patched = patchRes.json().data;
      expect(patched.title).toBe('Author Update Homework (Revised)');
      expect(patched.teacher_id).toBe(teacherId); // stays original author
      expect(patched.teacher_name).toBe('Prof. Dr. Tariq Physics, Ph.D.'); // refreshed from user record
    });
  });

  // =========================================================================
  // 6. PHASE 5: FEEDBACK TICKETS THAT SURVIVE AND STAY PRIVATE
  // =========================================================================
  describe('Daily Ops Modules: Phase 5 (Feedback tickets that survive and stay private)', () => {
    let app: FastifyInstance;
    let store: InMemoryDataStore;
    let tenantId: string;

    let adminToken: string;
    let teacherToken: string;
    let parentToken: string;
    let studentToken: string;

    const parentCnic = '35201-7788990-1';
    let batchId: string;
    let studentId: string;
    let otherStudentId: string;

    beforeAll(async () => {
      store = new InMemoryDataStore();
      app = await buildApp({ store });

      // Seed tenant
      const created = await store.createTenant({
        name: 'Phase 5 Feedback Academy',
        slug: 'p5-acad',
        admin_email: 'director.p5@apex.edu',
        admin_name: 'Director Shah',
      });
      tenantId = created.tenant.id;

      // Batch
      const batch = await store.createBatch({
        tenant_id: tenantId,
        program_id: 'p1',
        name: 'Matric-10th Science',
        shift: 'morning',
        capacity: 40,
        is_active: true,
      });
      batchId = batch.id;

      // Student with guardian_id_card
      const student = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Zainab Ahmed',
        batch_id: batchId,
        program_id: 'p1',
        admission_number: 'ADM-P5-001',
        roll_number: '12',
        status: 'active',
        gender: 'female',
        guardian_name: 'Ahmed Khan',
        guardian_phone: '+923005555555',
        guardian_id_card: parentCnic,
      });
      studentId = student.id;

      // Another unrelated student
      const otherStudent = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Bilal Farooq',
        batch_id: batchId,
        program_id: 'p1',
        admission_number: 'ADM-P5-002',
        roll_number: '13',
        status: 'active',
        gender: 'male',
        guardian_name: 'Farooq Tariq',
        guardian_id_card: '35202-0000000-1',
      });
      otherStudentId = otherStudent.id;

      // 1. Admin token
      adminToken = app.jwt.sign({
        sub: created.admin.id,
        user_id: created.admin.id,
        tenant_id: tenantId,
        role: 'tenant_admin',
        email: created.admin.email,
      });

      // 2. Teacher (view-only complaints in default template)
      const teacherId = 'u-teacher-p5';
      const teacherUser: any = {
        id: teacherId,
        tenant_id: tenantId,
        email: 'teacher.p5@apex.edu',
        full_name: 'Sir Asim Tariq',
        role: 'teacher',
        status: 'active',
        metadata: {
          access: { complaints: 'view' },
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.users.set(`${tenantId}:teacher.p5@apex.edu`, teacherUser);
      store.users.set(teacherId, teacherUser);
      teacherToken = app.jwt.sign({
        sub: teacherId,
        user_id: teacherId,
        tenant_id: tenantId,
        role: 'teacher',
        email: 'teacher.p5@apex.edu',
      });

      // 3. Parent user
      const parentUserId = 'u-parent-p5';
      const parentUser: any = {
        id: parentUserId,
        tenant_id: tenantId,
        email: 'parent.ahmed@apex.edu',
        full_name: 'Ahmed Khan',
        role: 'parent',
        status: 'active',
        metadata: {
          guardian_id_card: parentCnic,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.users.set(`${tenantId}:parent.ahmed@apex.edu`, parentUser);
      store.users.set(parentUserId, parentUser);
      parentToken = app.jwt.sign({
        sub: parentUserId,
        user_id: parentUserId,
        tenant_id: tenantId,
        role: 'parent',
        email: 'parent.ahmed@apex.edu',
        guardian_id_card: parentCnic,
      });

      // 4. Student user
      const studentUserId = 'u-student-p5';
      const studentUser: any = {
        id: studentUserId,
        tenant_id: tenantId,
        email: 'zainab.student@apex.edu',
        full_name: 'Zainab Ahmed',
        role: 'student',
        status: 'active',
        metadata: {
          student_id: studentId,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.users.set(`${tenantId}:zainab.student@apex.edu`, studentUser);
      store.users.set(studentUserId, studentUser);
      studentToken = app.jwt.sign({
        sub: studentUserId,
        user_id: studentUserId,
        tenant_id: tenantId,
        role: 'student',
        email: 'zainab.student@apex.edu',
        student_id: studentId,
      });
    });

    // 1. A parent GET of their ticket has no internal_notes key (and no resolved_by key)
    it('parent GET of their ticket has no internal_notes key (and no resolved_by key)', async () => {
      // Create a ticket for the parent's child
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/complaints/complaints',
        headers: { authorization: `Bearer ${parentToken}` },
        payload: {
          category: 'teaching_quality',
          priority: 'high',
          subject: 'Feedback regarding Chemistry lab equipment',
          description: 'The chemistry lab needs more burettes and pipettes for practical experiments.',
        },
      });
      expect(createRes.statusCode).toBe(201);
      const ticketId = createRes.json().data.id;
      expect(createRes.json().data.student_id).toBe(studentId);

      // Admin resolves the ticket and adds internal notes + resolution reply
      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/complaints/${ticketId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          status: 'resolved',
          resolution_reply: 'New lab equipment has been procured and allocated to the lab.',
          internal_notes: 'CONFIDENTIAL: Vendor invoice #5421 paid from science budget.',
        },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.json().data.resolved_by).toBe('director.p5@apex.edu');

      // Parent GETs their tickets
      const parentGetRes = await app.inject({
        method: 'GET',
        url: '/api/v1/complaints',
        headers: { authorization: `Bearer ${parentToken}` },
      });
      expect(parentGetRes.statusCode).toBe(200);
      const parentTickets = parentGetRes.json().data;
      const foundTicket = parentTickets.find((t: any) => t.id === ticketId);
      expect(foundTicket).toBeDefined();

      // Assert that internal_notes and resolved_by keys are completely absent
      expect('internal_notes' in foundTicket).toBe(false);
      expect(foundTicket.internal_notes).toBeUndefined();
      expect('resolved_by' in foundTicket).toBe(false);
      expect(foundTicket.resolved_by).toBeUndefined();

      // Official resolution reply must be visible to parent
      expect(foundTicket.resolution_reply).toBe('New lab equipment has been procured and allocated to the lab.');
      expect(foundTicket.status).toBe('resolved');

      // Also check doubled GET route /complaints/complaints
      const parentDoubledRes = await app.inject({
        method: 'GET',
        url: '/api/v1/complaints/complaints',
        headers: { authorization: `Bearer ${parentToken}` },
      });
      expect(parentDoubledRes.statusCode).toBe(200);
      const doubledTicket = parentDoubledRes.json().data.find((t: any) => t.id === ticketId);
      expect('internal_notes' in doubledTicket).toBe(false);
      expect('resolved_by' in doubledTicket).toBe(false);

      // Student GET also strips internal_notes and resolved_by
      const studentGetRes = await app.inject({
        method: 'GET',
        url: '/api/v1/complaints',
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(studentGetRes.statusCode).toBe(200);
      const studentTicket = studentGetRes.json().data.find((t: any) => t.id === ticketId);
      expect(studentTicket).toBeDefined();
      expect('internal_notes' in studentTicket).toBe(false);
      expect('resolved_by' in studentTicket).toBe(false);

      // Verify that Admin GET DOES contain internal_notes and resolved_by
      const adminGetRes = await app.inject({
        method: 'GET',
        url: '/api/v1/complaints',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(adminGetRes.statusCode).toBe(200);
      const adminTicket = adminGetRes.json().data.find((t: any) => t.id === ticketId);
      expect(adminTicket.internal_notes).toBe('CONFIDENTIAL: Vendor invoice #5421 paid from science budget.');
      expect(adminTicket.resolved_by).toBe('director.p5@apex.edu');
    });

    // 2. A snapshot round-trip keeps a resolved reply (and updated complaint fields)
    it('snapshot round-trip keeps a resolved reply (and updated complaint fields)', async () => {
      // Create and update a complaint with student and batch fields
      const complaint = await store.createComplaint({
        tenant_id: tenantId,
        user_id: 'u-complainant-snapshot',
        user_name: 'Snapshot Complainant',
        category: 'facility',
        priority: 'urgent',
        subject: 'Campus Water Cooler Filter Replacement',
        description: 'Water filtration cartridge in ground floor corridor requires replacement.',
        student_id: studentId,
        student_name: 'Zainab Ahmed',
        batch_id: batchId,
        batch_name: 'Matric-10th Science',
      });

      // Update with resolution reply, internal notes, and priority modification
      await store.updateComplaintStatus(
        tenantId,
        complaint.id,
        'resolved',
        'Filter cartridge replaced with new 3-stage RO unit.',
        'Maintenance team completed work on Thursday morning.',
        'director.p5@apex.edu',
        { priority: 'normal' }
      );

      // Take store snapshot and apply to new store instance
      const snapshot = store.snapshotState();
      const store2 = new InMemoryDataStore();
      store2.applySnapshot(snapshot);

      // Verify ticket survives in store2 with all resolved and updated fields
      const restoredList = await store2.getComplaints(tenantId);
      const restored = restoredList.find(c => c.id === complaint.id);

      expect(restored).toBeDefined();
      expect(restored?.status).toBe('resolved');
      expect(restored?.resolution_reply).toBe('Filter cartridge replaced with new 3-stage RO unit.');
      expect(restored?.internal_notes).toBe('Maintenance team completed work on Thursday morning.');
      expect(restored?.resolved_by).toBe('director.p5@apex.edu');
      expect(restored?.resolved_at).toBeDefined();
      expect(restored?.priority).toBe('normal');
      expect(restored?.student_id).toBe(studentId);
      expect(restored?.student_name).toBe('Zainab Ahmed');
      expect(restored?.batch_id).toBe(batchId);
      expect(restored?.batch_name).toBe('Matric-10th Science');
    });

    // 3. A teacher with view-only receives 403 on PATCH
    it('teacher with view-only receives 403 on PATCH', async () => {
      // Create an open ticket
      const ticket = await store.createComplaint({
        tenant_id: tenantId,
        user_id: 'u-sample-ticket',
        user_name: 'Concerned Parent',
        category: 'disciplinary',
        priority: 'normal',
        subject: 'Classroom noise issue',
        description: 'Excessive noise from adjacent sports ground during lecture hours.',
      });

      // Teacher attempts PATCH /api/v1/complaints/:id
      const patchRes1 = await app.inject({
        method: 'PATCH',
        url: `/api/v1/complaints/${ticket.id}`,
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: {
          status: 'resolved',
          resolution_reply: 'Teacher attempting to close complaint without edit permission.',
        },
      });
      expect(patchRes1.statusCode).toBe(403);
      expect(patchRes1.json().error.code).toBe('FORBIDDEN_ROLE');

      // Teacher attempts PATCH on doubled route /api/v1/complaints/complaints/:id
      const patchRes2 = await app.inject({
        method: 'PATCH',
        url: `/api/v1/complaints/complaints/${ticket.id}`,
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: {
          status: 'action_taken',
        },
      });
      expect(patchRes2.statusCode).toBe(403);
      expect(patchRes2.json().error.code).toBe('FORBIDDEN_ROLE');

      // Teacher attempts PATCH on :id/status
      const patchRes3 = await app.inject({
        method: 'PATCH',
        url: `/api/v1/complaints/${ticket.id}/status`,
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: {
          status: 'resolved',
        },
      });
      expect(patchRes3.statusCode).toBe(403);
      expect(patchRes3.json().error.code).toBe('FORBIDDEN_ROLE');

      // Admin with complaints edit permission succeeds
      const adminPatch = await app.inject({
        method: 'PATCH',
        url: `/api/v1/complaints/${ticket.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          status: 'under_investigation',
          internal_notes: 'Assigned to head of discipline for inspection.',
        },
      });
      expect(adminPatch.statusCode).toBe(200);
      expect(adminPatch.json().data.status).toBe('under_investigation');
    });

    // 4. Staff create persists student_name and primary batch; rejects non-existent student
    it('staff create copies student_name and primary batch when student_id is sent; rejects invalid student_id', async () => {
      // Create with valid student_id
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/complaints',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          category: 'fee_billing',
          priority: 'normal',
          subject: 'Fee installment arrangement inquiry',
          description: 'Parent requested installment breakdown for term 1 charges.',
          student_id: studentId,
        },
      });
      expect(createRes.statusCode).toBe(201);
      const data = createRes.json().data;
      expect(data.student_id).toBe(studentId);
      expect(data.student_name).toBe('Zainab Ahmed');
      expect(data.batch_id).toBe(batchId);
      expect(data.batch_name).toBe('Matric-10th Science');
      // user_name is full_name from user record, never email prefix
      expect(data.user_name).toBe('Director Shah');

      // Create with non-existent student_id -> 400 STUDENT_NOT_FOUND
      const invalidRes = await app.inject({
        method: 'POST',
        url: '/api/v1/complaints',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          category: 'general',
          priority: 'normal',
          subject: 'General inquiry with invalid student',
          description: 'Testing invalid student handling.',
          student_id: 's-nonexistent-999',
        },
      });
      expect(invalidRes.statusCode).toBe(400);
      expect(invalidRes.json().error.code).toBe('STUDENT_NOT_FOUND');
    });

    // 5. Parent/student ticket creation sets student_id from their child link and ignores body student_id for a different child
    it('parent and student ticket creation sets student_id from child link and ignores body student_id for different child', async () => {
      // Parent sends request with a different child's student_id
      const parentCreateRes = await app.inject({
        method: 'POST',
        url: '/api/v1/complaints',
        headers: { authorization: `Bearer ${parentToken}` },
        payload: {
          category: 'teaching_quality',
          priority: 'normal',
          subject: 'Homework load concern',
          description: 'Excessive weekend homework assignment given on Friday.',
          student_id: otherStudentId, // Not their child!
        },
      });
      expect(parentCreateRes.statusCode).toBe(201);
      const parentTicket = parentCreateRes.json().data;
      // Must ignore otherStudentId and bind their own child Zainab
      expect(parentTicket.student_id).toBe(studentId);
      expect(parentTicket.student_name).toBe('Zainab Ahmed');
      expect(parentTicket.batch_id).toBe(batchId);
      expect(parentTicket.batch_name).toBe('Matric-10th Science');
      expect(parentTicket.user_name).toBe('Ahmed Khan'); // full_name from DB user

      // Student sends request with arbitrary student_id
      const studentCreateRes = await app.inject({
        method: 'POST',
        url: '/api/v1/complaints',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          category: 'facility',
          priority: 'normal',
          subject: 'Library desk lamp broken',
          description: 'Study desk #4 in library has a non-working lamp.',
          student_id: otherStudentId, // Must be ignored
        },
      });
      expect(studentCreateRes.statusCode).toBe(201);
      const studentTicket = studentCreateRes.json().data;
      expect(studentTicket.student_id).toBe(studentId);
      expect(studentTicket.student_name).toBe('Zainab Ahmed');
      expect(studentTicket.user_name).toBe('Zainab Ahmed');
    });

    // 6. Parent with multiple children (Sibling 1 & Sibling 2) selecting Sibling 2 binds Sibling 2
    it('parent with multiple children selecting sibling 2 binds sibling 2 properly', async () => {
      // Create sibling 2 for the same parent (matched via guardian_email or phone)
      const sibling2 = await store.createStudent({
        tenant_id: tenantId,
        full_name: 'Usman Ahmed',
        batch_id: batchId,
        program_id: 'p1',
        admission_number: 'ADM-P5-003',
        roll_number: '14',
        status: 'active',
        gender: 'male',
        guardian_name: 'Ahmed Khan',
        guardian_email: 'parent.ahmed@apex.edu',
        guardian_phone: '+923005555555',
      });

      // Parent creates ticket specifying sibling2.id
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/complaints',
        headers: { authorization: `Bearer ${parentToken}` },
        payload: {
          category: 'fee_billing',
          priority: 'normal',
          subject: 'Fee challan inquiry for Usman',
          description: 'Requesting challan breakdown for Usman Ahmed.',
          student_id: sibling2.id,
        },
      });

      expect(res.statusCode).toBe(201);
      const ticket = res.json().data;
      expect(ticket.student_id).toBe(sibling2.id);
      expect(ticket.student_name).toBe('Usman Ahmed');
    });

    // 7. Non-resolved status updates do not stamp resolved_by; reopening clears resolved_at and resolved_by
    it('status updates to non-resolved do not stamp resolved_by and reopening clears them', async () => {
      // Create ticket
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/complaints',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          category: 'facility',
          priority: 'normal',
          subject: 'Air conditioning unit servicing',
          description: 'Classroom AC unit requires regular servicing.',
        },
      });
      const ticketId = createRes.json().data.id;

      // Update to under_investigation -> resolved_by must NOT be set
      const patchInvestigate = await app.inject({
        method: 'PATCH',
        url: `/api/v1/complaints/${ticketId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { status: 'under_investigation' },
      });
      expect(patchInvestigate.statusCode).toBe(200);
      expect(patchInvestigate.json().data.status).toBe('under_investigation');
      expect(patchInvestigate.json().data.resolved_by).toBeUndefined();
      expect(patchInvestigate.json().data.resolved_at).toBeUndefined();

      // Resolve it -> resolved_by and resolved_at set
      const patchResolve = await app.inject({
        method: 'PATCH',
        url: `/api/v1/complaints/${ticketId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          status: 'resolved',
          resolution_reply: 'AC serviced by HVAC technician.',
        },
      });
      expect(patchResolve.statusCode).toBe(200);
      expect(patchResolve.json().data.status).toBe('resolved');
      expect(patchResolve.json().data.resolved_by).toBe('director.p5@apex.edu');
      expect(patchResolve.json().data.resolved_at).toBeDefined();

      // Reopen to open -> resolved_by and resolved_at must be cleared
      const patchReopen = await app.inject({
        method: 'PATCH',
        url: `/api/v1/complaints/${ticketId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { status: 'open' },
      });
      expect(patchReopen.statusCode).toBe(200);
      expect(patchReopen.json().data.status).toBe('open');
      expect(patchReopen.json().data.resolved_by).toBeUndefined();
      expect(patchReopen.json().data.resolved_at).toBeUndefined();
    });

    // 8. Empty PATCH {} and clearing resolution reply
    it('handles empty PATCH {} cleanly and supports clearing fields with null', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/complaints',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          category: 'general',
          priority: 'normal',
          subject: 'Cafeteria feedback',
          description: 'More healthy snack options requested.',
        },
      });
      const ticketId = createRes.json().data.id;

      // Empty PATCH {}
      const emptyPatch = await app.inject({
        method: 'PATCH',
        url: `/api/v1/complaints/${ticketId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });
      expect(emptyPatch.statusCode).toBe(200);

      // Add resolution reply
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/complaints/${ticketId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { resolution_reply: 'Snack menu updated.' },
      });

      // Clear resolution reply with null
      const clearReply = await app.inject({
        method: 'PATCH',
        url: `/api/v1/complaints/${ticketId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { resolution_reply: null },
      });
      expect(clearReply.statusCode).toBe(200);
      expect(clearReply.json().data.resolution_reply).toBeNull();
    });

    // 9. Single ticket GET routes /:id and /complaints/:id enforce privacy & strip internal notes
    it('single ticket GET routes enforce privacy and strip internal notes for parents/students', async () => {
      // Create ticket for Zainab
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/complaints',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          category: 'teaching_quality',
          priority: 'high',
          subject: 'Private consultation note',
          description: 'Academic performance review requested.',
          student_id: studentId,
        },
      });
      const ticketId = createRes.json().data.id;

      // Admin adds internal notes
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/complaints/${ticketId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          status: 'resolved',
          resolution_reply: 'Consultation scheduled for Monday.',
          internal_notes: 'CONFIDENTIAL: Student needs reinforcement in physics.',
        },
      });

      // Parent GET /api/v1/complaints/:id
      const parentSingle = await app.inject({
        method: 'GET',
        url: `/api/v1/complaints/${ticketId}`,
        headers: { authorization: `Bearer ${parentToken}` },
      });
      expect(parentSingle.statusCode).toBe(200);
      expect('internal_notes' in parentSingle.json().data).toBe(false);
      expect('resolved_by' in parentSingle.json().data).toBe(false);
      expect(parentSingle.json().data.resolution_reply).toBe('Consultation scheduled for Monday.');

      // Doubled route GET /api/v1/complaints/complaints/:id
      const parentDoubledSingle = await app.inject({
        method: 'GET',
        url: `/api/v1/complaints/complaints/${ticketId}`,
        headers: { authorization: `Bearer ${parentToken}` },
      });
      expect(parentDoubledSingle.statusCode).toBe(200);
      expect('internal_notes' in parentDoubledSingle.json().data).toBe(false);

      // Student GET /api/v1/complaints/:id
      const studentSingle = await app.inject({
        method: 'GET',
        url: `/api/v1/complaints/${ticketId}`,
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(studentSingle.statusCode).toBe(200);
      expect('internal_notes' in studentSingle.json().data).toBe(false);

      // Another student trying to access this ticket gets 404
      const otherStudentUser: any = {
        id: 'u-other-student',
        tenant_id: tenantId,
        email: 'other.std@apex.edu',
        role: 'student',
        status: 'active',
        metadata: { student_id: otherStudentId },
      };
      store.users.set('u-other-student', otherStudentUser);
      const otherToken = app.jwt.sign({ sub: 'u-other-student', tenant_id: tenantId, role: 'student', email: 'other.std@apex.edu' });

      const forbiddenSingle = await app.inject({
        method: 'GET',
        url: `/api/v1/complaints/${ticketId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(forbiddenSingle.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // 7. PHASE 6: STAFF DIRECTORY IS THE PERSON THE OTHER DESKS USE
  // =========================================================================
  describe('Daily Ops Modules: Phase 6 (Staff directory is the person the other desks use)', () => {
    let app: FastifyInstance;
    let store: InMemoryDataStore;
    let tenantId: string;

    let adminToken: string;
    let headToken: string;
    let teacherToken: string;
    let headUserId: string;
    let teacherUserId: string;

    beforeAll(async () => {
      store = new InMemoryDataStore();
      app = await buildApp({ store });

      const createdTenant = await store.createTenant({
        name: 'Phase 6 Staff Academy',
        slug: 'p6-staff-acad',
        admin_email: 'director.p6@apex.edu',
        admin_name: 'Director Phase6',
      });
      tenantId = createdTenant.tenant.id;

      // Admin user
      adminToken = app.jwt.sign({
        sub: 'u-p6-admin',
        user_id: 'u-p6-admin',
        tenant_id: tenantId,
        email: 'director.p6@apex.edu',
        role: 'tenant_admin',
      });

      // Academic Head with classes: edit
      headUserId = 'u-p6-head';
      const headUser: any = {
        id: headUserId,
        tenant_id: tenantId,
        email: 'head.p6@apex.edu',
        full_name: 'Academic Head Officer',
        role: 'academic_head',
        status: 'active',
        metadata: {
          access: { classes: 'edit' },
          permissions: ['classes'],
        },
      };
      store.users.set(`${tenantId}:head.p6@apex.edu`, headUser);
      store.users.set(headUserId, headUser);
      headToken = app.jwt.sign({
        sub: headUserId,
        user_id: headUserId,
        tenant_id: tenantId,
        email: 'head.p6@apex.edu',
        role: 'academic_head',
        access: { classes: 'edit' },
      });

      // Regular Teacher with view-only classes
      teacherUserId = 'u-p6-teacher';
      const teacherUser: any = {
        id: teacherUserId,
        tenant_id: tenantId,
        email: 'teacher.p6@apex.edu',
        full_name: 'Regular Teacher Officer',
        role: 'teacher',
        status: 'active',
        metadata: {
          access: { classes: 'view' },
          permissions: [],
        },
      };
      store.users.set(`${tenantId}:teacher.p6@apex.edu`, teacherUser);
      store.users.set(teacherUserId, teacherUser);
      teacherToken = app.jwt.sign({
        sub: teacherUserId,
        user_id: teacherUserId,
        tenant_id: tenantId,
        email: 'teacher.p6@apex.edu',
        role: 'teacher',
        access: { classes: 'view' },
      });
    });

    it('creates a Physics-department teacher and the Teaching Faculty filter includes them on single and doubled routes', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/staff',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Sir Tariq Physics',
          email: 'tariq.physics@phase6.edu',
          department: 'Physics',
          designation: 'Senior Physics Lecturer',
          role: 'teacher',
        },
      });
      expect(createRes.statusCode).toBe(201);
      const created = createRes.json().data;
      expect(created.department).toBe('Physics');
      expect(created.role).toBe('teacher');

      // GET with department=Teaching+Faculty
      const filterRes = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/staff?department=Teaching+Faculty',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(filterRes.statusCode).toBe(200);
      const staffList = filterRes.json().data;
      const found = staffList.find((s: any) => s.id === created.id);
      expect(found).toBeDefined();
      expect(found.full_name).toBe('Sir Tariq Physics');

      // Doubled route
      const doubledRes = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/academic/staff?department=Teaching+Faculty',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(doubledRes.statusCode).toBe(200);
      const doubledList = doubledRes.json().data;
      expect(doubledList.find((s: any) => s.id === created.id)).toBeDefined();
    });

    it('academic head (classes: edit) can GET staff list, while a regular teacher without permissions receives 403', async () => {
      // Academic head on single route
      const headRes = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/staff',
        headers: { authorization: `Bearer ${headToken}` },
      });
      expect(headRes.statusCode).toBe(200);
      expect(headRes.json().success).toBe(true);

      // Academic head on doubled route
      const headDoubledRes = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/academic/staff',
        headers: { authorization: `Bearer ${headToken}` },
      });
      expect(headDoubledRes.statusCode).toBe(200);
      expect(headDoubledRes.json().success).toBe(true);

      // Regular teacher on single route receives 403
      const teacherRes = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/staff',
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(teacherRes.statusCode).toBe(403);
      expect(teacherRes.json().error.code).toBe('FORBIDDEN');

      // Regular teacher on doubled route receives 403
      const teacherDoubledRes = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/academic/staff',
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(teacherDoubledRes.statusCode).toBe(403);
      expect(teacherDoubledRes.json().error.code).toBe('FORBIDDEN');
    });

    it('delete of a teacher who owns a timetable slot returns 409 mentioning timetable', async () => {
      // Create teacher
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/staff',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Professor Timetable Owner',
          email: 'slot.owner@phase6.edu',
          role: 'teacher',
        },
      });
      expect(createRes.statusCode).toBe(201);
      const teacherId = createRes.json().data.id;

      // Assign timetable slot
      store.timetableSlots.push({
        id: 'slot-p6-1',
        tenant_id: tenantId,
        batch_id: 'b-p6-1',
        batch_name: 'Batch P6',
        subject_id: 'sub-p6-1',
        subject_name: 'Calculus',
        teacher_id: teacherId,
        teacher_name: 'Professor Timetable Owner',
        day_of_week: 'monday',
        start_time: '09:00',
        end_time: '10:00',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Attempt DELETE on single route
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/academic/staff/${teacherId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(delRes.statusCode).toBe(409);
      const body = delRes.json();
      expect(body.success).toBe(false);
      expect(body.error.message.toLowerCase()).toContain('timetable');

      // Attempt DELETE on doubled route
      const delDoubledRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/academic/academic/staff/${teacherId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(delDoubledRes.statusCode).toBe(409);
      expect(delDoubledRes.json().error.message.toLowerCase()).toContain('timetable');
    });

    it('delete of a teacher who owns homework returns 409 mentioning homework', async () => {
      // Create teacher
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/staff',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Teacher Homework Owner',
          email: 'hw.owner@phase6.edu',
          role: 'teacher',
        },
      });
      expect(createRes.statusCode).toBe(201);
      const teacherId = createRes.json().data.id;

      // Add homework assignment
      store.homeworkAssignments.push({
        id: 'hw-p6-1',
        tenant_id: tenantId,
        batch_id: 'b-p6-1',
        subject_id: 'sub-p6-1',
        teacher_id: teacherId,
        teacher_name: 'Teacher Homework Owner',
        title: 'Complete Exercise 4.2',
        description: 'Solve questions 1-10',
        assigned_date: '2026-09-24',
        due_date: '2026-09-25',
        status: 'published',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/academic/staff/${teacherId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(delRes.statusCode).toBe(409);
      const body = delRes.json();
      expect(body.success).toBe(false);
      expect(body.error.message.toLowerCase()).toContain('homework');
    });

    it('delete of a staff member who has a payslip returns 409 mentioning payslip', async () => {
      // Create staff
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/staff',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Staff Payslip Owner',
          email: 'payslip.owner@phase6.edu',
          role: 'teacher',
        },
      });
      expect(createRes.statusCode).toBe(201);
      const staffId = createRes.json().data.id;

      // Add payslip
      store.staffPayslips.push({
        id: 'slip-p6-1',
        tenant_id: tenantId,
        staff_id: staffId,
        staff_name: 'Staff Payslip Owner',
        month: '2026-09',
        working_days: 26,
        present_days: 26,
        absent_days: 0,
        late_count: 0,
        approved_leaves: 0,
        hours_or_lectures: 160,
        base_amount: 50000,
        allowances: [],
        deductions: [],
        gross_pay: 50000,
        total_deductions: 0,
        net_pay: 50000,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/academic/staff/${staffId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(delRes.statusCode).toBe(409);
      const body = delRes.json();
      expect(body.success).toBe(false);
      expect(body.error.message.toLowerCase()).toContain('payslip');
    });

    it('role on create wins; department does not change role; default role is teacher', async () => {
      // 1. Specified role: finance_manager, department: Science
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/staff',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Finance Science User',
          email: 'fin.sci@phase6.edu',
          role: 'finance_manager',
          department: 'Science',
        },
      });
      expect(res1.statusCode).toBe(201);
      const s1 = res1.json().data;
      expect(s1.role).toBe('finance_manager');
      expect(s1.department).toBe('Science');

      // 2. Omitted role, department: Administration
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/academic/staff',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          full_name: 'Admin Dept Teacher Default',
          email: 'admin.dept@phase6.edu',
          department: 'Administration',
        },
      });
      expect(res2.statusCode).toBe(201);
      const s2 = res2.json().data;
      expect(s2.role).toBe('teacher');
      expect(s2.department).toBe('Administration');
    });

    it('getAvailableTeachers includes teachers without assignments and excludes tenant_admin without assignment', async () => {
      // Teacher without assignments
      const t1 = await store.createStaff({
        tenant_id: tenantId,
        full_name: 'Unassigned Teacher',
        email: 'unassigned@phase6.edu',
        role: 'teacher',
      });

      // Tenant admin with teaching assignment
      const adminWithAssignment: any = {
        id: 'u-admin-teaching',
        tenant_id: tenantId,
        email: 'admin.teaching@phase6.edu',
        full_name: 'Teaching Admin',
        role: 'tenant_admin',
        status: 'active',
        metadata: {
          teaching_assignments: [{ batch_id: 'b-1', subject_id: 's-1', weekly_periods: 4 }],
        },
      };
      store.users.set(`${tenantId}:admin.teaching@phase6.edu`, adminWithAssignment);
      store.users.set('u-admin-teaching', adminWithAssignment);

      const available = await store.getAvailableTeachers(tenantId, 'monday', '09:00', '10:00');
      const availableIds = available.map(u => u.id);

      // Unassigned teacher appears
      expect(availableIds).toContain(t1.id);
      // Admin with teaching assignment appears
      expect(availableIds).toContain('u-admin-teaching');
      // Admin without teaching assignment (u-p6-admin) does NOT appear
      expect(availableIds).not.toContain('u-p6-admin');
    });

    it('academic head without teaching assignments appears under Administration & Accounts and not Teaching Faculty', async () => {
      // headUser was created with role: 'academic_head' and no teaching assignments
      const tfRes = await app.inject({
        method: 'GET',
        url: '/api/v1/academic/staff?department=Teaching+Faculty',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(tfRes.statusCode).toBe(200);
      const tfList = tfRes.json().data;
      expect(tfList.some((s: any) => s.id === headUserId)).toBe(false);

      const adminRes = await app.inject({
        method: 'GET',
        url: `/api/v1/academic/staff?department=${encodeURIComponent('Administration & Accounts')}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(adminRes.statusCode).toBe(200);
      const adminList = adminRes.json().data;
      expect(adminList.some((s: any) => s.id === headUserId)).toBe(true);
    });

    it('getStaffRoster defaults to campusToday when date argument is omitted', async () => {
      const roster = await store.getStaffRoster(tenantId);
      expect(roster.length).toBeGreaterThan(0);
      const expectedToday = campusToday('Asia/Karachi');
      expect(roster[0].date).toBe(expectedToday);
    });
  });

  describe('Daily Ops Modules: Phase 7 (The other screens that show these records)', () => {
    let app: FastifyInstance;
    let store: InMemoryDataStore;
    const tenantId = 't-phase7-ops';
    let adminToken: string;
    let teacherToken: string;
    let teacherUserId: string;
    let teacherFullName: string;
    let studentToken: string;
    let studentId: string;
    let batch1Id: string;
    let batch2Id: string;

    beforeAll(async () => {
      store = new InMemoryDataStore();
      app = await buildApp({ store });

      // 1. Tenant
      store.tenants.set(tenantId, {
        id: tenantId,
        name: 'Phase 7 Operational Academy',
        subdomain: 'phase7ops',
        status: 'active',
        settings: {
          timezone: 'Asia/Karachi',
          attendance_tracking_mode: 'INSTITUTIONAL_STRICT',
          academic_session: '2026–2027',
        },
        trial_ends_at: new Date(Date.now() + 86400000 * 30).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 2. Admin User
      const adminUser: any = {
        id: 'u-p7-admin',
        tenant_id: tenantId,
        email: 'admin.p7@apex.edu',
        full_name: 'Director Phase7',
        role: 'tenant_admin',
        status: 'active',
      };
      store.users.set(`${tenantId}:admin.p7@apex.edu`, adminUser);
      store.users.set('u-p7-admin', adminUser);
      adminToken = app.jwt.sign({
        sub: 'u-p7-admin',
        user_id: 'u-p7-admin',
        tenant_id: tenantId,
        email: 'admin.p7@apex.edu',
        role: 'tenant_admin',
      });

      batch1Id = 'b-p7-1';

      // 3. Teacher User (Prof. Zainab Bukhari - distinctly NOT Sir Tariq)
      teacherUserId = 'u-p7-teacher-zainab';
      teacherFullName = 'Prof. Zainab Bukhari';
      const teacherUser: any = {
        id: teacherUserId,
        tenant_id: tenantId,
        email: 'zainab.bukhari@apex.edu',
        full_name: teacherFullName,
        role: 'teacher',
        status: 'active',
        metadata: {
          teaching_assignments: [
            { batch_id: batch1Id, subject_id: 'sub-p7-bio', batch_name: 'Batch Med-A', subject_name: 'Biology' }
          ],
        },
      };
      store.users.set(`${tenantId}:zainab.bukhari@apex.edu`, teacherUser);
      store.users.set(teacherUserId, teacherUser);
      teacherToken = app.jwt.sign({
        sub: teacherUserId,
        user_id: teacherUserId,
        tenant_id: tenantId,
        email: 'zainab.bukhari@apex.edu',
        role: 'teacher',
      });

      // 4. Academic Program & Batches
      const programId = 'prog-p7-1';
      store.programs.push({
        id: programId,
        tenant_id: tenantId,
        name: 'Pre-Medical F.Sc',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      batch1Id = 'b-p7-1';
      store.batches.push({
        id: batch1Id,
        tenant_id: tenantId,
        program_id: programId,
        name: 'Batch Med-A',
        shift: 'morning',
        room_number: 'Room 302',
        max_capacity: 40,
        current_enrollment: 1,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      batch2Id = 'b-p7-2';
      store.batches.push({
        id: batch2Id,
        tenant_id: tenantId,
        program_id: programId,
        name: 'Batch Med-B',
        shift: 'evening',
        room_number: null as any,
        max_capacity: 35,
        current_enrollment: 1,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 5. Subject & Room
      const subjectId = 'sub-p7-bio';
      store.subjects.push({
        id: subjectId,
        tenant_id: tenantId,
        program_id: programId,
        name: 'Biology',
        code: 'BIO-101',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const roomId = 'room-p7-bio-lab';
      store.rooms.push({
        id: roomId,
        tenant_id: tenantId,
        name: 'Bio Lab 1',
        capacity: 30,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 6. Student
      studentId = 's-p7-ali';
      store.students.push({
        id: studentId,
        tenant_id: tenantId,
        user_id: 'u-p7-student-ali',
        full_name: 'Ali Raza Khan',
        admission_number: 'ADM-P7-001',
        roll_number: '101',
        batch_id: batch1Id,
        program_id: programId,
        guardian_name: 'Raza Khan',
        guardian_phone: '03001234567',
        status: 'active',
        admission_date: '2026-08-01',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      store.studentEnrollments.push({
        id: 'enr-p7-ali',
        tenant_id: tenantId,
        student_id: studentId,
        program_id: programId,
        batch_id: batch1Id,
        roll_number: '101',
        status: 'active',
        is_primary: true,
        admission_date: '2026-08-01',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const studentUser: any = {
        id: 'u-p7-student-ali',
        tenant_id: tenantId,
        email: 'ali.raza@student.apex.edu',
        full_name: 'Ali Raza Khan',
        role: 'student',
        status: 'active',
      };
      store.users.set(`${tenantId}:ali.raza@student.apex.edu`, studentUser);
      store.users.set('u-p7-student-ali', studentUser);
      studentToken = app.jwt.sign({
        sub: 'u-p7-student-ali',
        user_id: 'u-p7-student-ali',
        tenant_id: tenantId,
        email: 'ali.raza@student.apex.edu',
        role: 'student',
      });
    });

    it('overview schedule returns the period with correct room name / batch room fallback', async () => {
      // 1. Slot with explicit room_id -> 'Bio Lab 1'
      const slot1 = await store.createTimetableSlot({
        tenant_id: tenantId,
        batch_id: batch1Id,
        subject_id: 'sub-p7-bio',
        teacher_id: teacherUserId,
        room_id: 'room-p7-bio-lab',
        day_of_week: 'thursday',
        start_time: '09:00',
        end_time: '10:00',
      });

      // 2. Slot without room_id, batch has room_number 'Room 302' -> 'Room 302'
      const slot2 = await store.createTimetableSlot({
        tenant_id: tenantId,
        batch_id: batch1Id,
        subject_id: 'sub-p7-bio',
        teacher_id: teacherUserId,
        day_of_week: 'monday',
        start_time: '10:00',
        end_time: '11:00',
      });

      // 3. Slot without room_id, batch2 has NO room_number -> 'Room not set'
      const slot3 = await store.createTimetableSlot({
        tenant_id: tenantId,
        batch_id: batch2Id,
        subject_id: 'sub-p7-bio',
        teacher_id: teacherUserId,
        day_of_week: 'thursday',
        start_time: '11:00',
        end_time: '12:00',
      });

      // Query getTimetable
      const slots = await store.getTimetable(tenantId);
      const resSlot1 = slots.find(s => s.id === slot1.id);
      const resSlot2 = slots.find(s => s.id === slot2.id);
      const resSlot3 = slots.find(s => s.id === slot3.id);

      expect(resSlot1?.room_name).toBe('Bio Lab 1');
      expect(resSlot2?.room_name).toBe('Room 302');
      expect(resSlot3?.room_name).toBe('Room not set');

      // Check via /api/v1/timetable route
      const timeRes = await app.inject({
        method: 'GET',
        url: '/api/v1/timetable',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(timeRes.statusCode).toBe(200);
      const apiSlots = timeRes.json().data;
      const apiS1 = apiSlots.find((s: any) => s.id === slot1.id);
      const apiS2 = apiSlots.find((s: any) => s.id === slot2.id);
      const apiS3 = apiSlots.find((s: any) => s.id === slot3.id);
      expect(apiS1?.room_name).toBe('Bio Lab 1');
      expect(apiS2?.room_name).toBe('Room 302');
      expect(apiS3?.room_name).toBe('Room not set');

      // Never Hall A
      expect(apiS1?.room_name).not.toBe('Hall A');
      expect(apiS2?.room_name).not.toBe('Hall A');
      expect(apiS3?.room_name).not.toBe('Hall A');
    });

    it('teacher portal overview returns the real user full_name and does not leak "Sir Tariq" if the teacher\'s name is different', async () => {
      // 2026-09-24 is a Thursday in Asia/Karachi
      const overview = await store.getTeacherPortalOverview(tenantId, teacherUserId, '2026-09-24');

      // Name chip check: returns user full_name
      expect(overview.teacher_name).toBe(teacherFullName);
      expect(overview.teacher_name).toBe('Prof. Zainab Bukhari');
      expect(overview.teacher_name).not.toContain('Sir Tariq');
      expect(overview.teacher_name).not.toContain('Tariq');

      // Thursday overview has 2 Thursday slots (slot1 and slot3), and DOES NOT include Monday slot2
      expect(overview.today_schedule.length).toBe(2);
      expect(overview.today_schedule.some(s => s.day_of_week === 'monday')).toBe(false);
      expect(overview.today_schedule.every(s => s.day_of_week === 'thursday')).toBe(true);

      // Geofence status returns nulls (no fake 08:24 AM or fake 18 meters)
      expect(overview.geofence_status.is_clocked_in).toBe(false);
      expect(overview.geofence_status.clocked_in_at).toBeNull();
      expect(overview.geofence_status.distance_meters).toBeNull();

      // Via API endpoint
      const portalRes = await app.inject({
        method: 'GET',
        url: '/api/v1/portal/teacher?date=2026-09-24',
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(portalRes.statusCode).toBe(200);
      const apiData = portalRes.json().data;
      expect(apiData.teacher_name).toBe('Prof. Zainab Bukhari');
      expect(apiData.today_schedule.length).toBe(2);
      expect(apiData.today_schedule.every((s: any) => s.day_of_week === 'thursday')).toBe(true);
    });

    it('student / parent portal overview respects campus day of week', async () => {
      // Create a homework assignment for batch1
      const hw = await store.createHomework({
        tenant_id: tenantId,
        batch_id: batch1Id,
        subject_id: 'sub-p7-bio',
        teacher_id: teacherUserId,
        title: 'Cell Division Worksheet',
        description: 'Mitosis vs Meiosis diagram checking',
        assigned_date: '2026-09-24',
        due_date: '2026-09-25',
      });

      // 1. Thursday overview: student in batch1 has 1 Thursday slot (slot1)
      const thursdayOverview = await store.getStudentParentPortalOverview(tenantId, studentId, undefined, '2026-09-24');
      expect(thursdayOverview.today_schedule.length).toBe(1);
      expect(thursdayOverview.today_schedule[0].day_of_week).toBe('thursday');
      expect(thursdayOverview.today_schedule[0].room_name).toBe('Bio Lab 1');

      // Weekly schedule contains all batch slots (thursday slot1 and monday slot2)
      expect(thursdayOverview.weekly_schedule.length).toBe(2);
      expect(thursdayOverview.weekly_schedule.some(s => s.day_of_week === 'monday')).toBe(true);
      expect(thursdayOverview.weekly_schedule.some(s => s.day_of_week === 'thursday')).toBe(true);

      // 2. Sunday overview (2026-09-27): should have 0 slots for today, not dump weekly schedule
      const sundayOverview = await store.getStudentParentPortalOverview(tenantId, studentId, undefined, '2026-09-27');
      expect(sundayOverview.today_schedule.length).toBe(0);
      expect(sundayOverview.weekly_schedule.length).toBe(2);

      // 3. Homework submission_status: stays 'pending' until a notebook check exists
      expect(thursdayOverview.homework_diary.length).toBe(1);
      expect(thursdayOverview.homework_diary[0].id).toBe(hw.id);
      expect(thursdayOverview.homework_diary[0].submission_status).toBe('pending');

      // Add a notebook check for this student
      await store.recordNotebookChecks(tenantId, hw.id, [
        { student_id: studentId, status: 'complete', remarks: 'Neat diagrams' },
      ], teacherUserId);

      // Query student overview again
      const updatedOverview = await store.getStudentParentPortalOverview(tenantId, studentId, undefined, '2026-09-24');
      expect(updatedOverview.homework_diary[0].submission_status).toBe('complete');
      expect(updatedOverview.homework_diary[0].check_remarks).toBe('Neat diagrams');

      // Via API endpoint
      const apiRes = await app.inject({
        method: 'GET',
        url: '/api/v1/portal/student?date=2026-09-24',
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(apiRes.statusCode).toBe(200);
      const apiData = apiRes.json().data;
      expect(apiData.today_schedule.length).toBe(1);
      expect(apiData.today_schedule[0].day_of_week).toBe('thursday');
      expect(apiData.homework_diary[0].submission_status).toBe('complete');
    });

    it('attendance desk / homework keys handshake test and portal API tests', async () => {
      // 1. Teacher portal overview provides schedule slot with batch_id and subject_id
      const teacherOverview = await store.getTeacherPortalOverview(tenantId, teacherUserId, '2026-09-24');
      expect(teacherOverview.today_schedule.length).toBeGreaterThan(0);
      const slot = teacherOverview.today_schedule[0];
      expect(slot.batch_id).toBe(batch1Id);
      expect(slot.subject_id).toBe('sub-p7-bio');

      // 2. Client simulation: Teacher portal "Mark Attendance" and "Diary" buttons write sessionStorage keys
      const mockSessionStorage: Record<string, string> = {};
      const setSessionItem = (k: string, v: string) => { mockSessionStorage[k] = v; };
      const getSessionItem = (k: string) => mockSessionStorage[k] || null;
      const removeSessionItem = (k: string) => { delete mockSessionStorage[k]; };

      // Teacher clicks "Mark Attendance"
      setSessionItem('kampus.pendingBatch', slot.batch_id);
      expect(getSessionItem('kampus.pendingBatch')).toBe(batch1Id);

      // AttendanceDesk mounts, consumes key, and queries attendance for that batch
      const pendingBatchForAttendance = getSessionItem('kampus.pendingBatch');
      expect(pendingBatchForAttendance).toBe(batch1Id);
      removeSessionItem('kampus.pendingBatch');
      expect(getSessionItem('kampus.pendingBatch')).toBeNull();

      const attRes = await app.inject({
        method: 'GET',
        url: `/api/v1/attendance/students?batch_id=${pendingBatchForAttendance}&date=2026-09-24`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(attRes.statusCode).toBe(200);

      // Teacher clicks "Diary"
      setSessionItem('kampus.pendingBatch', slot.batch_id);
      setSessionItem('kampus.pendingSubject', slot.subject_id);
      expect(getSessionItem('kampus.pendingBatch')).toBe(batch1Id);
      expect(getSessionItem('kampus.pendingSubject')).toBe('sub-p7-bio');

      // Create a second newer assignment for batch1 to test latest assignment selection
      const newerHw = await store.createHomework({
        tenant_id: tenantId,
        batch_id: batch1Id,
        subject_id: 'sub-p7-bio',
        teacher_id: teacherUserId,
        title: 'Advanced Photosynthesis Experiment',
        description: 'Light reaction vs Dark reaction lab notes',
        assigned_date: '2026-09-26',
        due_date: '2026-09-27',
      });

      // HomeworkDesk mounts, consumes keys, queries assignments for that batch
      const pendingBatchForHw = getSessionItem('kampus.pendingBatch');
      const pendingSubjectForHw = getSessionItem('kampus.pendingSubject');
      removeSessionItem('kampus.pendingBatch');
      removeSessionItem('kampus.pendingSubject');
      expect(getSessionItem('kampus.pendingBatch')).toBeNull();
      expect(getSessionItem('kampus.pendingSubject')).toBeNull();

      const hwRes = await app.inject({
        method: 'GET',
        url: `/api/v1/homework/homework?batch_id=${pendingBatchForHw}`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(hwRes.statusCode).toBe(200);
      const batchAssignments = hwRes.json().data;
      expect(batchAssignments.length).toBeGreaterThanOrEqual(2);

      // Verify that sorting descending by assigned_date selects the latest assignment (newerHw)
      const sortedHw = [...batchAssignments].sort((a: any, b: any) =>
        (b.assigned_date || '').localeCompare(a.assigned_date || '') ||
        (b.created_at || '').localeCompare(a.created_at || '')
      );
      expect(sortedHw[0].id).toBe(newerHw.id);
      expect(sortedHw[0].title).toBe('Advanced Photosynthesis Experiment');

      // 3. Staff attendance /me endpoint returns null when not clocked in
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/geofence/attendance/staff/me?date=2026-09-24',
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(meRes.statusCode).toBe(200);
      expect(meRes.json().data).toBeNull();

      // Punch in within campus perimeter
      const config = await store.getGeofenceConfig(tenantId);
      await store.staffClockIn(tenantId, teacherUserId, teacherFullName, config.latitude, config.longitude);

      // Call /me again
      const meAfterRes = await app.inject({
        method: 'GET',
        url: '/api/v1/geofence/attendance/staff/me?date=2026-09-24',
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(meAfterRes.statusCode).toBe(200);
      const myRecord = meAfterRes.json().data;
      expect(myRecord).toBeDefined();
      expect(['on_time', 'late', 'half_day', 'on_leave', 'absent']).toContain(myRecord.status);
      expect(myRecord.clock_in_time).toBeDefined();
    });

    afterAll(async () => {
      await app.close();
    });
  });
});


