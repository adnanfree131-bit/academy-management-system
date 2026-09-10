import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { InMemoryDataStore } from '../src/services/store.js';

describe('Phase 5: Examination Bank, Excel Chapter Upload & Hybrid Evaluation', () => {
  let app: FastifyInstance;
  let token: string;
  let tenantBToken: string;
  const tenantId = 'a0000000-0000-0000-0000-000000000001'; // Apex Academy
  const tenantBId = 'b0000000-0000-0000-0000-000000000002'; // Crescent Academy

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
  // 1. CHAPTER TREE & DUAL QUESTION BANK MODES
  // =========================================================================
  describe('Module 8.3: Dual Question Bank & Chapter Hierarchy', () => {
    it('Gate 1: retrieves pre-seeded question chapters for academic program and subject', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/exams/chapters',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
      expect(body.data[0].chapter_name).toBe('Vectors & Equilibrium');
      expect(body.data[0].subject_name).toBe('Physics');
      expect(body.data[0].question_count).toBeGreaterThanOrEqual(1);
    });

    it('Gate 2: creates a new question chapter in hierarchy', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/exams/chapters',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          program_id: 'a2000000-0000-0000-0000-000000000001',
          subject_id: 's1',
          chapter_number: 3,
          chapter_name: 'Work, Power & Energy'
        }
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.chapter_name).toBe('Work, Power & Energy');
      expect(body.data.chapter_number).toBe(3);
    });

    it('Gate 3: retrieves bank questions filtered by question type (MCQ)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/exams/questions?type=MCQ',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(3);
      for (const q of body.data) {
        expect(q.question_type).toBe('MCQ');
        expect(q.options.length).toBe(4);
        expect(q.correct_option).toBeDefined();
      }
    });

    it('Gate 4: creates an ad-hoc or bank question with rubric guidelines', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/exams/questions',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          subject_id: 's1',
          question_type: 'SHORT',
          question_text: 'Explain work-energy theorem with mathematical expression.',
          marks: 4,
          rubric_guide: 'Statement W = Delta K (2 marks), Derivation from 2nd law (2 marks)',
          difficulty_level: 'MEDIUM',
          is_quiz_bank: true
        }
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.question_text).toContain('work-energy theorem');
      expect(body.data.marks).toBe(4);
      expect(body.data.rubric_guide).toBeDefined();
    });

    it('Gate 5: Flow A - In-Context Excel chapter upload auto-parses mixed questions', async () => {
      const excelRows = [
        {
          chapter_number: 4,
          chapter_name: 'Circular Motion',
          question_type: 'MCQ',
          question_text: 'Centripetal acceleration is always directed towards:',
          marks: 2,
          option_a: 'Tangent to circle',
          option_b: 'Center of circular path',
          option_c: 'Opposite to velocity',
          option_d: 'Outward radially',
          correct_option: 'B',
          difficulty_level: 'EASY'
        },
        {
          chapter_number: 4,
          chapter_name: 'Circular Motion',
          question_type: 'SHORT',
          question_text: 'Define banking of roads and write its angle formula tan(theta) = v^2 / rg.',
          marks: 5,
          rubric_guide: 'Definition (2 marks), formula and variables (3 marks)',
          difficulty_level: 'MEDIUM'
        }
      ];

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/exams/questions/import-excel',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          program_id: 'a2000000-0000-0000-0000-000000000001',
          subject_id: 's1',
          rows: excelRows
        }
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.imported_count).toBe(2);
      expect(body.data.chapters_created).toBe(1);

      // Verify questions now appear in question bank
      const checkRes = await app.inject({
        method: 'GET',
        url: '/api/v1/exams/questions?subject_id=s1',
        headers: { authorization: `Bearer ${token}` },
      });
      const checkBody = checkRes.json();
      const texts = checkBody.data.map((q: any) => q.question_text);
      expect(texts).toContain('Centripetal acceleration is always directed towards:');
    });

    it('Gate 6: deletes question from bank', async () => {
      // Create a temporary question
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/exams/questions',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          subject_id: 's1',
          question_type: 'SHORT',
          question_text: 'Temporary question to delete',
          marks: 2
        }
      });
      const qId = createRes.json().data.id;

      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/exams/questions/${qId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(delRes.statusCode).toBe(200);
      expect(delRes.json().success).toBe(true);
    });
  });

  // =========================================================================
  // 2. EXAM SETUP & AUTO-SUM OF MARKS
  // =========================================================================
  describe('Module 8.1: Simple Exam Setup & Total Marks Auto-Calculation', () => {
    let createdExamId: string;

    it('Gate 7: creates a new exam with dynamic MCQ count & section marks auto-sum', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/exams',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          batch_id: 'a3000000-0000-0000-0000-000000000001',
          subject_id: 's1',
          title: 'Physics Grand Test - Chapter 1 to 3',
          exam_date: '2026-09-20',
          duration_minutes: 75,
          mcq_count: 10,
          mcq_marks_per_q: 1,
          mcq_total_marks: 10,
          short_total_marks: 20,
          long_total_marks: 20,
          section_labels: {
            mcq: 'Q.1 (10 Objective MCQs @ 1 Mark)',
            short: 'Q.2 (5 Conceptual Short Questions @ 4 Marks)',
            long: 'Q.3 (2 Comprehensive Long Problems @ 10 Marks)'
          },
          status: 'DRAFT'
        }
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.title).toBe('Physics Grand Test - Chapter 1 to 3');
      // Auto-summed total: 10 + 20 + 20 = 50 Marks
      expect(body.data.total_marks).toBe(50);
      createdExamId = body.data.id;
    });

    it('Gate 8: assigns exam questions with display ordering', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/exams/${createdExamId}/questions`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          questions: [
            {
              section_type: 'MCQ',
              display_order: 1,
              question_text: 'Sample test question 1',
              marks: 1,
              options: [{ key: 'A', text: 'Option A' }, { key: 'B', text: 'Option B' }],
              correct_option: 'A'
            },
            {
              section_type: 'SHORT',
              display_order: 2,
              question_text: 'Sample test question 2',
              marks: 4
            }
          ]
        }
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(2);
    });

    it('Gate 9: retrieves exam by ID with attached questions and section headers', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/exams/${createdExamId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdExamId);
      expect(body.data.questions.length).toBe(2);
      expect(body.data.section_labels.mcq).toContain('Q.1');
    });
  });

  // =========================================================================
  // 3. HYBRID GRADING FLOW & QUESTION-LEVEL REMARKS
  // =========================================================================
  describe('Module 8.2: Hybrid Grading Flow & Question-Level Teacher Remarks', () => {
    it('Gate 10: auto-grades MCQs instantly and incorporates teacher manual scores with remarks', async () => {
      // Use pre-seeded exam-1 (3 MCQs @ 2 marks each = 6, 12 short, 12 long = 30 total)
      // Student answers: eq-1: B (correct), eq-2: C (correct), eq-3: B (wrong, correct is A)
      // MCQ score should be: 2 + 2 = 4 marks
      // Short score: 10 / 12
      // Long score: 9 / 12
      // Total: 4 + 10 + 9 = 23 marks / 30 = 76.67% -> Grade 'B'
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/exams/exam-1/evaluate',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          student_id: 'stud-1',
          mcq_answers: {
            'eq-1': 'B',
            'eq-2': 'C',
            'eq-3': 'B' // Incorrect option
          },
          short_score: 10,
          short_remarks: 'First equilibrium condition was well stated; improve torque convention.',
          long_score: 9,
          long_remarks: 'Sound mathematical steps; lost 3 marks due to unlabelled vector diagram.',
          status: 'GRADED'
        }
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.mcq_score).toBe(4);
      expect(body.data.short_score).toBe(10);
      expect(body.data.short_remarks).toContain('First equilibrium condition');
      expect(body.data.long_score).toBe(9);
      expect(body.data.long_remarks).toContain('unlabelled vector diagram');
      expect(body.data.total_obtained).toBe(23);
      expect(body.data.percentage).toBe(76.67);
      expect(body.data.grade).toBe('A');
      expect(body.data.status).toBe('GRADED');
    });

    it('Gate 11: retrieves exam evaluations register for the batch', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/exams/exam-1/evaluations',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);

      const studentEval = body.data.find((e: any) => e.student_id === 'stud-1');
      expect(studentEval).toBeDefined();
      expect(studentEval.student_name).toBe('Muhammad Ali Raza');
      expect(studentEval.roll_number).toBe('A-101');
      expect(studentEval.total_obtained).toBe(23);
    });

    it('Gate 12: generates student official report card with section breakdown and question remarks', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/exams/exam-1/report-card/stud-1',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);

      const report = body.data;
      expect(report.student.full_name).toBe('Muhammad Ali Raza');
      expect(report.student.roll_number).toBe('A-101');
      expect(report.student.guardian_name).toBe('Raza Ahmed');
      expect(report.exam.title).toBe('MDCAT Physics Mid-Term Assessment 2026');
      expect(report.evaluation.mcq_score).toBe(4);
      expect(report.evaluation.short_score).toBe(10);
      expect(report.evaluation.short_remarks).toContain('First equilibrium condition');
      expect(report.evaluation.long_score).toBe(9);
      expect(report.evaluation.long_remarks).toContain('unlabelled vector diagram');
      expect(report.evaluation.total_obtained).toBe(23);
      expect(report.evaluation.grade).toBe('A');
      expect(report.rank).toBe(1);
    });

    it('Gate 13: Tenant B cannot access Tenant A exams or questions', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/exams/exam-1',
        headers: { authorization: `Bearer ${tenantBToken}` },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.success).toBe(false);
    });
  });
});
