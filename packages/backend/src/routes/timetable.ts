import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload, DayOfWeek } from '@apex/shared-types';

const dayOfWeekEnum = z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

export function timetableRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    const assertRole = (user: JWTPayload, allowedRoles: string[], reply: any): boolean => {
      if (!allowedRoles.includes(user.role) && user.role !== 'super_admin') {
        reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. You do not have permission to perform this timetable operation.' },
          timestamp: new Date().toISOString(),
        });
        return false;
      }
      return true;
    };

    // --- Rooms ---
    const getRoomsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const rooms = await store.getRooms(user.tenant_id);
      return reply.send({ success: true, data: rooms, timestamp: new Date().toISOString() });
    };
    fastify.get('/rooms', getRoomsHandler);

    fastify.post('/rooms', async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin', 'academic_head'], reply)) return;
      const schema = z.object({
        name: z.string().min(1),
        capacity: z.number().int().min(1).default(40),
        is_active: z.boolean().default(true),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid room data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const room = await store.createRoom({
        tenant_id: user.tenant_id,
        ...parse.data,
      });

      return reply.status(201).send({ success: true, data: room, timestamp: new Date().toISOString() });
    });

    // --- Timetable Slots ---
    const getSlotsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { batch_id, day, date } = request.query as { batch_id?: string; day?: DayOfWeek; date?: string };
      const slots = await store.getTimetable(user.tenant_id, batch_id, day, date);
      return reply.send({ success: true, data: slots, timestamp: new Date().toISOString() });
    };
    fastify.get('/', getSlotsHandler);
    fastify.get('/timetable', getSlotsHandler);

    // Pre-flight collision checker endpoint
    const checkCollisionHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        batchId: z.string().min(1),
        teacherId: z.string().min(1),
        roomId: z.string().nullable().optional(),
        dayOfWeek: dayOfWeekEnum,
        startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
        endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
        excludeSlotId: z.string().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid collision check payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const result = await store.checkCollision(user.tenant_id, parse.data);
      return reply.send({ success: true, data: result, timestamp: new Date().toISOString() });
    };
    fastify.post('/check-collision', checkCollisionHandler);
    fastify.post('/timetable/check-collision', checkCollisionHandler);

    // Create Timetable Slot
    const createSlotHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin', 'academic_head'], reply)) return;
      const schema = z.object({
        batch_id: z.string().min(1),
        subject_id: z.string().min(1),
        teacher_id: z.string().min(1),
        room_id: z.string().nullable().optional(),
        day_of_week: dayOfWeekEnum,
        start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
        end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid slot data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const slot = await store.createTimetableSlot({
          tenant_id: user.tenant_id,
          ...parse.data,
        });
        return reply.status(201).send({ success: true, data: slot, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(409).send({
          success: false,
          error: { code: 'COLLISION_ERROR', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.post('/', createSlotHandler);
    fastify.post('/timetable', createSlotHandler);

    // Assign Substitute Teacher (Dated Overrides)
    const substituteHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin', 'academic_head'], reply)) return;
      const { id } = request.params as { id: string };
      const schema = z.object({
        substitute_teacher_id: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        reason: z.string().optional()
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid substitute payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const slot = await store.assignSubstitute(
          user.tenant_id,
          id,
          parse.data.substitute_teacher_id,
          parse.data.date,
          parse.data.reason
        );
        return reply.send({ success: true, data: slot, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'SUBSTITUTE_ERROR', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.post('/:id/substitute', substituteHandler);
    fastify.post('/timetable/:id/substitute', substituteHandler);

    // Delete Timetable Slot
    const deleteSlotHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin', 'academic_head'], reply)) return;
      const { id } = request.params as { id: string };
      const ok = await store.deleteTimetableSlot(user.tenant_id, id);
      if (!ok) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Timetable slot not found' },
          timestamp: new Date().toISOString()
        });
      }
      return reply.send({ success: true, message: 'Slot deleted', timestamp: new Date().toISOString() });
    };
    fastify.delete('/:id', deleteSlotHandler);
    fastify.delete('/timetable/:id', deleteSlotHandler);

    // Available Teachers Lookup
    const availableTeachersHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { day, start_time, end_time, date } = request.query as { day: DayOfWeek; start_time: string; end_time: string; date?: string };

      if (!day || !start_time || !end_time) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'day, start_time, and end_time query params are required' },
          timestamp: new Date().toISOString(),
        });
      }

      const teachers = await store.getAvailableTeachers(user.tenant_id, day, start_time, end_time, date);
      return reply.send({ success: true, data: teachers, timestamp: new Date().toISOString() });
    };
    fastify.get('/available-teachers', availableTeachersHandler);
    fastify.get('/timetable/available-teachers', availableTeachersHandler);
  };
}
