import { z } from 'zod';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { IDataStore } from '../services/store.js';
import { JWTPayload } from '@apex/shared-types';
import { can } from '../lib/access.js';

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

        if (user.role === 'parent' || user.role === 'student') {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Not authorized to access teacher portal.' }
          });
        }

        const canViewOtherTeachers =
          user.role === 'tenant_admin' ||
          user.role === 'super_admin' ||
          user.role === 'academic_head' ||
          (can(user, 'enrollment', 'view') && can(user, 'all_classes', 'view'));

        const requestedTeacherId = req.query.teacher_id;
        if (requestedTeacherId && requestedTeacherId !== user.user_id && requestedTeacherId !== user.sub) {
          if (!canViewOtherTeachers) {
            return reply.status(403).send({
              success: false,
              error: { code: 'FORBIDDEN', message: 'Not authorized to view other teachers.' }
            });
          }
        }

        if (!canViewOtherTeachers && user.role !== 'teacher') {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Not authorized to access teacher portal.' }
          });
        }

        const teacherId = requestedTeacherId || user.user_id || user.sub;
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
        let linkedChildren: any[] | undefined = undefined;

        // Strict Role-Based Identity Binding (Eliminates IDOR)
        if (user.role === 'student') {
          const allStudents = await store.getStudents(tenantId);
          let myStudent = allStudents.find(s => 
            (s.user_id && s.user_id === user.sub) || 
            (s.email && user.email && s.email.toLowerCase() === user.email.toLowerCase())
          );
          if (!myStudent) {
            // Match via guardian CNIC, roll number, or admission number if user was authenticated with identifier
            const guardianCnic = (me?.metadata as any)?.clean_guardian_id_card || (me?.metadata as any)?.guardian_id_card;
            const cleanCnic = guardianCnic ? String(guardianCnic).replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
            const metaRoll = (me?.metadata as any)?.roll_number;
            const metaAdm = (me?.metadata as any)?.admission_number;

            myStudent = allStudents.find(s => {
              if (metaRoll && s.roll_number && s.roll_number.toLowerCase() === metaRoll.toLowerCase()) return true;
              if (metaAdm && s.admission_number && s.admission_number.toLowerCase() === metaAdm.toLowerCase()) return true;
              if (cleanCnic && s.guardian_id_card && s.guardian_id_card.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() === cleanCnic) return true;
              return false;
            });
            if (myStudent) {
              await store.updateStudent(tenantId, myStudent.id, { user_id: user.sub });
            }
          }
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
          const parentCnic = (me?.metadata as any)?.guardian_id_card || (me?.metadata as any)?.clean_guardian_id_card || (user as any).cnic || (user as any).guardian_id_card;
          const cleanParentCnic = parentCnic ? String(parentCnic).replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;

          const children = tenantStudents.filter(s => {
            if (s.guardian_id_card && cleanParentCnic) {
              const cleanStdCnic = s.guardian_id_card.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
              if (cleanStdCnic === cleanParentCnic) return true;
            }
            if (s.guardian_email && user.email && s.guardian_email.toLowerCase() === user.email.toLowerCase()) return true;
            if (s.guardian_phone && (me as any)?.phone && s.guardian_phone === (me as any)?.phone) return true;
            return false;
          });

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

          const allBatches = await store.getBatches(tenantId);
          const allPrograms = await store.getPrograms(tenantId);
          const allInvoices = await store.getInvoices(tenantId);

          linkedChildren = await Promise.all(children.map(async c => {
            const b = allBatches.find(batch => batch.id === c.batch_id);
            const p = allPrograms.find(prog => prog.id === c.program_id);
            const cInvoices = allInvoices.filter(i => i.student_id === c.id && i.status !== 'voided');
            const unpaid = cInvoices.reduce((sum, inv) => sum + (inv.balance_due ?? inv.balance_amount ?? 0), 0);
            const enrollments = await store.getStudentEnrollments(tenantId, c.id);
            return {
              id: c.id,
              full_name: c.full_name,
              roll_number: c.roll_number,
              admission_number: c.admission_number,
              program_name: p?.name || 'Class',
              batch_name: b?.name || 'Batch',
              photo_url: c.photo_url,
              unpaid_balance: unpaid,
              classes: enrollments.map(e => ({
                id: e.id,
                program_name: allPrograms.find(prog => prog.id === e.program_id)?.name || 'Class',
                batch_name: allBatches.find(batch => batch.id === e.batch_id)?.name || 'Section',
                roll_number: e.roll_number,
                status: e.status,
                is_primary: e.is_primary,
              })),
            };
          }));
        } else if (user.role !== 'tenant_admin' && user.role !== 'super_admin') {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN_ROLE', message: 'Unauthorized portal access.' }
          });
        } else {
          // Admin viewing portal overview
          const tenantStudents = await store.getStudents(tenantId);
          if (tenantStudents.length === 0) {
            return reply.status(404).send({
              success: false,
              error: { code: 'NO_STUDENTS', message: 'No students found in tenant.' }
            });
          }
          if (!targetStudentId) {
            targetStudentId = tenantStudents[0].id;
          }
          // Allow admin to switch between students via linked_children list
          const allBatches = await store.getBatches(tenantId);
          const allPrograms = await store.getPrograms(tenantId);
          const allInvoices = await store.getInvoices(tenantId);
          linkedChildren = await Promise.all(tenantStudents.slice(0, 20).map(async c => {
            const b = allBatches.find(batch => batch.id === c.batch_id);
            const p = allPrograms.find(prog => prog.id === c.program_id);
            const cInvoices = allInvoices.filter(i => i.student_id === c.id && i.status !== 'voided');
            const unpaid = cInvoices.reduce((sum, inv) => sum + (inv.balance_due ?? inv.balance_amount ?? 0), 0);
            const enrollments = await store.getStudentEnrollments(tenantId, c.id);
            return {
              id: c.id,
              full_name: c.full_name,
              roll_number: c.roll_number,
              admission_number: c.admission_number,
              program_name: p?.name || 'Class',
              batch_name: b?.name || 'Batch',
              photo_url: c.photo_url,
              unpaid_balance: unpaid,
              classes: enrollments.map(e => ({
                id: e.id,
                program_name: allPrograms.find(prog => prog.id === e.program_id)?.name || 'Class',
                batch_name: allBatches.find(batch => batch.id === e.batch_id)?.name || 'Section',
                roll_number: e.roll_number,
                status: e.status,
                is_primary: e.is_primary,
              })),
            };
          }));
        }

        const enrollmentId = req.query.enrollment_id;
        const date = req.query.date;
        const overview = await store.getStudentParentPortalOverview(tenantId, targetStudentId, enrollmentId, date);
        if (linkedChildren) {
          overview.linked_children = linkedChildren;
        }
        return reply.send({ success: true, data: overview, timestamp: new Date().toISOString() });
      } catch (err: any) {
        req.log.error(err);
        const isBlocked = err.message?.includes('blocked');
        return reply.status(isBlocked ? 403 : 500).send({
          success: false,
          error: { 
            code: isBlocked ? 'PORTAL_BLOCKED' : 'STUDENT_PORTAL_FAILED', 
            message: err.message || 'Failed fetching student portal overview' 
          },
          timestamp: new Date().toISOString(),
        });
      }
    };

    fastify.get('/student-parent', getStudentParentPortalHandler);
    fastify.get('/portal/student-parent', getStudentParentPortalHandler);
    fastify.get('/student', getStudentParentPortalHandler);
    fastify.get('/portal/student', getStudentParentPortalHandler);
  };
}
