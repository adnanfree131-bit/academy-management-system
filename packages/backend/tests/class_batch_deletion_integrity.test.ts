import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';

describe('Strict Class and Batch Deletion Integrity', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let adminToken: string;
  const tenantId = 'a0000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    store = new InMemoryDataStore();
    app = await buildApp({ store, jwtSecret: 'test-secret-min-32-chars-long-for-vitest' });
    await app.ready();

    adminToken = app.jwt.sign({
      sub: 'u0000000-0000-0000-0000-000000000001',
      tenant_id: tenantId,
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Blocks deletion of class when active students are enrolled', async () => {
    // Pick an existing program with students
    const programs = await store.getPrograms(tenantId);
    expect(programs.length).toBeGreaterThan(0);
    const progWithStudents = programs[0];

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/programs/${progWithStudents.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CLASS_HAS_STUDENTS');
    expect(body.error.message).toContain('student record(s) currently');
  });

  it('2. Blocks deletion of batch when active students are assigned', async () => {
    const batches = await store.getBatches(tenantId);
    expect(batches.length).toBeGreaterThan(0);
    const batchWithStudents = batches[0];

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/batches/${batchWithStudents.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('BATCH_HAS_STUDENTS');
    expect(body.error.message).toContain('student record(s) currently');
  });

  it('3. Safely deletes an empty class and cascades empty dependencies', async () => {
    // Create an empty class
    const emptyClass = await store.createProgram({
      tenant_id: tenantId,
      name: 'Class Temporary Empty',
      code: 'TMP-EMPTY',
      description: 'Temporary class for deletion test',
      sort_order: 99,
    });

    // Create an empty batch for this class
    const emptyBatch = await store.createBatch({
      tenant_id: tenantId,
      program_id: emptyClass.id,
      name: 'Section Alpha Empty',
      shift: 'morning',
      academic_session: '2026-2027',
      max_capacity: 30,
    });

    // Create an empty subject group for this class
    const emptyGroup = await store.createSubjectGroup({
      tenant_id: tenantId,
      program_id: emptyClass.id,
      name: 'Compulsory Group',
      type: 'compulsory',
      subject_ids: [],
    });

    // Verify they exist
    expect(store.programs.some(p => p.id === emptyClass.id)).toBe(true);
    expect(store.batches.some(b => b.id === emptyBatch.id)).toBe(true);
    expect(store.subjectGroups.some(g => g.id === emptyGroup.id)).toBe(true);

    // Now delete the empty class
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/programs/${emptyClass.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // Verify program and its child batches and groups are cleanly removed
    expect(store.programs.some(p => p.id === emptyClass.id)).toBe(false);
    expect(store.batches.some(b => b.id === emptyBatch.id)).toBe(false);
    expect(store.subjectGroups.some(g => g.id === emptyGroup.id)).toBe(false);
  });

  it('4. Safely deletes an empty section', async () => {
    // Create an empty batch under an existing program
    const programs = await store.getPrograms(tenantId);
    const emptyBatch = await store.createBatch({
      tenant_id: tenantId,
      program_id: programs[0].id,
      name: 'Section Beta Empty',
      shift: 'evening',
      academic_session: '2026-2027',
      max_capacity: 25,
    });

    expect(store.batches.some(b => b.id === emptyBatch.id)).toBe(true);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/batches/${emptyBatch.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    expect(store.batches.some(b => b.id === emptyBatch.id)).toBe(false);
  });

  it('5. Blocks deletion of batch when archived student records are assigned', async () => {
    const programs = await store.getPrograms(tenantId);
    const testBatch = await store.createBatch({
      tenant_id: tenantId,
      program_id: programs[0].id,
      name: 'Section Gamma Archive Test',
      shift: 'morning',
      academic_session: '2026-2027',
      max_capacity: 30,
    });

    const student = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Archived Student Test',
      email: 'archived.student@test.edu.pk',
      phone: '03001234567',
      program_id: programs[0].id,
      batch_id: testBatch.id,
      status: 'active',
      fee_structure: { base_tuition: 5000, net_tuition: 5000, recurring_monthly: 5000 },
      subjects: ['English'],
    } as any);

    // Archive the student
    await store.updateStudentStatus(tenantId, student.id, 'archived', 'Student completed session');
    expect(student.status).toBe('archived');

    // Attempt to delete batch while archived student record is assigned
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/batches/${testBatch.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('BATCH_HAS_STUDENTS');
    expect(body.error.message).toContain('student record(s) currently assigned');

    // Clean up student
    await store.deleteStudent(tenantId, student.id, { force: true });
    // Now deletion of empty batch succeeds
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/academic/batches/${testBatch.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.statusCode).toBe(200);
  });

  it('6. Blocks reactivating/unarchiving student if their assigned batch no longer exists', async () => {
    const programs = await store.getPrograms(tenantId);
    const tempBatch = await store.createBatch({
      tenant_id: tenantId,
      program_id: programs[0].id,
      name: 'Section Delta Ghost Batch',
      shift: 'evening',
      academic_session: '2026-2027',
      max_capacity: 30,
    });

    const student = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Ghost Batch Student',
      email: 'ghost.student@test.edu.pk',
      phone: '03007654321',
      program_id: programs[0].id,
      batch_id: tempBatch.id,
      status: 'active',
      fee_structure: { base_tuition: 4000, net_tuition: 4000, recurring_monthly: 4000 },
      subjects: ['English'],
    } as any);

    await store.updateStudentStatus(tenantId, student.id, 'archived', 'Archived before batch removal');

    // Force remove batch from store directly to simulate legacy orphaned state
    store.batches = store.batches.filter(b => b.id !== tempBatch.id);

    // Attempt to unarchive student
    await expect(
      store.unarchiveStudent(tenantId, student.id, 'Restoring student')
    ).rejects.toThrow('assigned section no longer exists');

    // Clean up
    await store.deleteStudent(tenantId, student.id, { force: true });
  });

  it('7. Bulk fee revision synchronizes both student fee structure AND enrollment fee structure', async () => {
    const programs = await store.getPrograms(tenantId);
    const feeBatch = await store.createBatch({
      tenant_id: tenantId,
      program_id: programs[0].id,
      name: 'Section Epsilon Fee Test',
      shift: 'morning',
      academic_session: '2026-2027',
      max_capacity: 30,
    });

    const student = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Fee Revision Student',
      email: 'feerevision@test.edu.pk',
      phone: '03009988776',
      program_id: programs[0].id,
      batch_id: feeBatch.id,
      status: 'active',
      fee_structure: { base_tuition: 5000, net_tuition: 5000, recurring_monthly: 5000 },
      subjects: ['Math'],
    } as any);

    const enrollment = store.studentEnrollments.find(e => e.student_id === student.id && e.is_primary);
    expect(enrollment).toBeDefined();
    expect(enrollment?.fee_structure?.base_tuition).toBe(5000);

    // Execute bulk fee revision of +1000 PKR on this batch
    await store.bulkFeeRevision(tenantId, {
      scope: 'batch',
      batch_id: feeBatch.id,
      increment_type: 'fixed',
      increment_value: 1000,
      rounding: 'none',
      reason: 'Annual session fee revision',
    });

    // Check student record
    const updatedStudent = store.students.find(s => s.id === student.id);
    expect(updatedStudent?.fee_structure?.base_tuition).toBe(6000);
    expect(updatedStudent?.fee_structure?.net_tuition).toBe(6000);

    // Check enrollment record
    const updatedEnrollment = store.studentEnrollments.find(e => e.id === enrollment!.id);
    expect(updatedEnrollment?.fee_structure?.base_tuition).toBe(6000);
    expect(updatedEnrollment?.fee_structure?.net_tuition).toBe(6000);

    // Clean up
    await store.deleteStudent(tenantId, student.id, { force: true });
    await store.deleteBatch(tenantId, feeBatch.id);
  });

  it('8. Student admission number matches batch academic session year', async () => {
    const programs = await store.getPrograms(tenantId);
    const futureBatch = await store.createBatch({
      tenant_id: tenantId,
      program_id: programs[0].id,
      name: 'Future Cohort 2029',
      shift: 'morning',
      academic_session: '2029-2030',
      max_capacity: 30,
    });

    const student = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Future Session Student',
      email: 'future2029@test.edu.pk',
      phone: '03001122334',
      program_id: programs[0].id,
      batch_id: futureBatch.id,
      status: 'active',
      fee_structure: { base_tuition: 6000, net_tuition: 6000, recurring_monthly: 6000 },
      subjects: ['Physics'],
    } as any);

    // Verify admission number starts with ADM-2029-
    expect(student.admission_number).toMatch(/^ADM-2029-\d{3,}$/);

    // Verify primary enrollment fields
    const enrollment = store.studentEnrollments.find(e => e.student_id === student.id && e.is_primary);
    expect(enrollment).toBeDefined();
    expect(enrollment?.admission_number).toBe(student.admission_number);
    expect(enrollment?.academic_session).toBe('2029-2030');

    // Clean up
    await store.deleteStudent(tenantId, student.id, { force: true });
    await store.deleteBatch(tenantId, futureBatch.id);
  });
});
