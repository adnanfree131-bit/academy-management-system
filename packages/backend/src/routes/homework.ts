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
        const tenantUsers = await store.getTenantUsers(user.tenant_id);
        const meUser = tenantUsers.find(u => u.id === (user.sub || user.user_id) || (u.email && u.email.toLowerCase() === (user.email || '').toLowerCase()));
        const studentId = (user as any).student_id || ((user as any).metadata as any)?.student_id || (meUser?.metadata as any)?.student_id;

        const students = await store.getStudents(user.tenant_id);
        const me = students.find(s =>
          (studentId && s.id === studentId) ||
          (s.user_id && (s.user_id === user.sub || s.user_id === user.user_id))
        );
        if (!me) {
          return reply.send({ success: true, data: [], timestamp: new Date().toISOString() });
        }

        const enrollments = await store.getStudentEnrollments(user.tenant_id, me.id);
        const activeEnrollments = enrollments.filter(e => e.status === 'active' || e.status === 'on_leave');

        if (batch_id) {
          const isEnrolled = activeEnrollments.some(e => e.batch_id === batch_id) || me.batch_id === batch_id;
          if (!isEnrolled) {
            return reply.status(403).send({
              success: false,
              error: { code: 'FORBIDDEN', message: 'You are not enrolled in this batch.' },
              timestamp: new Date().toISOString(),
            });
          }
          const assignments = await store.getHomework(user.tenant_id, batch_id);
          return reply.send({ success: true, data: assignments, timestamp: new Date().toISOString() });
        }

        const studentBatchIds = new Set<string>();
        if (me.batch_id) studentBatchIds.add(me.batch_id);
        for (const enr of activeEnrollments) {
          if (enr.batch_id) studentBatchIds.add(enr.batch_id);
        }
        if (studentBatchIds.size === 0) {
          return reply.send({ success: true, data: [], timestamp: new Date().toISOString() });
        }
        const allAssignments = await store.getHomework(user.tenant_id);
        const filtered = allAssignments.filter(a => studentBatchIds.has(a.batch_id));
        return reply.send({ success: true, data: filtered, timestamp: new Date().toISOString() });
      }

      if (user.role === 'parent') {
        const tenantUsers = await store.getTenantUsers(user.tenant_id);
        const me = tenantUsers.find(u => u.id === (user.sub || user.user_id) || (user.email && u.email === user.email));
        const parentCnic = (me?.metadata as any)?.guardian_id_card ||
          (me?.metadata as any)?.clean_guardian_id_card ||
          (user as any).guardian_id_card ||
          (user as any).cnic ||
          ((user as any).metadata as any)?.guardian_id_card ||
          (me as any)?.cnic ||
          (me as any)?.guardian_id_card;
        const cleanParentCnic = parentCnic ? String(parentCnic).replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
        const parentEmail = (user.email || me?.email || '').trim().toLowerCase();
        const parentPhone = ((me as any)?.phone || (user as any)?.phone || (me?.metadata as any)?.phone || (me?.metadata as any)?.guardian_phone || '').trim();

        const students = await store.getStudents(user.tenant_id);
        const children = students.filter(s => {
          if (cleanParentCnic && s.guardian_id_card) {
            const cleanStdCnic = s.guardian_id_card.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
            if (cleanStdCnic === cleanParentCnic) return true;
          }
          if (cleanParentCnic && (s.father_cnic || s.mother_cnic)) {
            const cleanFatherCnic = s.father_cnic ? s.father_cnic.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
            const cleanMotherCnic = s.mother_cnic ? s.mother_cnic.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
            if (cleanFatherCnic === cleanParentCnic || cleanMotherCnic === cleanParentCnic) return true;
          }
          if (parentEmail && s.guardian_email && s.guardian_email.trim().toLowerCase() === parentEmail) {
            return true;
          }
          if (parentPhone && s.guardian_phone && s.guardian_phone.trim() === parentPhone) {
            return true;
          }
          return false;
        });

        const childBatchIds = new Set<string>();
        for (const child of children) {
          if (child.batch_id) childBatchIds.add(child.batch_id);
          const enrollments = await store.getStudentEnrollments(user.tenant_id, child.id);
          for (const enr of enrollments) {
            if ((enr.status === 'active' || enr.status === 'on_leave') && enr.batch_id) {
              childBatchIds.add(enr.batch_id);
            }
          }
        }

        if (batch_id) {
          if (!childBatchIds.has(batch_id)) {
            return reply.status(403).send({
              success: false,
              error: { code: 'FORBIDDEN', message: 'None of your children attend this batch.' },
              timestamp: new Date().toISOString(),
            });
          }
          const assignments = await store.getHomework(user.tenant_id, batch_id);
          return reply.send({ success: true, data: assignments, timestamp: new Date().toISOString() });
        }

        if (childBatchIds.size === 0) {
          return reply.send({ success: true, data: [], timestamp: new Date().toISOString() });
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

      const rawBatchId = typeof request.body?.batch_id === 'string' ? request.body.batch_id.trim() : '';
      if (!rawBatchId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'BATCH_REQUIRED', message: 'Target batch/class is required.' },
          timestamp: new Date().toISOString(),
        });
      }

      const schema = z.object({
        batch_id: z.string().trim().min(1, 'Target batch/class is required.'),
        subject_id: z.string().trim().min(1, 'Subject is required.'),
        title: z.string().trim().min(1, 'Title is required.'),
        description: z.string().trim().min(1, 'Description is required.'),
        assigned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        attachment_url: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
      }).refine(data => data.due_date >= data.assigned_date, {
        message: 'Due date cannot be before assigned date',
        path: ['due_date'],
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid homework assignment payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const batches = await store.getBatches(user.tenant_id);
      const batchExists = batches.some(b => b.id === parse.data.batch_id);
      if (!batchExists) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_BATCH', message: 'Target batch/class does not exist.' },
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

      const tenantUsers = await store.getTenantUsers(user.tenant_id);
      const authorUser = tenantUsers.find(u => u.id === (user.sub || user.user_id) || (u.email && u.email.toLowerCase() === (user.email || '').toLowerCase()));
      const teacherName = authorUser?.full_name || (user as any).full_name || 'Teacher';

      const homework = await store.createHomework({
        tenant_id: user.tenant_id,
        teacher_id: user.sub || user.user_id || 'teacher-user',
        teacher_name: teacherName,
        ...parse.data,
      });

      return reply.status(201).send({ success: true, data: homework, timestamp: new Date().toISOString() });
    };
    fastify.post('/', createHomeworkHandler);
    fastify.post('/homework', createHomeworkHandler);

    // --- PATCH Homework Assignment ---
    const patchHomeworkHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (user.role === 'student' || user.role === 'parent') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Students and parents cannot edit homework.' },
          timestamp: new Date().toISOString(),
        });
      }
      if (!assertFeature(user, 'homework', 'edit', reply)) return;

      const { id } = request.params as { id: string };
      const allHw = await store.getHomework(user.tenant_id);
      const existing = allHw.find(h => h.id === id);
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Homework assignment not found.' },
          timestamp: new Date().toISOString(),
        });
      }

      const scope = batchScope(user);
      if (scope !== 'all' && !scope.includes(existing.batch_id)) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_BATCH', message: 'You are not assigned to this batch.' },
          timestamp: new Date().toISOString(),
        });
      }

      if (request.body && 'batch_id' in request.body) {
        const rawBatchId = typeof request.body.batch_id === 'string' ? request.body.batch_id.trim() : '';
        if (!rawBatchId) {
          return reply.status(400).send({
            success: false,
            error: { code: 'BATCH_REQUIRED', message: 'Target batch/class cannot be blank.' },
            timestamp: new Date().toISOString(),
          });
        }
      }

      const schema = z.object({
        batch_id: z.string().trim().min(1, 'Target batch/class cannot be blank.').optional(),
        subject_id: z.string().trim().min(1).optional(),
        title: z.string().trim().min(1).optional(),
        description: z.string().trim().min(1).optional(),
        assigned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        attachment_url: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
      }).refine(data => {
        const assigned = data.assigned_date || existing.assigned_date;
        const due = data.due_date || existing.due_date;
        return due >= assigned;
      }, {
        message: 'Due date cannot be before assigned date',
        path: ['due_date'],
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid homework update payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      if (parse.data.batch_id) {
        const batches = await store.getBatches(user.tenant_id);
        const batchExists = batches.some(b => b.id === parse.data.batch_id);
        if (!batchExists) {
          return reply.status(400).send({
            success: false,
            error: { code: 'INVALID_BATCH', message: 'Target batch/class does not exist.' },
            timestamp: new Date().toISOString(),
          });
        }
        if (scope !== 'all' && !scope.includes(parse.data.batch_id)) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN_BATCH', message: 'You are not assigned to target batch.' },
            timestamp: new Date().toISOString(),
          });
        }
      }

      const tenantUsers = await store.getTenantUsers(user.tenant_id);
      const authorUser = tenantUsers.find(u => u.id === existing.teacher_id || (u.email && u.email.toLowerCase() === existing.teacher_id.toLowerCase()));
      const teacherName = authorUser?.full_name || (existing.teacher_name && !existing.teacher_name.includes('@') ? existing.teacher_name : 'Teacher');

      const updated = await store.updateHomework(user.tenant_id, id, {
        ...parse.data,
        teacher_name: teacherName,
      });

      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    };
    fastify.patch('/:id', patchHomeworkHandler);
    fastify.patch('/homework/:id', patchHomeworkHandler);

    // --- DELETE Homework Assignment ---
    const deleteHomeworkHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (user.role === 'student' || user.role === 'parent') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Students and parents cannot delete homework.' },
          timestamp: new Date().toISOString(),
        });
      }
      if (!assertFeature(user, 'homework', 'edit', reply)) return;

      const { id } = request.params as { id: string };
      const allHw = await store.getHomework(user.tenant_id);
      const existing = allHw.find(h => h.id === id);
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Homework assignment not found.' },
          timestamp: new Date().toISOString(),
        });
      }

      const scope = batchScope(user);
      if (scope !== 'all' && !scope.includes(existing.batch_id)) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_BATCH', message: 'You are not assigned to this batch.' },
          timestamp: new Date().toISOString(),
        });
      }

      await store.deleteHomework(user.tenant_id, id);
      return reply.send({
        success: true,
        message: 'Homework assignment and notebook checks removed.',
        timestamp: new Date().toISOString(),
      });
    };
    fastify.delete('/:id', deleteHomeworkHandler);
    fastify.delete('/homework/:id', deleteHomeworkHandler);

    // --- Homework Roster ---
    const getRosterHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (user.role === 'student' || user.role === 'parent') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied.' },
          timestamp: new Date().toISOString(),
        });
      }
      if (!assertFeature(user, 'homework', 'view', reply)) return;

      const { id } = request.params as { id: string };
      const allHw = await store.getHomework(user.tenant_id);
      const existing = allHw.find(h => h.id === id);
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Homework assignment not found.' },
          timestamp: new Date().toISOString(),
        });
      }

      const scope = batchScope(user);
      if (scope !== 'all' && !scope.includes(existing.batch_id)) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_BATCH', message: 'You are not assigned to this batch.' },
          timestamp: new Date().toISOString(),
        });
      }

      const roster = await store.getHomeworkRoster(user.tenant_id, id);
      return reply.send({ success: true, data: roster, timestamp: new Date().toISOString() });
    };
    fastify.get('/:id/roster', getRosterHandler);
    fastify.get('/homework/:id/roster', getRosterHandler);

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
      const allHw = await store.getHomework(user.tenant_id);
      const hw = allHw.find(h => h.id === id);
      if (!hw) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Homework assignment not found.' },
          timestamp: new Date().toISOString(),
        });
      }

      const scope = batchScope(user);
      if (scope !== 'all' && !scope.includes(hw.batch_id)) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_BATCH', message: 'You are not assigned to this batch.' },
          timestamp: new Date().toISOString(),
        });
      }

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
      const allHw = await store.getHomework(user.tenant_id);
      const hw = allHw.find(h => h.id === id);
      if (!hw) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Homework assignment not found.' },
          timestamp: new Date().toISOString(),
        });
      }

      const scope = batchScope(user);
      if (scope !== 'all' && !scope.includes(hw.batch_id)) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_BATCH', message: 'You are not assigned to this batch.' },
          timestamp: new Date().toISOString(),
        });
      }

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

      try {
        const results = await store.recordNotebookChecks(
          user.tenant_id,
          id,
          parse.data.checks,
          (user as any).full_name || user.email || user.sub
        );
        return reply.status(201).send({ success: true, data: results, timestamp: new Date().toISOString() });
      } catch (err: any) {
        if (err.code === 'STUDENT_NOT_IN_CLASS' || err.statusCode === 400) {
          return reply.status(400).send({
            success: false,
            error: { code: 'STUDENT_NOT_IN_CLASS', message: err.message },
            timestamp: new Date().toISOString(),
          });
        }
        if (err.code === 'NOT_FOUND' || err.statusCode === 404) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: err.message },
            timestamp: new Date().toISOString(),
          });
        }
        throw err;
      }
    };
    fastify.post('/:id/checks', recordChecksHandler);
    fastify.post('/homework/:id/checks', recordChecksHandler);
  };
}
