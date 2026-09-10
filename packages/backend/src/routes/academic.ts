import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { IDataStore } from '../services/store.js';
import { JWTPayload, StaffMemberRecord, StaffTeachingAssignment, StaffDepartment, EmploymentType, StaffStatus } from '@apex/shared-types';

export function academicRoutes(store: IDataStore) {
  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    // All routes require authentication
    fastify.addHook('onRequest', (fastify as any).authenticate);

    // --- Programs ---
    fastify.get('/programs', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const programs = await store.getPrograms(user.tenant_id);
      return reply.send({ success: true, data: programs, timestamp: new Date().toISOString() });
    });

    fastify.post('/programs', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        name: z.string().min(1),
        code: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        sort_order: z.coerce.number().int().default(1),
        fee_schedule: z.array(z.object({
          fee_head_id: z.string().optional(),
          head_name: z.string().optional(),
          fee_type: z.string().optional(),
          name: z.string().optional(),
          amount: z.coerce.number().min(0),
          is_monthly: z.boolean().optional(),
          is_recurring: z.boolean().optional(),
        })).optional(),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid program data', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      // If code was not supplied, auto-derive from name
      const code = parseResult.data.code && parseResult.data.code.trim().length > 0
        ? parseResult.data.code.trim().toUpperCase()
        : parseResult.data.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'CLS';

      const program = await store.createProgram({
        tenant_id: user.tenant_id,
        ...parseResult.data,
        code,
      });

      return reply.status(201).send({ success: true, data: program, timestamp: new Date().toISOString() });
    });

    fastify.delete('/programs/:id', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };
      const deleted = await store.deleteProgram(user.tenant_id, id);
      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Program not found' },
          timestamp: new Date().toISOString(),
        });
      }
      return reply.send({ success: true, message: 'Program deleted successfully', timestamp: new Date().toISOString() });
    });

    // --- Subjects ---
    fastify.get('/subjects', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const subjects = await store.getSubjects(user.tenant_id);
      return reply.send({ success: true, data: subjects, timestamp: new Date().toISOString() });
    });

    fastify.post('/subjects', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        is_core: z.boolean().default(true),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid subject data', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const subject = await store.createSubject({
        tenant_id: user.tenant_id,
        ...parseResult.data,
      });

      return reply.status(201).send({ success: true, data: subject, timestamp: new Date().toISOString() });
    });

    fastify.delete('/subjects/:id', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };
      const deleted = await store.deleteSubject(user.tenant_id, id);
      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Subject not found' },
          timestamp: new Date().toISOString(),
        });
      }
      return reply.send({ success: true, message: 'Subject deleted successfully', timestamp: new Date().toISOString() });
    });

    // --- Subject Groups ---
    fastify.get('/groups', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const { program_id } = request.query as { program_id?: string };
      const groups = await store.getSubjectGroups(user.tenant_id, program_id);
      return reply.send({ success: true, data: groups, timestamp: new Date().toISOString() });
    });

    fastify.post('/groups', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        program_id: z.string().min(1),
        name: z.string().min(1),
        type: z.enum(['compulsory', 'elective_track']),
        subject_ids: z.array(z.string()).min(1),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid subject group data', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const group = await store.createSubjectGroup({
        tenant_id: user.tenant_id,
        ...parseResult.data,
      });

      return reply.status(201).send({ success: true, data: group, timestamp: new Date().toISOString() });
    });

    fastify.delete('/groups/:id', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };
      const deleted = await store.deleteSubjectGroup(user.tenant_id, id);
      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Subject group not found' },
          timestamp: new Date().toISOString(),
        });
      }
      return reply.send({ success: true, message: 'Subject group deleted successfully', timestamp: new Date().toISOString() });
    });

    // --- Batches ---
    fastify.get('/batches', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const { program_id } = request.query as { program_id?: string };
      const batches = await store.getBatches(user.tenant_id, program_id);
      return reply.send({ success: true, data: batches, timestamp: new Date().toISOString() });
    });

    fastify.post('/batches', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        program_id: z.string().min(1),
        name: z.string().min(1),
        shift: z.enum(['morning', 'evening']),
        academic_session: z.string().min(1).default('2026-2027'),
        max_capacity: z.number().int().min(1).default(40),
        room_number: z.string().optional(),
        fee_schedule: z.array(z.object({
          fee_head_id: z.string().optional(),
          head_name: z.string().optional(),
          fee_type: z.string().optional(),
          name: z.string().optional(),
          amount: z.coerce.number().min(0),
          is_monthly: z.boolean().optional(),
          is_recurring: z.boolean().optional(),
        })).optional(),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid batch data', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const batch = await store.createBatch({
        tenant_id: user.tenant_id,
        ...parseResult.data,
      });

      return reply.status(201).send({ success: true, data: batch, timestamp: new Date().toISOString() });
    });

    fastify.delete('/batches/:id', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const { id } = request.params as { id: string };
      const deleted = await store.deleteBatch(user.tenant_id, id);
      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Batch not found' },
          timestamp: new Date().toISOString(),
        });
      }
      return reply.send({ success: true, message: 'Batch deleted successfully', timestamp: new Date().toISOString() });
    });

    // --- Custom Fields ---
    fastify.get('/custom-fields', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const { entity_type } = request.query as { entity_type?: 'student' | 'inquiry' };
      const fields = await store.getCustomFields(user.tenant_id, entity_type || 'student');
      return reply.send({ success: true, data: fields, timestamp: new Date().toISOString() });
    });

    fastify.post('/custom-fields', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      const schema = z.object({
        entity_type: z.enum(['student', 'inquiry']),
        field_key: z.string().min(1),
        label: z.string().min(1),
        field_type: z.enum(['text', 'number', 'select', 'date', 'checkbox']),
        options: z.array(z.string()).optional(),
        is_required: z.boolean().default(false),
        sort_order: z.number().int().default(0),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid custom field data', details: parseResult.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }

      const field = await store.createCustomField({
        tenant_id: user.tenant_id,
        ...parseResult.data,
      });

      return reply.status(201).send({ success: true, data: field, timestamp: new Date().toISOString() });
    });

    // --- Academy Settings ---
    const getAcademySettingsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const tenant = await store.getTenantById(user.tenant_id);
      if (!tenant) {
        return reply.status(404).send({
          success: false,
          error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' },
          timestamp: new Date().toISOString(),
        });
      }
      return reply.send({
        success: true,
        data: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          settings: tenant.settings || {},
        },
        timestamp: new Date().toISOString(),
      });
    };

    fastify.get('/settings', getAcademySettingsHandler);
    fastify.get('/academy-settings', getAcademySettingsHandler);

    const updateAcademySettingsHandler = async (request: any, reply: any) => {
      const user = request.user as JWTPayload;
      const { name, slug, settings } = request.body || {};
      const updated = await store.updateTenantSettings(user.tenant_id, {
        name,
        slug,
        settings,
      });

      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          settings: updated.settings,
        },
        message: 'Academy institutional settings updated successfully.',
        timestamp: new Date().toISOString(),
      });
    };

    fastify.put('/settings', updateAcademySettingsHandler);
    fastify.put('/academy-settings', updateAcademySettingsHandler);

    const publicStaff = (u: any): StaffMemberRecord => {
      const meta = u.metadata || {};
      const fallbackCode = `EMP-${u.id.substring(0, 4).toUpperCase()}`;
      return {
        id: u.id,
        tenant_id: u.tenant_id,
        user_id: u.id,
        employee_code: meta.employee_code || fallbackCode,
        full_name: u.full_name,
        father_or_spouse_name: meta.father_or_spouse_name || '',
        cnic: meta.cnic || '',
        blood_group: meta.blood_group || null,
        gender: meta.gender || 'male',
        dob: meta.dob || '',
        email: u.email,
        phone: u.phone || null,
        whatsapp: meta.whatsapp || u.phone || '',
        emergency_contact: meta.emergency_contact || '',
        emergency_relation: meta.emergency_relation || '',
        address: meta.address || '',
        department: (meta.department as StaffDepartment) || (u.role === 'finance_manager' ? 'Accounts' : 'General'),
        designation: (meta.designation as string) || (u.role === 'finance_manager' ? 'Accountant' : 'Faculty Member'),
        employment_type: (meta.employment_type as EmploymentType) || 'permanent',
        joining_date: meta.joining_date || u.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        probation_end_date: meta.probation_end_date || null,
        relieving_date: meta.relieving_date || null,
        qualification: meta.qualification || '',
        experience_years: typeof meta.experience_years === 'number' ? meta.experience_years : 0,
        base_salary: typeof meta.base_salary === 'number' ? meta.base_salary : 0,
        bank_name: meta.bank_name || '',
        bank_account_title: meta.bank_account_title || '',
        bank_account_number: meta.bank_account_number || '',
        bank_iban: meta.bank_iban || '',
        teaching_assignments: Array.isArray(meta.teaching_assignments) ? meta.teaching_assignments : [],
        permissions: Array.isArray(meta.permissions) ? meta.permissions : [],
        status: (u.status as StaffStatus) || 'active',
        role: u.role,
        avatar_url: u.avatar_url || null,
        leave_balance: meta.leave_balance || {
          casual_allowed: 12,
          casual_used: 0,
          sick_allowed: 8,
          sick_used: 0,
          annual_allowed: 10,
          annual_used: 0,
        },
        created_at: u.created_at,
        updated_at: u.updated_at,
      };
    };

    fastify.get('/staff', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      if (user.role !== 'tenant_admin' && user.role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the academy admin can manage staff.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { search, department, status } = (request.query as any) || {};
      const users = await store.getTenantUsers(user.tenant_id);
      let staffList = users
        .filter(u => !['super_admin', 'tenant_admin', 'student', 'parent'].includes(u.role))
        .map(publicStaff);

      if (status && status !== 'all') {
        staffList = staffList.filter(s => s.status === status);
      }

      if (department && department !== 'all') {
        if (department === 'Teaching Faculty') {
          staffList = staffList.filter(
            s => ['Science', 'Mathematics', 'Humanities', 'Languages', 'Commerce', 'General'].includes(s.department) ||
              s.teaching_assignments.length > 0 ||
              s.role === 'teacher'
          );
        } else if (department === 'Administration & Accounts') {
          staffList = staffList.filter(
            s => ['Administration', 'Accounts'].includes(s.department) ||
              s.role === 'finance_manager' ||
              s.role === 'academic_head'
          );
        } else if (department === 'Support Staff') {
          staffList = staffList.filter(
            s => !['Science', 'Mathematics', 'Humanities', 'Languages', 'Commerce', 'Administration', 'Accounts'].includes(s.department)
          );
        } else {
          staffList = staffList.filter(s => s.department === department);
        }
      }

      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        staffList = staffList.filter(s =>
          s.full_name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.phone && s.phone.includes(q)) ||
          s.employee_code.toLowerCase().includes(q) ||
          (s.cnic && s.cnic.includes(q)) ||
          s.designation.toLowerCase().includes(q) ||
          (s.whatsapp && s.whatsapp.includes(q))
        );
      }

      return reply.send({
        success: true,
        data: staffList,
        timestamp: new Date().toISOString(),
      });
    });

    fastify.post('/staff', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      if (user.role !== 'tenant_admin' && user.role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the academy admin can add staff.' },
          timestamp: new Date().toISOString(),
        });
      }
      const schema = z.object({
        full_name: z.string().min(2),
        email: z.string().email(),
        password: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        employee_code: z.string().optional().nullable(),
        father_or_spouse_name: z.string().optional().nullable(),
        cnic: z.string().optional().nullable(),
        blood_group: z.string().optional().nullable(),
        gender: z.enum(['male', 'female', 'other']).optional().nullable(),
        dob: z.string().optional().nullable(),
        whatsapp: z.string().optional().nullable(),
        emergency_contact: z.string().optional().nullable(),
        emergency_relation: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        department: z.enum(['Science', 'Mathematics', 'Humanities', 'Languages', 'Commerce', 'Administration', 'Accounts', 'General']).optional().nullable(),
        designation: z.string().optional().nullable(),
        employment_type: z.enum(['permanent', 'probationary', 'contractual', 'visiting']).optional().nullable(),
        role: z.enum(['teacher', 'finance_manager', 'academic_head', 'tenant_admin']).optional().nullable(),
        joining_date: z.string().optional().nullable(),
        probation_end_date: z.string().optional().nullable(),
        qualification: z.string().optional().nullable(),
        experience_years: z.coerce.number().optional().nullable(),
        base_salary: z.coerce.number().optional().nullable(),
        bank_name: z.string().optional().nullable(),
        bank_account_title: z.string().optional().nullable(),
        bank_account_number: z.string().optional().nullable(),
        bank_iban: z.string().optional().nullable(),
        teaching_assignments: z.array(z.object({
          program_id: z.string(),
          program_name: z.string(),
          batch_id: z.string(),
          batch_name: z.string(),
          subject_id: z.string(),
          subject_name: z.string(),
          weekly_periods: z.number().optional(),
        })).optional().nullable(),
        permissions: z.array(z.string()).optional().nullable(),
        status: z.enum(['active', 'on_leave', 'inactive', 'archived']).optional().nullable(),
      });
      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Name and a valid email are required.', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }
      try {
        const rawPassword = parse.data.password && parse.data.password.trim().length >= 6
          ? parse.data.password.trim()
          : `Apex-${Math.random().toString(36).slice(-4).toUpperCase()}#${Math.floor(100 + Math.random() * 900)}`;

        const created = await store.createStaff({
          tenant_id: user.tenant_id,
          ...parse.data,
          password: rawPassword,
          blood_group: parse.data.blood_group || null,
          role: parse.data.role || undefined,
          gender: parse.data.gender || 'male',
          department: parse.data.department || 'General',
          employment_type: parse.data.employment_type || 'permanent',
          experience_years: parse.data.experience_years ?? 0,
          base_salary: parse.data.base_salary ?? 0,
          teaching_assignments: parse.data.teaching_assignments || [],
          permissions: parse.data.permissions || [],
          status: parse.data.status || 'active',
        });

        return reply.status(201).send({
          success: true,
          data: publicStaff(created),
          temporary_password: rawPassword,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'STAFF_CREATE_FAILED', message: err.message || 'Could not add staff.' },
          timestamp: new Date().toISOString(),
        });
      }
    });

    fastify.put('/staff/:id', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      if (user.role !== 'tenant_admin' && user.role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the academy admin can update staff profiles.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { id } = request.params as { id: string };
      const schema = z.object({
        full_name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional().nullable(),
        employee_code: z.string().optional().nullable(),
        father_or_spouse_name: z.string().optional().nullable(),
        cnic: z.string().optional().nullable(),
        blood_group: z.string().optional().nullable(),
        gender: z.enum(['male', 'female', 'other']).optional().nullable(),
        dob: z.string().optional().nullable(),
        whatsapp: z.string().optional().nullable(),
        emergency_contact: z.string().optional().nullable(),
        emergency_relation: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        department: z.enum(['Science', 'Mathematics', 'Humanities', 'Languages', 'Commerce', 'Administration', 'Accounts', 'General']).optional().nullable(),
        designation: z.string().optional().nullable(),
        employment_type: z.enum(['permanent', 'probationary', 'contractual', 'visiting']).optional().nullable(),
        role: z.enum(['teacher', 'finance_manager', 'academic_head', 'tenant_admin']).optional().nullable(),
        joining_date: z.string().optional().nullable(),
        probation_end_date: z.string().optional().nullable(),
        relieving_date: z.string().optional().nullable(),
        qualification: z.string().optional().nullable(),
        experience_years: z.coerce.number().optional().nullable(),
        base_salary: z.coerce.number().optional().nullable(),
        bank_name: z.string().optional().nullable(),
        bank_account_title: z.string().optional().nullable(),
        bank_account_number: z.string().optional().nullable(),
        bank_iban: z.string().optional().nullable(),
        teaching_assignments: z.array(z.object({
          program_id: z.string(),
          program_name: z.string(),
          batch_id: z.string(),
          batch_name: z.string(),
          subject_id: z.string(),
          subject_name: z.string(),
          weekly_periods: z.number().optional(),
        })).optional().nullable(),
        permissions: z.array(z.string()).optional().nullable(),
        status: z.enum(['active', 'on_leave', 'inactive', 'archived']).optional().nullable(),
      });
      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid staff update data', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }
      try {
        const patchData: any = { ...parse.data };
        if (patchData.gender === null) delete patchData.gender;
        if (patchData.department === null) delete patchData.department;
        if (patchData.employment_type === null) delete patchData.employment_type;
        if (patchData.status === null) delete patchData.status;
        if (patchData.teaching_assignments === null) patchData.teaching_assignments = [];
        if (patchData.permissions === null) patchData.permissions = [];
        if (patchData.experience_years !== undefined && patchData.experience_years !== null) {
          patchData.experience_years = Number(patchData.experience_years);
        }
        if (patchData.base_salary !== undefined && patchData.base_salary !== null) {
          patchData.base_salary = Number(patchData.base_salary);
        }

        const updated = await store.updateStaff(user.tenant_id, id, patchData);
        if (!updated) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Staff member not found.' },
            timestamp: new Date().toISOString(),
          });
        }
        return reply.send({
          success: true,
          data: publicStaff(updated),
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'STAFF_UPDATE_FAILED', message: err.message || 'Could not update staff member.' },
          timestamp: new Date().toISOString(),
        });
      }
    });

    fastify.patch('/staff/:id/access', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      if (user.role !== 'tenant_admin' && user.role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the academy admin can change staff access.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { id } = request.params as { id: string };
      const schema = z.object({
        permissions: z.array(z.string()).optional(),
        status: z.enum(['active', 'inactive', 'suspended', 'on_leave', 'archived']).optional(),
        designation: z.string().optional(),
        full_name: z.string().optional(),
      });
      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid access payload' },
          timestamp: new Date().toISOString(),
        });
      }
      const updated = await store.updateStaff(user.tenant_id, id, parse.data);
      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Staff member not found' },
          timestamp: new Date().toISOString(),
        });
      }
      return reply.send({
        success: true,
        data: publicStaff(updated),
        timestamp: new Date().toISOString(),
      });
    });

    fastify.post('/staff/:id/reset-password', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      if (user.role !== 'tenant_admin' && user.role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the academy admin can reset passwords.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { id } = request.params as { id: string };
      const newPassword = (request.body?.password && request.body.password.trim().length >= 6)
        ? request.body.password.trim()
        : `Apex-${Math.random().toString(36).slice(-4).toUpperCase()}#${Math.floor(100 + Math.random() * 900)}`;

      const updated = await store.resetStaffPassword(user.tenant_id, id, newPassword);
      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Staff member not found.' },
          timestamp: new Date().toISOString(),
        });
      }
      return reply.send({
        success: true,
        temporary_password: newPassword,
        message: 'Password reset successfully.',
        timestamp: new Date().toISOString(),
      });
    });

    fastify.post('/staff/:id/archive', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      if (user.role !== 'tenant_admin' && user.role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the academy admin can archive staff.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { id } = request.params as { id: string };
      const reason = request.body?.reason || 'Relieved / Resigned';
      const updated = await store.archiveStaff(user.tenant_id, id, reason);
      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Staff member not found.' },
          timestamp: new Date().toISOString(),
        });
      }
      return reply.send({
        success: true,
        data: publicStaff(updated),
        timestamp: new Date().toISOString(),
      });
    });

    fastify.post('/staff/:id/restore', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      if (user.role !== 'tenant_admin' && user.role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the academy admin can restore staff.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { id } = request.params as { id: string };
      const updated = await store.restoreStaff(user.tenant_id, id);
      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Staff member not found.' },
          timestamp: new Date().toISOString(),
        });
      }
      return reply.send({
        success: true,
        data: publicStaff(updated),
        timestamp: new Date().toISOString(),
      });
    });

    fastify.delete('/staff/:id', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      if (user.role !== 'tenant_admin' && user.role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the academy admin can delete staff.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { id } = request.params as { id: string };
      try {
        const deleted = await store.deleteStaff(user.tenant_id, id);
        if (!deleted) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Staff member not found.' },
            timestamp: new Date().toISOString(),
          });
        }
        return reply.send({
          success: true,
          message: 'Staff member deleted successfully.',
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: { code: 'STAFF_DELETE_BLOCKED', message: err.message || 'Cannot delete staff member.' },
          timestamp: new Date().toISOString(),
        });
      }
    });

    fastify.put('/staff/:id/teaching-assignments', async (request: any, reply) => {
      const user = request.user as JWTPayload;
      if (user.role !== 'tenant_admin' && user.role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the academy admin can update teaching assignments.' },
          timestamp: new Date().toISOString(),
        });
      }
      const { id } = request.params as { id: string };
      const schema = z.object({
        assignments: z.array(z.object({
          program_id: z.string(),
          program_name: z.string(),
          batch_id: z.string(),
          batch_name: z.string(),
          subject_id: z.string(),
          subject_name: z.string(),
          weekly_periods: z.number().optional(),
        })),
      });
      const parse = schema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid teaching assignments payload', details: parse.error.flatten() },
          timestamp: new Date().toISOString(),
        });
      }
      const updated = await store.assignStaffTeaching(user.tenant_id, id, parse.data.assignments);
      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Staff member not found.' },
          timestamp: new Date().toISOString(),
        });
      }
      return reply.send({
        success: true,
        data: publicStaff(updated),
        timestamp: new Date().toISOString(),
      });
    });
  };
}
