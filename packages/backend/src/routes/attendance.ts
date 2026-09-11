import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload } from '@apex/shared-types';

export function attendanceRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    const assertRole = (user: JWTPayload, allowedRoles: string[], reply: any): boolean => {
      if (!allowedRoles.includes(user.role) && user.role !== 'super_admin') {
        reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. You do not have permission to perform this attendance operation.' },
          timestamp: new Date().toISOString(),
        });
        return false;
      }
      return true;
    };

    // --- Student Attendance ---
    const getStudentAttendanceHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { batch_id, date, student_id } = request.query as { batch_id?: string; date?: string; student_id?: string };
      const studentId = (request.params as any)?.studentId || student_id;

      if (studentId) {
        const records = await store.getStudentAttendanceHistory(user.tenant_id, studentId);
        return reply.send({ success: true, data: records, timestamp: new Date().toISOString() });
      }

      if (!batch_id || !date) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'batch_id and date query params are required when student_id is not specified' },
          timestamp: new Date().toISOString(),
        });
      }

      const records = await store.getStudentAttendance(user.tenant_id, batch_id, date);
      return reply.send({ success: true, data: records, timestamp: new Date().toISOString() });
    };
    fastify.get('/students', getStudentAttendanceHandler);
    fastify.get('/attendance/students', getStudentAttendanceHandler);
    fastify.get('/students/:studentId', getStudentAttendanceHandler);
    fastify.get('/attendance/students/:studentId', getStudentAttendanceHandler);

    // Rapid batch attendance submission
    const recordBatchHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin', 'academic_head', 'teacher'], reply)) return;
      const schema = z.object({
        batch_id: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        records: z.array(z.object({
          student_id: z.string().min(1),
          status: z.enum(['present', 'absent', 'late', 'excused']),
          remarks: z.string().optional(),
        })).min(1),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid attendance submission payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const saved = await store.recordBatchAttendance(
        user.tenant_id,
        parse.data.batch_id,
        parse.data.date,
        parse.data.records,
        user.email
      );

      return reply.status(201).send({ success: true, data: saved, timestamp: new Date().toISOString() });
    };
    fastify.post('/students/batch', recordBatchHandler);
    fastify.post('/attendance/students/batch', recordBatchHandler);

    // --- Leave Applications ---
    const getLeavesHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { student_id } = request.query as { student_id?: string };
      const leaves = await store.getLeaveApplications(user.tenant_id, student_id);
      return reply.send({ success: true, data: leaves, timestamp: new Date().toISOString() });
    };
    fastify.get('/leaves', getLeavesHandler);

    const submitLeaveHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        student_id: z.string().min(1),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        category: z.enum(['medical', 'personal', 'emergency']),
        reason: z.string().min(3),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid leave application data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const leave = await store.submitLeaveApplication({
        tenant_id: user.tenant_id,
        ...parse.data,
      });

      return reply.status(201).send({ success: true, data: leave, timestamp: new Date().toISOString() });
    };
    fastify.post('/leaves', submitLeaveHandler);

    const reviewLeaveHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin', 'academic_head'], reply)) return;
      const { id } = request.params as { id: string };
      const schema = z.object({
        status: z.enum(['approved', 'rejected']),
        review_notes: z.string().optional(),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid leave review payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const updated = await store.reviewLeaveApplication(
          user.tenant_id,
          id,
          parse.data.status,
          parse.data.review_notes,
          user.email
        );
        return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.patch('/leaves/:id/review', reviewLeaveHandler);

    // --- Staff Leaves ---
    const getStaffLeavesHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { staff_id } = request.query as { staff_id?: string };
      let effectiveStaffId = staff_id;
      if (!['tenant_admin', 'academic_head', 'super_admin'].includes(user.role)) {
        effectiveStaffId = user.sub || (user as any).user_id;
      }
      const leaves = await store.getStaffLeaves(user.tenant_id, effectiveStaffId);
      return reply.send({ success: true, data: leaves, timestamp: new Date().toISOString() });
    };
    fastify.get('/staff-leaves', getStaffLeavesHandler);

    const submitStaffLeaveHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        staff_id: z.string().min(1),
        staff_name: z.string().optional(),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        category: z.enum(['medical', 'casual', 'official_duty', 'emergency', 'annual']),
        reason: z.string().min(3),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid staff leave application data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      if (!['tenant_admin', 'academic_head', 'super_admin'].includes(user.role)) {
        const myId = user.sub || (user as any).user_id;
        if (parse.data.staff_id !== myId) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'You may only submit leave applications for yourself.' },
            timestamp: new Date().toISOString(),
          });
        }
      }

      const leave = await store.submitStaffLeave({
        tenant_id: user.tenant_id,
        ...parse.data,
      });

      return reply.status(201).send({ success: true, data: leave, timestamp: new Date().toISOString() });
    };
    fastify.post('/staff-leaves', submitStaffLeaveHandler);

    const reviewStaffLeaveHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin', 'academic_head'], reply)) return;
      const { id } = request.params as { id: string };
      const schema = z.object({
        status: z.enum(['approved', 'rejected']),
        review_notes: z.string().optional(),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid staff leave review payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const updated = await store.reviewStaffLeave(
          user.tenant_id,
          id,
          parse.data.status,
          parse.data.review_notes,
          user.email
        );
        return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.patch('/staff-leaves/:id/review', reviewStaffLeaveHandler);
  };
}
