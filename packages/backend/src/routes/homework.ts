import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload } from '@apex/shared-types';

export function homeworkRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    const assertRole = (user: JWTPayload, allowedRoles: string[], reply: any): boolean => {
      if (!allowedRoles.includes(user.role) && user.role !== 'super_admin') {
        reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. You do not have permission to perform this homework operation.' },
          timestamp: new Date().toISOString(),
        });
        return false;
      }
      return true;
    };

    // --- Homework Assignments ---
    const getHomeworkHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { batch_id } = request.query as { batch_id?: string };
      const assignments = await store.getHomework(user.tenant_id, batch_id);
      return reply.send({ success: true, data: assignments, timestamp: new Date().toISOString() });
    };
    fastify.get('/', getHomeworkHandler);
    fastify.get('/homework', getHomeworkHandler);

    const createHomeworkHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin', 'academic_head', 'teacher'], reply)) return;
      const schema = z.object({
        batch_id: z.string().min(1),
        subject_id: z.string().min(1),
        title: z.string().min(1),
        description: z.string().min(1),
        assigned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        attachment_url: z.string().url().optional(),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid homework assignment payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const homework = await store.createHomework({
        tenant_id: user.tenant_id,
        teacher_id: user.sub || user.user_id || 'teacher-user',
        teacher_name: user.email.split('@')[0],
        ...parse.data,
      });

      return reply.status(201).send({ success: true, data: homework, timestamp: new Date().toISOString() });
    };
    fastify.post('/', createHomeworkHandler);
    fastify.post('/homework', createHomeworkHandler);

    // --- Physical Notebook Checks ---
    const getChecksHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };
      const checks = await store.getNotebookChecks(user.tenant_id, id);
      return reply.send({ success: true, data: checks, timestamp: new Date().toISOString() });
    };
    fastify.get('/:id/checks', getChecksHandler);
    fastify.get('/homework/:id/checks', getChecksHandler);

    const recordChecksHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin', 'academic_head', 'teacher'], reply)) return;
      const { id } = request.params as { id: string };
      const schema = z.object({
        checks: z.array(z.object({
          student_id: z.string().min(1),
          status: z.enum(['done', 'incomplete', 'missing']),
          remarks: z.string().optional(),
        })).min(1),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid notebook checking payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const results = await store.recordNotebookChecks(
        user.tenant_id,
        id,
        parse.data.checks,
        user.email
      );

      return reply.status(201).send({ success: true, data: results, timestamp: new Date().toISOString() });
    };
    fastify.post('/:id/checks', recordChecksHandler);
    fastify.post('/homework/:id/checks', recordChecksHandler);
  };
}
