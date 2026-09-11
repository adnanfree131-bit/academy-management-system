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

        const users = await store.getTenantUsers(tenantId);
        const me = users.find(u => u.id === user.sub || u.email === user.email);
        if (me?.metadata?.portal_blocked) {
          return reply.status(403).send({
            success: false,
            error: { code: 'PORTAL_BLOCKED', message: 'Student portal access has been blocked by the academy.' },
            timestamp: new Date().toISOString(),
          });
        }

        let targetStudentId = req.query.student_id;

        // Strict Role-Based Identity Binding (Eliminates IDOR)
        if (user.role === 'student') {
          const allStudents = await store.getStudents(tenantId);
          const myStudent = allStudents.find(s => s.user_id === user.sub || (s.email && s.email.toLowerCase() === user.email.toLowerCase()));
          if (!myStudent) {
            return reply.status(403).send({
              success: false,
              error: { code: 'STUDENT_UNLINKED', message: 'No student record is linked to this account.' }
            });
          }
          if (targetStudentId && targetStudentId !== myStudent.id) {
            return reply.status(403).send({
              success: false,
              error: { code: 'UNAUTHORIZED_STUDENT_ACCESS', message: 'You are not authorized to view another student profile.' }
            });
          }
          targetStudentId = myStudent.id;
        } else if (user.role === 'parent') {
          const tenantStudents = await store.getStudents(tenantId);
          const children = tenantStudents.filter(s => (s.guardian_email && s.guardian_email.toLowerCase() === user.email.toLowerCase()) || (s.guardian_phone && s.guardian_phone === (me as any)?.phone));
          if (children.length === 0) {
            return reply.status(403).send({
              success: false,
              error: { code: 'NO_LINKED_CHILDREN', message: 'No student records associated with this parent account.' }
            });
          }
          if (targetStudentId) {
            const isChild = children.some(c => c.id === targetStudentId);
            if (!isChild) {
              return reply.status(403).send({
                success: false,
                error: { code: 'UNAUTHORIZED_PARENT_ACCESS', message: 'You are not authorized to view records for this student.' }
              });
            }
          } else {
            targetStudentId = children[0].id;
          }
        } else if (user.role !== 'tenant_admin' && user.role !== 'super_admin') {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN_ROLE', message: 'Unauthorized portal access.' }
          });
        } else {
          // Admin viewing portal overview
          if (!targetStudentId) {
            const tenantStudents = await store.getStudents(tenantId);
            if (tenantStudents.length === 0) {
              return reply.status(404).send({
                success: false,
                error: { code: 'NO_STUDENTS', message: 'No students found in tenant.' }
              });
            }
            targetStudentId = tenantStudents[0].id;
          }
        }

        const overview = await store.getStudentParentPortalOverview(tenantId, targetStudentId);
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
