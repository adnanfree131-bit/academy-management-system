import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload, ComplaintTicket } from '@apex/shared-types';
import { can } from '../lib/access.js';

export function complaintsRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    // Helper to resolve student & primary batch metadata
    const resolveStudentAndBatch = async (tenantId: string, studentId: string) => {
      const students = await store.getStudents(tenantId);
      const student = students.find(s => s.id === studentId);
      if (!student) return null;

      let batchId = student.batch_id || null;
      let batchName: string | null = (student as any).batch_name || null;
      const enrollments = await store.getStudentEnrollments(tenantId, student.id);
      const primaryEnr = enrollments.find(e => e.is_primary && (e.status === 'active' || e.status === 'on_leave'))
        || enrollments.find(e => e.status === 'active' || e.status === 'on_leave')
        || enrollments.find(e => e.is_primary)
        || enrollments[0];
      if (primaryEnr?.batch_id) {
        batchId = primaryEnr.batch_id;
      }
      if (batchId) {
        const batches = await store.getBatches(tenantId);
        const b = batches.find(bat => bat.id === batchId);
        if (b) batchName = b.name;
      }
      return {
        student_id: student.id,
        student_name: student.full_name,
        batch_id: batchId,
        batch_name: batchName,
      };
    };

    // Helper to resolve student record for student role
    const getLinkedStudentForStudent = async (tenantId: string, user: JWTPayload, dbUser: any) => {
      const students = await store.getStudents(tenantId);
      const userId = user.sub || (user as any).user_id;
      const tokenStudentId = (user as any).student_id || ((user as any).metadata as any)?.student_id || (dbUser?.metadata as any)?.student_id;
      const userEmail = (user.email || dbUser?.email || '').toLowerCase().trim();

      let meStudent = students.find(s =>
        (tokenStudentId && s.id === tokenStudentId) ||
        (s.user_id && (s.user_id === userId)) ||
        (userEmail && s.email && s.email.toLowerCase().trim() === userEmail)
      );
      if (!meStudent) {
        const metaRoll = (dbUser?.metadata as any)?.roll_number || (user as any).roll_number;
        const metaAdm = (dbUser?.metadata as any)?.admission_number || (user as any).admission_number;
        if (metaRoll || metaAdm) {
          meStudent = students.find(s =>
            (metaRoll && s.roll_number && s.roll_number.toLowerCase() === String(metaRoll).toLowerCase()) ||
            (metaAdm && s.admission_number && s.admission_number.toLowerCase() === String(metaAdm).toLowerCase())
          );
        }
      }
      return meStudent || null;
    };

    // Helper to resolve all linked children for parent role
    const getLinkedStudentsForParent = async (tenantId: string, user: JWTPayload, dbUser: any) => {
      const parentCnic = (dbUser?.metadata as any)?.guardian_id_card ||
        (dbUser?.metadata as any)?.clean_guardian_id_card ||
        (user as any).guardian_id_card ||
        (user as any).cnic ||
        ((user as any).metadata as any)?.guardian_id_card ||
        (dbUser as any)?.cnic ||
        (dbUser as any)?.guardian_id_card;
      const cleanParentCnic = parentCnic ? String(parentCnic).replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;

      const userEmail = (user.email || dbUser?.email || '').toLowerCase().trim();
      const userPhone = ((dbUser as any)?.phone || (user as any).phone || (dbUser?.metadata as any)?.phone || (dbUser?.metadata as any)?.guardian_phone || '').trim();

      const students = await store.getStudents(tenantId);
      const matched = new Map<string, any>();

      for (const s of students) {
        if (cleanParentCnic && s.guardian_id_card) {
          const cleanStdCnic = s.guardian_id_card.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
          if (cleanStdCnic === cleanParentCnic) {
            matched.set(s.id, s);
            continue;
          }
        }
        if (userEmail && s.guardian_email && s.guardian_email.toLowerCase().trim() === userEmail) {
          matched.set(s.id, s);
          continue;
        }
        if (userPhone && s.guardian_phone && s.guardian_phone.trim() === userPhone) {
          matched.set(s.id, s);
          continue;
        }
      }

      const explicitStudentId = (user as any).student_id || ((user as any).metadata as any)?.student_id || (dbUser?.metadata as any)?.student_id;
      if (explicitStudentId && !matched.has(explicitStudentId)) {
        const expChild = students.find(s => s.id === explicitStudentId);
        if (expChild) matched.set(expChild.id, expChild);
      }

      return Array.from(matched.values());
    };

    // Helper to get all accessible child/student IDs for student/parent
    const getMyChildIds = async (tenantId: string, user: JWTPayload, dbUser: any): Promise<Set<string>> => {
      const myChildIds = new Set<string>();
      if (user.role === 'student') {
        const me = await getLinkedStudentForStudent(tenantId, user, dbUser);
        if (me) myChildIds.add(me.id);
      } else if (user.role === 'parent') {
        const children = await getLinkedStudentsForParent(tenantId, user, dbUser);
        for (const child of children) {
          myChildIds.add(child.id);
        }
      }
      return myChildIds;
    };

    // List complaints
    const getComplaintsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      let tickets = await store.getComplaints(user.tenant_id);

      if (user.role === 'student' || user.role === 'parent') {
        const userId = user.sub || (user as any).user_id;
        const dbUser = (userId ? await store.getUserById(user.tenant_id, userId) : null)
          || (user.email ? await store.getUserByEmail(user.tenant_id, user.email) : null);
        const myChildIds = await getMyChildIds(user.tenant_id, user, dbUser);

        tickets = tickets.filter(t => t.user_id === userId || (t.student_id && myChildIds.has(t.student_id)));

        // Remove internal_notes and resolved_by from response DTO so they do not leak
        const sanitized = tickets.map(t => {
          const copy = { ...t };
          delete copy.internal_notes;
          delete copy.resolved_by;
          return copy;
        });

        return reply.send({ success: true, data: sanitized, timestamp: new Date().toISOString() });
      }

      if (!can(user, 'complaints', 'view')) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Requires complaints view permission.' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({ success: true, data: tickets, timestamp: new Date().toISOString() });
    };

    // Get single complaint ticket by ID
    const getComplaintByIdHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };
      const tickets = await store.getComplaints(user.tenant_id);
      const ticket = tickets.find(t => t.id === id);

      if (!ticket) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Complaint ticket not found' },
          timestamp: new Date().toISOString(),
        });
      }

      if (user.role === 'student' || user.role === 'parent') {
        const userId = user.sub || (user as any).user_id;
        const dbUser = (userId ? await store.getUserById(user.tenant_id, userId) : null)
          || (user.email ? await store.getUserByEmail(user.tenant_id, user.email) : null);
        const myChildIds = await getMyChildIds(user.tenant_id, user, dbUser);

        const hasAccess = ticket.user_id === userId || (ticket.student_id && myChildIds.has(ticket.student_id));
        if (!hasAccess) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Complaint ticket not found' },
            timestamp: new Date().toISOString(),
          });
        }

        const copy = { ...ticket };
        delete copy.internal_notes;
        delete copy.resolved_by;
        return reply.send({ success: true, data: copy, timestamp: new Date().toISOString() });
      }

      if (!can(user, 'complaints', 'view')) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Requires complaints view permission.' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({ success: true, data: ticket, timestamp: new Date().toISOString() });
    };

    fastify.get('/', getComplaintsHandler);
    fastify.get('/complaints', getComplaintsHandler);
    fastify.get('/:id', getComplaintByIdHandler);
    fastify.get('/complaints/:id', getComplaintByIdHandler);

    // Create complaint ticket
    const createComplaintHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        category: z.enum(['teaching_quality', 'facility', 'fee_billing', 'disciplinary', 'general']),
        priority: z.enum(['urgent', 'high', 'normal']).default('normal'),
        subject: z.string().min(3),
        description: z.string().min(5),
        student_id: z.string().optional().nullable(),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid complaint ticket data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const userId = user.sub || (user as any).user_id || 'unknown-user';
      const dbUser = (userId !== 'unknown-user' ? await store.getUserById(user.tenant_id, userId) : null)
        || (user.email ? await store.getUserByEmail(user.tenant_id, user.email) : null);
      const rawName = dbUser?.full_name?.trim() || (user as any).full_name?.trim();
      const userName = rawName || user.email || 'User';

      let studentId: string | null = null;
      let studentName: string | null = null;
      let batchId: string | null = null;
      let batchName: string | null = null;

      const isStaff = user.role !== 'student' && user.role !== 'parent';

      if (isStaff) {
        if (parse.data.student_id) {
          const resolved = await resolveStudentAndBatch(user.tenant_id, parse.data.student_id);
          if (!resolved) {
            return reply.status(400).send({
              success: false,
              error: { code: 'STUDENT_NOT_FOUND', message: 'Student not found in tenant' },
              timestamp: new Date().toISOString(),
            });
          }
          studentId = resolved.student_id;
          studentName = resolved.student_name;
          batchId = resolved.batch_id;
          batchName = resolved.batch_name;
        }
      } else if (user.role === 'student') {
        const meStudent = await getLinkedStudentForStudent(user.tenant_id, user, dbUser);
        if (meStudent) {
          const resolved = await resolveStudentAndBatch(user.tenant_id, meStudent.id);
          if (resolved) {
            studentId = resolved.student_id;
            studentName = resolved.student_name;
            batchId = resolved.batch_id;
            batchName = resolved.batch_name;
          }
        }
      } else if (user.role === 'parent') {
        const children = await getLinkedStudentsForParent(user.tenant_id, user, dbUser);
        let selectedChild: any = null;

        if (parse.data.student_id && children.some(c => c.id === parse.data.student_id)) {
          selectedChild = children.find(c => c.id === parse.data.student_id);
        } else if (children.length > 0) {
          selectedChild = children[0];
        }

        if (selectedChild) {
          const resolved = await resolveStudentAndBatch(user.tenant_id, selectedChild.id);
          if (resolved) {
            studentId = resolved.student_id;
            studentName = resolved.student_name;
            batchId = resolved.batch_id;
            batchName = resolved.batch_name;
          }
        }
      }

      const ticket = await store.createComplaint({
        tenant_id: user.tenant_id,
        user_id: userId,
        user_name: userName,
        category: parse.data.category,
        priority: parse.data.priority,
        subject: parse.data.subject,
        description: parse.data.description,
        student_id: studentId,
        student_name: studentName,
        batch_id: batchId,
        batch_name: batchName,
      });

      return reply.status(201).send({ success: true, data: ticket, timestamp: new Date().toISOString() });
    };

    fastify.post('/', createComplaintHandler);
    fastify.post('/complaints', createComplaintHandler);

    // Update status or reply to complaint
    const updateStatusHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!can(user, 'complaints', 'edit')) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. Requires complaints edit permission.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { id } = request.params as { id: string };
      const schema = z.object({
        status: z.enum(['open', 'under_investigation', 'action_taken', 'resolved']).optional(),
        resolution_reply: z.string().optional().nullable(),
        internal_notes: z.string().optional().nullable(),
        priority: z.enum(['urgent', 'high', 'normal']).optional(),
        category: z.enum(['teaching_quality', 'facility', 'fee_billing', 'disciplinary', 'general']).optional(),
        subject: z.string().optional(),
        description: z.string().optional(),
        student_id: z.string().optional().nullable(),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid complaint update payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const extra: Partial<ComplaintTicket> = {};
      if (parse.data.priority !== undefined) extra.priority = parse.data.priority;
      if (parse.data.category !== undefined) extra.category = parse.data.category;
      if (parse.data.subject !== undefined) extra.subject = parse.data.subject;
      if (parse.data.description !== undefined) extra.description = parse.data.description;

      if (parse.data.student_id !== undefined) {
        if (parse.data.student_id) {
          const resolved = await resolveStudentAndBatch(user.tenant_id, parse.data.student_id);
          if (!resolved) {
            return reply.status(400).send({
              success: false,
              error: { code: 'STUDENT_NOT_FOUND', message: 'Student not found in tenant' },
              timestamp: new Date().toISOString(),
            });
          }
          extra.student_id = resolved.student_id;
          extra.student_name = resolved.student_name;
          extra.batch_id = resolved.batch_id;
          extra.batch_name = resolved.batch_name;
        } else {
          extra.student_id = null;
          extra.student_name = null;
          extra.batch_id = null;
          extra.batch_name = null;
        }
      }

      const isResolving = parse.data.status === 'resolved' || Boolean(parse.data.resolution_reply);
      const resolvedByActor = isResolving ? (user.email || user.sub) : undefined;

      try {
        const ticket = await store.updateComplaintStatus(
          user.tenant_id,
          id,
          parse.data.status,
          parse.data.resolution_reply,
          parse.data.internal_notes,
          resolvedByActor,
          extra
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

    fastify.patch('/:id', updateStatusHandler);
    fastify.patch('/complaints/:id', updateStatusHandler);
    fastify.patch('/:id/status', updateStatusHandler);
    fastify.patch('/complaints/:id/status', updateStatusHandler);
  };
}
