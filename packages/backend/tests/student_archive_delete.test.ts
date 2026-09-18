import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';

describe('Student Archive, Unarchive & Permanent Deletion Lifecycle', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  let adminToken: string;
  let teacherToken: string;
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

    teacherToken = app.jwt.sign({
      sub: 'u0000000-0000-0000-0000-000000000003',
      tenant_id: tenantId,
      email: 'teacher@apexacademy.edu.pk',
      role: 'teacher',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Archives student, updates status to archived, and decrements batch enrollment', async () => {
    // Get all students
    const students = await store.getStudents(tenantId);
    const activeStudent = students.find(s => s.status === 'active')!;
    const batchBefore = store.batches.find(b => b.id === activeStudent.batch_id)!;
    const initialEnrollment = batchBefore.current_enrollment;

    // Call Archive API
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/sis/students/${activeStudent.id}/archive`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        reason: 'Student left for study abroad',
        cancel_unpaid_invoices: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('archived');

    // Batch enrollment must decrement
    const batchAfter = store.batches.find(b => b.id === activeStudent.batch_id)!;
    expect(batchAfter.current_enrollment).toBe(initialEnrollment - 1);

    // Status change history must record transition
    const updatedStudent = await store.getStudentById(tenantId, activeStudent.id);
    expect(updatedStudent?.status).toBe('archived');
    expect(updatedStudent?.status_change_history?.slice(-1)[0].new_status).toBe('archived');
    expect(updatedStudent?.status_change_history?.slice(-1)[0].reason).toBe('Student left for study abroad');
  });

  it('2. Unarchives student back to active and increments batch enrollment', async () => {
    const students = await store.getStudents(tenantId);
    const student = students[0];

    // Archive first
    await store.archiveStudent(tenantId, student.id, 'Temporary suspension/archival');
    const batchMid = store.batches.find(b => b.id === student.batch_id)!;
    const midEnrollment = batchMid.current_enrollment;

    // Unarchive API
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/sis/students/${student.id}/unarchive`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        reason: 'Rejoined session after administrative approval',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('active');

    // Batch enrollment must increment back
    const batchAfter = store.batches.find(b => b.id === student.batch_id)!;
    expect(batchAfter.current_enrollment).toBe(midEnrollment + 1);
  });

  it('3. Prevents deletion without force if student has paid invoices/financial transactions', async () => {
    // Create a student with a paid invoice
    const student = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Zaid Financial Test',
      guardian_name: 'Ahmed Test',
      guardian_phone: '+92 300 1234567',
      program_id: store.programs[0].id,
      batch_id: store.batches[0].id,
      status: 'active',
      custom_field_values: {},
      subjects: [],
    });

    // Add a paid invoice
    store.invoices.push({
      id: 'inv-test-paid',
      tenant_id: tenantId,
      student_id: student.id,
      invoice_number: 'INV-TEST-001',
      total_amount: 15000,
      paid_amount: 15000,
      balance_amount: 0,
      balance_due: 0,
      status: 'paid',
      items: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Try deleting without force
    const deleteAttempt = await app.inject({
      method: 'DELETE',
      url: `/api/v1/sis/students/${student.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(deleteAttempt.statusCode).toBe(409);
    const errBody = JSON.parse(deleteAttempt.body);
    expect(errBody.success).toBe(false);
    expect(errBody.error.code).toBe('FINANCIAL_TRANSACTIONS_EXIST');

    // Verify student is still in store
    const studentStillExists = await store.getStudentById(tenantId, student.id);
    expect(studentStillExists).toBeDefined();

    // Now delete with force=true
    const forceDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/sis/students/${student.id}?force=true`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(forceDelete.statusCode).toBe(200);
    const successBody = JSON.parse(forceDelete.body);
    expect(successBody.success).toBe(true);

    // Verify student is completely deleted
    const studentDeleted = await store.getStudentById(tenantId, student.id);
    expect(studentDeleted).toBeNull();
  });

  it('4. Deletes student without financial transactions cleanly', async () => {
    const freshStudent = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Fresh Student No Dues',
      guardian_name: 'Mr. Khan',
      guardian_phone: '+92 300 7654321',
      program_id: store.programs[0].id,
      batch_id: store.batches[0].id,
      status: 'active',
      custom_field_values: {},
      subjects: [],
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/sis/students/${freshStudent.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    const deleted = await store.getStudentById(tenantId, freshStudent.id);
    expect(deleted).toBeNull();
  });

  it('5. Enforces role restrictions: teacher cannot delete or archive students', async () => {
    const students = await store.getStudents(tenantId);
    const student = students[0];

    const archiveAttempt = await app.inject({
      method: 'POST',
      url: `/api/v1/sis/students/${student.id}/archive`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(archiveAttempt.statusCode).toBe(403);

    const deleteAttempt = await app.inject({
      method: 'DELETE',
      url: `/api/v1/sis/students/${student.id}`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(deleteAttempt.statusCode).toBe(403);
  });

  it('6. Supports bulk archive and bulk delete endpoints', async () => {
    const s1 = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Bulk Student 1',
      guardian_name: 'Guardian 1',
      guardian_phone: '+92 300 1111111',
      program_id: store.programs[0].id,
      batch_id: store.batches[0].id,
      status: 'active',
      custom_field_values: {},
      subjects: [],
    });

    const s2 = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Bulk Student 2',
      guardian_name: 'Guardian 2',
      guardian_phone: '+92 300 2222222',
      program_id: store.programs[0].id,
      batch_id: store.batches[0].id,
      status: 'active',
      custom_field_values: {},
      subjects: [],
    });

    // Bulk Archive
    const bulkArchiveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students/bulk-archive',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        student_ids: [s1.id, s2.id],
        reason: 'End of academic session bulk archive',
      },
    });

    expect(bulkArchiveRes.statusCode).toBe(200);
    const bulkArchiveBody = JSON.parse(bulkArchiveRes.body);
    expect(bulkArchiveBody.data.archived_count).toBe(2);

    const check1 = await store.getStudentById(tenantId, s1.id);
    const check2 = await store.getStudentById(tenantId, s2.id);
    expect(check1?.status).toBe('archived');
    expect(check2?.status).toBe('archived');

    // Bulk Delete
    const bulkDeleteRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sis/students/bulk-delete',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        student_ids: [s1.id, s2.id],
        force: true,
        reason: 'Purging bulk archived test records',
      },
    });

    expect(bulkDeleteRes.statusCode).toBe(200);
    const bulkDeleteBody = JSON.parse(bulkDeleteRes.body);
    expect(bulkDeleteBody.data.deleted_count).toBe(2);

    expect(await store.getStudentById(tenantId, s1.id)).toBeNull();
    expect(await store.getStudentById(tenantId, s2.id)).toBeNull();
  });
});
