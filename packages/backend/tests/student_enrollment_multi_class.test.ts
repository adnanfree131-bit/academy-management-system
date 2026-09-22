import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';

describe('Multi-Class Student Enrollments & Lifecycle Integrity Suite', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let adminToken: string;
  let parentToken: string;
  let studentToken: string;

  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  let programId: string;
  let morningBatchId: string;
  let eveningBatchId: string;
  let testStudentId: string;
  let enrollmentAId: string;
  let enrollmentBId: string;

  beforeAll(async () => {
    store = new InMemoryDataStore();
    app = await buildApp({ store });

    adminToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000001',
      user_id: 'a1000000-0000-0000-0000-000000000001',
      tenant_id: tenantId,
      email: 'admin@apexacademy.edu.pk',
      role: 'tenant_admin',
    });

    const programs = await store.getPrograms(tenantId);
    programId = programs[0]?.id || 'a2000000-0000-0000-0000-000000000001';

    // Create two batches: Morning and Evening
    const bMorning = await store.createBatch({
      tenant_id: tenantId,
      program_id: programId,
      name: 'Class 10 - Morning Prep',
      shift: 'morning',
      max_capacity: 30,
      fee_amount: 8000,
      billing_mode: 'monthly',
    });
    morningBatchId = bMorning.id;

    const bEvening = await store.createBatch({
      tenant_id: tenantId,
      program_id: programId,
      name: 'Class 10 - Evening Science Coaching',
      shift: 'evening',
      max_capacity: 25,
      fee_amount: 6000,
      billing_mode: 'monthly',
    });
    eveningBatchId = bEvening.id;
  });

  // =========================================================================
  // 1. Backfill Verification
  // =========================================================================
  it('1. Backfill: ensures existing students have exactly one primary enrollment and backfilled invoice links', async () => {
    const students = await store.getStudents(tenantId);
    expect(students.length).toBeGreaterThan(0);

    for (const s of students) {
      const enrollments = await store.getStudentEnrollments(tenantId, s.id);
      expect(enrollments.length).toBeGreaterThanOrEqual(1);
      const primary = enrollments.find(e => e.is_primary);
      expect(primary).toBeDefined();
      expect(primary?.is_primary).toBe(true);
      expect(primary?.student_id).toBe(s.id);
      expect(primary?.batch_id).toBe(s.batch_id);
    }

    const invoices = await store.getInvoices(tenantId);
    for (const inv of invoices) {
      if (inv.student_id) {
        expect(inv.enrollment_id).toBeDefined();
      }
    }
  });

  // =========================================================================
  // 2. Admission & Adding a Second Class
  // =========================================================================
  it('2. Admits student into Morning batch and verifies primary enrollment creation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        full_name: 'Hamza Tariq Multi',
        guardian_name: 'Tariq Mehmood',
        guardian_phone: '03001234567',
        guardian_id_card: '35202-1234567-1',
        program_id: programId,
        batch_id: morningBatchId,
        roll_number: 'M-101',
        fee_structure: {
          base_tuition: 8000,
          net_tuition: 8000,
          recurring_monthly: 8000,
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    testStudentId = body.data.id;
    expect(body.data.full_name).toBe('Hamza Tariq Multi');

    // Verify enrollment
    const enrollments = await store.getStudentEnrollments(tenantId, testStudentId);
    expect(enrollments.length).toBe(1);
    expect(enrollments[0].is_primary).toBe(true);
    expect(enrollments[0].batch_id).toBe(morningBatchId);
    expect(enrollments[0].roll_number).toBe('M-101');
    expect(enrollments[0].status).toBe('active');
    enrollmentAId = enrollments[0].id;

    // Verify morning batch current_enrollment incremented
    const morningBatch = (await store.getBatches(tenantId)).find(b => b.id === morningBatchId);
    expect(morningBatch?.current_enrollment).toBe(1);
  });

  it('3. Adding a second class: creates a second enrollment for the same student without duplicating student or user', async () => {
    const usersBefore = (await store.getTenantUsers(tenantId)).filter(u => u.role === 'student');
    const studentsBefore = await store.getStudents(tenantId);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/sis/students/${testStudentId}/enrollments`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: eveningBatchId,
        roll_number: 'E-201',
        fee_structure: {
          base_tuition: 6000,
          net_tuition: 5500,
          recurring_monthly: 5500,
        },
        billing_mode: 'monthly',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.student_id).toBe(testStudentId);
    expect(body.data.batch_id).toBe(eveningBatchId);
    expect(body.data.roll_number).toBe('E-201');
    expect(body.data.is_primary).toBe(false);
    expect(body.data.status).toBe('active');
    enrollmentBId = body.data.id;

    // Student table row count remains identical (no second student record created)
    const studentsAfter = await store.getStudents(tenantId);
    expect(studentsAfter.length).toBe(studentsBefore.length);

    // User accounts count for students remains identical (no second student portal user)
    const usersAfter = (await store.getTenantUsers(tenantId)).filter(u => u.role === 'student');
    expect(usersAfter.length).toBe(usersBefore.length);

    // Student profile includes both enrollments and active_enrollments_count === 2
    const std = await store.getStudentById(tenantId, testStudentId);
    expect(std?.active_enrollments_count).toBe(2);
    expect(std?.enrollments?.length).toBe(2);

    // Evening batch enrollment count incremented
    const eveningBatch = (await store.getBatches(tenantId)).find(b => b.id === eveningBatchId);
    expect(eveningBatch?.current_enrollment).toBe(1);
  });

  // =========================================================================
  // 3. Batch Capacity & Duplicate Checks
  // =========================================================================
  it('4. Rejects enrollment if target batch has reached max capacity', async () => {
    // Temporarily reduce evening batch capacity to 1
    const eveningBatch = (await store.getBatches(tenantId)).find(b => b.id === eveningBatchId)!;
    eveningBatch.max_capacity = 1;

    // Create another dummy student
    const dummy = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Capacity Test Student',
      guardian_name: 'Guardian',
      guardian_phone: '03009999999',
      batch_id: morningBatchId,
      roll_number: 'M-102',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/sis/students/${dummy.id}/enrollments`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: eveningBatchId,
        roll_number: 'E-202',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('BATCH_CAPACITY_EXCEEDED');

    // Restore capacity and clean up dummy student
    eveningBatch.max_capacity = 25;
    await store.deleteStudent(tenantId, dummy.id, { force: true });
  });

  it('5. Rejects duplicate active enrollment in the same batch for the same student', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/sis/students/${testStudentId}/enrollments`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: eveningBatchId,
        roll_number: 'E-999',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('ALREADY_ENROLLED');
  });

  // =========================================================================
  // 4. Invoicing & Arrears Isolation per Enrollment
  // =========================================================================
  it('6. Generates distinct fee challans per class with separate amounts and isolated arrears', async () => {
    // 1. Generate batch invoices for Morning batch
    const morningGenRes = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/invoices/generate-batch',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        scope: 'batch',
        target_id: morningBatchId,
        billing_month: 'October 2026',
        due_date: '2026-10-15',
      },
    });
    expect(morningGenRes.statusCode).toBe(201);
    const morningInvoices = morningGenRes.json().data;
    const invMorning = morningInvoices.find((i: any) => i.student_id === testStudentId);
    expect(invMorning).toBeDefined();
    expect(invMorning.enrollment_id).toBe(enrollmentAId);
    expect(invMorning.batch_id).toBe(morningBatchId);
    expect(invMorning.roll_number).toBe('M-101');
    expect(invMorning.net_amount).toBe(8000);

    // 2. Generate batch invoices for Evening batch
    const eveningGenRes = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/invoices/generate-batch',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        scope: 'batch',
        target_id: eveningBatchId,
        billing_month: 'October 2026',
        due_date: '2026-10-15',
      },
    });
    expect(eveningGenRes.statusCode).toBe(201);
    const eveningInvoices = eveningGenRes.json().data;
    const invEvening = eveningInvoices.find((i: any) => i.student_id === testStudentId);
    expect(invEvening).toBeDefined();
    expect(invEvening.enrollment_id).toBe(enrollmentBId);
    expect(invEvening.batch_id).toBe(eveningBatchId);
    expect(invEvening.roll_number).toBe('E-201');
    expect(invEvening.net_amount).toBe(5500);

    // Student now has two distinct invoices for October 2026
    const studentInvoices = await store.getInvoices(tenantId, { student_id: testStudentId, billing_month: 'October 2026' });
    expect(studentInvoices.length).toBe(2);

    // 3. Arrears Isolation: Morning invoice remains unpaid (8,000 PKR).
    // Now generate November 2026 for Evening batch -> should NOT include Morning arrears!
    const eveningNovGenRes = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/invoices/generate-batch',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        scope: 'batch',
        target_id: eveningBatchId,
        billing_month: 'November 2026',
        due_date: '2026-11-15',
      },
    });
    expect(eveningNovGenRes.statusCode).toBe(201);
    const novEveningInv = eveningNovGenRes.json().data.find((i: any) => i.student_id === testStudentId);
    expect(novEveningInv).toBeDefined();
    // Arrears from morning class (8,000 PKR) did NOT bleed into evening class, only evening October arrears (5,500 PKR) rolled forward!
    expect(novEveningInv.arrears_amount).toBe(5500);
    expect(novEveningInv.net_amount).toBe(11000);
  });

  // =========================================================================
  // 5. Attendance Isolation per Class
  // =========================================================================
  it('7. Marks attendance separately for Morning and Evening batches on the same calendar day', async () => {
    const today = '2026-10-05';

    // Morning attendance: present
    const mornAttRes = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/students/batch',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: morningBatchId,
        date: today,
        records: [{ student_id: testStudentId, status: 'present' }],
      },
    });
    expect(mornAttRes.statusCode).toBe(201);

    // Evening attendance: late
    const eveAttRes = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/students/batch',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: eveningBatchId,
        date: today,
        records: [{ student_id: testStudentId, status: 'late' }],
      },
    });
    expect(eveAttRes.statusCode).toBe(201);

    // Verify both records exist and reflect appropriate enrollment and status
    const allAtt = await store.getStudentAttendance(tenantId, undefined, today);
    const stdAtt = allAtt.filter(a => a.student_id === testStudentId);
    expect(stdAtt.length).toBe(2);

    const mornRecord = stdAtt.find(a => a.batch_id === morningBatchId);
    const eveRecord = stdAtt.find(a => a.batch_id === eveningBatchId);
    expect(mornRecord?.status).toBe('present');
    expect(mornRecord?.enrollment_id).toBe(enrollmentAId);
    expect(eveRecord?.status).toBe('late');
    expect(eveRecord?.enrollment_id).toBe(enrollmentBId);
  });

  // =========================================================================
  // 6. Leaving a Class (Exit Regularization) & Releasing Seat
  // =========================================================================
  it('8. Exits Evening class: frees Evening batch seat, cancels evening unpaid challan, and preserves Morning enrollment and portal account', async () => {
    const eveningBatchBefore = (await store.getBatches(tenantId)).find(b => b.id === eveningBatchId)!;
    expect(eveningBatchBefore.current_enrollment).toBe(1);

    const exitRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sis/students/${testStudentId}/enrollments/${enrollmentBId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        status: 'withdrawn',
        reason: 'Schedule conflict with college practicals',
        cancel_unpaid_invoices: true,
      },
    });
    expect(exitRes.statusCode).toBe(200);
    expect(exitRes.json().data.status).toBe('withdrawn');
    expect(exitRes.json().data.ended_at).toBeDefined();

    // Evening batch seat freed
    const eveningBatchAfter = (await store.getBatches(tenantId)).find(b => b.id === eveningBatchId)!;
    expect(eveningBatchAfter.current_enrollment).toBe(0);

    // Morning batch seat retained
    const morningBatch = (await store.getBatches(tenantId)).find(b => b.id === morningBatchId)!;
    expect(morningBatch.current_enrollment).toBe(1);

    // Student status remains active because Morning enrollment is active
    const student = await store.getStudentById(tenantId, testStudentId);
    expect(student?.status).toBe('active');
    expect(student?.active_enrollments_count).toBe(1);

    // Evening unpaid invoices are cancelled, while Morning invoice remains unpaid
    const invs = await store.getInvoices(tenantId, { student_id: testStudentId });
    const eveningInvs = invs.filter(i => i.enrollment_id === enrollmentBId);
    const morningInvs = invs.filter(i => i.enrollment_id === enrollmentAId);
    expect(eveningInvs.some(i => i.status === 'cancelled')).toBe(true);
    expect(eveningInvs.filter(i => (i.balance_due ?? i.balance_amount ?? 0) > 0).length).toBe(0);
    expect(morningInvs.some(i => i.status === 'unpaid' && (i.balance_due ?? 0) > 0)).toBe(true);
  });

  // =========================================================================
  // 7. Leaving Primary Class & Automatic Primary Promotion
  // =========================================================================
  it('9. Leaving primary class automatically promotes remaining active class to primary; blocks account only when all classes exit', async () => {
    // First, reactivate Evening class
    await store.updateStudentEnrollmentStatus(tenantId, testStudentId, enrollmentBId, 'active', 'Re-enrolled');
    let student = await store.getStudentById(tenantId, testStudentId);
    expect(student?.active_enrollments_count).toBe(2);

    // Now withdraw Morning class (which was primary)
    const withdrawMornRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sis/students/${testStudentId}/enrollments/${enrollmentAId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        status: 'withdrawn',
        reason: 'Relocated away from morning center',
        cancel_unpaid_invoices: false,
      },
    });
    expect(withdrawMornRes.statusCode).toBe(200);

    // Evening class should now be automatically promoted to primary!
    const eveningEnrollment = await store.getEnrollmentById(tenantId, enrollmentBId);
    expect(eveningEnrollment?.is_primary).toBe(true);

    student = await store.getStudentById(tenantId, testStudentId);
    expect(student?.batch_id).toBe(eveningBatchId);
    expect(student?.roll_number).toBe('E-201');
    expect(student?.status).toBe('active');

    // Portal user should still be active
    const user = (await store.getTenantUsers(tenantId)).find(u => u.id === student?.user_id);
    expect(user?.status).toBe('active');

    // Now withdraw the last remaining class (Evening)
    await app.inject({
      method: 'POST',
      url: `/api/v1/sis/students/${testStudentId}/enrollments/${enrollmentBId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        status: 'withdrawn',
        reason: 'Complete academy departure',
      },
    });

    student = await store.getStudentById(tenantId, testStudentId);
    expect(student?.status).toBe('withdrawn');
    expect(student?.active_enrollments_count).toBe(0);

    // When all classes are inactive, portal account is blocked
    const userFinal = (await store.getTenantUsers(tenantId)).find(u => u.id === student?.user_id);
    expect(userFinal?.status).toBe('inactive');
    expect(userFinal?.metadata?.portal_blocked).toBe(true);
  });

  // =========================================================================
  // 8. Parent and Student Portal Multi-Class Integration
  // =========================================================================
  it('10. Parent and Student Portal: parent overview lists 1 child with classes array and student overview supports class switcher', async () => {
    // Reactivate student and enroll in both Morning and Evening
    await store.updateStudentStatus(tenantId, testStudentId, 'active', 'Reactivated');
    await store.updateStudentEnrollmentStatus(tenantId, testStudentId, enrollmentAId, 'active', 'Re-enrolled');
    await store.updateStudentEnrollmentStatus(tenantId, testStudentId, enrollmentBId, 'active', 'Re-enrolled');
    await store.makePrimaryEnrollment(tenantId, testStudentId, enrollmentAId);

    // Retrieve the actual auto-provisioned parent user created for this family
    const parentUser = (await store.getTenantUsers(tenantId)).find(
      u => u.role === 'parent' && (
        (u.metadata as any)?.clean_guardian_id_card === '3520212345671' ||
        (u.metadata as any)?.guardian_id_card === '35202-1234567-1'
      )
    );
    expect(parentUser).toBeDefined();
    if (parentUser?.metadata) parentUser.metadata.must_change_password = false;

    // Generate Parent Token
    parentToken = app.jwt.sign({
      sub: parentUser!.id,
      user_id: parentUser!.id,
      tenant_id: tenantId,
      email: parentUser!.email,
      cnic: '35202-1234567-1',
      role: 'parent',
      must_change_password: false,
    });

    // Parent Portal Overview Request
    const parentRes = await app.inject({
      method: 'GET',
      url: '/api/v1/portal/student-parent',
      headers: { authorization: `Bearer ${parentToken}` },
    });
    expect(parentRes.statusCode).toBe(200);
    const parentData = parentRes.json().data;

    // Must list 1 child, NOT 2 duplicate children
    const matchingChildren = parentData.linked_children.filter((c: any) => c.id === testStudentId);
    expect(matchingChildren.length).toBe(1);

    // That child must contain the classes array with both enrollments
    const child = matchingChildren[0];
    expect(child.classes).toBeDefined();
    expect(child.classes.length).toBe(2);
    expect(child.classes.some((c: any) => c.id === enrollmentAId)).toBe(true);
    expect(child.classes.some((c: any) => c.id === enrollmentBId)).toBe(true);

    // Student Portal Class Switcher Request
    const stdUser = (await store.getTenantUsers(tenantId)).find(u => u.id === (child as any).user_id || u.email?.includes('std.'));
    if (stdUser?.metadata) stdUser.metadata.must_change_password = false;
    studentToken = app.jwt.sign({
      sub: stdUser?.id || 'std-test-user',
      user_id: stdUser?.id || 'std-test-user',
      student_id: testStudentId,
      tenant_id: tenantId,
      email: stdUser?.email || 'std.test@apexacademy.edu.pk',
      role: 'student',
      must_change_password: false,
    });

    // Overview scoped to Evening class
    const studentEveningRes = await app.inject({
      method: 'GET',
      url: `/api/v1/portal/student-parent?enrollment_id=${enrollmentBId}`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(studentEveningRes.statusCode).toBe(200);
    const studentEveningData = studentEveningRes.json().data;
    expect(studentEveningData.student_profile.roll_number).toBe('E-201');
    expect(studentEveningData.student_profile.batch_name).toContain('Evening');
    expect(studentEveningData.selected_enrollment_id).toBe(enrollmentBId);
    expect(studentEveningData.enrollments.length).toBe(2);
  });

  // =========================================================================
  // 9. Opening Challan on Add Class
  // =========================================================================
  it('11. Add Class with generate_opening_challan creates opening fee invoice linked to new enrollment', async () => {
    // Create a 3rd batch: Weekend Revision
    const bWeekend = await store.createBatch({
      tenant_id: tenantId,
      program_id: programId,
      name: 'Class 10 - Weekend Revision',
      shift: 'evening',
      max_capacity: 20,
      fee_amount: 5000,
      billing_mode: 'monthly',
    });

    const addClassRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sis/students/${testStudentId}/enrollments`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: bWeekend.id,
        roll_number: 'W-301',
        generate_opening_challan: true,
        opening_challan_due_date: '2026-10-25',
      },
    });

    expect(addClassRes.statusCode).toBe(201);
    const enrollmentC = addClassRes.json().data;
    expect(enrollmentC.batch_id).toBe(bWeekend.id);
    expect(enrollmentC.roll_number).toBe('W-301');

    // Verify opening invoice was created and linked to this enrollment
    const invoices = await store.getInvoices(tenantId);
    const openingInv = invoices.find(i => i.student_id === testStudentId && i.enrollment_id === enrollmentC.id);
    expect(openingInv).toBeDefined();
    expect(openingInv?.due_date).toBe('2026-10-25');
    expect(openingInv?.notes).toContain(bWeekend.name);
    expect(openingInv?.balance_amount).toBe(5000);
  });

  // =========================================================================
  // 10. Student Archival & Seat Recalculation Across All Classes
  // =========================================================================
  it('12. Student Archival: archiving student archives all active enrollments and immediately frees seats in all batches without seat leaks', async () => {
    const batchesBefore = await store.getBatches(tenantId);
    const morningBefore = batchesBefore.find(b => b.id === morningBatchId)?.current_enrollment || 0;
    const eveningBefore = batchesBefore.find(b => b.id === eveningBatchId)?.current_enrollment || 0;

    expect(morningBefore).toBeGreaterThanOrEqual(1);
    expect(eveningBefore).toBeGreaterThanOrEqual(1);

    // Archive the student
    const archiveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sis/students/${testStudentId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        status: 'archived',
        reason: 'Student moving to another city',
        cancel_unpaid_invoices: true,
      },
    });
    expect(archiveRes.statusCode).toBe(200);

    // Student should be archived with 0 active enrollments
    const student = await store.getStudentById(tenantId, testStudentId);
    expect(student?.status).toBe('archived');
    expect(student?.active_enrollments_count).toBe(0);

    // All enrollments for this student must be marked archived
    const enrollments = await store.getStudentEnrollments(tenantId, testStudentId);
    for (const enr of enrollments) {
      expect(enr.status).toBe('archived');
      expect(enr.ended_at).not.toBeNull();
    }

    // Seats in both batches must be decremented
    const batchesAfter = await store.getBatches(tenantId);
    const morningAfter = batchesAfter.find(b => b.id === morningBatchId)?.current_enrollment || 0;
    const eveningAfter = batchesAfter.find(b => b.id === eveningBatchId)?.current_enrollment || 0;
    expect(morningAfter).toBe(morningBefore - 1);
    expect(eveningAfter).toBe(eveningBefore - 1);

    // Recalculating batch seats must preserve the freed seats (no seat leak)
    await (store as any).recalculateBatchSeats(tenantId);
    const batchesRecalc = await store.getBatches(tenantId);
    const morningRecalc = batchesRecalc.find(b => b.id === morningBatchId)?.current_enrollment || 0;
    const eveningRecalc = batchesRecalc.find(b => b.id === eveningBatchId)?.current_enrollment || 0;
    expect(morningRecalc).toBe(morningAfter);
    expect(eveningRecalc).toBe(eveningAfter);

    // Reactivating student unarchives enrollments and restores seats
    const reactivateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/sis/students/${testStudentId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        status: 'active',
        reason: 'Family returned to city, resuming classes',
      },
    });
    expect(reactivateRes.statusCode).toBe(200);

    const studentRestored = await store.getStudentById(tenantId, testStudentId);
    expect(studentRestored?.status).toBe('active');
    expect(studentRestored?.active_enrollments_count).toBeGreaterThanOrEqual(1);

    const batchesRestored = await store.getBatches(tenantId);
    const morningRestored = batchesRestored.find(b => b.id === morningBatchId)?.current_enrollment || 0;
    expect(morningRestored).toBe(morningBefore);
  });

  // =========================================================================
  // 13. Student Batch Transfer & Capacity Enforcement
  // =========================================================================
  it('13. Enforces strict capacity blocking and processes valid batch transfer with counters and ID reprint flag', async () => {
    // Create a full batch (capacity 1, enrollment 1)
    const fullBatch = await store.createBatch({
      tenant_id: tenantId,
      program_id: programId,
      name: 'Class 10 - Overflow Test Batch',
      shift: 'evening',
      max_capacity: 0,
      fee_amount: 9000,
      billing_mode: 'monthly',
    });

    // Attempt transfer into full batch -> must be strictly blocked (400)
    const blockRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sis/students/${testStudentId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: fullBatch.id,
        transfer_reason: 'Testing capacity block',
      },
    });
    expect(blockRes.statusCode).toBe(400);
    const blockBody = JSON.parse(blockRes.body);
    expect(blockBody.error.message).toMatch(/maximum capacity/i);

    // Create target batch with available capacity
    const targetBatch = await store.createBatch({
      tenant_id: tenantId,
      program_id: programId,
      name: 'Class 10 - Transfer Target Batch',
      shift: 'morning',
      max_capacity: 35,
      current_enrollment: 0,
      fee_amount: 8500,
      billing_mode: 'monthly',
    });

    const studentBefore = await store.getStudentById(tenantId, testStudentId);
    const oldBatchId = studentBefore!.batch_id!;
    const oldBatchBefore = (await store.getBatches(tenantId)).find(b => b.id === oldBatchId)!.current_enrollment;

    // Successful transfer
    const transferRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sis/students/${testStudentId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: targetBatch.id,
        transfer_effective_date: '2026-09-22',
        transfer_reason: 'Parent shift timing request',
      },
    });
    expect(transferRes.statusCode).toBe(200);

    const studentAfter = await store.getStudentById(tenantId, testStudentId);
    expect(studentAfter?.batch_id).toBe(targetBatch.id);
    expect(studentAfter?.id_card_reprint_required).toBe(true);
    expect(studentAfter?.transfer_history?.length).toBeGreaterThanOrEqual(1);

    const latestTransfer = studentAfter?.transfer_history?.[studentAfter.transfer_history.length - 1];
    expect(latestTransfer?.from_batch_id).toBe(oldBatchId);
    expect(latestTransfer?.to_batch_id).toBe(targetBatch.id);
    expect(latestTransfer?.reason).toBe('Parent shift timing request');
    expect(latestTransfer?.effective_date).toBe('2026-09-22');

    // Counters: old batch decremented, target batch incremented
    const batchesNow = await store.getBatches(tenantId);
    const oldBatchAfter = batchesNow.find(b => b.id === oldBatchId)!.current_enrollment;
    const targetBatchAfter = batchesNow.find(b => b.id === targetBatch.id)!.current_enrollment;
    expect(oldBatchAfter).toBe(oldBatchBefore - 1);
    expect(targetBatchAfter).toBe(1);

    // Primary enrollment synced
    const enrollments = await store.getStudentEnrollments(tenantId, testStudentId);
    const primary = enrollments.find(e => e.is_primary);
    expect(primary?.batch_id).toBe(targetBatch.id);
    expect(primary?.id_card_reprint_required).toBe(true);
  });

  // =========================================================================
  // 14. Enrollment Specific Transfer via Enrollment PATCH
  // =========================================================================
  it('14. Transfers individual enrollment via PATCH /students/:id/enrollments/:enrollmentId with history and sync', async () => {
    const enrollments = await store.getStudentEnrollments(tenantId, testStudentId);
    const targetEnrollment = enrollments[0];
    expect(targetEnrollment).toBeDefined();

    const newSectionBatch = await store.createBatch({
      tenant_id: tenantId,
      program_id: programId,
      name: 'Class 10 - Section B Special',
      shift: 'evening',
      max_capacity: 40,
      current_enrollment: 0,
      fee_amount: 8200,
      billing_mode: 'monthly',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sis/students/${testStudentId}/enrollments/${targetEnrollment.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: newSectionBatch.id,
        transfer_effective_date: '2026-09-23',
        transfer_reason: 'Clerical error correction',
      },
    });
    expect(res.statusCode).toBe(200);

    const updated = await store.getStudentEnrollments(tenantId, testStudentId);
    const modifiedEnr = updated.find(e => e.id === targetEnrollment.id);
    expect(modifiedEnr?.batch_id).toBe(newSectionBatch.id);
    expect(modifiedEnr?.id_card_reprint_required).toBe(true);
    expect(modifiedEnr?.transfer_history?.length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // 15. Unpaid Fee Challan Sync on Batch Transfer
  // =========================================================================
  it('15. Updates unpaid fee challan when update_unpaid_challans is true with new batch tuition', async () => {
    // Generate an unpaid invoice for test student with 5000 tuition
    const inv: any = {
      id: 'inv-test-transfer-01',
      tenant_id: tenantId,
      student_id: testStudentId,
      student_name: 'Hamza Tariq Multi',
      admission_number: 'ADM-TEST-HAMZA',
      invoice_number: 'INV-TEST-TRANSFER-01',
      issue_date: '2026-09-01',
      due_date: '2026-09-15',
      status: 'unpaid',
      paid_amount: 0,
      total_amount: 5000,
      balance_due: 5000,
      items: [
        {
          id: 'item-tuition-1',
          invoice_id: 'inv-test-transfer-01',
          fee_head_id: 'fh-tuition',
          head_name: 'Monthly Tuition Fee',
          head_code: 'tuition',
          original_amount: 5000,
          discount_amount: 0,
          net_amount: 5000,
          paid_amount: 0,
          balance_due: 5000,
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (store as any).invoices.push(inv);

    const higherFeeBatch = await store.createBatch({
      tenant_id: tenantId,
      program_id: programId,
      name: 'Class 10 - Premium Lab Batch',
      shift: 'morning',
      max_capacity: 30,
      current_enrollment: 0,
      fee_amount: 7500,
      billing_mode: 'monthly',
    });

    // Transfer student and request unpaid challan update with new tuition 7500
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sis/students/${testStudentId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        batch_id: higherFeeBatch.id,
        fee_structure: { tuition_fee: 7500 },
        update_unpaid_challans: true,
        transfer_reason: 'Upgraded to Premium Lab Batch',
      },
    });
    expect(res.statusCode).toBe(200);

    // Verify invoice was updated to 7500
    const invoices = await store.getInvoices(tenantId);
    const updatedInv = invoices.find(i => i.id === inv.id);
    expect(updatedInv).toBeDefined();
    expect(updatedInv?.total_amount).toBe(7500);
    expect(updatedInv?.balance_due).toBe(7500);
    expect(updatedInv?.items[0].net_amount).toBe(7500);
    expect(updatedInv?.batch_id).toBe(higherFeeBatch.id);
  });
});
