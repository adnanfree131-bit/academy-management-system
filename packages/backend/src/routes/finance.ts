import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload, PaymentMethod, InvoiceStatus } from '@apex/shared-types';

export function financeRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    // =========================================================================
    // 1. FEE HEADS (Itemized Categories)
    // =========================================================================
    const getHeadsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const heads = await store.getFeeHeads(user.tenant_id);
      return reply.send({ success: true, data: heads, timestamp: new Date().toISOString() });
    };
    fastify.get('/heads', getHeadsHandler);
    fastify.get('/finance/heads', getHeadsHandler);

    const createHeadHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        name: z.string().min(1),
        code: z.string().min(1).toUpperCase(),
        is_system_default: z.boolean().default(false),
        default_amount: z.number().min(0).default(0),
        priority_order: z.number().int().min(1).default(1)
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid fee head data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const head = await store.createFeeHead({
        tenant_id: user.tenant_id,
        ...parse.data
      });
      return reply.status(201).send({ success: true, data: head, timestamp: new Date().toISOString() });
    };
    fastify.post('/heads', createHeadHandler);
    fastify.post('/finance/heads', createHeadHandler);

    // =========================================================================
    // 2. PRIORITY CONFIGURATION (Drag-and-Drop Liquidation Order)
    // =========================================================================
    const getPriorityHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const config = await store.getFeePriorityConfig(user.tenant_id);
      return reply.send({ success: true, data: config, timestamp: new Date().toISOString() });
    };
    fastify.get('/priority-config', getPriorityHandler);
    fastify.get('/finance/priority-config', getPriorityHandler);

    const updatePriorityHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        priority_order: z.array(z.string()).min(1)
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid priority array', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const config = await store.updateFeePriorityConfig(user.tenant_id, parse.data.priority_order);
      return reply.send({ success: true, data: config, timestamp: new Date().toISOString() });
    };
    fastify.post('/priority-config', updatePriorityHandler);
    fastify.post('/finance/priority-config', updatePriorityHandler);

    // =========================================================================
    // 3. FEE STRUCTURES (Class/Batch Default with Student Overrides)
    // =========================================================================
    const getStructuresHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { batch_id, student_id } = request.query as { batch_id?: string; student_id?: string };
      const structures = await store.getFeeStructures(user.tenant_id, batch_id, student_id);
      return reply.send({ success: true, data: structures, timestamp: new Date().toISOString() });
    };
    fastify.get('/structures', getStructuresHandler);
    fastify.get('/finance/structures', getStructuresHandler);

    const saveStructureHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        batch_id: z.string().optional().nullable(),
        student_id: z.string().optional().nullable(),
        academic_session: z.string().default('2026-2027'),
        items: z.array(z.object({
          fee_head_id: z.string(),
          head_name: z.string(),
          amount: z.number().min(0)
        })).min(1)
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid fee structure format', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const saved = await store.saveFeeStructure({
        tenant_id: user.tenant_id,
        ...parse.data
      });
      return reply.status(200).send({ success: true, data: saved, timestamp: new Date().toISOString() });
    };
    fastify.post('/structures', saveStructureHandler);
    fastify.post('/finance/structures', saveStructureHandler);

    // =========================================================================
    // 4. STUDENT INVOICES / CHALLANS
    // =========================================================================
    const getInvoicesHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { student_id, batch_id, billing_month, status } = request.query as {
        student_id?: string;
        batch_id?: string;
        billing_month?: string;
        status?: InvoiceStatus;
      };

      const invoices = await store.getInvoices(user.tenant_id, {
        studentId: student_id,
        batchId: batch_id,
        billingMonth: billing_month,
        status
      });
      return reply.send({ success: true, data: invoices, timestamp: new Date().toISOString() });
    };
    fastify.get('/invoices', getInvoicesHandler);
    fastify.get('/finance/invoices', getInvoicesHandler);

    const getInvoiceByIdHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };
      const invoice = await store.getInvoiceById(user.tenant_id, id);
      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Invoice not found' },
          timestamp: new Date().toISOString(),
        });
      }
      return reply.send({ success: true, data: invoice, timestamp: new Date().toISOString() });
    };
    fastify.get('/invoices/:id', getInvoiceByIdHandler);
    fastify.get('/finance/invoices/:id', getInvoiceByIdHandler);

    const generateInvoiceHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        student_id: z.string().min(1),
        billing_month: z.string().min(1),
        due_date: z.string().min(1),
        custom_items: z.array(z.object({
          fee_head_id: z.string(),
          amount: z.number().min(0)
        })).optional(),
        notes: z.string().optional()
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid invoice generation request', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const inv = await store.generateInvoice(user.tenant_id, parse.data);
        return reply.status(201).send({ success: true, data: inv, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVOICE_GENERATION_FAILED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.post('/invoices/generate', generateInvoiceHandler);
    fastify.post('/finance/invoices/generate', generateInvoiceHandler);

    const generateBatchInvoicesHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        batch_id: z.string().min(1),
        billing_month: z.string().min(1),
        due_date: z.string().min(1)
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid batch invoice request', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const generated = await store.generateBatchInvoices(
        user.tenant_id,
        parse.data.batch_id,
        parse.data.billing_month,
        parse.data.due_date
      );
      return reply.status(201).send({ success: true, data: generated, timestamp: new Date().toISOString() });
    };
    fastify.post('/invoices/generate-batch', generateBatchInvoicesHandler);
    fastify.post('/finance/invoices/generate-batch', generateBatchInvoicesHandler);

    // =========================================================================
    // 5. SMART AUTO-DISTRIBUTION PREVIEW (Zero Auto-Submit)
    // =========================================================================
    const previewDistributionHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        invoice_id: z.string().min(1),
        amount: z.number().positive()
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid preview parameters', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const preview = await store.previewPaymentDistribution(user.tenant_id, parse.data.invoice_id, parse.data.amount);
        return reply.send({ success: true, data: preview, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'DISTRIBUTION_ERROR', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.post('/distribute-preview', previewDistributionHandler);
    fastify.post('/finance/distribute-preview', previewDistributionHandler);

    // =========================================================================
    // 6. FEE PAYMENT & CASHIER REVIEW COMMITTAL
    // =========================================================================
    const recordPaymentHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        invoice_id: z.string().min(1),
        amount_paid: z.number().positive(),
        payment_method: z.enum(['cash', 'bank_transfer', 'cheque', 'wallet']),
        reference_number: z.string().optional(),
        is_override: z.boolean().default(false),
        override_reason: z.string().optional(),
        allocations: z.array(z.object({
          fee_head_id: z.string(),
          head_name: z.string(),
          allocated_amount: z.number().min(0)
        })).optional()
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payment data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const result = await store.recordPayment(user.tenant_id, {
          ...parse.data,
          collected_by: user.email || 'Cashier Desk'
        });
        return reply.status(201).send({ success: true, data: result, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'PAYMENT_FAILED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.post('/payments', recordPaymentHandler);
    fastify.post('/finance/payments', recordPaymentHandler);

    // =========================================================================
    // 7. DYNAMIC AD-HOC DISCOUNTS & CONCESSIONS (With Mandatory Audit Remark)
    // =========================================================================
    const getDiscountsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { student_id } = request.query as { student_id?: string };
      const discounts = await store.getDiscounts(user.tenant_id, student_id);
      return reply.send({ success: true, data: discounts, timestamp: new Date().toISOString() });
    };
    fastify.get('/discounts', getDiscountsHandler);
    fastify.get('/finance/discounts', getDiscountsHandler);

    const applyDiscountHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        student_id: z.string().min(1),
        invoice_id: z.string().optional(),
        fee_head_id: z.string().optional(),
        discount_type: z.enum(['flat', 'percentage']),
        discount_value: z.number().positive(),
        mandatory_reason: z.string().min(3, 'Mandatory approval remarks must explain rationale'),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid discount data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const discount = await store.applyDiscount(user.tenant_id, {
          ...parse.data,
          approved_by: user.email || 'Academic Director'
        });
        return reply.status(201).send({ success: true, data: discount, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'DISCOUNT_FAILED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.post('/discounts', applyDiscountHandler);
    fastify.post('/finance/discounts', applyDiscountHandler);

    // =========================================================================
    // 8. FINANCIAL REPORTS & LEDGERS
    // =========================================================================
    const getCashbookHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { date } = request.query as { date?: string };
      const cashbook = await store.getDailyCashbook(user.tenant_id, date);
      return reply.send({ success: true, data: cashbook, timestamp: new Date().toISOString() });
    };
    fastify.get('/reports/cashbook', getCashbookHandler);
    fastify.get('/finance/reports/cashbook', getCashbookHandler);

    const getLedgerHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { studentId } = request.params as { studentId: string };
      const ledger = await store.getStudentLedger(user.tenant_id, studentId);
      return reply.send({ success: true, data: ledger, timestamp: new Date().toISOString() });
    };
    fastify.get('/reports/student-ledger/:studentId', getLedgerHandler);
    fastify.get('/finance/reports/student-ledger/:studentId', getLedgerHandler);

    const getFeeHeadSummaryHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const summary = await store.getFeeHeadCollectionReport(user.tenant_id);
      return reply.send({ success: true, data: summary, timestamp: new Date().toISOString() });
    };
    fastify.get('/reports/fee-head-summary', getFeeHeadSummaryHandler);
    fastify.get('/finance/reports/fee-head-summary', getFeeHeadSummaryHandler);
  };
}
