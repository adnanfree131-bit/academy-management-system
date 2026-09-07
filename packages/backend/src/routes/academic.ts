import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload } from '@apex/shared-types';

export function academicRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    // All routes require authentication
    fastify.addHook('onRequest', (fastify as any).authenticate);

    // --- Programs ---
    fastify.get('/programs', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const programs = await store.getPrograms(user.tenant_id);
      return reply.send({ success: true, data: programs, timestamp: new Date().toISOString() });
    });

    fastify.post('/programs', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        description: z.string().optional(),
        sort_order: z.number().int().default(1),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid program data', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const program = await store.createProgram({
        tenant_id: user.tenant_id,
        ...parseResult.data,
      });

      return reply.status(201).send({ success: true, data: program, timestamp: new Date().toISOString() });
    });

    // --- Subjects ---
    fastify.get('/subjects', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const subjects = await store.getSubjects(user.tenant_id);
      return reply.send({ success: true, data: subjects, timestamp: new Date().toISOString() });
    });

    fastify.post('/subjects', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        is_core: z.boolean().default(true),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid subject data', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const subject = await store.createSubject({
        tenant_id: user.tenant_id,
        ...parseResult.data,
      });

      return reply.status(201).send({ success: true, data: subject, timestamp: new Date().toISOString() });
    });

    // --- Subject Groups ---
    fastify.get('/groups', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const { program_id } = request.query as { program_id?: string };
      const groups = await store.getSubjectGroups(user.tenant_id, program_id);
      return reply.send({ success: true, data: groups, timestamp: new Date().toISOString() });
    });

    fastify.post('/groups', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        program_id: z.string().uuid(),
        name: z.string().min(1),
        type: z.enum(['compulsory', 'elective_track']),
        subject_ids: z.array(z.string()).min(1),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid subject group data', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const group = await store.createSubjectGroup({
        tenant_id: user.tenant_id,
        ...parseResult.data,
      });

      return reply.status(201).send({ success: true, data: group, timestamp: new Date().toISOString() });
    });

    // --- Batches ---
    fastify.get('/batches', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const { program_id } = request.query as { program_id?: string };
      const batches = await store.getBatches(user.tenant_id, program_id);
      return reply.send({ success: true, data: batches, timestamp: new Date().toISOString() });
    });

    fastify.post('/batches', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        program_id: z.string().uuid(),
        name: z.string().min(1),
        shift: z.enum(['morning', 'evening']),
        academic_session: z.string().min(1).default('2026-2027'),
        max_capacity: z.number().int().min(1).default(40),
        room_number: z.string().optional(),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid batch data', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const batch = await store.createBatch({
        tenant_id: user.tenant_id,
        ...parseResult.data,
      });

      return reply.status(201).send({ success: true, data: batch, timestamp: new Date().toISOString() });
    });

    // --- Custom Fields ---
    fastify.get('/custom-fields', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const { entity_type } = request.query as { entity_type?: 'student' | 'inquiry' };
      const fields = await store.getCustomFields(user.tenant_id, entity_type || 'student');
      return reply.send({ success: true, data: fields, timestamp: new Date().toISOString() });
    });

    fastify.post('/custom-fields', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        entity_type: z.enum(['student', 'inquiry']),
        field_key: z.string().min(1),
        label: z.string().min(1),
        field_type: z.enum(['text', 'number', 'select', 'date', 'checkbox']),
        options: z.array(z.string()).optional(),
        is_required: z.boolean().default(false),
        sort_order: z.number().int().default(0),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid custom field data', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const field = await store.createCustomField({
        tenant_id: user.tenant_id,
        ...parseResult.data,
      });

      return reply.status(201).send({ success: true, data: field, timestamp: new Date().toISOString() });
    });
  };
}
