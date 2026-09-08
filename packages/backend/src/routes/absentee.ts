import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload, AbsenteeCallOutcome, AbsenteeReasonCategory, AbsenteeFollowupStatus } from '@apex/shared-types';

export function absenteeRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    // =========================================================================
    // 1. ABSENTEE ROSTER & FOLLOW-UP DESK
    // =========================================================================
    const getFollowupsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { date, batch_id, status } = request.query as { date?: string; batch_id?: string; status?: string };
      const followups = await store.getAbsenteeFollowups(user.tenant_id, {
        date,
        batchId: batch_id,
        status
      });
      return reply.send({ success: true, data: followups, timestamp: new Date().toISOString() });
    };
    fastify.get('/', getFollowupsHandler);
    fastify.get('/absentee', getFollowupsHandler);

    const getKpiHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { date } = request.query as { date?: string };
      const today = date || new Date().toISOString().split('T')[0];
      const kpi = await store.getAbsenteeDeskKPI(user.tenant_id, today);
      return reply.send({ success: true, data: kpi, timestamp: new Date().toISOString() });
    };
    fastify.get('/kpi', getKpiHandler);
    fastify.get('/absentee/kpi', getKpiHandler);

    const syncRosterHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        date: z.string().optional()
      });

      const parse = schema.safeParse(request.body || {});
      const targetDate = parse.success && parse.data?.date ? parse.data.date : new Date().toISOString().split('T')[0];

      const roster = await store.syncDailyAbsenteeRoster(user.tenant_id, targetDate);
      return reply.send({
        success: true,
        data: roster,
        message: `Synced absentee roster for date: ${targetDate}`,
        timestamp: new Date().toISOString()
      });
    };
    fastify.post('/sync', syncRosterHandler);
    fastify.post('/absentee/sync', syncRosterHandler);

    const logResponseHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };

      const schema = z.object({
        call_outcome: z.enum(['CONNECTED', 'NO_ANSWER', 'SWITCHED_OFF', 'WHATSAPP_SENT']),
        reason_category: z.enum(['MEDICAL', 'EMERGENCY', 'TRANSPORT', 'FEE_DISPUTE', 'TRUANCY', 'OTHER']),
        parent_remarks: z.string().optional(),
        expected_return_date: z.string().optional().nullable(),
        convert_to_medical_leave: z.boolean().default(false)
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid response payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString()
        });
      }

      const updated = await store.logParentResponse(
        user.tenant_id,
        id,
        {
          call_outcome: parse.data.call_outcome,
          reason_category: parse.data.reason_category,
          parent_remarks: parse.data.parent_remarks,
          expected_return_date: parse.data.expected_return_date || undefined,
          convert_to_medical_leave: parse.data.convert_to_medical_leave
        },
        user.sub
      );

      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Absentee followup not found' },
          timestamp: new Date().toISOString()
        });
      }

      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    };
    fastify.post('/:id/response', logResponseHandler);
    fastify.post('/absentee/:id/response', logResponseHandler);

    // =========================================================================
    // 2. CHRONIC RETENTION & DROPOUT COUNSELING
    // =========================================================================
    const getRetentionHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const cases = await store.getRetentionCases(user.tenant_id);
      return reply.send({ success: true, data: cases, timestamp: new Date().toISOString() });
    };
    fastify.get('/retention', getRetentionHandler);
    fastify.get('/absentee/retention', getRetentionHandler);

    const scheduleMeetingHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };

      const schema = z.object({
        meeting_date: z.string().min(1),
        notes: z.string().min(1)
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid meeting schedule details', details: parse.error.flatten() },
          timestamp: new Date().toISOString()
        });
      }

      const updated = await store.scheduleRetentionMeeting(user.tenant_id, id, parse.data.meeting_date, parse.data.notes);
      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Retention case not found' },
          timestamp: new Date().toISOString()
        });
      }

      return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
    };
    fastify.post('/retention/:id/meeting', scheduleMeetingHandler);
    fastify.post('/absentee/retention/:id/meeting', scheduleMeetingHandler);

    // =========================================================================
    // 3. ABSENTEE RESOLUTION AUDIT REPORT
    // =========================================================================
    const getReportHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { month } = request.query as { month?: string };
      const targetMonth = month || new Date().toISOString().substring(0, 7); // YYYY-MM
      const report = await store.getAbsenteeResolutionReport(user.tenant_id, targetMonth);
      return reply.send({ success: true, data: report, timestamp: new Date().toISOString() });
    };
    fastify.get('/reports/resolution', getReportHandler);
    fastify.get('/absentee/reports/resolution', getReportHandler);
  };
}
