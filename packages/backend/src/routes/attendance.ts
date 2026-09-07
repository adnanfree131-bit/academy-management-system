import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload } from '@apex/shared-types';

export function attendanceRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    // --- Student Attendance ---
    const getStudentAttendanceHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { batch_id, date } = request.query as { batch_id: string; date: string };

      if (!batch_id || !date) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'batch_id and date query params are required' },
          timestamp: new Date().toISOString(),
        });
      }

      const records = await store.getStudentAttendance(user.tenant_id, batch_id, date);
      return reply.send({ success: true, data: records, timestamp: new Date().toISOString() });
    };
    fastify.get('/students', getStudentAttendanceHandler);
    fastify.get('/attendance/students', getStudentAttendanceHandler);

    // Rapid batch attendance submission
    const recordBatchHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
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
  };
}
