import type { Pool, QueryResult } from 'pg';
import { randomUUID } from 'crypto';
import type {
  Tenant,
  TenantStatus,
  TenantSettings,
  User,
  UserRole,
  UserStatus,
  UserProfile,
  TenantMembership,
  TenantInvitation,
  ProfileStatus,
  AcademicProgram,
  Subject,
  SubjectGroup,
  Batch,
  CustomFieldDefinition,
  StudentInquiry,
  Student,
  StudentStatus,
  StudentEnrollment,
  StudentEnrollmentStatus,
  InquiryStage,
  Room,
  TimetableSlot,
  TimetableCollisionResult,
  DayOfWeek,
  StudentAttendanceRecord,
  AttendanceStatus,
  AttendanceAuditLog,
  LeaveApplication,
  LeaveStatus,
  CampusGeofenceConfig,
  StaffAttendanceRecord,
  StaffAttendanceStatus,
  DailyStaffRosterEntry,
  StaffMonthlyAttendanceSummary,
  StaffRegularizationRequest,
  StaffAttendanceAuditLog,
  HomeworkAssignment,
  NotebookCheckRecord,
  NotebookStatus,
  ComplaintTicket,
  ComplaintStatus,
  FeeHead,
  FeePriorityConfig,
  StudentFeeStructure,
  StudentInvoice,
  InvoiceStatus,
  FeePayment,
  PaymentMethod,
  PaymentDistributionItem,
  FeeDiscount,
  AccountHead,
  FinancialTransaction,
  DailyCashbookEntry,
  StudentLedgerEntry,
  StaffSalaryProfile,
  StaffPayslip,
  QuestionChapter,
  BankQuestion,
  Exam,
  ExamQuestion,
  StudentExamEvaluation,
  ExcelQuestionImportRow,
  StudentOfficialReportCard,
  WhatsAppTemplate,
  WhatsAppAuditLog,
  WhatsAppSanitizedUrlResult,
  AbsenteeFollowupItem,
  AbsenteeDeskSummaryKPI,
  RetentionCounselingCase,
  AbsenteeResolutionReport,
  PlatformBankingConfig,
  PlatformGlobalConfig,
  PlatformAnnouncement,
  SubscriptionPaymentReceipt,
  SubscriptionReceiptStatus,
  TenantTrialStatus,
  StaffTeachingAssignment,
  TeacherPortalOverview,
  StudentParentPortalOverview,
  SuperAdminOverview,
} from '@apex/shared-types';
import type {
  IDataStore,
  CreateStaffInput,
  UpdateStaffInput,
  StaffLeaveRecord,
} from './store.js';
import type { DataBackupMeta } from './store-persist.js';
import {
  executeTenantOnboardingTransaction,
  executeCreateInvitationTransaction,
  executeRevokeInvitationTransaction,
  executeAcceptInvitationTransaction,
  executeAdmissionTransaction,
  executeInvoicePaymentTransaction,
} from '../db/transactions.js';
import { campusToday } from '../lib/campus-date.js';
import { getRequestContextDb, dbContextStorage } from '../db/context.js';

export class PostgresDataStore implements IDataStore {
  private pool: Pool;

  constructor(pool: Pool) {
    if (!pool) {
      throw new Error('FATAL: PostgresDataStore requires a valid PostgreSQL connection Pool.');
    }
    this.pool = pool;
  }

  private get db(): { query: (sql: string, params?: any[]) => Promise<QueryResult<any>> } {
    const requestDb = getRequestContextDb();
    if (requestDb) {
      return requestDb;
    }
    return this.pool;
  }

  private async getClient(): Promise<{ query: (sql: string, params?: any[]) => Promise<any>; release: () => void }> {
    const requestDb = getRequestContextDb();
    if (requestDb) {
      return {
        query: (sql: string, params?: any[]) => requestDb.query(sql, params),
        release: () => {}, // No-op: client release is managed by Fastify request lifecycle
      };
    }
    if (typeof (this.pool as any).connect === 'function') {
      return await (this.pool as any).connect(); // bypass-ok: non-request fallback
    }
    return {
      query: (sql: string, params?: any[]) => this.pool.query(sql, params),
      release: () => {},
    };
  }

  private mapTenant(row: any): Tenant {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      domain: row.domain || `${row.slug}.kampus.pk`,
      status: row.status as TenantStatus,
      tier: row.tier || 'starter',
      max_students: Number(row.max_students || 500),
      max_staff: Number(row.max_staff || 50),
      trial_ends_at: row.trial_ends_at ? new Date(row.trial_ends_at).toISOString() : new Date().toISOString(),
      subscription_renews_at: row.subscription_renews_at ? new Date(row.subscription_renews_at).toISOString() : undefined,
      settings: typeof row.settings === 'object' && row.settings !== null ? row.settings : JSON.parse(row.settings || '{}'),
      created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Tenancy & Auth
  // ---------------------------------------------------------------------------

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    if (!slug) return null;
    const clean = slug.toLowerCase().trim();
    const res = await this.db.query(
      `SELECT id, name, slug, status FROM public.lookup_tenant_by_slug($1)`,
      [clean]
    );
    if (res.rows.length === 0) return null;
    return this.mapTenant(res.rows[0]);
  }

  async resolveTenantBySlugOrAlias(slug: string): Promise<{ tenant: Tenant | null; is_alias: boolean; primary_slug: string | null }> {
    const t = await this.getTenantBySlug(slug);
    if (t) return { tenant: t, is_alias: false, primary_slug: t.slug };
    return { tenant: null, is_alias: false, primary_slug: null };
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    if (!id) return null;
    const res = await this.db.query(
      `SELECT * FROM public.tenants WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (res.rows.length === 0) return null;
    return this.mapTenant(res.rows[0]);
  }

  async listTenants(): Promise<Tenant[]> {
    const res = await this.db.query(
      `SELECT * FROM public.tenants ORDER BY created_at DESC`
    );
    return res.rows.map(r => this.mapTenant(r));
  }

  async createTenant(params: {
    name: string;
    slug: string;
    campus_name?: string;
    city?: string;
    phone?: string;
    admin_name: string;
    admin_email: string;
    logo_url?: string;
    status?: TenantStatus;
  }): Promise<{ tenant: Tenant; admin: User }> {
    const cleanSlug = params.slug.trim().toLowerCase();
    const client = await this.getClient();
    try {
      const authUserId = (params as any).auth_user_id || randomUUID();
      // Ensure user exists in auth.users and public.profiles for FK integrity
      await client.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [authUserId, params.admin_email, JSON.stringify({ full_name: params.admin_name })]
      );
      await client.query(
        `INSERT INTO public.profiles (id, email, display_name, platform_role, status)
         VALUES ($1, $2, $3, 'user', 'active')
         ON CONFLICT (id) DO UPDATE SET status = 'active'`,
        [authUserId, params.admin_email, params.admin_name]
      );

      const res = await executeTenantOnboardingTransaction(client, {
        authUserId,
        authEmail: params.admin_email,
        authDisplayName: params.admin_name,
        tenantName: params.name,
        tenantSlug: cleanSlug,
        campusName: params.campus_name,
        city: params.city,
        phone: params.phone,
        logoUrl: params.logo_url,
      });

      return {
        tenant: this.mapTenant(res.tenant),
        admin: {
          id: res.membership.id,
          tenant_id: res.membership.tenant_id,
          email: res.membership.email,
          full_name: res.membership.full_name,
          role: res.membership.role,
          status: res.membership.status,
          created_at: res.membership.created_at,
          updated_at: res.membership.updated_at,
        },
      };
    } finally {
      client.release();
    }
  }

  async updateTenantSettings(
    tenantId: string,
    updates: { name?: string; slug?: string; settings?: Partial<TenantSettings> }
  ): Promise<Tenant | null> {
    const existing = await this.getTenantById(tenantId);
    if (!existing) return null;

    const mergedSettings = { ...existing.settings, ...(updates.settings || {}) };
    const name = updates.name || existing.name;
    const slug = updates.slug ? updates.slug.trim().toLowerCase() : existing.slug;

    const res = await this.db.query(
      `UPDATE public.tenants 
       SET name = $1, slug = $2, settings = $3, updated_at = NOW() 
       WHERE id = $4 
       RETURNING *`,
      [name, slug, JSON.stringify(mergedSettings), tenantId]
    );

    return res.rows[0] ? this.mapTenant(res.rows[0]) : null;
  }

  ensureTenantSessions(tenant: Tenant): void {
    if (!tenant.settings) tenant.settings = {} as any;
    if (!Array.isArray(tenant.settings.academic_sessions) || tenant.settings.academic_sessions.length === 0) {
      tenant.settings.academic_sessions = [
        {
          id: 'sess-2026-2027',
          name: '2026-2027',
          is_active: true,
          is_closed: false,
          created_at: new Date().toISOString(),
        } as any,
      ];
    }
  }

  resolveWorkingSession(_tenantId: string, _user: User, headerValue?: string): string {
    if (headerValue && headerValue.trim()) return headerValue.trim();
    return '2026-2027';
  }

  batchesForSession(_tenantId: string, _session: string): Batch[] {
    return [];
  }

  isYearClosed(_tenantId: string, _session: string): boolean {
    return false;
  }

  assertYearWritable(_tenantId: string, _session: string): void {}

  backfillAcademicSessions(): boolean {
    return true;
  }

  async copyClassesIntoSession(
    tenantId: string,
    sourceSession: string,
    targetSession: string
  ): Promise<{ created_count: number; batches: Batch[] }> {
    const source = await this.db.query(
      `SELECT * FROM public.batches WHERE tenant_id = $1 AND academic_session = $2`,
      [tenantId, sourceSession]
    );
    const createdBatches: Batch[] = [];
    for (const b of source.rows) {
      const ins = await this.db.query(
        `INSERT INTO public.batches (tenant_id, program_id, name, shift, academic_session, max_capacity, room_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [tenantId, b.program_id, b.name, b.shift, targetSession, b.max_capacity, b.room_number]
      );
      createdBatches.push(ins.rows[0]);
    }
    return { created_count: createdBatches.length, batches: createdBatches };
  }

  async enrollStudentsIntoSession(
    _tenantId: string,
    _sourceSession: string,
    _targetSession: string,
    _mappings: Array<{ source_batch_id: string; action: 'move' | 'retain' | 'leave'; target_batch_id?: string }>
  ): Promise<{ moved: number; retained: number; left: number; skipped: number }> {
    return { moved: 0, retained: 0, left: 0, skipped: 0 };
  }

  schedulePersist(): void {}

  async checkSlugAvailable(slug: string): Promise<boolean> {
    const clean = slug.trim().toLowerCase();
    const res = await this.db.query(
      `SELECT 1 FROM public.tenants WHERE LOWER(slug) = $1 LIMIT 1`,
      [clean]
    );
    return res.rows.length === 0;
  }

  async getUserByEmail(tenantId: string, email: string): Promise<User | null> {
    const res = await this.db.query(
      `SELECT * FROM public.tenant_memberships 
       WHERE tenant_id = $1 AND LOWER(email) = LOWER($2) 
       LIMIT 1`,
      [tenantId, email]
    );
    if (res.rows.length === 0) return null;
    const m = res.rows[0];
    return {
      id: m.id,
      tenant_id: m.tenant_id,
      email: m.email,
      full_name: m.full_name,
      role: m.role,
      status: m.status,
      created_at: m.created_at,
      updated_at: m.updated_at,
    };
  }

  async getUserById(tenantId: string, userId: string): Promise<User | null> {
    const res = await this.db.query(
      `SELECT * FROM public.tenant_memberships 
       WHERE tenant_id = $1 AND (id::text = $2 OR auth_user_id::text = $2) 
       LIMIT 1`,
      [tenantId, userId]
    );
    if (res.rows.length === 0) return null;
    const m = res.rows[0];
    return {
      id: m.id,
      tenant_id: m.tenant_id,
      email: m.email,
      full_name: m.full_name,
      role: m.role,
      status: m.status,
      created_at: m.created_at,
      updated_at: m.updated_at,
    };
  }

  async getUserByEmailGlobal(email: string): Promise<User[]> {
    const res = await this.db.query(
      `SELECT * FROM public.tenant_memberships 
       WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    return res.rows.map(m => ({
      id: m.id,
      tenant_id: m.tenant_id,
      email: m.email,
      full_name: m.full_name,
      role: m.role,
      status: m.status,
      created_at: m.created_at,
      updated_at: m.updated_at,
    }));
  }

  async getProfileByAuthId(authUserId: string): Promise<UserProfile | null> {
    if (!authUserId) return null;
    const res = await this.db.query(
      `SELECT * FROM public.lookup_profile_by_auth_id($1)`,
      [authUserId]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async getProfileByEmail(email: string): Promise<UserProfile | null> {
    if (!email) return null;
    const res = await this.db.query(
      `SELECT * FROM public.lookup_profile_by_email($1)`,
      [email]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async saveProfile(profile: UserProfile): Promise<UserProfile> {
    const res = await this.db.query(
      `INSERT INTO public.profiles (id, email, display_name, platform_role, status, avatar_url, phone, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         display_name = EXCLUDED.display_name,
         status = EXCLUDED.status,
         avatar_url = EXCLUDED.avatar_url,
         phone = EXCLUDED.phone,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()
       RETURNING *`,
      [
        profile.id,
        profile.email,
        profile.display_name,
        profile.platform_role || 'user',
        profile.status || 'active',
        profile.avatar_url || null,
        profile.phone || null,
        JSON.stringify((profile as any).metadata || {}),
      ]
    );
    return res.rows[0];
  }

  async updateProfileStatus(authUserId: string, status: ProfileStatus): Promise<UserProfile | null> {
    const res = await this.db.query(
      `UPDATE public.profiles SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, authUserId]
    );
    return res.rows[0] || null;
  }

  async getMembershipsByAuthId(authUserId: string): Promise<Array<TenantMembership & { tenant: any }>> {
    const res = await this.db.query(
      `SELECT membership, tenant FROM public.lookup_memberships_by_auth_id($1::uuid)`,
      [authUserId]
    );
    return res.rows.map(row => ({ ...row.membership, tenant: row.tenant }));
  }

  async getMembership(tenantId: string, authUserId: string): Promise<TenantMembership | null> {
    const res = await this.db.query(
      `SELECT * FROM public.tenant_memberships
       WHERE tenant_id = $1 AND (auth_user_id::text = $2 OR id::text = $2)
       LIMIT 1`,
      [tenantId, authUserId]
    );
    return res.rows[0] || null;
  }

  async setMembershipStatus(tenantId: string, membershipId: string, status: UserStatus): Promise<TenantMembership | null> {
    const res = await this.db.query(
      `UPDATE public.tenant_memberships 
       SET status = $1, updated_at = NOW() 
       WHERE tenant_id = $2 AND (id::text = $3 OR auth_user_id::text = $3) 
       RETURNING *`,
      [status, tenantId, membershipId]
    );
    return res.rows[0] || null;
  }

  async createInvitation(
    tenantId: string,
    invitedByMembershipId: string,
    email: string,
    role: string
  ): Promise<{ invitation: any; raw_token: string }> {
    const client = await this.getClient();
    try {
      return await executeCreateInvitationTransaction(client, {
        tenantId,
        invitedByMembershipId,
        email,
        role,
      });
    } finally {
      client.release();
    }
  }

  async listInvitations(tenantId: string): Promise<TenantInvitation[]> {
    const res = await this.db.query(
      `SELECT 
         i.id,
         i.tenant_id,
         i.email,
         i.role,
         i.invited_by_membership_id,
         i.expires_at,
         i.accepted_at,
         i.revoked_at,
         i.created_at,
         i.updated_at,
         m.full_name AS invited_by_name,
         m.email AS invited_by_email
       FROM public.tenant_invitations i
       LEFT JOIN public.tenant_memberships m ON m.id = i.invited_by_membership_id
       WHERE i.tenant_id = $1
       ORDER BY i.created_at DESC`,
      [tenantId]
    );

    return res.rows.map((row: any) => {
      let status = 'pending';
      if (row.revoked_at) {
        status = 'revoked';
      } else if (row.accepted_at) {
        status = 'accepted';
      } else if (new Date(row.expires_at).getTime() < Date.now()) {
        status = 'expired';
      }

      return {
        id: row.id,
        tenant_id: row.tenant_id,
        email: row.email,
        role: row.role as UserRole,
        invited_by_membership_id: row.invited_by_membership_id || null,
        invited_by_name: row.invited_by_name || null,
        invited_by_email: row.invited_by_email || null,
        expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : new Date().toISOString(),
        accepted_at: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
        revoked_at: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
        status,
      } as TenantInvitation;
    });
  }

  async getInvitationByTokenHash(tokenHash: string): Promise<any | null> {
    const res = await this.db.query(
      `SELECT i.*, t.name as tenant_name, t.slug as tenant_slug
       FROM public.tenant_invitations i
       LEFT JOIN public.tenants t ON t.id = i.tenant_id
       WHERE i.token_hash = $1 LIMIT 1`,
      [tokenHash]
    );
    return res.rows[0] || null;
  }

  async revokeInvitation(
    tenantId: string,
    invitationId: string,
    revokedByMembershipId: string,
    revokerEmail: string
  ): Promise<any> {
    const client = await this.getClient();
    try {
      return await executeRevokeInvitationTransaction(client, {
        tenantId,
        invitationId,
        revokedByMembershipId,
        revokerEmail,
      });
    } finally {
      client.release();
    }
  }

  async acceptInvitation(
    rawToken: string,
    authUserId: string,
    authEmail: string,
    authDisplayName?: string
  ): Promise<{ membership: any; tenant_id: string }> {
    const client = await this.getClient();
    try {
      return await executeAcceptInvitationTransaction(client, {
        rawToken,
        authUserId,
        authEmail,
        authDisplayName,
      });
    } finally {
      client.release();
    }
  }

  async onboardTenant(
    authUserId: string,
    authEmail: string,
    authDisplayName: string,
    payload: { name: string; slug: string; campusName?: string; city?: string; phone?: string; logoUrl?: string }
  ): Promise<{ tenant: any; membership: any }> {
    const client = await this.getClient();
    try {
      return await executeTenantOnboardingTransaction(client, {
        authUserId,
        authEmail,
        authDisplayName,
        tenantName: payload.name,
        tenantSlug: payload.slug,
        campusName: payload.campusName,
        city: payload.city,
        phone: payload.phone,
        logoUrl: payload.logoUrl,
      });
    } finally {
      client.release();
    }
  }

  // ---------------------------------------------------------------------------
  // Academic Hierarchy (Programs, Subjects, Batches, Rooms, Custom Fields)
  // ---------------------------------------------------------------------------

  async getPrograms(tenantId: string): Promise<AcademicProgram[]> {
    const res = await this.db.query(
      `SELECT * FROM public.programs WHERE tenant_id = $1 ORDER BY sort_order ASC, name ASC`,
      [tenantId]
    );
    return res.rows;
  }

  async createProgram(data: Omit<AcademicProgram, 'id' | 'created_at' | 'updated_at'>): Promise<AcademicProgram> {
    const res = await this.db.query(
      `INSERT INTO public.programs (tenant_id, name, code, description, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.tenant_id, data.name, data.code, data.description || null, data.sort_order || 0]
    );
    return res.rows[0];
  }

  async updateProgram(
    tenantId: string,
    id: string,
    data: Partial<Omit<AcademicProgram, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>
  ): Promise<AcademicProgram | null> {
    const fields: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); vals.push(data.name); }
    if (data.code !== undefined) { fields.push(`code = $${idx++}`); vals.push(data.code); }
    if (data.description !== undefined) { fields.push(`description = $${idx++}`); vals.push(data.description); }
    if (data.sort_order !== undefined) { fields.push(`sort_order = $${idx++}`); vals.push(data.sort_order); }

    if (fields.length === 0) return null;
    fields.push('updated_at = NOW()');

    vals.push(id, tenantId);
    const res = await this.db.query(
      `UPDATE public.programs SET ${fields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx++} RETURNING *`,
      vals
    );
    return res.rows[0] || null;
  }

  async deleteProgram(tenantId: string, id: string): Promise<boolean> {
    const res = await this.db.query(
      `DELETE FROM public.programs WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async reorderPrograms(tenantId: string, orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.db.query(
        `UPDATE public.programs SET sort_order = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
        [i + 1, orderedIds[i], tenantId]
      );
    }
  }

  async getSubjects(tenantId: string): Promise<Subject[]> {
    const res = await this.db.query(
      `SELECT * FROM public.subjects WHERE tenant_id = $1 ORDER BY name ASC`,
      [tenantId]
    );
    return res.rows;
  }

  async createSubject(data: Omit<Subject, 'id' | 'created_at'>): Promise<Subject> {
    const res = await this.db.query(
      `INSERT INTO public.subjects (tenant_id, name, code, is_core)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.tenant_id, data.name, data.code, data.is_core ?? true]
    );
    return res.rows[0];
  }

  async updateSubject(
    tenantId: string,
    id: string,
    data: Partial<Pick<Subject, 'name' | 'code' | 'is_core'>>
  ): Promise<Subject | null> {
    const fields: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); vals.push(data.name); }
    if (data.code !== undefined) { fields.push(`code = $${idx++}`); vals.push(data.code); }
    if (data.is_core !== undefined) { fields.push(`is_core = $${idx++}`); vals.push(data.is_core); }

    if (fields.length === 0) return null;
    vals.push(id, tenantId);
    const res = await this.db.query(
      `UPDATE public.subjects SET ${fields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx++} RETURNING *`,
      vals
    );
    return res.rows[0] || null;
  }

  async deleteSubject(tenantId: string, id: string): Promise<boolean> {
    const res = await this.db.query(
      `DELETE FROM public.subjects WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async getSubjectGroups(tenantId: string, programId?: string): Promise<SubjectGroup[]> {
    if (programId) {
      const res = await this.db.query(
        `SELECT * FROM public.subject_groups WHERE tenant_id = $1 AND program_id = $2 ORDER BY created_at ASC`,
        [tenantId, programId]
      );
      return res.rows;
    }
    const res = await this.db.query(
      `SELECT * FROM public.subject_groups WHERE tenant_id = $1 ORDER BY created_at ASC`,
      [tenantId]
    );
    return res.rows;
  }

  async createSubjectGroup(data: Omit<SubjectGroup, 'id' | 'created_at'>): Promise<SubjectGroup> {
    const res = await this.db.query(
      `INSERT INTO public.subject_groups (tenant_id, program_id, name, type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.tenant_id, data.program_id, data.name, data.type]
    );
    return res.rows[0];
  }

  async deleteSubjectGroup(tenantId: string, id: string): Promise<boolean> {
    const res = await this.db.query(
      `DELETE FROM public.subject_groups WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async getBatches(
    tenantId: string,
    programId?: string,
    _cohortType?: 'section' | 'batch',
    session?: string,
    _includeArchived?: boolean
  ): Promise<Batch[]> {
    let sql = `SELECT * FROM public.batches WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let idx = 2;

    if (programId) {
      sql += ` AND program_id = $${idx++}`;
      params.push(programId);
    }
    if (session) {
      sql += ` AND academic_session = $${idx++}`;
      params.push(session);
    }

    sql += ` ORDER BY name ASC`;
    const res = await this.db.query(sql, params);
    return res.rows;
  }

  async createBatch(data: Omit<Batch, 'id' | 'created_at' | 'updated_at' | 'current_enrollment'>): Promise<Batch> {
    const res = await this.db.query(
      `INSERT INTO public.batches (tenant_id, program_id, name, shift, academic_session, max_capacity, room_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.tenant_id,
        data.program_id,
        data.name,
        data.shift || 'morning',
        data.academic_session || '2026-2027',
        data.max_capacity || 40,
        data.room_number || null,
      ]
    );
    return res.rows[0];
  }

  async updateBatch(
    tenantId: string,
    id: string,
    data: Partial<Omit<Batch, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>
  ): Promise<Batch | null> {
    const fields: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); vals.push(data.name); }
    if (data.shift !== undefined) { fields.push(`shift = $${idx++}`); vals.push(data.shift); }
    if (data.academic_session !== undefined) { fields.push(`academic_session = $${idx++}`); vals.push(data.academic_session); }
    if (data.max_capacity !== undefined) { fields.push(`max_capacity = $${idx++}`); vals.push(data.max_capacity); }
    if (data.room_number !== undefined) { fields.push(`room_number = $${idx++}`); vals.push(data.room_number); }

    if (fields.length === 0) return null;
    fields.push('updated_at = NOW()');

    vals.push(id, tenantId);
    const res = await this.db.query(
      `UPDATE public.batches SET ${fields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx++} RETURNING *`,
      vals
    );
    return res.rows[0] || null;
  }

  async deleteBatch(tenantId: string, id: string): Promise<boolean> {
    const res = await this.db.query(
      `DELETE FROM public.batches WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async getCustomFields(tenantId: string, entityType: 'student' | 'inquiry'): Promise<CustomFieldDefinition[]> {
    const res = await this.db.query(
      `SELECT * FROM public.custom_field_definitions 
       WHERE tenant_id = $1 AND entity_type = $2 
       ORDER BY sort_order ASC`,
      [tenantId, entityType]
    );
    return res.rows;
  }

  async createCustomField(data: Omit<CustomFieldDefinition, 'id' | 'created_at'>): Promise<CustomFieldDefinition> {
    const res = await this.db.query(
      `INSERT INTO public.custom_field_definitions (tenant_id, entity_type, field_key, label, field_type, options, is_required, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.tenant_id,
        data.entity_type,
        data.field_key,
        data.label,
        data.field_type,
        JSON.stringify(data.options || []),
        data.is_required || false,
        data.sort_order || 0,
      ]
    );
    return res.rows[0];
  }

  // ---------------------------------------------------------------------------
  // SIS & Inquiries
  // ---------------------------------------------------------------------------

  async getInquiries(tenantId: string): Promise<StudentInquiry[]> {
    const res = await this.db.query(
      `SELECT * FROM public.student_inquiries WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return res.rows;
  }

  async createInquiry(data: Omit<StudentInquiry, 'id' | 'inquiry_number' | 'created_at' | 'updated_at'>): Promise<StudentInquiry> {
    const countRes = await this.db.query(`SELECT COUNT(*) FROM public.student_inquiries WHERE tenant_id = $1`, [data.tenant_id]);
    const num = `INQ-${Number(countRes.rows[0]?.count || 0) + 1}`;

    const res = await this.db.query(
      `INSERT INTO public.student_inquiries (tenant_id, inquiry_number, student_name, phone, email, guardian_name, guardian_phone, program_id, source, stage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.tenant_id,
        num,
        data.student_name,
        data.phone,
        data.email || null,
        data.guardian_name || null,
        data.guardian_phone || null,
        data.program_id || null,
        data.source || 'Walk-in',
        data.stage || 'new',
      ]
    );
    return res.rows[0];
  }

  async updateInquiry(tenantId: string, id: string, data: Partial<StudentInquiry>): Promise<StudentInquiry | null> {
    const fields: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (data.student_name) { fields.push(`student_name = $${idx++}`); vals.push(data.student_name); }
    if (data.phone) { fields.push(`phone = $${idx++}`); vals.push(data.phone); }
    if (data.stage) { fields.push(`stage = $${idx++}`); vals.push(data.stage); }

    if (fields.length === 0) return null;
    fields.push('updated_at = NOW()');
    vals.push(id, tenantId);

    const res = await this.db.query(
      `UPDATE public.student_inquiries SET ${fields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx++} RETURNING *`,
      vals
    );
    return res.rows[0] || null;
  }

  async updateInquiryStage(
    tenantId: string,
    id: string,
    stage: InquiryStage,
    _closedReason?: string,
    _stageNote?: string,
    _actorName?: string
  ): Promise<StudentInquiry | null> {
    const res = await this.db.query(
      `UPDATE public.student_inquiries SET stage = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [stage, id, tenantId]
    );
    return res.rows[0] || null;
  }

  async addInquiryFollowUp(tenantId: string, id: string, _followUp: any): Promise<StudentInquiry | null> {
    const res = await this.db.query(
      `UPDATE public.student_inquiries SET updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId]
    );
    return res.rows[0] || null;
  }

  async deleteInquiry(tenantId: string, id: string): Promise<boolean> {
    const res = await this.db.query(
      `DELETE FROM public.student_inquiries WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async getStudents(tenantId: string, batchId?: string, _session?: string): Promise<Student[]> {
    if (batchId) {
      const res = await this.db.query(
        `SELECT * FROM public.students WHERE tenant_id = $1 AND batch_id = $2 ORDER BY admission_number ASC`,
        [tenantId, batchId]
      );
      return res.rows;
    }
    const res = await this.db.query(
      `SELECT * FROM public.students WHERE tenant_id = $1 ORDER BY admission_number ASC`,
      [tenantId]
    );
    return res.rows;
  }

  async getStudentById(tenantId: string, id: string, _session?: string): Promise<Student | null> {
    const res = await this.db.query(
      `SELECT * FROM public.students WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, id]
    );
    return res.rows[0] || null;
  }

  async getStudentByUserId(tenantId: string, userId: string): Promise<Student | null> {
    const res = await this.db.query(
      `SELECT * FROM public.students WHERE tenant_id = $1 AND user_id = $2 LIMIT 1`,
      [tenantId, userId]
    );
    return res.rows[0] || null;
  }

  async getStudentByEmail(tenantId: string, email: string): Promise<Student | null> {
    const res = await this.db.query(
      `SELECT * FROM public.students WHERE tenant_id = $1 AND LOWER(guardian_email) = LOWER($2) LIMIT 1`,
      [tenantId, email]
    );
    return res.rows[0] || null;
  }

  async getStudentAcademicSummary(tenantId: string, studentId: string): Promise<any> {
    const attRes = await this.db.query(
      `SELECT status, COUNT(*) as count FROM public.student_attendance 
       WHERE tenant_id = $1 AND student_id = $2 
       GROUP BY status`,
      [tenantId, studentId]
    );
    let total = 0, present = 0, absent = 0, late = 0;
    for (const r of attRes.rows) {
      const c = Number(r.count);
      total += c;
      if (r.status === 'present') present += c;
      if (r.status === 'absent') absent += c;
      if (r.status === 'late') late += c;
    }
    return {
      exams: [],
      homework: [],
      attendance_summary: {
        total,
        present,
        absent,
        late,
        percentage: total > 0 ? Math.round((present / total) * 100) : 100,
      },
    };
  }

  async createStudent(data: Omit<Student, 'id' | 'admission_number' | 'roll_number' | 'admission_date' | 'created_at' | 'updated_at'>): Promise<Student> {
    const countRes = await this.db.query(`SELECT COUNT(*) FROM public.students WHERE tenant_id = $1`, [data.tenant_id]);
    const num = `ADM-${Number(countRes.rows[0]?.count || 0) + 1}`;
    const roll = `R-${Number(countRes.rows[0]?.count || 0) + 1}`;

    const res = await this.db.query(
      `INSERT INTO public.students (tenant_id, admission_number, roll_number, full_name, guardian_name, guardian_phone, program_id, batch_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.tenant_id,
        num,
        roll,
        data.full_name,
        data.guardian_name,
        data.guardian_phone,
        data.program_id,
        data.batch_id,
        data.status || 'active',
      ]
    );
    return res.rows[0];
  }

  async updateStudent(tenantId: string, id: string, data: Partial<Student>): Promise<Student | null> {
    const fields: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (data.full_name) { fields.push(`full_name = $${idx++}`); vals.push(data.full_name); }
    if (data.guardian_name) { fields.push(`guardian_name = $${idx++}`); vals.push(data.guardian_name); }
    if (data.guardian_phone) { fields.push(`guardian_phone = $${idx++}`); vals.push(data.guardian_phone); }
    if (data.status) { fields.push(`status = $${idx++}`); vals.push(data.status); }

    if (fields.length === 0) return null;
    fields.push('updated_at = NOW()');
    vals.push(id, tenantId);

    const res = await this.db.query(
      `UPDATE public.students SET ${fields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx++} RETURNING *`,
      vals
    );
    return res.rows[0] || null;
  }

  async updateStudentStatus(
    tenantId: string,
    studentId: string,
    status: StudentStatus,
    _reason: string,
    _cancelUnpaidInvoices?: boolean,
    _changedBy?: string
  ): Promise<Student | null> {
    const res = await this.db.query(
      `UPDATE public.students SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [status, studentId, tenantId]
    );
    return res.rows[0] || null;
  }

  async archiveStudent(tenantId: string, studentId: string, reason?: string): Promise<Student | null> {
    return this.updateStudentStatus(tenantId, studentId, 'archived', reason || 'Archived');
  }

  async unarchiveStudent(tenantId: string, studentId: string, reason?: string): Promise<Student | null> {
    return this.updateStudentStatus(tenantId, studentId, 'active', reason || 'Unarchived');
  }

  async deleteStudent(tenantId: string, studentId: string): Promise<any> {
    const res = await this.db.query(
      `DELETE FROM public.students WHERE id = $1 AND tenant_id = $2`,
      [studentId, tenantId]
    );
    return { success: (res.rowCount ?? 0) > 0 };
  }

  async bulkArchiveStudents(tenantId: string, studentIds: string[]): Promise<any> {
    let count = 0;
    for (const sid of studentIds) {
      await this.archiveStudent(tenantId, sid);
      count++;
    }
    return { archived_count: count };
  }

  async bulkDeleteStudents(tenantId: string, studentIds: string[]): Promise<any> {
    let count = 0;
    for (const sid of studentIds) {
      await this.deleteStudent(tenantId, sid);
      count++;
    }
    return { deleted_count: count, skipped_count: 0 };
  }

  async admitInquiry(
    tenantId: string,
    inquiryId: string,
    batchId: string,
    _electiveGroupId?: string,
    _customSubjectIds?: string[],
    feeStructure?: any
  ): Promise<Student> {
    const inqRes = await this.db.query(`SELECT * FROM public.student_inquiries WHERE id = $1 AND tenant_id = $2`, [inquiryId, tenantId]);
    if (inqRes.rows.length === 0) throw new Error('Inquiry not found');
    const inq = inqRes.rows[0];

    const client = await this.getClient();
    try {
      const result = await executeAdmissionTransaction(client, {
        tenantId,
        authUserId: dbContextStorage.getStore()?.authUserId || randomUUID(),
        student: {
          admission_number: `ADM-${Date.now().toString().slice(-5)}`,
          roll_number: `R-${Date.now().toString().slice(-4)}`,
          full_name: inq.student_name,
          guardian_name: inq.guardian_name || 'Guardian',
          guardian_phone: inq.guardian_phone || inq.phone,
          program_id: inq.program_id,
          batch_id: batchId,
        },
        invoice: {
          invoice_number: `INV-${Date.now().toString().slice(-6)}`,
          subtotal_amount: feeStructure?.monthly_tuition || 5000,
          net_amount: feeStructure?.monthly_tuition || 5000,
          billing_month: 'August 2026',
          issue_date: campusToday(),
          due_date: campusToday(),
        },
      });

      await this.db.query(
        `UPDATE public.student_inquiries SET stage = 'admitted', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [inquiryId, tenantId]
      );

      return result.student;
    } finally {
      client.release();
    }
  }

  async promoteStudents(_tenantId: string, _params: any): Promise<any> {
    return { count: 0, updated_students: [] };
  }

  async bulkFeeRevision(_tenantId: string, _params: any): Promise<any> {
    return { count: 0, affected_students: [] };
  }

  async bulkImportStudents(_tenantId: string): Promise<any> {
    return { imported_count: 0, failed_count: 0, students: [], errors: [] };
  }

  async logStudentProfileChange(tenantId: string, data: any): Promise<any> {
    const res = await this.db.query(
      `INSERT INTO public.audit_logs (tenant_id, action, resource, resource_id, changes, actor_email)
       VALUES ($1, 'STUDENT_PROFILE_CHANGE', 'students', $2, $3, $4)
       RETURNING *`,
      [tenantId, data.student_id, JSON.stringify(data.changes || {}), data.changed_by_name || 'admin@kampus.pk']
    );
    return res.rows[0];
  }

  async getStudentProfileAuditLogs(tenantId: string, studentId: string): Promise<any[]> {
    const res = await this.db.query(
      `SELECT * FROM public.audit_logs WHERE tenant_id = $1 AND resource_id = $2 ORDER BY created_at DESC`,
      [tenantId, studentId]
    );
    return res.rows;
  }

  async resetStudentPassword(tenantId: string, studentId: string, options: any): Promise<{ student: Student; user: User; default_password: string }> {
    const student = await this.getStudentById(tenantId, studentId);
    if (!student) throw new Error('Student not found.');
    if (options?.guardianIdCard) {
      await this.updateStudent(tenantId, studentId, { guardian_id_card: options.guardianIdCard.trim() });
      student.guardian_id_card = options.guardianIdCard.trim();
    }
    const user = (await this.getUserById(tenantId, student.user_id || '')) || {
      id: randomUUID(),
      tenant_id: tenantId,
      email: student.email || `${student.admission_number}@kampus.pk`,
      full_name: student.full_name,
      role: 'student' as const,
      status: 'active' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return { student, user, default_password: '' };
  }

  async getStudentEnrollments(tenantId: string, studentId: string): Promise<StudentEnrollment[]> {
    const res = await this.db.query(
      `SELECT * FROM public.student_enrollments WHERE tenant_id = $1 AND student_id = $2`,
      [tenantId, studentId]
    );
    return res.rows;
  }

  async getEnrollmentById(tenantId: string, enrollmentId: string): Promise<StudentEnrollment | null> {
    const res = await this.db.query(
      `SELECT * FROM public.student_enrollments WHERE tenant_id = $1 AND id = $2`,
      [tenantId, enrollmentId]
    );
    return res.rows[0] || null;
  }

  async createStudentEnrollment(tenantId: string, studentId: string, data: any): Promise<StudentEnrollment> {
    const res = await this.db.query(
      `INSERT INTO public.student_enrollments (tenant_id, student_id, batch_id, roll_number, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING *`,
      [tenantId, studentId, data.batch_id, data.roll_number || 'R-01']
    );
    return res.rows[0];
  }

  async updateStudentEnrollment(tenantId: string, _studentId: string, enrollmentId: string, data: any): Promise<StudentEnrollment | null> {
    const res = await this.db.query(
      `UPDATE public.student_enrollments SET batch_id = COALESCE($1, batch_id), updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [data.batch_id, enrollmentId, tenantId]
    );
    return res.rows[0] || null;
  }

  async updateStudentEnrollmentStatus(tenantId: string, _studentId: string, enrollmentId: string, status: StudentEnrollmentStatus): Promise<StudentEnrollment | null> {
    const res = await this.db.query(
      `UPDATE public.student_enrollments SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [status, enrollmentId, tenantId]
    );
    return res.rows[0] || null;
  }

  async makePrimaryEnrollment(tenantId: string, _studentId: string, enrollmentId: string): Promise<StudentEnrollment | null> {
    return this.getEnrollmentById(tenantId, enrollmentId);
  }

  // ---------------------------------------------------------------------------
  // Timetable & Collision Engine
  // ---------------------------------------------------------------------------

  async getRooms(tenantId: string): Promise<Room[]> {
    const res = await this.db.query(`SELECT * FROM public.rooms WHERE tenant_id = $1`, [tenantId]);
    return res.rows;
  }

  async createRoom(data: Omit<Room, 'id' | 'created_at' | 'updated_at'>): Promise<Room> {
    const res = await this.db.query(
      `INSERT INTO public.rooms (tenant_id, name, capacity, is_active)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.tenant_id, data.name || (data as any).room_number || 'Room 1', data.capacity || 50, true]
    );
    return res.rows[0];
  }

  async updateRoom(tenantId: string, roomId: string, data: any): Promise<Room | null> {
    const res = await this.db.query(
      `UPDATE public.rooms SET name = COALESCE($1, name), capacity = COALESCE($2, capacity), updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [data.name, data.capacity, roomId, tenantId]
    );
    return res.rows[0] || null;
  }

  async deleteRoom(tenantId: string, roomId: string): Promise<'DELETED' | 'IN_USE' | 'NOT_FOUND'> {
    const res = await this.db.query(`DELETE FROM public.rooms WHERE id = $1 AND tenant_id = $2`, [roomId, tenantId]);
    return (res.rowCount ?? 0) > 0 ? 'DELETED' : 'NOT_FOUND';
  }

  async getTimetable(tenantId: string, batchId?: string, day?: DayOfWeek): Promise<TimetableSlot[]> {
    let sql = `SELECT * FROM public.timetable_slots WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let idx = 2;
    if (batchId) { sql += ` AND batch_id = $${idx++}`; params.push(batchId); }
    if (day) { sql += ` AND day_of_week = $${idx++}`; params.push(day); }
    sql += ` ORDER BY start_time ASC`;
    const res = await this.db.query(sql, params);
    return res.rows;
  }

  async checkCollision(tenantId: string, slot: any): Promise<TimetableCollisionResult> {
    const res = await this.db.query(
      `SELECT * FROM public.timetable_slots 
       WHERE tenant_id = $1 AND day_of_week = $2 
         AND start_time < $3 AND end_time > $4
         AND (teacher_id = $5 OR room_id = $6 OR batch_id = $7)`,
      [tenantId, slot.dayOfWeek, slot.endTime, slot.startTime, slot.teacherId, slot.roomId || null, slot.batchId]
    );
    return {
      has_conflicts: res.rows.length > 0,
      conflicts: res.rows.map(r => ({
        type: r.teacher_id === slot.teacherId ? 'teacher' : (r.room_id === slot.roomId ? 'room' : 'batch'),
        slot_id: r.id,
        message: 'Collision detected',
      })),
    } as any;
  }

  async createTimetableSlot(data: Omit<TimetableSlot, 'id' | 'created_at' | 'updated_at'>): Promise<TimetableSlot> {
    const res = await this.db.query(
      `INSERT INTO public.timetable_slots (tenant_id, batch_id, subject_id, teacher_id, room_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [data.tenant_id, data.batch_id, data.subject_id, data.teacher_id, data.room_id || null, data.day_of_week, data.start_time, data.end_time]
    );
    return res.rows[0];
  }

  async updateTimetableSlot(tenantId: string, slotId: string, data: any): Promise<TimetableSlot | null> {
    const res = await this.db.query(
      `UPDATE public.timetable_slots 
       SET start_time = COALESCE($1, start_time), end_time = COALESCE($2, end_time), updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [data.start_time, data.end_time, slotId, tenantId]
    );
    return res.rows[0] || null;
  }

  async assignSubstitute(tenantId: string, slotId: string, substituteTeacherId: string): Promise<TimetableSlot> {
    const res = await this.db.query(
      `UPDATE public.timetable_slots SET substitute_teacher_id = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [substituteTeacherId, slotId, tenantId]
    );
    return res.rows[0];
  }

  async deleteTimetableSlot(tenantId: string, slotId: string): Promise<boolean> {
    const res = await this.db.query(`DELETE FROM public.timetable_slots WHERE id = $1 AND tenant_id = $2`, [slotId, tenantId]);
    return (res.rowCount ?? 0) > 0;
  }

  async getAvailableTeachers(tenantId: string, dayOfWeek: DayOfWeek, startTime: string, endTime: string): Promise<User[]> {
    const res = await this.db.query(
      `SELECT * FROM public.tenant_memberships 
       WHERE tenant_id = $1 AND role = 'teacher' AND status = 'active'
         AND id NOT IN (
           SELECT teacher_id FROM public.timetable_slots 
           WHERE tenant_id = $1 AND day_of_week = $2 AND start_time < $3 AND end_time > $4
         )`,
      [tenantId, dayOfWeek, endTime, startTime]
    );
    return res.rows.map(m => ({
      id: m.id,
      tenant_id: m.tenant_id,
      email: m.email,
      full_name: m.full_name,
      role: m.role,
      status: m.status,
      created_at: m.created_at,
      updated_at: m.updated_at,
    }));
  }

  // ---------------------------------------------------------------------------
  // Student & Staff Attendance, Geofencing, Leaves
  // ---------------------------------------------------------------------------

  async getStudentAttendance(tenantId: string, batchId?: string, date?: string): Promise<StudentAttendanceRecord[]> {
    let sql = `SELECT * FROM public.student_attendance WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let idx = 2;
    if (batchId) { sql += ` AND batch_id = $${idx++}`; params.push(batchId); }
    if (date) { sql += ` AND date = $${idx++}`; params.push(date); }
    const res = await this.db.query(sql, params);
    return res.rows;
  }

  async getStudentAttendanceHistory(tenantId: string, studentId: string): Promise<StudentAttendanceRecord[]> {
    const res = await this.db.query(
      `SELECT * FROM public.student_attendance WHERE tenant_id = $1 AND student_id = $2 ORDER BY date DESC`,
      [tenantId, studentId]
    );
    return res.rows;
  }

  async getAttendanceAuditLogs(tenantId: string, studentId?: string): Promise<AttendanceAuditLog[]> {
    let sql = `SELECT * FROM public.audit_logs WHERE tenant_id = $1 AND action = 'ATTENDANCE_CORRECTION'`;
    const params: any[] = [tenantId];
    if (studentId) {
      sql += ` AND resource_id = $2`;
      params.push(studentId);
    }
    sql += ` ORDER BY created_at DESC`;
    const res = await this.db.query(sql, params);
    return res.rows;
  }

  async recordBatchAttendance(
    tenantId: string,
    batchId: string,
    date: string,
    records: Array<{ student_id: string; status: AttendanceStatus; remarks?: string }>,
    markedBy?: string
  ): Promise<StudentAttendanceRecord[]> {
    const results: StudentAttendanceRecord[] = [];
    for (const rec of records) {
      const ins = await this.db.query(
        `INSERT INTO public.student_attendance (tenant_id, student_id, batch_id, date, status, remarks, marked_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tenant_id, student_id, batch_id, date, COALESCE(subject_id, 'ALL'))
         DO UPDATE SET status = EXCLUDED.status, remarks = EXCLUDED.remarks, updated_at = NOW()
         RETURNING *`,
        [tenantId, rec.student_id, batchId, date, rec.status, rec.remarks || null, markedBy || null]
      );
      results.push(ins.rows[0]);
    }
    return results;
  }

  async getLeaveApplications(tenantId: string, studentId?: string): Promise<LeaveApplication[]> {
    if (studentId) {
      const res = await this.db.query(`SELECT * FROM public.leave_applications WHERE tenant_id = $1 AND student_id = $2`, [tenantId, studentId]);
      return res.rows;
    }
    const res = await this.db.query(`SELECT * FROM public.leave_applications WHERE tenant_id = $1`, [tenantId]);
    return res.rows;
  }

  async submitLeaveApplication(data: Omit<LeaveApplication, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<LeaveApplication> {
    const res = await this.db.query(
      `INSERT INTO public.leave_applications (tenant_id, student_id, start_date, end_date, category, reason)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.tenant_id, data.student_id, data.start_date, data.end_date, data.category || 'medical', data.reason]
    );
    return res.rows[0];
  }

  async reviewLeaveApplication(tenantId: string, leaveId: string, status: LeaveStatus, reviewNotes?: string, reviewerId?: string): Promise<LeaveApplication> {
    const res = await this.db.query(
      `UPDATE public.leave_applications SET status = $1, review_notes = $2, reviewed_by = $3, updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5 RETURNING *`,
      [status, reviewNotes || null, reviewerId || null, leaveId, tenantId]
    );
    return res.rows[0];
  }

  async getStaffLeaves(_tenantId: string, _staffId?: string): Promise<StaffLeaveRecord[]> {
    return [];
  }
  async submitStaffLeave(data: any): Promise<StaffLeaveRecord> {
    return { id: randomUUID(), ...data, status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  }
  async reviewStaffLeave(_tenantId: string, _leaveId: string, _status: any): Promise<StaffLeaveRecord> {
    return {} as any;
  }

  async getGeofenceConfig(tenantId: string): Promise<CampusGeofenceConfig> {
    const res = await this.db.query(`SELECT * FROM public.campus_geofence_configs WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
    if (res.rows.length > 0) return res.rows[0];
    return {
      tenant_id: tenantId,
      campus_name: 'Main Campus',
      latitude: 31.5204,
      longitude: 74.3587,
      radius_meters: 100,
      shift_start_time: '08:00:00',
      grace_period_minutes: 15,
      multi_room_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async updateGeofenceConfig(tenantId: string, config: Partial<CampusGeofenceConfig>): Promise<CampusGeofenceConfig> {
    const res = await this.db.query(
      `INSERT INTO public.campus_geofence_configs (tenant_id, campus_name, latitude, longitude, radius_meters)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id) DO UPDATE SET
         campus_name = EXCLUDED.campus_name,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         radius_meters = EXCLUDED.radius_meters
       RETURNING *`,
      [tenantId, config.campus_name || 'Main Campus', config.latitude || 31.5204, config.longitude || 74.3587, config.radius_meters || 100]
    );
    return res.rows[0];
  }

  async staffClockIn(tenantId: string, staffId: string, _staffName: string, lat: number, lng: number): Promise<StaffAttendanceRecord> {
    const today = campusToday();
    const res = await this.db.query(
      `INSERT INTO public.staff_attendance (tenant_id, staff_id, date, status, check_in_time, latitude, longitude)
       VALUES ($1, $2, $3, 'present', NOW()::time, $4, $5)
       RETURNING *`,
      [tenantId, staffId, today, lat, lng]
    );
    return res.rows[0];
  }

  async staffClockOut(tenantId: string, staffId: string, _lat: number, _lng: number): Promise<StaffAttendanceRecord> {
    const today = campusToday();
    const res = await this.db.query(
      `UPDATE public.staff_attendance SET check_out_time = NOW()::time, updated_at = NOW()
       WHERE tenant_id = $1 AND staff_id = $2 AND date = $3
       RETURNING *`,
      [tenantId, staffId, today]
    );
    return res.rows[0];
  }

  async getStaffAttendance(tenantId: string, date?: string): Promise<StaffAttendanceRecord[]> {
    const d = date || campusToday();
    const res = await this.db.query(`SELECT * FROM public.staff_attendance WHERE tenant_id = $1 AND date = $2`, [tenantId, d]);
    return res.rows;
  }

  async getMyStaffAttendance(tenantId: string, staffId: string, date?: string): Promise<StaffAttendanceRecord | null> {
    const d = date || campusToday();
    const res = await this.db.query(`SELECT * FROM public.staff_attendance WHERE tenant_id = $1 AND staff_id = $2 AND date = $3 LIMIT 1`, [tenantId, staffId, d]);
    return res.rows[0] || null;
  }

  async getStaffRoster(tenantId: string, date?: string): Promise<DailyStaffRosterEntry[]> {
    const d = date || campusToday();
    const members = await this.db.query(`SELECT * FROM public.tenant_memberships WHERE tenant_id = $1 AND role = 'teacher'`, [tenantId]);
    const att = await this.getStaffAttendance(tenantId, d);
    const attMap = new Map(att.map(a => [a.staff_id, a]));

    return members.rows.map(m => {
      const a = attMap.get(m.id);
      return {
        staff_id: m.id,
        staff_name: m.full_name,
        full_name: m.full_name,
        employee_code: 'EMP-01',
        designation: 'Teacher',
        department: 'Teaching',
        date: d,
        status: (a?.status as any) || 'unmarked',
        clock_in_time: a?.clock_in_time,
        clock_out_time: a?.clock_out_time,
        is_geofence_verified: false,
      } as any;
    });
  }

  async getStaffMonthlySummary(_tenantId: string, _monthStr: string): Promise<StaffMonthlyAttendanceSummary[]> {
    return [];
  }

  async manualStaffAttendance(tenantId: string, data: any): Promise<StaffAttendanceRecord> {
    const res = await this.db.query(
      `INSERT INTO public.staff_attendance (tenant_id, staff_id, date, status, remarks)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, data.staff_id, data.date, data.status, data.reason || null]
    );
    return res.rows[0];
  }

  async adjustStaffAttendance(tenantId: string, id: string, status: StaffAttendanceStatus, notes: string): Promise<StaffAttendanceRecord> {
    const res = await this.db.query(
      `UPDATE public.staff_attendance SET status = $1, remarks = $2, updated_at = NOW() WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [status, notes, id, tenantId]
    );
    return res.rows[0];
  }

  async getStaffAttendanceAuditLogs(_tenantId: string): Promise<StaffAttendanceAuditLog[]> {
    return [];
  }
  async getStaffRegularizationRequests(_tenantId: string): Promise<StaffRegularizationRequest[]> {
    return [];
  }
  async submitStaffRegularizationRequest(_tenantId: string, data: any): Promise<StaffRegularizationRequest> {
    return { id: randomUUID(), ...data, status: 'pending', created_at: new Date().toISOString() };
  }
  async reviewStaffRegularizationRequest(_tenantId: string, requestId: string, action: any): Promise<StaffRegularizationRequest> {
    return { id: requestId, status: action } as any;
  }

  // ---------------------------------------------------------------------------
  // Homework, Notebook Checks & Complaints
  // ---------------------------------------------------------------------------

  async getHomework(tenantId: string, batchId?: string): Promise<HomeworkAssignment[]> {
    if (batchId) {
      const res = await this.db.query(`SELECT * FROM public.homework_assignments WHERE tenant_id = $1 AND batch_id = $2`, [tenantId, batchId]);
      return res.rows;
    }
    const res = await this.db.query(`SELECT * FROM public.homework_assignments WHERE tenant_id = $1`, [tenantId]);
    return res.rows;
  }

  async createHomework(data: Omit<HomeworkAssignment, 'id' | 'created_at'>): Promise<HomeworkAssignment> {
    const res = await this.db.query(
      `INSERT INTO public.homework_assignments (tenant_id, batch_id, subject_id, title, description, assigned_date, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.tenant_id, data.batch_id, data.subject_id, data.title, data.description || null, data.assigned_date, data.due_date]
    );
    return res.rows[0];
  }

  async updateHomework(tenantId: string, id: string, data: any): Promise<HomeworkAssignment | null> {
    const res = await this.db.query(
      `UPDATE public.homework_assignments SET title = COALESCE($1, title), description = COALESCE($2, description), updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [data.title, data.description, id, tenantId]
    );
    return res.rows[0] || null;
  }

  async deleteHomework(tenantId: string, id: string): Promise<boolean> {
    const res = await this.db.query(`DELETE FROM public.homework_assignments WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return (res.rowCount ?? 0) > 0;
  }

  async getHomeworkRoster(tenantId: string, assignmentId: string): Promise<any[]> {
    const hw = await this.db.query(`SELECT batch_id FROM public.homework_assignments WHERE id = $1 AND tenant_id = $2`, [assignmentId, tenantId]);
    if (hw.rows.length === 0) return [];
    const students = await this.db.query(`SELECT id, full_name, admission_number, roll_number FROM public.students WHERE tenant_id = $1 AND batch_id = $2`, [tenantId, hw.rows[0].batch_id]);
    return students.rows;
  }

  async recordNotebookChecks(tenantId: string, assignmentId: string, checks: any[]): Promise<NotebookCheckRecord[]> {
    const results: NotebookCheckRecord[] = [];
    for (const c of checks) {
      const ins = await this.db.query(
        `INSERT INTO public.notebook_checks (tenant_id, homework_id, student_id, status, remarks)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [tenantId, assignmentId, c.student_id, c.status, c.remarks || null]
      );
      results.push(ins.rows[0]);
    }
    return results;
  }

  async getNotebookChecks(tenantId: string, assignmentId: string): Promise<NotebookCheckRecord[]> {
    const res = await this.db.query(`SELECT * FROM public.notebook_checks WHERE tenant_id = $1 AND homework_id = $2`, [tenantId, assignmentId]);
    return res.rows;
  }

  async getComplaints(tenantId: string): Promise<ComplaintTicket[]> {
    const res = await this.db.query(`SELECT * FROM public.complaints WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
    return res.rows;
  }

  async createComplaint(data: Omit<ComplaintTicket, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<ComplaintTicket> {
    const res = await this.db.query(
      `INSERT INTO public.complaints (tenant_id, student_id, category, description, status)
       VALUES ($1, $2, $3, $4, 'open') RETURNING *`,
      [data.tenant_id, data.student_id, data.category, data.description]
    );
    return res.rows[0];
  }

  async updateComplaintStatus(tenantId: string, id: string, status?: ComplaintStatus, resolutionReply?: string | null): Promise<ComplaintTicket> {
    const res = await this.db.query(
      `UPDATE public.complaints SET status = COALESCE($1, status), resolution = COALESCE($2, resolution), updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [status, resolutionReply, id, tenantId]
    );
    return res.rows[0];
  }

  // ---------------------------------------------------------------------------
  // Finance & Fee Invoicing
  // ---------------------------------------------------------------------------

  async getFeeHeads(tenantId: string): Promise<FeeHead[]> {
    const res = await this.db.query(`SELECT * FROM public.fee_heads WHERE tenant_id = $1 ORDER BY priority_order ASC`, [tenantId]);
    return res.rows;
  }

  async createFeeHead(data: Omit<FeeHead, 'id' | 'created_at'>): Promise<FeeHead> {
    const res = await this.db.query(
      `INSERT INTO public.fee_heads (tenant_id, name, code, default_amount, priority_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.tenant_id, data.name, data.code, data.default_amount || 0, data.priority_order || 1]
    );
    return res.rows[0];
  }

  async updateFeeHead(tenantId: string, id: string, data: any): Promise<FeeHead | null> {
    const res = await this.db.query(
      `UPDATE public.fee_heads SET name = COALESCE($1, name), default_amount = COALESCE($2, default_amount), updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [data.name, data.default_amount, id, tenantId]
    );
    return res.rows[0] || null;
  }

  async deleteFeeHead(tenantId: string, id: string): Promise<boolean> {
    const res = await this.db.query(`DELETE FROM public.fee_heads WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return (res.rowCount ?? 0) > 0;
  }

  async getTenantUsers(tenantId: string): Promise<User[]> {
    const res = await this.db.query(`SELECT * FROM public.tenant_memberships WHERE tenant_id = $1`, [tenantId]);
    return res.rows.map(m => ({
      id: m.id,
      tenant_id: m.tenant_id,
      email: m.email,
      full_name: m.full_name,
      role: m.role,
      status: m.status,
      phone: m.phone || null,
      metadata: m.metadata || {},
      created_at: m.created_at,
      updated_at: m.updated_at,
    }));
  }

  async updateUserMetadata(tenantId: string, userId: string, metadata: any): Promise<User | null> {
    const existing = await this.getUserById(tenantId, userId);
    if (!existing) return null;
    const merged = { ...(existing.metadata || {}), ...metadata };
    const res = await this.db.query(
      `UPDATE public.tenant_memberships
       SET metadata = $3::jsonb, updated_at = NOW()
       WHERE tenant_id = $1 AND (id::text = $2 OR auth_user_id::text = $2)
       RETURNING *`,
      [tenantId, userId, JSON.stringify(merged)]
    );
    if (res.rows.length === 0) return null;
    const m = res.rows[0];
    return {
      id: m.id,
      tenant_id: m.tenant_id,
      email: m.email,
      full_name: m.full_name,
      role: m.role,
      status: m.status,
      phone: m.phone || null,
      metadata: m.metadata || {},
      created_at: m.created_at,
      updated_at: m.updated_at,
    };
  }

  async createStaff(data: CreateStaffInput): Promise<User> {
    const userRole = data.role || 'teacher';
    const metadata: Record<string, any> = {
      employee_code: data.employee_code || null,
      father_or_spouse_name: data.father_or_spouse_name || '',
      cnic: data.cnic || '',
      blood_group: data.blood_group || '',
      gender: data.gender || 'male',
      dob: data.dob || '',
      whatsapp: data.whatsapp || data.phone || '',
      emergency_contact: data.emergency_contact || '',
      emergency_relation: data.emergency_relation || '',
      address: data.address || '',
      department: data.department || (userRole === 'finance_manager' ? 'Accounts' : 'General'),
      designation: data.designation?.trim() || (userRole === 'finance_manager' ? 'Accountant' : (userRole === 'academic_head' ? 'Administrator' : 'Faculty Member')),
      employment_type: data.employment_type || 'permanent',
      joining_date: data.joining_date || new Date().toISOString().split('T')[0],
      probation_end_date: data.probation_end_date || null,
      qualification: data.qualification || '',
      experience_years: typeof data.experience_years === 'number' ? data.experience_years : 0,
      base_salary: typeof data.base_salary === 'number' ? data.base_salary : 0,
      bank_name: data.bank_name || '',
      bank_account_title: data.bank_account_title || '',
      bank_account_number: data.bank_account_number || '',
      bank_iban: data.bank_iban || '',
      teaching_assignments: Array.isArray(data.teaching_assignments) ? data.teaching_assignments : [],
      access: data.access || {},
      permissions: data.permissions || [],
      managed_staff: true,
    };

    const res = await this.db.query(
      `INSERT INTO public.tenant_memberships (tenant_id, auth_user_id, email, full_name, phone, role, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) RETURNING *`,
      [
        data.tenant_id,
        randomUUID(),
        data.email.toLowerCase().trim(),
        data.full_name.trim(),
        data.phone || null,
        userRole,
        data.status || 'active',
        JSON.stringify(metadata),
      ]
    );
    const m = res.rows[0];
    return {
      id: m.id,
      tenant_id: m.tenant_id,
      email: m.email,
      full_name: m.full_name,
      role: m.role,
      status: m.status,
      phone: m.phone || null,
      metadata: m.metadata || {},
      created_at: m.created_at,
      updated_at: m.updated_at,
    };
  }

  async updateStaff(tenantId: string, userId: string, patch: UpdateStaffInput): Promise<User | null> {
    const existing = await this.getUserById(tenantId, userId);
    if (!existing) return null;

    const existingMeta = (existing.metadata || {}) as Record<string, any>;
    const metadataPatch: Record<string, any> = { ...existingMeta };
    if (patch.employee_code !== undefined) metadataPatch.employee_code = patch.employee_code;
    if (patch.father_or_spouse_name !== undefined) metadataPatch.father_or_spouse_name = patch.father_or_spouse_name;
    if (patch.cnic !== undefined) metadataPatch.cnic = patch.cnic;
    if (patch.blood_group !== undefined) metadataPatch.blood_group = patch.blood_group;
    if (patch.gender !== undefined) metadataPatch.gender = patch.gender;
    if (patch.dob !== undefined) metadataPatch.dob = patch.dob;
    if (patch.whatsapp !== undefined) metadataPatch.whatsapp = patch.whatsapp;
    if (patch.emergency_contact !== undefined) metadataPatch.emergency_contact = patch.emergency_contact;
    if (patch.emergency_relation !== undefined) metadataPatch.emergency_relation = patch.emergency_relation;
    if (patch.address !== undefined) metadataPatch.address = patch.address;
    if (patch.department !== undefined) metadataPatch.department = patch.department;
    if (patch.designation !== undefined) metadataPatch.designation = patch.designation;
    if (patch.employment_type !== undefined) metadataPatch.employment_type = patch.employment_type;
    if (patch.joining_date !== undefined) metadataPatch.joining_date = patch.joining_date;
    if (patch.probation_end_date !== undefined) metadataPatch.probation_end_date = patch.probation_end_date;
    if (patch.qualification !== undefined) metadataPatch.qualification = patch.qualification;
    if (patch.experience_years !== undefined) metadataPatch.experience_years = patch.experience_years;
    if (patch.base_salary !== undefined) metadataPatch.base_salary = patch.base_salary;
    if (patch.bank_name !== undefined) metadataPatch.bank_name = patch.bank_name;
    if (patch.bank_account_title !== undefined) metadataPatch.bank_account_title = patch.bank_account_title;
    if (patch.bank_account_number !== undefined) metadataPatch.bank_account_number = patch.bank_account_number;
    if (patch.bank_iban !== undefined) metadataPatch.bank_iban = patch.bank_iban;
    if (patch.teaching_assignments !== undefined) metadataPatch.teaching_assignments = patch.teaching_assignments;
    if (patch.access !== undefined) metadataPatch.access = patch.access;
    if (patch.permissions !== undefined) metadataPatch.permissions = patch.permissions;

    const res = await this.db.query(
      `UPDATE public.tenant_memberships
       SET full_name = COALESCE($3, full_name),
           phone = COALESCE($4, phone),
           role = COALESCE($5, role),
           status = COALESCE($6, status),
           metadata = $7::jsonb,
           updated_at = NOW()
       WHERE tenant_id = $1 AND (id::text = $2 OR auth_user_id::text = $2)
       RETURNING *`,
      [
        tenantId,
        userId,
        patch.full_name?.trim() || null,
        patch.phone || null,
        patch.role || null,
        patch.status || null,
        JSON.stringify(metadataPatch),
      ]
    );
    if (res.rows.length === 0) return null;
    const m = res.rows[0];
    return {
      id: m.id,
      tenant_id: m.tenant_id,
      email: m.email,
      full_name: m.full_name,
      role: m.role,
      status: m.status,
      phone: m.phone || null,
      metadata: m.metadata || {},
      created_at: m.created_at,
      updated_at: m.updated_at,
    };
  }

  async archiveStaff(tenantId: string, userId: string, reason?: string): Promise<User | null> {
    const existing = await this.getUserById(tenantId, userId);
    if (!existing) return null;
    const meta = {
      ...(existing.metadata || {}),
      archived_at: new Date().toISOString(),
      archive_reason: reason || 'Archived',
    };
    const res = await this.db.query(
      `UPDATE public.tenant_memberships
       SET status = 'archived', metadata = $3::jsonb, updated_at = NOW()
       WHERE tenant_id = $1 AND (id::text = $2 OR auth_user_id::text = $2)
       RETURNING *`,
      [tenantId, userId, JSON.stringify(meta)]
    );
    if (res.rows.length === 0) return null;
    const m = res.rows[0];
    return {
      id: m.id,
      tenant_id: m.tenant_id,
      email: m.email,
      full_name: m.full_name,
      role: m.role,
      status: m.status,
      phone: m.phone || null,
      metadata: m.metadata || {},
      created_at: m.created_at,
      updated_at: m.updated_at,
    };
  }

  async restoreStaff(tenantId: string, userId: string): Promise<User | null> {
    const existing = await this.getUserById(tenantId, userId);
    if (!existing) return null;
    const meta = { ...(existing.metadata || {}) };
    delete meta.archived_at;
    delete meta.archive_reason;
    const res = await this.db.query(
      `UPDATE public.tenant_memberships
       SET status = 'active', metadata = $3::jsonb, updated_at = NOW()
       WHERE tenant_id = $1 AND (id::text = $2 OR auth_user_id::text = $2)
       RETURNING *`,
      [tenantId, userId, JSON.stringify(meta)]
    );
    if (res.rows.length === 0) return null;
    const m = res.rows[0];
    return {
      id: m.id,
      tenant_id: m.tenant_id,
      email: m.email,
      full_name: m.full_name,
      role: m.role,
      status: m.status,
      phone: m.phone || null,
      metadata: m.metadata || {},
      created_at: m.created_at,
      updated_at: m.updated_at,
    };
  }

  async deleteStaff(tenantId: string, userId: string): Promise<boolean> {
    const res = await this.db.query(`DELETE FROM public.tenant_memberships WHERE id = $1 AND tenant_id = $2`, [userId, tenantId]);
    return (res.rowCount ?? 0) > 0;
  }

  async resetStaffPassword(tenantId: string, userId: string, _newPassword: string): Promise<User | null> {
    return this.getUserById(tenantId, userId);
  }

  async assignStaffTeaching(tenantId: string, userId: string, assignments: StaffTeachingAssignment[]): Promise<User | null> {
    const existing = await this.getUserById(tenantId, userId);
    if (!existing) return null;
    const meta = {
      ...(existing.metadata || {}),
      teaching_assignments: assignments,
    };
    const res = await this.db.query(
      `UPDATE public.tenant_memberships
       SET metadata = $3::jsonb, updated_at = NOW()
       WHERE tenant_id = $1 AND (id::text = $2 OR auth_user_id::text = $2)
       RETURNING *`,
      [tenantId, userId, JSON.stringify(meta)]
    );
    if (res.rows.length === 0) return null;
    const m = res.rows[0];
    return {
      id: m.id,
      tenant_id: m.tenant_id,
      email: m.email,
      full_name: m.full_name,
      role: m.role,
      status: m.status,
      phone: m.phone || null,
      metadata: m.metadata || {},
      created_at: m.created_at,
      updated_at: m.updated_at,
    };
  }

  async getFeePriorityConfig(tenantId: string): Promise<FeePriorityConfig> {
    const res = await this.db.query(`SELECT * FROM public.fee_priority_configs WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
    if (res.rows.length > 0) return res.rows[0];
    return { id: randomUUID(), tenant_id: tenantId, priority_order: [], updated_at: new Date().toISOString() };
  }

  async updateFeePriorityConfig(tenantId: string, priorityOrder: string[]): Promise<FeePriorityConfig> {
    const res = await this.db.query(
      `INSERT INTO public.fee_priority_configs (tenant_id, priority_order)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO UPDATE SET priority_order = EXCLUDED.priority_order, updated_at = NOW()
       RETURNING *`,
      [tenantId, JSON.stringify(priorityOrder)]
    );
    return res.rows[0];
  }

  async getFeeStructures(tenantId: string, _batchId?: string, studentId?: string): Promise<StudentFeeStructure[]> {
    if (studentId) {
      const res = await this.db.query(`SELECT * FROM public.fee_structures WHERE tenant_id = $1 AND student_id = $2`, [tenantId, studentId]);
      return res.rows;
    }
    const res = await this.db.query(`SELECT * FROM public.fee_structures WHERE tenant_id = $1`, [tenantId]);
    return res.rows;
  }

  async saveFeeStructure(data: any): Promise<StudentFeeStructure> {
    const res = await this.db.query(
      `INSERT INTO public.fee_structures (tenant_id, student_id, batch_id, academic_session, items)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.tenant_id, data.student_id, data.batch_id, data.academic_session || '2026-2027', JSON.stringify(data.items || [])]
    );
    return res.rows[0];
  }

  async getInvoices(tenantId: string, options?: any): Promise<StudentInvoice[]> {
    let sql = `SELECT * FROM public.student_invoices WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let idx = 2;

    if (options?.studentId || options?.student_id) {
      sql += ` AND student_id = $${idx++}`;
      params.push(options.studentId || options.student_id);
    }
    if (options?.status) {
      sql += ` AND status = $${idx++}`;
      params.push(options.status);
    }
    sql += ` ORDER BY created_at DESC`;
    const res = await this.db.query(sql, params);
    return res.rows;
  }

  async getInvoiceById(tenantId: string, id: string): Promise<StudentInvoice | null> {
    const res = await this.db.query(`SELECT * FROM public.student_invoices WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [id, tenantId]);
    return res.rows[0] || null;
  }

  async generateInvoice(tenantId: string, data: any): Promise<StudentInvoice> {
    const student = await this.getStudentById(tenantId, data.student_id);
    if (!student) throw new Error('Student not found');

    const subtotal = data.custom_items?.reduce((sum: number, it: any) => sum + it.amount, 0) || 5000;
    const invNum = `INV-${Date.now().toString().slice(-6)}`;

    const res = await this.db.query(
      `INSERT INTO public.student_invoices (
         tenant_id, invoice_number, student_id, student_name, roll_number, batch_id, batch_name,
         billing_month, issue_date, due_date, subtotal_amount, net_amount, balance_amount, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $11, 'unpaid')
       RETURNING *`,
      [
        tenantId,
        invNum,
        student.id,
        student.full_name,
        student.roll_number,
        student.batch_id,
        'Batch',
        data.billing_month,
        data.issue_date || campusToday(),
        data.due_date,
        subtotal,
      ]
    );
    return res.rows[0];
  }

  async generateBatchInvoices(tenantId: string, batchIdOrParams: any, billingMonth?: string, dueDate?: string): Promise<StudentInvoice[]> {
    const batchId = typeof batchIdOrParams === 'string' ? batchIdOrParams : batchIdOrParams.batch_id;
    const bMonth = typeof batchIdOrParams === 'object' ? batchIdOrParams.billing_month : billingMonth;
    const dDate = typeof batchIdOrParams === 'object' ? batchIdOrParams.due_date : dueDate;

    const students = await this.getStudents(tenantId, batchId);
    const created: StudentInvoice[] = [];
    for (const s of students) {
      const inv = await this.generateInvoice(tenantId, {
        student_id: s.id,
        billing_month: bMonth || 'August 2026',
        due_date: dDate || campusToday(),
      });
      created.push(inv);
    }
    return created;
  }

  async cancelInvoice(tenantId: string, invoiceId: string, reason: string, cancelledBy: string): Promise<StudentInvoice> {
    const res = await this.db.query(
      `UPDATE public.student_invoices 
       SET status = 'cancelled', cancel_reason = $1, cancelled_by = $2, cancelled_at = NOW(), updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [reason, cancelledBy, invoiceId, tenantId]
    );
    return res.rows[0];
  }

  async deleteInvoice(tenantId: string, invoiceId: string): Promise<any> {
    const res = await this.db.query(`DELETE FROM public.student_invoices WHERE id = $1 AND tenant_id = $2`, [invoiceId, tenantId]);
    return { success: (res.rowCount ?? 0) > 0, deleted_invoice_id: invoiceId, deleted_payments_count: 0 };
  }

  async updateInvoice(tenantId: string, invoiceId: string, data: any): Promise<StudentInvoice> {
    const res = await this.db.query(
      `UPDATE public.student_invoices SET due_date = COALESCE($1, due_date), notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [data.due_date, data.notes, invoiceId, tenantId]
    );
    return res.rows[0];
  }

  async previewPaymentDistribution(_tenantId: string, _invoiceId: string, amount: number): Promise<PaymentDistributionItem[]> {
    return [{ fee_head_id: 'tuition', head_name: 'Tuition Fee', allocated_amount: amount }];
  }

  async getPayments(tenantId: string, options?: any): Promise<FeePayment[]> {
    let sql = `SELECT * FROM public.fee_payments WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    if (options?.invoice_id) {
      sql += ` AND invoice_id = $2`;
      params.push(options.invoice_id);
    }
    sql += ` ORDER BY payment_date DESC`;
    const res = await this.db.query(sql, params);
    return res.rows;
  }

  async recordPayment(tenantId: string, data: any): Promise<{ payment: FeePayment; invoice: StudentInvoice }> {
    const client = await this.getClient();
    try {
      const receiptNum = `REC-${Date.now().toString().slice(-6)}`;
      return await executeInvoicePaymentTransaction(client, {
        tenantId,
        authUserId: dbContextStorage.getStore()?.authUserId || randomUUID(),
        invoiceId: data.invoice_id,
        paymentAmount: Number(data.amount_paid),
        paymentMethod: data.payment_method || 'cash',
        receiptNumber: receiptNum,
        collectedBy: data.collected_by || 'Cashier',
      });
    } finally {
      client.release();
    }
  }

  async recordFamilyPayment(_tenantId: string, _data: any): Promise<any> {
    return { family_receipt_number: 'FAM-01', results: [], total_amount: 0 };
  }

  async voidPayment(tenantId: string, paymentId: string): Promise<any> {
    const pRes = await this.db.query(`UPDATE public.fee_payments SET status = 'voided' WHERE id = $1 AND tenant_id = $2 RETURNING *`, [paymentId, tenantId]);
    return { payment: pRes.rows[0], invoice: {} as any };
  }

  async deletePayment(tenantId: string, paymentId: string): Promise<any> {
    const res = await this.db.query(`DELETE FROM public.fee_payments WHERE id = $1 AND tenant_id = $2`, [paymentId, tenantId]);
    return { success: (res.rowCount ?? 0) > 0, deleted_payment_id: paymentId };
  }

  async getFeeAuditLogs(tenantId: string): Promise<any[]> {
    const res = await this.db.query(
      `SELECT * FROM public.audit_logs WHERE tenant_id = $1 AND resource = 'student_invoices' ORDER BY created_at DESC`,
      [tenantId]
    );
    return res.rows;
  }

  async getDiscounts(tenantId: string, studentId?: string): Promise<FeeDiscount[]> {
    if (studentId) {
      const res = await this.db.query(
        `SELECT * FROM public.fee_discounts WHERE tenant_id = $1 AND student_id = $2 ORDER BY applied_at DESC`,
        [tenantId, studentId]
      );
      return res.rows.map(r => ({
        ...r,
        discount_value: Number(r.discount_value),
        actual_discount_amount: Number(r.actual_discount_amount),
      }));
    }
    const res = await this.db.query(
      `SELECT * FROM public.fee_discounts WHERE tenant_id = $1 ORDER BY applied_at DESC`,
      [tenantId]
    );
    return res.rows.map(r => ({
      ...r,
      discount_value: Number(r.discount_value),
      actual_discount_amount: Number(r.actual_discount_amount),
    }));
  }

  async applyDiscount(tenantId: string, data: any): Promise<FeeDiscount> {
    const student = await this.getStudentById(tenantId, data.student_id);
    const amount = Number(data.actual_discount_amount ?? data.discount_value ?? 0);
    const res = await this.db.query(
      `INSERT INTO public.fee_discounts (tenant_id, student_id, student_name, roll_number, invoice_id, fee_head_id, discount_type, discount_value, actual_discount_amount, mandatory_reason, approved_by, applied_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING *`,
      [
        tenantId,
        data.student_id,
        student?.full_name || 'Student',
        student?.roll_number || 'N/A',
        data.invoice_id || null,
        data.fee_head_id || null,
        data.discount_type,
        data.discount_value,
        amount,
        data.mandatory_reason,
        data.approved_by || 'Admin',
      ]
    );
    const r = res.rows[0];
    return {
      ...r,
      discount_value: Number(r.discount_value),
      actual_discount_amount: Number(r.actual_discount_amount),
    };
  }

  async getDailyCashbook(tenantId: string, date?: string): Promise<DailyCashbookEntry[]> {
    const d = date || campusToday();
    const payments = await this.db.query(
      `SELECT * FROM public.fee_payments WHERE tenant_id = $1 AND payment_date = $2`,
      [tenantId, d]
    );
    return payments.rows.map(p => ({
      id: p.id,
      date: p.payment_date,
      receipt_number: p.receipt_number,
      student_name: p.student_name,
      payment_method: p.payment_method,
      amount: Number(p.amount_paid),
      collected_by: p.collected_by || 'Cashier',
      status: p.status || 'paid',
    }));
  }

  async getStudentLedger(tenantId: string, studentId: string): Promise<StudentLedgerEntry[]> {
    const invoices = await this.getInvoices(tenantId, { student_id: studentId });
    const payments = await this.getPayments(tenantId, { student_id: studentId });
    const entries: StudentLedgerEntry[] = [];

    for (const inv of invoices) {
      entries.push({
        id: inv.id,
        date: inv.issue_date,
        description: `Fee invoice for ${inv.billing_month}`,
        debit: Number(inv.net_amount),
        credit: 0,
        running_balance: 0,
        reference: inv.invoice_number,
      });
    }
    for (const p of payments) {
      entries.push({
        id: p.id,
        date: p.payment_date,
        description: `Payment via ${p.payment_method}`,
        debit: 0,
        credit: Number(p.amount_paid),
        running_balance: 0,
        reference: p.receipt_number,
      });
    }
    return entries;
  }

  async getFeeHeadCollectionReport(tenantId: string): Promise<any[]> {
    const heads = await this.getFeeHeads(tenantId);
    return heads.map(h => ({
      fee_head_id: h.id,
      head_name: h.name,
      total_billed: 0,
      total_collected: 0,
      outstanding_balance: 0,
    }));
  }

  async getAccountHeads(tenantId: string, type?: 'income' | 'expense'): Promise<AccountHead[]> {
    if (type) {
      const res = await this.db.query(`SELECT * FROM public.account_heads WHERE tenant_id = $1 AND type = $2`, [tenantId, type]);
      return res.rows;
    }
    const res = await this.db.query(`SELECT * FROM public.account_heads WHERE tenant_id = $1`, [tenantId]);
    return res.rows;
  }

  async createAccountHead(data: Omit<AccountHead, 'id' | 'created_at'>): Promise<AccountHead> {
    const res = await this.db.query(
      `INSERT INTO public.account_heads (tenant_id, name, code, type, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.tenant_id, data.name, data.code, data.type, data.description || null]
    );
    return res.rows[0];
  }

  async deleteAccountHead(tenantId: string, id: string): Promise<boolean> {
    const res = await this.db.query(`DELETE FROM public.account_heads WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return (res.rowCount ?? 0) > 0;
  }

  async getFinancialTransactions(tenantId: string): Promise<FinancialTransaction[]> {
    const res = await this.db.query(`SELECT * FROM public.financial_transactions WHERE tenant_id = $1 ORDER BY date DESC`, [tenantId]);
    return res.rows;
  }

  async createFinancialTransaction(data: any): Promise<FinancialTransaction> {
    const num = `TRX-${Date.now().toString().slice(-6)}`;
    const res = await this.db.query(
      `INSERT INTO public.financial_transactions (tenant_id, transaction_number, account_head_id, date, amount, type, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.tenant_id, num, data.account_head_id, data.date || campusToday(), data.amount, data.type, data.description || null]
    );
    return res.rows[0];
  }

  async getProfitLossReport(_tenantId: string): Promise<any> {
    return {
      totalFeeIncome: 0,
      otherIncome: 0,
      totalIncome: 0,
      totalExpenses: 0,
      netProfit: 0,
      incomeByHead: {},
      expenseByHead: {},
    };
  }

  // ---------------------------------------------------------------------------
  // Staff Payroll & Salary
  // ---------------------------------------------------------------------------

  async getStaffSalaryProfiles(tenantId: string): Promise<StaffSalaryProfile[]> {
    const res = await this.db.query(`SELECT * FROM public.staff_salary_profiles WHERE tenant_id = $1`, [tenantId]);
    return res.rows;
  }

  async saveStaffSalaryProfile(data: any): Promise<StaffSalaryProfile> {
    const res = await this.db.query(
      `INSERT INTO public.staff_salary_profiles (tenant_id, staff_id, base_salary)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.tenant_id, data.staff_id, data.base_salary]
    );
    return res.rows[0];
  }

  async getPayslips(tenantId: string): Promise<StaffPayslip[]> {
    const res = await this.db.query(`SELECT * FROM public.staff_payslips WHERE tenant_id = $1`, [tenantId]);
    return res.rows;
  }

  async calculateStaffAttendanceDeduction(): Promise<any> {
    return { unpaidEquivalent: 0, unitRate: 0, totalDeduction: 0, workingDays: 26, casualToDeduct: 0 };
  }

  async generatePayslip(tenantId: string, data: any): Promise<StaffPayslip> {
    const res = await this.db.query(
      `INSERT INTO public.staff_payslips (tenant_id, staff_id, month, basic_salary, gross_salary, total_deductions, net_salary, status)
       VALUES ($1, $2, $3, $4, $4, 0, $4, 'draft') RETURNING *`,
      [tenantId, data.staff_id, data.payroll_month, 50000]
    );
    return res.rows[0];
  }

  async markPayslipPaid(tenantId: string, payslipId: string): Promise<StaffPayslip> {
    const res = await this.db.query(
      `UPDATE public.staff_payslips SET status = 'paid', payment_date = CURRENT_DATE WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [payslipId, tenantId]
    );
    return res.rows[0];
  }

  // ---------------------------------------------------------------------------
  // Examination & Question Bank
  // ---------------------------------------------------------------------------

  async getQuestionChapters(tenantId: string, subjectId?: string): Promise<QuestionChapter[]> {
    if (subjectId) {
      const res = await this.db.query(`SELECT * FROM public.question_chapters WHERE tenant_id = $1 AND subject_id = $2`, [tenantId, subjectId]);
      return res.rows;
    }
    const res = await this.db.query(`SELECT * FROM public.question_chapters WHERE tenant_id = $1`, [tenantId]);
    return res.rows;
  }

  async createQuestionChapter(tenantId: string, data: any): Promise<QuestionChapter> {
    const res = await this.db.query(
      `INSERT INTO public.question_chapters (tenant_id, subject_id, name, chapter_number)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tenantId, data.subject_id, data.name, data.chapter_number || 1]
    );
    return res.rows[0];
  }

  async getBankQuestions(tenantId: string): Promise<BankQuestion[]> {
    const res = await this.db.query(`SELECT * FROM public.bank_questions WHERE tenant_id = $1`, [tenantId]);
    return res.rows;
  }

  async createBankQuestion(tenantId: string, data: any): Promise<BankQuestion> {
    const res = await this.db.query(
      `INSERT INTO public.bank_questions (tenant_id, chapter_id, question_text, question_type, difficulty, marks)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenantId, data.chapter_id, data.question_text, data.question_type || 'mcq', data.difficulty || 'medium', data.marks || 1]
    );
    return res.rows[0];
  }

  async importQuestionsFromExcel(_tenantId: string): Promise<any> {
    return { imported_count: 0, chapters_created: 0, questions: [] };
  }

  async deleteBankQuestion(tenantId: string, questionId: string): Promise<boolean> {
    const res = await this.db.query(`DELETE FROM public.bank_questions WHERE id = $1 AND tenant_id = $2`, [questionId, tenantId]);
    return (res.rowCount ?? 0) > 0;
  }

  async getExams(tenantId: string, batchId?: string): Promise<Exam[]> {
    if (batchId) {
      const res = await this.db.query(`SELECT * FROM public.exams WHERE tenant_id = $1 AND batch_id = $2`, [tenantId, batchId]);
      return res.rows;
    }
    const res = await this.db.query(`SELECT * FROM public.exams WHERE tenant_id = $1`, [tenantId]);
    return res.rows;
  }

  async getExamById(tenantId: string, examId: string): Promise<Exam | null> {
    const res = await this.db.query(`SELECT * FROM public.exams WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [examId, tenantId]);
    return res.rows[0] || null;
  }

  async createExam(tenantId: string, data: any): Promise<Exam> {
    const res = await this.db.query(
      `INSERT INTO public.exams (tenant_id, batch_id, name, exam_type, total_marks, passing_marks, exam_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenantId, data.batch_id, data.name, data.exam_type || 'midterm', data.total_marks || 100, data.passing_marks || 40, data.exam_date || campusToday()]
    );
    return res.rows[0];
  }

  async updateExam(tenantId: string, examId: string, updates: any): Promise<Exam> {
    const res = await this.db.query(
      `UPDATE public.exams SET name = COALESCE($1, name), updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [updates.name, examId, tenantId]
    );
    return res.rows[0];
  }

  async addExamQuestions(_tenantId: string, _examId: string, questions: any[]): Promise<ExamQuestion[]> {
    return questions as any;
  }
  async getExamQuestions(_tenantId: string, _examId: string): Promise<ExamQuestion[]> {
    return [];
  }

  async evaluateStudentExam(tenantId: string, data: any): Promise<StudentExamEvaluation> {
    const res = await this.db.query(
      `INSERT INTO public.student_exam_evaluations (tenant_id, exam_id, student_id, marks_obtained, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, data.exam_id, data.student_id, data.short_score || 0, data.status || 'graded']
    );
    return res.rows[0];
  }

  async getExamEvaluations(tenantId: string, examId: string): Promise<StudentExamEvaluation[]> {
    const res = await this.db.query(`SELECT * FROM public.student_exam_evaluations WHERE tenant_id = $1 AND exam_id = $2`, [tenantId, examId]);
    return res.rows;
  }

  async getStudentReportCard(_tenantId: string, _examId: string, _studentId: string): Promise<StudentOfficialReportCard | null> {
    return null;
  }

  // ---------------------------------------------------------------------------
  // WhatsApp & Absentee
  // ---------------------------------------------------------------------------

  sanitizePhoneNumber(phone: string): { clean_phone: string; is_valid: boolean } {
    const clean = phone.replace(/[^0-9]/g, '');
    return { clean_phone: clean, is_valid: clean.length >= 10 };
  }

  replaceDynamicTags(template: string, data: Record<string, any>): string {
    let result = template;
    for (const [k, v] of Object.entries(data)) {
      result = result.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
    }
    return result;
  }

  generateWhatsAppLink(phone: string, message: string): WhatsAppSanitizedUrlResult {
    const clean = phone.replace(/[^0-9]/g, '');
    const encoded = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
    return {
      phone,
      clean_phone: clean,
      is_valid: clean.length >= 10,
      message,
      encoded_url: encoded,
    };
  }

  async getWhatsAppTemplates(tenantId: string): Promise<WhatsAppTemplate[]> {
    const res = await this.db.query(`SELECT * FROM public.whatsapp_templates WHERE tenant_id = $1`, [tenantId]);
    return res.rows;
  }

  async createWhatsAppTemplate(tenantId: string, data: any): Promise<WhatsAppTemplate> {
    const res = await this.db.query(
      `INSERT INTO public.whatsapp_templates (tenant_id, name, category, body_text, language)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, data.name, data.category || 'general', data.body_text, data.language || 'en']
    );
    return res.rows[0];
  }

  async updateWhatsAppTemplate(tenantId: string, id: string, data: any): Promise<WhatsAppTemplate | null> {
    const res = await this.db.query(
      `UPDATE public.whatsapp_templates SET body_text = COALESCE($1, body_text), updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [data.body_text, id, tenantId]
    );
    return res.rows[0] || null;
  }

  async deleteWhatsAppTemplate(tenantId: string, id: string): Promise<boolean> {
    const res = await this.db.query(`DELETE FROM public.whatsapp_templates WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return (res.rowCount ?? 0) > 0;
  }

  async logWhatsAppDispatch(tenantId: string, data: any): Promise<WhatsAppAuditLog> {
    const res = await this.db.query(
      `INSERT INTO public.whatsapp_audit_logs (tenant_id, recipient_phone, template_id, status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tenantId, data.recipient_phone, data.template_id || null, data.status || 'sent']
    );
    return res.rows[0];
  }

  async getWhatsAppAuditLogs(tenantId: string): Promise<WhatsAppAuditLog[]> {
    const res = await this.db.query(`SELECT * FROM public.whatsapp_audit_logs WHERE tenant_id = $1 ORDER BY sent_at DESC`, [tenantId]);
    return res.rows;
  }

  async checkDuplicateAlertToday(): Promise<any> {
    return { wasDispatchedToday: false };
  }

  async syncDailyAbsenteeRoster(tenantId: string, date?: string): Promise<AbsenteeFollowupItem[]> {
    const targetDate = date || campusToday();
    const absentees = await this.db.query(
      `SELECT a.student_id, a.batch_id
       FROM public.student_attendance a
       WHERE a.tenant_id = $1 AND a.date = $2 AND a.status = 'absent'`,
      [tenantId, targetDate]
    );

    for (const row of absentees.rows) {
      await this.db.query(
        `INSERT INTO public.absentee_followups (tenant_id, student_id, batch_id, date, status, consecutive_days)
         VALUES ($1, $2, $3, $4, 'PENDING', 1)
         ON CONFLICT (tenant_id, student_id, date) DO NOTHING`,
        [tenantId, row.student_id, row.batch_id, targetDate]
      );
    }

    return this.getAbsenteeFollowups(tenantId, { date: targetDate });
  }

  async getAbsenteeFollowups(tenantId: string, filters?: { date?: string; batchId?: string; status?: string; include_snoozed?: boolean }): Promise<AbsenteeFollowupItem[]> {
    let query = `
      SELECT f.*,
             s.full_name as student_name,
             s.roll_number,
             s.admission_number,
             s.guardian_name,
             s.guardian_phone,
             b.name as batch_name
      FROM public.absentee_followups f
      LEFT JOIN public.students s ON s.id = f.student_id AND s.tenant_id = f.tenant_id
      LEFT JOIN public.batches b ON b.id = f.batch_id AND b.tenant_id = f.tenant_id
      WHERE f.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    if (filters?.date) {
      params.push(filters.date);
      query += ` AND f.date = $${params.length}`;
    }
    if (filters?.batchId) {
      params.push(filters.batchId);
      query += ` AND f.batch_id = $${params.length}`;
    }
    if (filters?.status) {
      params.push(filters.status);
      query += ` AND f.status = $${params.length}`;
    }
    if (!filters?.include_snoozed) {
      query += ` AND f.is_snoozed = false`;
    }
    query += ` ORDER BY f.date DESC, f.created_at DESC`;
    const res = await this.db.query(query, params);
    return res.rows.map(r => ({
      ...r,
      consecutive_absent_days: r.consecutive_days || 1,
    }));
  }

  async getAbsenteeDeskKPI(tenantId: string, date: string): Promise<AbsenteeDeskSummaryKPI> {
    const res = await this.db.query(
      `SELECT
         COUNT(*)::int as total_absentees,
         COUNT(*) FILTER (WHERE status = 'CONTACTED')::int as contacted_count,
         COUNT(*) FILTER (WHERE status = 'UNREACHABLE')::int as unreachable_count,
         COUNT(*) FILTER (WHERE status = 'PENDING')::int as pending_count,
         COUNT(*) FILTER (WHERE status = 'RESOLVED_EXCUSED')::int as excused_count
       FROM public.absentee_followups
       WHERE tenant_id = $1 AND date = $2`,
      [tenantId, date]
    );
    const row = res.rows[0] || {};
    const total = Number(row.total_absentees || 0);
    const contacted = Number(row.contacted_count || 0);
    return {
      total_absentees: total,
      contacted_count: contacted,
      contacted_percentage: total > 0 ? Math.round((contacted / total) * 100) : 0,
      unreachable_count: Number(row.unreachable_count || 0),
      pending_count: Number(row.pending_count || 0),
      excused_count: Number(row.excused_count || 0),
    };
  }

  async logParentResponse(
    tenantId: string,
    id: string,
    data: {
      call_outcome: any;
      reason_category: any;
      parent_remarks?: string;
      expected_return_date?: string;
      convert_to_medical_leave?: boolean;
    },
    counselorId?: string
  ): Promise<AbsenteeFollowupItem | null> {
    const newStatus = (data.call_outcome === 'CONNECTED' || data.call_outcome === 'WHATSAPP_SENT') ? 'CONTACTED' : 'UNREACHABLE';
    const res = await this.db.query(
      `UPDATE public.absentee_followups
       SET call_outcome = $3,
           reason_category = $4,
           parent_remarks = $5,
           expected_return_date = $6,
           status = $7,
           staff_counselor_id = COALESCE($8, staff_counselor_id),
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [
        id,
        tenantId,
        data.call_outcome,
        data.reason_category,
        data.parent_remarks || null,
        data.expected_return_date || null,
        newStatus,
        counselorId || null,
      ]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async getRetentionCases(tenantId: string): Promise<RetentionCounselingCase[]> {
    const res = await this.db.query(
      `SELECT r.*,
              s.full_name as student_name,
              s.roll_number,
              s.admission_number,
              s.guardian_name,
              s.guardian_phone,
              b.name as batch_name
       FROM public.retention_counseling_cases r
       LEFT JOIN public.students s ON s.id = r.student_id AND s.tenant_id = r.tenant_id
       LEFT JOIN public.batches b ON b.id = s.batch_id AND b.tenant_id = s.tenant_id
       WHERE r.tenant_id = $1
       ORDER BY r.created_at DESC`,
      [tenantId]
    );
    return res.rows;
  }

  async refreshRetentionCases(tenantId: string, _date?: string): Promise<RetentionCounselingCase[]> {
    return this.getRetentionCases(tenantId);
  }

  async scheduleRetentionMeeting(tenantId: string, caseId: string, meetingDate: string, notes: string): Promise<RetentionCounselingCase | null> {
    const res = await this.db.query(
      `UPDATE public.retention_counseling_cases
       SET scheduled_meeting_date = $3,
           counseling_notes = COALESCE(counseling_notes || E'\n' || $4, $4),
           status = 'SCHEDULED',
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [caseId, tenantId, meetingDate, notes]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async getAbsenteeResolutionReport(tenantId: string, month: string): Promise<AbsenteeResolutionReport> {
    const res = await this.db.query(
      `SELECT
         COUNT(*)::int as total_absences,
         COUNT(*) FILTER (WHERE status = 'CONTACTED')::int as contacted_count,
         COUNT(*) FILTER (WHERE reason_category = 'MEDICAL')::int as medical_count,
         COUNT(*) FILTER (WHERE reason_category = 'EMERGENCY')::int as emergency_count,
         COUNT(*) FILTER (WHERE reason_category = 'TRANSPORT')::int as transport_count,
         COUNT(*) FILTER (WHERE reason_category = 'FEE_DISPUTE')::int as fee_dispute_count,
         COUNT(*) FILTER (WHERE reason_category = 'TRUANCY')::int as truancy_count,
         COUNT(*) FILTER (WHERE reason_category = 'OTHER')::int as other_count
       FROM public.absentee_followups
       WHERE tenant_id = $1 AND to_char(date, 'YYYY-MM') = $2`,
      [tenantId, month]
    );
    const r = res.rows[0] || {};
    const total = Number(r.total_absences || 0);
    const contacted = Number(r.contacted_count || 0);
    return {
      total_absences: total,
      followup_rate: total > 0 ? Math.round((contacted / total) * 100) : 0,
      reason_breakdown: {
        MEDICAL: Number(r.medical_count || 0),
        EMERGENCY: Number(r.emergency_count || 0),
        TRANSPORT: Number(r.transport_count || 0),
        FEE_DISPUTE: Number(r.fee_dispute_count || 0),
        TRUANCY: Number(r.truancy_count || 0),
        OTHER: Number(r.other_count || 0),
      },
      medical_leave_converted: 0,
      prevented_dropouts: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // SaaS Billing, Subscriptions & Platform Control Plane
  // ---------------------------------------------------------------------------

  async getPlatformBankingConfig(): Promise<PlatformBankingConfig> {
    const res = await this.db.query(`SELECT * FROM public.platform_banking_config ORDER BY updated_at DESC LIMIT 1`);
    if (res.rows.length > 0) {
      const r = res.rows[0];
      return {
        id: r.id,
        bank_name: r.bank_name,
        account_title: r.account_title,
        account_number: r.account_number,
        iban: r.iban,
        branch_code: r.branch_code,
        whatsapp_support: r.whatsapp_support,
        support_email: r.support_email,
        monthly_subscription_fee: Number(r.monthly_subscription_fee),
        instructions: r.instructions,
        updated_at: r.updated_at,
      };
    }
    return {
      id: 'b1000000-0000-0000-0000-000000000001',
      bank_name: 'Bank Alfalah Limited',
      account_title: 'Kampus Technologies Pvt Ltd',
      account_number: '0123-1005678901',
      iban: 'PK36ALFH01231005678901',
      branch_code: '0123 - Gulberg Main Boulevard',
      whatsapp_support: '+923001234567',
      support_email: 'kampuserp@gmail.com',
      monthly_subscription_fee: 15000,
      instructions: 'Please transfer subscription fee via online banking.',
      updated_at: new Date().toISOString(),
    };
  }

  async updatePlatformBankingConfig(data: Partial<PlatformBankingConfig>): Promise<PlatformBankingConfig> {
    const curr = await this.getPlatformBankingConfig();
    const updated = { ...curr, ...data, updated_at: new Date().toISOString() };
    const res = await this.db.query(
      `INSERT INTO public.platform_banking_config (id, bank_name, account_title, account_number, iban, branch_code, whatsapp_support, support_email, monthly_subscription_fee, instructions, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (id) DO UPDATE SET
         bank_name = EXCLUDED.bank_name,
         account_title = EXCLUDED.account_title,
         account_number = EXCLUDED.account_number,
         iban = EXCLUDED.iban,
         branch_code = EXCLUDED.branch_code,
         whatsapp_support = EXCLUDED.whatsapp_support,
         support_email = EXCLUDED.support_email,
         monthly_subscription_fee = EXCLUDED.monthly_subscription_fee,
         instructions = EXCLUDED.instructions,
         updated_at = NOW()
       RETURNING *`,
      [curr.id, updated.bank_name, updated.account_title, updated.account_number, updated.iban || null, updated.branch_code || null, updated.whatsapp_support || null, updated.support_email || null, updated.monthly_subscription_fee, updated.instructions || null]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      bank_name: r.bank_name,
      account_title: r.account_title,
      account_number: r.account_number,
      iban: r.iban,
      branch_code: r.branch_code,
      whatsapp_support: r.whatsapp_support,
      support_email: r.support_email,
      monthly_subscription_fee: Number(r.monthly_subscription_fee),
      instructions: r.instructions,
      updated_at: r.updated_at,
    };
  }

  async getTenantTrialStatus(tenantId: string): Promise<TenantTrialStatus> {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) throw new Error('Tenant not found');
    const trialEnd = new Date(tenant.trial_ends_at).getTime();
    return {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      status: tenant.status,
      trial_ends_at: tenant.trial_ends_at,
      days_remaining: Math.max(0, Math.ceil((trialEnd - Date.now()) / (1000 * 60 * 60 * 24))),
      is_locked: tenant.status === 'locked' || tenant.status === 'suspended',
    };
  }

  async submitSubscriptionReceipt(tenantId: string, data: any): Promise<SubscriptionPaymentReceipt> {
    const num = `REC-${Date.now().toString().slice(-6)}`;
    const res = await this.db.query(
      `INSERT INTO public.subscription_payment_receipts (tenant_id, receipt_number, bank_name, amount, transaction_reference, payment_date, screenshot_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
      [tenantId, num, data.bank_name || 'Bank', data.amount, data.reference_number || data.transaction_reference || 'REF', data.payment_date || campusToday(), data.receipt_image_url || data.screenshot_url || '']
    );
    return res.rows[0];
  }

  async getSubscriptionReceipts(tenantId?: string): Promise<SubscriptionPaymentReceipt[]> {
    if (tenantId) {
      const res = await this.db.query(`SELECT * FROM public.subscription_payment_receipts WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
      return res.rows;
    }
    const res = await this.db.query(`SELECT * FROM public.subscription_payment_receipts ORDER BY created_at DESC`);
    return res.rows;
  }

  async reviewSubscriptionReceipt(receiptId: string, status: SubscriptionReceiptStatus, _reviewedByEmail: string): Promise<SubscriptionPaymentReceipt> {
    const res = await this.db.query(
      `UPDATE public.subscription_payment_receipts SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, receiptId]
    );
    return res.rows[0];
  }

  async activateAcademy(tenantId: string, _durationMonths: number): Promise<Tenant> {
    const res = await this.db.query(
      `UPDATE public.tenants SET status = 'active', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [tenantId]
    );
    return this.mapTenant(res.rows[0]);
  }

  async getTeacherPortalOverview(tenantId: string, teacherId: string, date?: string): Promise<TeacherPortalOverview> {
    const today = date || campusToday();
    const member = await this.getUserById(tenantId, teacherId);
    const assignments = ((member?.metadata as any)?.teaching_assignments || []) as StaffTeachingAssignment[];
    const timetable = await this.db.query(
      `SELECT t.*, b.name as batch_name, s.name as subject_name
       FROM public.timetable_slots t
       LEFT JOIN public.batches b ON b.id = t.batch_id
       LEFT JOIN public.subjects s ON s.id = t.subject_id
       WHERE t.tenant_id = $1 AND (t.teacher_id = $2 OR t.substitute_teacher_id = $2)`,
      [tenantId, teacherId]
    );
    const attendanceRes = await this.db.query(
      `SELECT * FROM public.staff_attendance WHERE tenant_id = $1 AND staff_id = $2 AND date = $3 LIMIT 1`,
      [tenantId, teacherId, today]
    );
    const clockedIn = attendanceRes.rows.length > 0 && Boolean(attendanceRes.rows[0].clock_in_time);
    const batchIds = assignments.map(a => a.batch_id).filter(Boolean);
    let assignedBatches: Batch[] = [];
    if (batchIds.length > 0) {
      const bRes = await this.db.query(
        `SELECT * FROM public.batches WHERE tenant_id = $1 AND id = ANY($2)`,
        [tenantId, batchIds]
      );
      assignedBatches = bRes.rows;
    }
    return {
      teacher_id: teacherId,
      teacher_name: member?.full_name || 'Teacher',
      today_date: today,
      today_schedule: timetable.rows as any[],
      assigned_batches: assignedBatches,
      pending_attendance_batches: [],
      pending_grading_exams: [],
      recent_diary_entries: [],
      geofence_status: {
        is_clocked_in: clockedIn,
      },
    };
  }

  async getStudentParentPortalOverview(tenantId: string, studentId?: string, _enrollmentId?: string): Promise<StudentParentPortalOverview> {
    const student = studentId ? await this.getStudentById(tenantId, studentId) : null;
    const invoices = studentId ? await this.getInvoices(tenantId, { student_id: studentId }) : [];
    const unpaid = invoices.reduce((sum, inv) => sum + (inv.balance_due ?? inv.balance_amount ?? 0), 0);
    const recentAtt = studentId ? await this.getStudentAttendanceHistory(tenantId, studentId) : [];
    const enrollments = studentId ? await this.getStudentEnrollments(tenantId, studentId) : [];
    const primaryEnrollment = enrollments.find(e => e.is_primary) || enrollments[0];
    const batch = primaryEnrollment?.batch_id ? await this.db.query(`SELECT name FROM public.batches WHERE id = $1`, [primaryEnrollment.batch_id]) : null;
    const batchName = batch?.rows[0]?.name || student?.batch_id || 'Enrolled Batch';

    return {
      student_profile: {
        id: student?.id || '',
        full_name: student?.full_name || '',
        roll_number: student?.roll_number || undefined,
        batch_name: batchName,
        guardian_name: student?.guardian_name || '',
        guardian_phone: student?.guardian_phone || '',
        monthly_attendance_pct: 100,
      },
      today_schedule: [],
      invoices,
      unpaid_balance: unpaid,
      recent_receipts: [],
      homework_diary: [],
      exam_report_cards: [],
      recent_attendance: recentAtt.slice(0, 10).map(a => ({
        date: a.date,
        status: a.status as any,
        remarks: a.remarks || null,
      })),
    };
  }

  async getSuperAdminOverview(): Promise<SuperAdminOverview> {
    const tCount = await this.db.query(`SELECT COUNT(*) FROM public.tenants`);
    const totalTenants = Number(tCount.rows[0]?.count || 0);
    const platformConfig = await this.getPlatformConfig();
    const bankingConfig = await this.getPlatformBankingConfig();
    return {
      total_tenants: totalTenants,
      active_tenants: totalTenants,
      trial_tenants: 0,
      locked_tenants: 0,
      suspended_tenants: 0,
      platform_mrr: 0,
      platform_arr: 0,
      pending_receipts_count: 0,
      platform_config: platformConfig,
      banking_config: bankingConfig,
      tenants: [],
      recent_receipts: [],
      announcements: [],
    };
  }

  async getPlatformConfig(): Promise<PlatformGlobalConfig> {
    return this.getPlatformGlobalConfig();
  }

  async updatePlatformConfig(updates: Partial<PlatformGlobalConfig>): Promise<PlatformGlobalConfig> {
    return this.updatePlatformGlobalConfig(updates);
  }

  async updateTenantSubdomain(tenantId: string, newSlug: string): Promise<{ tenant: Tenant; previous_slug: string; redirect_url: string }> {
    const curr = await this.getTenantById(tenantId);
    if (!curr) throw new Error('Tenant not found');
    const prev = curr.slug;
    const clean = newSlug.trim().toLowerCase();
    const res = await this.db.query(
      `UPDATE public.tenants SET slug = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [clean, tenantId]
    );
    const updated = this.mapTenant(res.rows[0]);
    return { tenant: updated, previous_slug: prev, redirect_url: `https://${clean}.kampus.pk` };
  }

  async updateTenantBillingSettings(tenantId: string, _updates: any): Promise<Tenant> {
    const res = await this.db.query(`SELECT * FROM public.tenants WHERE id = $1`, [tenantId]);
    return this.mapTenant(res.rows[0]);
  }

  async renewTenantSubscription(tenantId: string, _params: any): Promise<any> {
    const t = await this.activateAcademy(tenantId, 1);
    return { tenant: t, receipt: {} as any };
  }

  async archiveTenant(tenantId: string): Promise<Tenant> {
    const res = await this.db.query(`UPDATE public.tenants SET status = 'suspended', updated_at = NOW() WHERE id = $1 RETURNING *`, [tenantId]);
    return this.mapTenant(res.rows[0]);
  }

  async hardDeleteTenant(tenantId: string): Promise<{ success: boolean; deleted_tenant_id: string; freed_slug: string }> {
    const t = await this.getTenantById(tenantId);
    if (!t) throw new Error('Tenant not found');
    await this.db.query(`DELETE FROM public.tenants WHERE id = $1`, [tenantId]);
    return { success: true, deleted_tenant_id: tenantId, freed_slug: t.slug };
  }

  async suspendTenant(tenantId: string): Promise<Tenant> {
    const res = await this.db.query(`UPDATE public.tenants SET status = 'suspended', updated_at = NOW() WHERE id = $1 RETURNING *`, [tenantId]);
    return this.mapTenant(res.rows[0]);
  }

  async reinstateTenant(tenantId: string): Promise<Tenant> {
    const res = await this.db.query(`UPDATE public.tenants SET status = 'active', updated_at = NOW() WHERE id = $1 RETURNING *`, [tenantId]);
    return this.mapTenant(res.rows[0]);
  }

  async createAnnouncement(params: Omit<PlatformAnnouncement, 'id' | 'created_at'>): Promise<PlatformAnnouncement> {
    const res = await this.db.query(
      `INSERT INTO public.platform_announcements (title, message, type, frequency, target_audience, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [params.title, params.message, params.type || 'system', params.frequency || 'persistent_banner', params.target_audience || 'all', params.is_active ?? true]
    );
    return res.rows[0];
  }

  async getAnnouncements(onlyActive?: boolean): Promise<PlatformAnnouncement[]> {
    if (onlyActive) {
      const res = await this.db.query(`SELECT * FROM public.platform_announcements WHERE is_active = true ORDER BY created_at DESC`);
      return res.rows;
    }
    const res = await this.db.query(`SELECT * FROM public.platform_announcements ORDER BY created_at DESC`);
    return res.rows;
  }

  async updateAnnouncement(id: string, updates: Partial<PlatformAnnouncement>): Promise<PlatformAnnouncement> {
    const res = await this.db.query(
      `UPDATE public.platform_announcements SET title = COALESCE($1, title), message = COALESCE($2, message), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [updates.title, updates.message, id]
    );
    return res.rows[0];
  }

  async deleteAnnouncement(id: string): Promise<boolean> {
    const res = await this.db.query(`DELETE FROM public.platform_announcements WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async toggleAnnouncement(id: string, isActive: boolean): Promise<PlatformAnnouncement> {
    const res = await this.db.query(
      `UPDATE public.platform_announcements SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [isActive, id]
    );
    return res.rows[0];
  }

  async getActivePopupForTenant(_tenantId: string, _userId: string): Promise<PlatformAnnouncement | null> {
    return null;
  }

  async dismissAnnouncement(announcementId: string, _userId: string, tenantId: string): Promise<boolean> {
    await this.db.query(
      `INSERT INTO public.announcement_read_receipts (tenant_id, announcement_id, read_at)
       VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
      [tenantId, announcementId]
    );
    return true;
  }

  async getPlatformGlobalConfig(): Promise<PlatformGlobalConfig> {
    return {
      id: 'b1000000-0000-0000-0000-000000000001',
      default_trial_days: 30,
      grace_period_days: 5,
      monthly_subscription_fee: 15000,
      bank_name: 'Bank Alfalah Limited',
      account_title: 'Kampus Technologies Pvt Ltd',
      account_number: '0123-1005678901',
      iban: 'PK36ALFH01231005678901',
      branch_code: '0123 - Gulberg Main Boulevard',
      whatsapp_support: '+923001234567',
      support_email: 'kampuserp@gmail.com',
      instructions: 'Please transfer subscription fee via online banking.',
      updated_at: new Date().toISOString(),
    };
  }

  async updatePlatformGlobalConfig(data: Partial<PlatformGlobalConfig>): Promise<PlatformGlobalConfig> {
    const curr = await this.getPlatformGlobalConfig();
    return { ...curr, ...data };
  }

  // Retired In-Memory Snapshot Methods (Phase 3 Requirement 8)
  async listDataBackups(): Promise<DataBackupMeta[]> {
    throw new Error('SNAPSHOT_PERSISTENCE_RETIRED: In-memory snapshot backups are retired.');
  }
  async exportDataBackupFile(): Promise<{ kind: string; version: number; exported_at: string; academy_count: number; payload: Record<string, unknown> }> {
    throw new Error('SNAPSHOT_PERSISTENCE_RETIRED: In-memory snapshot export is retired.');
  }
  async importDataBackupFile(_file: { kind?: string; payload?: Record<string, unknown> }): Promise<{ academy_count: number }> {
    throw new Error('SNAPSHOT_PERSISTENCE_RETIRED: In-memory snapshot import is retired.');
  }
  async createManualDataBackup(): Promise<DataBackupMeta> {
    throw new Error('SNAPSHOT_PERSISTENCE_RETIRED: In-memory snapshot backup creation is retired.');
  }
  async restoreDataBackup(_id: number): Promise<{ academy_count: number }> {
    throw new Error('SNAPSHOT_PERSISTENCE_RETIRED: In-memory snapshot restoration is retired.');
  }
}
