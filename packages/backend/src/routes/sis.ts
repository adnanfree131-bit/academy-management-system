import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload, InquiryStage } from '@apex/shared-types';

export function sisRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    // All routes require authentication
    fastify.addHook('onRequest', (fastify as any).authenticate);

    const assertRole = (user: JWTPayload, allowedRoles: string[], reply: any): boolean => {
      if (!allowedRoles.includes(user.role) && user.role !== 'super_admin') {
        reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. You do not have permission to perform this SIS operation.' },
          timestamp: new Date().toISOString(),
        });
        return false;
      }
      return true;
    };

    // --- Inquiries Desk ---
    fastify.get('/inquiries', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const inquiries = await store.getInquiries(user.tenant_id);
      return reply.send({ success: true, data: inquiries, timestamp: new Date().toISOString() });
    });

    fastify.post('/inquiries', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        student_name: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
        guardian_name: z.string().optional(),
        guardian_phone: z.string().optional(),
        program_id: z.string().uuid().optional().or(z.literal('')).transform(v => v || undefined),
        notes: z.string().optional(),
        source: z.string().default('Walk-in'),
        stage: z.enum(['new', 'follow_up', 'trial_scheduled', 'trial_attended', 'fee_discussion', 'admitted', 'closed']).default('new'),
        priority: z.enum(['high', 'medium', 'low']).default('medium'),
        next_follow_up_date: z.string().optional(),
        custom_field_values: z.record(z.any()).default({}),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid inquiry data', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const inquiry = await store.createInquiry({
        tenant_id: user.tenant_id,
        ...parseResult.data,
      });

      return reply.status(201).send({ success: true, data: inquiry, timestamp: new Date().toISOString() });
    });

    fastify.patch('/inquiries/:id/stage', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };
      const schema = z.object({
        stage: z.enum(['new', 'follow_up', 'trial_scheduled', 'trial_attended', 'fee_discussion', 'admitted', 'closed']),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Valid stage is required', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const updated = await store.updateInquiryStage(user.tenant_id, id, parseResult.data.stage as InquiryStage);
      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Inquiry not found' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    });

    // 1-Click Admit from Inquiry into Batch
    fastify.post('/inquiries/:id/admit', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin', 'academic_head', 'admissions_counselor'], reply)) return;
      const { id } = request.params as { id: string };
      const schema = z.object({
        batch_id: z.string().min(1),
        elective_group_id: z.string().optional().or(z.literal('')).transform(v => v || undefined),
        subjects: z.array(z.string()).optional(),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Batch ID is required for admission', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const student = await store.admitInquiry(
          user.tenant_id,
          id,
          parseResult.data.batch_id,
          parseResult.data.elective_group_id,
          parseResult.data.subjects
        );
        return reply.status(201).send({ success: true, data: student, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'ADMISSION_FAILED', message: err.message || 'Failed to admit inquiry' },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // --- Student Directory / SIS ---
    fastify.get('/students', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const { batch_id } = request.query as { batch_id?: string };
      const students = await store.getStudents(user.tenant_id, batch_id);
      return reply.send({ success: true, data: students, timestamp: new Date().toISOString() });
    });

    fastify.post('/students', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin', 'academic_head', 'admissions_counselor'], reply)) return;
      const rawBody = request.body || {};
      const derivedFullName = rawBody.full_name || `${rawBody.first_name || ''} ${rawBody.last_name || ''}`.trim() || 'Enrolled Student';
      const derivedPhone = rawBody.phone || rawBody.guardian_phone || '+92 300 0000000';

      const schema = z.object({
        full_name: z.string().default(derivedFullName),
        phone: z.string().default(derivedPhone),
        email: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
        guardian_name: z.string().min(1),
        guardian_phone: z.string().min(1),
        program_id: z.string().min(1),
        batch_id: z.string().min(1),
        elective_group_id: z.string().optional().or(z.literal('')).transform(v => v || undefined),
        blood_group: z.string().optional(),
        fee_structure: z.object({
          base_tuition: z.number().nonnegative().optional(),
          tuition_fee: z.number().nonnegative().optional(),
          admission_fee: z.number().nonnegative().default(0),
          exam_fee: z.number().nonnegative().optional(),
          exam_lab_charges: z.number().nonnegative().optional(),
          concession_type: z.string().optional(),
          concession_val: z.number().optional(),
          concession_value: z.number().optional(),
          concession_reason: z.string().optional(),
          net_tuition: z.number().nonnegative().default(0),
          first_month_total: z.number().nonnegative().default(0),
        }).transform(fs => {
          if (!fs) return undefined;
          return {
            base_tuition: fs.base_tuition ?? fs.tuition_fee ?? 0,
            admission_fee: fs.admission_fee ?? 0,
            exam_fee: fs.exam_fee ?? fs.exam_lab_charges ?? 0,
            concession_type: (fs.concession_type === 'percentage' || fs.concession_type === 'flat') ? fs.concession_type : 'percentage',
            concession_val: fs.concession_val ?? fs.concession_value ?? 0,
            concession_reason: fs.concession_reason,
            net_tuition: fs.net_tuition ?? (fs.base_tuition ?? fs.tuition_fee ?? 0),
            first_month_total: fs.first_month_total ?? 0,
          };
        }).optional(),
        generate_first_month_invoice: z.boolean().optional(),
        status: z.enum(['active', 'on_leave', 'suspended', 'alumni', 'withdrawn']).default('active'),
        custom_field_values: z.record(z.any()).default({}),
        subjects: z.array(z.string()).default([]),
      });

      const parseResult = schema.safeParse({
        ...rawBody,
        full_name: derivedFullName,
        phone: derivedPhone,
      });
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid student enrollment data', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const student = await store.createStudent({
        tenant_id: user.tenant_id,
        ...parseResult.data,
      });

      return reply.status(201).send({ success: true, data: student, timestamp: new Date().toISOString() });
    });

    fastify.patch('/students/:id', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin', 'academic_head', 'admissions_counselor'], reply)) return;
      const { id } = request.params as { id: string };

      const schema = z.object({
        full_name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
        guardian_name: z.string().optional(),
        guardian_phone: z.string().optional(),
        status: z.enum(['active', 'on_leave', 'suspended', 'alumni', 'withdrawn']).optional(),
        subjects: z.array(z.string()).optional(),
        fee_structure: z.any().optional(),
        custom_field_values: z.record(z.any()).optional(),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid update payload', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const updated = await store.updateStudent(user.tenant_id, id, parseResult.data);
      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Student not found' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    });

    // Administrative Student Status Transition & Exit Regularization
    fastify.post('/students/:id/status', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin', 'academic_head'], reply)) return;
      const { id } = request.params as { id: string };

      const schema = z.object({
        status: z.enum(['active', 'on_leave', 'suspended', 'alumni', 'withdrawn']),
        reason: z.string().min(1, 'Reason for status change is required'),
        cancel_unpaid_invoices: z.boolean().default(false),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid status update payload', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const updated = await store.updateStudentStatus(
        user.tenant_id,
        id,
        parseResult.data.status,
        parseResult.data.reason,
        parseResult.data.cancel_unpaid_invoices,
        user.email || user.sub
      );

      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Student not found' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    });
  };
}
