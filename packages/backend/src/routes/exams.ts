import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload, ExamQuestionType, QuestionDifficulty, ExamStatus, EvaluationStatus } from '@apex/shared-types';
import { can, batchScope } from '../lib/access.js';

export function examRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    const assertRole = (user: JWTPayload, allowedRoles: string[], reply: any): boolean => {
      if (!allowedRoles.includes(user.role) && user.role !== 'super_admin') {
        reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. You do not have permission to perform this examination operation.' },
          timestamp: new Date().toISOString(),
        });
        return false;
      }
      return true;
    };

    // =========================================================================
    // 1. QUESTION CHAPTERS (Chapter Tree: Program -> Subject -> Chapters)
    // =========================================================================
    const getChaptersHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!can(user, 'exams_bank', 'view')) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Requires exams_bank view permission.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { subject_id, program_id } = request.query as { subject_id?: string; program_id?: string };
      const chapters = await store.getQuestionChapters(user.tenant_id, subject_id, program_id);
      return reply.send({ success: true, data: chapters, timestamp: new Date().toISOString() });
    };
    fastify.get('/chapters', getChaptersHandler);
    fastify.get('/exams/chapters', getChaptersHandler);

    const createChapterHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!can(user, 'exams_bank', 'edit')) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Requires exams_bank edit permission.' },
          timestamp: new Date().toISOString(),
        });
      }
      const schema = z.object({
        program_id: z.string().min(1),
        subject_id: z.string().min(1),
        chapter_number: z.number().int().min(1),
        chapter_name: z.string().min(1)
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid chapter parameters', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const chapter = await store.createQuestionChapter(user.tenant_id, parse.data);
      return reply.status(201).send({ success: true, data: chapter, timestamp: new Date().toISOString() });
    };
    fastify.post('/chapters', createChapterHandler);
    fastify.post('/exams/chapters', createChapterHandler);

    // =========================================================================
    // 2. BANK QUESTIONS (Permanent Master Bank & Fast Ad-Hoc Quizzes)
    // =========================================================================
    const getQuestionsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (user.role === 'student' || user.role === 'parent' || !can(user, 'exams_bank', 'view')) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Question bank access requires exams_bank view permission.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { chapter_id, subject_id, type, is_quiz_bank } = request.query as {
        chapter_id?: string;
        subject_id?: string;
        type?: ExamQuestionType;
        is_quiz_bank?: string;
      };

      let questions = await store.getBankQuestions(user.tenant_id, {
        chapterId: chapter_id,
        subjectId: subject_id,
        type,
        isQuizBank: is_quiz_bank !== undefined ? is_quiz_bank === 'true' : undefined
      });
      if (!can(user, 'exams_bank', 'view')) {
        questions = questions.map((q: any) => {
          const { correct_option, ...rest } = q;
          return rest;
        });
      }
      return reply.send({ success: true, data: questions, timestamp: new Date().toISOString() });
    };
    fastify.get('/questions', getQuestionsHandler);
    fastify.get('/exams/questions', getQuestionsHandler);

    const createQuestionHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!can(user, 'exams_bank', 'edit')) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Requires exams_bank edit permission.' },
          timestamp: new Date().toISOString(),
        });
      }
      const schema = z.object({
        chapter_id: z.string().optional().nullable(),
        subject_id: z.string().min(1),
        question_type: z.enum(['MCQ', 'SHORT', 'LONG']),
        question_text: z.string().min(1),
        marks: z.number().min(0.5).default(1),
        options: z.array(z.object({ key: z.string(), text: z.string() })).optional(),
        correct_option: z.string().optional().nullable(),
        rubric_guide: z.string().optional().nullable(),
        difficulty_level: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
        is_quiz_bank: z.boolean().default(true)
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid question payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const question = await store.createBankQuestion(user.tenant_id, parse.data);
      return reply.status(201).send({ success: true, data: question, timestamp: new Date().toISOString() });
    };
    fastify.post('/questions', createQuestionHandler);
    fastify.post('/exams/questions', createQuestionHandler);

    const deleteQuestionHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!can(user, 'exams_bank', 'edit')) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Requires exams_bank edit permission.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { id } = request.params as { id: string };
      const success = await store.deleteBankQuestion(user.tenant_id, id);
      if (!success) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Question not found' },
          timestamp: new Date().toISOString()
        });
      }
      return reply.send({ success: true, message: 'Question deleted successfully', timestamp: new Date().toISOString() });
    };
    fastify.delete('/questions/:id', deleteQuestionHandler);
    fastify.delete('/exams/questions/:id', deleteQuestionHandler);

    // =========================================================================
    // 3. EXCEL CHAPTER UPLOAD (Flow A: In-Context Chapter Excel/CSV Upload)
    // =========================================================================
    const importExcelHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!can(user, 'exams_bank', 'edit')) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Requires exams_bank edit permission.' },
          timestamp: new Date().toISOString(),
        });
      }
      const schema = z.object({
        subject_id: z.string().min(1),
        program_id: z.string().min(1),
        rows: z.array(z.object({
          chapter_number: z.number().optional(),
          chapter_name: z.string().optional(),
          question_type: z.enum(['MCQ', 'SHORT', 'LONG']),
          question_text: z.string().min(1),
          marks: z.number().optional(),
          option_a: z.string().optional(),
          option_b: z.string().optional(),
          option_c: z.string().optional(),
          option_d: z.string().optional(),
          correct_option: z.string().optional(),
          rubric_guide: z.string().optional(),
          difficulty_level: z.enum(['EASY', 'MEDIUM', 'HARD']).optional()
        })).min(1)
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid excel rows data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const result = await store.importQuestionsFromExcel(
        user.tenant_id,
        parse.data.subject_id,
        parse.data.program_id,
        parse.data.rows
      );

      return reply.status(201).send({
        success: true,
        data: result,
        message: `Successfully imported ${result.imported_count} questions into question bank.`,
        timestamp: new Date().toISOString()
      });
    };
    fastify.post('/questions/import-excel', importExcelHandler);
    fastify.post('/exams/questions/import-excel', importExcelHandler);

    // =========================================================================
    // 4. EXAM SETUP & EXAM PAPER MANAGEMENT
    // =========================================================================
    const getExamsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const hasView = can(user, 'exams_bank', 'view') || can(user, 'exams_marks', 'view') || can(user, 'exams_reports', 'view');
      if (user.role === 'student' || user.role === 'parent' || !hasView) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Requires examination view permission.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { batch_id, subject_id } = request.query as { batch_id?: string; subject_id?: string };
      const exams = await store.getExams(user.tenant_id, batch_id, subject_id);
      return reply.send({ success: true, data: exams, timestamp: new Date().toISOString() });
    };
    fastify.get('/', getExamsHandler);
    fastify.get('/exams', getExamsHandler);

    const getExamByIdHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const hasView = can(user, 'exams_bank', 'view') || can(user, 'exams_marks', 'view') || can(user, 'exams_reports', 'view');
      if (user.role === 'student' || user.role === 'parent' || !hasView) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Requires examination view permission.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { id } = request.params as { id: string };
      const exam = await store.getExamById(user.tenant_id, id);
      if (!exam) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Exam not found' },
          timestamp: new Date().toISOString()
        });
      }
      return reply.send({ success: true, data: exam, timestamp: new Date().toISOString() });
    };
    fastify.get('/:id', getExamByIdHandler);
    fastify.get('/exams/:id', getExamByIdHandler);

    const createExamHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!can(user, 'exams_bank', 'edit') && !can(user, 'exams_marks', 'edit')) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Requires exams_bank or exams_marks edit permission.' },
          timestamp: new Date().toISOString(),
        });
      }
      const schema = z.object({
        batch_id: z.string().min(1),
        subject_id: z.string().min(1),
        title: z.string().min(1),
        exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        duration_minutes: z.number().int().min(10).default(60),
        mcq_count: z.number().int().min(0).default(0),
        mcq_marks_per_q: z.number().min(0.5).default(1),
        mcq_total_marks: z.number().min(0).default(0),
        short_total_marks: z.number().min(0).default(0),
        long_total_marks: z.number().min(0).default(0),
        section_labels: z.object({
          mcq: z.string(),
          short: z.string(),
          long: z.string()
        }).optional(),
        status: z.enum(['DRAFT', 'PUBLISHED', 'COMPLETED', 'GRADED']).default('DRAFT')
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid exam parameters', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const exam = await store.createExam(user.tenant_id, {
        ...parse.data,
        total_marks: (parse.data.mcq_total_marks || (parse.data.mcq_count * parse.data.mcq_marks_per_q)) + parse.data.short_total_marks + parse.data.long_total_marks,
        section_labels: parse.data.section_labels || {
          mcq: 'Q.1 (Objective MCQs)',
          short: 'Q.2 (Short Questions)',
          long: 'Q.3 (Long Questions)'
        }
      });

      return reply.status(201).send({ success: true, data: exam, timestamp: new Date().toISOString() });
    };
    fastify.post('/', createExamHandler);
    fastify.post('/exams', createExamHandler);

    const updateExamHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!can(user, 'exams_bank', 'edit') && !can(user, 'exams_marks', 'edit')) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Requires exams_bank or exams_marks edit permission.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { id } = request.params as { id: string };
      const schema = z.object({
        title: z.string().optional(),
        exam_date: z.string().optional(),
        duration_minutes: z.number().int().optional(),
        status: z.enum(['DRAFT', 'PUBLISHED', 'COMPLETED', 'GRADED']).optional(),
        section_labels: z.object({
          mcq: z.string(),
          short: z.string(),
          long: z.string()
        }).optional()
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid exam updates', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const updated = await store.updateExam(user.tenant_id, id, parse.data);
        return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: err.message },
          timestamp: new Date().toISOString()
        });
      }
    };
    fastify.patch('/:id', updateExamHandler);
    fastify.patch('/exams/:id', updateExamHandler);

    // =========================================================================
    // 5. EXAM QUESTIONS (Assign questions to exam paper)
    // =========================================================================
    const getExamQuestionsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const hasView = can(user, 'exams_bank', 'view') || can(user, 'exams_marks', 'view') || can(user, 'exams_reports', 'view');
      if (user.role === 'student' || user.role === 'parent' || !hasView) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Requires examination view permission.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { id } = request.params as { id: string };
      let questions = await store.getExamQuestions(user.tenant_id, id);
      if (!can(user, 'exams_bank', 'view')) {
        questions = questions.map((q: any) => {
          const { correct_option, ...rest } = q;
          return rest;
        });
      }
      return reply.send({ success: true, data: questions, timestamp: new Date().toISOString() });
    };
    fastify.get('/:id/questions', getExamQuestionsHandler);
    fastify.get('/exams/:id/questions', getExamQuestionsHandler);

    const addExamQuestionsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!can(user, 'exams_bank', 'edit') && !can(user, 'exams_marks', 'edit')) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Requires exams_bank or exams_marks edit permission.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { id } = request.params as { id: string };
      const schema = z.object({
        questions: z.array(z.object({
          question_id: z.string().optional().nullable(),
          section_type: z.enum(['MCQ', 'SHORT', 'LONG']),
          display_order: z.number().int().min(1),
          question_text: z.string().min(1),
          marks: z.number().min(0.5),
          options: z.array(z.object({ key: z.string(), text: z.string() })).optional(),
          correct_option: z.string().optional().nullable()
        })).min(1)
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid questions payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const added = await store.addExamQuestions(user.tenant_id, id, parse.data.questions);
        return reply.status(201).send({ success: true, data: added, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: err.message },
          timestamp: new Date().toISOString()
        });
      }
    };
    fastify.post('/:id/questions', addExamQuestionsHandler);
    fastify.post('/exams/:id/questions', addExamQuestionsHandler);

    // =========================================================================
    // 6. HYBRID EVALUATION (Instant Auto MCQs + Short/Long Teacher Remarks)
    // =========================================================================
    const evaluateHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!can(user, 'exams_marks', 'edit')) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Requires exams_marks edit permission.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { id } = request.params as { id: string };
      const exam = await store.getExamById(user.tenant_id, id);
      if (exam) {
        const scope = batchScope(user);
        if (scope !== 'all' && !scope.includes(exam.batch_id)) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. You are not assigned to this exam batch.' },
            timestamp: new Date().toISOString(),
          });
        }
      }
      const schema = z.object({
        student_id: z.string().min(1),
        mcq_answers: z.record(z.string()).optional(),
        short_score: z.number().min(0).optional(),
        short_remarks: z.string().optional(),
        long_score: z.number().min(0).optional(),
        long_remarks: z.string().optional(),
        status: z.enum(['ABSENT', 'IN_PROGRESS', 'GRADED']).default('GRADED')
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid evaluation score inputs', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const evaluation = await store.evaluateStudentExam(user.tenant_id, {
          exam_id: id,
          ...parse.data,
          evaluated_by: user.sub
        });

        return reply.status(201).send({
          success: true,
          data: evaluation,
          message: `Evaluation recorded: ${evaluation.total_obtained} marks (${evaluation.grade})`,
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'EVALUATION_ERROR', message: err.message },
          timestamp: new Date().toISOString()
        });
      }
    };
    fastify.post('/:id/evaluate', evaluateHandler);
    fastify.post('/exams/:id/evaluate', evaluateHandler);

    const STAFF_ROLES = ['tenant_admin', 'academic_head', 'teacher', 'finance_manager'];

    const canAccessStudentReportCard = async (user: JWTPayload, studentId: string): Promise<boolean> => {
      if (user.role === 'super_admin' || user.role === 'tenant_admin') {
        return true;
      }
      if (user.role !== 'student' && user.role !== 'parent') {
        if (!can(user, 'exams_reports', 'view')) return false;
        const student = await store.getStudentById(user.tenant_id, studentId);
        if (!student) return false;
        const scope = batchScope(user);
        if (scope !== 'all' && (!student.batch_id || !scope.includes(student.batch_id))) return false;
        return true;
      }
      const student = await store.getStudentById(user.tenant_id, studentId);
      if (!student) return false;

      if (user.role === 'student') {
        if (user.student_id && user.student_id === studentId) return true;
        if (student.user_id && student.user_id === user.sub) return true;
        if (user.email && student.email && student.email.toLowerCase() === user.email.toLowerCase()) return true;
        if (user.admission_number && student.admission_number === user.admission_number) return true;
        return false;
      }

      if (user.role === 'parent') {
        const normUserCnic = user.cnic ? user.cnic.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
        const normUserEmail = user.email ? user.email.toLowerCase().trim() : null;

        const sGuardianCnic = student.guardian_id_card ? student.guardian_id_card.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
        const sFatherCnic = student.father_cnic ? student.father_cnic.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
        const sMotherCnic = student.mother_cnic ? student.mother_cnic.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
        const sGuardianEmail = student.guardian_email ? student.guardian_email.toLowerCase().trim() : null;

        if (normUserCnic && (sGuardianCnic === normUserCnic || sFatherCnic === normUserCnic || sMotherCnic === normUserCnic)) {
          return true;
        }
        if (normUserEmail && sGuardianEmail === normUserEmail) {
          return true;
        }
        return false;
      }

      return false;
    };

    const getEvaluationsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };
      let evals = await store.getExamEvaluations(user.tenant_id, id);

      if (user.role === 'student') {
        const students = await store.getStudents(user.tenant_id);
        const myStudent = students.find(s =>
          (user.student_id && s.id === user.student_id) ||
          (s.user_id && s.user_id === user.sub) ||
          (user.email && s.email?.toLowerCase() === user.email.toLowerCase()) ||
          (user.admission_number && s.admission_number === user.admission_number)
        );
        evals = myStudent ? evals.filter(ev => ev.student_id === myStudent.id) : [];
      } else if (user.role === 'parent') {
        const students = await store.getStudents(user.tenant_id);
        const normCnic = user.cnic ? user.cnic.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
        const normEmail = user.email ? user.email.toLowerCase().trim() : null;
        const childIds = new Set(students.filter(s => {
          const sCnic = s.guardian_id_card ? s.guardian_id_card.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
          const sFather = s.father_cnic ? s.father_cnic.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
          const sMother = s.mother_cnic ? s.mother_cnic.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
          const sEmail = s.guardian_email ? s.guardian_email.toLowerCase().trim() : null;
          return (normCnic && (sCnic === normCnic || sFather === normCnic || sMother === normCnic)) || (normEmail && sEmail === normEmail);
        }).map(s => s.id));
        evals = evals.filter(ev => childIds.has(ev.student_id));
      } else {
        if (!can(user, 'exams_reports', 'view')) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Requires exams_reports view permission.' },
            timestamp: new Date().toISOString(),
          });
        }
        const exam = await store.getExamById(user.tenant_id, id);
        if (exam) {
          const scope = batchScope(user);
          if (scope !== 'all' && !scope.includes(exam.batch_id)) {
            return reply.status(403).send({
              success: false,
              error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. You are not assigned to this exam batch.' },
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      return reply.send({ success: true, data: evals, timestamp: new Date().toISOString() });
    };
    fastify.get('/:id/evaluations', getEvaluationsHandler);
    fastify.get('/exams/:id/evaluations', getEvaluationsHandler);

    // =========================================================================
    // 7. OFFICIAL STUDENT REPORT CARD
    // =========================================================================
    const getReportCardHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { id, studentId } = request.params as { id: string; studentId: string };
      if (!await canAccessStudentReportCard(user, studentId)) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You are not authorized to view this student report card.' },
          timestamp: new Date().toISOString()
        });
      }
      const reportCard = await store.getStudentReportCard(user.tenant_id, id, studentId);
      if (!reportCard) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Report card data not found for specified student and exam' },
          timestamp: new Date().toISOString()
        });
      }
      return reply.send({ success: true, data: reportCard, timestamp: new Date().toISOString() });
    };
    fastify.get('/:id/report-card/:studentId', getReportCardHandler);
    fastify.get('/exams/:id/report-card/:studentId', getReportCardHandler);
  };
}
