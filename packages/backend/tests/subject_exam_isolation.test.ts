import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';
import { IMailerService } from '../src/services/mailer.js';

describe('Strict Subject & Examination Zero-Leakage Isolation Test Suite', () => {
  let app: FastifyInstance;
  let store: InMemoryDataStore;
  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  let adminToken: string;

  const mockMailer: IMailerService = {
    async sendOTP() {
      return true;
    },
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    store = new InMemoryDataStore();
    app = await buildApp({
      store,
      mailer: mockMailer,
      jwtSecret: 'test-secret-min-32-chars-long-for-vitest',
    });
    await app.ready();

    adminToken = app.jwt.sign({
      sub: 'a1000000-0000-0000-0000-000000000001',
      user_id: 'a1000000-0000-0000-0000-000000000001',
      tenant_id: tenantId,
      email: 'adnan@apexacademy.edu.pk',
      role: 'tenant_admin',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Allows exam evaluation when student is enrolled in the subject', async () => {
    // stud-1 is enrolled in s1 (Physics), s2 (Chemistry), s3 (Biology)
    const exam = await store.createExam(tenantId, {
      title: 'Physics Chapter 1 Assessment',
      batch_id: 'batch-1',
      subject_id: 's1',
      exam_date: '2026-09-16',
      total_marks: 50,
      passing_marks: 20,
    });

    const evalResult = await store.evaluateStudentExam(tenantId, {
      exam_id: exam.id,
      student_id: 'stud-1',
      short_score: 42,
      short_remarks: 'Solid grasp of physics numericals',
    });

    expect(evalResult).toBeDefined();
    expect(evalResult.total_obtained).toBe(42);
    expect(evalResult.percentage).toBe(84);
    expect(evalResult.grade).toBe('A+');
  });

  it('2. Throws strict error when student is not enrolled in exam subject', async () => {
    // stud-1 is enrolled in s1, s2, s3, but NOT enrolled in s4 (Mathematics)
    const mathExam = await store.createExam(tenantId, {
      title: 'Calculus Assessment',
      batch_id: 'batch-1',
      subject_id: 's4',
      exam_date: '2026-09-16',
      total_marks: 50,
      passing_marks: 20,
    });

    await expect(
      store.evaluateStudentExam(tenantId, {
        exam_id: mathExam.id,
        student_id: 'stud-1',
        short_score: 30,
      })
    ).rejects.toThrow(/is not enrolled in subject "Mathematics"/);
  });

  it('3. Throws strict error when student has empty subjects array', async () => {
    const studentWithNoSubjects = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Unassigned Student',
      phone: '+92 300 0000001',
      guardian_name: 'Guardian One',
      guardian_phone: '+92 300 0000002',
      program_id: 'prog-1',
      batch_id: 'batch-1',
      status: 'active',
      subjects: [],
    } as any);

    const exam = await store.createExam(tenantId, {
      title: 'Physics Test',
      batch_id: 'batch-1',
      subject_id: 's1',
      exam_date: '2026-09-16',
      total_marks: 50,
      passing_marks: 20,
    });

    await expect(
      store.evaluateStudentExam(tenantId, {
        exam_id: exam.id,
        student_id: studentWithNoSubjects.id,
        short_score: 25,
      })
    ).rejects.toThrow(/is not enrolled in subject/);
  });

  it('4. Rejects via API endpoint with 400 when student is not enrolled in subject', async () => {
    const mathExam = await store.createExam(tenantId, {
      title: 'API Math Assessment',
      batch_id: 'batch-1',
      subject_id: 's4',
      exam_date: '2026-09-16',
      total_marks: 50,
      passing_marks: 20,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/exams/${mathExam.id}/evaluate`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        student_id: 'stud-1',
        short_score: 35,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.message).toMatch(/is not enrolled in subject/);
  });

  it('5. Allows enrolling student via PATCH /api/v1/sis/students/:id and updates audit log', async () => {
    // Enroll stud-1 in s4 (Mathematics)
    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/sis/students/stud-1',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        subjects: ['s1', 's2', 's3', 's4'],
        audit_reason: 'Added Mathematics elective to student profile',
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchedStudent = patchRes.json().data;
    expect(patchedStudent.subjects).toContain('s4');

    // Verify audit logs record the subjects modification
    const auditRes = await app.inject({
      method: 'GET',
      url: '/api/v1/sis/students/stud-1/audit-logs',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(auditRes.statusCode).toBe(200);
    const auditLogs = auditRes.json().data;
    const subjectLog = auditLogs.find((l: any) => l.changes && l.changes.subjects);
    expect(subjectLog).toBeDefined();
    expect(subjectLog.changes.subjects.new).toContain('s4');

    // Now evaluating Math exam succeeds!
    const mathExam = await store.createExam(tenantId, {
      title: 'Calculus Re-assessment',
      batch_id: 'batch-1',
      subject_id: 's4',
      exam_date: '2026-09-16',
      total_marks: 50,
      passing_marks: 20,
    });

    const evalResult = await store.evaluateStudentExam(tenantId, {
      exam_id: mathExam.id,
      student_id: 'stud-1',
      short_score: 45,
    });

    expect(evalResult).toBeDefined();
    expect(evalResult.total_obtained).toBe(45);
  });

  it('6. Historical evaluations remain accessible after student drops a subject', async () => {
    // stud-1 had an evaluation in s1 (Physics) from test 1
    const physicsExam = await store.createExam(tenantId, {
      title: 'Historical Physics Final',
      batch_id: 'batch-1',
      subject_id: 's1',
      exam_date: '2026-09-16',
      total_marks: 100,
      passing_marks: 40,
    });

    const evalResult = await store.evaluateStudentExam(tenantId, {
      exam_id: physicsExam.id,
      student_id: 'stud-1',
      short_score: 85,
    });
    expect(evalResult.total_obtained).toBe(85);

    // Drop s1 from stud-1
    await store.updateStudent(tenantId, 'stud-1', {
      subjects: ['s2', 's3', 's4'],
    });

    // Historical report card must STILL be retrieved without error
    const rc = await store.getStudentReportCard(tenantId, physicsExam.id, 'stud-1');
    expect(rc).not.toBeNull();
    expect(rc?.evaluation.total_obtained).toBe(85);
    expect(rc?.evaluation.grade).toBe('A+');

    // But a NEW Physics exam evaluation must be rejected now
    const newPhysicsExam = await store.createExam(tenantId, {
      title: 'Subsequent Physics Retake',
      batch_id: 'batch-1',
      subject_id: 's1',
      exam_date: '2026-09-17',
      total_marks: 100,
      passing_marks: 40,
    });

    await expect(
      store.evaluateStudentExam(tenantId, {
        exam_id: newPhysicsExam.id,
        student_id: 'stud-1',
        short_score: 75,
      })
    ).rejects.toThrow(/is not enrolled in subject "Physics"/);
  });

  it('7. Does not generate synthetic absent/F report card for unenrolled student who never took exam', async () => {
    // stud-1 is not enrolled in s1 right now
    const physicsExam = await store.createExam(tenantId, {
      title: 'Unenrolled Inquiry Exam',
      batch_id: 'batch-1',
      subject_id: 's1',
      exam_date: '2026-09-18',
      total_marks: 50,
      passing_marks: 20,
    });

    // Request report card for stud-1 who is NOT enrolled in s1 and has no evaluation
    const rc = await store.getStudentReportCard(tenantId, physicsExam.id, 'stud-1');
    expect(rc).toBeNull();
  });

  it('8. Legacy student with undefined subjects array is safely rejected from evaluation', async () => {
    const legacyStudent = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Legacy Student',
      phone: '+92 300 9999999',
      guardian_name: 'Legacy Guardian',
      guardian_phone: '+92 300 8888888',
      program_id: 'prog-1',
      batch_id: 'batch-1',
      status: 'active',
      // subjects intentionally undefined
    } as any);

    const exam = await store.createExam(tenantId, {
      title: 'Legacy Student Boundary Exam',
      batch_id: 'batch-1',
      subject_id: 's2',
      exam_date: '2026-09-16',
      total_marks: 50,
      passing_marks: 20,
    });

    await expect(
      store.evaluateStudentExam(tenantId, {
        exam_id: exam.id,
        student_id: legacyStudent.id,
        short_score: 30,
      })
    ).rejects.toThrow(/is not enrolled in subject "Chemistry"/);
  });

  it('9. Non-active student is rejected before subject enrollment check', async () => {
    const withdrawnStudent = await store.createStudent({
      tenant_id: tenantId,
      full_name: 'Withdrawn Student',
      phone: '+92 300 7777777',
      guardian_name: 'Withdrawn Guardian',
      guardian_phone: '+92 300 6666666',
      program_id: 'prog-1',
      batch_id: 'batch-1',
      status: 'withdrawn',
      subjects: ['s1'],
    } as any);

    const exam = await store.createExam(tenantId, {
      title: 'Status Restriction Exam',
      batch_id: 'batch-1',
      subject_id: 's1',
      exam_date: '2026-09-16',
      total_marks: 50,
      passing_marks: 20,
    });

    await expect(
      store.evaluateStudentExam(tenantId, {
        exam_id: exam.id,
        student_id: withdrawnStudent.id,
        short_score: 30,
      })
    ).rejects.toThrow(/Evaluations are restricted to active students/);
  });

  it('10. Rejects invalid non-array subjects payload in PATCH /api/v1/sis/students/:id with 400', async () => {
    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/sis/students/stud-1',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        subjects: 'invalid-string-not-array',
      },
    });

    expect(patchRes.statusCode).toBe(400);
    const body = patchRes.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
