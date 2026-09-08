import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { IDataStore } from '../services/store.js';
import { JWTPayload } from '@apex/shared-types';

export function portalRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    // 1. Teacher Portal Aggregated Dashboard
    const getTeacherPortalHandler = async (req: any, reply: any) => {
      try {
        const user = req.user as JWTPayload;
        const tenantId = user.tenant_id || req.query.tenant_id;
        if (!tenantId) {
          return reply.status(400).send({
            success: false,
            error: { code: 'TENANT_REQUIRED', message: 'Tenant context is required' }
          });
        }

        const teacherId = req.query.teacher_id || user.user_id || user.sub;
        const date = req.query.date;

        const overview = await store.getTeacherPortalOverview(tenantId, teacherId, date);
        return reply.send({ success: true, data: overview, timestamp: new Date().toISOString() });
      } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({
          success: false,
          error: { code: 'TEACHER_PORTAL_FAILED', message: err.message || 'Failed fetching teacher portal overview' }
        });
      }
    };

    fastify.get('/teacher', getTeacherPortalHandler);
    fastify.get('/portal/teacher', getTeacherPortalHandler);

    // 2. Student & Parent Portal Aggregated Dashboard
    const getStudentParentPortalHandler = async (req: any, reply: any) => {
      try {
        const user = req.user as JWTPayload;
        const tenantId = user.tenant_id || req.query.tenant_id;
        if (!tenantId) {
          return reply.status(400).send({
            success: false,
            error: { code: 'TENANT_REQUIRED', message: 'Tenant context is required' }
          });
        }

        const studentId = req.query.student_id;
        const overview = await store.getStudentParentPortalOverview(tenantId, studentId);
        return reply.send({ success: true, data: overview, timestamp: new Date().toISOString() });
      } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({
          success: false,
          error: { code: 'STUDENT_PORTAL_FAILED', message: err.message || 'Failed fetching student portal overview' }
        });
      }
    };

    fastify.get('/student-parent', getStudentParentPortalHandler);
    fastify.get('/portal/student-parent', getStudentParentPortalHandler);
  };
}
