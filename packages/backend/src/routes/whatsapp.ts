import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload, WhatsAppTemplateCategory, WhatsAppPhoneType } from '@apex/shared-types';

export function whatsappRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    // =========================================================================
    // 1. TEMPLATES MANAGEMENT
    // =========================================================================
    const getTemplatesHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { category } = request.query as { category?: string };
      const templates = await store.getWhatsAppTemplates(user.tenant_id, category);
      return reply.send({ success: true, data: templates, timestamp: new Date().toISOString() });
    };
    fastify.get('/templates', getTemplatesHandler);
    fastify.get('/whatsapp/templates', getTemplatesHandler);

    const createTemplateHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        title: z.string().min(1),
        category: z.enum(['ABSENCE', 'FEE_REMINDER', 'EXAM_RESULT', 'GENERAL']),
        body: z.string().min(1),
        is_default: z.boolean().default(false)
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid template payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString()
        });
      }

      const template = await store.createWhatsAppTemplate(user.tenant_id, parse.data);
      return reply.status(201).send({ success: true, data: template, timestamp: new Date().toISOString() });
    };
    fastify.post('/templates', createTemplateHandler);
    fastify.post('/whatsapp/templates', createTemplateHandler);

    const updateTemplateHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };
      const schema = z.object({
        title: z.string().optional(),
        category: z.enum(['ABSENCE', 'FEE_REMINDER', 'EXAM_RESULT', 'GENERAL']).optional(),
        body: z.string().optional(),
        is_default: z.boolean().optional()
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid template updates', details: parse.error.flatten() },
          timestamp: new Date().toISOString()
        });
      }

      const template = await store.updateWhatsAppTemplate(user.tenant_id, id, parse.data);
      if (!template) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Template not found' },
          timestamp: new Date().toISOString()
        });
      }
      return reply.send({ success: true, data: template, timestamp: new Date().toISOString() });
    };
    fastify.put('/templates/:id', updateTemplateHandler);
    fastify.put('/whatsapp/templates/:id', updateTemplateHandler);

    const deleteTemplateHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };
      const success = await store.deleteWhatsAppTemplate(user.tenant_id, id);
      if (!success) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Template not found' },
          timestamp: new Date().toISOString()
        });
      }
      return reply.send({ success: true, message: 'Template deleted', timestamp: new Date().toISOString() });
    };
    fastify.delete('/templates/:id', deleteTemplateHandler);
    fastify.delete('/whatsapp/templates/:id', deleteTemplateHandler);

    // =========================================================================
    // 2. PHONE SANITIZATION & DYNAMIC LINK GENERATOR
    // =========================================================================
    const generateLinkHandler = async (request: any, reply: any) => {
      const schema = z.object({
        phone: z.string().min(1),
        message: z.string().min(1),
        country_code: z.string().optional()
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid phone or message', details: parse.error.flatten() },
          timestamp: new Date().toISOString()
        });
      }

      const result = store.generateWhatsAppLink(parse.data.phone, parse.data.message, parse.data.country_code);
      return reply.send({ success: true, data: result, timestamp: new Date().toISOString() });
    };
    fastify.post('/generate-link', generateLinkHandler);
    fastify.post('/whatsapp/generate-link', generateLinkHandler);

    // =========================================================================
    // 3. CHECK DUPLICATE & DISPATCH AUDIT LOG
    // =========================================================================
    const checkDuplicateHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { student_id, category } = request.query as { student_id: string; category: string };
      const check = await store.checkDuplicateAlertToday(user.tenant_id, student_id, category || 'ABSENCE');
      return reply.send({ success: true, data: check, timestamp: new Date().toISOString() });
    };
    fastify.get('/check-duplicate', checkDuplicateHandler);
    fastify.get('/whatsapp/check-duplicate', checkDuplicateHandler);

    const dispatchLogHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        student_id: z.string().min(1),
        recipient_phone: z.string().min(1),
        phone_type: z.enum(['PRIMARY', 'BACKUP']).default('PRIMARY'),
        template_id: z.string().optional().nullable(),
        message_body: z.string().min(1),
        status: z.enum(['OPENED', 'SENT', 'FAILED']).default('OPENED')
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid dispatch payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString()
        });
      }

      const log = await store.logWhatsAppDispatch(user.tenant_id, {
        ...parse.data,
        dispatched_by: user.sub
      });

      // Also generate the sanitized URL
      const link = store.generateWhatsAppLink(parse.data.recipient_phone, parse.data.message_body);

      return reply.status(201).send({
        success: true,
        data: { log, link },
        timestamp: new Date().toISOString()
      });
    };
    fastify.post('/dispatch', dispatchLogHandler);
    fastify.post('/whatsapp/dispatch', dispatchLogHandler);

    const getAuditLogsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { student_id } = request.query as { student_id?: string };
      const logs = await store.getWhatsAppAuditLogs(user.tenant_id, student_id);
      return reply.send({ success: true, data: logs, timestamp: new Date().toISOString() });
    };
    fastify.get('/audit-logs', getAuditLogsHandler);
    fastify.get('/whatsapp/audit-logs', getAuditLogsHandler);
  };
}
