import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload, InquiryStage } from '@apex/shared-types';

export function sisRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    // All routes require authentication
    fastify.addHook('onRequest', (fastify as any).authenticate);

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
      const { id } = request.params as { id: string };
      const schema = z.object({
        batch_id: z.string().uuid(),
        elective_group_id: z.string().optional().or(z.literal('')).transform(v => v || undefined),
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
          parseResult.data.elective_group_id
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
      const schema = z.object({
        full_name: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
        guardian_name: z.string().min(1),
        guardian_phone: z.string().min(1),
        program_id: z.string().uuid(),
        batch_id: z.string().uuid(),
        elective_group_id: z.string().optional().or(z.literal('')).transform(v => v || undefined),
        status: z.enum(['active', 'suspended', 'graduated', 'withdrawn']).default('active'),
        custom_field_values: z.record(z.any()).default({}),
        subjects: z.array(z.string()).default([]),
      });

      const parseResult = schema.safeParse(request.body);
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
  };
}
