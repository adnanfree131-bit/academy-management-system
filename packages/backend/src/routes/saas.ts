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

        let reviewerEmail = 'superadmin@kampus.pk';
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

    // 9. Platform Global Configuration (Dynamic Trial Days, Grace Period, Fees, Banking)
    const getPlatformConfigHandler = async (_req: any, reply: any) => {
      try {
        const config = await store.getPlatformConfig();
        return reply.send({ success: true, data: config, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: 'GET_PLATFORM_CONFIG_FAILED', message: err.message || 'Failed fetching platform config' }
        });
      }
    };

    const updatePlatformConfigHandler = async (req: any, reply: any) => {
      try {
        const config = await store.updatePlatformConfig(req.body);
        return reply.send({
          success: true,
          data: config,
          message: 'Platform global configuration updated successfully. Applied forward-looking to new registrations.',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: 'UPDATE_PLATFORM_CONFIG_FAILED', message: err.message || 'Failed updating platform config' }
        });
      }
    };

    fastify.get('/platform-config', getPlatformConfigHandler);
    fastify.get('/saas/platform-config', getPlatformConfigHandler);
    fastify.put('/platform-config', updatePlatformConfigHandler);
    fastify.put('/saas/platform-config', updatePlatformConfigHandler);

    // 10. Subdomain Rename with 301 Alias Creation
    const updateSubdomainHandler = async (req: any, reply: any) => {
      try {
        const { id } = req.params;
        const { new_slug } = req.body;
        if (!new_slug || typeof new_slug !== 'string') {
          return reply.status(400).send({
            success: false,
            error: { code: 'INVALID_SLUG', message: 'Valid new subdomain slug is required' }
          });
        }

        const result = await store.updateTenantSubdomain(id, new_slug);
        return reply.send({
          success: true,
          data: result,
          message: `Subdomain updated to '${result.tenant.slug}'. Previous subdomain '${result.previous_slug}' preserved as 301 redirect alias.`,
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'UPDATE_SUBDOMAIN_FAILED', message: err.message || 'Failed updating subdomain' }
        });
      }
    };

    fastify.put('/tenants/:id/subdomain', updateSubdomainHandler);
    fastify.put('/saas/tenants/:id/subdomain', updateSubdomainHandler);

    // 11. Suspend & Reinstate Academy
    const suspendTenantHandler = async (req: any, reply: any) => {
      try {
        const { id } = req.params;
        const { reason } = req.body || {};
        const tenant = await store.suspendTenant(id, reason);
        return reply.send({
          success: true,
          data: tenant,
          message: `Academy '${tenant.name}' has been suspended. Academic access locked; director isolated to billing recovery.`,
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: 'SUSPEND_TENANT_FAILED', message: err.message || 'Failed suspending academy' }
        });
      }
    };

    const reinstateTenantHandler = async (req: any, reply: any) => {
      try {
        const { id } = req.params;
        const tenant = await store.reinstateTenant(id);
        return reply.send({
          success: true,
          data: tenant,
          message: `Academy '${tenant.name}' has been reinstated to active status. All desks unlocked!`,
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: 'REINSTATE_TENANT_FAILED', message: err.message || 'Failed reinstating academy' }
        });
      }
    };

    fastify.post('/tenants/:id/suspend', suspendTenantHandler);
    fastify.post('/saas/tenants/:id/suspend', suspendTenantHandler);
    fastify.post('/tenants/:id/reinstate', reinstateTenantHandler);
    fastify.post('/saas/tenants/:id/reinstate', reinstateTenantHandler);

    // 12. SuperAdmin Broadcast Announcements
    const listAnnouncementsHandler = async (req: any, reply: any) => {
      try {
        const onlyActive = req.query?.only_active === 'true';
        const announcements = await store.getAnnouncements(onlyActive);
        return reply.send({ success: true, data: announcements, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: 'LIST_ANNOUNCEMENTS_FAILED', message: err.message || 'Failed listing announcements' }
        });
      }
    };

    const createAnnouncementHandler = async (req: any, reply: any) => {
      try {
        const { title, message, type, frequency, target_audience, target_tenant_id, action_label, action_url } = req.body;
        if (!title || !message) {
          return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Title and message are required for announcements' }
          });
        }

        const announcement = await store.createAnnouncement({
          title,
          message,
          type: type || 'system',
          frequency: frequency || 'once_dismissible',
          target_audience: target_audience || 'all',
          target_tenant_id: target_tenant_id || null,
          is_active: true,
          action_label: action_label || null,
          action_url: action_url || null
        });

        return reply.status(201).send({
          success: true,
          data: announcement,
          message: 'Platform announcement created successfully.',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: 'CREATE_ANNOUNCEMENT_FAILED', message: err.message || 'Failed creating announcement' }
        });
      }
    };

    const toggleAnnouncementHandler = async (req: any, reply: any) => {
      try {
        const { id } = req.params;
        const { is_active } = req.body;
        const announcement = await store.toggleAnnouncement(id, Boolean(is_active));
        return reply.send({
          success: true,
          data: announcement,
          message: `Announcement ${is_active ? 'activated' : 'deactivated'} successfully.`,
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: 'TOGGLE_ANNOUNCEMENT_FAILED', message: err.message || 'Failed toggling announcement' }
        });
      }
    };

    fastify.get('/announcements', listAnnouncementsHandler);
    fastify.get('/saas/announcements', listAnnouncementsHandler);
    fastify.post('/announcements', createAnnouncementHandler);
    fastify.post('/saas/announcements', createAnnouncementHandler);
    fastify.put('/announcements/:id/toggle', toggleAnnouncementHandler);
    fastify.put('/saas/announcements/:id/toggle', toggleAnnouncementHandler);

    // 13. Tenant Active Popup Resolution (on Director Login)
    const getActivePopupHandler = async (req: any, reply: any) => {
      try {
        let tenantId = req.query.tenant_id;
        let userId = req.query.user_id || 'anonymous';

        if (req.headers.authorization) {
          try {
            const decoded = fastify.jwt.decode(req.headers.authorization.replace(/^Bearer /i, '')) as JWTPayload;
            if (decoded?.tenant_id) tenantId = decoded.tenant_id;
            if (decoded?.sub) userId = decoded.sub;
          } catch {}
        }

        if (!tenantId) {
          return reply.status(400).send({
            success: false,
            error: { code: 'TENANT_REQUIRED', message: 'Tenant ID is required to fetch active announcements' }
          });
        }

        const popup = await store.getActivePopupForTenant(tenantId, userId);
        return reply.send({ success: true, data: popup, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: 'ACTIVE_POPUP_FAILED', message: err.message || 'Failed fetching active announcement popup' }
        });
      }
    };

    const dismissAnnouncementHandler = async (req: any, reply: any) => {
      try {
        const { id } = req.params;
        let tenantId = req.body.tenant_id;
        let userId = req.body.user_id || 'anonymous';

        if (req.headers.authorization) {
          try {
            const decoded = fastify.jwt.decode(req.headers.authorization.replace(/^Bearer /i, '')) as JWTPayload;
            if (decoded?.tenant_id) tenantId = decoded.tenant_id;
            if (decoded?.sub) userId = decoded.sub;
          } catch {}
        }

        if (!tenantId) {
          return reply.status(400).send({
            success: false,
            error: { code: 'TENANT_REQUIRED', message: 'Tenant ID is required to record dismissal' }
          });
        }

        await store.dismissAnnouncement(id, userId, tenantId);
        return reply.send({
          success: true,
          message: 'Announcement dismissed successfully.',
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: { code: 'DISMISS_ANNOUNCEMENT_FAILED', message: err.message || 'Failed dismissing announcement' }
        });
      }
    };

    fastify.get('/tenant/active-popup', getActivePopupHandler);
    fastify.get('/saas/tenant/active-popup', getActivePopupHandler);
    fastify.post('/tenant/announcements/:id/dismiss', dismissAnnouncementHandler);
    fastify.post('/saas/tenant/announcements/:id/dismiss', dismissAnnouncementHandler);
  };
}
