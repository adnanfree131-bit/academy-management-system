import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload, ExamQuestionType, QuestionDifficulty, ExamStatus, EvaluationStatus } from '@apex/shared-types';

export function examRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    // =========================================================================
    // 1. QUESTION CHAPTERS (Chapter Tree: Program -> Subject -> Chapters)
    // =========================================================================
    const getChaptersHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { subject_id, program_id } = request.query as { subject_id?: string; program_id?: string };
      const chapters = await store.getQuestionChapters(user.tenant_id, subject_id, program_id);
      return reply.send({ success: true, data: chapters, timestamp: new Date().toISOString() });
    };
    fastify.get('/chapters', getChaptersHandler);
    fastify.get('/exams/chapters', getChaptersHandler);

    const createChapterHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
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
      const { chapter_id, subject_id, type, is_quiz_bank } = request.query as {
        chapter_id?: string;
        subject_id?: string;
        type?: ExamQuestionType;
        is_quiz_bank?: string;
      };

      const questions = await store.getBankQuestions(user.tenant_id, {
        chapterId: chapter_id,
        subjectId: subject_id,
        type,
        isQuizBank: is_quiz_bank !== undefined ? is_quiz_bank === 'true' : undefined
      });
      return reply.send({ success: true, data: questions, timestamp: new Date().toISOString() });
    };
    fastify.get('/questions', getQuestionsHandler);
    fastify.get('/exams/questions', getQuestionsHandler);

    const createQuestionHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
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
      const { batch_id, subject_id } = request.query as { batch_id?: string; subject_id?: string };
      const exams = await store.getExams(user.tenant_id, batch_id, subject_id);
      return reply.send({ success: true, data: exams, timestamp: new Date().toISOString() });
    };
    fastify.get('/', getExamsHandler);
    fastify.get('/exams', getExamsHandler);

    const getExamByIdHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
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
      const { id } = request.params as { id: string };
      const questions = await store.getExamQuestions(user.tenant_id, id);
      return reply.send({ success: true, data: questions, timestamp: new Date().toISOString() });
    };
    fastify.get('/:id/questions', getExamQuestionsHandler);
    fastify.get('/exams/:id/questions', getExamQuestionsHandler);

    const addExamQuestionsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
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
      const { id } = request.params as { id: string };
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

    const getEvaluationsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };
      const evals = await store.getExamEvaluations(user.tenant_id, id);
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
