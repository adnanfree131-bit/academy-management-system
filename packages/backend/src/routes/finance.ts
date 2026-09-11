import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload, PaymentMethod, InvoiceStatus } from '@apex/shared-types';

export function financeRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    const assertRole = (user: JWTPayload, allowedRoles: string[], reply: any): boolean => {
      if (!allowedRoles.includes(user.role) && user.role !== 'super_admin') {
        reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. You do not have permission to perform this financial operation.' },
          timestamp: new Date().toISOString(),
        });
        return false;
      }
      return true;
    };

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
      if (!assertRole(user, ['tenant_admin'], reply)) return;
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

    const updateHeadHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin'], reply)) return;
      const { id } = request.params as { id: string };
      const schema = z.object({
        name: z.string().min(1).optional(),
        code: z.string().min(1).toUpperCase().optional(),
        default_amount: z.number().min(0).optional(),
        priority_order: z.number().int().min(1).optional(),
      });
      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid fee head data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }
      const head = await store.updateFeeHead(user.tenant_id, id, parse.data);
      if (!head) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Fee head not found' },
          timestamp: new Date().toISOString(),
        });
      }
      return reply.send({ success: true, data: head, timestamp: new Date().toISOString() });
    };
    fastify.patch('/heads/:id', updateHeadHandler);
    fastify.patch('/finance/heads/:id', updateHeadHandler);

    const deleteHeadHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin'], reply)) return;
      const { id } = request.params as { id: string };
      const ok = await store.deleteFeeHead(user.tenant_id, id);
      if (!ok) {
        return reply.status(400).send({
          success: false,
          error: { code: 'HEAD_LOCKED', message: 'Monthly tuition cannot be deleted, or the head was not found.' },
          timestamp: new Date().toISOString(),
        });
      }
      return reply.send({ success: true, data: { id }, timestamp: new Date().toISOString() });
    };
    fastify.delete('/heads/:id', deleteHeadHandler);
    fastify.delete('/finance/heads/:id', deleteHeadHandler);

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
      if (!assertRole(user, ['tenant_admin'], reply)) return;
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
      if (!assertRole(user, ['tenant_admin'], reply)) return;
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
      if (!assertRole(user, ['tenant_admin', 'finance_manager'], reply)) return;
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
      if (!assertRole(user, ['tenant_admin', 'finance_manager'], reply)) return;
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
      if (!assertRole(user, ['tenant_admin', 'finance_manager'], reply)) return;
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

    const voidPaymentHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin', 'finance_manager'], reply)) return;
      const { id } = request.params as { id: string };
      const schema = z.object({
        void_reason: z.string().min(5, 'A clear reason is required to void a payment receipt')
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payment void request', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const result = await store.voidPayment(
          user.tenant_id,
          id,
          parse.data.void_reason,
          user.email || 'Finance Administrator'
        );
        return reply.status(200).send({ success: true, data: result, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VOID_PAYMENT_FAILED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.post('/payments/:id/void', voidPaymentHandler);
    fastify.post('/finance/payments/:id/void', voidPaymentHandler);

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
      if (!assertRole(user, ['tenant_admin'], reply)) return;
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

    // =========================================================================
    // 9. DYNAMIC OPERATIONAL ACCOUNT HEADS (Income & Expense Tags)
    // =========================================================================
    const getAccountHeadsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { type } = request.query as { type?: 'income' | 'expense' };
      const heads = await store.getAccountHeads(user.tenant_id, type);
      return reply.send({ success: true, data: heads, timestamp: new Date().toISOString() });
    };
    fastify.get('/account-heads', getAccountHeadsHandler);
    fastify.get('/finance/account-heads', getAccountHeadsHandler);

    const createAccountHeadHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        type: z.enum(['income', 'expense']),
        name: z.string().min(1),
        code: z.string().optional().nullable(),
        description: z.string().optional().nullable()
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid account head data', details: parse.error.flatten() },
          timestamp: new Date().toISOString()
        });
      }

      const derivedCode = parse.data.code && parse.data.code.trim().length > 0
        ? parse.data.code.trim().toUpperCase()
        : `${parse.data.type === 'income' ? 'INC' : 'EXP'}-${parse.data.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;

      const head = await store.createAccountHead({
        tenant_id: user.tenant_id,
        type: parse.data.type,
        name: parse.data.name,
        code: derivedCode,
        description: parse.data.description || null,
        is_active: true
      });

      return reply.status(201).send({ success: true, data: head, timestamp: new Date().toISOString() });
    };
    fastify.post('/account-heads', createAccountHeadHandler);
    fastify.post('/finance/account-heads', createAccountHeadHandler);

    const deleteAccountHeadHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };
      const deleted = await store.deleteAccountHead(user.tenant_id, id);
      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Account head not found' },
          timestamp: new Date().toISOString()
        });
      }
      return reply.send({ success: true, message: 'Account head deactivated', timestamp: new Date().toISOString() });
    };
    fastify.delete('/account-heads/:id', deleteAccountHeadHandler);
    fastify.delete('/finance/account-heads/:id', deleteAccountHeadHandler);

    // =========================================================================
    // 10. FINANCIAL TRANSACTIONS & VOUCHERS (Income & Expense Logging)
    // =========================================================================
    const getTransactionsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { type, head_id, startDate, endDate } = request.query as {
        type?: 'income' | 'expense';
        head_id?: string;
        startDate?: string;
        endDate?: string;
      };
      const transactions = await store.getFinancialTransactions(user.tenant_id, {
        type,
        head_id,
        startDate,
        endDate
      });
      return reply.send({ success: true, data: transactions, timestamp: new Date().toISOString() });
    };
    fastify.get('/transactions', getTransactionsHandler);
    fastify.get('/finance/transactions', getTransactionsHandler);

    const createTransactionHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!assertRole(user, ['tenant_admin', 'finance_manager'], reply)) return;
      const schema = z.object({
        type: z.enum(['income', 'expense']),
        account_head_id: z.string().min(1),
        head_name: z.string().optional().nullable(),
        amount: z.number().positive(),
        transaction_date: z.string().optional().nullable(),
        date: z.string().optional().nullable(),
        payment_method: z.enum(['cash', 'bank_transfer', 'cheque', 'online']).default('cash'),
        reference_number: z.string().optional().nullable(),
        paid_to_or_received_from: z.string().optional().nullable(),
        payee_payer: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        attachment_url: z.string().optional().nullable()
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid transaction data', details: parse.error.flatten() },
          timestamp: new Date().toISOString()
        });
      }

      // Auto resolve head_name if omitted
      let headName = parse.data.head_name;
      if (!headName) {
        const heads = await store.getAccountHeads(user.tenant_id);
        const head = heads.find(h => h.id === parse.data.account_head_id);
        headName = head?.name || 'General';
      }

      const txDate = parse.data.transaction_date || parse.data.date || new Date().toISOString().slice(0, 10);
      const payee = parse.data.paid_to_or_received_from || parse.data.payee_payer || 'General';

      const tx = await store.createFinancialTransaction({
        tenant_id: user.tenant_id,
        type: parse.data.type,
        account_head_id: parse.data.account_head_id,
        head_name: headName,
        amount: parse.data.amount,
        transaction_date: txDate,
        payment_method: parse.data.payment_method,
        paid_to_or_received_from: payee,
        reference_number: parse.data.reference_number || null,
        description: parse.data.description || null,
        attachment_url: parse.data.attachment_url || null,
        recorded_by: user.email || 'Finance Desk'
      });

      return reply.status(201).send({ success: true, data: tx, timestamp: new Date().toISOString() });
    };
    fastify.post('/transactions', createTransactionHandler);
    fastify.post('/finance/transactions', createTransactionHandler);

    // =========================================================================
    // 11. PROFIT & LOSS STATEMENT REPORT
    // =========================================================================
    const getProfitLossHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { month } = request.query as { month?: string };
      const report = await store.getProfitLossReport(user.tenant_id, month);
      return reply.send({ success: true, data: report, timestamp: new Date().toISOString() });
    };
    fastify.get('/reports/profit-loss', getProfitLossHandler);
    fastify.get('/finance/reports/profit-loss', getProfitLossHandler);
  };
}
