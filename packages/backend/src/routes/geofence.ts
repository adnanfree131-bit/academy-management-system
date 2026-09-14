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
      if (user.role !== 'tenant_admin' && user.role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only campus administrators can configure geofence rules.' },
          timestamp: new Date().toISOString(),
        });
      }

      const headSchema = z.object({
        id: z.string(),
        name: z.string().min(1),
        code: z.string().min(1),
        category: z.enum(['present', 'late', 'half_day', 'leave', 'absent']),
        paid: z.boolean(),
        priority: z.number().int().min(1).optional(),
        trigger: z.object({
          type: z.enum(['check_in_after', 'check_in_before', 'hours_below', 'hours_at_least', 'no_check_in', 'manual_only']),
          time: z.string().optional(),
          hours: z.number().optional(),
        }),
        is_active: z.boolean().optional(),
      });

      const schema = z.object({
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        radius_meters: z.number().int().min(10).max(5000).optional(),
        enforcement_mode: z.enum(['strict', 'flagged']).optional(),
        heads: z.array(headSchema).optional(),
        attendance_heads: z.array(z.any()).optional(),
        multi_room_enabled: z.boolean().optional(),
        // optional legacy fields
        campus_name: z.string().optional(),
        shift_start_time: z.string().optional(),
        shift_end_time: z.string().optional(),
        grace_period_minutes: z.number().optional(),
        late_threshold_minutes: z.number().optional(),
        half_day_hours: z.number().optional(),
        full_day_min_hours: z.number().optional(),
        early_departure_minutes: z.number().optional(),
        lates_for_leave_deduction: z.number().optional(),
        late_penalty_rule: z.enum(['none', 'deduct_casual_leave', 'deduct_half_day_salary', 'deduct_full_day_salary']).optional(),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid geofence config data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const updated = await store.updateGeofenceConfig(user.tenant_id, parse.data as any);
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
        const staffUser = await store.getUserByEmail(user.tenant_id, user.email);
        const staffName = staffUser?.full_name || user.email.split('@')[0];
        const record = await store.staffClockIn(
          user.tenant_id,
          user.sub || user.user_id || 'staff-user',
          staffName,
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

    // Monthly Staff Attendance Summary (for HR & Payroll)
    const getStaffMonthlySummaryHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { month } = request.query as { month?: string };
      const monthStr = month && /^\d{4}-\d{2}$/.test(month) 
        ? month 
        : new Date().toISOString().slice(0, 7);
      const summary = await store.getStaffMonthlySummary(user.tenant_id, monthStr);
      return reply.send({ success: true, data: summary, timestamp: new Date().toISOString() });
    };
    fastify.get('/monthly-summary', getStaffMonthlySummaryHandler);
    fastify.get('/attendance/monthly-summary', getStaffMonthlySummaryHandler);

    // Attendance Audit Logs / Regularization History
    const getAuditLogsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { staff_id, date, start_date, end_date } = request.query as {
        staff_id?: string;
        date?: string;
        start_date?: string;
        end_date?: string;
      };
      const logs = await store.getStaffAttendanceAuditLogs(user.tenant_id, {
        staff_id,
        date,
        start_date,
        end_date,
      });
      return reply.send({ success: true, data: logs, timestamp: new Date().toISOString() });
    };
    fastify.get('/audit-logs', getAuditLogsHandler);
    fastify.get('/attendance/audit-logs', getAuditLogsHandler);

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
        head_id: z.string().optional(),
        clock_in_time: z.string().optional(),
        clock_out_time: z.string().optional(),
        reason: z.string().min(3),
        verification_mode: z.enum(['manual_regularization', 'official_duty']).optional(),
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

    // --- Faculty Self-Service Regularization Requests ---
    const getRegularizationRequestsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const query = request.query as { staff_id?: string; status?: string };
      const isAdmin = user.role === 'tenant_admin' || user.role === 'super_admin';
      const userId = user.sub || user.user_id || 'staff-user';
      const targetStaffId = isAdmin ? query.staff_id : userId;

      const requests = await store.getStaffRegularizationRequests(user.tenant_id, {
        staff_id: targetStaffId,
        status: query.status,
      });
      return reply.send({ success: true, data: requests, timestamp: new Date().toISOString() });
    };
    fastify.get('/attendance/regularization/requests', getRegularizationRequestsHandler);
    fastify.get('/attendance/regularization-requests', getRegularizationRequestsHandler);

    const submitRegularizationRequestHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const isAdmin = user.role === 'tenant_admin' || user.role === 'super_admin';

      const schema = z.object({
        staff_id: z.string().optional(),
        staff_name: z.string().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        clock_in_time: z.string().optional(),
        clock_out_time: z.string().optional(),
        reason_type: z.string().min(2),
        notes: z.string().optional(),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid regularization request data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const userId = user.sub || user.user_id || 'staff-user';
      const assignedStaffId = !isAdmin || !parse.data.staff_id ? userId : parse.data.staff_id;

      try {
        const record = await store.submitStaffRegularizationRequest(user.tenant_id, {
          ...parse.data,
          staff_id: assignedStaffId,
        });
        return reply.status(201).send({ success: true, data: record, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'SUBMIT_FAILED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.post('/attendance/regularization/requests', submitRegularizationRequestHandler);
    fastify.post('/attendance/regularization-requests', submitRegularizationRequestHandler);

    const reviewRegularizationRequestHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (user.role !== 'tenant_admin' && user.role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only administrators can approve or reject regularization requests.' },
          timestamp: new Date().toISOString(),
        });
      }

      const { id } = request.params as { id: string };
      const schema = z.object({
        action: z.enum(['approved', 'rejected']),
        review_notes: z.string().optional(),
        head_id: z.string().optional(),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Action (approved/rejected) is required', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const reviewed = await store.reviewStaffRegularizationRequest(
          user.tenant_id,
          id,
          parse.data.action,
          user.email,
          parse.data.review_notes,
          parse.data.head_id
        );
        return reply.send({ success: true, data: reviewed, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'REVIEW_FAILED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.post('/attendance/regularization/requests/:id/review', reviewRegularizationRequestHandler);
    fastify.post('/attendance/regularization-requests/:id/review', reviewRegularizationRequestHandler);
  };
}
