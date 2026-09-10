import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload } from '@apex/shared-types';

export function geofenceRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    // --- Geofence Configuration ---
    const getConfigHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const config = await store.getGeofenceConfig(user.tenant_id);
      return reply.send({ success: true, data: config, timestamp: new Date().toISOString() });
    };
    fastify.get('/config', getConfigHandler);
    fastify.get('/geofence/config', getConfigHandler);

    const updateConfigHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        campus_name: z.string().optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        radius_meters: z.number().int().min(10).max(5000).optional(),
        shift_start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).optional(),
        shift_end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).optional(),
        grace_period_minutes: z.number().int().min(0).max(120).optional(),
        half_day_hours: z.number().min(1).max(12).optional(),
        enforcement_mode: z.enum(['strict', 'flagged']).optional(),
        multi_room_enabled: z.boolean().optional(),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid geofence config data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const updated = await store.updateGeofenceConfig(user.tenant_id, parse.data);
      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    };
    fastify.put('/config', updateConfigHandler);
    fastify.put('/geofence/config', updateConfigHandler);

    // --- Staff Attendance & Geofence Verification ---
    const clockInHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Valid GPS coordinates required', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const record = await store.staffClockIn(
          user.tenant_id,
          user.sub || user.user_id || 'staff-user',
          user.email.split('@')[0],
          parse.data.latitude,
          parse.data.longitude
        );
        return reply.status(201).send({ success: true, data: record, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(403).send({
          success: false,
          error: { code: 'GEOFENCE_REJECTED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.post('/clock-in', clockInHandler);
    fastify.post('/attendance/staff/clock-in', clockInHandler);

    // Clock-Out
    const clockOutHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Valid GPS coordinates required', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const record = await store.staffClockOut(
          user.tenant_id,
          user.sub || user.user_id || 'staff-user',
          parse.data.latitude,
          parse.data.longitude
        );
        return reply.send({ success: true, data: record, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'CLOCK_OUT_FAILED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.post('/clock-out', clockOutHandler);
    fastify.post('/attendance/staff/clock-out', clockOutHandler);

    const getStaffAttendanceHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { date } = request.query as { date?: string };
      const records = await store.getStaffAttendance(user.tenant_id, date);
      return reply.send({ success: true, data: records, timestamp: new Date().toISOString() });
    };
    fastify.get('/staff', getStaffAttendanceHandler);
    fastify.get('/attendance/staff', getStaffAttendanceHandler);

    // Roster of all staff for a specific date (Muster Roll)
    const getStaffRosterHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { date } = request.query as { date?: string };
      const roster = await store.getStaffRoster(user.tenant_id, date);
      return reply.send({ success: true, data: roster, timestamp: new Date().toISOString() });
    };
    fastify.get('/roster', getStaffRosterHandler);
    fastify.get('/attendance/roster', getStaffRosterHandler);

    // Manual Regularization / Attendance Override Entry
    const manualAttendanceHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (user.role !== 'tenant_admin' && user.role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only campus administrators can regularize staff attendance.' },
          timestamp: new Date().toISOString(),
        });
      }

      const schema = z.object({
        staff_id: z.string().min(1),
        staff_name: z.string().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: z.enum(['on_time', 'late', 'half_day', 'absent', 'on_leave']),
        clock_in_time: z.string().optional(),
        clock_out_time: z.string().optional(),
        reason: z.string().min(3),
        verification_mode: z.enum(['manual_regularization', 'biometric_sync']).optional(),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid attendance regularization data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const record = await store.manualStaffAttendance(user.tenant_id, {
          ...parse.data,
          adjusted_by: user.email,
        });
        return reply.status(201).send({ success: true, data: record, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'REGULARIZATION_FAILED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.post('/staff/manual', manualAttendanceHandler);
    fastify.post('/attendance/staff/manual', manualAttendanceHandler);

    // Admin Adjustment
    const adjustStaffAttendanceHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };
      const schema = z.object({
        status: z.enum(['on_time', 'late', 'half_day', 'absent', 'on_leave']),
        notes: z.string().min(3),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Status and justification notes required', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const record = await store.adjustStaffAttendance(
          user.tenant_id,
          id,
          parse.data.status,
          `${parse.data.notes} (Adjusted by ${user.email})`
        );
        return reply.send({ success: true, data: record, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.patch('/staff/:id/adjust', adjustStaffAttendanceHandler);
    fastify.patch('/attendance/staff/:id/adjust', adjustStaffAttendanceHandler);
  };
}
