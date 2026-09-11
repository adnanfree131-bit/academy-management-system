import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { InMemoryDataStore } from '../src/services/store';

describe('Senior ERP Systems Audit Fixes: Security, Substitution, Leaves & Waitlist', () => {
  let app: FastifyInstance;
  let attackerApp: FastifyInstance;
  let store: InMemoryDataStore;
  const JWT_SECRET = 'test-secret-super-secure-min-32-chars-vitest!';
  const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
  let superAdminToken: string;
  let tenantAdminToken: string;
  let teacherToken: string;
  let attackerToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    store = new InMemoryDataStore();
    app = await buildApp({
      store,
      jwtSecret: JWT_SECRET,
    });
    await app.ready();

    attackerApp = await buildApp({
      store,
      jwtSecret: 'wrong-attacker-secret-key-different-secret-32-chars',
    });
    await attackerApp.ready();

    superAdminToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000006',
      user_id: 'a1000000-0000-0000-0000-000000000006',
      tenant_id: TENANT_ID,
      email: 'kampuserp@gmail.com',
      role: 'super_admin',
    });

    tenantAdminToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000001',
      user_id: 'a1000000-0000-0000-0000-000000000001',
      tenant_id: TENANT_ID,
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin',
    });

    teacherToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000002',
      user_id: 'a1000000-0000-0000-0000-000000000002',
      tenant_id: TENANT_ID,
      email: 'tariq@apexacademy.edu.pk',
      role: 'teacher',
    });

    attackerToken = attackerApp.jwt.sign({
      sub: 'attacker-id',
      user_id: 'attacker-id',
      tenant_id: TENANT_ID,
      email: 'hacker@malicious.com',
      role: 'super_admin',
    });
  });

  afterAll(async () => {
    await app.close();
    await attackerApp.close();
  });

  // ---------------------------------------------------------------------------
  // 1. Cryptographic Signature Verification on SaaS SuperAdmin Endpoints
  // ---------------------------------------------------------------------------
  describe('1. FINDING-BUG-01 & BUG-02: Cryptographic JWT Verification on Admin Endpoints', () => {
    it('rejects forged JWT signed with an attacker key', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
        headers: { Authorization: `Bearer ${attackerToken}` },
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects unauthenticated request to superadmin endpoints', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects tenant_admin role from superadmin control plane with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
        headers: { Authorization: `Bearer ${tenantAdminToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('allows verified super_admin role with valid cryptographic signature', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/superadmin/overview',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('total_tenants');
      expect(body.data).toHaveProperty('tenants');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Timetable Temporary Substitution Immutability
  // ---------------------------------------------------------------------------
  describe('2. FINDING-BUG-07: Date-Scoped Temporary Substitution Immutability', () => {
    it('preserves permanent master teacher_id when assigning temporary substitute', async () => {
      // 1. Create recurring timetable slot with Tariq as permanent teacher in afternoon (non-colliding)
      const permanentTeacherId = 'a1000000-0000-0000-0000-000000000002'; // Tariq
      const substituteTeacherId = 'a1000000-0000-0000-0000-000000000003'; // Substitute Teacher
      const batchId = 'a2000000-0000-0000-0000-000000000001';

      const slot = await store.createTimetableSlot({
        tenant_id: TENANT_ID,
        batch_id: batchId,
        subject_id: 'a3000000-0000-0000-0000-000000000001',
        day_of_week: 'monday',
        start_time: '15:00:00',
        end_time: '16:00:00',
        room_number: 'Room 101',
        teacher_id: permanentTeacherId,
      });

      const tempDate = '2026-11-09'; // specific date in future
      const regularDate = '2026-11-16'; // subsequent Monday

      // 2. Assign substitute for specific date
      const updatedSlot = await store.assignSubstitute(TENANT_ID, slot.id, substituteTeacherId, tempDate);

      // slot.teacher_id MUST remain permanent teacher
      expect(updatedSlot.teacher_id).toBe(permanentTeacherId);
      expect(updatedSlot.substitutions).toBeDefined();
      expect(updatedSlot.substitutions!.length).toBeGreaterThan(0);
      expect(updatedSlot.substitutions![0].substitute_teacher_id).toBe(substituteTeacherId);
      expect(updatedSlot.substitutions![0].date).toBe(tempDate);

      // 3. Query timetable on substituted date
      const timetableOnSubDate = await store.getTimetable(TENANT_ID, batchId, 'monday', tempDate);
      const queriedSlotOnSubDate = timetableOnSubDate.find(s => s.id === slot.id);
      expect(queriedSlotOnSubDate).toBeDefined();
      expect(queriedSlotOnSubDate!.substitute_teacher_id).toBe(substituteTeacherId);
      expect(queriedSlotOnSubDate!.teacher_id).toBe(permanentTeacherId);

      // 4. Query timetable on subsequent week (regular date)
      const timetableOnRegularDate = await store.getTimetable(TENANT_ID, batchId, 'monday', regularDate);
      const queriedSlotOnRegularDate = timetableOnRegularDate.find(s => s.id === slot.id);
      expect(queriedSlotOnRegularDate).toBeDefined();
      expect(queriedSlotOnRegularDate!.substitute_teacher_id).toBeNull();
      expect(queriedSlotOnRegularDate!.teacher_id).toBe(permanentTeacherId);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Staff Leave Decoupling & Staff Roster
  // ---------------------------------------------------------------------------
  describe('3. FINDING-BUG-08: Staff Leave Decoupling & Roster Accuracy', () => {
    it('submits, reviews, and reflects staff leaves on daily roster without confusing student leaves', async () => {
      const staffMemberId = 'a1000000-0000-0000-0000-000000000002'; // Tariq
      const leaveDate = '2026-10-15';

      // Submit staff leave
      const leave = await store.submitStaffLeave({
        tenant_id: TENANT_ID,
        staff_id: staffMemberId,
        start_date: leaveDate,
        end_date: leaveDate,
        category: 'medical',
        reason: 'Medical consultation and recovery',
      });

      expect(leave.status).toBe('pending');
      expect(leave.staff_id).toBe(staffMemberId);

      // Approve staff leave
      const reviewed = await store.reviewStaffLeave(TENANT_ID, leave.id, 'approved', 'Authorized medical leave');
      expect(reviewed.status).toBe('approved');

      // Check daily staff roster for that date
      const roster = await store.getStaffRoster(TENANT_ID, leaveDate);
      const staffEntry = roster.find(r => r.staff_id === staffMemberId);
      expect(staffEntry).toBeDefined();
      expect(staffEntry!.status).toBe('on_leave');
      expect(staffEntry!.admin_adjustment_notes).toContain('Approved Leave (medical)');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Student Attendance History by student_id
  // ---------------------------------------------------------------------------
  describe('4. FINDING-BUG-10: Live Student Attendance History API', () => {
    it('returns student attendance history via query param and path param', async () => {
      const student = (await store.getStudents(TENANT_ID))[0];
      expect(student).toBeDefined();
      const studentId = student.id;
      const batchId = student.batch_id;

      // Record attendance for this student
      await store.recordBatchAttendance(
        TENANT_ID,
        batchId,
        '2026-10-01',
        [{ student_id: studentId, status: 'present', remarks: 'On time' }],
        'admin'
      );
      await store.recordBatchAttendance(
        TENANT_ID,
        batchId,
        '2026-10-02',
        [{ student_id: studentId, status: 'absent', remarks: 'Unexcused' }],
        'admin'
      );

      // Query via query param
      const queryRes = await app.inject({
        method: 'GET',
        url: `/api/v1/attendance/attendance/students?student_id=${studentId}`,
        headers: { Authorization: `Bearer ${tenantAdminToken}` },
      });

      expect(queryRes.statusCode).toBe(200);
      const queryBody = queryRes.json();
      expect(queryBody.success).toBe(true);
      expect(queryBody.data.length).toBeGreaterThanOrEqual(2);
      expect(queryBody.data[0].student_id).toBe(studentId);

      // Query via path param
      const pathRes = await app.inject({
        method: 'GET',
        url: `/api/v1/attendance/attendance/students/${studentId}`,
        headers: { Authorization: `Bearer ${tenantAdminToken}` },
      });

      expect(pathRes.statusCode).toBe(200);
      const pathBody = pathRes.json();
      expect(pathBody.success).toBe(true);
      expect(pathBody.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Waitlisted Student Status Support
  // ---------------------------------------------------------------------------
  describe('5. FINDING-BUG-06: Waitlisted Student Status & Over-Capacity Handling', () => {
    let createdStudentId: string;

    it('allows student creation with waitlisted status', async () => {
      const batchId = 'a2000000-0000-0000-0000-000000000001';
      const programId = 'a1111111-0000-0000-0000-000000000001';

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sis/students',
        headers: { Authorization: `Bearer ${tenantAdminToken}` },
        payload: {
          full_name: 'Zaid Ahmed',
          guardian_name: 'Ahmed Khan',
          guardian_phone: '+923001234567',
          phone: '+923007654321',
          program_id: programId,
          batch_id: batchId,
          status: 'waitlisted',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('waitlisted');
      createdStudentId = body.data.id;
    });

    it('allows updating student status to waitlisted', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/sis/students/${createdStudentId}/status`,
        headers: { Authorization: `Bearer ${tenantAdminToken}` },
        payload: {
          status: 'waitlisted',
          reason: 'Batch re-assignment waitlist',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('waitlisted');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. SaaS Receipts & Announcements Endpoint Security
  // ---------------------------------------------------------------------------
  describe('6. SaaS Receipts & Announcements Endpoint Authentication', () => {
    it('rejects unauthenticated request to /saas/receipts with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/receipts',
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects forged token to /saas/receipts with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/receipts',
        headers: { Authorization: `Bearer ${attackerToken}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('scopes receipts to tenant for regular tenant administrators', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/receipts',
        headers: { Authorization: `Bearer ${tenantAdminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      // All returned receipts must belong to TENANT_ID
      expect(json.data.every((r: any) => r.tenant_id === TENANT_ID)).toBe(true);
    });

    it('rejects unauthenticated request to /saas/announcements with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/announcements',
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects tenant_admin from /saas/announcements management with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/announcements',
        headers: { Authorization: `Bearer ${tenantAdminToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('allows super_admin to access /saas/announcements', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saas/announcements',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Timetable HTTP Routes Date Parameter Forwarding
  // ---------------------------------------------------------------------------
  describe('7. Timetable HTTP Routes Date Forwarding', () => {
    it('returns date-scoped substitute teacher via GET /api/v1/timetable/timetable?date=...', async () => {
      const batchId = 'a2000000-0000-0000-0000-000000000001';
      const tempDate = '2026-11-09';
      const nextWeekDate = '2026-11-16';

      const resSub = await app.inject({
        method: 'GET',
        url: `/api/v1/timetable/timetable?batch_id=${batchId}&date=${tempDate}`,
        headers: { Authorization: `Bearer ${tenantAdminToken}` },
      });
      expect(resSub.statusCode).toBe(200);
      const subSlots = resSub.json().data;
      const subSlot = subSlots.find((s: any) => s.substitutions?.some((sub: any) => sub.date === tempDate));
      expect(subSlot).toBeDefined();
      expect(subSlot.substitute_teacher_id).toBe('a1000000-0000-0000-0000-000000000003');

      const resRegular = await app.inject({
        method: 'GET',
        url: `/api/v1/timetable/timetable?batch_id=${batchId}&date=${nextWeekDate}`,
        headers: { Authorization: `Bearer ${tenantAdminToken}` },
      });
      expect(resRegular.statusCode).toBe(200);
      const regularSlots = resRegular.json().data;
      const regSlot = regularSlots.find((s: any) => s.id === subSlot.id);
      expect(regSlot.substitute_teacher_id).toBeNull();
    });

    it('accepts date in POST /api/v1/timetable/check-collision and detects date-specific collision', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/timetable/check-collision',
        headers: { Authorization: `Bearer ${tenantAdminToken}` },
        payload: {
          batchId: 'another-batch-id',
          teacherId: 'a1000000-0000-0000-0000-000000000003', // substitute teacher
          dayOfWeek: 'monday',
          startTime: '15:15',
          endTime: '15:45',
          date: '2026-11-09', // date where teacher is substituting
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.has_conflict).toBe(true);
      expect(json.data.conflict_type).toBe('teacher_conflict');
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Staff Leaves Authorization & Student Leave Isolation
  // ---------------------------------------------------------------------------
  describe('8. Staff Leaves Authorization & Isolation', () => {
    it('blocks regular teacher from submitting leave for another staff member', async () => {
      const otherStaffId = 'a1000000-0000-0000-0000-000000000003';
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/staff-leaves',
        headers: { Authorization: `Bearer ${teacherToken}` },
        payload: {
          staff_id: otherStaffId,
          start_date: '2026-11-10',
          end_date: '2026-11-10',
          category: 'casual',
          reason: 'Attempted leave submission for another teacher',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('does not match student leave applications to staff roster', async () => {
      const teacherId = 'a1000000-0000-0000-0000-000000000002'; // Tariq
      const testDate = '2026-12-01';

      // Submit a STUDENT leave with student_id === teacherId
      await store.submitLeaveApplication({
        tenant_id: TENANT_ID,
        student_id: teacherId,
        start_date: testDate,
        end_date: testDate,
        category: 'medical',
        reason: 'Student leave test',
      });

      const roster = await store.getStaffRoster(TENANT_ID, testDate);
      const teacherEntry = roster.find(r => r.staff_id === teacherId);
      expect(teacherEntry).toBeDefined();
      // Teacher MUST NOT be marked on_leave because of a student leave application!
      expect(teacherEntry!.status).not.toBe('on_leave');
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Multi-Academy Account Switching & Resolution (FINDING-BUG-11)
  // ---------------------------------------------------------------------------
  describe('9. FINDING-BUG-11: Multi-Academy Account Resolution', () => {
    it('authenticates user across academies via global login and supports tenant_slug parameter', async () => {
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
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe('adnan@apexacademy.edu.pk');
      expect(json.data.tenant.slug).toBe('apex');
    });

    it('resolves the correct tenant when a user email exists across multiple academies', async () => {
      // Create second tenant
      const { tenant: tenant2 } = await store.createTenant({
        name: 'Beacon Academy',
        slug: 'beacon',
        status: 'active',
        tier: 'standard',
        domain: 'beacon.kampus.pk',
        admin_email: 'beacon-admin@test.pk',
        admin_name: 'Beacon Admin',
      });

      // Register same email in second tenant with a different password
      await store.createStaff({
        tenant_id: tenant2.id,
        email: 'multitenant-teacher@test.pk',
        full_name: 'Multi Teacher',
        role: 'teacher',
        password: 'BeaconPass2026!',
      });

      // Register in first tenant with different password
      await store.createStaff({
        tenant_id: TENANT_ID,
        email: 'multitenant-teacher@test.pk',
        full_name: 'Multi Teacher',
        role: 'teacher',
        password: 'ApexPass2026!',
      });

      // Global login with Beacon password should automatically resolve Beacon tenant!
      const resBeacon = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'multitenant-teacher@test.pk',
          password: 'BeaconPass2026!',
        },
      });
      expect(resBeacon.statusCode).toBe(200);
      expect(resBeacon.json().data.tenant.id).toBe(tenant2.id);

      // Global login with Apex password should automatically resolve Apex tenant!
      const resApex = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'multitenant-teacher@test.pk',
          password: 'ApexPass2026!',
        },
      });
      expect(resApex.statusCode).toBe(200);
      expect(resApex.json().data.tenant.id).toBe(TENANT_ID);
    });
  });
});
