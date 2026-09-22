import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload } from '@apex/shared-types';
import { can, batchScope, FeatureId, AccessLevel } from '../lib/access.js';

export function homeworkRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    const assertFeature = (user: any, feature: FeatureId, level: AccessLevel, reply: any): boolean => {
      if (!can(user, feature, level)) {
        reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: `Access denied. Requires '${feature}' (${level}) permission.` },
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

      if (user.role === 'student') {
        const students = await store.getStudents(user.tenant_id);
        const me = students.find(s => s.user_id === user.sub || (s.email && user.email && s.email.toLowerCase() === user.email.toLowerCase()));
        if (!me || !me.batch_id) {
          return reply.send({ success: true, data: [], timestamp: new Date().toISOString() });
        }
        const assignments = await store.getHomework(user.tenant_id, me.batch_id);
        return reply.send({ success: true, data: assignments, timestamp: new Date().toISOString() });
      }

      if (user.role === 'parent') {
        const students = await store.getStudents(user.tenant_id);
        const tenantUsers = await store.getTenantUsers(user.tenant_id);
        const me = tenantUsers.find(u => u.id === user.sub || (user.email && u.email === user.email));
        const parentCnic = (me?.metadata as any)?.guardian_id_card || (me?.metadata as any)?.clean_guardian_id_card;
        const cleanParentCnic = parentCnic ? String(parentCnic).replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;

        const children = students.filter(s => {
          if (s.guardian_id_card && cleanParentCnic) {
            const cleanStdCnic = s.guardian_id_card.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
            if (cleanStdCnic === cleanParentCnic) return true;
          }
          if (s.guardian_email && user.email && s.guardian_email.toLowerCase() === user.email.toLowerCase()) return true;
          if (s.guardian_phone && (me as any)?.phone && s.guardian_phone === (me as any)?.phone) return true;
          return false;
        });
        const childBatchIds = new Set(children.map(c => c.batch_id).filter(Boolean));
        if (batch_id) {
          if (!childBatchIds.has(batch_id)) {
            return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' }, timestamp: new Date().toISOString() });
          }
          const assignments = await store.getHomework(user.tenant_id, batch_id);
          return reply.send({ success: true, data: assignments, timestamp: new Date().toISOString() });
        }
        const allAssignments = await store.getHomework(user.tenant_id);
        const filtered = allAssignments.filter(a => childBatchIds.has(a.batch_id));
        return reply.send({ success: true, data: filtered, timestamp: new Date().toISOString() });
      }

      if (!assertFeature(user, 'homework', 'view', reply)) return;
      const scope = batchScope(user);
      if (scope !== 'all') {
        if (batch_id && !scope.includes(batch_id)) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN_BATCH', message: 'You are not assigned to this batch.' },
            timestamp: new Date().toISOString(),
          });
        }
        const assignments = await store.getHomework(user.tenant_id, batch_id);
        const scopedAssignments = assignments.filter(a => scope.includes(a.batch_id));
        return reply.send({ success: true, data: scopedAssignments, timestamp: new Date().toISOString() });
      }

      const assignments = await store.getHomework(user.tenant_id, batch_id);
      return reply.send({ success: true, data: assignments, timestamp: new Date().toISOString() });
    };
    fastify.get('/', getHomeworkHandler);
    fastify.get('/homework', getHomeworkHandler);

    const createHomeworkHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (user.role === 'student' || user.role === 'parent') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Students and parents cannot create homework.' },
          timestamp: new Date().toISOString(),
        });
      }
      if (!assertFeature(user, 'homework', 'edit', reply)) return;

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

      const scope = batchScope(user);
      if (scope !== 'all' && !scope.includes(parse.data.batch_id)) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_BATCH', message: 'You are not assigned to this batch.' },
          timestamp: new Date().toISOString(),
        });
      }

      const homework = await store.createHomework({
        tenant_id: user.tenant_id,
        teacher_id: user.sub || user.user_id || 'teacher-user',
        teacher_name: user.email ? user.email.split('@')[0] : 'teacher',
        ...parse.data,
      });

      return reply.status(201).send({ success: true, data: homework, timestamp: new Date().toISOString() });
    };
    fastify.post('/', createHomeworkHandler);
    fastify.post('/homework', createHomeworkHandler);

    // --- Physical Notebook Checks ---
    const getChecksHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (user.role === 'student' || user.role === 'parent') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Students and parents cannot view notebook checks.' },
          timestamp: new Date().toISOString(),
        });
      }
      if (!assertFeature(user, 'homework', 'view', reply)) return;

      const { id } = request.params as { id: string };
      const checks = await store.getNotebookChecks(user.tenant_id, id);
      return reply.send({ success: true, data: checks, timestamp: new Date().toISOString() });
    };
    fastify.get('/:id/checks', getChecksHandler);
    fastify.get('/homework/:id/checks', getChecksHandler);

    const recordChecksHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (user.role === 'student' || user.role === 'parent') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Students and parents cannot record notebook checks.' },
          timestamp: new Date().toISOString(),
        });
      }
      if (!assertFeature(user, 'homework', 'edit', reply)) return;

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

      const scope = batchScope(user);
      if (scope !== 'all') {
        const allHw = await store.getHomework(user.tenant_id);
        const hw = allHw.find(h => h.id === id);
        if (hw && !scope.includes(hw.batch_id)) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN_BATCH', message: 'You are not assigned to this batch.' },
            timestamp: new Date().toISOString(),
          });
        }
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
