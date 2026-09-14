import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload } from '@apex/shared-types';

export function complaintsRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    // List complaints
    const getComplaintsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      let tickets = await store.getComplaints(user.tenant_id);
      if (user.role === 'student' || user.role === 'parent') {
        const userId = user.sub || (user as any).user_id;
        tickets = tickets.filter(t => t.user_id === userId);
      }
      return reply.send({ success: true, data: tickets, timestamp: new Date().toISOString() });
    };
    fastify.get('/', getComplaintsHandler);
    fastify.get('/complaints', getComplaintsHandler);

    // Create complaint ticket
    const createComplaintHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        category: z.enum(['teaching_quality', 'facility', 'fee_billing', 'disciplinary', 'general']),
        priority: z.enum(['urgent', 'high', 'normal']).default('normal'),
        subject: z.string().min(3),
        description: z.string().min(5),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid complaint ticket data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const ticket = await store.createComplaint({
        tenant_id: user.tenant_id,
        user_id: user.sub || user.user_id || 'unknown-user',
        user_name: user.email.split('@')[0],
        ...parse.data,
      });

      return reply.status(201).send({ success: true, data: ticket, timestamp: new Date().toISOString() });
    };
    fastify.post('/', createComplaintHandler);
    fastify.post('/complaints', createComplaintHandler);

    // Update status or reply to complaint
    const updateStatusHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (user.role === 'student' || user.role === 'parent') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Only administrative staff may update or resolve complaints.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { id } = request.params as { id: string };
      const schema = z.object({
        status: z.enum(['open', 'under_investigation', 'action_taken', 'resolved']),
        resolution_reply: z.string().optional(),
        internal_notes: z.string().optional(),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid complaint update payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const ticket = await store.updateComplaintStatus(
          user.tenant_id,
          id,
          parse.data.status,
          parse.data.resolution_reply,
          parse.data.internal_notes,
          user.email
        );
        return reply.send({ success: true, data: ticket, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.patch('/:id/status', updateStatusHandler);
    fastify.patch('/complaints/:id/status', updateStatusHandler);
  };
}
