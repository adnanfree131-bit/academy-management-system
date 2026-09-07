import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload, PaymentMethod } from '@apex/shared-types';

export function payrollRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    // =========================================================================
    // 1. STAFF SALARY PROFILES (Fixed Monthly vs Per-Lecture)
    // =========================================================================
    const getProfilesHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const profiles = await store.getStaffSalaryProfiles(user.tenant_id);
      return reply.send({ success: true, data: profiles, timestamp: new Date().toISOString() });
    };
    fastify.get('/profiles', getProfilesHandler);
    fastify.get('/payroll/profiles', getProfilesHandler);

    const saveProfileHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        staff_id: z.string().min(1),
        staff_name: z.string().min(1),
        designation: z.string().min(1),
        contract_type: z.enum(['fixed_monthly', 'per_lecture']),
        base_amount: z.number().min(0)
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid salary profile data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const saved = await store.saveStaffSalaryProfile({
        tenant_id: user.tenant_id,
        ...parse.data
      });
      return reply.status(200).send({ success: true, data: saved, timestamp: new Date().toISOString() });
    };
    fastify.post('/profiles', saveProfileHandler);
    fastify.post('/payroll/profiles', saveProfileHandler);

    // =========================================================================
    // 2. STAFF PAYSLIPS (Interactive Month-End Calculations)
    // =========================================================================
    const getPayslipsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { staff_id, payroll_month } = request.query as { staff_id?: string; payroll_month?: string };
      const payslips = await store.getPayslips(user.tenant_id, {
        staffId: staff_id,
        payrollMonth: payroll_month
      });
      return reply.send({ success: true, data: payslips, timestamp: new Date().toISOString() });
    };
    fastify.get('/payslips', getPayslipsHandler);
    fastify.get('/payroll/payslips', getPayslipsHandler);

    const generatePayslipHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        staff_id: z.string().min(1),
        payroll_month: z.string().min(1),
        earnings: z.array(z.object({
          id: z.string().default(() => crypto.randomUUID()),
          name: z.string().min(1),
          quantity: z.number().min(0),
          unit_rate: z.number().min(0),
          total: z.number().min(0).default(0)
        })).default([]),
        deductions: z.array(z.object({
          id: z.string().default(() => crypto.randomUUID()),
          name: z.string().min(1),
          quantity: z.number().min(0),
          unit_rate: z.number().min(0),
          total: z.number().min(0).default(0)
        })).default([]),
        admin_notes: z.string().optional()
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payslip parameters', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const payslip = await store.generatePayslip(user.tenant_id, {
          ...parse.data,
          processed_by: user.email || 'Finance Administrator'
        });
        return reply.status(201).send({ success: true, data: payslip, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'PAYSLIP_GENERATION_FAILED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.post('/payslips/generate', generatePayslipHandler);
    fastify.post('/payroll/payslips/generate', generatePayslipHandler);

    const markPaidHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };
      const schema = z.object({
        payment_method: z.enum(['cash', 'bank_transfer', 'cheque', 'wallet']).default('bank_transfer'),
        reference: z.string().optional()
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payment details', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const payslip = await store.markPayslipPaid(user.tenant_id, id, parse.data.payment_method as PaymentMethod, parse.data.reference);
        return reply.send({ success: true, data: payslip, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'PAYSLIP_UPDATE_FAILED', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.post('/payslips/:id/pay', markPaidHandler);
    fastify.post('/payroll/payslips/:id/pay', markPaidHandler);
  };
}
