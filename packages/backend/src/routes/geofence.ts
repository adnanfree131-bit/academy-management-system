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
        grace_period_minutes: z.number().int().min(0).max(120).optional(),
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

    const getStaffAttendanceHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { date } = request.query as { date?: string };
      const records = await store.getStaffAttendance(user.tenant_id, date);
      return reply.send({ success: true, data: records, timestamp: new Date().toISOString() });
    };
    fastify.get('/staff', getStaffAttendanceHandler);
    fastify.get('/attendance/staff', getStaffAttendanceHandler);

    // Admin Adjustment
    const adjustStaffAttendanceHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };
      const schema = z.object({
        status: z.enum(['on_time', 'late', 'absent', 'on_leave']),
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
