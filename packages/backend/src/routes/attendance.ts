import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload } from '@apex/shared-types';
import { can, batchScope, FeatureId, AccessLevel } from '../lib/access.js';

export function attendanceRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    fastify.addHook('onRequest', (fastify as any).authenticate);

    const assertFeature = (user: any, feature: FeatureId, level: AccessLevel, reply: any): boolean => {
      if (!can(user, feature, level)) {
        reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: `Access denied. Requires '${feature}' (${level}) permission.` },
          timestamp: new Date().toISOString(),
        });
        return false;
      }
      return true;
    };

    const assertRole = (user: JWTPayload, allowedRoles: string[], reply: any): boolean => {
      if (!allowedRoles.includes(user.role) && user.role !== 'super_admin') {
        reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_ROLE', message: 'Access denied. You do not have permission to perform this attendance operation.' },
          timestamp: new Date().toISOString(),
        });
        return false;
      }
      return true;
    };

    const STAFF_ROLES = ['tenant_admin', 'academic_head', 'teacher', 'finance_manager'];

    const getVerifiedStudentId = async (user: JWTPayload): Promise<string | null> => {
      if (user.student_id) return user.student_id;
      const students = await store.getStudents(user.tenant_id);
      const matched = students.find(s =>
        (s.user_id && s.user_id === user.sub) ||
        (user.email && s.email?.toLowerCase() === user.email.toLowerCase()) ||
        (user.admission_number && s.admission_number === user.admission_number) ||
        (user.cnic && (s.student_b_form === user.cnic || s.guardian_id_card === user.cnic))
      );
      return matched ? matched.id : null;
    };

    const getParentLinkedChildIds = async (user: JWTPayload): Promise<string[]> => {
      const students = await store.getStudents(user.tenant_id);
      const normalizedCnic = user.cnic ? user.cnic.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
      const normalizedEmail = user.email ? user.email.toLowerCase().trim() : null;

      return students.filter(s => {
        const sGuardianCnic = s.guardian_id_card ? s.guardian_id_card.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
        const sFatherCnic = s.father_cnic ? s.father_cnic.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
        const sMotherCnic = s.mother_cnic ? s.mother_cnic.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
        const sGuardianEmail = s.guardian_email ? s.guardian_email.toLowerCase().trim() : null;

        if (normalizedCnic && (sGuardianCnic === normalizedCnic || sFatherCnic === normalizedCnic || sMotherCnic === normalizedCnic)) {
          return true;
        }
        if (normalizedEmail && sGuardianEmail === normalizedEmail) {
          return true;
        }
        return false;
      }).map(s => s.id);
    };

    // --- Student Attendance ---
    const getStudentAttendanceHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { batch_id, date, student_id, month } = request.query as { batch_id?: string; date?: string; student_id?: string; month?: string };
      const studentId = (request.params as any)?.studentId || student_id;

      if (user.role === 'student') {
        const myStudentId = await getVerifiedStudentId(user);
        if (!myStudentId) {
          return reply.send({ success: true, data: [], timestamp: new Date().toISOString() });
        }
        if (studentId && studentId !== myStudentId) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Students can only view their own attendance records.' },
            timestamp: new Date().toISOString(),
          });
        }
        const records = await store.getStudentAttendanceHistory(user.tenant_id, myStudentId);
        return reply.send({ success: true, data: records, timestamp: new Date().toISOString() });
      }

      if (user.role === 'parent') {
        const linkedChildIds = await getParentLinkedChildIds(user);
        if (studentId) {
          if (!linkedChildIds.includes(studentId)) {
            return reply.status(403).send({
              success: false,
              error: { code: 'FORBIDDEN', message: 'Parents can only view attendance records for their linked children.' },
              timestamp: new Date().toISOString(),
            });
          }
          const records = await store.getStudentAttendanceHistory(user.tenant_id, studentId);
          return reply.send({ success: true, data: records, timestamp: new Date().toISOString() });
        }
        const allRecords = await Promise.all(
          linkedChildIds.map(cid => store.getStudentAttendanceHistory(user.tenant_id, cid))
        );
        const flattened = allRecords.flat();
        return reply.send({ success: true, data: flattened, timestamp: new Date().toISOString() });
      }

      if (!assertFeature(user, 'attendance', 'view', reply)) return;

      if (studentId) {
        const records = await store.getStudentAttendanceHistory(user.tenant_id, studentId);
        return reply.send({ success: true, data: records, timestamp: new Date().toISOString() });
      }

      const scope = batchScope(user);
      if (Array.isArray(scope)) {
        if (batch_id && !scope.includes(batch_id)) {
          return reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN_SCOPE', message: 'You are not authorized to view attendance for this batch.' },
            timestamp: new Date().toISOString(),
          });
        }
      }

      let records = await store.getStudentAttendance(user.tenant_id, batch_id, date);
      if (Array.isArray(scope)) {
        records = records.filter(r => scope.includes(r.batch_id));
      }
      if (month) {
        records = records.filter(r => r.date.startsWith(month));
      }
      return reply.send({ success: true, data: records, timestamp: new Date().toISOString() });
    };
    fastify.get('/students', getStudentAttendanceHandler);
    fastify.get('/attendance/students', getStudentAttendanceHandler);
    fastify.get('/students/:studentId', getStudentAttendanceHandler);
    fastify.get('/attendance/students/:studentId', getStudentAttendanceHandler);

    // Rapid batch attendance submission
    const recordBatchHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!assertFeature(user, 'attendance', 'edit', reply)) return;
      const schema = z.object({
        batch_id: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        records: z.array(z.object({
          student_id: z.string().min(1),
          status: z.enum(['present', 'absent', 'late', 'excused']),
          remarks: z.string().optional(),
        })).min(1),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid attendance submission payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const scope = batchScope(user);
      if (Array.isArray(scope) && !scope.includes(parse.data.batch_id)) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN_SCOPE', message: 'You are not assigned to this batch.' },
          timestamp: new Date().toISOString(),
        });
      }

      const saved = await store.recordBatchAttendance(
        user.tenant_id,
        parse.data.batch_id,
        parse.data.date,
        parse.data.records,
        user.email
      );

      return reply.status(201).send({ success: true, data: saved, timestamp: new Date().toISOString() });
    };
    fastify.post('/students/batch', recordBatchHandler);
    fastify.post('/attendance/students/batch', recordBatchHandler);

    // --- Leave Applications ---
    const getLeavesHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { student_id } = request.query as { student_id?: string };

      if (user.role === 'student') {
        const allStudents = await store.getStudents(user.tenant_id);
        const myStudent = allStudents.find(s => s.user_id === user.sub || (s.email && user.email && s.email.toLowerCase() === user.email.toLowerCase()));
        if (!myStudent) {
          return reply.send({ success: true, data: [], timestamp: new Date().toISOString() });
        }
        const leaves = await store.getLeaveApplications(user.tenant_id, myStudent.id);
        return reply.send({ success: true, data: leaves, timestamp: new Date().toISOString() });
      }

      if (user.role === 'parent') {
        const allStudents = await store.getStudents(user.tenant_id);
        const tenantUsers = await store.getTenantUsers(user.tenant_id);
        const me = tenantUsers.find(u => u.id === user.sub || (user.email && u.email === user.email));
        const parentCnic = (me?.metadata as any)?.guardian_id_card || (me?.metadata as any)?.clean_guardian_id_card;
        const cleanParentCnic = parentCnic ? String(parentCnic).replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;

        const children = allStudents.filter(s => {
          if (s.guardian_id_card && cleanParentCnic) {
            const cleanStdCnic = s.guardian_id_card.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
            if (cleanStdCnic === cleanParentCnic) return true;
          }
          if (s.guardian_email && user.email && s.guardian_email.toLowerCase() === user.email.toLowerCase()) return true;
          if (s.guardian_phone && (me as any)?.phone && s.guardian_phone === (me as any)?.phone) return true;
          return false;
        });

        if (children.length === 0) {
          return reply.send({ success: true, data: [], timestamp: new Date().toISOString() });
        }

        if (student_id) {
          const isChild = children.some(c => c.id === student_id);
          if (!isChild) {
            return reply.status(403).send({
              success: false,
              error: { code: 'UNAUTHORIZED_PARENT_ACCESS', message: 'You are not authorized to view leaves for this student.' },
              timestamp: new Date().toISOString(),
            });
          }
          const leaves = await store.getLeaveApplications(user.tenant_id, student_id);
          return reply.send({ success: true, data: leaves, timestamp: new Date().toISOString() });
        } else {
          const childIds = new Set(children.map(c => c.id));
          const allLeaves = await store.getLeaveApplications(user.tenant_id);
          const parentLeaves = allLeaves.filter(l => childIds.has(l.student_id));
          return reply.send({ success: true, data: parentLeaves, timestamp: new Date().toISOString() });
        }
      }

      if (!assertFeature(user, 'attendance', 'view', reply)) return;
      const leaves = await store.getLeaveApplications(user.tenant_id, student_id);
      return reply.send({ success: true, data: leaves, timestamp: new Date().toISOString() });
    };
    fastify.get('/leaves', getLeavesHandler);

    const submitLeaveHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        student_id: z.string().min(1),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        category: z.enum(['medical', 'personal', 'emergency']),
        reason: z.string().min(3),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid leave application data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      if (parse.data.end_date < parse.data.start_date) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_DATE_RANGE', message: 'Leave end date cannot precede start date.' },
          timestamp: new Date().toISOString(),
        });
      }

      // Prevent IDOR: Ensure authenticated student or parent is authorized for this student_id
      if (user.role === 'student') {
        const allStudents = await store.getStudents(user.tenant_id);
        const myStudent = allStudents.find(s => s.user_id === user.sub || (s.email && user.email && s.email.toLowerCase() === user.email.toLowerCase()));
        if (!myStudent || myStudent.id !== parse.data.student_id) {
          return reply.status(403).send({
            success: false,
            error: { code: 'UNAUTHORIZED_LEAVE_SUBMISSION', message: 'You are not authorized to submit leave for another student.' },
            timestamp: new Date().toISOString(),
          });
        }
      } else if (user.role === 'parent') {
        const allStudents = await store.getStudents(user.tenant_id);
        const tenantUsers = await store.getTenantUsers(user.tenant_id);
        const me = tenantUsers.find(u => u.id === user.sub || (user.email && u.email === user.email));
        const parentCnic = (me?.metadata as any)?.guardian_id_card || (me?.metadata as any)?.clean_guardian_id_card;
        const cleanParentCnic = parentCnic ? String(parentCnic).replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;

        const children = allStudents.filter(s => {
          if (s.guardian_id_card && cleanParentCnic) {
            const cleanStdCnic = s.guardian_id_card.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
            if (cleanStdCnic === cleanParentCnic) return true;
          }
          if (s.guardian_email && user.email && s.guardian_email.toLowerCase() === user.email.toLowerCase()) return true;
          if (s.guardian_phone && (me as any)?.phone && s.guardian_phone === (me as any)?.phone) return true;
          return false;
        });

        const isChild = children.some(c => c.id === parse.data.student_id);
        if (!isChild) {
          return reply.status(403).send({
            success: false,
            error: { code: 'UNAUTHORIZED_LEAVE_SUBMISSION', message: 'You are not authorized to submit leave for this student.' },
            timestamp: new Date().toISOString(),
          });
        }
      }

      const leave = await store.submitLeaveApplication({
        tenant_id: user.tenant_id,
        ...parse.data,
      });

      return reply.status(201).send({ success: true, data: leave, timestamp: new Date().toISOString() });
    };
    fastify.post('/leaves', submitLeaveHandler);

    const reviewLeaveHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!assertFeature(user, 'attendance', 'edit', reply)) return;
      const { id } = request.params as { id: string };
      const schema = z.object({
        status: z.enum(['approved', 'rejected']),
        review_notes: z.string().optional(),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid leave review payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const updated = await store.reviewLeaveApplication(
          user.tenant_id,
          id,
          parse.data.status,
          parse.data.review_notes,
          user.email
        );
        return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
      } catch (err: any) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.patch('/leaves/:id/review', reviewLeaveHandler);

    // --- Staff Leaves ---
    const getStaffLeavesHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (user.role === 'student' || user.role === 'parent') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Students and parents cannot view staff leaves.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { staff_id } = request.query as { staff_id?: string };
      let effectiveStaffId = staff_id;
      const myId = user.sub || (user as any).user_id;
      if (!can(user, 'staff_attendance', 'view')) {
        effectiveStaffId = myId;
      }
      const leaves = await store.getStaffLeaves(user.tenant_id, effectiveStaffId);
      return reply.send({ success: true, data: leaves, timestamp: new Date().toISOString() });
    };
    fastify.get('/staff-leaves', getStaffLeavesHandler);

    const submitStaffLeaveHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (user.role === 'student' || user.role === 'parent') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Students and parents cannot submit staff leaves.' },
          timestamp: new Date().toISOString(),
        });
      }
      const schema = z.object({
        staff_id: z.string().min(1),
        staff_name: z.string().optional(),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        category: z.enum(['medical', 'casual', 'official_duty', 'emergency', 'annual']),
        reason: z.string().min(3),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid staff leave application data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const myId = user.sub || (user as any).user_id;
      if (parse.data.staff_id !== myId && !can(user, 'staff_attendance', 'edit')) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You may only submit leave applications for yourself without staff_attendance edit permission.' },
          timestamp: new Date().toISOString(),
        });
      }

      const leave = await store.submitStaffLeave({
        tenant_id: user.tenant_id,
        ...parse.data,
      });

      return reply.status(201).send({ success: true, data: leave, timestamp: new Date().toISOString() });
    };
    fastify.post('/staff-leaves', submitStaffLeaveHandler);

    const reviewStaffLeaveHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      if (!assertFeature(user, 'staff_attendance', 'edit', reply)) return;
      const { id } = request.params as { id: string };
      const schema = z.object({
        status: z.enum(['approved', 'rejected']),
        review_notes: z.string().optional(),
      });

      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid staff leave review payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const updated = await store.reviewStaffLeave(
          user.tenant_id,
          id,
          parse.data.status,
          parse.data.review_notes,
          user.email
        );
        return reply.send({ success: true, data: updated, timestamp: new Date().toISOString() });
      } catch (err: any) {
        if (err.message === 'INSUFFICIENT_LEAVE' || err.code === 'INSUFFICIENT_LEAVE') {
          return reply.status(400).send({
            success: false,
            error: { code: 'INSUFFICIENT_LEAVE', message: 'Insufficient leave balance' },
            timestamp: new Date().toISOString(),
          });
        }
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: err.message },
          timestamp: new Date().toISOString(),
        });
      }
    };
    fastify.patch('/staff-leaves/:id/review', reviewStaffLeaveHandler);
    fastify.patch('/attendance/staff-leaves/:id/review', reviewStaffLeaveHandler);
  };
}
