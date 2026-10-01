import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { InMemoryDataStore } from '../src/services/store';
import { createTestSupabaseToken } from '../src/lib/jwt-verifier.js';

describe('Student & Parent Mobile Portal & Security Integrity Tests', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let studentToken: string;
  let parentToken: string;
  let studentUserId: string;
  let parentUserId: string;

  const TENANT_A_ID = 'a0000000-0000-0000-0000-000000000001'; // Apex Academy

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SUPABASE_JWT_ISSUER = 'https://test-project.supabase.co/auth/v1';
    process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
    process.env.TEST_JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long';
    store = new InMemoryDataStore();
    app = await buildApp({ store });
    await app.ready();

    studentUserId = 'a1000000-0000-0000-0000-000000000005';
    // Student token (Muhammad Ali Raza, stud-1)
    studentToken = await createTestSupabaseToken({
      sub: studentUserId,
      user_id: studentUserId,
      tenant_id: TENANT_A_ID,
      email: 'student@apexacademy.edu.pk',
      role: 'student',
    } as any);

    // Create a parent user with guardian_id_card matching stud-1 ('35201-1234567-1')
    parentUserId = 'p9000000-0000-0000-0000-000000000001';
    const parentEmail = 'parent.test@apexacademy.edu.pk';
    const parentUserObj = {
      id: parentUserId,
      tenant_id: TENANT_A_ID,
      email: parentEmail,
      full_name: 'Raza Ahmed Parent',
      role: 'parent' as const,
      status: 'active' as const,
      password_hash: 'dummy_hash',
      metadata: {
        guardian_id_card: '35201-1234567-1',
        clean_guardian_id_card: '3520112345671',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.users.set(`${TENANT_A_ID}:${parentEmail.toLowerCase()}`, parentUserObj);
    store.users.set(parentUserId, parentUserObj);

    parentToken = await createTestSupabaseToken({
      sub: parentUserId,
      user_id: parentUserId,
      tenant_id: TENANT_A_ID,
      email: parentEmail,
      role: 'parent',
    } as any);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. GET /portal/student-parent returns student_profile, today_schedule, invoices, and recent_attendance with HALF_DAY typed', async () => {
    // Record half-day attendance for stud-1
    store.studentAttendance.push({
      id: 'att-halfday-1',
      tenant_id: TENANT_A_ID,
      student_id: 'stud-1',
      student_name: 'Muhammad Ali Raza',
      batch_id: 'a3000000-0000-0000-0000-000000000001',
      date: '2026-09-25',
      status: 'half_day',
      remarks: 'Left early for doctor appointment',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${studentToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    const data = body.data;
    expect(data.student_profile).toBeDefined();
    expect(data.student_profile.id).toBe('stud-1');
    expect(data.student_profile.full_name).toBe('Muhammad Ali Raza');
    expect(Array.isArray(data.today_schedule)).toBe(true);
    expect(Array.isArray(data.invoices)).toBe(true);
    expect(Array.isArray(data.recent_attendance)).toBe(true);

    const halfDayRecord = data.recent_attendance.find((a: any) => a.date === '2026-09-25');
    expect(halfDayRecord).toBeDefined();
    expect(halfDayRecord.status).toBe('HALF_DAY');
    expect(halfDayRecord.remarks).toContain('Left early');
  });

  it('2. GET /portal/student-parent resolves student via store.getStudentByUserId without scanning entire directory', async () => {
    const getStudentByUserIdSpy = vi.spyOn(store, 'getStudentByUserId');
    const getStudentsSpy = vi.spyOn(store, 'getStudents');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${studentToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(getStudentByUserIdSpy).toHaveBeenCalledWith(TENANT_A_ID, studentUserId);
    expect(getStudentsSpy).not.toHaveBeenCalled();

    getStudentByUserIdSpy.mockRestore();
    getStudentsSpy.mockRestore();
  });

  it('3. GET /portal/student-parent with parent token returns linked_children including photo_url', async () => {
    // Assign photo_url to stud-1
    const stud1 = store.students.find(s => s.id === 'stud-1' && s.tenant_id === TENANT_A_ID);
    if (stud1) {
      stud1.photo_url = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb';
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${parentToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    const data = body.data;
    expect(Array.isArray(data.linked_children)).toBe(true);
    expect(data.linked_children.length).toBeGreaterThanOrEqual(1);

    const child = data.linked_children.find((c: any) => c.id === 'stud-1');
    expect(child).toBeDefined();
    expect(child.full_name).toBe('Muhammad Ali Raza');
    expect(child.photo_url).toBe('https://images.unsplash.com/photo-1534528741775-53994a69daeb');
  });

  it('4. GET /portal/student-parent query session=2025-2026 enforces active year lock', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent?session=2025-2026',
      headers: {
        authorization: `Bearer ${studentToken}`,
        'x-kampus-session': '2025-2026',
      },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    // Active session is 2026-2027; active enrollments must be returned
    expect(data.enrollments.length).toBeGreaterThanOrEqual(1);
    expect(data.student_profile.batch_name).toBeDefined();
  });

  it('5. GET /portal/student-parent excludes completed prior-year enrollments from class list', async () => {
    // Add a completed enrollment
    await store.createStudentEnrollment(TENANT_A_ID, 'stud-1', {
      batch_id: 'a3000000-0000-0000-0000-000000000002',
      roll_number: 'OLD-99',
    });
    const enrollments = await store.getStudentEnrollments(TENANT_A_ID, 'stud-1');
    const lastEnr = enrollments[enrollments.length - 1];
    await store.updateStudentEnrollmentStatus(TENANT_A_ID, 'stud-1', lastEnr.id, 'completed', 'Graduated from prior year');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${studentToken}` },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    const completedIncluded = data.enrollments.some((e: any) => e.id === lastEnr.id && e.status === 'completed');
    expect(completedIncluded).toBe(false);
  });

  it('6. POST /attendance/leaves as student validates dates and creates leave without IDOR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/leaves',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        student_id: 'stud-1',
        category: 'medical',
        start_date: '2026-10-10',
        end_date: '2026-10-11',
        reason: 'Viral fever, doctor prescribed 2 days rest',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.student_id).toBe('stud-1');
    expect(body.data.category).toBe('medical');
  });

  it('7. POST /attendance/leaves as student for another student returns 403 UNAUTHORIZED_LEAVE_SUBMISSION', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/leaves',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        student_id: 'other-student-uuid-999',
        category: 'personal',
        start_date: '2026-10-10',
        end_date: '2026-10-11',
        reason: 'Attempting to apply leave for peer',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('UNAUTHORIZED_LEAVE_SUBMISSION');
  });

  it('8. GET /api/v1/absentee/kpi is forbidden for student and parent tokens', async () => {
    const studentRes = await app.inject({
      method: 'GET',
      url: '/api/v1/absentee/kpi',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(studentRes.statusCode).toBe(403);

    const parentRes = await app.inject({
      method: 'GET',
      url: '/api/v1/absentee/kpi',
      headers: { authorization: `Bearer ${parentToken}` },
    });
    expect(parentRes.statusCode).toBe(403);
  });

  it('9. POST /api/v1/auth/change-password returns 410 Gone (retired in favor of Supabase Auth)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        current_password: 'Admin@123',
        new_password: 'NewSecretPass2026!',
      },
    });
    expect(res.statusCode).toBe(410);
    expect(res.json().error.code).toBe('LEGACY_AUTH_DEPRECATED');
  });

  it('10. GET /portal/student-parent as student with another student_id returns 403 UNAUTHORIZED_STUDENT_ACCESS', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent?student_id=stud-2',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED_STUDENT_ACCESS');
  });

  it('11. GET /portal/student-parent as parent with unrelated child student_id returns 403 UNAUTHORIZED_PARENT_ACCESS', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent?student_id=stud-999-unrelated',
      headers: { authorization: `Bearer ${parentToken}` },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED_PARENT_ACCESS');
  });

  it('12. PATCH /api/v1/academic/working-session as student returns 403 FORBIDDEN_ROLE', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/academic/working-session',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        academic_session: '2025-2026',
      },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('FORBIDDEN_ROLE');
  });

  it('13. GET /portal/student-parent as student returns student_profile.photo_url matching the stored photo', async () => {
    const photoUrl = 'https://images.unsplash.com/photo-student-avatar-101.jpg';
    const stud1 = store.students.find(s => s.id === 'stud-1' && s.tenant_id === TENANT_A_ID);
    if (stud1) {
      stud1.photo_url = photoUrl;
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.student_profile).toBeDefined();
    expect(body.data.student_profile.photo_url).toBe(photoUrl);
  });
});
