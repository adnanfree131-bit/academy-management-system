import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { IDataStore } from '../services/store.js';
import { JWTPayload } from '@apex/shared-types';

export function saasRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    // 1. Get Tenant Trial & Lockout Status (Public or Authenticated)
    const getTrialStatusHandler = async (req: any, reply: any) => {
      try {
        let tenantId = req.query.tenant_id;
        if (!tenantId && req.headers.authorization) {
          try {
            const decoded = fastify.jwt.decode(req.headers.authorization.replace(/^Bearer /i, '')) as JWTPayload;
            if (decoded?.tenant_id) tenantId = decoded.tenant_id;
          } catch {}
        }

        if (!tenantId) {
          return reply.status(400).send({
            success: false,
            error: { code: 'TENANT_REQUIRED', message: 'tenant_id query parameter or Bearer token required' }
          });
        }

        const status = await store.getTenantTrialStatus(tenantId);
        return reply.send({ success: true, data: status, timestamp: new Date().toISOString() });
      } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({
          success: false,
          error: { code: 'TRIAL_STATUS_FAILED', message: err.message || 'Failed getting trial status' }
        });
      }
    };

    fastify.get('/trial-status', getTrialStatusHandler);
    fastify.get('/saas/trial-status', getTrialStatusHandler);

    // 2. Submit Subscription Payment Proof Receipt
    const submitReceiptHandler = async (req: any, reply: any) => {
      try {
        let tenantId = req.body.tenant_id;
        let uploadedByUserId: string | undefined;
        let uploadedByEmail: string | undefined;

        if (req.headers.authorization) {
          try {
            const decoded = fastify.jwt.decode(req.headers.authorization.replace(/^Bearer /i, '')) as JWTPayload;
            if (decoded?.tenant_id && !tenantId) tenantId = decoded.tenant_id;
            uploadedByUserId = decoded?.user_id || decoded?.sub;
            uploadedByEmail = decoded?.email;
          } catch {}
        }

        if (!tenantId) {
          return reply.status(400).send({
            success: false,
            error: { code: 'TENANT_REQUIRED', message: 'Tenant ID required to submit receipt' }
          });
        }

        const { amount, plan_duration_months, payment_method, reference_number, notes, receipt_image_url } = req.body;
        if (!amount || amount <= 0) {
          return reply.status(400).send({
            success: false,
            error: { code: 'INVALID_AMOUNT', message: 'Valid payment amount is required' }
          });
        }

        const receipt = await store.submitSubscriptionReceipt(tenantId, {
          amount: Number(amount),
          plan_duration_months: Number(plan_duration_months) || 1,
          payment_method: payment_method || 'BANK_TRANSFER',
          reference_number,
          notes,
          uploaded_by_user_id: uploadedByUserId,
          uploaded_by_email: uploadedByEmail,
          receipt_image_url
        });

        return reply.status(201).send({
          success: true,
          data: receipt,
          message: 'Payment proof receipt submitted successfully. Account will be activated upon Super-Admin verification.',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({
          success: false,
          error: { code: 'RECEIPT_SUBMISSION_FAILED', message: err.message || 'Failed submitting receipt' }
        });
      }
    };

    fastify.post('/receipts', submitReceiptHandler);
    fastify.post('/saas/receipts', submitReceiptHandler);

    // 3. List Subscription Receipts
    const listReceiptsHandler = async (req: any, reply: any) => {
      try {
        let tenantId = req.query.tenant_id;
        if (!tenantId && req.headers.authorization) {
          try {
            const decoded = fastify.jwt.decode(req.headers.authorization.replace(/^Bearer /i, '')) as JWTPayload;
            if (decoded?.role !== 'super_admin') {
              tenantId = decoded.tenant_id;
            }
          } catch {}
        }

        const receipts = await store.getSubscriptionReceipts(tenantId);
        return reply.send({ success: true, data: receipts, timestamp: new Date().toISOString() });
      } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({
          success: false,
          error: { code: 'LIST_RECEIPTS_FAILED', message: err.message || 'Failed listing receipts' }
        });
      }
    };

    fastify.get('/receipts', listReceiptsHandler);
    fastify.get('/saas/receipts', listReceiptsHandler);

    // 4. Review Subscription Receipt (Approve / Reject)
    const reviewReceiptHandler = async (req: any, reply: any) => {
      try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
          return reply.status(400).send({
            success: false,
            error: { code: 'INVALID_STATUS', message: 'Status must be APPROVED or REJECTED' }
          });
        }

        let reviewerEmail = 'superadmin@apexacademyerp.com';
        if (req.headers.authorization) {
          try {
            const decoded = fastify.jwt.decode(req.headers.authorization.replace(/^Bearer /i, '')) as JWTPayload;
            if (decoded?.email) reviewerEmail = decoded.email;
          } catch {}
        }

        const receipt = await store.reviewSubscriptionReceipt(id, status, reviewerEmail);
        return reply.send({
          success: true,
          data: receipt,
          message: `Subscription receipt has been ${status.toLowerCase()} successfully.`,
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({
          success: false,
          error: { code: 'REVIEW_RECEIPT_FAILED', message: err.message || 'Failed reviewing receipt' }
        });
      }
    };

    fastify.post('/receipts/:id/review', reviewReceiptHandler);
    fastify.post('/saas/receipts/:id/review', reviewReceiptHandler);

    // 5. Get Platform Banking Configuration
    const getBankingConfigHandler = async (_req: any, reply: any) => {
      try {
        const config = await store.getPlatformBankingConfig();
        return reply.send({ success: true, data: config, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: 'BANKING_CONFIG_FAILED', message: err.message || 'Failed fetching banking config' }
        });
      }
    };

    fastify.get('/banking-config', getBankingConfigHandler);
    fastify.get('/saas/banking-config', getBankingConfigHandler);

    // 6. Update Platform Banking Configuration
    const updateBankingConfigHandler = async (req: any, reply: any) => {
      try {
        const config = await store.updatePlatformBankingConfig(req.body);
        return reply.send({
          success: true,
          data: config,
          message: 'Platform banking configuration updated successfully.',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: 'UPDATE_BANKING_CONFIG_FAILED', message: err.message || 'Failed updating banking config' }
        });
      }
    };

    fastify.put('/banking-config', updateBankingConfigHandler);
    fastify.put('/saas/banking-config', updateBankingConfigHandler);

    // 7. Activate Academy (1 Mo, 6 Mo, 1 Yr, Lifetime)
    const activateAcademyHandler = async (req: any, reply: any) => {
      try {
        const { id } = req.params;
        const { duration_months } = req.body;
        const months = Number(duration_months) || 1;

        let reviewerEmail: string | undefined;
        if (req.headers.authorization) {
          try {
            const decoded = fastify.jwt.decode(req.headers.authorization.replace(/^Bearer /i, '')) as JWTPayload;
            reviewerEmail = decoded?.email;
          } catch {}
        }

        const tenant = await store.activateAcademy(id, months, reviewerEmail);
        return reply.send({
          success: true,
          data: tenant,
          message: `Academy '${tenant.name}' has been activated for ${months} month(s). Dashboard unlocked!`,
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: 'ACTIVATE_ACADEMY_FAILED', message: err.message || 'Failed activating academy' }
        });
      }
    };

    fastify.post('/tenants/:id/activate', activateAcademyHandler);
    fastify.post('/saas/tenants/:id/activate', activateAcademyHandler);

    // 8. Super-Admin Global Overview & Metrics
    const superAdminOverviewHandler = async (_req: any, reply: any) => {
      try {
        const overview = await store.getSuperAdminOverview();
        return reply.send({ success: true, data: overview, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: 'SUPERADMIN_OVERVIEW_FAILED', message: err.message || 'Failed fetching super-admin overview' }
        });
      }
    };

    fastify.get('/superadmin/overview', superAdminOverviewHandler);
    fastify.get('/saas/superadmin/overview', superAdminOverviewHandler);
  };
}
