import { 
  Tenant, 
  TenantStatus,
  TenantSettings,
  User,
  UserRole,
  UserStatus, 
  StaffMemberRecord,
  StaffTeachingAssignment,
  StaffDepartment,
  EmploymentType,
  StaffStatus,
  AcademicProgram, 
  Subject, 
  SubjectGroup, 
  Batch, 
  CustomFieldDefinition, 
  StudentInquiry, 
  Student, 
  StudentStatus,
  InquiryStage,
  Room,
  TimetableSlot,
  TimetableSubstitution,
  TimetableCollisionResult,
  DayOfWeek,
  StudentAttendanceRecord,
  AttendanceStatus,
  AttendanceAuditLog,
  LeaveApplication,
  LeaveStatus,
  CampusGeofenceConfig,
  AttendanceHead,
  AttendanceHeadOption,
  StaffAttendanceAuditLog,
  StaffAttendanceRecord,
  StaffAttendanceStatus,
  DailyStaffRosterEntry,
  StaffMonthlyAttendanceSummary,
  StaffRegularizationRequest,
  HomeworkAssignment,
  NotebookCheckRecord,
  NotebookStatus,
  ComplaintTicket,
  ComplaintStatus,
  FeeHead,
  FeePriorityConfig,
  StudentFeeStructure,
  InvoiceStatus,
  InvoiceItem,
  StudentInvoice,
  PaymentDistributionItem,
  PaymentMethod,
  FeePayment,
  FeeDiscount,
  SalaryContractType,
  StaffSalaryProfile,
  PayrollEarningHead,
  PayrollDeductionHead,
  StaffPayslipStatus,
  StaffPayslip,
  AccountHead,
  FinancialTransaction,
  DailyCashbookEntry,
  StudentLedgerEntry,
  QuestionChapter,
  BankQuestion,
  Exam,
  ExamQuestion,
  StudentExamEvaluation,
  ExcelQuestionImportRow,
  StudentOfficialReportCard,
  ExamQuestionType,
  EvaluationStatus,
  WhatsAppTemplate,
  WhatsAppTemplateCategory,
  WhatsAppAuditLog,
  WhatsAppPhoneType,
  WhatsAppSanitizedUrlResult,
  AbsenteeFollowupItem,
  AbsenteeCallOutcome,
  AbsenteeReasonCategory,
  AbsenteeFollowupStatus,
  AbsenteeDeskSummaryKPI,
  RetentionRiskLevel,
  RetentionCounselingCase,
  AbsenteeResolutionReport,
  PlatformBankingConfig,
  PlatformGlobalConfig,
  PlatformAnnouncement,
  AnnouncementReadReceipt,
  TenantSlugAlias,
  SubscriptionReceiptStatus,
  SubscriptionPaymentReceipt,
  TenantTrialStatus,
  TeacherPortalOverview,
  StudentParentPortalOverview,
  SuperAdminOverview,
  SuperAdminTenantSummary,
  defaultAcademicSessions,
  activeSessionStartYear,
} from '@apex/shared-types';

import { hashPassword, verifyPassword } from './password.js';
import {
  countRealAcademies,
  createManualBackup,
  listDataBackups,
  loadBackupPayload,
  loadSnapshot,
  persistenceEnabled,
  saveSnapshot,
  type DataBackupMeta,
} from './store-persist.js';

export interface StoredOTP {
  id: string;
  tenant_id: string;
  email: string;
  code_hash: string;
  attempts: number;
  expires_at: Date;
  used_at?: Date | null;
  created_at?: Date;
  purpose?: string;
}

export interface StaffLeaveRecord {
  id: string;
  tenant_id: string;
  staff_id: string;
  staff_name?: string;
  start_date: string;
  end_date: string;
  category: 'medical' | 'casual' | 'official_duty' | 'emergency' | 'annual';
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string | null;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStaffInput {
  tenant_id: string;
  full_name: string;
  email: string;
  password?: string;
  phone?: string | null;
  employee_code?: string | null;
  father_or_spouse_name?: string | null;
  cnic?: string | null;
  blood_group?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  dob?: string | null;
  whatsapp?: string | null;
  emergency_contact?: string | null;
  emergency_relation?: string | null;
  address?: string | null;
  department?: StaffDepartment | null;
  designation?: string | null;
  employment_type?: EmploymentType | null;
  joining_date?: string | null;
  probation_end_date?: string | null;
  qualification?: string | null;
  experience_years?: number | null;
  base_salary?: number | null;
  bank_name?: string | null;
  bank_account_title?: string | null;
  bank_account_number?: string | null;
  bank_iban?: string | null;
  teaching_assignments?: StaffTeachingAssignment[] | null;
  permissions?: string[] | null;
  status?: StaffStatus | null;
  role?: UserRole;
}

export interface UpdateStaffInput {
  full_name?: string;
  email?: string;
  phone?: string | null;
  employee_code?: string | null;
  father_or_spouse_name?: string | null;
  cnic?: string | null;
  blood_group?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  dob?: string | null;
  whatsapp?: string | null;
  emergency_contact?: string | null;
  emergency_relation?: string | null;
  address?: string | null;
  department?: StaffDepartment | null;
  designation?: string | null;
  employment_type?: EmploymentType | null;
  joining_date?: string | null;
  probation_end_date?: string | null;
  relieving_date?: string | null;
  qualification?: string | null;
  experience_years?: number | null;
  base_salary?: number | null;
  bank_name?: string | null;
  bank_account_title?: string | null;
  bank_account_number?: string | null;
  bank_iban?: string | null;
  teaching_assignments?: StaffTeachingAssignment[] | null;
  permissions?: string[] | null;
  status?: UserStatus | null;
  role?: UserRole;
}

export interface IDataStore {
  // Tenancy & Auth
  getTenantBySlug(slug: string): Promise<Tenant | null>;
  getTenantById(id: string): Promise<Tenant | null>;
  listTenants(): Promise<Tenant[]>;
  createTenant(params: {
    name: string;
    slug: string;
    campus_name?: string;
    city?: string;
    phone?: string;
    admin_name: string;
    admin_email: string;
    logo_url?: string;
    password_hash?: string;
    status?: TenantStatus;
  }): Promise<{ tenant: Tenant; admin: User }>;
  updateTenantSettings(tenantId: string, updates: { name?: string; slug?: string; settings?: Partial<TenantSettings> }): Promise<Tenant | null>;
  getUserByEmail(tenantId: string, email: string): Promise<User | null>;
  getUserByEmailGlobal(email: string): Promise<User[]>;
  checkSlugAvailable(slug: string): Promise<boolean>;
  updateUserPassword(tenantId: string, email: string, passwordHash: string): Promise<boolean>;
  createOTP(tenantId: string, email: string, codeHash: string, expiresAt: Date, purpose?: string): Promise<StoredOTP>;
  getActiveOTP(tenantId: string, email: string, purpose?: string): Promise<StoredOTP | null>;
  getLatestOTP(tenantId: string, email: string, purpose?: string): Promise<StoredOTP | null>;
  incrementOTPAttempts(id: string): Promise<void>;
  markOTPUsed(id: string): Promise<void>;

  getPrograms(tenantId: string): Promise<AcademicProgram[]>;
  createProgram(data: Omit<AcademicProgram, 'id' | 'created_at' | 'updated_at'>): Promise<AcademicProgram>;
  updateProgram(tenantId: string, id: string, data: Partial<Omit<AcademicProgram, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>): Promise<AcademicProgram | null>;
  deleteProgram(tenantId: string, id: string, transferToProgramId?: string): Promise<boolean>;
  reorderPrograms(tenantId: string, orderedIds: string[]): Promise<void>;
  
  getSubjects(tenantId: string): Promise<Subject[]>;
  createSubject(data: Omit<Subject, 'id' | 'created_at'>): Promise<Subject>;
  deleteSubject(tenantId: string, id: string): Promise<boolean>;

  getSubjectGroups(tenantId: string, programId?: string): Promise<SubjectGroup[]>;
  createSubjectGroup(data: Omit<SubjectGroup, 'id' | 'created_at'>): Promise<SubjectGroup>;
  deleteSubjectGroup(tenantId: string, id: string): Promise<boolean>;

  getBatches(tenantId: string, programId?: string, cohortType?: 'section' | 'batch'): Promise<Batch[]>;
  createBatch(data: Omit<Batch, 'id' | 'created_at' | 'updated_at' | 'current_enrollment'>): Promise<Batch>;
  updateBatch(tenantId: string, id: string, data: Partial<Omit<Batch, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>): Promise<Batch | null>;
  deleteBatch(tenantId: string, id: string, transferToBatchId?: string): Promise<boolean>;

  // Custom Fields (Phase 2)
  getCustomFields(tenantId: string, entityType: 'student' | 'inquiry'): Promise<CustomFieldDefinition[]>;
  createCustomField(data: Omit<CustomFieldDefinition, 'id' | 'created_at'>): Promise<CustomFieldDefinition>;

  // Inquiries Desk (Phase 2)
  getInquiries(tenantId: string): Promise<StudentInquiry[]>;
  createInquiry(data: Omit<StudentInquiry, 'id' | 'inquiry_number' | 'created_at' | 'updated_at'>): Promise<StudentInquiry>;
  updateInquiryStage(tenantId: string, id: string, stage: InquiryStage): Promise<StudentInquiry | null>;

  // Student SIS (Phase 2)
  getStudents(tenantId: string, batchId?: string): Promise<Student[]>;
  getStudentById(tenantId: string, id: string): Promise<Student | null>;
  getStudentAcademicSummary(tenantId: string, studentId: string): Promise<{
    exams: any[];
    homework: any[];
    attendance_summary: {
      total: number;
      present: number;
      absent: number;
      late: number;
      percentage: number;
    };
  }>;
  createStudent(data: Omit<Student, 'id' | 'admission_number' | 'roll_number' | 'admission_date' | 'created_at' | 'updated_at'>): Promise<Student>;
  updateStudent(tenantId: string, id: string, data: Partial<Student>): Promise<Student | null>;
  updateStudentStatus(tenantId: string, studentId: string, status: StudentStatus, reason: string, cancelUnpaidInvoices?: boolean, changedBy?: string): Promise<Student | null>;
  archiveStudent(tenantId: string, studentId: string, reason?: string, cancelUnpaidInvoices?: boolean, changedBy?: string): Promise<Student | null>;
  unarchiveStudent(tenantId: string, studentId: string, reason?: string, changedBy?: string): Promise<Student | null>;
  deleteStudent(tenantId: string, studentId: string, options?: { force?: boolean; reason?: string; deletedBy?: string }): Promise<{ success: boolean; message?: string; error?: string; hasPaidTransactions?: boolean }>;
  bulkArchiveStudents(tenantId: string, studentIds: string[], reason?: string, cancelUnpaidInvoices?: boolean, changedBy?: string): Promise<{ archived_count: number; errors?: string[] }>;
  bulkDeleteStudents(tenantId: string, studentIds: string[], options?: { force?: boolean; reason?: string; deletedBy?: string }): Promise<{ deleted_count: number; skipped_count: number; errors?: string[] }>;
  admitInquiry(
    tenantId: string,
    inquiryId: string,
    batchId: string,
    electiveGroupId?: string,
    customSubjectIds?: string[],
    feeStructure?: any,
    customFieldValues?: Record<string, any>,
    guardianIdCard?: string
  ): Promise<Student>;
  promoteStudents(tenantId: string, params: {
    student_ids: string[];
    target_program_id?: string;
    target_batch_id: string;
    target_session?: string;
    fee_adjustment_type: 'keep' | 'target_baseline' | 'percentage' | 'fixed';
    fee_adjustment_value?: number;
  }, userId?: string): Promise<{ count: number; updated_students: Student[] }>;
  bulkFeeRevision(tenantId: string, params: {
    scope: 'all' | 'program' | 'batch';
    program_id?: string;
    batch_id?: string;
    increment_type: 'percentage' | 'fixed';
    increment_value: number;
    rounding?: 'none' | 'nearest_50' | 'nearest_100';
    reason?: string;
  }, userId?: string): Promise<{ count: number; affected_students: Student[] }>;
  bulkImportStudents(
    tenantId: string,
    defaultBatchId?: string,
    rows?: Array<any>,
    generateInvoices?: boolean
  ): Promise<{ imported_count: number; failed_count: number; students: Student[]; errors: Array<{ row: number; error: string }> }>;
  logStudentProfileChange(tenantId: string, data: {
    student_id: string;
    action?: string;
    changed_by_user_id: string;
    changed_by_name: string;
    field_name?: string;
    old_value?: string | null;
    new_value?: string | null;
    changes?: Record<string, any>;
    reason?: string | null;
  }): Promise<any>;
  getStudentProfileAuditLogs(tenantId: string, studentId: string): Promise<any[]>;
  resetStudentPassword(
    tenantId: string,
    studentId: string,
    options: {
      newPassword?: string;
      reason?: string;
      adminName: string;
      adminUserId: string;
      guardianIdCard?: string;
    }
  ): Promise<{ student: Student; user: User; default_password: string }>;

  // --- Phase 3: Timetable & Collision Engine ---
  getRooms(tenantId: string): Promise<Room[]>;
  createRoom(data: Omit<Room, 'id' | 'created_at' | 'updated_at'>): Promise<Room>;
  getTimetable(tenantId: string, batchId?: string, day?: DayOfWeek, date?: string): Promise<TimetableSlot[]>;
  checkCollision(tenantId: string, slot: {
    batchId: string;
    teacherId: string;
    roomId?: string | null;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    excludeSlotId?: string;
    date?: string;
  }): Promise<TimetableCollisionResult>;
  createTimetableSlot(data: Omit<TimetableSlot, 'id' | 'created_at' | 'updated_at'>): Promise<TimetableSlot>;
  assignSubstitute(tenantId: string, slotId: string, substituteTeacherId: string, date?: string, reason?: string): Promise<TimetableSlot>;
  deleteTimetableSlot(tenantId: string, slotId: string): Promise<boolean>;
  getAvailableTeachers(tenantId: string, dayOfWeek: DayOfWeek, startTime: string, endTime: string, date?: string): Promise<User[]>;

  // --- Phase 3: Student Attendance & Leaves ---
  getStudentAttendance(tenantId: string, batchId?: string, date?: string): Promise<StudentAttendanceRecord[]>;
  getStudentAttendanceHistory(tenantId: string, studentId: string): Promise<StudentAttendanceRecord[]>;
  getAttendanceAuditLogs(tenantId: string, studentId?: string, date?: string): Promise<AttendanceAuditLog[]>;
  recordBatchAttendance(
    tenantId: string,
    batchId: string,
    date: string,
    records: Array<{ student_id: string; status: AttendanceStatus; remarks?: string }>,
    markedBy?: string
  ): Promise<StudentAttendanceRecord[]>;
  getLeaveApplications(tenantId: string, studentId?: string): Promise<LeaveApplication[]>;
  submitLeaveApplication(data: Omit<LeaveApplication, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<LeaveApplication>;
  reviewLeaveApplication(tenantId: string, leaveId: string, status: LeaveStatus, reviewNotes?: string, reviewerId?: string): Promise<LeaveApplication>;

  // --- Staff Leaves Support ---
  getStaffLeaves(tenantId: string, staffId?: string): Promise<StaffLeaveRecord[]>;
  submitStaffLeave(data: Omit<StaffLeaveRecord, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<StaffLeaveRecord>;
  reviewStaffLeave(tenantId: string, leaveId: string, status: 'approved' | 'rejected', reviewNotes?: string, reviewerId?: string): Promise<StaffLeaveRecord>;

  // --- Phase 3: Campus Geofence & Staff Attendance ---
  getGeofenceConfig(tenantId: string): Promise<CampusGeofenceConfig>;
  updateGeofenceConfig(tenantId: string, config: Partial<CampusGeofenceConfig>): Promise<CampusGeofenceConfig>;
  staffClockIn(tenantId: string, staffId: string, staffName: string, lat: number, lng: number): Promise<StaffAttendanceRecord>;
  staffClockOut(tenantId: string, staffId: string, lat: number, lng: number): Promise<StaffAttendanceRecord>;
  getStaffAttendance(tenantId: string, date?: string): Promise<StaffAttendanceRecord[]>;
  getStaffRoster(tenantId: string, date?: string): Promise<DailyStaffRosterEntry[]>;
  getStaffMonthlySummary(tenantId: string, monthStr: string): Promise<StaffMonthlyAttendanceSummary[]>;
  manualStaffAttendance(
    tenantId: string,
    data: {
      staff_id: string;
      staff_name?: string;
      date: string;
      status: StaffAttendanceStatus;
      clock_in_time?: string;
      clock_out_time?: string;
      reason: string;
      verification_mode?: 'manual_regularization' | 'official_duty';
      adjusted_by?: string;
    }
  ): Promise<StaffAttendanceRecord>;
  adjustStaffAttendance(tenantId: string, id: string, status: StaffAttendanceStatus, notes: string): Promise<StaffAttendanceRecord>;
  getStaffAttendanceAuditLogs(tenantId: string, options?: { staff_id?: string; date?: string; start_date?: string; end_date?: string }): Promise<StaffAttendanceAuditLog[]>;
  getStaffRegularizationRequests(tenantId: string, options?: { staff_id?: string; status?: string }): Promise<StaffRegularizationRequest[]>;
  submitStaffRegularizationRequest(tenantId: string, data: { staff_id: string; staff_name?: string; date: string; clock_in_time?: string; clock_out_time?: string; reason_type: string; notes?: string }): Promise<StaffRegularizationRequest>;
  reviewStaffRegularizationRequest(tenantId: string, requestId: string, action: 'approved' | 'rejected', reviewer: string, reviewNotes?: string, headId?: string): Promise<StaffRegularizationRequest>;

  // --- Phase 3: Homework Diary & Physical Notebook Checking ---
  getHomework(tenantId: string, batchId?: string): Promise<HomeworkAssignment[]>;
  createHomework(data: Omit<HomeworkAssignment, 'id' | 'created_at'>): Promise<HomeworkAssignment>;
  recordNotebookChecks(
    tenantId: string,
    assignmentId: string,
    checks: Array<{ student_id: string; status: NotebookStatus; remarks?: string }>,
    checkedBy: string
  ): Promise<NotebookCheckRecord[]>;
  getNotebookChecks(tenantId: string, assignmentId: string): Promise<NotebookCheckRecord[]>;

  // --- Phase 3: Complaints & Feedback ---
  getComplaints(tenantId: string): Promise<ComplaintTicket[]>;
  createComplaint(data: Omit<ComplaintTicket, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<ComplaintTicket>;
  updateComplaintStatus(
    tenantId: string,
    id: string,
    status: ComplaintStatus,
    resolutionReply?: string,
    internalNotes?: string,
    resolvedBy?: string
  ): Promise<ComplaintTicket>;

  // --- Phase 4: Fee Heads & Priority Configuration ---
  getFeeHeads(tenantId: string): Promise<FeeHead[]>;
  createFeeHead(data: Omit<FeeHead, 'id' | 'created_at'>): Promise<FeeHead>;
  updateFeeHead(tenantId: string, id: string, data: Partial<Pick<FeeHead, 'name' | 'code' | 'default_amount' | 'priority_order'>>): Promise<FeeHead | null>;
  deleteFeeHead(tenantId: string, id: string): Promise<boolean>;
  getTenantUsers(tenantId: string): Promise<User[]>;
  updateUserMetadata(tenantId: string, userId: string, metadata: Record<string, unknown>): Promise<User | null>;
  createStaff(data: CreateStaffInput): Promise<User>;
  updateStaff(tenantId: string, userId: string, patch: UpdateStaffInput): Promise<User | null>;
  archiveStaff(tenantId: string, userId: string, reason?: string): Promise<User | null>;
  restoreStaff(tenantId: string, userId: string): Promise<User | null>;
  deleteStaff(tenantId: string, userId: string): Promise<boolean>;
  resetStaffPassword(tenantId: string, userId: string, newPassword: string): Promise<User | null>;
  assignStaffTeaching(tenantId: string, userId: string, assignments: StaffTeachingAssignment[]): Promise<User | null>;
  getFeePriorityConfig(tenantId: string): Promise<FeePriorityConfig>;
  updateFeePriorityConfig(tenantId: string, priorityOrder: string[]): Promise<FeePriorityConfig>;

  // --- Phase 4: Fee Structures & Invoicing ---
  getFeeStructures(tenantId: string, batchId?: string, studentId?: string): Promise<StudentFeeStructure[]>;
  saveFeeStructure(data: Omit<StudentFeeStructure, 'id' | 'created_at' | 'updated_at'>): Promise<StudentFeeStructure>;
  getInvoices(tenantId: string, options?: { studentId?: string; student_id?: string; batchId?: string; batch_id?: string; billingMonth?: string; billing_month?: string; status?: InvoiceStatus }): Promise<StudentInvoice[]>;
  getInvoiceById(tenantId: string, id: string): Promise<StudentInvoice | null>;
  generateInvoice(tenantId: string, data: {
    student_id: string;
    billing_month: string;
    due_date: string;
    custom_items?: Array<{ fee_head_id: string; amount: number }>;
    additional_heads?: Array<{ fee_head_id: string; amount: number }>;
    notes?: string;
  }): Promise<StudentInvoice>;
  generateBatchInvoices(
    tenantId: string,
    batchIdOrParams: string | { batch_id?: string; program_id?: string; scope?: 'all' | 'program' | 'batch'; target_id?: string; billing_month: string; due_date: string; issue_date?: string; additional_heads?: Array<{ fee_head_id: string; amount: number }> },
    billingMonth?: string,
    dueDate?: string
  ): Promise<StudentInvoice[]>;
  cancelInvoice(tenantId: string, invoiceId: string, reason: string, cancelledBy: string): Promise<StudentInvoice>;
  deleteInvoice(tenantId: string, invoiceId: string, reason: string, deletedBy: string): Promise<{ success: boolean; deleted_invoice_id: string; deleted_payments_count: number }>;
  updateInvoice(
    tenantId: string,
    invoiceId: string,
    data: {
      due_date?: string;
      notes?: string | null;
      items?: Array<{ fee_head_id: string; amount: number }>;
    }
  ): Promise<StudentInvoice>;

  // --- Phase 4: Payment Distribution & Cashier Review ---
  previewPaymentDistribution(tenantId: string, invoiceId: string, amount: number): Promise<PaymentDistributionItem[]>;
  getPayments(tenantId: string, options?: { invoice_id?: string; student_id?: string; date?: string; status?: string }): Promise<FeePayment[]>;
  recordPayment(tenantId: string, data: {
    invoice_id: string;
    amount_paid: number;
    payment_method: PaymentMethod;
    payment_date?: string;
    reference_number?: string;
    bank_name?: string | null;
    cheque_number?: string | null;
    clearing_date?: string | null;
    is_override?: boolean;
    override_reason?: string;
    allocations?: PaymentDistributionItem[];
    collected_by: string;
  }): Promise<{ payment: FeePayment; invoice: StudentInvoice }>;
  recordFamilyPayment(tenantId: string, data: {
    payment_method: PaymentMethod;
    reference_number?: string;
    bank_name?: string | null;
    cheque_number?: string | null;
    clearing_date?: string | null;
    collected_by: string;
    payments: Array<{
      invoice_id: string;
      amount_paid: number;
      allocations?: PaymentDistributionItem[];
      is_override?: boolean;
      override_reason?: string;
    }>;
  }): Promise<{
    family_receipt_number: string;
    results: Array<{ payment: FeePayment; invoice: StudentInvoice }>;
    total_amount: number;
  }>;
  voidPayment(tenantId: string, paymentId: string, voidReason: string, voidedBy: string): Promise<{ payment: FeePayment; invoice: StudentInvoice }>;
  deletePayment(tenantId: string, paymentId: string, deletedBy: string): Promise<{ success: boolean; deleted_payment_id: string; invoice?: StudentInvoice }>;
  getFeeAuditLogs(tenantId: string, studentId?: string): Promise<any[]>;

  // --- Phase 4: Discounts & Audit Trail ---
  getDiscounts(tenantId: string, studentId?: string): Promise<FeeDiscount[]>;
  applyDiscount(tenantId: string, data: {
    student_id: string;
    invoice_id?: string;
    fee_head_id?: string;
    discount_type: 'flat' | 'percentage';
    discount_value: number;
    mandatory_reason: string;
    approved_by: string;
  }): Promise<FeeDiscount>;

  // --- Phase 4: Reports & Ledgers ---
  getDailyCashbook(tenantId: string, date?: string, endDate?: string): Promise<DailyCashbookEntry[]>;
  getStudentLedger(tenantId: string, studentId: string): Promise<StudentLedgerEntry[]>;
  getFeeHeadCollectionReport(tenantId: string): Promise<Array<{ fee_head_id: string; head_name: string; total_billed: number; total_collected: number; outstanding_balance: number }>>;

  // --- Dynamic Operational Income & Expense (ZERO Hardcoding) ---
  getAccountHeads(tenantId: string, type?: 'income' | 'expense'): Promise<AccountHead[]>;
  createAccountHead(data: Omit<AccountHead, 'id' | 'created_at'>): Promise<AccountHead>;
  deleteAccountHead(tenantId: string, id: string): Promise<boolean>;
  getFinancialTransactions(tenantId: string, filters?: { type?: 'income' | 'expense'; head_id?: string; startDate?: string; endDate?: string }): Promise<FinancialTransaction[]>;
  createFinancialTransaction(data: Omit<FinancialTransaction, 'id' | 'voucher_number' | 'created_at'>): Promise<FinancialTransaction>;
  getProfitLossReport(tenantId: string, month?: string): Promise<{
    totalFeeIncome: number;
    otherIncome: number;
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    incomeByHead: Record<string, number>;
    expenseByHead: Record<string, number>;
    total_income?: number;
    total_expense?: number;
    net_profit?: number;
    income_breakdown?: Record<string, number>;
    expense_breakdown?: Record<string, number>;
  }>;

  // --- Phase 4: Staff Payroll & Interactive Salary Processing ---
  getStaffSalaryProfiles(tenantId: string): Promise<StaffSalaryProfile[]>;
  saveStaffSalaryProfile(data: Omit<StaffSalaryProfile, 'id' | 'created_at' | 'updated_at'>): Promise<StaffSalaryProfile>;
  getPayslips(tenantId: string, options?: { staffId?: string; payrollMonth?: string }): Promise<StaffPayslip[]>;
  generatePayslip(tenantId: string, data: {
    staff_id: string;
    payroll_month: string;
    earnings: PayrollEarningHead[];
    deductions: PayrollDeductionHead[];
    admin_notes?: string;
    processed_by: string;
  }): Promise<StaffPayslip>;
  markPayslipPaid(tenantId: string, payslipId: string, paymentMethod: PaymentMethod, reference?: string): Promise<StaffPayslip>;

  // --- Phase 5: Examination Bank, Dual Question Bank Modes & Hybrid Evaluation ---
  getQuestionChapters(tenantId: string, subjectId?: string, programId?: string): Promise<QuestionChapter[]>;
  createQuestionChapter(tenantId: string, data: Omit<QuestionChapter, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<QuestionChapter>;
  getBankQuestions(tenantId: string, filters?: { chapterId?: string; subjectId?: string; type?: ExamQuestionType; isQuizBank?: boolean }): Promise<BankQuestion[]>;
  createBankQuestion(tenantId: string, data: Omit<BankQuestion, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<BankQuestion>;
  importQuestionsFromExcel(tenantId: string, subjectId: string, programId: string, rows: ExcelQuestionImportRow[]): Promise<{ imported_count: number; chapters_created: number; questions: BankQuestion[] }>;
  deleteBankQuestion(tenantId: string, questionId: string): Promise<boolean>;

  getExams(tenantId: string, batchId?: string, subjectId?: string): Promise<Exam[]>;
  getExamById(tenantId: string, examId: string): Promise<Exam | null>;
  createExam(tenantId: string, data: Omit<Exam, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<Exam>;
  updateExam(tenantId: string, examId: string, updates: Partial<Exam>): Promise<Exam>;
  addExamQuestions(tenantId: string, examId: string, questions: Omit<ExamQuestion, 'id' | 'tenant_id' | 'exam_id' | 'created_at'>[]): Promise<ExamQuestion[]>;
  getExamQuestions(tenantId: string, examId: string): Promise<ExamQuestion[]>;

  evaluateStudentExam(tenantId: string, data: {
    exam_id: string;
    student_id: string;
    mcq_answers?: Record<string, string>;
    short_score?: number;
    short_remarks?: string;
    long_score?: number;
    long_remarks?: string;
    status?: EvaluationStatus;
    evaluated_by?: string;
  }): Promise<StudentExamEvaluation>;
  getExamEvaluations(tenantId: string, examId: string): Promise<StudentExamEvaluation[]>;
  getStudentReportCard(tenantId: string, examId: string, studentId: string): Promise<StudentOfficialReportCard | null>;

  // Phase 6: WhatsApp Messaging & Absentee Retention Desk
  sanitizePhoneNumber(phone: string, countryCode?: string): { clean_phone: string; is_valid: boolean; warning?: string };
  replaceDynamicTags(template: string, data: Record<string, any>): string;
  generateWhatsAppLink(phone: string, message: string, countryCode?: string): WhatsAppSanitizedUrlResult;
  getWhatsAppTemplates(tenantId: string, category?: string): Promise<WhatsAppTemplate[]>;
  createWhatsAppTemplate(tenantId: string, data: Omit<WhatsAppTemplate, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<WhatsAppTemplate>;
  updateWhatsAppTemplate(tenantId: string, id: string, data: Partial<Omit<WhatsAppTemplate, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>): Promise<WhatsAppTemplate | null>;
  deleteWhatsAppTemplate(tenantId: string, id: string): Promise<boolean>;
  logWhatsAppDispatch(tenantId: string, data: Omit<WhatsAppAuditLog, 'id' | 'tenant_id' | 'dispatched_at'>): Promise<WhatsAppAuditLog>;
  getWhatsAppAuditLogs(tenantId: string, studentId?: string): Promise<WhatsAppAuditLog[]>;
  checkDuplicateAlertToday(tenantId: string, studentId: string, templateCategory: string): Promise<{ wasDispatchedToday: boolean; lastDispatchedAt?: string; dispatchedBy?: string }>;

  syncDailyAbsenteeRoster(tenantId: string, date: string): Promise<AbsenteeFollowupItem[]>;
  getAbsenteeFollowups(tenantId: string, filters?: { date?: string; batchId?: string; status?: string }): Promise<AbsenteeFollowupItem[]>;
  getAbsenteeDeskKPI(tenantId: string, date: string): Promise<AbsenteeDeskSummaryKPI>;
  logParentResponse(
    tenantId: string,
    id: string,
    data: {
      call_outcome: AbsenteeCallOutcome;
      reason_category: AbsenteeReasonCategory;
      parent_remarks?: string;
      expected_return_date?: string;
      convert_to_medical_leave?: boolean;
    },
    counselorId?: string
  ): Promise<AbsenteeFollowupItem | null>;
  getRetentionCases(tenantId: string): Promise<RetentionCounselingCase[]>;
  scheduleRetentionMeeting(tenantId: string, caseId: string, meetingDate: string, notes: string): Promise<RetentionCounselingCase | null>;
  getAbsenteeResolutionReport(tenantId: string, month: string): Promise<AbsenteeResolutionReport>;

  // Phase 7: Multi-Portal Dashboards, SaaS Billing Lockout & Platform Control Plane
  getPlatformBankingConfig(): Promise<PlatformBankingConfig>;
  updatePlatformBankingConfig(data: Partial<PlatformBankingConfig>): Promise<PlatformBankingConfig>;
  getTenantTrialStatus(tenantId: string): Promise<TenantTrialStatus>;
  submitSubscriptionReceipt(tenantId: string, data: {
    amount: number;
    plan_duration_months: number;
    payment_method: string;
    reference_number?: string;
    notes?: string;
    uploaded_by_user_id?: string;
    uploaded_by_email?: string;
    receipt_image_url?: string;
  }): Promise<SubscriptionPaymentReceipt>;
  getSubscriptionReceipts(tenantId?: string): Promise<SubscriptionPaymentReceipt[]>;
  reviewSubscriptionReceipt(receiptId: string, status: SubscriptionReceiptStatus, reviewedByEmail: string): Promise<SubscriptionPaymentReceipt>;
  activateAcademy(tenantId: string, durationMonths: number, reviewedByEmail?: string): Promise<Tenant>;
  getTeacherPortalOverview(tenantId: string, teacherId: string, date?: string): Promise<TeacherPortalOverview>;
  getStudentParentPortalOverview(tenantId: string, studentId?: string): Promise<StudentParentPortalOverview>;
  getSuperAdminOverview(): Promise<SuperAdminOverview>;
  getPlatformConfig(): Promise<PlatformGlobalConfig>;
  updatePlatformConfig(updates: Partial<PlatformGlobalConfig>): Promise<PlatformGlobalConfig>;
  updateTenantSubdomain(tenantId: string, newSlug: string): Promise<{ tenant: Tenant; previous_slug: string; redirect_url: string }>;
  resolveTenantBySlugOrAlias(slug: string): Promise<{ tenant: Tenant | null; is_alias: boolean; primary_slug: string | null }>;
  updateTenantBillingSettings(tenantId: string, updates: { custom_monthly_fee?: number; individual_grace_period_days?: number; billing_cycle_anchor_day?: number }): Promise<Tenant>;
  renewTenantSubscription(tenantId: string, params: { duration_months: number; custom_amount?: number; payment_method?: string; reference_number?: string; notes?: string }, reviewedByEmail?: string): Promise<{ tenant: Tenant; receipt: SubscriptionPaymentReceipt }>;
  archiveTenant(tenantId: string, reason?: string): Promise<Tenant>;
  hardDeleteTenant(tenantId: string): Promise<{ success: boolean; deleted_tenant_id: string; freed_slug: string }>;
  suspendTenant(tenantId: string, reason?: string): Promise<Tenant>;
  reinstateTenant(tenantId: string): Promise<Tenant>;
  createAnnouncement(params: Omit<PlatformAnnouncement, 'id' | 'created_at'>): Promise<PlatformAnnouncement>;
  getAnnouncements(onlyActive?: boolean): Promise<PlatformAnnouncement[]>;
  updateAnnouncement(id: string, updates: Partial<PlatformAnnouncement>): Promise<PlatformAnnouncement>;
  deleteAnnouncement(id: string): Promise<boolean>;
  toggleAnnouncement(id: string, isActive: boolean): Promise<PlatformAnnouncement>;
  getActivePopupForTenant(tenantId: string, userId: string, role?: string): Promise<PlatformAnnouncement | null>;
  dismissAnnouncement(announcementId: string, userId: string, tenantId: string): Promise<boolean>;
  listDataBackups(): Promise<DataBackupMeta[]>;
  createManualDataBackup(): Promise<DataBackupMeta>;
  restoreDataBackup(id: number): Promise<{ academy_count: number }>;
  exportDataBackupFile(): Promise<{ kind: string; version: number; exported_at: string; academy_count: number; payload: Record<string, unknown> }>;
  importDataBackupFile(file: { kind?: string; payload?: Record<string, unknown> }): Promise<{ academy_count: number }>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function normalizeBillingMonth(val: string | null | undefined): string {
  if (!val) return '';
  const trimmed = val.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const monthNum = parseInt(isoMatch[2], 10);
    if (monthNum >= 1 && monthNum <= 12) {
      return `${MONTH_NAMES[monthNum - 1]} ${year}`;
    }
  }
  const named = trimmed.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{4})$/i);
  if (named) {
    const key = named[1].toLowerCase().slice(0, 3);
    const idx = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(key);
    if (idx >= 0) return `${MONTH_NAMES[idx]} ${named[2]}`;
  }
  return trimmed;
}

export function isSameBillingMonth(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeBillingMonth(a).toLowerCase() === normalizeBillingMonth(b).toLowerCase();
}

export function getBillingMonthStartIso(billingMonth: string | null | undefined): string | null {
  if (!billingMonth || !billingMonth.trim()) return null;
  const norm = normalizeBillingMonth(billingMonth);
  const parts = norm.split(' ');
  if (parts.length === 2) {
    const monthIdx = MONTH_NAMES.indexOf(parts[0]);
    const year = parseInt(parts[1], 10);
    if (monthIdx >= 0 && !isNaN(year)) {
      return `${year}-${String(monthIdx + 1).padStart(2, '0')}-01`;
    }
  }
  const isoMatch = billingMonth.trim().match(/^(\d{4})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-01`;
  }
  return null;
}

export function isBatchEndedForBillingMonth(batchEndDate: string | null | undefined, billingMonth: string): boolean {
  if (!batchEndDate || !batchEndDate.trim()) return false;

  const monthStartIso = getBillingMonthStartIso(billingMonth);
  if (!monthStartIso) return false;

  const trimmedEnd = batchEndDate.trim().split('T')[0];
  let endIso = trimmedEnd;
  if (/^\d{4}-\d{2}$/.test(trimmedEnd)) {
    endIso = `${trimmedEnd}-31`;
  }
  return endIso < monthStartIso;
}


export class InMemoryDataStore implements IDataStore {
  private tenants: Map<string, Tenant> = new Map();
  private users: Map<string, User> = new Map();
  private otps: StoredOTP[] = [];

  // Phase 2 Collections
  private programs: AcademicProgram[] = [];
  private subjects: Subject[] = [];
  private subjectGroups: SubjectGroup[] = [];
  private batches: Batch[] = [];
  private customFields: CustomFieldDefinition[] = [];
  private inquiries: StudentInquiry[] = [];
  private students: Student[] = [];

  // Phase 3 Collections
  private rooms: Room[] = [];
  private timetableSlots: TimetableSlot[] = [];
  private studentAttendance: StudentAttendanceRecord[] = [];
  private attendanceAuditLogs: AttendanceAuditLog[] = [];
  private leaveApplications: LeaveApplication[] = [];
  private staffLeaves: StaffLeaveRecord[] = [];
  private geofenceConfigs: Map<string, CampusGeofenceConfig> = new Map();
  private staffAttendance: StaffAttendanceRecord[] = [];
  private staffAttendanceAuditLogs: StaffAttendanceAuditLog[] = [];
  private staffRegularizationRequests: StaffRegularizationRequest[] = [];
  private homeworkAssignments: HomeworkAssignment[] = [];
  private notebookChecks: NotebookCheckRecord[] = [];
  private complaints: ComplaintTicket[] = [];

  // Phase 4 Collections
  private feeHeads: FeeHead[] = [];
  private feePriorityConfigs: Map<string, FeePriorityConfig> = new Map();
  private feeStructures: StudentFeeStructure[] = [];
  private invoices: StudentInvoice[] = [];
  private feePayments: FeePayment[] = [];
  private feeDiscounts: FeeDiscount[] = [];
  private accountHeads: AccountHead[] = [];
  private financialTransactions: FinancialTransaction[] = [];
  private staffSalaryProfiles: StaffSalaryProfile[] = [];
  private staffPayslips: StaffPayslip[] = [];

  // Phase 5 Collections
  private questionChapters: QuestionChapter[] = [];
  private bankQuestions: BankQuestion[] = [];
  private exams: Exam[] = [];
  private examQuestions: ExamQuestion[] = [];
  private studentExamEvaluations: StudentExamEvaluation[] = [];

  // Phase 6 Collections
  private whatsappTemplates: WhatsAppTemplate[] = [];
  private whatsappAuditLogs: WhatsAppAuditLog[] = [];
  private feeAuditLogs: any[] = [];
  private absenteeFollowups: AbsenteeFollowupItem[] = [];
  private retentionCases: RetentionCounselingCase[] = [];

  // Phase 7 & 8 SaaS Collections
  private platformBankingConfig: PlatformBankingConfig;
  private platformGlobalConfig: PlatformGlobalConfig;
  private subscriptionReceipts: SubscriptionPaymentReceipt[] = [];
  private tenantAliases: TenantSlugAlias[] = [];
  private announcements: PlatformAnnouncement[] = [];
  private announcementReceipts: AnnouncementReadReceipt[] = [];

  constructor() {
    // Platform Configuration Defaults
    this.platformGlobalConfig = {
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
      instructions: 'Please transfer your subscription fee via online banking / Raast / ATM and upload the screenshot with transaction reference number for immediate automated activation.',
      updated_at: new Date().toISOString()
    };

    this.platformBankingConfig = {
      id: this.platformGlobalConfig.id,
      bank_name: this.platformGlobalConfig.bank_name,
      account_title: this.platformGlobalConfig.account_title,
      account_number: this.platformGlobalConfig.account_number,
      iban: this.platformGlobalConfig.iban,
      branch_code: this.platformGlobalConfig.branch_code,
      whatsapp_support: this.platformGlobalConfig.whatsapp_support,
      support_email: this.platformGlobalConfig.support_email,
      monthly_subscription_fee: this.platformGlobalConfig.monthly_subscription_fee,
      instructions: this.platformGlobalConfig.instructions || '',
      updated_at: this.platformGlobalConfig.updated_at
    };

    if (process.env.NODE_ENV === 'test') {
      this.announcements.push({
        id: 'ann-default-01',
        title: 'Institutional ERP Platform Online',
        message: 'Welcome to Kampus Academy Management System. Core modules for Academic Structure, Attendance, Fee Ledgers, and Examinations are active.',
        type: 'system',
        frequency: 'once_dismissible',
        target_audience: 'all',
        target_tenant_id: null,
        is_active: true,
        action_label: 'Acknowledge',
        action_url: null,
        created_at: new Date().toISOString()
      });
    }

    this.seedPlatformOperator();
    this.seedDemoAcademy();
    this.seedTestData();

    if (persistenceEnabled()) {
      this.persistTimer = setInterval(() => {
        this.persistQueued = true;
        void this.flushPersist();
      }, 10000);
      if (typeof this.persistTimer.unref === 'function') this.persistTimer.unref();
    }
  }

  private persistTimer: ReturnType<typeof setInterval> | null = null;
  private persistQueued = false;
  private persisting = false;
  private persistAllowed = false;

  private snapshotState(): Record<string, unknown> {
    return {
      tenants: [...this.tenants.entries()],
      users: [...this.users.entries()],
      otps: this.otps,
      programs: this.programs,
      subjects: this.subjects,
      subjectGroups: this.subjectGroups,
      batches: this.batches,
      customFields: this.customFields,
      inquiries: this.inquiries,
      students: this.students,
      rooms: this.rooms,
      timetableSlots: this.timetableSlots,
      studentAttendance: this.studentAttendance,
      attendanceAuditLogs: this.attendanceAuditLogs,
      leaveApplications: this.leaveApplications,
      staffLeaves: this.staffLeaves,
      geofenceConfigs: [...this.geofenceConfigs.entries()],
      staffAttendance: this.staffAttendance,
      staffAttendanceAuditLogs: this.staffAttendanceAuditLogs,
      staffRegularizationRequests: this.staffRegularizationRequests,
      homeworkAssignments: this.homeworkAssignments,
      notebookChecks: this.notebookChecks,
      complaints: this.complaints,
      feeHeads: this.feeHeads,
      feePriorityConfigs: [...this.feePriorityConfigs.entries()],
      feeStructures: this.feeStructures,
      invoices: this.invoices,
      feePayments: this.feePayments,
      feeDiscounts: this.feeDiscounts,
      accountHeads: this.accountHeads,
      financialTransactions: this.financialTransactions,
      staffSalaryProfiles: this.staffSalaryProfiles,
      staffPayslips: this.staffPayslips,
      questionChapters: this.questionChapters,
      bankQuestions: this.bankQuestions,
      exams: this.exams,
      examQuestions: this.examQuestions,
      studentExamEvaluations: this.studentExamEvaluations,
      whatsappTemplates: this.whatsappTemplates,
      whatsappAuditLogs: this.whatsappAuditLogs,
      feeAuditLogs: this.feeAuditLogs,
      absenteeFollowups: this.absenteeFollowups,
      retentionCases: this.retentionCases,
      platformBankingConfig: this.platformBankingConfig,
      platformGlobalConfig: this.platformGlobalConfig,
      subscriptionReceipts: this.subscriptionReceipts,
      tenantAliases: this.tenantAliases,
      announcements: this.announcements,
      announcementReceipts: this.announcementReceipts,
    };
  }

  private applySnapshot(payload: Record<string, unknown>): void {
    const asEntries = <K, V>(value: unknown): [K, V][] => (Array.isArray(value) ? (value as [K, V][]) : []);
    const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

    if (payload.tenants) {
      for (const [k, v] of asEntries<string, Tenant>(payload.tenants)) {
        if (v && (v.slug === 'tsa' || v.name === 'The Smart Academy') && !v.settings?.logo_url) {
          v.settings = { ...v.settings, logo_url: '/tsa-logo.png' } as any;
        }
        this.tenants.set(k, v);
      }
    }
    if (payload.users) {
      for (const [k, v] of asEntries<string, User>(payload.users)) {
        this.users.set(k, v);
      }
    }
    if (payload.otps) this.otps = asArray(payload.otps);
    if (payload.programs) {
      for (const p of asArray<any>(payload.programs)) {
        if (!this.programs.some(existing => existing.id === p.id)) this.programs.push(p);
      }
    }
    if (payload.subjects) {
      for (const s of asArray<any>(payload.subjects)) {
        if (!this.subjects.some(existing => existing.id === s.id)) this.subjects.push(s);
      }
    }
    if (payload.subjectGroups) {
      for (const sg of asArray<any>(payload.subjectGroups)) {
        if (!this.subjectGroups.some(existing => existing.id === sg.id)) this.subjectGroups.push(sg);
      }
    }
    if (payload.batches) {
      for (const b of asArray<any>(payload.batches)) {
        if (!b.cohort_type) {
          b.cohort_type = b.name && /section/i.test(b.name) ? 'section' : 'batch';
        }
        if (!this.batches.some(existing => existing.id === b.id)) this.batches.push(b);
      }
    }
    if (payload.customFields) this.customFields = asArray(payload.customFields);
    if (payload.inquiries) this.inquiries = asArray(payload.inquiries);
    if (payload.students) {
      for (const s of asArray<Student>(payload.students)) {
        const idx = this.students.findIndex(existing => existing.id === s.id);
        if (idx >= 0) {
          this.students[idx] = s;
        } else {
          this.students.push(s);
        }
      }
    }
    if (payload.rooms) {
      for (const r of asArray<any>(payload.rooms)) {
        if (!this.rooms.some(existing => existing.id === r.id)) this.rooms.push(r);
      }
    }
    if (payload.timetableSlots) this.timetableSlots = asArray(payload.timetableSlots);
    if (payload.studentAttendance) this.studentAttendance = asArray(payload.studentAttendance);
    if (payload.attendanceAuditLogs) this.attendanceAuditLogs = asArray(payload.attendanceAuditLogs);
    if (payload.leaveApplications) this.leaveApplications = asArray(payload.leaveApplications);
    if (payload.staffLeaves) this.staffLeaves = asArray(payload.staffLeaves);
    if (payload.geofenceConfigs) this.geofenceConfigs = new Map(asEntries(payload.geofenceConfigs));
    if (payload.staffAttendance) {
      this.staffAttendance = asArray(payload.staffAttendance);
      this.sanitizeStaffAttendance();
    }
    if (payload.staffAttendanceAuditLogs) this.staffAttendanceAuditLogs = asArray(payload.staffAttendanceAuditLogs);
    if (payload.staffRegularizationRequests) this.staffRegularizationRequests = asArray(payload.staffRegularizationRequests);
    if (payload.homeworkAssignments) this.homeworkAssignments = asArray(payload.homeworkAssignments);
    if (payload.notebookChecks) this.notebookChecks = asArray(payload.notebookChecks);
    if (payload.complaints) this.complaints = asArray(payload.complaints);
    // Empty catalog arrays are a persist bug (audit generated a PKR 0 challan, then
    // snapshot wrote feeHeads: []). Never clobber seed/defaults with an empty list.
    const takeIfNonEmpty = <T>(value: unknown, current: T[]): T[] => {
      if (!Array.isArray(value) || value.length === 0) return current;
      return value as T[];
    };
    const mergeById = <T extends { id: string }>(incoming: unknown, current: T[]): T[] => {
      if (!Array.isArray(incoming)) return current;
      const map = new Map(current.map(item => [item.id, item]));
      for (const item of incoming as T[]) {
        if (item && item.id) map.set(item.id, item);
      }
      return [...map.values()];
    };
    this.feeHeads = takeIfNonEmpty(payload.feeHeads, this.feeHeads);
    if (Array.isArray(payload.feePriorityConfigs) && payload.feePriorityConfigs.length > 0) {
      this.feePriorityConfigs = new Map(asEntries(payload.feePriorityConfigs));
    }
    this.feeStructures = takeIfNonEmpty(payload.feeStructures, this.feeStructures);
    if (payload.invoices) this.invoices = asArray(payload.invoices);
    if (payload.feePayments) this.feePayments = asArray(payload.feePayments);
    if (payload.feeDiscounts) this.feeDiscounts = asArray(payload.feeDiscounts);
    this.accountHeads = takeIfNonEmpty(payload.accountHeads, this.accountHeads);
    if (payload.financialTransactions) this.financialTransactions = asArray(payload.financialTransactions);
    this.staffSalaryProfiles = mergeById(payload.staffSalaryProfiles, this.staffSalaryProfiles);
    if (payload.staffPayslips) this.staffPayslips = asArray(payload.staffPayslips);
    if (payload.questionChapters) this.questionChapters = asArray(payload.questionChapters);
    if (payload.bankQuestions) this.bankQuestions = asArray(payload.bankQuestions);
    if (payload.exams) this.exams = asArray(payload.exams);
    if (payload.examQuestions) this.examQuestions = asArray(payload.examQuestions);
    if (payload.studentExamEvaluations) this.studentExamEvaluations = asArray(payload.studentExamEvaluations);
    if (payload.whatsappTemplates) this.whatsappTemplates = asArray(payload.whatsappTemplates);
    if (payload.whatsappAuditLogs) this.whatsappAuditLogs = asArray(payload.whatsappAuditLogs);
    if (payload.feeAuditLogs) this.feeAuditLogs = asArray(payload.feeAuditLogs);
    if (payload.absenteeFollowups) this.absenteeFollowups = asArray(payload.absenteeFollowups);
    if (payload.retentionCases) this.retentionCases = asArray(payload.retentionCases);
    if (payload.platformBankingConfig) this.platformBankingConfig = payload.platformBankingConfig as PlatformBankingConfig;
    if (payload.platformGlobalConfig) this.platformGlobalConfig = payload.platformGlobalConfig as PlatformGlobalConfig;
    if (payload.subscriptionReceipts) this.subscriptionReceipts = asArray(payload.subscriptionReceipts);
    if (payload.tenantAliases) this.tenantAliases = asArray(payload.tenantAliases);
    if (payload.announcements) this.announcements = asArray(payload.announcements);
    if (payload.announcementReceipts) this.announcementReceipts = asArray(payload.announcementReceipts);
  }

  /** Restore fee heads / class fees when a snapshot wiped the catalog. */
  private ensureDefaultFeeCatalog(tenantId: string): void {
    const now = new Date().toISOString();
    const existingHeads = this.feeHeads.filter(h => h.tenant_id === tenantId);
    if (existingHeads.length === 0) {
      const defaults: Array<{ code: string; name: string; amount: number; order: number; admission: boolean; system: boolean }> = [
        { code: 'ARREARS', name: 'Previous Arrears', amount: 0, order: 1, admission: false, system: true },
        { code: 'TUITION', name: 'Monthly Tuition Fee', amount: 8000, order: 2, admission: true, system: true },
        { code: 'ANNUAL', name: 'Annual Development Charges', amount: 2000, order: 3, admission: false, system: false },
        { code: 'EXAM', name: 'Examination & Assessment Fee', amount: 2500, order: 4, admission: false, system: false },
        { code: 'LAB', name: 'Science & Computer Lab Fee', amount: 1500, order: 5, admission: false, system: false },
        { code: 'ADMISSION', name: 'One-Time Admission Fee', amount: 10000, order: 6, admission: true, system: false },
      ];
      const created = defaults.map(d => ({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        name: d.name,
        code: d.code,
        is_system_default: d.system,
        default_amount: d.amount,
        priority_order: d.order,
        show_at_admission: d.admission,
        created_at: now,
      }));
      this.feeHeads.push(...created);
      if (!this.feePriorityConfigs.has(tenantId)) {
        this.feePriorityConfigs.set(tenantId, {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          priority_order: created.map(h => h.id),
          updated_at: now,
        });
      }
    }

    const tenant = this.tenants.get(tenantId);
    const isTSA = tenantId === '1944a64d-41f8-42e1-ada7-fb1bfd7d6e75' || tenant?.slug === 'tsa';
    if (isTSA && !this.feeHeads.some(h => h.tenant_id === tenantId && (h.name.toLowerCase() === 'asd' || h.code === 'ASD'))) {
      this.feeHeads.push({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        name: 'asd',
        code: 'ASD',
        is_system_default: false,
        default_amount: 2500,
        priority_order: 7,
        show_at_admission: true,
        created_at: now,
      });
    }

    if (!this.accountHeads.some(h => h.tenant_id === tenantId)) {
      this.accountHeads.push(
        { id: crypto.randomUUID(), tenant_id: tenantId, code: 'REV-01', name: 'Student Tuition Revenue', type: 'income', is_active: true, created_at: now },
        { id: crypto.randomUUID(), tenant_id: tenantId, code: 'EXP-01', name: 'Faculty & Staff Salaries', type: 'expense', is_active: true, created_at: now },
        { id: crypto.randomUUID(), tenant_id: tenantId, code: 'EXP-02', name: 'Campus Utilities & Electricity', type: 'expense', is_active: true, created_at: now },
        { id: crypto.randomUUID(), tenant_id: tenantId, code: 'EXP-03', name: 'Campus Facility Rent', type: 'expense', is_active: true, created_at: now },
        { id: crypto.randomUUID(), tenant_id: tenantId, code: 'EXP-04', name: 'Office & Academic Supplies', type: 'expense', is_active: true, created_at: now },
      );
    }

    const tenantHeads = this.feeHeads.filter(h => h.tenant_id === tenantId);
    const headsByName = new Map(tenantHeads.map(h => [h.name.toLowerCase(), h]));
    for (const fs of this.feeStructures.filter(s => s.tenant_id === tenantId)) {
      fs.items = (fs.items || []).map(it => {
        const matched = tenantHeads.find(h => h.id === it.fee_head_id)
          || (it.head_name ? headsByName.get(String(it.head_name).toLowerCase()) : undefined);
        if (!matched) return it;
        return { ...it, fee_head_id: matched.id, head_name: matched.name };
      });
    }

    for (const inv of this.invoices) {
      if (inv.tenant_id !== tenantId) continue;
      if (inv.status !== 'unpaid' && inv.status !== 'UNPAID' && inv.status !== 'partially_paid' && inv.status !== 'PARTIAL') continue;
      const net = Number(inv.net_amount ?? inv.net_total ?? 0);
      if (net > 0 && Array.isArray(inv.items) && inv.items.length > 0) continue;
      inv.status = 'cancelled';
      inv.balance_amount = 0;
      inv.balance_due = 0;
      inv.notes = [inv.notes, 'Cancelled: empty challan with no billable heads.'].filter(Boolean).join(' ');
      inv.updated_at = now;
    }
  }

  /** Restore / provision foundational academic catalog (subjects, starter class, section) when empty. */
  private ensureDefaultAcademicCatalog(tenantId: string): void {
    const tenant = this.tenants.get(tenantId);
    if (!tenant || tenant.settings?.is_platform) return;

    const now = new Date().toISOString();
    const isTSA = tenantId === '1944a64d-41f8-42e1-ada7-fb1bfd7d6e75' || tenant.slug === 'tsa';

    if (isTSA) {
      // 1. Ensure TSA has the authentic 14 subjects from user's setup
      const tsaSubjectsList = [
        { name: 'URDU', code: 'SUB', is_core: true },
        { name: 'ENGLISH', code: '2', is_core: true },
        { name: 'Math', code: '1', is_core: true },
        { name: 'Physics', code: 'PHY', is_core: true },
        { name: 'Chemistry', code: 'CHM', is_core: true },
        { name: 'Biology', code: 'BIO', is_core: true },
        { name: 'Computer Science', code: 'CS', is_core: true },
        { name: 'Islamiyat', code: 'ISL', is_core: true },
        { name: 'Pakistan Studies', code: 'PST', is_core: true },
        { name: 'General Science', code: 'SCI', is_core: false },
        { name: 'Social Studies', code: 'SST', is_core: false },
        { name: 'Arabic', code: 'ARA', is_core: false },
        { name: 'Tarjuma-tul-Quran', code: 'TQ', is_core: false },
        { name: 'Art & Drawing', code: 'ART', is_core: false },
      ];

      for (const ds of tsaSubjectsList) {
        const existing = this.subjects.find(
          s => s.tenant_id === tenantId && (
            s.name.toLowerCase() === ds.name.toLowerCase() ||
            (s.code && ds.code && s.code.toLowerCase() === ds.code.toLowerCase())
          )
        );
        if (!existing) {
          this.subjects.push({
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            name: ds.name,
            code: ds.code,
            is_core: ds.is_core,
            created_at: now,
          });
        } else {
          if (ds.code === 'SUB' && existing.name.toUpperCase() === 'URDU') existing.code = 'SUB';
          if (ds.code === '2' && existing.name.toUpperCase() === 'ENGLISH') existing.code = '2';
          if (ds.code === '1' && existing.name.toUpperCase() === 'MATH') existing.code = '1';
        }
      }

      // 2. Check TSA classes: authentic classes are '7th', '1', '2'
      const existingTSAPrograms = this.programs.filter(p => p.tenant_id === tenantId);
      const has7th = existingTSAPrograms.some(p => p.name.trim() === '7th');
      const onlyHasDummyMatric = existingTSAPrograms.length === 1 && existingTSAPrograms[0].name.includes('Class 10');

      if (!has7th || onlyHasDummyMatric) {
        if (onlyHasDummyMatric) {
          const dummyId = existingTSAPrograms[0].id;
          this.programs = this.programs.filter(p => p.id !== dummyId);
          this.batches = this.batches.filter(b => b.program_id !== dummyId);
          this.subjectGroups = this.subjectGroups.filter(g => g.program_id !== dummyId);
        }

        const heads = this.feeHeads.filter(h => h.tenant_id === tenantId);
        const tuitionHead = heads.find(h => h.code === 'TUITION');
        const admHead = heads.find(h => h.code === 'ADMISSION');
        const asdHead = heads.find(h => h.code === 'ASD' || h.name.toLowerCase() === 'asd');

        const fee_schedule: any[] = [];
        if (tuitionHead) {
          fee_schedule.push({
            fee_head_id: tuitionHead.id,
            head_name: tuitionHead.name,
            fee_type: 'tuition',
            name: tuitionHead.name,
            amount: 5000,
            is_monthly: true,
            is_recurring: true,
          });
        }
        if (admHead) {
          fee_schedule.push({
            fee_head_id: admHead.id,
            head_name: admHead.name,
            fee_type: 'admission',
            name: admHead.name,
            amount: 10000,
            is_monthly: false,
            is_recurring: false,
          });
        }
        if (asdHead) {
          fee_schedule.push({
            fee_head_id: asdHead.id,
            head_name: asdHead.name,
            fee_type: 'custom',
            name: asdHead.name,
            amount: 2500,
            is_monthly: false,
            is_recurring: false,
          });
        }

        // Program 1: '7th'
        const prog7th: AcademicProgram = {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          name: '7th',
          code: '7th',
          description: 'Class 7',
          sort_order: 1,
          fee_schedule,
          created_at: now,
          updated_at: now,
        };
        this.programs.push(prog7th);

        // Program 2: '1'
        const prog1: AcademicProgram = {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          name: '1',
          code: '1',
          description: 'Class 1',
          sort_order: 2,
          fee_schedule,
          created_at: now,
          updated_at: now,
        };
        this.programs.push(prog1);

        // Program 3: '2'
        const prog2: AcademicProgram = {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          name: '2',
          code: '2',
          description: 'Class 2',
          sort_order: 3,
          fee_schedule,
          created_at: now,
          updated_at: now,
        };
        this.programs.push(prog2);

        // Class Subjects for 7th: URDU, ENGLISH, Math
        const currentSubs = this.subjects.filter(s => s.tenant_id === tenantId);
        const urduSub = currentSubs.find(s => s.name.toUpperCase().includes('URDU'));
        const engSub = currentSubs.find(s => s.name.toUpperCase().includes('ENG'));
        const mathSub = currentSubs.find(s => s.name.toUpperCase().includes('MATH'));
        const compSubIds = [urduSub?.id, engSub?.id, mathSub?.id].filter(Boolean) as string[];

        if (compSubIds.length > 0) {
          this.subjectGroups.push({
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            program_id: prog7th.id,
            name: 'Class Subjects',
            type: 'compulsory',
            subject_ids: compSubIds,
            created_at: now,
          });
        }

        // Section for 7th: Section A (Capacity 40, Occupancy 1/40)
        const secA: Batch = {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          program_id: prog7th.id,
          name: 'Section A',
          cohort_type: 'section',
          shift: 'morning',
          start_time: '08:00 AM',
          end_time: '01:30 PM',
          room_number: 'Room 1',
          academic_session: tenant.settings?.academic_session || '2026-2027',
          max_capacity: 40,
          current_enrollment: 1,
          created_at: now,
          updated_at: now,
        };
        this.batches.push(secA);

        // Relink student Ameer Syed to 7th & Section A
        const ameer = this.students.find(s => s.tenant_id === tenantId && s.full_name.includes('Ameer'));
        if (ameer) {
          ameer.program_id = prog7th.id;
          ameer.batch_id = secA.id;
          ameer.subjects = [...compSubIds];
          ameer.updated_at = now;
        }
      }
      return;
    }

    // 1. Ensure core foundational subjects exist
    const tenantSubjects = this.subjects.filter(s => s.tenant_id === tenantId);
    if (tenantSubjects.length === 0) {
      const defaultSubjectsList = [
        { name: 'English', code: 'ENG', is_core: true },
        { name: 'Urdu', code: 'URD', is_core: true },
        { name: 'Mathematics', code: 'MTH', is_core: true },
        { name: 'Physics', code: 'PHY', is_core: true },
        { name: 'Chemistry', code: 'CHM', is_core: true },
        { name: 'Biology', code: 'BIO', is_core: true },
        { name: 'Computer Science', code: 'CS', is_core: true },
        { name: 'Islamiyat', code: 'ISL', is_core: true },
        { name: 'Pakistan Studies', code: 'PST', is_core: true },
      ];
      for (const ds of defaultSubjectsList) {
        this.subjects.push({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          name: ds.name,
          code: ds.code,
          is_core: ds.is_core,
          created_at: now,
        });
      }
    }

    // 2. Ensure at least one academic class/program exists
    const tenantPrograms = this.programs.filter(p => p.tenant_id === tenantId);
    if (tenantPrograms.length === 0) {
      // Find fee heads for baseline
      const heads = this.feeHeads.filter(h => h.tenant_id === tenantId);
      const tuitionHead = heads.find(h => h.code === 'TUITION');
      const admHead = heads.find(h => h.code === 'ADMISSION');

      const fee_schedule: any[] = [];
      if (tuitionHead) {
        fee_schedule.push({
          fee_head_id: tuitionHead.id,
          head_name: tuitionHead.name,
          fee_type: 'tuition',
          name: tuitionHead.name,
          amount: tuitionHead.default_amount || 5000,
          is_monthly: true,
          is_recurring: true,
        });
      }
      if (admHead) {
        fee_schedule.push({
          fee_head_id: admHead.id,
          head_name: admHead.name,
          fee_type: 'admission',
          name: admHead.name,
          amount: admHead.default_amount || 5000,
          is_monthly: false,
          is_recurring: false,
        });
      }

      const starterProg: AcademicProgram = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        name: 'Class 10 - Matric',
        code: 'MATRIC-10',
        description: 'Secondary School Certificate (Matriculation)',
        sort_order: 1,
        fee_schedule,
        created_at: now,
        updated_at: now,
      };
      this.programs.push(starterProg);

      // Create Compulsory Subject Group
      const currentSubs = this.subjects.filter(s => s.tenant_id === tenantId);
      const compCodes = ['ENG', 'URD', 'ISL', 'PST'];
      const compSubIds = currentSubs.filter(s => compCodes.includes(s.code || '')).map(s => s.id);
      if (compSubIds.length > 0) {
        this.subjectGroups.push({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          program_id: starterProg.id,
          name: 'Compulsory Core Group',
          type: 'compulsory',
          subject_ids: compSubIds,
          created_at: now,
        });
      }

      // Create Elective Groups (Pre-Medical & Computer Science)
      const medCodes = ['PHY', 'CHM', 'BIO'];
      const medSubIds = currentSubs.filter(s => medCodes.includes(s.code || '')).map(s => s.id);
      if (medSubIds.length > 0) {
        this.subjectGroups.push({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          program_id: starterProg.id,
          name: 'Science (Pre-Medical)',
          type: 'elective_track',
          subject_ids: medSubIds,
          created_at: now,
        });
      }

      const csCodes = ['PHY', 'MTH', 'CS'];
      const csSubIds = currentSubs.filter(s => csCodes.includes(s.code || '')).map(s => s.id);
      if (csSubIds.length > 0) {
        this.subjectGroups.push({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          program_id: starterProg.id,
          name: 'Science (Computer Science)',
          type: 'elective_track',
          subject_ids: csSubIds,
          created_at: now,
        });
      }

      // Create a default Class Section
      const secA: Batch = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        program_id: starterProg.id,
        name: 'Section A',
        cohort_type: 'section',
        shift: 'morning',
        start_time: '08:00 AM',
        end_time: '01:30 PM',
        room_number: 'Room 1',
        academic_session: tenant.settings?.academic_session || '2026-2027',
        max_capacity: 40,
        current_enrollment: 0,
        created_at: now,
        updated_at: now,
      };
      this.batches.push(secA);

      // Relink any students in this tenant that had dangling or cross-tenant program/batch IDs
      const tenantStudents = this.students.filter(s => s.tenant_id === tenantId);
      for (const s of tenantStudents) {
        if (!this.programs.some(p => p.tenant_id === tenantId && p.id === s.program_id)) {
          s.program_id = starterProg.id;
          s.batch_id = secA.id;
          s.subjects = compSubIds.concat(medSubIds.slice(0, 2));
          s.updated_at = now;
        }
      }
    }
  }

  async hydrateFromDatabase(): Promise<void> {
    if (!persistenceEnabled()) return;
    try {
      const payload = await Promise.race([
        loadSnapshot(),
        new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('hydrate timed out')), 20000);
        }),
      ]);
      if (payload && Array.isArray(payload.tenants) && payload.tenants.length > 0) {
        this.applySnapshot(payload);
        for (const tenant of this.tenants.values()) {
          if (tenant.settings?.is_platform) continue;
          this.ensureDefaultFeeCatalog(tenant.id);
          this.ensureDefaultAcademicCatalog(tenant.id);
        }
        this.persistAllowed = true;
        this.persistQueued = true;
        console.log(`[Store] Restored snapshot with ${this.tenants.size} academies`);
        await this.flushPersist();
        return;
      }
      const existingCount = countRealAcademies(payload);
      if (existingCount > 0) {
        this.persistAllowed = false;
        console.error('[Store] Snapshot present with academies but failed to apply; refusing to persist seed');
        return;
      }
      this.persistAllowed = true;
      for (const tenant of this.tenants.values()) {
        if (tenant.settings?.is_platform) continue;
        this.ensureDefaultFeeCatalog(tenant.id);
        this.ensureDefaultAcademicCatalog(tenant.id);
      }
      this.persistQueued = true;
      await this.flushPersist();
      console.log('[Store] No snapshot found; seeded state persisted');
    } catch (err) {
      this.persistAllowed = false;
      console.error('[Store] Failed to hydrate from database; RAM seed will NOT overwrite stored academies:', err);
    }
  }

  schedulePersist(): void {
    this.persistQueued = true;
    void this.flushPersist();
  }

  async flushPersist(): Promise<void> {
    if (!persistenceEnabled() || !this.persistAllowed || this.persisting || !this.persistQueued) return;
    this.persisting = true;
    this.persistQueued = false;
    try {
      await Promise.race([
        saveSnapshot(this.snapshotState()),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('persist timed out')), 20000);
        }),
      ]);
    } catch (err) {
      this.persistQueued = true;
      console.error('[Store] Failed to persist snapshot:', err);
    } finally {
      this.persisting = false;
    }
  }

  private isPlatformTenant(tenant: Tenant): boolean {
    return tenant.slug === 'app' || tenant.settings?.is_platform === true;
  }

  private seedPlatformOperator(): void {
    const platformTenant: Tenant = {
      id: 'p0000000-0000-0000-0000-000000000001',
      name: 'Kampus Platform',
      slug: 'app',
      domain: 'app.kampus.pk',
      status: 'active',
      tier: 'enterprise',
      max_students: 0,
      max_staff: 0,
      trial_ends_at: new Date(Date.now() + 86400000 * 3650).toISOString(),
      settings: {
        currency: 'PKR',
        timezone: 'Asia/Karachi',
        date_format: 'DD/MM/YYYY',
        academic_session: '2026-2027',
        campus_name: 'Platform',
        phone_country_code: '+92',
        is_platform: true,
        features: {
          mobile_pwa_enabled: true,
          whatsapp_rapid_queue: true,
          geofence_attendance: true,
        },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.tenants.set(platformTenant.id, platformTenant);
    this.users.set(`${platformTenant.id}:kampuserp@gmail.com`, {
      id: 'superadmin-0000-0000-0000-000000000001',
      tenant_id: platformTenant.id,
      email: 'kampuserp@gmail.com',
      full_name: 'Super Administrator',
      role: 'super_admin',
      status: 'active',
      password_hash: hashPassword('Aliadnan786@'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  private seedDemoAcademy(): void {
    const primaryTenant: Tenant = {
      id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Apex Academy Lahore',
      slug: 'apex',
      domain: 'apex.kampus.pk',
      status: 'active',
      tier: 'enterprise',
      max_students: 1200,
      max_staff: 80,
      trial_ends_at: new Date(Date.now() + 86400000 * 365).toISOString(),
      settings: {
        currency: 'PKR',
        timezone: 'Asia/Karachi',
        date_format: 'DD/MM/YYYY',
        academic_session: '2026-2027',
        campus_name: 'Main Campus',
        phone_country_code: '+92',
        features: {
          mobile_pwa_enabled: true,
          whatsapp_rapid_queue: true,
          geofence_attendance: true,
        },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.tenants.set(primaryTenant.id, primaryTenant);

    const defaultPasswordHash = hashPassword('Admin@123');
    const users: User[] = [
      {
        id: 'superadmin-0000-0000-0000-000000000001',
        tenant_id: primaryTenant.id,
        email: 'kampuserp@gmail.com',
        full_name: 'Super Administrator',
        role: 'super_admin',
        status: 'active',
        password_hash: hashPassword('Aliadnan786@'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'a1000000-0000-0000-0000-000000000001',
        tenant_id: primaryTenant.id,
        email: 'adnan@apexacademy.edu.pk',
        full_name: 'Campus Director',
        role: 'tenant_admin',
        status: 'active',
        password_hash: defaultPasswordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'a1000000-0000-0000-0000-000000000099',
        tenant_id: primaryTenant.id,
        email: 'admin@apex.edu.pk',
        full_name: 'Academy Administrator',
        role: 'tenant_admin',
        status: 'active',
        password_hash: defaultPasswordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    users.forEach(u => this.users.set(`${u.tenant_id}:${u.email.toLowerCase()}`, u));

    this.feeHeads.push(
      { id: 'fh-1', tenant_id: primaryTenant.id, name: 'Monthly Tuition Fee', code: 'TUITION', is_system_default: true, default_amount: 5000, priority_order: 1, show_at_admission: true, created_at: new Date().toISOString() },
      { id: 'fh-2', tenant_id: primaryTenant.id, name: 'Admission Fee', code: 'ADMISSION', is_system_default: true, default_amount: 10000, priority_order: 2, show_at_admission: true, created_at: new Date().toISOString() },
      { id: 'fh-3', tenant_id: primaryTenant.id, name: 'Examination Fee', code: 'EXAM', is_system_default: true, default_amount: 2500, priority_order: 3, show_at_admission: false, created_at: new Date().toISOString() },
      { id: 'fh-4', tenant_id: primaryTenant.id, name: 'Laboratory Charges', code: 'LAB', is_system_default: false, default_amount: 1500, priority_order: 4, show_at_admission: false, created_at: new Date().toISOString() },
      { id: 'fh-5', tenant_id: primaryTenant.id, name: 'Library & Activities Fee', code: 'LIBRARY', is_system_default: false, default_amount: 1000, priority_order: 5, show_at_admission: false, created_at: new Date().toISOString() },
    );
    this.accountHeads.push(
      { id: 'ah-1', tenant_id: primaryTenant.id, code: 'REV-01', name: 'Student Tuition Revenue', type: 'income', is_active: true, created_at: new Date().toISOString() },
      { id: 'ah-2', tenant_id: primaryTenant.id, code: 'EXP-01', name: 'Faculty & Staff Salaries', type: 'expense', is_active: true, created_at: new Date().toISOString() },
      { id: 'ah-3', tenant_id: primaryTenant.id, code: 'EXP-02', name: 'Campus Utilities & Electricity', type: 'expense', is_active: true, created_at: new Date().toISOString() },
      { id: 'ah-4', tenant_id: primaryTenant.id, code: 'EXP-03', name: 'Campus Facility Rent', type: 'expense', is_active: true, created_at: new Date().toISOString() },
      { id: 'ah-5', tenant_id: primaryTenant.id, code: 'EXP-04', name: 'Office & Academic Supplies', type: 'expense', is_active: true, created_at: new Date().toISOString() },
    );
  }

  private seedTestData() {
    const defaultPasswordHash = hashPassword('Admin@123');
    const tenantAId = 'a0000000-0000-0000-0000-000000000001';
    const tenantB: Tenant = {
      id: 'b0000000-0000-0000-0000-000000000002',
      name: 'Crescent Academy Karachi',
      slug: 'crescent',
      domain: 'crescent.edu.pk',
      status: 'locked',
      tier: 'starter',
      max_students: 300,
      max_staff: 25,
      trial_ends_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      settings: {
        currency: 'PKR',
        timezone: 'Asia/Karachi',
        date_format: 'DD/MM/YYYY',
        academic_session: '2026-2027',
        campus_name: 'Clifton Campus',
        phone_country_code: '+92',
        features: {
          mobile_pwa_enabled: false,
          whatsapp_rapid_queue: false,
          geofence_attendance: false,
        },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.tenants.set(tenantB.id, tenantB);

    const tenantTSA: Tenant = {
      id: '1944a64d-41f8-42e1-ada7-fb1bfd7d6e75',
      name: 'The Smart Academy',
      slug: 'tsa',
      domain: 'tsa.kampus.pk',
      status: 'active',
      tier: 'standard',
      max_students: 500,
      max_staff: 50,
      trial_ends_at: new Date(Date.now() + 86400000 * 365).toISOString(),
      settings: {
        currency: 'PKR',
        timezone: 'Asia/Karachi',
        date_format: 'DD/MM/YYYY',
        academic_session: '2026-2027',
        campus_name: 'Main Campus',
        phone_country_code: '+92',
        logo_url: '/tsa-logo.png',
        features: {
          mobile_pwa_enabled: true,
          whatsapp_rapid_queue: true,
          geofence_attendance: true,
        },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.tenants.set(tenantTSA.id, tenantTSA);

    const tsaProg7: AcademicProgram = {
      id: 'tsa-prog-7',
      tenant_id: tenantTSA.id,
      name: 'Class 7',
      code: '7TH',
      description: '',
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const tsaProg9: AcademicProgram = {
      id: 'tsa-prog-9',
      tenant_id: tenantTSA.id,
      name: 'Class 9',
      code: '9TH',
      description: '',
      sort_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const tsaProg10: AcademicProgram = {
      id: 'tsa-prog-10',
      tenant_id: tenantTSA.id,
      name: 'Class 10',
      code: '10TH',
      description: '',
      sort_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.programs.push(tsaProg7, tsaProg9, tsaProg10);

    const tsaBatchComp: Batch = {
      id: 'tsa-batch-computer',
      tenant_id: tenantTSA.id,
      program_id: tsaProg7.id,
      name: 'computer course',
      academic_session: '2026-2027',
      shift: 'morning',
      start_time: '08:00 AM',
      end_time: '01:30 PM',
      start_date: '2026-09-17',
      end_date: '2026-11-17',
      billing_mode: 'installment',
      fee_amount: 10000,
      max_capacity: 40,
      current_enrollment: 0,
      status: 'active',
      cohort_type: 'batch',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.batches.push(tsaBatchComp);

    this.subscriptionReceipts.push({
      id: 'sub-rec-1',
      tenant_id: tenantB.id,
      tenant_name: 'Crescent Academy Karachi',
      uploaded_by_user_id: 'b1000000-0000-0000-0000-000000000001',
      uploaded_by_email: 'admin@crescentacademy.edu.pk',
      amount: 15000,
      plan_duration_months: 1,
      payment_method: 'BANK_TRANSFER',
      reference_number: 'ALF-TRF-884920',
      receipt_image_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400',
      notes: 'Paid via Bank Alfalah Internet Banking to Kampus account. Please activate our account.',
      status: 'PENDING',
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 4).toISOString()
    });

    const testUsers: User[] = [
      {
        id: 'a1000000-0000-0000-0000-000000000001',
        tenant_id: tenantAId,
        email: 'adnan@apexacademy.edu.pk',
        full_name: 'Director Adnan',
        role: 'tenant_admin',
        status: 'active',
        password_hash: defaultPasswordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'a1000000-0000-0000-0000-000000000002',
        tenant_id: tenantAId,
        email: 'tariq@apexacademy.edu.pk',
        full_name: 'Sir Tariq Physics',
        role: 'teacher',
        status: 'active',
        password_hash: defaultPasswordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'a1000000-0000-0000-0000-000000000003',
        tenant_id: tenantAId,
        email: 'hamza@apexacademy.edu.pk',
        full_name: 'Sir Hamza Math',
        role: 'teacher',
        status: 'active',
        password_hash: defaultPasswordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'a1000000-0000-0000-0000-000000000004',
        tenant_id: tenantAId,
        email: 'ayesha@apexacademy.edu.pk',
        full_name: 'Dr. Ayesha Biology',
        role: 'teacher',
        status: 'active',
        password_hash: defaultPasswordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'a1000000-0000-0000-0000-000000000005',
        tenant_id: tenantAId,
        email: 'student@apexacademy.edu.pk',
        full_name: 'Muhammad Ali Raza (Student / Parent)',
        role: 'student',
        status: 'active',
        password_hash: defaultPasswordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'a1000000-0000-0000-0000-000000000006',
        tenant_id: tenantAId,
        email: 'kampuserp@gmail.com',
        full_name: 'Super Administrator',
        role: 'super_admin',
        status: 'active',
        password_hash: hashPassword('Aliadnan786@'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'b1000000-0000-0000-0000-000000000001',
        tenant_id: tenantB.id,
        email: 'admin@crescentacademy.edu.pk',
        full_name: 'Principal Crescent Academy',
        role: 'tenant_admin',
        status: 'active',
        password_hash: defaultPasswordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'b1000000-0000-0000-0000-000000000002',
        tenant_id: tenantB.id,
        email: 'fatima@crescent.edu.pk',
        full_name: 'Principal Fatima',
        role: 'tenant_admin',
        status: 'active',
        password_hash: defaultPasswordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'a1000000-0000-0000-0000-000000000007',
        tenant_id: tenantAId,
        email: 'parent.hamza@gmail.com',
        full_name: 'M. Hamza Guardian',
        role: 'parent',
        status: 'active',
        password_hash: defaultPasswordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '7be1003f-ccc7-4b69-bceb-1df21dc5d8b3',
        tenant_id: tenantTSA.id,
        email: 'amirpersonal135@gmail.com',
        full_name: 'Adnan',
        role: 'tenant_admin',
        status: 'active',
        password_hash: hashPassword('smart786'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '7be1003f-ccc7-4b69-bceb-1df21dc5d8b4',
        tenant_id: tenantTSA.id,
        email: 'amirpersonal136@gmail.com',
        full_name: 'Sir Adnan',
        role: 'teacher',
        status: 'active',
        password_hash: hashPassword('smart786'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    testUsers.forEach(u => this.users.set(`${u.tenant_id}:${u.email.toLowerCase()}`, u));

    const mdcatProg: AcademicProgram = {
      id: 'a2000000-0000-0000-0000-000000000001',
      tenant_id: tenantAId,
      name: 'MDCAT Comprehensive Prep',
      code: 'MDCAT-2026',
      description: 'Pre-Medical entrance preparation',
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const fscProg: AcademicProgram = {
      id: 'a2000000-0000-0000-0000-000000000002',
      tenant_id: tenantAId,
      name: 'FSc Pre-Engineering',
      code: 'FSC-ENG',
      description: 'Higher Secondary School Certificate in Pre-Engineering',
      sort_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const crescentProg: AcademicProgram = {
      id: 'b2000000-0000-0000-0000-000000000001',
      tenant_id: tenantB.id,
      name: 'O-Level Science Track',
      code: 'O-SCI',
      description: 'Cambridge O-Levels sciences',
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const class7Prog: AcademicProgram = {
      id: 'a2000000-0000-0000-0000-000000000007',
      tenant_id: tenantAId,
      name: 'Class 7',
      code: 'CLASS-7',
      description: '',
      sort_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.programs.push(mdcatProg, fscProg, crescentProg, class7Prog);

    const phySub: Subject = { id: 's1', tenant_id: tenantAId, name: 'Physics', code: 'PHY', is_core: true, created_at: new Date().toISOString() };
    const chmSub: Subject = { id: 's2', tenant_id: tenantAId, name: 'Chemistry', code: 'CHM', is_core: true, created_at: new Date().toISOString() };
    const bioSub: Subject = { id: 's3', tenant_id: tenantAId, name: 'Biology', code: 'BIO', is_core: true, created_at: new Date().toISOString() };
    const mthSub: Subject = { id: 's4', tenant_id: tenantAId, name: 'Mathematics', code: 'MTH', is_core: true, created_at: new Date().toISOString() };
    const engSub: Subject = { id: 's5', tenant_id: tenantAId, name: 'English', code: 'ENG', is_core: false, created_at: new Date().toISOString() };
    this.subjects.push(phySub, chmSub, bioSub, mthSub, engSub);

    const compGroup: SubjectGroup = {
      id: 'g1',
      tenant_id: tenantAId,
      program_id: mdcatProg.id,
      name: 'Core Medical Group',
      type: 'compulsory',
      subject_ids: [phySub.id, chmSub.id, bioSub.id],
      created_at: new Date().toISOString(),
    };
    const elecGroup: SubjectGroup = {
      id: 'g2',
      tenant_id: tenantAId,
      program_id: fscProg.id,
      name: 'Pre-Eng Elective Track',
      type: 'elective_track',
      subject_ids: [phySub.id, chmSub.id, mthSub.id],
      created_at: new Date().toISOString(),
    };
    this.subjectGroups.push(compGroup, elecGroup);

    const batchA: Batch = {
      id: 'a3000000-0000-0000-0000-000000000001',
      tenant_id: tenantAId,
      program_id: mdcatProg.id,
      name: 'Batch 2026-A',
      cohort_type: 'batch',
      shift: 'morning',
      start_time: '08:00 AM',
      end_time: '01:30 PM',
      start_date: '2026-08-01',
      end_date: '2027-05-31',
      billing_mode: 'monthly',
      fee_amount: 10000,
      room_number: 'Hall A',
      academic_session: '2026-2027',
      max_capacity: 50,
      current_enrollment: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const batchB: Batch = {
      id: 'a3000000-0000-0000-0000-000000000002',
      tenant_id: tenantAId,
      program_id: fscProg.id,
      name: 'FSc Morning - Alpha',
      cohort_type: 'batch',
      shift: 'morning',
      start_time: '08:00 AM',
      end_time: '01:30 PM',
      start_date: '2026-08-01',
      end_date: '2027-05-31',
      billing_mode: 'monthly',
      fee_amount: 8000,
      room_number: 'Room 102',
      academic_session: '2026-2027',
      max_capacity: 40,
      current_enrollment: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const batchClass7: Batch = {
      id: 'a3000000-0000-0000-0000-000000000007',
      tenant_id: tenantAId,
      program_id: class7Prog.id,
      name: 'Section A',
      cohort_type: 'section',
      shift: 'morning',
      start_time: '08:00 AM',
      end_time: '01:30 PM',
      start_date: '2026-08-01',
      end_date: '2027-05-31',
      billing_mode: 'monthly',
      fee_amount: 6000,
      room_number: 'Room 201',
      academic_session: '2026-2027',
      max_capacity: 40,
      current_enrollment: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const crescentBatch: Batch = {
      id: 'b3000000-0000-0000-0000-000000000001',
      tenant_id: tenantB.id,
      program_id: crescentProg.id,
      name: 'O-Levels Morning Section 1',
      cohort_type: 'section',
      shift: 'morning',
      start_time: '08:30 AM',
      end_time: '01:45 PM',
      start_date: '2026-08-01',
      end_date: '2027-05-31',
      billing_mode: 'monthly',
      fee_amount: 12000,
      room_number: 'Room 301',
      academic_session: '2026-2027',
      max_capacity: 30,
      current_enrollment: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.batches.push(batchA, batchB, batchClass7, crescentBatch);

    this.customFields.push(
      {
        id: 'cf-1',
        tenant_id: tenantAId,
        entity_type: 'student',
        field_key: 'blood_group',
        label: 'Blood Group',
        field_type: 'select',
        options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        is_required: false,
        sort_order: 1,
        created_at: new Date().toISOString(),
      },
      {
        id: 'cf-2',
        tenant_id: tenantAId,
        entity_type: 'student',
        field_key: 'transport_route',
        label: 'Bus Route',
        field_type: 'select',
        options: ['Route 1 - Main Campus', 'Route 2 - City Center', 'Self Commute'],
        is_required: false,
        sort_order: 2,
        created_at: new Date().toISOString(),
      },
      {
        id: 'cf-3',
        tenant_id: tenantAId,
        entity_type: 'student',
        field_key: 'previous_school',
        label: 'Previous School / Institution',
        field_type: 'text',
        is_required: false,
        sort_order: 3,
        created_at: new Date().toISOString(),
      }
    );

    this.inquiries.push({
      id: 'inq-1',
      tenant_id: tenantAId,
      inquiry_number: 'INQ-2026-001',
      student_name: 'Usman Farooq',
      phone: '+923001234567',
      email: 'usman@gmail.com',
      guardian_name: 'Farooq Ahmed',
      guardian_phone: '+923009988771',
      program_id: mdcatProg.id,
      source: 'Walk-in Campus Visit',
      stage: 'new',
      priority: 'high',
      notes: 'Interested in morning batch, requested fee discount discussion.',
      next_follow_up_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.students.push({
      id: 'stud-1',
      tenant_id: tenantAId,
      user_id: 'a1000000-0000-0000-0000-000000000005',
      admission_number: 'ADM-2026-001',
      roll_number: 'A-101',
      full_name: 'Muhammad Ali Raza',
      email: 'student@apexacademy.edu.pk',
      phone: '+923001122334',
      guardian_name: 'Raza Ahmed',
      guardian_phone: '+923009876543',
      guardian_whatsapp: '+923009876543',
      guardian_id_card: '35201-1234567-1',
      blood_group: 'B+',
      program_id: mdcatProg.id,
      batch_id: batchA.id,
      elective_group_id: compGroup.id,
      status: 'active',
      custom_field_values: { emergency_phone: '+923009876543', blood_group: 'B+' },
      subjects: [phySub.id, chmSub.id, bioSub.id],
      admission_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.students.push({
      id: '8ff11bf7-72aa-4fd8-97e6-d51df58303b3',
      tenant_id: tenantTSA.id,
      admission_number: 'ADM-2026-001',
      roll_number: 'R-101',
      full_name: 'Ameer Syed',
      email: 'student.tsa@kampus.pk',
      phone: '03710929114',
      guardian_name: 'Bahadur Syed',
      guardian_phone: '03710929114',
      guardian_whatsapp: '03710929114',
      guardian_id_card: '35201-1234567-1',
      blood_group: 'O+',
      program_id: mdcatProg.id,
      batch_id: batchA.id,
      status: 'active',
      custom_field_values: {},
      subjects: [phySub.id, chmSub.id, bioSub.id],
      admission_date: '2026-09-10',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const room1: Room = { id: 'r1', tenant_id: tenantAId, name: 'Hall 1', capacity: 60, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const room2: Room = { id: 'r2', tenant_id: tenantAId, name: 'Room 204', capacity: 45, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const room3: Room = { id: 'r3', tenant_id: tenantAId, name: 'Physics Lab', capacity: 35, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.rooms.push(room1, room2, room3);

    const slot1: TimetableSlot = {
      id: 'slot-1',
      tenant_id: tenantAId,
      batch_id: batchA.id,
      subject_id: phySub.id,
      teacher_id: 'a1000000-0000-0000-0000-000000000002',
      teacher_name: 'Sir Tariq Physics',
      batch_name: 'Batch 2026-A',
      subject_name: 'Physics',
      room_id: 'r1',
      room_name: 'Hall 1',
      day_of_week: 'monday',
      start_time: '08:30',
      end_time: '09:45',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const slot2: TimetableSlot = {
      id: 'slot-2',
      tenant_id: tenantAId,
      batch_id: batchA.id,
      subject_id: bioSub.id,
      teacher_id: 'a1000000-0000-0000-0000-000000000004',
      teacher_name: 'Dr. Ayesha Biology',
      batch_name: 'Batch 2026-A',
      subject_name: 'Biology',
      room_id: 'r1',
      room_name: 'Hall 1',
      day_of_week: 'monday',
      start_time: '10:00',
      end_time: '11:15',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.timetableSlots.push(slot1, slot2);

    this.geofenceConfigs.set(tenantAId, {
      tenant_id: tenantAId,
      campus_name: 'Gulberg III Campus',
      latitude: 31.5204,
      longitude: 74.3587,
      radius_meters: 150,
      shift_start_time: '08:00:00',
      grace_period_minutes: 15,
      multi_room_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.geofenceConfigs.set(tenantB.id, {
      tenant_id: tenantB.id,
      campus_name: 'Clifton Campus',
      latitude: 24.8138,
      longitude: 67.0300,
      radius_meters: 100,
      shift_start_time: '08:30:00',
      grace_period_minutes: 10,
      multi_room_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const hw1: HomeworkAssignment = {
      id: 'hw-1',
      tenant_id: tenantAId,
      batch_id: batchA.id,
      batch_name: 'Batch 2026-A',
      subject_id: phySub.id,
      subject_name: 'Physics',
      teacher_id: 'a1000000-0000-0000-0000-000000000002',
      teacher_name: 'Sir Tariq Physics',
      title: 'Chapter 3: Vectors & Equilibrium Numerical Problems (1-8)',
      description: 'Solve textbook practice problems on your physical registered notebooks. Physical inspection in tomorrow’s first period.',
      assigned_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };
    this.homeworkAssignments.push(hw1);

    const comp1: ComplaintTicket = {
      id: 'comp-1',
      tenant_id: tenantAId,
      user_id: 'stud-1',
      user_name: 'Muhammad Ali Raza',
      category: 'facility',
      priority: 'normal',
      subject: 'Air Conditioner Cooling in Hall 1',
      description: 'The right side AC in Hall 1 has reduced cooling during midday sessions.',
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.complaints.push(comp1);

    this.studentAttendance.push(
      {
        id: 'att-seed-1',
        tenant_id: tenantAId,
        student_id: 'stud-1',
        student_name: 'Muhammad Ali Raza',
        roll_number: 'A-101',
        batch_id: batchA.id,
        date: '2026-09-05',
        status: 'present',
        check_in_time: '08:25 AM',
        remarks: 'Present on time',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'att-seed-2',
        tenant_id: tenantAId,
        student_id: 'stud-1',
        student_name: 'Muhammad Ali Raza',
        roll_number: 'A-101',
        batch_id: batchA.id,
        date: '2026-09-04',
        status: 'present',
        check_in_time: '08:28 AM',
        remarks: 'Present on time',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'att-seed-3',
        tenant_id: tenantAId,
        student_id: 'stud-1',
        student_name: 'Muhammad Ali Raza',
        roll_number: 'A-101',
        batch_id: batchA.id,
        date: '2026-09-03',
        status: 'late',
        check_in_time: '08:45 AM',
        remarks: 'Late arrival - 15m traffic delay',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'att-seed-4',
        tenant_id: tenantAId,
        student_id: 'stud-1',
        student_name: 'Muhammad Ali Raza',
        roll_number: 'A-101',
        batch_id: batchA.id,
        date: '2026-09-02',
        status: 'present',
        check_in_time: '08:20 AM',
        remarks: 'Present on time',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'att-seed-5',
        tenant_id: tenantAId,
        student_id: 'stud-1',
        student_name: 'Muhammad Ali Raza',
        roll_number: 'A-101',
        batch_id: batchA.id,
        date: '2026-09-01',
        status: 'absent',
        remarks: 'Medical leave submitted',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'att-seed-tsa-1',
        tenant_id: tenantTSA.id,
        student_id: '8ff11bf7-72aa-4fd8-97e6-d51df58303b3',
        student_name: 'Ameer Syed',
        roll_number: 'R-101',
        batch_id: batchA.id,
        date: '2026-09-05',
        status: 'present',
        check_in_time: '08:24 AM',
        remarks: 'Present on time',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'att-seed-tsa-2',
        tenant_id: tenantTSA.id,
        student_id: '8ff11bf7-72aa-4fd8-97e6-d51df58303b3',
        student_name: 'Ameer Syed',
        roll_number: 'R-101',
        batch_id: batchA.id,
        date: '2026-09-04',
        status: 'present',
        check_in_time: '08:27 AM',
        remarks: 'Present on time',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    );

    const headArrears: FeeHead = { id: 'head-arrears', tenant_id: tenantAId, name: 'Previous Arrears', code: 'ARREARS', is_system_default: true, default_amount: 0, priority_order: 1, show_at_admission: false, created_at: new Date().toISOString() };
    const headTuition: FeeHead = { id: 'head-tuition', tenant_id: tenantAId, name: 'Monthly Tuition Fee', code: 'TUITION', is_system_default: true, default_amount: 8000, priority_order: 2, show_at_admission: true, created_at: new Date().toISOString() };
    const headAnnual: FeeHead = { id: 'head-annual', tenant_id: tenantAId, name: 'Annual Development Charges', code: 'ANNUAL', is_system_default: true, default_amount: 5000, priority_order: 3, show_at_admission: false, created_at: new Date().toISOString() };
    const headExam: FeeHead = { id: 'head-exam', tenant_id: tenantAId, name: 'Examination & Assessment Fee', code: 'EXAM', is_system_default: true, default_amount: 2500, priority_order: 4, show_at_admission: false, created_at: new Date().toISOString() };
    const headLab: FeeHead = { id: 'head-lab', tenant_id: tenantAId, name: 'Science & Computer Lab Fee', code: 'LAB', is_system_default: true, default_amount: 1500, priority_order: 5, show_at_admission: false, created_at: new Date().toISOString() };
    const headAdmission: FeeHead = { id: 'head-admission', tenant_id: tenantAId, name: 'One-Time Admission Fee', code: 'ADMISSION', is_system_default: true, default_amount: 10000, priority_order: 6, show_at_admission: true, created_at: new Date().toISOString() };
    this.feeHeads.push(headArrears, headTuition, headAnnual, headExam, headLab, headAdmission);

    this.feePriorityConfigs.set(tenantAId, {
      id: 'prio-1',
      tenant_id: tenantAId,
      priority_order: [headArrears.id, headTuition.id, headAnnual.id, headExam.id, headLab.id, headAdmission.id],
      updated_at: new Date().toISOString()
    });

    this.feeStructures.push({
      id: 'fs-1',
      tenant_id: tenantAId,
      batch_id: batchA.id,
      academic_session: '2026-2027',
      items: [
        { fee_head_id: headTuition.id, head_name: headTuition.name, amount: 8000 },
        { fee_head_id: headAnnual.id, head_name: headAnnual.name, amount: 2000 },
        { fee_head_id: headLab.id, head_name: headLab.name, amount: 1500 }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const invoice1: StudentInvoice = {
      id: 'inv-1',
      tenant_id: tenantAId,
      invoice_number: 'INV-2026-0001',
      student_id: 'stud-1',
      student_name: 'Muhammad Ali Raza',
      roll_number: 'A-101',
      batch_id: batchA.id,
      batch_name: 'MDCAT Morning - Batch A',
      billing_month: 'September 2026',
      issue_date: '2026-09-01',
      due_date: '2026-09-15',
      subtotal_amount: 11500,
      discount_amount: 0,
      net_amount: 11500,
      paid_amount: 0,
      balance_amount: 11500,
      status: 'unpaid',
      notes: 'Standard September challan with previous arrears carryover',
      items: [
        { id: 'item-1', invoice_id: 'inv-1', fee_head_id: headArrears.id, head_name: headArrears.name, head_code: headArrears.code, original_amount: 2000, discount_amount: 0, net_amount: 2000, paid_amount: 0, balance_due: 2000 },
        { id: 'item-2', invoice_id: 'inv-1', fee_head_id: headTuition.id, head_name: headTuition.name, head_code: headTuition.code, original_amount: 8000, discount_amount: 0, net_amount: 8000, paid_amount: 0, balance_due: 8000 },
        { id: 'item-3', invoice_id: 'inv-1', fee_head_id: headLab.id, head_name: headLab.name, head_code: headLab.code, original_amount: 1500, discount_amount: 0, net_amount: 1500, paid_amount: 0, balance_due: 1500 }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.invoices.push(invoice1);

    this.staffSalaryProfiles.push(
      {
        id: 'prof-1',
        tenant_id: tenantAId,
        staff_id: 'a1000000-0000-0000-0000-000000000002',
        staff_name: 'Sir Tariq Physics',
        designation: 'Senior Physics Faculty',
        contract_type: 'fixed_monthly',
        base_amount: 85000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'prof-2',
        tenant_id: tenantAId,
        staff_id: 'a1000000-0000-0000-0000-000000000001',
        staff_name: 'Campus Director',
        designation: 'Executive Director',
        contract_type: 'fixed_monthly',
        base_amount: 120000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    );

    this.staffPayslips.push({
      id: 'pay-1',
      tenant_id: tenantAId,
      slip_number: 'PAY-202608-0001',
      staff_id: 'a1000000-0000-0000-0000-000000000002',
      staff_name: 'Sir Tariq Physics',
      designation: 'Senior Physics Faculty',
      payroll_month: 'August 2026',
      base_salary: 85000,
      attendance_summary: {
        working_days: 26,
        present_days: 25,
        late_count: 1,
        absent_days: 0,
        approved_leaves: 1,
        hours_or_lectures: 48
      },
      earnings: [
        { id: 'earn-1', name: 'Overtime Lectures', quantity: 5, unit_rate: 1000, total: 5000 }
      ],
      deductions: [
        { id: 'ded-1', name: 'Late Arrival Penalty', quantity: 1, unit_rate: 1500, total: 1500 }
      ],
      total_earnings: 5000,
      total_deductions: 1500,
      net_salary: 88500,
      status: 'processed',
      admin_notes: 'Approved standard monthly settlement with 5 extra periods',
      processed_by: 'Finance Office',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const chap1: QuestionChapter = {
      id: 'chap-1',
      tenant_id: tenantAId,
      program_id: 'a2000000-0000-0000-0000-000000000001',
      program_name: 'F.Sc Pre-Engineering',
      subject_id: phySub.id,
      subject_name: 'Physics',
      chapter_number: 1,
      chapter_name: 'Vectors & Equilibrium',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const chap2: QuestionChapter = {
      id: 'chap-2',
      tenant_id: tenantAId,
      program_id: 'a2000000-0000-0000-0000-000000000001',
      program_name: 'F.Sc Pre-Engineering',
      subject_id: phySub.id,
      subject_name: 'Physics',
      chapter_number: 2,
      chapter_name: 'Force & Motion',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.questionChapters.push(chap1, chap2);

    const bq1: BankQuestion = {
      id: 'bq-1',
      tenant_id: tenantAId,
      chapter_id: chap1.id,
      subject_id: phySub.id,
      question_type: 'MCQ',
      question_text: 'If the cross product of two vectors A and B is zero, the vectors are:',
      marks: 2,
      options: [
        { key: 'A', text: 'Perpendicular to each other' },
        { key: 'B', text: 'Parallel or anti-parallel to each other' },
        { key: 'C', text: 'Equal in magnitude' },
        { key: 'D', text: 'Negative vectors' }
      ],
      correct_option: 'B',
      difficulty_level: 'EASY',
      is_quiz_bank: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const bq2: BankQuestion = {
      id: 'bq-2',
      tenant_id: tenantAId,
      chapter_id: chap1.id,
      subject_id: phySub.id,
      question_type: 'MCQ',
      question_text: 'The magnitude of the resultant of two mutually perpendicular forces 3N and 4N is:',
      marks: 2,
      options: [
        { key: 'A', text: '7 N' },
        { key: 'B', text: '1 N' },
        { key: 'C', text: '5 N' },
        { key: 'D', text: '12 N' }
      ],
      correct_option: 'C',
      difficulty_level: 'EASY',
      is_quiz_bank: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const bq3: BankQuestion = {
      id: 'bq-3',
      tenant_id: tenantAId,
      chapter_id: chap1.id,
      subject_id: phySub.id,
      question_type: 'MCQ',
      question_text: 'A body in rotational equilibrium must satisfy which condition?',
      marks: 2,
      options: [
        { key: 'A', text: 'Net torque Sigma Tau = 0' },
        { key: 'B', text: 'Net force Sigma F = 0' },
        { key: 'C', text: 'Velocity is zero' },
        { key: 'D', text: 'Constant acceleration' }
      ],
      correct_option: 'A',
      difficulty_level: 'MEDIUM',
      is_quiz_bank: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const bq4: BankQuestion = {
      id: 'bq-4',
      tenant_id: tenantAId,
      chapter_id: chap1.id,
      subject_id: phySub.id,
      question_type: 'SHORT',
      question_text: 'State the first and second conditions of complete mechanical equilibrium with standard equations.',
      marks: 6,
      rubric_guide: '1st condition Sigma F = 0 (3 marks), 2nd condition Sigma Tau = 0 (3 marks)',
      difficulty_level: 'MEDIUM',
      is_quiz_bank: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const bq5: BankQuestion = {
      id: 'bq-5',
      tenant_id: tenantAId,
      chapter_id: chap1.id,
      subject_id: phySub.id,
      question_type: 'SHORT',
      question_text: 'Differentiate between scalar product and vector product with one real physical application each.',
      marks: 6,
      rubric_guide: 'Scalar product definition + work example (3 marks), Vector product definition + torque example (3 marks)',
      difficulty_level: 'MEDIUM',
      is_quiz_bank: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const bq6: BankQuestion = {
      id: 'bq-6',
      tenant_id: tenantAId,
      chapter_id: chap1.id,
      subject_id: phySub.id,
      question_type: 'LONG',
      question_text: 'Resolve a vector into its two rectangular components. Show that A = sqrt(Ax^2 + Ay^2) and theta = arctan(Ay/Ax).',
      marks: 12,
      rubric_guide: 'Diagram labeled (3 marks), Resolution formulas (4 marks), Magnitude derivation (3 marks), Direction formula (2 marks)',
      difficulty_level: 'HARD',
      is_quiz_bank: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.bankQuestions.push(bq1, bq2, bq3, bq4, bq5, bq6);

    const exam1: Exam = {
      id: 'exam-1',
      tenant_id: tenantAId,
      batch_id: batchA.id,
      subject_id: phySub.id,
      title: 'MDCAT Physics Mid-Term Assessment 2026',
      exam_date: '2026-09-15',
      duration_minutes: 60,
      total_marks: 30,
      mcq_count: 3,
      mcq_marks_per_q: 2,
      mcq_total_marks: 6,
      short_total_marks: 12,
      long_total_marks: 12,
      section_labels: {
        mcq: 'Section A: Objective MCQs (Q.1)',
        short: 'Section B: Short Conceptual Questions (Q.2)',
        long: 'Section C: Long Problem & Derivations (Q.3)'
      },
      status: 'GRADED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.exams.push(exam1);

    const eq1: ExamQuestion = { id: 'eq-1', tenant_id: tenantAId, exam_id: exam1.id, question_id: bq1.id, section_type: 'MCQ', display_order: 1, question_text: bq1.question_text, marks: 2, options: bq1.options, correct_option: bq1.correct_option, created_at: new Date().toISOString() };
    const eq2: ExamQuestion = { id: 'eq-2', tenant_id: tenantAId, exam_id: exam1.id, question_id: bq2.id, section_type: 'MCQ', display_order: 2, question_text: bq2.question_text, marks: 2, options: bq2.options, correct_option: bq2.correct_option, created_at: new Date().toISOString() };
    const eq3: ExamQuestion = { id: 'eq-3', tenant_id: tenantAId, exam_id: exam1.id, question_id: bq3.id, section_type: 'MCQ', display_order: 3, question_text: bq3.question_text, marks: 2, options: bq3.options, correct_option: bq3.correct_option, created_at: new Date().toISOString() };
    const eq4: ExamQuestion = { id: 'eq-4', tenant_id: tenantAId, exam_id: exam1.id, question_id: bq4.id, section_type: 'SHORT', display_order: 4, question_text: bq4.question_text, marks: 6, created_at: new Date().toISOString() };
    const eq5: ExamQuestion = { id: 'eq-5', tenant_id: tenantAId, exam_id: exam1.id, question_id: bq5.id, section_type: 'SHORT', display_order: 5, question_text: bq5.question_text, marks: 6, created_at: new Date().toISOString() };
    const eq6: ExamQuestion = { id: 'eq-6', tenant_id: tenantAId, exam_id: exam1.id, question_id: bq6.id, section_type: 'LONG', display_order: 6, question_text: bq6.question_text, marks: 12, created_at: new Date().toISOString() };
    this.examQuestions.push(eq1, eq2, eq3, eq4, eq5, eq6);

    this.studentExamEvaluations.push({
      id: 'eval-1',
      tenant_id: tenantAId,
      exam_id: exam1.id,
      student_id: 'stud-1',
      student_name: 'Muhammad Ali Raza',
      roll_number: 'A-101',
      batch_name: batchA.name,
      mcq_answers: { 'eq-1': 'B', 'eq-2': 'C', 'eq-3': 'A' },
      mcq_score: 6.0,
      short_score: 10.5,
      short_remarks: 'Precise equilibrium conditions stated; clear distinctions between dot and cross product.',
      long_score: 11.0,
      long_remarks: 'Neat vector resolution diagram and step-by-step Pythagorean magnitude proof.',
      total_obtained: 27.5,
      percentage: 91.67,
      grade: 'A*',
      status: 'GRADED',
      evaluated_by: 'a1000000-0000-0000-0000-000000000002',
      evaluated_by_name: 'Sir Tariq Physics',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const tmplAbsence: WhatsAppTemplate = {
      id: 'tmpl-absence-1',
      tenant_id: tenantAId,
      title: 'Daily Morning Absence Alert',
      category: 'ABSENCE',
      body: 'Dear {guardian_name}, your child {student_name} (Roll: {roll_number}) was marked *ABSENT* today ({current_date}) in batch {batch_name}. If this is an emergency or illness, please contact {academy_phone}. Regards, {academy_name}.',
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const tmplFee: WhatsAppTemplate = {
      id: 'tmpl-fee-1',
      tenant_id: tenantAId,
      title: 'Fee Payment Reminder',
      category: 'FEE_REMINDER',
      body: 'Dear {guardian_name}, this is a gentle reminder from {academy_name} that the fee of *Rs. {due_amount}* for {student_name} (Roll: {roll_number}) in {batch_name} is due by *{due_date}*. Thank you.',
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const tmplExam: WhatsAppTemplate = {
      id: 'tmpl-exam-1',
      tenant_id: tenantAId,
      title: 'Official Exam Result Published',
      category: 'EXAM_RESULT',
      body: 'Dear {guardian_name}, assessment results for *{exam_title}* are published! {student_name} (Roll: {roll_number}) scored *{obtained_marks}/{total_marks} Marks* ({percentage}%). Remarks: {teacher_remarks}. {academy_name}.',
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const tmplGeneral: WhatsAppTemplate = {
      id: 'tmpl-general-1',
      tenant_id: tenantAId,
      title: 'General Academy Announcement',
      category: 'GENERAL',
      body: 'Dear {guardian_name}, please note this important update from {academy_name} for batch {batch_name}. For details, call {academy_phone}.',
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.whatsappTemplates.push(tmplAbsence, tmplFee, tmplExam, tmplGeneral);

    const todayStr = new Date().toISOString().split('T')[0];
    this.absenteeFollowups.push({
      id: 'af-1',
      tenant_id: tenantAId,
      student_id: 'stud-2',
      student_name: 'Hamza Tariq',
      roll_number: 'A-102',
      guardian_name: 'Tariq Mehmood',
      guardian_phone: '+923001234567',
      backup_phone: '+923219876543',
      batch_id: batchA.id,
      batch_name: batchA.name,
      date: todayStr,
      consecutive_days: 1,
      call_outcome: null,
      reason_category: null,
      parent_remarks: null,
      expected_return_date: null,
      is_snoozed: false,
      snooze_until: null,
      status: 'PENDING',
      staff_counselor_id: null,
      staff_counselor_name: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    this.absenteeFollowups.push({
      id: 'af-2',
      tenant_id: tenantAId,
      student_id: 'stud-3',
      student_name: 'Ayesha Noor',
      roll_number: 'A-103',
      guardian_name: 'Noor Muhammad',
      guardian_phone: '+923334455667',
      backup_phone: null,
      batch_id: batchA.id,
      batch_name: batchA.name,
      date: todayStr,
      consecutive_days: 2,
      call_outcome: 'CONNECTED',
      reason_category: 'MEDICAL',
      parent_remarks: 'High seasonal fever, visiting hospital for lab tests today.',
      expected_return_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      is_snoozed: true,
      snooze_until: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      status: 'RESOLVED_EXCUSED',
      staff_counselor_id: 'a1000000-0000-0000-0000-000000000001',
      staff_counselor_name: 'Campus Director',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    this.absenteeFollowups.push({
      id: 'af-3',
      tenant_id: tenantAId,
      student_id: 'stud-4',
      student_name: 'Bilal Khan',
      roll_number: 'A-104',
      guardian_name: 'Zahid Khan',
      guardian_phone: '+923455566778',
      backup_phone: '+923123456789',
      batch_id: batchA.id,
      batch_name: batchA.name,
      date: todayStr,
      consecutive_days: 4,
      call_outcome: 'NO_ANSWER',
      reason_category: 'TRUANCY',
      parent_remarks: 'Called twice in the morning; phone rang but no answer.',
      expected_return_date: null,
      is_snoozed: false,
      snooze_until: null,
      status: 'UNREACHABLE',
      staff_counselor_id: 'a1000000-0000-0000-0000-000000000001',
      staff_counselor_name: 'Campus Director',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    this.retentionCases.push({
      id: 'ret-1',
      tenant_id: tenantAId,
      student_id: 'stud-4',
      student_name: 'Bilal Khan',
      roll_number: 'A-104',
      batch_name: batchA.name,
      monthly_attendance_pct: 58.5,
      consecutive_absences: 4,
      risk_level: 'CRITICAL',
      scheduled_meeting_date: null,
      counseling_notes: 'Consecutive unexplained absences for 4 straight days. Father phone repeatedly unattended.',
      status: 'OPEN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  // --- Auth & Tenant Methods ---
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    if (!slug) {
      return null;
    }
    const clean = slug.toLowerCase().trim();
    for (const tenant of this.tenants.values()) {
      if (tenant.slug.toLowerCase() === clean) return tenant;
    }
    // Check aliases for backwards-compatible link resolution
    const alias = this.tenantAliases.find(a => a.alias_slug.toLowerCase() === clean);
    if (alias) {
      const tenant = this.tenants.get(alias.tenant_id);
      if (tenant) return tenant;
    }
    // 'edu', 'main', or portal queries resolve to primary tenant
    if (clean === 'edu' || clean === 'main' || clean === 'portal') {
      return this.tenants.get('a0000000-0000-0000-0000-000000000001') || null;
    }
    return null;
  }

  async resolveTenantBySlugOrAlias(slug: string): Promise<{ tenant: Tenant | null; is_alias: boolean; primary_slug: string | null }> {
    if (!slug) return { tenant: null, is_alias: false, primary_slug: null };
    const clean = slug.toLowerCase().trim();
    for (const tenant of this.tenants.values()) {
      if (tenant.slug.toLowerCase() === clean) {
        if ((tenant.slug === 'tsa' || tenant.name === 'The Smart Academy') && !tenant.settings?.logo_url) {
          if (!tenant.settings) tenant.settings = {} as any;
          tenant.settings.logo_url = '/tsa-logo.png';
        }
        return { tenant, is_alias: false, primary_slug: tenant.slug };
      }
    }
    const alias = this.tenantAliases.find(a => a.alias_slug.toLowerCase() === clean);
    if (alias) {
      const tenant = this.tenants.get(alias.tenant_id);
      if (tenant) {
        if ((tenant.slug === 'tsa' || tenant.name === 'The Smart Academy') && !tenant.settings?.logo_url) {
          if (!tenant.settings) tenant.settings = {} as any;
          tenant.settings.logo_url = '/tsa-logo.png';
        }
        return { tenant, is_alias: true, primary_slug: tenant.slug };
      }
    }
    return { tenant: null, is_alias: false, primary_slug: null };
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    const tenant = this.tenants.get(id) || null;
    if (tenant) {
      this.ensureTenantSessions(tenant);
      if ((tenant.slug === 'tsa' || tenant.name === 'The Smart Academy') && !tenant.settings?.logo_url) {
        if (!tenant.settings) tenant.settings = {} as any;
        tenant.settings.logo_url = '/tsa-logo.png';
      }
    }
    return tenant;
  }

  async listTenants(): Promise<Tenant[]> {
    return Array.from(this.tenants.values());
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
    password_hash?: string;
    status?: TenantStatus;
  }): Promise<{ tenant: Tenant; admin: User }> {
    const rawSlug = params.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    const cleanSlug = rawSlug || 'academy-' + Math.floor(100 + Math.random() * 900);
    const tenantId = crypto.randomUUID();
    const baseDomain = process.env.BASE_DOMAIN || 'kampus.pk';
    const trialDays = this.platformGlobalConfig?.default_trial_days ?? 30;
    const initialStatus = params.status || 'active';
    const newTenant: Tenant = {
      id: tenantId,
      name: params.name.trim(),
      slug: cleanSlug,
      domain: `${cleanSlug}.${baseDomain}`,
      status: initialStatus,
      tier: 'starter',
      max_students: 500,
      max_staff: 50,
      trial_ends_at: new Date(Date.now() + 86400000 * trialDays).toISOString(),
      settings: {
        currency: 'PKR',
        timezone: 'Asia/Karachi',
        date_format: 'DD/MM/YYYY',
        academic_session: '2026-2027',
        campus_name: params.campus_name?.trim() || 'Main Campus',
        city: params.city?.trim() || null,
        phone: params.phone?.trim() || null,
        logo_url: params.logo_url || null,
        subdomain: cleanSlug,
        domain: `${cleanSlug}.${baseDomain}`,
        domain_verified: true,
        phone_country_code: '+92',
        features: {
          mobile_pwa_enabled: true,
          whatsapp_rapid_queue: true,
          geofence_attendance: true,
        },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.tenants.set(newTenant.id, newTenant);

    const adminUser: User = {
      id: crypto.randomUUID(),
      tenant_id: newTenant.id,
      email: params.admin_email.toLowerCase().trim(),
      full_name: params.admin_name.trim(),
      role: 'tenant_admin',
      status: initialStatus === 'pending_verification' ? 'pending_verification' : 'active',
      password_hash: params.password_hash || hashPassword('Admin@123'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.users.set(`${newTenant.id}:${adminUser.email}`, adminUser);

    const monthly: FeeHead = {
      id: crypto.randomUUID(),
      tenant_id: newTenant.id,
      name: 'Monthly Tuition Fee',
      code: 'TUITION',
      is_system_default: true,
      default_amount: 0,
      priority_order: 1,
      created_at: new Date().toISOString(),
    };
    this.feeHeads.push(monthly);
    this.ensureDefaultFeeCatalog(newTenant.id);
    this.ensureDefaultAcademicCatalog(newTenant.id);

    this.persistAllowed = true;
    this.persistQueued = true;
    await this.flushPersist();
    return { tenant: newTenant, admin: adminUser };
  }

  async updateTenantSettings(tenantId: string, updates: { name?: string; slug?: string; settings?: Partial<TenantSettings> }): Promise<Tenant | null> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return null;
    if (updates.name) tenant.name = updates.name;
    if (updates.slug) tenant.slug = updates.slug;
    if (updates.settings) {
      tenant.settings = {
        ...tenant.settings,
        ...updates.settings,
      };
    }
    this.ensureTenantSessions(tenant);
    this.tenants.set(tenantId, tenant);
    this.schedulePersist();
    return tenant;
  }

  private ensureTenantSessions(tenant: Tenant): void {
    if (!tenant.settings) return;
    if (!tenant.settings.academic_sessions || tenant.settings.academic_sessions.length === 0) {
      tenant.settings.academic_sessions = defaultAcademicSessions(tenant.settings.academic_session);
    } else {
      const nowYear = new Date().getFullYear();
      const active = tenant.settings.academic_sessions.find(s => s.is_active);
      const minYear = active?.start_year ? Math.min(nowYear, active.start_year) : nowYear;
      tenant.settings.academic_sessions = tenant.settings.academic_sessions.filter(s => s.start_year >= minYear || s.is_active);
      if (tenant.settings.academic_sessions.length === 0) {
        tenant.settings.academic_sessions = defaultAcademicSessions(tenant.settings.academic_session);
      }
    }
    const active = tenant.settings.academic_sessions.find(s => s.is_active);
    if (active) tenant.settings.academic_session = active.name;
  }

  async getUserByEmail(tenantId: string, email: string): Promise<User | null> {
    const key = `${tenantId}:${email.toLowerCase()}`;
    return this.users.get(key) || null;
  }

  async getUserByEmailGlobal(email: string): Promise<User[]> {
    const clean = email.toLowerCase().trim();
    const results: User[] = [];
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === clean) {
        results.push(u);
      }
    }
    return results;
  }

  async checkSlugAvailable(slug: string): Promise<boolean> {
    const clean = slug.toLowerCase().trim();
    if (!clean) return false;
    const existing = await this.getTenantBySlug(clean);
    return !existing;
  }

  async updateUserPassword(tenantId: string, email: string, passwordHash: string): Promise<boolean> {
    const user = await this.getUserByEmail(tenantId, email);
    if (!user) return false;
    user.password_hash = passwordHash;
    user.updated_at = new Date().toISOString();
    return true;
  }

  async createOTP(tenantId: string, email: string, codeHash: string, expiresAt: Date, purpose?: string): Promise<StoredOTP> {
    const clean = email.toLowerCase().trim();
    // Invalidate any previous unused OTP for this tenant, email, and purpose to prevent OTP pollution
    if (purpose) {
      for (const o of this.otps) {
        if (o.tenant_id === tenantId && o.email === clean && o.purpose === purpose && !o.used_at) {
          o.used_at = new Date();
        }
      }
    }

    const entry: StoredOTP = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      email: clean,
      code_hash: codeHash,
      purpose,
      attempts: 0,
      expires_at: expiresAt,
      used_at: null,
      created_at: new Date(),
    };
    this.otps.push(entry);
    return entry;
  }

  async getActiveOTP(tenantId: string, email: string, purpose?: string): Promise<StoredOTP | null> {
    const now = new Date();
    const clean = email.toLowerCase().trim();
    const valid = this.otps
      .filter(o => 
        o.tenant_id === tenantId && 
        o.email === clean && 
        !o.used_at && 
        o.expires_at > now &&
        (!purpose || o.purpose === purpose)
      )
      .sort((a, b) => b.expires_at.getTime() - a.expires_at.getTime());
    return valid[0] || null;
  }

  async getLatestOTP(tenantId: string, email: string, purpose?: string): Promise<StoredOTP | null> {
    const clean = email.toLowerCase().trim();
    const list = this.otps
      .filter(o => 
        o.tenant_id === tenantId && 
        o.email === clean &&
        (!purpose || o.purpose === purpose)
      )
      .sort((a, b) => ((b.created_at || b.expires_at).getTime()) - ((a.created_at || a.expires_at).getTime()));
    return list[0] || null;
  }

  async incrementOTPAttempts(id: string): Promise<void> {
    const otp = this.otps.find(o => o.id === id);
    if (otp) otp.attempts += 1;
  }

  async markOTPUsed(id: string): Promise<void> {
    const otp = this.otps.find(o => o.id === id);
    if (otp) otp.used_at = new Date();
  }

  // --- Academic Hierarchy Methods ---
  async getPrograms(tenantId: string): Promise<AcademicProgram[]> {
    let progs = this.programs.filter(p => p.tenant_id === tenantId);
    if (progs.length === 0) {
      this.ensureDefaultAcademicCatalog(tenantId);
      progs = this.programs.filter(p => p.tenant_id === tenantId);
    }
    return progs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  async reorderPrograms(tenantId: string, orderedIds: string[]): Promise<void> {
    orderedIds.forEach((id, idx) => {
      const prog = this.programs.find(p => p.id === id && p.tenant_id === tenantId);
      if (prog) {
        prog.sort_order = idx + 1;
        prog.updated_at = new Date().toISOString();
      }
    });
    this.schedulePersist();
  }

  async createProgram(data: Omit<AcademicProgram, 'id' | 'created_at' | 'updated_at'>): Promise<AcademicProgram> {
    const program: AcademicProgram = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.programs.push(program);
    this.schedulePersist();
    return program;
  }

  async updateProgram(
    tenantId: string,
    id: string,
    data: Partial<Omit<AcademicProgram, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>
  ): Promise<AcademicProgram | null> {
    const idx = this.programs.findIndex(p => p.tenant_id === tenantId && p.id === id);
    if (idx === -1) return null;
    const existing = this.programs[idx];
    const updated: AcademicProgram = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.programs[idx] = updated;
    this.schedulePersist();
    return updated;
  }

  async deleteProgram(tenantId: string, id: string, transferToProgramId?: string): Promise<boolean> {
    const initLen = this.programs.length;
    if (transferToProgramId) {
      for (const s of this.students) {
        if (s.tenant_id === tenantId && s.program_id === id) {
          s.program_id = transferToProgramId;
          s.updated_at = new Date().toISOString();
        }
      }
    }
    this.programs = this.programs.filter(p => !(p.tenant_id === tenantId && p.id === id));
    if (this.programs.length < initLen) {
      this.schedulePersist();
      return true;
    }
    return false;
  }

  async getSubjects(tenantId: string): Promise<Subject[]> {
    let subs = this.subjects.filter(s => s.tenant_id === tenantId);
    if (subs.length === 0) {
      this.ensureDefaultAcademicCatalog(tenantId);
      subs = this.subjects.filter(s => s.tenant_id === tenantId);
    }
    return subs;
  }

  async createSubject(data: Omit<Subject, 'id' | 'created_at'>): Promise<Subject> {
    const subject: Subject = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.subjects.push(subject);
    this.schedulePersist();
    return subject;
  }

  async deleteSubject(tenantId: string, id: string): Promise<boolean> {
    const initLen = this.subjects.length;
    this.subjects = this.subjects.filter(s => !(s.tenant_id === tenantId && s.id === id));
    if (this.subjects.length < initLen) {
      this.schedulePersist();
      return true;
    }
    return false;
  }

  async getSubjectGroups(tenantId: string, programId?: string): Promise<SubjectGroup[]> {
    return this.subjectGroups.filter(g => 
      g.tenant_id === tenantId && (!programId || g.program_id === programId)
    );
  }

  async createSubjectGroup(data: Omit<SubjectGroup, 'id' | 'created_at'>): Promise<SubjectGroup> {
    const group: SubjectGroup = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.subjectGroups.push(group);
    this.schedulePersist();
    return group;
  }

  async deleteSubjectGroup(tenantId: string, id: string): Promise<boolean> {
    const initLen = this.subjectGroups.length;
    this.subjectGroups = this.subjectGroups.filter(g => !(g.tenant_id === tenantId && g.id === id));
    if (this.subjectGroups.length < initLen) {
      this.schedulePersist();
      return true;
    }
    return false;
  }

  async getBatches(tenantId: string, programId?: string, cohortType?: 'section' | 'batch'): Promise<Batch[]> {
    return this.batches.filter(b => {
      if (b.tenant_id !== tenantId) return false;
      if (programId && b.program_id !== programId) return false;
      if (cohortType) {
        const resolvedType = b.cohort_type || (b.name && /section/i.test(b.name) ? 'section' : 'batch');
        if (resolvedType !== cohortType) return false;
      }
      return true;
    });
  }

  async createBatch(data: Omit<Batch, 'id' | 'created_at' | 'updated_at' | 'current_enrollment'>): Promise<Batch> {
    const cohort_type = data.cohort_type || (data.name && /section/i.test(data.name) ? 'section' : 'batch');
    const batch: Batch = {
      ...data,
      cohort_type,
      current_enrollment: 0,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.batches.push(batch);
    this.schedulePersist();
    return batch;
  }

  async updateBatch(
    tenantId: string,
    id: string,
    data: Partial<Omit<Batch, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>
  ): Promise<Batch | null> {
    const idx = this.batches.findIndex(b => b.tenant_id === tenantId && b.id === id);
    if (idx === -1) return null;
    const existing = this.batches[idx];
    const updated: Batch = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.batches[idx] = updated;
    this.schedulePersist();
    return updated;
  }

  async deleteBatch(tenantId: string, id: string, transferToBatchId?: string): Promise<boolean> {
    const initLen = this.batches.length;
    if (transferToBatchId) {
      for (const s of this.students) {
        if (s.tenant_id === tenantId && s.batch_id === id) {
          s.batch_id = transferToBatchId;
          s.updated_at = new Date().toISOString();
        }
      }
    }
    this.batches = this.batches.filter(b => !(b.tenant_id === tenantId && b.id === id));
    if (this.batches.length < initLen) {
      this.schedulePersist();
      return true;
    }
    return false;
  }

  // --- Custom Fields Methods ---
  async getCustomFields(tenantId: string, entityType: 'student' | 'inquiry'): Promise<CustomFieldDefinition[]> {
    return this.customFields
      .filter(f => f.tenant_id === tenantId && f.entity_type === entityType)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  async createCustomField(data: Omit<CustomFieldDefinition, 'id' | 'created_at'>): Promise<CustomFieldDefinition> {
    const field: CustomFieldDefinition = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.customFields.push(field);
    this.schedulePersist();
    return field;
  }

  // --- Inquiries Methods ---
  async getInquiries(tenantId: string): Promise<StudentInquiry[]> {
    return this.inquiries.filter(i => i.tenant_id === tenantId);
  }

  async createInquiry(data: Omit<StudentInquiry, 'id' | 'inquiry_number' | 'created_at' | 'updated_at'>): Promise<StudentInquiry> {
    const count = this.inquiries.filter(i => i.tenant_id === data.tenant_id).length + 1;
    const inquiry: StudentInquiry = {
      ...data,
      id: crypto.randomUUID(),
      inquiry_number: `INQ-2026-${count.toString().padStart(3, '0')}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.inquiries.push(inquiry);
    this.schedulePersist();
    return inquiry;
  }

  async updateInquiryStage(tenantId: string, id: string, stage: InquiryStage): Promise<StudentInquiry | null> {
    const inq = this.inquiries.find(i => i.id === id && i.tenant_id === tenantId);
    if (!inq) return null;
    inq.stage = stage;
    inq.updated_at = new Date().toISOString();
    this.schedulePersist();
    return inq;
  }

  // --- Student SIS Methods ---
  async getStudents(tenantId: string, batchId?: string): Promise<Student[]> {
    const list = this.students.filter(s => 
      s.tenant_id === tenantId && (!batchId || s.batch_id === batchId)
    );
    const tenantInvoices = this.invoices.filter(i => i.tenant_id === tenantId);
    return list.map(s => {
      const sInvs = tenantInvoices.filter(i => i.student_id === s.id || i.roll_number === s.roll_number);
      const unpaid = sInvs.reduce((sum, inv) => sum + (inv.balance_due ?? inv.balance_amount ?? 0), 0);
      const isDefaulter = sInvs.some(i => (i.status as any) === 'overdue' || (Boolean(i.due_date) && new Date(i.due_date.includes('T') ? i.due_date : i.due_date + 'T23:59:59.999Z') < new Date() && ((i.balance_due ?? i.balance_amount ?? 0) > 0)));
      return {
        ...s,
        unpaid_balance: unpaid,
        fee_clearance_status: unpaid === 0 ? 'cleared' : (isDefaulter ? 'defaulter' : 'partial'),
      };
    });
  }

  async getStudentById(tenantId: string, id: string): Promise<Student | null> {
    const student = this.students.find(s => s.id === id && s.tenant_id === tenantId);
    if (!student) return null;
    const sInvs = this.invoices.filter(i => i.tenant_id === tenantId && (i.student_id === student.id || i.roll_number === student.roll_number));
    const unpaid = sInvs.reduce((sum, inv) => sum + (inv.balance_due ?? inv.balance_amount ?? 0), 0);
    const isDefaulter = sInvs.some(i => (i.status as any) === 'overdue' || (Boolean(i.due_date) && new Date(i.due_date.includes('T') ? i.due_date : i.due_date + 'T23:59:59.999Z') < new Date() && ((i.balance_due ?? i.balance_amount ?? 0) > 0)));
    return {
      ...student,
      unpaid_balance: unpaid,
      fee_clearance_status: unpaid === 0 ? 'cleared' : (isDefaulter ? 'defaulter' : 'partial'),
    };
  }

  async getStudentAcademicSummary(tenantId: string, studentId: string): Promise<{
    exams: any[];
    homework: any[];
    attendance_summary: {
      total: number;
      present: number;
      absent: number;
      late: number;
      percentage: number;
    };
  }> {
    const student = this.students.find(s => s.id === studentId && s.tenant_id === tenantId);
    if (!student) {
      throw new Error(`Student ${studentId} not found in tenant ${tenantId}`);
    }

    // 1. Exams & Evaluations
    const evals = this.studentExamEvaluations.filter(e => e.tenant_id === tenantId && e.student_id === studentId);
    const batchExams = this.exams.filter(ex => ex.tenant_id === tenantId && ex.batch_id === student.batch_id);
    const examsSummary = batchExams.map(ex => {
      const ev = evals.find(e => e.exam_id === ex.id);
      return {
        id: ex.id,
        title: ex.title,
        exam_date: ex.exam_date,
        total_marks: ex.total_marks,
        total_obtained: ev?.total_obtained ?? null,
        grade: ev?.grade ?? null,
        percentage: ev?.percentage ?? null,
        remarks: ev?.short_remarks || ev?.long_remarks || null,
        status: ev ? 'evaluated' : 'scheduled',
      };
    }).sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime());

    // 2. Homework & Checks
    const checks = this.notebookChecks.filter(c => c.tenant_id === tenantId && c.student_id === studentId);
    const batchHomework = this.homeworkAssignments.filter(h => h.tenant_id === tenantId && h.batch_id === student.batch_id);
    const homeworkSummary = batchHomework.map(h => {
      const check = checks.find(c => c.assignment_id === h.id);
      return {
        id: h.id,
        title: h.title,
        description: h.description,
        subject_name: h.subject_name,
        due_date: h.due_date,
        teacher_name: h.teacher_name || 'Course Instructor',
        submission_status: check?.status || 'pending',
        remarks: check?.remarks || null,
        checked_at: check?.checked_at || null,
      };
    }).sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());

    // 3. Attendance Summary
    const attLogs = this.studentAttendance.filter(a => a.tenant_id === tenantId && a.student_id === studentId);
    const totalAtt = attLogs.length;
    const presentAtt = attLogs.filter(a => a.status === 'present').length;
    const lateAtt = attLogs.filter(a => a.status === 'late').length;
    const absentAtt = attLogs.filter(a => a.status === 'absent').length;
    const pct = totalAtt > 0 ? Math.round(((presentAtt + lateAtt) / totalAtt) * 1000) / 10 : 100.0;

    return {
      exams: examsSummary,
      homework: homeworkSummary,
      attendance_summary: {
        total: totalAtt,
        present: presentAtt,
        late: lateAtt,
        absent: absentAtt,
        percentage: pct,
      },
    };
  }

  async createStudent(data: Omit<Student, 'id' | 'admission_number' | 'roll_number' | 'admission_date' | 'created_at' | 'updated_at'>): Promise<Student> {
    const batchStudents = this.students.filter(s => s.tenant_id === data.tenant_id && s.batch_id === data.batch_id);
    const tenant = this.tenants.get(data.tenant_id);
    if (tenant) this.ensureTenantSessions(tenant);
    const sessionYear = activeSessionStartYear(tenant?.settings);
    const admPrefix = `ADM-${sessionYear}-`;
    const seq = this.students.filter(s => s.tenant_id === data.tenant_id && String(s.admission_number || '').startsWith(admPrefix)).length + 1;

    const batch = this.batches.find(b => b.id === data.batch_id && b.tenant_id === data.tenant_id);
    if (batch && batch.current_enrollment >= batch.max_capacity) {
      throw new Error(`Batch "${batch.name}" has reached maximum capacity (${batch.current_enrollment}/${batch.max_capacity}). Please increase batch capacity in Academic Structure before enrolling new students.`);
    }

    const rawGuardianCnic = (data as any).guardian_id_card?.trim()
      || ((data as any).primary_contact === 'mother' ? (data as any).mother_cnic?.trim() : (data as any).father_cnic?.trim())
      || (data as any).father_cnic?.trim()
      || (data as any).mother_cnic?.trim();
    const cleanGuardianCnic = rawGuardianCnic ? rawGuardianCnic.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : null;
    const gEmail = data.guardian_email?.trim().toLowerCase();

    let admSeq = seq;
    let candidateAdm = `${admPrefix}${admSeq.toString().padStart(3, '0')}`;
    while (this.students.some(s => s.tenant_id === data.tenant_id && s.admission_number === candidateAdm)) {
      admSeq++;
      candidateAdm = `${admPrefix}${admSeq.toString().padStart(3, '0')}`;
    }

    const rawCustomRoll = (data as any).roll_number?.trim();
    let assignedRollNumber = rawCustomRoll;
    if (assignedRollNumber) {
      const existingWithRoll = this.students.find(s =>
        s.tenant_id === data.tenant_id &&
        s.batch_id === data.batch_id &&
        s.status !== 'archived' &&
        s.roll_number?.trim().toLowerCase() === assignedRollNumber.toLowerCase()
      );
      if (existingWithRoll) {
        throw new Error(`Roll number "${assignedRollNumber}" is already assigned to student "${existingWithRoll.full_name}" in this batch/section.`);
      }
    } else {
      let rollSeq = batchStudents.length + 101;
      while (this.students.some(s =>
        s.tenant_id === data.tenant_id &&
        s.batch_id === data.batch_id &&
        s.status !== 'archived' &&
        s.roll_number?.trim().toLowerCase() === `r-${rollSeq}`.toLowerCase()
      )) {
        rollSeq++;
      }
      assignedRollNumber = `R-${rollSeq}`;
    }

    const student: Student = {
      ...data,
      date_of_birth: (data as any).date_of_birth || null,
      gender: (data as any).gender || null,
      student_b_form: (data as any).student_b_form || null,
      residential_address: (data as any).residential_address || null,
      city: (data as any).city || null,
      father_name: (data as any).father_name || null,
      father_cnic: (data as any).father_cnic || null,
      father_phone: (data as any).father_phone || null,
      father_occupation: (data as any).father_occupation || null,
      mother_name: (data as any).mother_name || null,
      mother_cnic: (data as any).mother_cnic || null,
      mother_phone: (data as any).mother_phone || null,
      mother_occupation: (data as any).mother_occupation || null,
      primary_contact: (data as any).primary_contact || 'father',
      sibling_student_id: (data as any).sibling_student_id || null,
      previous_school: (data as any).previous_school || (data as any).custom_field_values?.previous_school || null,
      religion: (data as any).religion || null,
      submitted_documents: (data as any).submitted_documents || {},
      guardian_name: data.guardian_name || (data as any).father_name || 'Guardian',
      guardian_phone: data.guardian_phone || (data as any).father_phone || data.phone || '',
      guardian_id_card: rawGuardianCnic || null,
      billing_mode: data.billing_mode || batch?.billing_mode || 'monthly',
      id: crypto.randomUUID(),
      admission_number: candidateAdm,
      roll_number: assignedRollNumber,
      admission_date: (data as any).admission_date || new Date().toISOString().split('T')[0],
      status: data.status || 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if ((data as any).inquiry_id) {
      await this.updateInquiryStage(data.tenant_id, (data as any).inquiry_id, 'admitted');
    }

    // Auto-provision student portal user account if user_id is not already supplied
    const studentUserId = data.user_id || crypto.randomUUID();
    const rawEmail = data.email?.trim().toLowerCase();
    const admClean = student.admission_number.toLowerCase().replace(/[^a-z0-9]/g, '');
    const tenantDomain = tenant?.domain || (tenant?.slug ? `${tenant.slug}.kampus.pk` : 'kampus.pk');
    const userEmail = rawEmail || `std.${admClean}@${tenantDomain}`;

    if (!data.user_id) {
      const existingUser = Array.from(this.users.values()).find(u => u.tenant_id === data.tenant_id && u.email.toLowerCase() === userEmail);
      if (!existingUser) {
        const newStudentUser: User = {
          id: studentUserId,
          tenant_id: data.tenant_id,
          email: userEmail,
          full_name: data.full_name,
          role: 'student',
          status: 'active',
          password_hash: hashPassword('Student@123'),
          phone: data.phone || undefined,
          metadata: {
            guardian_id_card: rawGuardianCnic || undefined,
            roll_number: student.roll_number,
            admission_number: student.admission_number,
            default_password: 'Student@123',
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.users.set(studentUserId, newStudentUser);
        this.users.set(`${data.tenant_id}:${userEmail.toLowerCase()}`, newStudentUser);
        student.user_id = studentUserId;
      } else {
        student.user_id = existingUser.id;
      }
    }

    // Auto-provision guardian account if guardian_id_card or guardian_email is supplied
    if (cleanGuardianCnic || gEmail) {
      const parentUserEmail = gEmail || (cleanGuardianCnic
        ? `guardian.${cleanGuardianCnic}@${tenantDomain}`
        : `guardian.${crypto.randomUUID()}@${tenantDomain}`);
      
      const existingParent = Array.from(this.users.values()).find(u =>
        u.tenant_id === data.tenant_id && u.role === 'parent' && (
          (cleanGuardianCnic && (u.metadata as any)?.clean_guardian_id_card === cleanGuardianCnic) ||
          (cleanGuardianCnic && u.email.toLowerCase() === `guardian.${cleanGuardianCnic}@kampus.pk`) ||
          (gEmail && u.email.toLowerCase() === gEmail)
        )
      );

      if (!existingParent) {
        const parentId = crypto.randomUUID();
        const newParentUser: User = {
          id: parentId,
          tenant_id: data.tenant_id,
          email: parentUserEmail,
          full_name: data.guardian_name,
          role: 'parent',
          status: 'active',
          password_hash: hashPassword('Parent@123'),
          phone: data.guardian_phone,
          metadata: {
            guardian_id_card: rawGuardianCnic || undefined,
            clean_guardian_id_card: cleanGuardianCnic || undefined,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.users.set(parentId, newParentUser);
        this.users.set(`${data.tenant_id}:${parentUserEmail.toLowerCase()}`, newParentUser);
      } else if (cleanGuardianCnic) {
        if (!existingParent.metadata) existingParent.metadata = {};
        (existingParent.metadata as any).clean_guardian_id_card = cleanGuardianCnic;
        if (rawGuardianCnic) (existingParent.metadata as any).guardian_id_card = rawGuardianCnic;
      }
    }

    this.students.push(student);

    if (batch && student.status === 'active') batch.current_enrollment += 1;
    this.schedulePersist();

    const shouldGenerateOpeningInvoice = (data as any).generate_first_month_invoice !== undefined
      ? Boolean((data as any).generate_first_month_invoice)
      : Boolean(student.fee_structure && student.fee_structure.first_month_total > 0);

    // Auto-generate first month invoice only for active students if fee_structure is set and opening billing was requested
    if (student.status === 'active' && student.fee_structure && shouldGenerateOpeningInvoice && (student.fee_structure.first_month_total > 0 || student.billing_mode === 'installment')) {
      const now = new Date();
      const dueDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const billingMonth = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

      const customItems: Array<{ fee_head_id: string; amount: number }> = [];
      const tuitionHead = this.feeHeads.find(h => h.tenant_id === data.tenant_id && h.code === 'TUITION') || this.feeHeads.find(h => h.tenant_id === data.tenant_id);
      const admHead = this.feeHeads.find(h => h.tenant_id === data.tenant_id && h.code === 'ADMISSION') || tuitionHead;
      const examHead = this.feeHeads.find(h => h.tenant_id === data.tenant_id && h.code === 'EXAM') || tuitionHead;

      if (student.fee_structure.net_tuition > 0 && tuitionHead) {
        customItems.push({
          fee_head_id: tuitionHead.id,
          amount: student.fee_structure.net_tuition,
        });
      }

      const additionalHeadsList: Array<{ fee_head_id: string; amount: number }> =
        Array.isArray((student.fee_structure as any)?.additional_heads)
          ? (student.fee_structure as any).additional_heads
          : [];

      const hasAdmissionInAdditional = admHead && additionalHeadsList.some(ah => ah.fee_head_id === admHead.id);
      const hasExamInAdditional = examHead && additionalHeadsList.some(ah => ah.fee_head_id === examHead.id);

      if (student.fee_structure.admission_fee > 0 && admHead && !hasAdmissionInAdditional) {
        customItems.push({
          fee_head_id: admHead.id,
          amount: student.fee_structure.admission_fee,
        });
      }
      if (student.fee_structure.exam_fee > 0 && examHead && !hasExamInAdditional) {
        customItems.push({
          fee_head_id: examHead.id,
          amount: student.fee_structure.exam_fee,
        });
      }
      for (const ah of additionalHeadsList) {
        const amt = Number(ah.amount) || 0;
        if (amt > 0 && ah.fee_head_id) {
          customItems.push({
            fee_head_id: ah.fee_head_id,
            amount: amt,
          });
        }
      }

      if (student.billing_mode === 'installment' && student.installment_plan && student.installment_plan.installments.length > 0) {
        const firstInst = student.installment_plan.installments[0];
        const instItems: Array<{ fee_head_id: string; amount: number }> = [];
        if (tuitionHead && firstInst.amount > 0) {
          instItems.push({
            fee_head_id: tuitionHead.id,
            amount: firstInst.amount,
          });
        }
        if (student.fee_structure.admission_fee > 0 && admHead && !hasAdmissionInAdditional) {
          instItems.push({
            fee_head_id: admHead.id,
            amount: student.fee_structure.admission_fee,
          });
        }
        if (student.fee_structure.exam_fee > 0 && examHead && !hasExamInAdditional) {
          instItems.push({
            fee_head_id: examHead.id,
            amount: student.fee_structure.exam_fee,
          });
        }
        for (const ah of additionalHeadsList) {
          const amt = Number(ah.amount) || 0;
          if (amt > 0 && ah.fee_head_id) {
            instItems.push({
              fee_head_id: ah.fee_head_id,
              amount: amt,
            });
          }
        }
        if (instItems.length === 0 && tuitionHead) {
          instItems.push({
            fee_head_id: tuitionHead.id,
            amount: firstInst.amount || 1000,
          });
        }
        try {
          const openingInvoice = await this.generateInvoice(data.tenant_id, {
            student_id: student.id,
            billing_month: billingMonth,
            due_date: firstInst.due_date || dueDate,
            custom_items: instItems,
            installment_number: 1,
            total_installments: student.installment_plan.total_installments,
            billing_mode: 'installment',
            notes: `Admission Opening Fee Challan - Installment 1 of ${student.installment_plan.total_installments}`
          } as any);
          firstInst.status = 'billed';
          firstInst.invoice_id = openingInvoice.id;
          student.first_invoice_id = openingInvoice.id;
          this.schedulePersist();
        } catch (invErr) {
          console.error('Failed to generate opening invoice on admission (installment):', invErr);
        }
      } else if (customItems.length > 0) {
        try {
          const openingInvoice = await this.generateInvoice(data.tenant_id, {
            student_id: student.id,
            billing_month: billingMonth,
            due_date: dueDate,
            custom_items: customItems,
            billing_mode: student.billing_mode || (data as any).billing_mode || 'monthly',
            notes: 'Admission Opening Fee Challan'
          } as any);
          student.first_invoice_id = openingInvoice.id;
          this.schedulePersist();
        } catch (invErr) {
          console.error('Failed to generate opening invoice on admission:', invErr);
        }
      }
    }

    return student;
  }

  async updateStudent(tenantId: string, id: string, data: Partial<Student>): Promise<Student | null> {
    const student = this.students.find(s => s.id === id && s.tenant_id === tenantId);
    if (!student) return null;

    if (data.roll_number && data.roll_number.trim() && data.roll_number.trim().toLowerCase() !== (student.roll_number || '').trim().toLowerCase()) {
      const targetBatchId = data.batch_id || student.batch_id;
      const collision = this.students.find(s =>
        s.tenant_id === tenantId &&
        s.batch_id === targetBatchId &&
        s.id !== student.id &&
        s.status !== 'archived' &&
        s.roll_number?.trim().toLowerCase() === data.roll_number!.trim().toLowerCase()
      );
      if (collision) {
        throw new Error(`Roll number "${data.roll_number.trim()}" is already assigned to student "${collision.full_name}" in this batch/section.`);
      }
    }

    Object.assign(student, {
      ...data,
      id: student.id,
      tenant_id: student.tenant_id,
      admission_number: student.admission_number,
      admission_date: student.admission_date,
      created_at: student.created_at,
      updated_at: new Date().toISOString(),
    });

    if (student.user_id) {
      const user = this.users.get(student.user_id);
      if (user && user.tenant_id === tenantId) {
        if (data.full_name) user.full_name = data.full_name;
        if (data.email) user.email = data.email.toLowerCase().trim();
        if (data.phone) user.phone = data.phone;
        user.updated_at = new Date().toISOString();
      }
    }

    this.schedulePersist();
    return student;
  }

  async updateStudentStatus(
    tenantId: string,
    studentId: string,
    status: StudentStatus,
    reason: string,
    cancelUnpaidInvoices: boolean = false,
    changedBy: string = 'Administration'
  ): Promise<Student | null> {
    const student = this.students.find(s => s.id === studentId && s.tenant_id === tenantId);
    if (!student) return null;

    const previousStatus = student.status;
    student.status = status;
    student.status_reason = reason;
    if (!student.status_change_history) {
      student.status_change_history = [];
    }
    student.status_change_history.push({
      previous_status: previousStatus,
      new_status: status,
      reason,
      changed_by: changedBy,
      changed_at: new Date().toISOString(),
    });
    student.updated_at = new Date().toISOString();

    // Maintain Batch Enrollment Counters
    if (previousStatus === 'active' && status !== 'active') {
      const batch = this.batches.find(b => b.id === student.batch_id && b.tenant_id === tenantId);
      if (batch) {
        batch.current_enrollment = Math.max(0, batch.current_enrollment - 1);
      }
    } else if (previousStatus !== 'active' && status === 'active') {
      const batch = this.batches.find(b => b.id === student.batch_id && b.tenant_id === tenantId);
      if (batch) {
        if (batch.current_enrollment >= batch.max_capacity) {
          throw new Error(`Cannot reactivate student: Batch "${batch.name}" is already at full capacity (${batch.max_capacity}/${batch.max_capacity}). Expand batch capacity first.`);
        }
        batch.current_enrollment += 1;
      }
    }

    if (cancelUnpaidInvoices) {
      const studentInvoices = this.invoices.filter(
        i => i.tenant_id === tenantId && i.student_id === studentId
      );
      for (const inv of studentInvoices) {
        if (inv.status === 'unpaid' || inv.status === 'UNPAID' || inv.status === 'partially_paid' || inv.status === 'PARTIAL') {
          inv.status = 'cancelled';
          inv.balance_amount = 0;
          inv.balance_due = 0;
          inv.notes = (inv.notes ? inv.notes + ' | ' : '') + `[Administrative Status Change] Cancelled due to student status change to ${status}. Reason: ${reason}`;
          inv.updated_at = new Date().toISOString();
        }
      }
    }

    this.schedulePersist();
    return student;
  }

  async archiveStudent(
    tenantId: string,
    studentId: string,
    reason: string = 'Administrative student record archival',
    cancelUnpaidInvoices: boolean = false,
    changedBy: string = 'Administration'
  ): Promise<Student | null> {
    return this.updateStudentStatus(tenantId, studentId, 'archived', reason, cancelUnpaidInvoices, changedBy);
  }

  async unarchiveStudent(
    tenantId: string,
    studentId: string,
    reason: string = 'Restored from archive to active standing',
    changedBy: string = 'Administration'
  ): Promise<Student | null> {
    return this.updateStudentStatus(tenantId, studentId, 'active', reason, false, changedBy);
  }

  async deleteStudent(
    tenantId: string,
    studentId: string,
    options?: { force?: boolean; reason?: string; deletedBy?: string }
  ): Promise<{ success: boolean; message?: string; error?: string; hasPaidTransactions?: boolean }> {
    const student = this.students.find(s => s.id === studentId && s.tenant_id === tenantId);
    if (!student) {
      return { success: false, error: 'Student not found' };
    }

    const studentInvoices = this.invoices.filter(
      i => i.tenant_id === tenantId && (i.student_id === studentId || i.roll_number === student.roll_number)
    );
    const paidInvoices = studentInvoices.filter(
      i => i.status === 'paid' || i.status === 'partially_paid' || (i.paid_amount && i.paid_amount > 0)
    );
    const studentPayments = this.feePayments.filter(
      p => p.tenant_id === tenantId && p.student_id === studentId
    );
    const hasPaidTransactions = paidInvoices.length > 0 || studentPayments.length > 0;

    if (hasPaidTransactions && !options?.force) {
      return {
        success: false,
        hasPaidTransactions: true,
        error: `Student has recorded financial transactions (${paidInvoices.length} paid/partial invoice(s) or fee receipts). To preserve double-entry audit integrity, archive the student instead of deleting, or authorize force deletion.`,
      };
    }

    // Decrement batch enrollment if student was active
    if (student.status === 'active') {
      const batch = this.batches.find(b => b.id === student.batch_id && b.tenant_id === tenantId);
      if (batch) {
        batch.current_enrollment = Math.max(0, batch.current_enrollment - 1);
      }
    }

    // Clean up student-associated records
    if (this.studentAttendance) {
      this.studentAttendance = this.studentAttendance.filter(
        a => !(a.tenant_id === tenantId && a.student_id === studentId)
      );
    }
    if (this.leaveApplications) {
      this.leaveApplications = this.leaveApplications.filter(
        l => !(l.tenant_id === tenantId && l.student_id === studentId)
      );
    }
    if (this.studentExamEvaluations) {
      this.studentExamEvaluations = this.studentExamEvaluations.filter(
        e => !(e.tenant_id === tenantId && e.student_id === studentId)
      );
    }
    if (this.notebookChecks) {
      this.notebookChecks = this.notebookChecks.filter(
        c => !(c.tenant_id === tenantId && c.student_id === studentId)
      );
    }
    if (this.absenteeFollowups) {
      this.absenteeFollowups = this.absenteeFollowups.filter(
        f => !(f.tenant_id === tenantId && f.student_id === studentId)
      );
    }
    if (this.feeStructures) {
      this.feeStructures = this.feeStructures.filter(
        fs => !(fs.tenant_id === tenantId && fs.student_id === studentId)
      );
    }
    if (this.feeDiscounts) {
      this.feeDiscounts = this.feeDiscounts.filter(
        d => !(d.tenant_id === tenantId && d.student_id === studentId)
      );
    }
    if (this.studentProfileAuditLogs) {
      this.studentProfileAuditLogs = this.studentProfileAuditLogs.filter(
        l => !(l.tenant_id === tenantId && l.student_id === studentId)
      );
    }

    // Invoices cleanup: remove unpaid/cancelled invoices, or all if force deletion
    if (this.invoices) {
      if (options?.force) {
        this.invoices = this.invoices.filter(
          i => !(i.tenant_id === tenantId && (i.student_id === studentId || i.roll_number === student.roll_number))
        );
      } else {
        this.invoices = this.invoices.filter(
          i => !(i.tenant_id === tenantId && (i.student_id === studentId || i.roll_number === student.roll_number) && (i.status === 'unpaid' || i.status === 'cancelled'))
        );
      }
    }
    if (this.feePayments && options?.force) {
      this.feePayments = this.feePayments.filter(
        p => !(p.tenant_id === tenantId && p.student_id === studentId)
      );
    }

    // Remove user account if one was provisioned for this student
    if (student.user_id && this.users) {
      this.users.delete(student.user_id);
      if (student.email) {
        this.users.delete(`${tenantId}:${student.email.toLowerCase()}`);
      }
    }

    // Remove student
    if (this.students) {
      this.students = this.students.filter(s => !(s.tenant_id === tenantId && s.id === studentId));
    }

    this.schedulePersist();
    return {
      success: true,
      message: `Student "${student.full_name}" (${student.admission_number}) deleted successfully.`,
    };
  }

  async bulkArchiveStudents(
    tenantId: string,
    studentIds: string[],
    reason: string = 'Bulk administrative archival',
    cancelUnpaidInvoices: boolean = false,
    changedBy: string = 'Administration'
  ): Promise<{ archived_count: number; errors?: string[] }> {
    let count = 0;
    const errors: string[] = [];
    for (const sid of studentIds) {
      try {
        const res = await this.archiveStudent(tenantId, sid, reason, cancelUnpaidInvoices, changedBy);
        if (res) count++;
      } catch (err: any) {
        errors.push(err.message || `Failed to archive student ${sid}`);
      }
    }
    return { archived_count: count, errors: errors.length > 0 ? errors : undefined };
  }

  async bulkDeleteStudents(
    tenantId: string,
    studentIds: string[],
    options?: { force?: boolean; reason?: string; deletedBy?: string }
  ): Promise<{ deleted_count: number; skipped_count: number; errors?: string[] }> {
    let deletedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const sid of studentIds) {
      const res = await this.deleteStudent(tenantId, sid, options);
      if (res.success) {
        deletedCount++;
      } else {
        skippedCount++;
        if (res.error) errors.push(res.error);
      }
    }

    return { deleted_count: deletedCount, skipped_count: skippedCount, errors: errors.length > 0 ? errors : undefined };
  }

  async admitInquiry(
    tenantId: string,
    inquiryId: string,
    batchId: string,
    electiveGroupId?: string,
    customSubjectIds?: string[],
    feeStructure?: any,
    customFieldValues?: Record<string, any>,
    guardianIdCard?: string
  ): Promise<Student> {
    const inq = await this.updateInquiryStage(tenantId, inquiryId, 'admitted');
    if (!inq) throw new Error('Inquiry not found');

    const batch = this.batches.find(b => b.id === batchId && b.tenant_id === tenantId);
    if (!batch) throw new Error('Batch not found');

    let subjects: string[] = [];
    if (customSubjectIds && customSubjectIds.length > 0) {
      subjects = [...customSubjectIds];
    } else {
      // Get compulsory subjects for the program
      const compGroup = this.subjectGroups.find(g => g.tenant_id === tenantId && g.program_id === batch.program_id && g.type === 'compulsory');
      subjects = compGroup ? [...compGroup.subject_ids] : [];

      if (electiveGroupId) {
        const elecGroup = this.subjectGroups.find(g => g.id === electiveGroupId && g.tenant_id === tenantId);
        if (elecGroup) {
          subjects = [...subjects, ...elecGroup.subject_ids];
        }
      }
    }

    const mergedCustomValues = {
      ...(inq.custom_field_values || {}),
      ...(customFieldValues || {}),
      inquiry_number: inq.inquiry_number,
      source: inq.source,
    };

    return this.createStudent({
      tenant_id: tenantId,
      full_name: inq.student_name,
      phone: inq.phone,
      email: inq.email,
      guardian_name: inq.guardian_name || 'Guardian',
      guardian_phone: inq.guardian_phone || inq.phone,
      guardian_id_card: guardianIdCard || inq.guardian_id_card,
      program_id: batch.program_id,
      batch_id: batch.id,
      elective_group_id: electiveGroupId,
      status: 'active',
      custom_field_values: mergedCustomValues,
      subjects,
      fee_structure: feeStructure,
      generate_first_month_invoice: feeStructure ? true : false,
    } as any);
  }

  async promoteStudents(
    tenantId: string,
    params: {
      student_ids: string[];
      target_program_id?: string;
      target_batch_id: string;
      target_session?: string;
      fee_adjustment_type: 'keep' | 'target_baseline' | 'percentage' | 'fixed';
      fee_adjustment_value?: number;
    },
    _userId?: string
  ): Promise<{ count: number; updated_students: Student[] }> {
    const targetBatch = this.batches.find(b => b.id === params.target_batch_id && b.tenant_id === tenantId);
    if (!targetBatch) throw new Error('Target section/batch not found');

    const effectiveProgramId = params.target_program_id || targetBatch.program_id;
    const targetProgram = effectiveProgramId ? this.programs.find(p => p.id === effectiveProgramId && p.tenant_id === tenantId) : undefined;

    const studentsToPromote = params.student_ids
      .map(id => this.students.find(s => s.id === id && s.tenant_id === tenantId))
      .filter((s): s is Student => Boolean(s));

    const activePromotedCount = studentsToPromote.filter(s => s.status === 'active').length;
    if (targetBatch.current_enrollment + activePromotedCount > targetBatch.max_capacity) {
      throw new Error(`Target batch capacity exceeded. Batch '${targetBatch.name}' capacity: ${targetBatch.max_capacity}, currently enrolled: ${targetBatch.current_enrollment}, attempting to add: ${activePromotedCount}`);
    }

    const targetCompGroup = effectiveProgramId ? this.subjectGroups.find(g => g.tenant_id === tenantId && g.program_id === effectiveProgramId && g.type === 'compulsory') : undefined;

    let targetBaseFee = 0;
    if (targetBatch.fee_amount && targetBatch.fee_amount > 0) {
      targetBaseFee = targetBatch.fee_amount;
    } else if (targetProgram && targetProgram.fee_schedule && targetProgram.fee_schedule.length > 0) {
      const tuitionHead = targetProgram.fee_schedule.find(h => h.is_monthly || h.is_recurring || h.fee_type === 'tuition');
      if (tuitionHead) {
        targetBaseFee = tuitionHead.amount;
      } else {
        targetBaseFee = targetProgram.fee_schedule.reduce((a, b) => a + (b.amount || 0), 0);
      }
    }

    const updatedStudents: Student[] = [];
    const nowIso = new Date().toISOString();

    for (const studentId of params.student_ids) {
      const student = this.students.find(s => s.id === studentId && s.tenant_id === tenantId);
      if (!student) continue;

      // Adjust source and target batch enrollments
      const sourceBatch = this.batches.find(b => b.id === student.batch_id && b.tenant_id === tenantId);
      if (sourceBatch && student.status === 'active') {
        sourceBatch.current_enrollment = Math.max(0, sourceBatch.current_enrollment - 1);
      }
      if (student.status === 'active') {
        targetBatch.current_enrollment += 1;
      }

      if (effectiveProgramId) {
        student.program_id = effectiveProgramId;
      }
      student.batch_id = params.target_batch_id;
      if (params.target_session) {
        (student as any).academic_session = params.target_session;
      }

      // Update curriculum subjects to target program's compulsory group
      if (targetCompGroup && targetCompGroup.subject_ids && targetCompGroup.subject_ids.length > 0) {
        student.subjects = [...targetCompGroup.subject_ids];
      }

      if (params.fee_adjustment_type === 'target_baseline' && targetBaseFee > 0) {
        const curFee = student.fee_structure || {};
        const oldBase = curFee.base_tuition || targetBaseFee;
        const oldNet = curFee.net_tuition || oldBase;
        const discountRatio = oldBase > 0 ? (oldBase - oldNet) / oldBase : 0;
        const newNet = Math.round(targetBaseFee * (1 - Math.max(0, Math.min(1, discountRatio))));

        student.fee_structure = {
          ...curFee,
          base_tuition: targetBaseFee,
          net_tuition: newNet,
          recurring_monthly: newNet,
        };
      } else if (params.fee_adjustment_type === 'percentage' && params.fee_adjustment_value !== undefined) {
        const factor = 1 + params.fee_adjustment_value / 100;
        const curFee = student.fee_structure || {};
        const curBase = curFee.base_tuition || 0;
        const curNet = curFee.net_tuition || curBase;

        const newBase = Math.round(curBase * factor);
        const newNet = Math.round(curNet * factor);

        student.fee_structure = {
          ...curFee,
          base_tuition: newBase,
          net_tuition: newNet,
          recurring_monthly: newNet,
        };
      } else if (params.fee_adjustment_type === 'fixed' && params.fee_adjustment_value !== undefined) {
        const increment = params.fee_adjustment_value;
        const curFee = student.fee_structure || {};
        const curBase = curFee.base_tuition || 0;
        const curNet = curFee.net_tuition || curBase;

        const newBase = Math.max(0, curBase + increment);
        const newNet = Math.max(0, curNet + increment);

        student.fee_structure = {
          ...curFee,
          base_tuition: newBase,
          net_tuition: newNet,
          recurring_monthly: newNet,
        };
      }

      student.updated_at = nowIso;
      updatedStudents.push(student);
    }

    if (updatedStudents.length > 0) {
      this.schedulePersist();
    }

    return { count: updatedStudents.length, updated_students: updatedStudents };
  }

  async bulkFeeRevision(
    tenantId: string,
    params: {
      scope: 'all' | 'program' | 'batch';
      program_id?: string;
      batch_id?: string;
      increment_type: 'percentage' | 'fixed';
      increment_value: number;
      rounding?: 'none' | 'nearest_50' | 'nearest_100';
      reason?: string;
    },
    _userId?: string
  ): Promise<{ count: number; affected_students: Student[] }> {
    const affectedStudents: Student[] = [];
    const nowIso = new Date().toISOString();

    for (const student of this.students) {
      if (student.tenant_id !== tenantId || student.status !== 'active') continue;

      if (params.scope === 'program' && params.program_id && student.program_id !== params.program_id) {
        continue;
      }
      if (params.scope === 'batch' && params.batch_id && student.batch_id !== params.batch_id) {
        continue;
      }

      const curFee = student.fee_structure || {};
      const curBase = curFee.base_tuition || 0;
      const curNet = curFee.net_tuition || curBase;

      let newBase = curBase;
      if (params.increment_type === 'percentage') {
        newBase = curBase * (1 + params.increment_value / 100);
      } else {
        newBase = curBase + params.increment_value;
      }

      if (params.rounding === 'nearest_50') {
        newBase = Math.round(newBase / 50) * 50;
      } else if (params.rounding === 'nearest_100') {
        newBase = Math.round(newBase / 100) * 100;
      } else {
        newBase = Math.round(newBase);
      }
      newBase = Math.max(0, newBase);

      const concessionDiff = Math.max(0, curBase - curNet);
      let newNet = newBase;
      if (curFee.concession_type === 'percentage' && curFee.concession_val) {
        newNet = Math.round(newBase * (1 - curFee.concession_val / 100));
      } else {
        newNet = Math.max(0, newBase - concessionDiff);
      }

      student.fee_structure = {
        ...curFee,
        base_tuition: newBase,
        net_tuition: newNet,
        recurring_monthly: newNet,
      };
      student.updated_at = nowIso;
      affectedStudents.push(student);
    }

    const roundAmt = (value: number) => {
      let newBase = value;
      if (params.rounding === 'nearest_50') newBase = Math.round(newBase / 50) * 50;
      else if (params.rounding === 'nearest_100') newBase = Math.round(newBase / 100) * 100;
      else newBase = Math.round(newBase);
      return Math.max(0, newBase);
    };

    for (const fs of this.feeStructures) {
      if (fs.tenant_id !== tenantId) continue;
      if (params.scope === 'batch' && params.batch_id && fs.batch_id !== params.batch_id) continue;
      if (params.scope === 'program' && params.program_id) {
        const batch = this.batches.find(b => b.id === fs.batch_id);
        if (batch && batch.program_id !== params.program_id) continue;
        if (fs.student_id) {
          const stu = this.students.find(s => s.id === fs.student_id);
          if (stu && stu.program_id !== params.program_id) continue;
        }
      }
      fs.items = fs.items.map(it => {
        const head = this.feeHeads.find(h => h.id === it.fee_head_id);
        const isTuition = head?.code === 'TUITION' || (it.head_name || '').toLowerCase().includes('tuition');
        if (!isTuition) return it;
        let amt = Number(it.amount) || 0;
        if (params.increment_type === 'percentage') amt = amt * (1 + params.increment_value / 100);
        else amt = amt + params.increment_value;
        return { ...it, amount: roundAmt(amt) };
      });
    }

    if (affectedStudents.length > 0) {
      this.schedulePersist();
    }

    return { count: affectedStudents.length, affected_students: affectedStudents };
  }

  studentProfileAuditLogs: Array<{
    id: string;
    tenant_id: string;
    student_id: string;
    action: string;
    changed_by_user_id: string;
    changed_by: string;
    changed_by_name: string;
    field_name?: string;
    old_value?: string | null;
    new_value?: string | null;
    changes?: Record<string, any>;
    reason: string | null;
    created_at: string;
  }> = [];

  async logStudentProfileChange(tenantId: string, data: {
    student_id: string;
    action?: string;
    changed_by_user_id: string;
    changed_by_name: string;
    field_name?: string;
    old_value?: string | null;
    new_value?: string | null;
    changes?: Record<string, any>;
    reason?: string | null;
  }): Promise<any> {
    const entry = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      student_id: data.student_id,
      action: data.action || (data.field_name ? `UPDATE_${data.field_name.toUpperCase()}` : 'UPDATE_PARTICULARS'),
      changed_by_user_id: data.changed_by_user_id,
      changed_by: data.changed_by_name,
      changed_by_name: data.changed_by_name,
      field_name: data.field_name,
      old_value: data.old_value ?? null,
      new_value: data.new_value ?? null,
      changes: data.changes ?? (data.field_name ? { [data.field_name]: { old: data.old_value, new: data.new_value } } : {}),
      reason: data.reason ?? null,
      created_at: new Date().toISOString(),
    };
    this.studentProfileAuditLogs.push(entry);
    this.schedulePersist();
    return entry;
  }

  async getStudentProfileAuditLogs(tenantId: string, studentId: string): Promise<any[]> {
    return this.studentProfileAuditLogs
      .filter(l => l.tenant_id === tenantId && l.student_id === studentId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  async resetStudentPassword(
    tenantId: string,
    studentId: string,
    options: {
      newPassword?: string;
      reason?: string;
      adminName: string;
      adminUserId: string;
      guardianIdCard?: string;
    }
  ): Promise<{ student: Student; user: User; default_password: string }> {
    const student = this.students.find(s => s.tenant_id === tenantId && s.id === studentId);
    if (!student) {
      throw new Error('Student not found.');
    }

    const previousCnic = student.guardian_id_card;
    if (options.guardianIdCard && options.guardianIdCard.trim()) {
      student.guardian_id_card = options.guardianIdCard.trim();
    }

    const rawCnic = student.guardian_id_card?.trim() || '';
    const cleanCnic = rawCnic ? rawCnic.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : '';
    const newPwd = options.newPassword?.trim() || 'Student@123';
    const pwdHash = hashPassword(newPwd);

    let studentUser: User | null = null;
    if (student.user_id) {
      studentUser = Array.from(this.users.values()).find(u => u.tenant_id === tenantId && u.id === student.user_id) || null;
    }

    if (!studentUser && cleanCnic) {
      studentUser = Array.from(this.users.values()).find(u => 
        u.tenant_id === tenantId && (
          (u.metadata as any)?.clean_guardian_id_card === cleanCnic ||
          u.email.toLowerCase() === `cnic.${cleanCnic}@kampus.pk` ||
          u.email.toLowerCase() === `guardian.${cleanCnic}@kampus.pk`
        )
      ) || null;
    }

    if (!studentUser) {
      const newUserId = crypto.randomUUID();
      const userEmail = cleanCnic 
        ? `cnic.${cleanCnic}@kampus.pk` 
        : `std.${student.admission_number.toLowerCase().replace(/[^a-z0-9]/g, '')}@kampus.pk`;

      studentUser = {
        id: newUserId,
        tenant_id: tenantId,
        email: userEmail,
        full_name: student.full_name,
        role: 'student',
        status: 'active',
        password_hash: pwdHash,
        metadata: {
          guardian_id_card: student.guardian_id_card || undefined,
          clean_guardian_id_card: cleanCnic || undefined,
          password_last_reset_at: new Date().toISOString(),
          password_reset_by: options.adminName,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.users.set(newUserId, studentUser);
      this.users.set(`${tenantId}:${userEmail.toLowerCase()}`, studentUser);
      student.user_id = newUserId;
    } else {
      studentUser.password_hash = pwdHash;
      if (!studentUser.metadata) studentUser.metadata = {};
      studentUser.metadata.password_last_reset_at = new Date().toISOString();
      studentUser.metadata.password_reset_by = options.adminName;
      if (cleanCnic) {
        studentUser.metadata.guardian_id_card = student.guardian_id_card;
        studentUser.metadata.clean_guardian_id_card = cleanCnic;
      }
      studentUser.updated_at = new Date().toISOString();
      student.user_id = studentUser.id;
    }

    // Also synchronize password for any parent user account sharing this CNIC
    if (cleanCnic) {
      const parentUser = Array.from(this.users.values()).find(u => 
        u.tenant_id === tenantId && u.role === 'parent' && (
          (u.metadata as any)?.clean_guardian_id_card === cleanCnic ||
          u.email.toLowerCase() === `guardian.${cleanCnic}@kampus.pk`
        )
      );
      if (parentUser && parentUser.id !== studentUser.id) {
        parentUser.password_hash = pwdHash;
        if (!parentUser.metadata) parentUser.metadata = {};
        parentUser.metadata.password_last_reset_at = new Date().toISOString();
        parentUser.metadata.password_reset_by = options.adminName;
        parentUser.updated_at = new Date().toISOString();
      }
    }

    // Record audit log
    await this.logStudentProfileChange(tenantId, {
      student_id: studentId,
      action: 'RESET_PASSWORD',
      changed_by_user_id: options.adminUserId,
      changed_by_name: options.adminName,
      changes: {
        password: {
          old: '••••••••',
          new: `•••••••• (Reset to ${newPwd})`,
        },
        ...(options.guardianIdCard && previousCnic !== options.guardianIdCard ? {
          guardian_id_card: { old: previousCnic, new: options.guardianIdCard }
        } : {})
      },
      reason: options.reason || 'Administrative password reset request by guardian',
    });

    this.schedulePersist();
    return {
      student,
      user: studentUser,
      default_password: newPwd,
    };
  }

  async bulkImportStudents(
    tenantId: string,
    defaultBatchId?: string,
    rows: Array<any> = [],
    generateInvoices: boolean = true
  ): Promise<{ imported_count: number; failed_count: number; students: Student[]; errors: Array<{ row: number; error: string }> }> {
    const createdList: Student[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const targetBatchId = r.batch_id || defaultBatchId;
      if (!targetBatchId) {
        errors.push({ row: i + 1, error: 'Missing batch_id for student record' });
        continue;
      }
      const batch = this.batches.find(b => b.id === targetBatchId && b.tenant_id === tenantId);
      if (!batch) {
        errors.push({ row: i + 1, error: `Batch ID ${targetBatchId} not found` });
        continue;
      }
      if (batch.current_enrollment >= batch.max_capacity) {
        errors.push({ row: i + 1, error: `Batch '${batch.name}' has reached its maximum capacity of ${batch.max_capacity}` });
        continue;
      }

      try {
        const compGroup = this.subjectGroups.find(g => g.tenant_id === tenantId && g.program_id === batch.program_id && g.type === 'compulsory');
        const subjects = compGroup ? [...compGroup.subject_ids] : [];

        const fs = (r.base_tuition !== undefined || r.admission_fee !== undefined) ? {
          base_tuition: r.base_tuition ?? 0,
          admission_fee: r.admission_fee ?? 0,
          net_tuition: r.base_tuition ?? 0,
          first_month_total: (r.base_tuition ?? 0) + (r.admission_fee ?? 0),
        } : undefined;

        const student = await this.createStudent({
          tenant_id: tenantId,
          full_name: r.full_name,
          phone: r.phone || r.guardian_phone,
          email: r.email,
          guardian_name: r.guardian_name,
          guardian_phone: r.guardian_phone,
          guardian_email: r.guardian_email,
          guardian_id_card: r.guardian_id_card,
          guardian_relation: r.guardian_relation || 'Parent/Guardian',
          gender: r.gender,
          blood_group: r.blood_group,
          date_of_birth: r.date_of_birth,
          student_b_form: r.student_b_form,
          previous_school: r.previous_school,
          religion: r.religion,
          residential_address: r.residential_address,
          city: r.city,
          father_name: r.father_name,
          father_cnic: r.father_cnic,
          father_phone: r.father_phone,
          mother_name: r.mother_name,
          mother_cnic: r.mother_cnic,
          mother_phone: r.mother_phone,
          primary_contact: r.primary_contact || 'father',
          program_id: batch.program_id,
          batch_id: batch.id,
          status: 'active',
          subjects,
          fee_structure: fs,
          generate_first_month_invoice: generateInvoices && Boolean(fs && fs.first_month_total > 0),
          custom_field_values: {},
          roll_number: r.roll_number,
        } as any);

        createdList.push(student);
      } catch (err: any) {
        errors.push({ row: i + 1, error: err.message || 'Failed creating student' });
      }
    }

    this.schedulePersist();
    return {
      imported_count: createdList.length,
      failed_count: errors.length,
      students: createdList,
      errors,
    };
  }

  // --- Phase 3: Rooms & Timetable Engine ---
  async getRooms(tenantId: string): Promise<Room[]> {
    return this.rooms.filter(r => r.tenant_id === tenantId);
  }

  async createRoom(data: Omit<Room, 'id' | 'created_at' | 'updated_at'>): Promise<Room> {
    const room: Room = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.rooms.push(room);
    return room;
  }

  async getTimetable(tenantId: string, batchId?: string, day?: DayOfWeek, date?: string): Promise<TimetableSlot[]> {
    const queryDate = date || new Date().toISOString().split('T')[0];
    return this.timetableSlots
      .filter(s => 
        s.tenant_id === tenantId &&
        (!batchId || s.batch_id === batchId) &&
        (!day || s.day_of_week === day) &&
        !s.is_cancelled
      )
      .map(s => {
        const activeSub = s.substitutions?.find(sub => sub.date === queryDate);
        return {
          ...s,
          substitute_teacher_id: activeSub ? activeSub.substitute_teacher_id : (s.substitutions?.length ? null : (s.substitute_teacher_id || null)),
          substitute_teacher_name: activeSub ? (activeSub.substitute_teacher_name || null) : (s.substitutions?.length ? null : (s.substitute_teacher_name || null)),
        };
      });
  }

  async checkCollision(tenantId: string, slot: {
    batchId: string;
    teacherId: string;
    roomId?: string | null;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    excludeSlotId?: string;
    date?: string;
  }): Promise<TimetableCollisionResult> {
    const geofence = await this.getGeofenceConfig(tenantId);
    const multiRoom = geofence.multi_room_enabled;

    const existingSlots = this.timetableSlots.filter(s => 
      s.tenant_id === tenantId &&
      s.day_of_week === slot.dayOfWeek &&
      !s.is_cancelled &&
      s.id !== slot.excludeSlotId
    );

    for (const existing of existingSlots) {
      // Time overlap check: startA < endB && endA > startB
      const overlaps = slot.startTime < existing.end_time && slot.endTime > existing.start_time;
      if (!overlaps) continue;

      // 1. Batch conflict: Is this batch already scheduled at this time?
      if (existing.batch_id === slot.batchId) {
        return {
          has_conflict: true,
          conflict_type: 'batch_conflict',
          message: `Batch collision: Batch is already scheduled for ${existing.subject_name || 'a class'} from ${existing.start_time} to ${existing.end_time}`,
          conflicting_slot: existing,
        };
      }

      // 2. Teacher conflict: Is the teacher (or substitute) already booked elsewhere?
      let assignedTeacherId = existing.teacher_id;
      if (slot.date && existing.substitutions?.length) {
        const subForDate = existing.substitutions.find(s => s.date === slot.date);
        if (subForDate) {
          assignedTeacherId = subForDate.substitute_teacher_id;
        }
      }
      if (assignedTeacherId === slot.teacherId) {
        return {
          has_conflict: true,
          conflict_type: 'teacher_conflict',
          message: `Teacher collision: ${existing.teacher_name || 'Teacher'} is already scheduled for ${existing.batch_name || 'another batch'} from ${existing.start_time} to ${existing.end_time}`,
          conflicting_slot: existing,
        };
      }

      // 3. Room conflict: Only if multi-room mode is enabled and physical roomId is provided
      if (multiRoom && slot.roomId && existing.room_id && existing.room_id === slot.roomId) {
        return {
          has_conflict: true,
          conflict_type: 'room_conflict',
          message: `Room collision: Room ${existing.room_name || existing.room_id} is already occupied from ${existing.start_time} to ${existing.end_time}`,
          conflicting_slot: existing,
        };
      }
    }

    return { has_conflict: false };
  }

  async createTimetableSlot(data: Omit<TimetableSlot, 'id' | 'created_at' | 'updated_at'>): Promise<TimetableSlot> {
    const collision = await this.checkCollision(data.tenant_id, {
      batchId: data.batch_id,
      teacherId: data.teacher_id,
      roomId: data.room_id,
      dayOfWeek: data.day_of_week,
      startTime: data.start_time,
      endTime: data.end_time,
    });

    if (collision.has_conflict) {
      throw new Error(`Collision detected: ${collision.message}`);
    }

    // Hydrate names if available
    const batch = this.batches.find(b => b.id === data.batch_id && b.tenant_id === data.tenant_id);
    const subject = this.subjects.find(s => s.id === data.subject_id && s.tenant_id === data.tenant_id);
    const teacher = Array.from(this.users.values()).find(u => u.id === data.teacher_id && u.tenant_id === data.tenant_id);
    const room = data.room_id ? this.rooms.find(r => r.id === data.room_id && r.tenant_id === data.tenant_id) : undefined;

    const slot: TimetableSlot = {
      ...data,
      id: crypto.randomUUID(),
      batch_name: batch?.name || data.batch_name,
      subject_name: subject?.name || data.subject_name,
      teacher_name: teacher?.full_name || data.teacher_name,
      room_name: room?.name || data.room_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.timetableSlots.push(slot);
    this.schedulePersist();
    return slot;
  }

  async deleteTimetableSlot(tenantId: string, slotId: string): Promise<boolean> {
    const idx = this.timetableSlots.findIndex(s => s.id === slotId && s.tenant_id === tenantId);
    if (idx < 0) return false;
    this.timetableSlots.splice(idx, 1);
    this.schedulePersist();
    return true;
  }

  async assignSubstitute(tenantId: string, slotId: string, substituteTeacherId: string, date?: string, reason?: string): Promise<TimetableSlot> {
    const slot = this.timetableSlots.find(s => s.id === slotId && s.tenant_id === tenantId);
    if (!slot) throw new Error('Timetable slot not found');

    const substitute = Array.from(this.users.values()).find(u => u.id === substituteTeacherId && u.tenant_id === tenantId);
    if (!substitute) throw new Error('Substitute teacher not found');

    const subDate = date || new Date().toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    // Check if substitute teacher is already engaged during this time on this date
    const collision = await this.checkCollision(tenantId, {
      batchId: 'none', // skip batch collision
      teacherId: substituteTeacherId,
      dayOfWeek: slot.day_of_week,
      startTime: slot.start_time,
      endTime: slot.end_time,
      excludeSlotId: slotId,
      date: subDate,
    });

    if (collision.has_conflict && collision.conflict_type === 'teacher_conflict') {
      throw new Error(`Substitute conflict: Teacher ${substitute.full_name} is already teaching another class during this time.`);
    }

    if (!slot.substitutions) {
      slot.substitutions = [];
    }
    const existingIndex = slot.substitutions.findIndex(s => s.date === subDate);
    const subRecord: TimetableSubstitution = {
      id: crypto.randomUUID(),
      date: subDate,
      substitute_teacher_id: substituteTeacherId,
      substitute_teacher_name: substitute.full_name,
      reason: reason || 'Temporary class cover',
      created_at: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      slot.substitutions[existingIndex] = subRecord;
    } else {
      slot.substitutions.push(subRecord);
    }

    // Do NOT mutate permanent master teacher (slot.teacher_id).
    // slot.substitute_teacher_id is active for today if subDate is today or date omitted.
    if (!date || subDate === today) {
      slot.substitute_teacher_id = substituteTeacherId;
      slot.substitute_teacher_name = substitute.full_name;
    } else {
      const todaySub = slot.substitutions.find(s => s.date === today);
      slot.substitute_teacher_id = todaySub ? todaySub.substitute_teacher_id : null;
      slot.substitute_teacher_name = todaySub ? todaySub.substitute_teacher_name : null;
    }
    slot.updated_at = new Date().toISOString();
    this.schedulePersist();
    return slot;
  }

  async getAvailableTeachers(tenantId: string, dayOfWeek: DayOfWeek, startTime: string, endTime: string, date?: string): Promise<User[]> {
    const allTeachers = Array.from(this.users.values()).filter(u => u.tenant_id === tenantId && (u.role === 'teacher' || u.role === 'tenant_admin'));
    
    // Find teachers with conflicting slots
    const busyTeacherIds = new Set<string>();
    for (const slot of this.timetableSlots) {
      if (slot.tenant_id === tenantId && slot.day_of_week === dayOfWeek && !slot.is_cancelled) {
        const overlaps = startTime < slot.end_time && endTime > slot.start_time;
        if (overlaps) {
          if (date && slot.substitutions?.length) {
            const sub = slot.substitutions.find(s => s.date === date);
            busyTeacherIds.add(sub ? sub.substitute_teacher_id : slot.teacher_id);
          } else {
            busyTeacherIds.add(slot.teacher_id);
          }
        }
      }
    }

    return allTeachers.filter(t => !busyTeacherIds.has(t.id));
  }

  // --- Phase 3: Student Attendance & Leaves ---
  async getStudentAttendance(tenantId: string, batchId?: string, date?: string): Promise<StudentAttendanceRecord[]> {
    return this.studentAttendance.filter(a => 
      a.tenant_id === tenantId && 
      (!batchId || a.batch_id === batchId) && 
      (!date || a.date === date)
    );
  }

  async getStudentAttendanceHistory(tenantId: string, studentId: string): Promise<StudentAttendanceRecord[]> {
    return this.studentAttendance
      .filter(a => a.tenant_id === tenantId && a.student_id === studentId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async getAttendanceAuditLogs(tenantId: string, studentId?: string, date?: string): Promise<AttendanceAuditLog[]> {
    return this.attendanceAuditLogs.filter(log =>
      log.tenant_id === tenantId &&
      (!studentId || log.student_id === studentId) &&
      (!date || log.date === date)
    );
  }

  async recordBatchAttendance(
    tenantId: string,
    batchId: string,
    date: string,
    records: Array<{ student_id: string; status: AttendanceStatus; remarks?: string }>,
    markedBy?: string
  ): Promise<StudentAttendanceRecord[]> {
    const results: StudentAttendanceRecord[] = [];

    // Find active leaves covering this date
    const leaves = this.leaveApplications.filter(l => 
      l.tenant_id === tenantId &&
      l.status === 'approved' &&
      l.start_date <= date &&
      l.end_date >= date
    );
    const excusedStudentIds = new Set(leaves.map(l => l.student_id));

    for (const item of records) {
      const student = this.students.find(s => s.id === item.student_id && s.tenant_id === tenantId);
      if (student && student.status !== 'active') {
        // Inactive, withdrawn, or suspended students are excluded from active batch attendance
        continue;
      }
      const effectiveStatus: AttendanceStatus = excusedStudentIds.has(item.student_id) ? 'excused' : item.status;

      // Upsert record
      const existingIdx = this.studentAttendance.findIndex(a => 
        a.tenant_id === tenantId && a.student_id === item.student_id && a.date === date
      );

      const record: StudentAttendanceRecord = {
        id: existingIdx >= 0 ? this.studentAttendance[existingIdx].id : crypto.randomUUID(),
        tenant_id: tenantId,
        student_id: item.student_id,
        student_name: student?.full_name,
        roll_number: student?.roll_number,
        batch_id: batchId,
        date,
        status: effectiveStatus,
        remarks: excusedStudentIds.has(item.student_id) ? 'Auto-Excused: Approved Leave' : item.remarks,
        marked_by: markedBy,
        check_in_time: effectiveStatus === 'present' ? new Date().toISOString() : undefined,
        created_at: existingIdx >= 0 ? this.studentAttendance[existingIdx].created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        const oldRec = this.studentAttendance[existingIdx];
        if (oldRec.status !== effectiveStatus) {
          const auditLog: AttendanceAuditLog = {
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            student_id: item.student_id,
            student_name: student?.full_name || oldRec.student_name,
            batch_id: batchId,
            date,
            previous_status: oldRec.status,
            new_status: effectiveStatus,
            reason: item.remarks || 'Administrative status modification',
            changed_by: markedBy || 'system',
            created_at: new Date().toISOString()
          };
          this.attendanceAuditLogs.push(auditLog);
        }
        this.studentAttendance[existingIdx] = record;
      } else {
        this.studentAttendance.push(record);
      }
      results.push(record);
    }

    // Interconnection with Absence Follow-Up Desk:
    // 1. Auto-sync newly marked absentees into the daily follow-up roster
    await this.syncDailyAbsenteeRoster(tenantId, date);

    // 2. If any student was previously marked absent but is now updated to present/late/excused, resolve the followup
    for (const item of records) {
      if (item.status !== 'absent') {
        const existingFollowup = this.absenteeFollowups.find(
          f => f.tenant_id === tenantId && f.student_id === item.student_id && f.date === date
        );
        if (existingFollowup && existingFollowup.status === 'PENDING') {
          existingFollowup.status = item.status === 'excused' ? 'RESOLVED_EXCUSED' : 'CONTACTED';
          existingFollowup.parent_remarks = `Attendance revised to ${item.status}`;
          existingFollowup.updated_at = new Date().toISOString();
        }
      }
    }

    this.schedulePersist();
    return results;
  }

  async getLeaveApplications(tenantId: string, studentId?: string): Promise<LeaveApplication[]> {
    return this.leaveApplications.filter(l => 
      l.tenant_id === tenantId && (!studentId || l.student_id === studentId)
    );
  }

  async submitLeaveApplication(data: Omit<LeaveApplication, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<LeaveApplication> {
    const student = this.students.find(s => s.id === data.student_id && s.tenant_id === data.tenant_id);
    const batch = student?.batch_id ? this.batches.find(b => b.id === student.batch_id && b.tenant_id === data.tenant_id) : undefined;

    const leave: LeaveApplication = {
      ...data,
      id: crypto.randomUUID(),
      student_name: student?.full_name || data.student_name,
      batch_name: batch?.name || data.batch_name,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.leaveApplications.push(leave);
    this.schedulePersist();
    return leave;
  }

  async reviewLeaveApplication(tenantId: string, leaveId: string, status: LeaveStatus, reviewNotes?: string, reviewerId?: string): Promise<LeaveApplication> {
    const leave = this.leaveApplications.find(l => l.id === leaveId && l.tenant_id === tenantId);
    if (!leave) throw new Error('Leave application not found');

    leave.status = status;
    leave.review_notes = reviewNotes;
    leave.reviewed_by = reviewerId;
    leave.updated_at = new Date().toISOString();

    // If approved, update existing attendance records within the period to 'excused'
    if (status === 'approved') {
      this.studentAttendance.forEach(att => {
        if (att.tenant_id === tenantId && att.student_id === leave.student_id && att.date >= leave.start_date && att.date <= leave.end_date) {
          att.status = 'excused';
          att.remarks = 'Auto-Excused: Approved Leave';
          att.updated_at = new Date().toISOString();
        }
      });
    }

    this.schedulePersist();
    return leave;
  }

  // --- Staff Leaves Support ---
  async getStaffLeaves(tenantId: string, staffId?: string): Promise<StaffLeaveRecord[]> {
    return this.staffLeaves
      .filter(l => l.tenant_id === tenantId && (!staffId || l.staff_id === staffId))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async submitStaffLeave(data: Omit<StaffLeaveRecord, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<StaffLeaveRecord> {
    const user = Array.from(this.users.values()).find(u => u.id === data.staff_id && u.tenant_id === data.tenant_id);
    const leave: StaffLeaveRecord = {
      ...data,
      id: crypto.randomUUID(),
      staff_name: data.staff_name || user?.full_name || (user as any)?.name || 'Staff Member',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.staffLeaves.push(leave);
    this.schedulePersist();
    return leave;
  }

  async reviewStaffLeave(tenantId: string, leaveId: string, status: 'approved' | 'rejected', reviewNotes?: string, reviewerId?: string): Promise<StaffLeaveRecord> {
    const leave = this.staffLeaves.find(l => l.id === leaveId && l.tenant_id === tenantId);
    if (!leave) throw new Error('Staff leave record not found');

    leave.status = status;
    leave.review_notes = reviewNotes || null;
    leave.reviewed_by = reviewerId || null;
    leave.updated_at = new Date().toISOString();

    this.schedulePersist();
    return leave;
  }

  getStaffMembersForTenant(tenantId: string): User[] {
    return Array.from(this.users.values()).filter(u =>
      u.tenant_id === tenantId &&
      !['super_admin', 'tenant_admin', 'student', 'parent'].includes(u.role) &&
      u.status !== 'archived' &&
      (u.metadata as any)?.status !== 'archived'
    );
  }

  private sanitizeStaffAttendance(tenantId?: string): void {
    // Consolidate duplicate records for same staff on same day: arrival = earliest in, departure = latest out
    const map = new Map<string, StaffAttendanceRecord>();
    for (const rec of this.staffAttendance) {
      if (tenantId && rec.tenant_id !== tenantId) {
        continue;
      }

      const key = `${rec.tenant_id}:${rec.staff_id}:${rec.date}`;
      const clone = { ...rec };
      if (!clone.status) {
        if (clone.head_id?.includes('present') || clone.head_code === 'P' || clone.head_name?.toLowerCase().includes('present')) {
          clone.status = 'on_time';
        } else if (clone.head_id?.includes('late') || clone.head_code === 'L' || clone.head_name?.toLowerCase().includes('late')) {
          clone.status = 'late';
        } else if (clone.head_id?.includes('half') || clone.head_code === 'HD' || clone.head_name?.toLowerCase().includes('half')) {
          clone.status = 'half_day';
        } else if (clone.head_id?.includes('absent') || clone.head_code === 'A' || clone.head_name?.toLowerCase().includes('absent')) {
          clone.status = 'absent';
        } else if (clone.clock_in_time) {
          clone.status = 'on_time';
        } else {
          clone.status = 'absent';
        }
      }

      const existing = map.get(key);
      if (!existing) {
        map.set(key, clone);
      } else {
        const earliestIn = existing.clock_in_time && rec.clock_in_time
          ? (new Date(existing.clock_in_time) < new Date(rec.clock_in_time) ? existing.clock_in_time : rec.clock_in_time)
          : (existing.clock_in_time || rec.clock_in_time);

        const latestOut = existing.clock_out_time && rec.clock_out_time
          ? (new Date(existing.clock_out_time) > new Date(rec.clock_out_time) ? existing.clock_out_time : rec.clock_out_time)
          : (existing.clock_out_time || rec.clock_out_time);

        existing.clock_in_time = earliestIn;
        existing.clock_out_time = latestOut;
        if (earliestIn && latestOut) {
          const inT = new Date(earliestIn).getTime();
          let outT = new Date(latestOut).getTime();
          if (outT < inT) outT += 24 * 60 * 60 * 1000;
          existing.work_duration_minutes = Math.max(0, Math.round((outT - inT) / 60000));
        }
        existing.updated_at = new Date().toISOString();
      }
    }

    if (tenantId) {
      const otherTenantRecs = this.staffAttendance.filter(r => r.tenant_id !== tenantId);
      this.staffAttendance = [...otherTenantRecs, ...map.values()];
    } else {
      this.staffAttendance = Array.from(map.values());
    }
  }

  /**
   * Evaluates attendance head triggers in priority list order (first match wins).
   * Documented Precedence Rule:
   * 1. Manual regularization / override / approved leave always takes ultimate precedence.
   * 2. Heads are tested in order of user-configured priority (1, 2, 3...).
   * 3. For check-in: tests check_in_after, check_in_before, hours_below, hours_at_least.
   * 4. For no-check-in: tests no_check_in trigger.
   * 5. Fallback to first head of matching category (present or absent).
   */
  evaluateHead(
    heads: AttendanceHead[] | undefined,
    params: {
      clockInTime?: string | null;
      clockOutTime?: string | null;
      workDurationMinutes?: number | null;
      isClosedOrPastDate?: boolean;
    }
  ): { head_id: string; head_name: string; head_code: string; status: StaffAttendanceStatus } {
    const list = (heads || [])
      .filter(h => h.is_active !== false)
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
    const { clockInTime, clockOutTime, workDurationMinutes, isClosedOrPastDate } = params;

    const parseTimeToMinutes = (t?: string): number | null => {
      if (!t || !t.includes(':')) return null;
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const getMinutesFromIso = (isoStr?: string | null, timeZone: string = 'Asia/Karachi'): number | null => {
      if (!isoStr) return null;
      try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return null;
        const formatter = new Intl.DateTimeFormat('en-GB', {
          timeZone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const [h, m] = formatter.format(d).split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      } catch {
        const d = new Date(isoStr);
        return d.getHours() * 60 + d.getMinutes();
      }
    };

    const inMinutes = getMinutesFromIso(clockInTime);
    const outMinutes = getMinutesFromIso(clockOutTime);
    const hoursWorked = workDurationMinutes ? workDurationMinutes / 60 : 0;
    const hasCheckedIn = Boolean(clockInTime);
    const hasCheckedOut = Boolean(clockOutTime);

    // -------------------------------------------------------------
    // PASS 1: UNMARKED / ABSENT EVALUATION (No Check-In)
    // -------------------------------------------------------------
    if (!hasCheckedIn) {
      for (const head of list) {
        const trigger = head.trigger;
        if (!trigger || trigger.type !== 'no_check_in') continue;

        if (trigger.time) {
          const cutoff = parseTimeToMinutes(trigger.time);
          let nowMins = 0;
          try {
            const formatter = new Intl.DateTimeFormat('en-GB', {
              timeZone: 'Asia/Karachi',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
            const [h, m] = formatter.format(new Date()).split(':').map(Number);
            nowMins = (h || 0) * 60 + (m || 0);
          } catch {
            nowMins = new Date().getHours() * 60 + new Date().getMinutes();
          }

          if (isClosedOrPastDate || (cutoff !== null && nowMins > cutoff)) {
            return {
              head_id: head.id,
              head_name: head.name,
              head_code: head.code || 'HD',
              status: (head.category as StaffAttendanceStatus) || 'absent',
            };
          }
        } else if (isClosedOrPastDate) {
          return {
            head_id: head.id,
            head_name: head.name,
            head_code: head.code || 'HD',
            status: (head.category as StaffAttendanceStatus) || 'absent',
          };
        }
      }

      // Default unmarked
      const absentHead = list.find(h => h.category === 'absent') || list.find(h => h.kind === 'leave');
      return {
        head_id: absentHead?.id || 'absent-head',
        head_name: absentHead?.name || 'Absent',
        head_code: absentHead?.code || 'A',
        status: 'absent',
      };
    }

    // -------------------------------------------------------------
    // PASS 2: DURATION DEFICIT / EARLY DEPARTURE PRIORITY
    // Once clocked out or day closed, deficits take absolute precedence
    // over on-time arrival (e.g. leaving after 20 mins yields Half Day)
    // -------------------------------------------------------------
    if (hasCheckedOut || isClosedOrPastDate) {
      for (const head of list) {
        const trigger = head.trigger;
        if (!trigger) continue;

        if (trigger.type === 'hours_below') {
          if (trigger.hours !== undefined && hoursWorked < trigger.hours) {
            return {
              head_id: head.id,
              head_name: head.name,
              head_code: head.code || '',
              status: (head.category as StaffAttendanceStatus) || 'half_day',
            };
          }
        } else if (trigger.type === 'hours_between') {
          if (trigger.hours !== undefined && trigger.hours_end !== undefined) {
            if (hoursWorked >= trigger.hours && hoursWorked <= trigger.hours_end) {
              return {
                head_id: head.id,
                head_name: head.name,
                head_code: head.code || '',
                status: (head.category as StaffAttendanceStatus) || 'half_day',
              };
            }
          }
        } else if (trigger.type === 'check_out_before') {
          if (hasCheckedOut && trigger.time) {
            const threshold = parseTimeToMinutes(trigger.time);
            if (threshold !== null && outMinutes !== null && outMinutes < threshold) {
              return {
                head_id: head.id,
                head_name: head.name,
                head_code: head.code || '',
                status: (head.category as StaffAttendanceStatus) || 'half_day',
              };
            }
          }
        } else if (trigger.type === 'check_out_between') {
          if (hasCheckedOut && trigger.time && trigger.time_end) {
            const start = parseTimeToMinutes(trigger.time);
            const end = parseTimeToMinutes(trigger.time_end);
            if (start !== null && end !== null && outMinutes !== null && outMinutes >= start && outMinutes <= end) {
              return {
                head_id: head.id,
                head_name: head.name,
                head_code: head.code || '',
                status: (head.category as StaffAttendanceStatus) || 'half_day',
              };
            }
          }
        }
      }
    }

    // -------------------------------------------------------------
    // PASS 3: ARRIVAL PUNCTUALITY (Late Arrival vs On-Time)
    // -------------------------------------------------------------
    for (const head of list) {
      const trigger = head.trigger;
      if (!trigger) continue;

      if (trigger.type === 'check_in_after') {
        const threshold = parseTimeToMinutes(trigger.time);
        if (threshold !== null && inMinutes !== null && inMinutes > threshold) {
          return {
            head_id: head.id,
            head_name: head.name,
            head_code: head.code || '',
            status: (head.category as StaffAttendanceStatus) || 'late',
          };
        }
      } else if (trigger.type === 'check_in_between') {
        if (trigger.time && trigger.time_end) {
          const start = parseTimeToMinutes(trigger.time);
          const end = parseTimeToMinutes(trigger.time_end);
          if (start !== null && end !== null && inMinutes !== null && inMinutes >= start && inMinutes <= end) {
            return {
              head_id: head.id,
              head_name: head.name,
              head_code: head.code || '',
              status: (head.category as StaffAttendanceStatus) || 'late',
            };
          }
        }
      } else if (trigger.type === 'check_in_before') {
        const threshold = parseTimeToMinutes(trigger.time);
        if (threshold !== null && inMinutes !== null && inMinutes <= threshold) {
          return {
            head_id: head.id,
            head_name: head.name,
            head_code: head.code || '',
            status: (head.category as StaffAttendanceStatus) || 'on_time',
          };
        }
      }
    }

    // -------------------------------------------------------------
    // PASS 4: FULL SHIFT COMPLETION
    // -------------------------------------------------------------
    if (hasCheckedOut || isClosedOrPastDate) {
      for (const head of list) {
        const trigger = head.trigger;
        if (!trigger) continue;

        if (trigger.type === 'hours_at_least') {
          if (trigger.hours !== undefined && hoursWorked >= trigger.hours) {
            return {
              head_id: head.id,
              head_name: head.name,
              head_code: head.code || '',
              status: (head.category as StaffAttendanceStatus) || 'on_time',
            };
          }
        } else if (trigger.type === 'check_out_after') {
          if (hasCheckedOut && trigger.time) {
            const threshold = parseTimeToMinutes(trigger.time);
            if (threshold !== null && outMinutes !== null && outMinutes >= threshold) {
              return {
                head_id: head.id,
                head_name: head.name,
                head_code: head.code || '',
                status: (head.category as StaffAttendanceStatus) || 'on_time',
              };
            }
          }
        }
      }
    }

    // Default fallback if no custom rule fired
    if (hasCheckedIn) {
      const presentHead = list.find(h => h.category === 'present');
      if (presentHead) {
        return {
          head_id: presentHead.id,
          head_name: presentHead.name,
          head_code: presentHead.code || 'P',
          status: 'on_time',
        };
      }
      return {
        head_id: 'default-present',
        head_name: 'Present',
        head_code: 'P',
        status: 'on_time',
      };
    }

    const absentHead = list.find(h => h.category === 'absent');
    if (absentHead) {
      return {
        head_id: absentHead.id,
        head_name: absentHead.name,
        head_code: absentHead.code || 'A',
        status: 'absent',
      };
    }
    return {
      head_id: 'default-absent',
      head_name: 'Absent',
      head_code: 'A',
      status: 'absent',
    };
  }

  // --- Phase 3: Campus Geofence & Staff Attendance ---
  async getGeofenceConfig(tenantId: string): Promise<CampusGeofenceConfig> {
    const config = this.geofenceConfigs.get(tenantId);
    if (config) {
      if (!config.heads) {
        config.heads = (config.attendance_heads as any) || [];
      }
      return config;
    }

    // Default configuration for tenant
    const defaultConfig: CampusGeofenceConfig = {
      tenant_id: tenantId,
      campus_name: 'Gulberg III Campus',
      latitude: 31.5204,
      longitude: 74.3587,
      radius_meters: 150,
      heads: [],
      enforcement_mode: 'strict',
      multi_room_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.geofenceConfigs.set(tenantId, defaultConfig);
    return defaultConfig;
  }

  async updateGeofenceConfig(tenantId: string, updates: Partial<CampusGeofenceConfig>): Promise<CampusGeofenceConfig> {
    const current = await this.getGeofenceConfig(tenantId);

    let mergedHeads = current.heads || [];
    if (updates.heads) {
      const newHeadIds = new Set(updates.heads.map(h => h.id));
      // Archive heads no longer in the active list rather than orphaning old rows
      const archivedOldHeads = (current.heads || [])
        .filter(h => !newHeadIds.has(h.id))
        .map(h => ({ ...h, is_active: false }));

      mergedHeads = [
        ...updates.heads.map((h, index) => ({
          ...h,
          priority: h.priority !== undefined ? h.priority : index + 1,
          is_active: true,
        })),
        ...archivedOldHeads,
      ];
    }

    const updated: CampusGeofenceConfig = {
      ...current,
      ...updates,
      heads: mergedHeads,
      tenant_id: tenantId,
      updated_at: new Date().toISOString(),
    };
    this.geofenceConfigs.set(tenantId, updated);
    this.schedulePersist();
    return updated;
  }

  async staffClockIn(tenantId: string, staffId: string, staffName: string, lat: number, lng: number): Promise<StaffAttendanceRecord> {
    const config = await this.getGeofenceConfig(tenantId);

    // Calculate distance using Haversine formula
    const R = 6371000; // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat - config.latitude);
    const dLon = toRad(lng - config.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(config.latitude)) * Math.cos(toRad(lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = Math.round(R * c);

    const isOutside = distanceMeters > config.radius_meters;
    if (isOutside && config.enforcement_mode !== 'flagged') {
      throw new Error(`Clock-in rejected: Outside campus boundary (${distanceMeters}m away, maximum allowed radius is ${config.radius_meters}m)`);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const dateStr = nowIso.split('T')[0];

    // Resolve accurate user full name
    const user = Array.from(this.users.values()).find(u => u.id === staffId);
    const resolvedName = user?.full_name || staffName || 'Staff Member';

    // Check if record already exists for today
    let record = this.staffAttendance.find(s => s.tenant_id === tenantId && s.staff_id === staffId && s.date === dateStr);
    if (record) {
      if (record.clock_out_time) {
        // Multi-session punch: Shift was previously closed, now starting a subsequent session (e.g. evening academy batch)
        if (!record.sessions || record.sessions.length === 0) {
          record.sessions = [
            {
              in: record.clock_in_time || nowIso,
              out: record.clock_out_time,
              duration_minutes: record.work_duration_minutes || 0,
              in_lat: record.clock_in_lat,
              in_lng: record.clock_in_lng,
              out_lat: record.clock_out_lat ?? undefined,
              out_lng: record.clock_out_lng ?? undefined,
            }
          ];
        }
        const sessions = record.sessions;
        // Avoid accidental double tap within 2 minutes of clocking out
        const lastSession = sessions[sessions.length - 1];
        if (lastSession?.out) {
          const elapsed = (now.getTime() - new Date(lastSession.out).getTime()) / 1000;
          if (elapsed < 120) {
            return record;
          }
        }
        // Append new session
        sessions.push({
          in: nowIso,
          in_lat: lat,
          in_lng: lng,
        });
        record.clock_out_time = null;
        record.clock_out_lat = null;
        record.clock_out_lng = null;
        record.updated_at = nowIso;
        this.schedulePersist();
        return record;
      }

      // Discard accidental double-tap/retry within 2 minutes
      const lastActionIso = record.updated_at || record.clock_in_time || nowIso;
      const lastActionTime = new Date(lastActionIso).getTime();
      const elapsedSeconds = (now.getTime() - lastActionTime) / 1000;
      if (elapsedSeconds < 120 && record.clock_in_time) {
        return record;
      }

      // First punch of the day remains arrival! Do not overwrite clock_in_time
      record.updated_at = nowIso;
      this.schedulePersist();
      return record;
    }

    // Evaluate head trigger for arrival
    const evaluated = this.evaluateHead(config.heads, {
      clockInTime: nowIso,
      isClosedOrPastDate: false,
    });

    record = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      staff_id: staffId,
      staff_name: resolvedName,
      date: dateStr,
      clock_in_time: nowIso,
      clock_in_lat: lat,
      clock_in_lng: lng,
      distance_meters: distanceMeters,
      status: evaluated.status,
      head_id: evaluated.head_id,
      head_name: evaluated.head_name,
      head_code: evaluated.head_code,
      is_geofence_verified: !isOutside,
      verification_mode: 'geofence',
      sessions: [
        {
          in: nowIso,
          in_lat: lat,
          in_lng: lng,
        }
      ],
      created_at: nowIso,
      updated_at: nowIso,
    };

    this.staffAttendance.push(record);
    this.schedulePersist();
    return record;
  }

  async staffClockOut(tenantId: string, staffId: string, lat: number, lng: number): Promise<StaffAttendanceRecord> {
    const config = await this.getGeofenceConfig(tenantId);

    // Calculate distance using Haversine formula
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat - config.latitude);
    const dLon = toRad(lng - config.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(config.latitude)) * Math.cos(toRad(lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = Math.round(R * c);

    const isOutside = distanceMeters > config.radius_meters;
    if (isOutside && config.enforcement_mode !== 'flagged') {
      throw new Error(`Clock-out rejected: Outside campus boundary (${distanceMeters}m away, maximum allowed radius is ${config.radius_meters}m)`);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const dateStr = nowIso.split('T')[0];

    // 1. Search for an unclosed clock-in for today (either clock_out_time is null OR last session has no out)
    let record = this.staffAttendance.find(
      s => s.tenant_id === tenantId && s.staff_id === staffId && s.date === dateStr && (!s.clock_out_time || (s.sessions && s.sessions.length > 0 && !s.sessions[s.sessions.length - 1].out))
    );

    // 2. If not found, look back 18 hours for an unclosed shift started yesterday (night shift crossing midnight)
    if (!record) {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      record = this.staffAttendance.find(
        s => s.tenant_id === tenantId && s.staff_id === staffId && s.date === yesterday && (!s.clock_out_time || (s.sessions && s.sessions.length > 0 && !s.sessions[s.sessions.length - 1].out))
      );
    }

    // 3. Fallback to today's record even if already closed (allows updating clock out time)
    if (!record) {
      record = this.staffAttendance.find(
        s => s.tenant_id === tenantId && s.staff_id === staffId && s.date === dateStr
      );
    }

    if (!record) {
      throw new Error('No active clock-in record found for today. Please clock in first.');
    }

    // Discard accidental double-tap on clock out within 2 minutes
    if (record.clock_out_time) {
      const lastOutTime = new Date(record.clock_out_time).getTime();
      const elapsedSeconds = (now.getTime() - lastOutTime) / 1000;
      if (elapsedSeconds < 120) {
        return record;
      }
    }

    // Ensure sessions array exists and close the current session
    if (!record.sessions || record.sessions.length === 0) {
      record.sessions = [
        {
          in: record.clock_in_time || nowIso,
          in_lat: record.clock_in_lat,
          in_lng: record.clock_in_lng,
        }
      ];
    }
    const sessions = record.sessions;
    const currentSession = sessions[sessions.length - 1];
    if (currentSession && !currentSession.out) {
      currentSession.out = nowIso;
      currentSession.out_lat = lat;
      currentSession.out_lng = lng;
      const sIn = new Date(currentSession.in).getTime();
      let sOut = now.getTime();
      if (sOut < sIn) sOut += 24 * 60 * 60 * 1000;
      currentSession.duration_minutes = Math.max(0, Math.round((sOut - sIn) / 60000));
    }

    // Last punch of the day = departure
    record.clock_out_time = nowIso;
    record.clock_out_lat = lat;
    record.clock_out_lng = lng;

    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    record.work_duration_minutes = totalDuration;

    // Re-evaluate head trigger considering total hours worked across all sessions
    if (!record.admin_adjusted) {
      const evaluated = this.evaluateHead(config.heads, {
        clockInTime: record.clock_in_time,
        clockOutTime: record.clock_out_time,
        workDurationMinutes: record.work_duration_minutes,
        isClosedOrPastDate: false,
      });
      record.status = evaluated.status;
      record.head_id = evaluated.head_id;
      record.head_name = evaluated.head_name;
      record.head_code = evaluated.head_code;
    }

    record.updated_at = nowIso;
    this.schedulePersist();
    return record;
  }

  async getStaffAttendance(tenantId: string, date?: string): Promise<StaffAttendanceRecord[]> {
    this.sanitizeStaffAttendance(tenantId);
    return this.staffAttendance.filter(s => 
      s.tenant_id === tenantId && (!date || s.date === date)
    );
  }

  async getStaffRoster(tenantId: string, date?: string): Promise<DailyStaffRosterEntry[]> {
    const dateStr = date || new Date().toISOString().split('T')[0];
    const isPast = dateStr < new Date().toISOString().split('T')[0];

    const config = await this.getGeofenceConfig(tenantId);
    const heads = config.heads || [];

    // Strictly real staff members from the staff module
    const users = this.getStaffMembersForTenant(tenantId);
    this.sanitizeStaffAttendance(tenantId);
    const records = this.staffAttendance.filter(s => s.tenant_id === tenantId && s.date === dateStr);

    const staffLeaves = this.staffLeaves.filter(l =>
      l.tenant_id === tenantId &&
      l.status === 'approved' &&
      l.start_date <= dateStr &&
      l.end_date >= dateStr
    );
    const legacyLeaves = this.leaveApplications.filter(l =>
      l.tenant_id === tenantId &&
      l.status === 'approved' &&
      l.start_date <= dateStr &&
      l.end_date >= dateStr
    );

    return users.map(user => {
      const uName = user.full_name || (user as any).name || 'Staff Member';
      const rec = records.find(r => r.staff_id === user.id || r.staff_id === (user.metadata?.employee_code as string));
      const leave = staffLeaves.find(l => l.staff_id === user.id) || legacyLeaves.find(l => (l as any).staff_id === user.id);
      const empCode = (user.metadata?.employee_code as string) || (user as any).employee_code || `EMP-${user.id.slice(0, 4).toUpperCase()}`;
      const dept = (user.metadata?.department as string) || (user as any).department || 'General';
      const designation = (user.metadata?.designation as string) || (user as any).designation || (user.role === 'teacher' ? 'Faculty Member' : 'Staff');

      if (rec) {
        return {
          staff_id: user.id,
          staff_name: uName,
          employee_code: empCode,
          department: dept,
          designation: designation,
          date: dateStr,
          status: rec.status,
          head_id: rec.head_id || null,
          head_name: rec.head_name || null,
          head_code: rec.head_code || null,
          clock_in_time: rec.clock_in_time,
          clock_out_time: rec.clock_out_time || null,
          work_duration_minutes: rec.work_duration_minutes ?? null,
          early_departure: rec.early_departure,
          distance_meters: rec.distance_meters,
          is_geofence_verified: rec.is_geofence_verified,
          verification_mode: rec.verification_mode || 'geofence',
          admin_adjusted: rec.admin_adjusted,
          admin_adjustment_notes: rec.admin_adjustment_notes,
          record_id: rec.id,
          sessions: rec.sessions,
        };
      }

      if (leave) {
        const leaveHead = heads.find(h => h.category === 'leave');
        return {
          staff_id: user.id,
          staff_name: uName,
          employee_code: empCode,
          department: dept,
          designation: designation,
          date: dateStr,
          status: 'on_leave',
          head_id: leaveHead?.id || null,
          head_name: leaveHead?.name || `Approved Leave (${leave.category})`,
          head_code: leaveHead?.code || 'LV',
          clock_in_time: null,
          clock_out_time: null,
          work_duration_minutes: null,
          is_geofence_verified: false,
          verification_mode: undefined,
          admin_adjusted: false,
          admin_adjustment_notes: `Approved Leave (${leave.category})`,
          record_id: null,
        };
      }

      if (isPast) {
        const evaluated = this.evaluateHead(heads, { isClosedOrPastDate: true });
        return {
          staff_id: user.id,
          staff_name: uName,
          employee_code: empCode,
          department: dept,
          designation: designation,
          date: dateStr,
          status: evaluated.status,
          head_id: evaluated.head_id,
          head_name: evaluated.head_name,
          head_code: evaluated.head_code,
          clock_in_time: null,
          clock_out_time: null,
          work_duration_minutes: null,
          is_geofence_verified: false,
          verification_mode: undefined,
          admin_adjusted: false,
          admin_adjustment_notes: null,
          record_id: null,
        };
      }

      // Today - check if a no-check-in cutoff has elapsed
      const evaluatedToday = this.evaluateHead(heads, { isClosedOrPastDate: false });
      const noCheckInMatched = heads.some(h => h.trigger?.type === 'no_check_in' && h.id === evaluatedToday?.head_id);

      return {
        staff_id: user.id,
        staff_name: uName,
        employee_code: empCode,
        department: dept,
        designation: designation,
        date: dateStr,
        status: noCheckInMatched ? evaluatedToday.status : 'not_marked',
        head_id: noCheckInMatched ? evaluatedToday.head_id : null,
        head_name: noCheckInMatched ? evaluatedToday.head_name : null,
        head_code: noCheckInMatched ? evaluatedToday.head_code : null,
        clock_in_time: null,
        clock_out_time: null,
        work_duration_minutes: null,
        is_geofence_verified: false,
        verification_mode: undefined,
        admin_adjusted: false,
        admin_adjustment_notes: null,
        record_id: null,
      };
    });
  }

  async getStaffMonthlySummary(tenantId: string, monthStr: string): Promise<StaffMonthlyAttendanceSummary[]> {
    const [year, month] = monthStr.split('-').map(Number);
    const totalCalendarDays = new Date(year, month, 0).getDate();

    const users = this.getStaffMembersForTenant(tenantId);
    this.sanitizeStaffAttendance(tenantId);
    const monthRecords = this.staffAttendance.filter(s =>
      s.tenant_id === tenantId && s.date.startsWith(monthStr)
    );

    const staffLeaves = this.staffLeaves.filter(l =>
      l.tenant_id === tenantId &&
      l.status === 'approved' &&
      (l.start_date.startsWith(monthStr) || l.end_date.startsWith(monthStr))
    );

    return users.map(user => {
      const uName = user.full_name || (user as any).name || 'Staff Member';
      const empCode = (user.metadata?.employee_code as string) || (user as any).employee_code || `EMP-${user.id.slice(0, 4).toUpperCase()}`;
      const dept = (user.metadata?.department as string) || (user as any).department || 'General';
      const designation = (user.metadata?.designation as string) || (user as any).designation || (user.role === 'teacher' ? 'Faculty Member' : 'Staff');

      // Edge case: Staff added mid-month - calculate working days only from their enrollment window
      const joiningDateStr = (user.metadata?.joining_date as string) || (user as any).joining_date || user.created_at?.split('T')[0];
      let startDay = 1;
      if (joiningDateStr && joiningDateStr.startsWith(monthStr)) {
        startDay = Math.max(1, parseInt(joiningDateStr.split('-')[2], 10) || 1);
      } else if (joiningDateStr && joiningDateStr > `${monthStr}-${String(totalCalendarDays).padStart(2, '0')}`) {
        startDay = totalCalendarDays + 1; // Joined after this month
      }

      let totalWorkingDays = 0;
      for (let day = startDay; day <= totalCalendarDays; day++) {
        const d = new Date(year, month - 1, day);
        if (d.getDay() !== 0) { // Exclude Sundays
          totalWorkingDays++;
        }
      }

      const userRecs = monthRecords.filter(r =>
        r.staff_id === user.id || r.staff_id === empCode
      );

      let presentCount = 0;
      let lateCount = 0;
      let halfDayCount = 0;
      let totalMinutes = 0;
      let geofenceVerifiedCount = 0;

      userRecs.forEach(r => {
        if (r.status === 'on_time') presentCount++;
        else if (r.status === 'late') lateCount++;
        else if (r.status === 'half_day') halfDayCount++;
        if (r.work_duration_minutes) totalMinutes += r.work_duration_minutes;
        if (r.is_geofence_verified) geofenceVerifiedCount++;
      });

      let leaveDays = 0;
      staffLeaves.filter(l => l.staff_id === user.id).forEach(l => {
        const start = new Date(l.start_date).getTime();
        const end = new Date(l.end_date).getTime();
        const diffDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
        leaveDays += (l as any).days || diffDays;
      });

      const accountedDays = presentCount + lateCount + halfDayCount + leaveDays;
      const absentDays = Math.max(0, totalWorkingDays - accountedDays);

      const presentEquivalent = presentCount + lateCount + halfDayCount * 0.5;
      const netRequiredDays = Math.max(1, totalWorkingDays - leaveDays);
      const attendancePercentage = totalWorkingDays > 0 ? Math.min(100, Math.round((presentEquivalent / netRequiredDays) * 100)) : 0;

      return {
        staff_id: user.id,
        staff_name: uName,
        employee_code: empCode,
        department: dept,
        designation: designation,
        month: monthStr,
        total_calendar_days: totalCalendarDays,
        total_working_days: totalWorkingDays,
        present_days: presentCount,
        late_days: lateCount,
        half_days: halfDayCount,
        leave_days: leaveDays,
        absent_days: absentDays,
        total_work_minutes: totalMinutes,
        geofence_verified_count: geofenceVerifiedCount,
        attendance_percentage: attendancePercentage,
      };
    });
  }

  async manualStaffAttendance(
    tenantId: string,
    data: {
      staff_id: string;
      staff_name?: string;
      date: string;
      status: StaffAttendanceStatus;
      head_id?: string;
      clock_in_time?: string;
      clock_out_time?: string;
      reason: string;
      verification_mode?: 'manual_regularization' | 'official_duty';
      adjusted_by?: string;
    }
  ): Promise<StaffAttendanceRecord> {
    const nowIso = new Date().toISOString();
    const user = Array.from(this.users.values()).find(u => u.id === data.staff_id && u.tenant_id === tenantId);
    const resolvedName = data.staff_name || user?.full_name || 'Staff Member';

    const config = await this.getGeofenceConfig(tenantId);
    const heads = config.heads || [];
    const selectedHead = data.head_id ? heads.find(h => h.id === data.head_id) : undefined;
    const finalStatus = selectedHead ? (selectedHead.category as StaffAttendanceStatus) : data.status;

    let inIso = data.clock_in_time;
    if (inIso && !inIso.includes('T')) {
      inIso = `${data.date}T${inIso}:00.000Z`;
    }
    let outIso = data.clock_out_time;
    if (outIso && !outIso.includes('T')) {
      outIso = `${data.date}T${outIso}:00.000Z`;
    }

    let durationMins: number | null = null;
    if (inIso && outIso) {
      const inT = new Date(inIso).getTime();
      let outT = new Date(outIso).getTime();
      if (outT < inT) outT += 24 * 60 * 60 * 1000;
      durationMins = Math.max(0, Math.round((outT - inT) / 60000));
    }

    let record = this.staffAttendance.find(s => s.tenant_id === tenantId && s.staff_id === data.staff_id && s.date === data.date);
    const prevStatus = record ? record.status : null;
    const prevClockIn = record ? record.clock_in_time : null;
    const prevClockOut = record ? record.clock_out_time : null;
    const isNew = !record;

    if (record) {
      record.status = finalStatus;
      if (selectedHead) {
        record.head_id = selectedHead.id;
        record.head_name = selectedHead.name;
        record.head_code = selectedHead.code || null;
      }
      record.clock_in_time = inIso || null;
      record.clock_out_time = outIso || null;
      record.work_duration_minutes = durationMins;
      record.admin_adjusted = true;
      record.admin_adjustment_notes = data.reason;
      record.adjusted_by = data.adjusted_by || 'Administrator';
      record.verification_mode = data.verification_mode || 'manual_regularization';
      record.updated_at = nowIso;
    } else {
      const newRecord: StaffAttendanceRecord = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        staff_id: data.staff_id,
        staff_name: resolvedName,
        date: data.date,
        clock_in_time: inIso || null,
        clock_out_time: outIso || null,
        clock_in_lat: config.latitude,
        clock_in_lng: config.longitude,
        distance_meters: 0,
        status: finalStatus,
        head_id: selectedHead?.id || null,
        head_name: selectedHead?.name || null,
        head_code: selectedHead?.code || null,
        is_geofence_verified: true,
        verification_mode: data.verification_mode || 'manual_regularization',
        work_duration_minutes: durationMins,
        admin_adjusted: true,
        admin_adjustment_notes: data.reason,
        adjusted_by: data.adjusted_by || 'Administrator',
        created_at: nowIso,
        updated_at: nowIso,
      };
      this.staffAttendance.push(newRecord);
      record = newRecord;
    }

    if (!record) {
      throw new Error('Failed to create or update staff attendance record');
    }

    // Record institutional audit log entry
    const auditLog: StaffAttendanceAuditLog = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      record_id: record.id,
      staff_id: data.staff_id,
      staff_name: record.staff_name,
      date: data.date,
      action: isNew ? 'created' : 'regularized',
      previous_status: prevStatus,
      new_status: finalStatus,
      head_id: selectedHead?.id || null,
      head_name: selectedHead?.name || null,
      previous_clock_in: prevClockIn,
      new_clock_in: record.clock_in_time,
      previous_clock_out: prevClockOut,
      new_clock_out: record.clock_out_time,
      reason_head: data.reason,
      notes: data.reason,
      adjusted_by: data.adjusted_by || 'Administrator',
      created_at: nowIso,
    };
    this.staffAttendanceAuditLogs.push(auditLog);
    this.schedulePersist();

    return record;
  }

  async adjustStaffAttendance(tenantId: string, id: string, status: StaffAttendanceStatus, notes: string): Promise<StaffAttendanceRecord> {
    const record = this.staffAttendance.find(s => s.id === id && s.tenant_id === tenantId);
    if (!record) throw new Error('Staff attendance record not found');

    const prevStatus = record.status;
    const nowIso = new Date().toISOString();
    record.status = status;
    record.admin_adjusted = true;
    record.admin_adjustment_notes = notes;
    record.updated_at = nowIso;

    // Record institutional audit log entry
    const auditLog: StaffAttendanceAuditLog = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      record_id: record.id,
      staff_id: record.staff_id,
      staff_name: record.staff_name,
      date: record.date,
      action: 'status_override',
      previous_status: prevStatus,
      new_status: status,
      previous_clock_in: record.clock_in_time,
      new_clock_in: record.clock_in_time,
      previous_clock_out: record.clock_out_time,
      new_clock_out: record.clock_out_time,
      reason_head: notes,
      notes,
      adjusted_by: 'Administrator',
      created_at: nowIso,
    };
    this.staffAttendanceAuditLogs.push(auditLog);
    this.schedulePersist();

    return record;
  }

  async getStaffAttendanceAuditLogs(
    tenantId: string,
    options?: { staff_id?: string; date?: string; start_date?: string; end_date?: string }
  ): Promise<StaffAttendanceAuditLog[]> {
    return this.staffAttendanceAuditLogs
      .filter(log => {
        if (log.tenant_id !== tenantId) return false;
        if (options?.staff_id && log.staff_id !== options.staff_id) return false;
        if (options?.date && log.date !== options.date) return false;
        if (options?.start_date && log.date < options.start_date) return false;
        if (options?.end_date && log.date > options.end_date) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getStaffRegularizationRequests(
    tenantId: string,
    options?: { staff_id?: string; status?: string }
  ): Promise<StaffRegularizationRequest[]> {
    return this.staffRegularizationRequests
      .filter(req => {
        if (req.tenant_id !== tenantId) return false;
        if (options?.staff_id && req.staff_id !== options.staff_id) return false;
        if (options?.status && req.status !== options.status) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async submitStaffRegularizationRequest(
    tenantId: string,
    data: {
      staff_id: string;
      staff_name?: string;
      date: string;
      clock_in_time?: string;
      clock_out_time?: string;
      reason_type: string;
      notes?: string;
    }
  ): Promise<StaffRegularizationRequest> {
    const user = Array.from(this.users.values()).find(u => u.id === data.staff_id && u.tenant_id === tenantId);
    const resolvedName = data.staff_name || user?.full_name || (user as any)?.name || 'Staff Member';
    const empCode = (user?.metadata?.employee_code as string) || (user as any)?.employee_code;
    const dept = (user?.metadata?.department as string) || (user as any)?.department;
    const designation = (user?.metadata?.designation as string) || (user as any)?.designation || (user?.role === 'teacher' ? 'Faculty Member' : 'Staff');

    const nowIso = new Date().toISOString();
    const request: StaffRegularizationRequest = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      staff_id: data.staff_id,
      staff_name: resolvedName,
      employee_code: empCode,
      department: dept,
      designation: designation,
      date: data.date,
      clock_in_time: data.clock_in_time || null,
      clock_out_time: data.clock_out_time || null,
      reason_type: data.reason_type,
      notes: data.notes || null,
      status: 'pending',
      created_at: nowIso,
      updated_at: nowIso,
    };

    this.staffRegularizationRequests.push(request);
    this.schedulePersist();
    return request;
  }

  async reviewStaffRegularizationRequest(
    tenantId: string,
    requestId: string,
    action: 'approved' | 'rejected',
    reviewer: string,
    reviewNotes?: string,
    headId?: string
  ): Promise<StaffRegularizationRequest> {
    const req = this.staffRegularizationRequests.find(r => r.id === requestId && r.tenant_id === tenantId);
    if (!req) {
      throw new Error('Attendance regularization request not found.');
    }

    const nowIso = new Date().toISOString();
    req.status = action;
    req.reviewed_by = reviewer;
    req.review_notes = reviewNotes || null;
    req.updated_at = nowIso;

    if (action === 'approved') {
      await this.manualStaffAttendance(tenantId, {
        staff_id: req.staff_id,
        staff_name: req.staff_name,
        date: req.date,
        status: 'on_time',
        head_id: headId,
        clock_in_time: req.clock_in_time || undefined,
        clock_out_time: req.clock_out_time || undefined,
        reason: `Regularization Approved: ${req.reason_type}${req.notes ? ` (${req.notes})` : ''}`,
        verification_mode: req.reason_type.toLowerCase().includes('duty') ? 'official_duty' : 'manual_regularization',
        adjusted_by: reviewer,
      });
    }

    this.schedulePersist();
    return req;
  }

  // --- Phase 3: Homework Diary & Physical Notebook Checking ---
  async getHomework(tenantId: string, batchId?: string): Promise<HomeworkAssignment[]> {
    return this.homeworkAssignments.filter(h => 
      h.tenant_id === tenantId && (!batchId || h.batch_id === batchId)
    );
  }

  async createHomework(data: Omit<HomeworkAssignment, 'id' | 'created_at'>): Promise<HomeworkAssignment> {
    const batch = this.batches.find(b => b.id === data.batch_id && b.tenant_id === data.tenant_id);
    const subject = this.subjects.find(s => s.id === data.subject_id && s.tenant_id === data.tenant_id);

    const hw: HomeworkAssignment = {
      ...data,
      id: crypto.randomUUID(),
      batch_name: batch?.name || data.batch_name,
      subject_name: subject?.name || data.subject_name,
      created_at: new Date().toISOString(),
    };

    this.homeworkAssignments.push(hw);
    this.schedulePersist();
    return hw;
  }

  async recordNotebookChecks(
    tenantId: string,
    assignmentId: string,
    checks: Array<{ student_id: string; status: NotebookStatus; remarks?: string }>,
    checkedBy: string
  ): Promise<NotebookCheckRecord[]> {
    const results: NotebookCheckRecord[] = [];
    const nowIso = new Date().toISOString();

    for (const item of checks) {
      const student = this.students.find(s => s.id === item.student_id && s.tenant_id === tenantId);
      const existingIdx = this.notebookChecks.findIndex(c => 
        c.tenant_id === tenantId && c.assignment_id === assignmentId && c.student_id === item.student_id
      );

      const checkRecord: NotebookCheckRecord = {
        id: existingIdx >= 0 ? this.notebookChecks[existingIdx].id : crypto.randomUUID(),
        tenant_id: tenantId,
        assignment_id: assignmentId,
        student_id: item.student_id,
        student_name: student?.full_name,
        roll_number: student?.roll_number,
        status: item.status,
        remarks: item.remarks,
        checked_by: checkedBy,
        checked_at: nowIso,
      };

      if (existingIdx >= 0) {
        this.notebookChecks[existingIdx] = checkRecord;
      } else {
        this.notebookChecks.push(checkRecord);
      }
      results.push(checkRecord);
    }

    this.schedulePersist();
    return results;
  }

  async getNotebookChecks(tenantId: string, assignmentId: string): Promise<NotebookCheckRecord[]> {
    return this.notebookChecks.filter(c => 
      c.tenant_id === tenantId && c.assignment_id === assignmentId
    );
  }

  // --- Phase 3: Complaints & Feedback ---
  async getComplaints(tenantId: string): Promise<ComplaintTicket[]> {
    return this.complaints.filter(c => c.tenant_id === tenantId);
  }

  async createComplaint(data: Omit<ComplaintTicket, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<ComplaintTicket> {
    const count = this.complaints.filter(c => c.tenant_id === data.tenant_id).length + 1;
    const ticket: ComplaintTicket = {
      ...data,
      id: crypto.randomUUID(),
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.complaints.push(ticket);
    return ticket;
  }

  async updateComplaintStatus(
    tenantId: string,
    id: string,
    status: ComplaintStatus,
    resolutionReply?: string,
    internalNotes?: string,
    resolvedBy?: string
  ): Promise<ComplaintTicket> {
    const ticket = this.complaints.find(c => c.id === id && c.tenant_id === tenantId);
    if (!ticket) throw new Error('Complaint ticket not found');

    ticket.status = status;
    if (resolutionReply !== undefined) ticket.resolution_reply = resolutionReply;
    if (internalNotes !== undefined) ticket.internal_notes = internalNotes;
    if (resolvedBy !== undefined) ticket.resolved_by = resolvedBy;
    if (status === 'resolved') ticket.resolved_at = new Date().toISOString();
    ticket.updated_at = new Date().toISOString();

    return ticket;
  }

  // =============================================================================
  // PHASE 4: FINANCE, FEE INVOICING, AUTO-DISTRIBUTION & PAYROLL (MODULES 7, 8, 14)
  // =============================================================================

  // --- Fee Heads & Priority Configuration ---
  async getFeeHeads(tenantId: string): Promise<FeeHead[]> {
    return this.feeHeads.filter(h => h.tenant_id === tenantId).sort((a, b) => a.priority_order - b.priority_order);
  }

  async createFeeHead(data: Omit<FeeHead, 'id' | 'created_at'>): Promise<FeeHead> {
    const head: FeeHead = {
      ...data,
      id: crypto.randomUUID(),
      is_system_default: data.code === 'TUITION' ? true : false,
      show_at_admission: data.show_at_admission ?? (data.code === 'TUITION' || data.code === 'ADMISSION'),
      created_at: new Date().toISOString()
    };
    this.feeHeads.push(head);

    const prio = this.feePriorityConfigs.get(data.tenant_id);
    if (prio) {
      prio.priority_order.push(head.id);
      prio.updated_at = new Date().toISOString();
    }

    const already = this.accountHeads.some(h => h.tenant_id === data.tenant_id && h.name === head.name && h.type === 'income');
    if (!already) {
      this.accountHeads.push({
        id: crypto.randomUUID(),
        tenant_id: data.tenant_id,
        name: head.name,
        code: `INC-${head.code}`,
        type: 'income',
        is_active: true,
        created_at: new Date().toISOString(),
      });
    }

    this.schedulePersist();
    return head;
  }

  async updateFeeHead(
    tenantId: string,
    id: string,
    data: Partial<Pick<FeeHead, 'name' | 'code' | 'default_amount' | 'priority_order' | 'show_at_admission'>>,
  ): Promise<FeeHead | null> {
    const head = this.feeHeads.find(h => h.tenant_id === tenantId && h.id === id);
    if (!head) return null;
    const locked = head.code === 'TUITION' || head.name.toLowerCase().includes('monthly tuition');
    if (locked) {
      if (data.default_amount != null) head.default_amount = data.default_amount;
      if (data.priority_order != null) head.priority_order = data.priority_order;
      if (data.show_at_admission != null) head.show_at_admission = data.show_at_admission;
    } else {
      if (data.name) head.name = data.name.trim();
      if (data.code) head.code = data.code.toUpperCase();
      if (data.default_amount != null) head.default_amount = data.default_amount;
      if (data.priority_order != null) head.priority_order = data.priority_order;
      if (data.show_at_admission != null) head.show_at_admission = data.show_at_admission;
    }
    this.schedulePersist();
    return head;
  }

  async deleteFeeHead(tenantId: string, id: string): Promise<boolean> {
    const idx = this.feeHeads.findIndex(h => h.tenant_id === tenantId && h.id === id);
    if (idx < 0) return false;
    const head = this.feeHeads[idx];
    if (head.code === 'TUITION' || head.name.toLowerCase().includes('monthly tuition')) return false;
    this.feeHeads.splice(idx, 1);
    const prio = this.feePriorityConfigs.get(tenantId);
    if (prio) {
      prio.priority_order = prio.priority_order.filter(hid => hid !== id);
      prio.updated_at = new Date().toISOString();
    }
    this.schedulePersist();
    return true;
  }

  async getTenantUsers(tenantId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(u => u.tenant_id === tenantId);
  }

  async updateUserMetadata(tenantId: string, userId: string, metadata: Record<string, unknown>): Promise<User | null> {
    const user = Array.from(this.users.values()).find(u => u.tenant_id === tenantId && u.id === userId);
    if (!user) return null;
    user.metadata = { ...(user.metadata || {}), ...metadata };
    user.updated_at = new Date().toISOString();
    this.schedulePersist();
    return user;
  }

  async createStaff(data: CreateStaffInput): Promise<User> {
    const email = data.email.toLowerCase().trim();
    if (await this.getUserByEmail(data.tenant_id, email)) {
      throw new Error('A staff member with this email already exists.');
    }
    const tenantUsers = Array.from(this.users.values()).filter(
      u => u.tenant_id === data.tenant_id && !['super_admin', 'tenant_admin', 'student', 'parent'].includes(u.role)
    );

    let employeeCode = data.employee_code?.trim();
    if (!employeeCode) {
      let maxNum = 0;
      for (const u of tenantUsers) {
        const code = (u.metadata?.employee_code as string) || '';
        const match = code.match(/EMP-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      const nextNum = Math.max(tenantUsers.length + 1, maxNum + 1);
      employeeCode = `EMP-${nextNum.toString().padStart(4, '0')}`;
    } else {
      const existingWithCode = tenantUsers.find(
        u => (u.metadata?.employee_code as string)?.trim().toLowerCase() === employeeCode!.toLowerCase()
      );
      if (existingWithCode) {
        throw new Error(`Employee code '${employeeCode}' is already assigned to another staff member.`);
      }
    }

    const passwordToUse = data.password && data.password.trim().length >= 6 ? data.password.trim() : 'ApexStaff2026!';
    const userRole: UserRole = data.role || (data.department === 'Accounts' ? 'finance_manager' : (data.department === 'Administration' ? 'academic_head' : 'teacher'));
    const joiningDate = data.joining_date || new Date().toISOString().split('T')[0];

    const user: User = {
      id: crypto.randomUUID(),
      tenant_id: data.tenant_id,
      email,
      phone: data.phone || null,
      full_name: data.full_name.trim(),
      role: userRole,
      status: (data.status as UserStatus) || 'active',
      password_hash: hashPassword(passwordToUse),
      metadata: {
        employee_code: employeeCode,
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
        joining_date: joiningDate,
        probation_end_date: data.probation_end_date || null,
        qualification: data.qualification || '',
        experience_years: typeof data.experience_years === 'number' ? data.experience_years : 0,
        base_salary: typeof data.base_salary === 'number' ? data.base_salary : 0,
        bank_name: data.bank_name || '',
        bank_account_title: data.bank_account_title || '',
        bank_account_number: data.bank_account_number || '',
        bank_iban: data.bank_iban || '',
        teaching_assignments: Array.isArray(data.teaching_assignments) ? data.teaching_assignments : [],
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
        leave_balance: {
          casual_allowed: 12,
          casual_used: 0,
          sick_allowed: 8,
          sick_used: 0,
          annual_allowed: 10,
          annual_used: 0,
        },
        managed_staff: true,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.users.set(`${data.tenant_id}:${email}`, user);

    if (typeof data.base_salary === 'number' && data.base_salary >= 0) {
      await this.saveStaffSalaryProfile({
        tenant_id: data.tenant_id,
        staff_id: user.id,
        staff_name: user.full_name,
        designation: (user.metadata?.designation as string) || 'Faculty Member',
        contract_type: data.employment_type === 'visiting' ? 'per_lecture' : 'fixed_monthly',
        base_amount: data.base_salary,
      });
    }

    this.schedulePersist();
    return user;
  }

  async updateStaff(tenantId: string, userId: string, patch: UpdateStaffInput): Promise<User | null> {
    const user = Array.from(this.users.values()).find(u => u.tenant_id === tenantId && u.id === userId);
    if (!user) return null;
    if (user.role === 'tenant_admin' || user.role === 'super_admin') return null;

    const oldEmail = user.email.toLowerCase();
    if (patch.email && patch.email.toLowerCase().trim() !== oldEmail) {
      const newEmail = patch.email.toLowerCase().trim();
      const existing = await this.getUserByEmail(tenantId, newEmail);
      if (existing && existing.id !== userId) {
        throw new Error('A user with this email already exists.');
      }
      this.users.delete(`${tenantId}:${oldEmail}`);
      user.email = newEmail;
      this.users.set(`${tenantId}:${newEmail}`, user);
    }

    if (patch.employee_code) {
      const cleanCode = patch.employee_code.trim();
      const duplicate = Array.from(this.users.values()).find(
        u => u.tenant_id === tenantId && u.id !== userId && (u.metadata?.employee_code as string)?.trim().toLowerCase() === cleanCode.toLowerCase()
      );
      if (duplicate) {
        throw new Error(`Employee code '${cleanCode}' is already assigned to another staff member.`);
      }
    }

    if (patch.full_name !== undefined) user.full_name = patch.full_name.trim();
    if (patch.phone !== undefined) user.phone = patch.phone;
    if (patch.status) user.status = patch.status;
    if (patch.role) user.role = patch.role;

    const meta = user.metadata || {};
    user.metadata = {
      ...meta,
      managed_staff: true,
      ...(patch.employee_code ? { employee_code: patch.employee_code.trim() } : {}),
      ...(patch.father_or_spouse_name !== undefined ? { father_or_spouse_name: patch.father_or_spouse_name } : {}),
      ...(patch.cnic !== undefined ? { cnic: patch.cnic } : {}),
      ...(patch.blood_group !== undefined ? { blood_group: patch.blood_group } : {}),
      ...(patch.gender !== undefined ? { gender: patch.gender } : {}),
      ...(patch.dob !== undefined ? { dob: patch.dob } : {}),
      ...(patch.whatsapp !== undefined ? { whatsapp: patch.whatsapp } : {}),
      ...(patch.emergency_contact !== undefined ? { emergency_contact: patch.emergency_contact } : {}),
      ...(patch.emergency_relation !== undefined ? { emergency_relation: patch.emergency_relation } : {}),
      ...(patch.address !== undefined ? { address: patch.address } : {}),
      ...(patch.department !== undefined ? { department: patch.department } : {}),
      ...(patch.designation ? { designation: patch.designation.trim() } : {}),
      ...(patch.employment_type !== undefined ? { employment_type: patch.employment_type } : {}),
      ...(patch.joining_date !== undefined ? { joining_date: patch.joining_date } : {}),
      ...(patch.probation_end_date !== undefined ? { probation_end_date: patch.probation_end_date } : {}),
      ...(patch.relieving_date !== undefined ? { relieving_date: patch.relieving_date } : {}),
      ...(patch.qualification !== undefined ? { qualification: patch.qualification } : {}),
      ...(patch.experience_years !== undefined ? { experience_years: patch.experience_years } : {}),
      ...(patch.base_salary !== undefined ? { base_salary: patch.base_salary } : {}),
      ...(patch.bank_name !== undefined ? { bank_name: patch.bank_name } : {}),
      ...(patch.bank_account_title !== undefined ? { bank_account_title: patch.bank_account_title } : {}),
      ...(patch.bank_account_number !== undefined ? { bank_account_number: patch.bank_account_number } : {}),
      ...(patch.bank_iban !== undefined ? { bank_iban: patch.bank_iban } : {}),
      ...(patch.teaching_assignments !== undefined ? { teaching_assignments: patch.teaching_assignments } : {}),
      ...(patch.permissions !== undefined ? { permissions: patch.permissions } : {}),
    };

    user.updated_at = new Date().toISOString();

    if (typeof patch.base_salary === 'number' || patch.designation) {
      const currentSalary = typeof patch.base_salary === 'number' ? patch.base_salary : (typeof meta.base_salary === 'number' ? meta.base_salary : 0);
      const designation = patch.designation || (meta.designation as string) || 'Faculty Member';
      await this.saveStaffSalaryProfile({
        tenant_id: tenantId,
        staff_id: user.id,
        staff_name: user.full_name,
        designation,
        contract_type: (patch.employment_type || meta.employment_type) === 'visiting' ? 'per_lecture' : 'fixed_monthly',
        base_amount: currentSalary,
      });
    }

    this.schedulePersist();
    return user;
  }

  async archiveStaff(tenantId: string, userId: string, reason?: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(u => u.tenant_id === tenantId && u.id === userId);
    if (!user) return null;
    if (user.role === 'tenant_admin' || user.role === 'super_admin') return null;

    user.status = 'archived';
    user.metadata = {
      ...(user.metadata || {}),
      archived_at: new Date().toISOString(),
      archived_reason: reason || 'Relieved / Resigned',
      relieving_date: new Date().toISOString().split('T')[0],
    };
    user.updated_at = new Date().toISOString();
    this.schedulePersist();
    return user;
  }

  async restoreStaff(tenantId: string, userId: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(u => u.tenant_id === tenantId && u.id === userId);
    if (!user) return null;
    if (user.role === 'tenant_admin' || user.role === 'super_admin') return null;

    user.status = 'active';
    if (user.metadata) {
      delete (user.metadata as any).archived_at;
      delete (user.metadata as any).archived_reason;
      delete (user.metadata as any).relieving_date;
    }
    user.updated_at = new Date().toISOString();
    this.schedulePersist();
    return user;
  }

  async deleteStaff(tenantId: string, userId: string): Promise<boolean> {
    const user = Array.from(this.users.values()).find(u => u.tenant_id === tenantId && u.id === userId);
    if (!user) return false;
    if (user.role === 'tenant_admin' || user.role === 'super_admin') {
      throw new Error('Cannot delete administrative users.');
    }

    // Check financial transactions
    const hasFinancialVouchers = this.financialTransactions.some(
      t => t.tenant_id === tenantId && (t.recorded_by === userId || (t as any).created_by === userId)
    );
    if (hasFinancialVouchers) {
      throw new Error('Cannot delete staff member with linked financial vouchers. Please use Archive instead.');
    }

    // Check payslips
    const hasPayslips = this.staffPayslips.some(
      p => p.tenant_id === tenantId && p.staff_id === userId
    );
    if (hasPayslips) {
      throw new Error('Cannot delete staff member with generated payroll slips. Please use Archive instead.');
    }

    // Check exam evaluations / created exams
    const hasExams = this.exams.some(
      e => e.tenant_id === tenantId && ((e as any).created_by === userId || (e as any).teacher_id === userId)
    );
    const hasEvaluations = this.studentExamEvaluations.some(
      ev => ev.tenant_id === tenantId && ((ev as any).evaluated_by === userId)
    );
    if (hasExams || hasEvaluations) {
      throw new Error('Cannot delete staff member with linked examination records or evaluations. Please use Archive instead.');
    }

    // Check student attendance marked by staff
    const hasAttendanceMarked = this.studentAttendance.some(
      a => a.tenant_id === tenantId && a.marked_by === userId
    );
    if (hasAttendanceMarked) {
      throw new Error('Cannot delete staff member with linked student attendance records. Please use Archive instead.');
    }

    // Check homework assignments
    const hasHomework = this.homeworkAssignments.some(
      h => h.tenant_id === tenantId && h.teacher_id === userId
    );
    if (hasHomework) {
      throw new Error('Cannot delete staff member with assigned homework diary records. Please use Archive instead.');
    }

    // Check notebook checks
    const hasNotebookChecks = this.notebookChecks.some(
      n => n.tenant_id === tenantId && n.checked_by === userId
    );
    if (hasNotebookChecks) {
      throw new Error('Cannot delete staff member with linked notebook checking logs. Please use Archive instead.');
    }

    this.users.delete(`${tenantId}:${user.email.toLowerCase()}`);
    this.staffSalaryProfiles = this.staffSalaryProfiles.filter(p => !(p.tenant_id === tenantId && p.staff_id === userId));
    this.staffAttendance = this.staffAttendance.filter(a => !(a.tenant_id === tenantId && a.staff_id === userId));
    this.schedulePersist();
    return true;
  }

  async resetStaffPassword(tenantId: string, userId: string, newPassword: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(u => u.tenant_id === tenantId && u.id === userId);
    if (!user) return null;
    if (user.role === 'super_admin' || user.role === 'tenant_admin') return null;

    user.password_hash = hashPassword(newPassword);
    user.updated_at = new Date().toISOString();
    this.schedulePersist();
    return user;
  }

  async assignStaffTeaching(tenantId: string, userId: string, assignments: StaffTeachingAssignment[]): Promise<User | null> {
    const user = Array.from(this.users.values()).find(u => u.tenant_id === tenantId && u.id === userId);
    if (!user) return null;

    // Deduplicate assignments by program_id + batch_id + subject_id
    const deduped: StaffTeachingAssignment[] = [];
    const seen = new Set<string>();
    for (const a of assignments) {
      const key = `${a.program_id}:${a.batch_id}:${a.subject_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(a);
      }
    }

    user.metadata = {
      ...(user.metadata || {}),
      teaching_assignments: deduped,
    };
    user.updated_at = new Date().toISOString();
    this.schedulePersist();
    return user;
  }

  async getFeePriorityConfig(tenantId: string): Promise<FeePriorityConfig> {
    let config = this.feePriorityConfigs.get(tenantId);
    if (!config) {
      const tenant = this.tenants.get(tenantId);
      const savedPriority = (tenant?.settings as any)?.fee_rules?.priority_order;

      const heads = await this.getFeeHeads(tenantId);
      let order: string[] = [];
      if (Array.isArray(savedPriority) && savedPriority.length > 0) {
        order = savedPriority.map((item: string) => {
          const match = heads.find(h => h.id === item || h.name.toLowerCase() === item.toLowerCase() || h.code.toLowerCase() === item.toLowerCase());
          return match ? match.id : item;
        }).filter(Boolean);
      }
      if (order.length === 0) {
        order = heads.map(h => h.id);
      }

      config = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        priority_order: order,
        updated_at: new Date().toISOString()
      };
      this.feePriorityConfigs.set(tenantId, config);
    }
    return config;
  }

  async updateFeePriorityConfig(tenantId: string, priorityOrder: string[]): Promise<FeePriorityConfig> {
    const config: FeePriorityConfig = {
      id: this.feePriorityConfigs.get(tenantId)?.id || crypto.randomUUID(),
      tenant_id: tenantId,
      priority_order: priorityOrder,
      updated_at: new Date().toISOString()
    };
    this.feePriorityConfigs.set(tenantId, config);

    const tenant = this.tenants.get(tenantId);
    if (tenant) {
      tenant.settings = {
        ...(tenant.settings || {}),
        fee_rules: {
          ...((tenant.settings as any)?.fee_rules || {}),
          priority_order: priorityOrder
        }
      };
    }
    this.schedulePersist();
    return config;
  }

  // --- Fee Structures ---
  async getFeeStructures(tenantId: string, batchId?: string, studentId?: string): Promise<StudentFeeStructure[]> {
    return this.feeStructures.filter(s => 
      s.tenant_id === tenantId &&
      (!batchId || s.batch_id === batchId) &&
      (!studentId || s.student_id === studentId)
    );
  }

  async saveFeeStructure(data: Omit<StudentFeeStructure, 'id' | 'created_at' | 'updated_at'>): Promise<StudentFeeStructure> {
    const existingIdx = this.feeStructures.findIndex(s => 
      s.tenant_id === data.tenant_id &&
      ((data.student_id && s.student_id === data.student_id) || (!data.student_id && s.batch_id === data.batch_id))
    );

    const record: StudentFeeStructure = {
      ...data,
      id: existingIdx >= 0 ? this.feeStructures[existingIdx].id : crypto.randomUUID(),
      created_at: existingIdx >= 0 ? this.feeStructures[existingIdx].created_at : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      this.feeStructures[existingIdx] = record;
    } else {
      this.feeStructures.push(record);
    }
    this.schedulePersist();
    return record;
  }

  // --- Invoicing & Challans ---
  async getInvoices(tenantId: string, options?: { studentId?: string; student_id?: string; batchId?: string; batch_id?: string; billingMonth?: string; billing_month?: string; status?: InvoiceStatus }): Promise<StudentInvoice[]> {
    const targetStudentId = options?.student_id || options?.studentId;
    const targetBatchId = options?.batch_id || options?.batchId;
    const targetBillingMonth = options?.billing_month || options?.billingMonth;

    return this.invoices.filter(i => {
      if (i.tenant_id !== tenantId) return false;
      if (targetStudentId && i.student_id !== targetStudentId) return false;
      if (targetBatchId && i.batch_id !== targetBatchId) return false;
      if (targetBillingMonth && !isSameBillingMonth(i.billing_month, targetBillingMonth)) return false;
      if (options?.status && i.status !== options.status) return false;
      return true;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getInvoiceById(tenantId: string, id: string): Promise<StudentInvoice | null> {
    return this.invoices.find(i => i.id === id && i.tenant_id === tenantId) || null;
  }

  async generateInvoice(tenantId: string, data: {
    student_id: string;
    billing_month: string;
    due_date: string;
    custom_items?: Array<{ fee_head_id: string; amount: number }>;
    additional_heads?: Array<{ fee_head_id: string; amount: number }>;
    issue_date?: string;
    include_arrears?: boolean;
    notes?: string;
  }): Promise<StudentInvoice> {
    const student = this.students.find(s => s.id === data.student_id && s.tenant_id === tenantId);
    if (!student) throw new Error('Student not found for invoice generation');
    if (student.status !== 'active' && !(data as any).allow_inactive_billing) {
      throw new Error(`Cannot generate fee invoice: Student "${student.full_name}" is ${student.status}. Invoices can only be generated for active students.`);
    }

    // Duplicate Challan Shield: Prevent duplicate active invoices for same student and billing month
    const existingActive = this.invoices.find(i => 
      i.tenant_id === tenantId &&
      i.student_id === student.id &&
      isSameBillingMonth(i.billing_month, data.billing_month) &&
      i.status !== 'voided' &&
      i.status !== 'cancelled'
    );
    if (existingActive) {
      throw new Error(`An active fee challan (#${existingActive.invoice_number}) already exists for ${student.full_name} for ${normalizeBillingMonth(data.billing_month)}. Duplicate challans cannot be issued.`);
    }

    const batch = this.batches.find(b => b.id === student.batch_id && b.tenant_id === tenantId);
    const programId = student.program_id || batch?.program_id || '';
    const program = this.programs.find(p => p.id === programId && p.tenant_id === tenantId);
    const invoiceId = crypto.randomUUID();
    const count = this.invoices.filter(i => i.tenant_id === tenantId).length + 1;
    const currentYear = new Date().getFullYear();
    const invoiceNumber = `INV-${currentYear}-${count.toString().padStart(4, '0')}`;

    const items: InvoiceItem[] = [];
    let subtotal = 0;

    if (data.custom_items && data.custom_items.length > 0) {
      for (const ci of data.custom_items) {
        const head = this.feeHeads.find(h => h.id === ci.fee_head_id && h.tenant_id === tenantId);
        const amount = Number(ci.amount) || 0;
        items.push({
          id: crypto.randomUUID(),
          invoice_id: invoiceId,
          fee_head_id: ci.fee_head_id,
          head_name: head?.name || 'Fee Head',
          head_code: head?.code || 'FEE',
          original_amount: amount,
          discount_amount: 0,
          net_amount: amount,
          paid_amount: 0,
          balance_due: amount
        });
        subtotal += amount;
      }
    } else {
      const sFee = (student as any).fee_structure || {};
      const sisNet = Number(sFee.net_tuition || sFee.recurring_monthly || 0);
      const sisBase = Number(sFee.base_tuition || sFee.tuition_fee || sisNet || 0);
      const sisTuition = sisNet > 0 ? sisNet : sisBase;

      const studentOverride = this.feeStructures.find(fs => fs.tenant_id === tenantId && fs.student_id === student.id);
      const batchDefault = this.feeStructures.find(fs =>
        fs.tenant_id === tenantId && fs.batch_id === student.batch_id && !fs.student_id
      );

      const pushLine = (
        head: { id: string; name: string; code: string } | undefined,
        feeHeadId: string,
        headName: string,
        amount: number,
        discount = 0,
      ) => {
        const original = Number(amount) || 0;
        const disc = Math.max(0, Number(discount) || 0);
        const net = Math.max(0, original - disc);
        items.push({
          id: crypto.randomUUID(),
          invoice_id: invoiceId,
          fee_head_id: head?.id || feeHeadId,
          head_name: head?.name || headName,
          head_code: head?.code || 'FEE',
          original_amount: original,
          discount_amount: disc,
          net_amount: net,
          paid_amount: 0,
          balance_due: net,
        });
        subtotal += net;
      };

      const resolveHead = (feeHeadId?: string, headName?: string) =>
        this.feeHeads.find(h => h.id === feeHeadId && h.tenant_id === tenantId)
        || this.feeHeads.find(h => h.tenant_id === tenantId && headName && h.name.toLowerCase() === String(headName).toLowerCase());

      const isTuitionHead = (head?: { code?: string; name?: string }, headName?: string) => {
        const name = `${head?.name || ''} ${headName || ''}`.toLowerCase();
        return head?.code === 'TUITION' || name.includes('tuition');
      };

      const applyStructureItems = (structureItems: Array<{ fee_head_id: string; head_name?: string; amount: number }>) => {
        for (const it of structureItems) {
          const head = resolveHead(it.fee_head_id, it.head_name);
          let amount = Number(it.amount) || 0;
          let discount = 0;
          if (isTuitionHead(head, it.head_name) && sisTuition > 0) {
            amount = sisTuition;
            discount = 0;
          }
          pushLine(head, it.fee_head_id, it.head_name || 'Fee Head', amount, discount);
        }
      };

      if (studentOverride?.items && studentOverride.items.length > 0) {
        applyStructureItems(studentOverride.items);
      } else if (sisTuition > 0) {
        const tuitionHead = this.feeHeads.find(h => h.tenant_id === tenantId && h.code === 'TUITION')
          || this.feeHeads.find(h => h.tenant_id === tenantId && h.name.toLowerCase().includes('tuition'));
        if (!tuitionHead) {
          throw new Error('Cannot generate a challan: Monthly Tuition fee head is missing.');
        }
        pushLine(tuitionHead, tuitionHead.id, tuitionHead.name, sisTuition, 0);
      } else if (batchDefault?.items && batchDefault.items.length > 0) {
        applyStructureItems(batchDefault.items);
      } else {
        throw new Error('Cannot generate a challan: no fee structure, student tuition, or class fees are set. Set this student\'s fee at admission or class fees first.');
      }
    }

    // Append any additional heads specified for this billing cycle
    if (data.additional_heads && Array.isArray(data.additional_heads) && data.additional_heads.length > 0) {
      for (const ah of data.additional_heads) {
        const ahAmount = Number(ah.amount) || 0;
        if (ahAmount > 0) {
          const already = items.some(it => it.fee_head_id === ah.fee_head_id);
          if (already) continue;
          const head = this.feeHeads.find(h => h.id === ah.fee_head_id && h.tenant_id === tenantId);
          if (head) {
            items.push({
              id: crypto.randomUUID(),
              invoice_id: invoiceId,
              fee_head_id: head.id,
              head_name: head.name,
              head_code: head.code,
              original_amount: ahAmount,
              discount_amount: 0,
              net_amount: ahAmount,
              paid_amount: 0,
              balance_due: ahAmount
            });
            subtotal += ahAmount;
          }
        }
      }
    }

    // Roll prior unpaid balances into a single ARREARS line (tests + allocation need a distinct head).
    let priorArrears = 0;
    let priorInvoices: StudentInvoice[] = [];
    const isInstallmentInvoice = (data as any).installment_number != null || (data as any).billing_mode === 'installment';
    const shouldIncludeArrears = !isInstallmentInvoice && (
      data.include_arrears === true
      || (data.include_arrears !== false && !(data.custom_items && data.custom_items.length > 0))
    );
    if (shouldIncludeArrears) {
      priorInvoices = this.invoices.filter(i =>
        i.tenant_id === tenantId &&
        i.student_id === student.id &&
        i.id !== invoiceId &&
        i.status !== 'paid' &&
        i.status !== 'voided' &&
        i.status !== 'cancelled' &&
        i.status !== 'rolled_over' &&
        !i.rolled_into_invoice_id &&
        !i.installment_number &&
        i.billing_mode !== 'installment' &&
        (Number(i.balance_amount ?? i.balance_due ?? 0) > 0)
      );
      priorArrears = priorInvoices.reduce((sum, inv) => sum + Number(inv.balance_amount ?? inv.balance_due ?? 0), 0);

      if (priorArrears > 0) {
        const arrearsHead = this.feeHeads.find(h => h.tenant_id === tenantId && h.code === 'ARREARS');
        items.unshift({
          id: crypto.randomUUID(),
          invoice_id: invoiceId,
          fee_head_id: arrearsHead?.id || 'arrears',
          head_name: arrearsHead?.name || 'Previous Outstanding Dues',
          head_code: 'ARREARS',
          original_amount: priorArrears,
          discount_amount: 0,
          net_amount: priorArrears,
          paid_amount: 0,
          balance_due: priorArrears
        });
        subtotal += priorArrears;

        priorInvoices.forEach(pi => {
          pi.status = 'rolled_over';
          pi.rolled_into_invoice_id = invoiceId;
          pi.balance_amount = 0;
          pi.balance_due = 0;
          pi.items = pi.items.map(it => ({ ...it, balance_due: 0 }));
          pi.updated_at = new Date().toISOString();
        });
      }
    }

    const totalDiscount = items.reduce((s, it) => s + (it.discount_amount || 0), 0);
    const netAmount = items.reduce((s, it) => s + it.net_amount, 0);
    if (items.length === 0 || netAmount <= 0) {
      throw new Error('Cannot generate a challan with no billable amount. Set fee heads and class fees first.');
    }

    const invoice: StudentInvoice = {
      id: invoiceId,
      tenant_id: tenantId,
      invoice_number: invoiceNumber,
      student_id: student.id,
      student_name: student.full_name,
      roll_number: student.roll_number,
      batch_id: student.batch_id || '',
      batch_name: batch?.name || 'General Batch',
      program_id: programId,
      program_name: program?.name || 'Class',
      billing_month: normalizeBillingMonth(data.billing_month),
      issue_date: (data as any).issue_date || new Date().toISOString().split('T')[0],
      due_date: data.due_date,
      subtotal_amount: subtotal,
      subtotal: subtotal,
      discount_amount: totalDiscount,
      discount_total: totalDiscount,
      fine_amount: 0,
      net_amount: netAmount,
      net_total: netAmount,
      total_amount: netAmount,
      paid_amount: 0,
      balance_amount: netAmount,
      balance_due: netAmount,
      status: 'unpaid',
      items,
      arrears_amount: priorArrears,
      rolled_invoice_ids: priorArrears > 0
        ? Array.from(new Set([
            ...priorInvoices.map(pi => pi.id),
            ...priorInvoices.flatMap(pi => pi.rolled_invoice_ids || [])
          ]))
        : undefined,
      notes: data.notes || null,
      installment_number: (data as any).installment_number ?? null,
      total_installments: (data as any).total_installments ?? null,
      billing_mode: (data as any).billing_mode ?? student.billing_mode ?? batch?.billing_mode ?? 'monthly',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.invoices.push(invoice);
    this.schedulePersist();
    return invoice;
  }

  async generateBatchInvoices(
    tenantId: string,
    batchIdOrParams: string | { batch_id?: string; program_id?: string; scope?: 'all' | 'program' | 'batch'; target_id?: string; billing_month: string; due_date: string; issue_date?: string; additional_heads?: Array<{ fee_head_id: string; amount: number }> },
    billingMonthArg?: string,
    dueDateArg?: string
  ): Promise<StudentInvoice[]> {
    let scope = 'batch';
    let targetId: string | undefined;
    let billingMonth = '';
    let dueDate = '';
    let issueDate: string | undefined;

    if (typeof batchIdOrParams === 'string') {
      targetId = batchIdOrParams;
      billingMonth = billingMonthArg || '';
      dueDate = dueDateArg || '';
    } else {
      scope = batchIdOrParams.scope || (batchIdOrParams.batch_id ? 'batch' : (batchIdOrParams.program_id ? 'program' : 'all'));
      targetId = batchIdOrParams.target_id || batchIdOrParams.batch_id || batchIdOrParams.program_id;
      billingMonth = batchIdOrParams.billing_month;
      dueDate = batchIdOrParams.due_date;
      issueDate = batchIdOrParams.issue_date;
    }

    const students = this.students.filter(s => {
      if (s.tenant_id !== tenantId || s.status !== 'active') return false;
      if (scope === 'batch' && targetId && targetId !== 'all') {
        return s.batch_id === targetId;
      }
      if (scope === 'program' && targetId && targetId !== 'all') {
        return s.program_id === targetId;
      }
      return true;
    });

    const created: StudentInvoice[] = [];

    for (const student of students) {
      const batch = this.batches.find(b => b.id === student.batch_id && b.tenant_id === tenantId);

      // Edge Case 2.7: Batch lifespan check - skip if batch concluded prior to this billing month
      if (batch?.end_date && isBatchEndedForBillingMonth(batch.end_date, billingMonth)) {
        continue;
      }

      // One-time package billing: student or batch is billed once upfront, skip recurring monthly billing
      if (student.billing_mode === 'one_time' || batch?.billing_mode === 'one_time') {
        continue;
      }

      // Installment Plan: student is billed according to milestone schedule
      if (student.billing_mode === 'installment' && student.installment_plan) {
        const pendingInst = student.installment_plan.installments?.find(ins => ins.status === 'pending');
        if (!pendingInst) {
          // All installments have already been billed
          continue;
        }

        // Only bill milestone when due: scheduled milestone due date month must be <= billing month
        if (pendingInst.due_date) {
          const instDueMonthStart = pendingInst.due_date.trim().substring(0, 7) + '-01';
          const billingMonthStart = getBillingMonthStartIso(billingMonth);
          if (billingMonthStart && instDueMonthStart > billingMonthStart) {
            continue;
          }
        }

        // Check if invoice already exists for this student and billing month (excluding voided/cancelled)
        const existing = this.invoices.find(i => 
          i.tenant_id === tenantId &&
          i.student_id === student.id &&
          isSameBillingMonth(i.billing_month, billingMonth) &&
          i.status !== 'voided' &&
          i.status !== 'cancelled'
        );
        if (existing) continue;

        const tuitionHead = this.feeHeads.find(h => h.tenant_id === tenantId && h.code === 'TUITION') || this.feeHeads.find(h => h.tenant_id === tenantId);
        const instInv = await this.generateInvoice(tenantId, {
          student_id: student.id,
          billing_month: normalizeBillingMonth(billingMonth),
          due_date: pendingInst.due_date || dueDate,
          issue_date: issueDate,
          include_arrears: false,
          custom_items: tuitionHead ? [{
            fee_head_id: tuitionHead.id,
            amount: pendingInst.amount,
          }] : undefined,
          installment_number: pendingInst.installment_number,
          total_installments: student.installment_plan.total_installments,
          billing_mode: 'installment',
          notes: `Tuition Fee - Installment ${pendingInst.installment_number} of ${student.installment_plan.total_installments}`,
          additional_heads: typeof batchIdOrParams !== 'string' ? batchIdOrParams.additional_heads : undefined,
        } as any);

        pendingInst.status = 'billed';
        pendingInst.invoice_id = instInv.id;
        this.schedulePersist();
        created.push(instInv);
        continue;
      }

      // Regular Monthly Billing
      const existing = this.invoices.find(i => 
        i.tenant_id === tenantId &&
        i.student_id === student.id &&
        isSameBillingMonth(i.billing_month, billingMonth) &&
        i.status !== 'voided' &&
        i.status !== 'cancelled'
      );
      if (!existing) {
        const inv = await this.generateInvoice(tenantId, {
          student_id: student.id,
          billing_month: normalizeBillingMonth(billingMonth),
          due_date: dueDate,
          issue_date: issueDate,
          include_arrears: true,
          additional_heads: typeof batchIdOrParams !== 'string' ? batchIdOrParams.additional_heads : undefined,
        } as any);
        created.push(inv);
      }
    }
    return created;
  }

  async cancelInvoice(tenantId: string, invoiceId: string, reason: string, cancelledBy: string): Promise<StudentInvoice> {
    const invoice = this.invoices.find(i => i.id === invoiceId && i.tenant_id === tenantId);
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status === 'cancelled' || invoice.status === 'voided') {
      throw new Error('Invoice is already cancelled');
    }
    if (invoice.paid_amount > 0) {
      throw new Error('Cannot cancel invoice with recorded payments. Please void existing payments first.');
    }

    // If this invoice rolled over prior invoices, restore them back to unpaid
    if (Array.isArray(invoice.rolled_invoice_ids) && invoice.rolled_invoice_ids.length > 0) {
      const rolled = this.invoices.filter(i => invoice.rolled_invoice_ids!.includes(i.id));
      rolled.forEach(ri => {
        if (ri.status === 'rolled_over') {
          ri.status = 'unpaid';
          ri.rolled_into_invoice_id = null;
          ri.balance_amount = Number(ri.net_amount || 0);
          ri.balance_due = Number(ri.net_amount || 0);
          ri.updated_at = new Date().toISOString();
        }
      });
    }

    invoice.status = 'cancelled';
    invoice.cancel_reason = reason;
    invoice.cancelled_at = new Date().toISOString();
    invoice.cancelled_by = cancelledBy;
    invoice.balance_amount = 0;
    invoice.balance_due = 0;
    invoice.updated_at = new Date().toISOString();

    // If this invoice belongs to an installment plan, revert milestone from 'billed' back to 'pending'
    if (invoice.installment_number) {
      const student = this.students.find(s => s.id === invoice.student_id && s.tenant_id === tenantId);
      if (student?.installment_plan?.installments) {
        const inst = student.installment_plan.installments.find(i => i.installment_number === invoice.installment_number || i.invoice_id === invoice.id);
        if (inst && inst.status === 'billed') {
          inst.status = 'pending';
          inst.invoice_id = null;
        }
      }
    }

    this.schedulePersist();
    return invoice;
  }

  async deleteInvoice(tenantId: string, invoiceId: string, reason: string, deletedBy: string): Promise<{ success: boolean; deleted_invoice_id: string; deleted_payments_count: number } & Partial<StudentInvoice>> {
    const invoiceIndex = this.invoices.findIndex(i => i.id === invoiceId && i.tenant_id === tenantId);
    if (invoiceIndex === -1) throw new Error('Invoice not found');
    const invoice = this.invoices[invoiceIndex];

    const activePayments = this.feePayments.filter(p => p.invoice_id === invoiceId && p.tenant_id === tenantId && p.status !== 'voided');
    if (invoice.paid_amount > 0 || activePayments.length > 0) {
      throw new Error('Cannot cancel invoice with recorded payments. Please void existing payments first.');
    }

    // Find and remove any linked fee payments, reversing their cashbook transactions
    const linkedPayments = this.feePayments.filter(p => p.invoice_id === invoiceId && p.tenant_id === tenantId);
    for (const payment of linkedPayments) {
      for (const tx of this.financialTransactions) {
        if (tx.tenant_id !== tenantId) continue;
        const matchesReceipt = tx.reference_number === payment.receipt_number
          || (tx.description || '').includes(`Receipt #${payment.receipt_number}`);
        if (matchesReceipt && tx.type === 'income') {
          tx.description = `[DELETED CHALLAN] ${tx.description || payment.receipt_number}: ${reason}`;
          tx.amount = 0;
        }
      }
    }
    this.feePayments = this.feePayments.filter(p => !(p.invoice_id === invoiceId && p.tenant_id === tenantId));

    // If this invoice rolled over prior invoices, restore them back to unpaid
    if (Array.isArray(invoice.rolled_invoice_ids) && invoice.rolled_invoice_ids.length > 0) {
      const rolled = this.invoices.filter(i => invoice.rolled_invoice_ids!.includes(i.id));
      rolled.forEach(ri => {
        if (ri.status === 'rolled_over') {
          ri.status = 'unpaid';
          ri.rolled_into_invoice_id = null;
          ri.balance_amount = Number(ri.net_amount || 0);
          ri.balance_due = Number(ri.net_amount || 0);
          ri.updated_at = new Date().toISOString();
        }
      });
    }

    // Record audit log for deletion
    const student = this.students.find(s => s.id === invoice.student_id && s.tenant_id === tenantId);
    this.feeAuditLogs.unshift({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      action: 'deletion',
      student_id: invoice.student_id,
      student_name: student?.full_name || 'Student',
      roll_number: student?.roll_number,
      reference_number: invoice.invoice_number,
      amount: invoice.net_amount,
      reason: reason || 'Challan deleted by administrator',
      performed_by: deletedBy,
      created_at: new Date().toISOString(),
    });

    // Permanently remove the invoice
    invoice.status = 'cancelled';
    invoice.cancel_reason = reason;
    invoice.cancelled_at = new Date().toISOString();
    invoice.cancelled_by = deletedBy;
    this.invoices.splice(invoiceIndex, 1);
    this.schedulePersist();

    return {
      success: true,
      deleted_invoice_id: invoiceId,
      deleted_payments_count: linkedPayments.length,
      ...invoice,
      status: 'cancelled',
    };
  }

  async updateInvoice(
    tenantId: string,
    invoiceId: string,
    data: {
      due_date?: string;
      notes?: string | null;
      items?: Array<{ fee_head_id: string; amount: number }>;
    }
  ): Promise<StudentInvoice> {
    const invoice = this.invoices.find(i => i.id === invoiceId && i.tenant_id === tenantId);
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status === 'cancelled' || invoice.status === 'voided') {
      throw new Error(`Cannot edit a ${invoice.status} invoice`);
    }

    if (data.due_date) {
      invoice.due_date = data.due_date;
    }
    if (data.notes !== undefined) {
      invoice.notes = data.notes;
    }

    if (data.items && Array.isArray(data.items)) {
      if (invoice.paid_amount > 0) {
        throw new Error('Cannot modify line items on an invoice with recorded payments. Only due date and notes can be edited.');
      }

      const feeHeads = this.feeHeads.filter(h => h.tenant_id === tenantId);
      const newItems: InvoiceItem[] = [];

      for (const itemData of data.items) {
        const head = feeHeads.find(h => h.id === itemData.fee_head_id);
        const amount = Number(itemData.amount);
        if (!Number.isFinite(amount) || amount < 0) continue;
        newItems.push({
          id: crypto.randomUUID(),
          invoice_id: invoiceId,
          fee_head_id: itemData.fee_head_id,
          head_code: head?.code || 'CUSTOM',
          head_name: head?.name || 'Fee Item',
          original_amount: amount,
          discount_amount: 0,
          net_amount: amount,
          paid_amount: 0,
          balance_due: amount
        });
      }

      const totalGross = newItems.reduce((s, it) => s + it.original_amount, 0);
      invoice.items = newItems;
      invoice.subtotal_amount = totalGross;
      invoice.subtotal = totalGross;
      invoice.discount_amount = newItems.reduce((s, it) => s + (it.discount_amount || 0), 0);
      invoice.net_amount = totalGross;
      invoice.net_total = totalGross;
      invoice.total_amount = totalGross;
      invoice.balance_amount = Math.max(0, invoice.net_amount - invoice.paid_amount);
      invoice.balance_due = invoice.balance_amount;
      invoice.status = invoice.balance_amount <= 0 ? 'paid' : (invoice.paid_amount > 0 ? 'partially_paid' : 'unpaid');
    }

    invoice.updated_at = new Date().toISOString();
    this.schedulePersist();
    return invoice;
  }

  // --- Payment Allocation Order & Cashier Review ---
  async getPayments(tenantId: string, options?: { invoice_id?: string; student_id?: string; date?: string; status?: string }): Promise<FeePayment[]> {
    return this.feePayments.filter(p => {
      if (p.tenant_id !== tenantId) return false;
      if (options?.invoice_id && p.invoice_id !== options.invoice_id) return false;
      if (options?.student_id && p.student_id !== options.student_id) return false;
      if (options?.date && p.payment_date !== options.date) return false;
      if (options?.status && p.status !== options.status) return false;
      return true;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async previewPaymentDistribution(tenantId: string, invoiceId: string, amount: number): Promise<PaymentDistributionItem[]> {
    const invoice = this.invoices.find(i => i.id === invoiceId && i.tenant_id === tenantId);
    if (!invoice) throw new Error('Invoice not found for distribution calculation');

    const prioConfig = await this.getFeePriorityConfig(tenantId);
    const priorityOrder = prioConfig.priority_order;

    // Sort items by payment allocation priority
    const sortedItems = [...invoice.items].sort((a, b) => {
      const idxA = priorityOrder.indexOf(a.fee_head_id);
      const idxB = priorityOrder.indexOf(b.fee_head_id);
      const rankA = idxA === -1 ? 999 : idxA;
      const rankB = idxB === -1 ? 999 : idxB;
      return rankA - rankB;
    });

    let remaining = Math.max(0, amount);
    const distribution: PaymentDistributionItem[] = [];

    for (const item of sortedItems) {
      const due = Number(item.balance_due ?? 0);
      let alloc = 0;
      if (due > 0 && remaining > 0) {
        alloc = Math.min(remaining, due);
        remaining -= alloc;
      }
      distribution.push({
        fee_head_id: item.fee_head_id,
        head_name: item.head_name,
        allocated_amount: alloc,
        invoice_item_id: item.id,
      });
    }

    return distribution;
  }

  async recordPayment(tenantId: string, data: {
    invoice_id: string;
    amount_paid: number;
    payment_method: PaymentMethod;
    reference_number?: string;
    bank_name?: string | null;
    cheque_number?: string | null;
    clearing_date?: string | null;
    payment_date?: string;
    is_override?: boolean;
    override_reason?: string;
    allocations?: PaymentDistributionItem[];
    collected_by: string;
  }): Promise<{ payment: FeePayment; invoice: StudentInvoice }> {
    const invoice = this.invoices.find(i => i.id === data.invoice_id && i.tenant_id === tenantId);
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status === 'cancelled' || invoice.status === 'voided') {
      throw new Error(`Cannot record payment on a ${invoice.status} invoice`);
    }
    if (invoice.status === 'rolled_over') {
      throw new Error('This challan was rolled into a later month. Collect against the current unpaid challan.');
    }

    const amountPaid = Number(data.amount_paid);
    if (amountPaid <= 0) throw new Error('Payment amount must be greater than zero');
    if (data.payment_method === 'cheque' && !String(data.cheque_number || '').trim()) {
      throw new Error('Cheque number is required for cheque payments.');
    }

    const outstanding = Number(invoice.balance_amount ?? invoice.balance_due ?? 0);
    if (!data.is_override && amountPaid > outstanding + 0.05) {
      throw new Error(`Amount exceeds outstanding PKR ${outstanding}. Record only the due amount, or use override with a reason to post an advance.`);
    }

    // Determine allocations: use provided cashier review override or compute smart distribution
    const allocations = data.allocations && data.allocations.length > 0
      ? data.allocations
      : await this.previewPaymentDistribution(tenantId, data.invoice_id, amountPaid);

    const sumAllocated = allocations.reduce((s, a) => s + Number(a.allocated_amount), 0);
    if (Math.abs(sumAllocated - amountPaid) > 0.05) {
      throw new Error(`Allocated sum (${sumAllocated}) does not match paid amount (${amountPaid})`);
    }

    // Apply allocations to the matching invoice line (item id, then unpaid head, then any head)
    for (const alloc of allocations) {
      const amt = Number(alloc.allocated_amount);
      if (amt <= 0) continue;
      let item = alloc.invoice_item_id
        ? invoice.items.find((i: InvoiceItem) => i.id === alloc.invoice_item_id)
        : undefined;
      if (!item) {
        item = invoice.items.find((i: InvoiceItem) => i.fee_head_id === alloc.fee_head_id && Number(i.balance_due) > 0)
          || invoice.items.find((i: InvoiceItem) => i.fee_head_id === alloc.fee_head_id);
      }
      if (item) {
        item.paid_amount += amt;
        item.balance_due = Math.max(0, item.net_amount - item.paid_amount);
      }
    }

    invoice.paid_amount = invoice.items.reduce((s: number, it: InvoiceItem) => s + it.paid_amount, 0);
    invoice.balance_amount = Math.max(0, invoice.net_amount - invoice.paid_amount);
    invoice.status = invoice.balance_amount <= 0 ? 'paid' : (invoice.paid_amount > 0 ? 'partially_paid' : 'unpaid');
    invoice.updated_at = new Date().toISOString();

    // If this invoice has rolled-over invoices and arrears were settled, mark rolled invoices paid
    if (Array.isArray(invoice.rolled_invoice_ids) && invoice.rolled_invoice_ids.length > 0) {
      const rolledInvoices = this.invoices.filter(i => invoice.rolled_invoice_ids!.includes(i.id));
      if (invoice.balance_amount <= 0) {
        rolledInvoices.forEach(ri => {
          ri.status = 'paid';
          ri.balance_amount = 0;
          ri.paid_amount = ri.net_amount;
          ri.updated_at = new Date().toISOString();
        });
      } else {
        const arrearsItem = invoice.items.find(it => it.head_code === 'ARREARS');
        if (arrearsItem && arrearsItem.paid_amount >= arrearsItem.net_amount) {
          rolledInvoices.forEach(ri => {
            ri.status = 'paid';
            ri.balance_amount = 0;
            ri.paid_amount = ri.net_amount;
            ri.updated_at = new Date().toISOString();
          });
        }
      }
    }

    const count = this.feePayments.filter(p => p.tenant_id === tenantId).length + 1;
    const currentYear = new Date().getFullYear();
    const receiptNumber = `REC-${currentYear}-${count.toString().padStart(5, '0')}`;

    const payment: FeePayment = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      receipt_number: receiptNumber,
      invoice_id: invoice.id,
      student_id: invoice.student_id,
      student_name: invoice.student_name,
      roll_number: invoice.roll_number,
      payment_date: data.payment_date || new Date().toISOString().split('T')[0],
      amount_paid: amountPaid,
      payment_method: data.payment_method,
      reference_number: data.reference_number || null,
      bank_name: data.bank_name || null,
      cheque_number: data.cheque_number || null,
      clearing_date: data.clearing_date || null,
      is_override: Boolean(data.is_override),
      override_reason: data.override_reason || null,
      allocations,
      collected_by: data.collected_by,
      status: 'paid',
      created_at: new Date().toISOString()
    };

    this.feePayments.push(payment);

    // Auto-post to Cashbook (FinancialTransactions)
    const txCount = this.financialTransactions.filter(t => t.tenant_id === tenantId && t.type === 'income').length + 1;
    const year = new Date().getFullYear();
    const voucherNumber = `VCH-INC-${year}-${txCount.toString().padStart(4, '0')}`;
    const headId = (allocations && allocations[0]?.fee_head_id) || invoice.items[0]?.fee_head_id || 'fee-tuition';
    const tx: FinancialTransaction = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      voucher_number: voucherNumber,
      type: 'income',
      account_head_id: headId,
      head_name: 'Student Fee Collection',
      amount: amountPaid,
      payment_method: data.payment_method,
      reference_number: data.reference_number || receiptNumber,
      transaction_date: payment.payment_date,
      date: payment.payment_date,
      paid_to_or_received_from: invoice.student_name,
      payee_payer: invoice.student_name,
      description: `Tuition & Fee Collection: ${invoice.student_name} (${invoice.roll_number}) - Receipt #${receiptNumber} [Inv #${invoice.invoice_number}]`,
      recorded_by: data.collected_by || 'Cashier',
      created_at: new Date().toISOString(),
    };
    this.financialTransactions.push(tx);

    // Sync installment status on student record if this invoice belongs to an installment plan
    if (invoice.installment_number && (invoice.balance_amount <= 0 || invoice.status === 'paid')) {
      const student = this.students.find(s => s.id === invoice.student_id);
      if (student?.installment_plan?.installments) {
        const inst = student.installment_plan.installments.find(i => i.installment_number === invoice.installment_number || i.invoice_id === invoice.id);
        if (inst) {
          inst.status = 'paid';
        }
      }
    }

    this.schedulePersist();

    return { payment, invoice };
  }

  async recordFamilyPayment(tenantId: string, data: {
    payment_method: PaymentMethod;
    reference_number?: string;
    bank_name?: string | null;
    cheque_number?: string | null;
    clearing_date?: string | null;
    collected_by: string;
    payments: Array<{
      invoice_id: string;
      amount_paid: number;
      allocations?: PaymentDistributionItem[];
      is_override?: boolean;
      override_reason?: string;
    }>;
  }): Promise<{
    family_receipt_number: string;
    results: Array<{ payment: FeePayment; invoice: StudentInvoice }>;
    total_amount: number;
  }> {
    if (!data.payments || data.payments.length === 0) {
      throw new Error('At least one child payment is required');
    }

    const currentYear = new Date().getFullYear();
    const count = this.feePayments.filter(p => p.tenant_id === tenantId).length + 1;
    const familyReceiptNumber = `FAM-${currentYear}-${count.toString().padStart(5, '0')}`;

    const results: Array<{ payment: FeePayment; invoice: StudentInvoice }> = [];
    let totalAmount = 0;
    const invoiceBackup = this.invoices.map(i => ({ ...i, items: i.items.map(it => ({ ...it })) }));
    const paymentLen = this.feePayments.length;
    const txLen = this.financialTransactions.length;

    try {
    for (const p of data.payments) {
      if (p.amount_paid <= 0) continue;
      const res = await this.recordPayment(tenantId, {
        invoice_id: p.invoice_id,
        amount_paid: p.amount_paid,
        payment_method: data.payment_method,
        reference_number: data.reference_number || familyReceiptNumber,
        bank_name: data.bank_name,
        cheque_number: data.cheque_number,
        clearing_date: data.clearing_date,
        is_override: p.is_override,
        override_reason: p.override_reason,
        allocations: p.allocations,
        collected_by: data.collected_by,
      });
      results.push(res);
      totalAmount += p.amount_paid;
    }
    } catch (err) {
      for (const b of invoiceBackup) {
        const cur = this.invoices.find(i => i.id === b.id);
        if (cur) {
          Object.assign(cur, { ...b, items: b.items.map(it => ({ ...it })) });
        }
      }
      this.feePayments.splice(paymentLen);
      this.financialTransactions.splice(txLen);
      throw err;
    }

    return {
      family_receipt_number: familyReceiptNumber,
      results,
      total_amount: totalAmount,
    };
  }

  async voidPayment(tenantId: string, paymentId: string, voidReason: string, voidedBy: string): Promise<{ payment: FeePayment; invoice: StudentInvoice }> {
    const payment = this.feePayments.find(p => p.id === paymentId && p.tenant_id === tenantId);
    if (!payment) throw new Error('Payment receipt not found');
    if (payment.status === 'voided') throw new Error('Payment receipt is already voided');

    const invoice = this.invoices.find(i => i.id === payment.invoice_id && i.tenant_id === tenantId);
    if (!invoice) throw new Error('Associated invoice not found');

    // Rollback allocations from invoice items
    if (payment.allocations && payment.allocations.length > 0) {
      for (const alloc of payment.allocations) {
        const item = (alloc.invoice_item_id
          ? invoice.items.find(i => i.id === alloc.invoice_item_id)
          : undefined)
          || invoice.items.find(i => i.fee_head_id === alloc.fee_head_id && i.paid_amount > 0)
          || invoice.items.find(i => i.fee_head_id === alloc.fee_head_id);
        if (item) {
          item.paid_amount = Math.max(0, item.paid_amount - Number(alloc.allocated_amount));
          item.balance_due = Math.max(0, item.net_amount - item.paid_amount);
        }
      }
    } else {
      let remainingToDeduct = payment.amount_paid;
      for (const item of [...invoice.items].reverse()) {
        const deduct = Math.min(item.paid_amount, remainingToDeduct);
        item.paid_amount -= deduct;
        item.balance_due = Math.max(0, item.net_amount - item.paid_amount);
        remainingToDeduct -= deduct;
        if (remainingToDeduct <= 0) break;
      }
    }

    invoice.paid_amount = invoice.items.reduce((s, it) => s + it.paid_amount, 0);
    invoice.balance_amount = Math.max(0, invoice.net_amount - invoice.paid_amount);
    invoice.status = invoice.balance_amount <= 0 ? 'paid' : (invoice.paid_amount > 0 ? 'partially_paid' : 'unpaid');
    invoice.updated_at = new Date().toISOString();

    // If this invoice had rolled-over prior invoices that were marked paid, revert them if arrears balance is now unpaid
    if (Array.isArray(invoice.rolled_invoice_ids) && invoice.rolled_invoice_ids.length > 0) {
      const arrearsItem = invoice.items.find(it => it.head_code === 'ARREARS');
      const arrearsSettled = arrearsItem ? arrearsItem.paid_amount >= arrearsItem.net_amount : (invoice.balance_amount <= 0);
      if (!arrearsSettled) {
        const rolledInvoices = this.invoices.filter(i => invoice.rolled_invoice_ids!.includes(i.id));
        rolledInvoices.forEach(ri => {
          if (ri.status === 'paid' && ri.rolled_into_invoice_id === invoice.id) {
            ri.status = 'rolled_over';
            ri.paid_amount = 0;
            ri.balance_amount = ri.net_amount;
            ri.updated_at = new Date().toISOString();
          }
        });
      }
    }

    // Mark payment voided
    payment.status = 'voided';
    payment.voided_at = new Date().toISOString();
    payment.voided_by = voidedBy;
    payment.void_reason = voidReason;

    // Record audit log for reversal
    const student = this.students.find(s => s.id === payment.student_id && s.tenant_id === tenantId);
    this.feeAuditLogs.unshift({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      action: 'reversal',
      student_id: payment.student_id,
      student_name: student?.full_name || 'Student',
      roll_number: student?.roll_number,
      reference_number: payment.receipt_number,
      amount: payment.amount_paid,
      reason: voidReason || 'Payment reversed by administrator',
      performed_by: voidedBy,
      created_at: new Date().toISOString(),
    });

    // Reverse the original fee-collection cashbook line instead of posting a fake expense.
    for (const tx of this.financialTransactions) {
      if (tx.tenant_id !== tenantId) continue;
      const matchesReceipt = tx.reference_number === payment.receipt_number
        || (tx.description || '').includes(`Receipt #${payment.receipt_number}`);
      if (matchesReceipt && tx.type === 'income') {
        tx.description = `[VOIDED] ${tx.description || payment.receipt_number}: ${voidReason}`;
        tx.amount = 0;
      }
    }

    // If invoice belongs to an installment plan and is no longer fully paid, revert milestone to 'billed'
    if (invoice.installment_number && (invoice.balance_amount > 0 || invoice.status !== 'paid')) {
      const payingStudent = this.students.find(s => s.id === invoice.student_id && s.tenant_id === tenantId);
      if (payingStudent?.installment_plan?.installments) {
        const inst = payingStudent.installment_plan.installments.find(i => i.installment_number === invoice.installment_number || i.invoice_id === invoice.id);
        if (inst && inst.status === 'paid') {
          inst.status = 'billed';
        }
      }
    }

    this.schedulePersist();

    return { payment, invoice };
  }

  async deletePayment(tenantId: string, paymentId: string, deletedBy: string): Promise<{ success: boolean; deleted_payment_id: string; invoice?: StudentInvoice }> {
    const payment = this.feePayments.find(p => p.id === paymentId && p.tenant_id === tenantId);
    if (!payment) throw new Error('Payment receipt not found');
    if (payment.status === 'voided') {
      throw new Error('Voided receipts are kept for audit and cannot be deleted.');
    }
    const { invoice } = await this.voidPayment(
      tenantId,
      paymentId,
      'Receipt voided in place of delete (audit trail retained)',
      deletedBy
    );
    return {
      success: true,
      deleted_payment_id: paymentId,
      invoice
    };
  }

  async getFeeAuditLogs(tenantId: string, studentId?: string): Promise<any[]> {
    const logs = [...(this.feeAuditLogs || [])];
    // Also include any voided payments from feePayments that might not be in feeAuditLogs
    for (const p of this.feePayments) {
      if (p.tenant_id !== tenantId || p.status !== 'voided') continue;
      const alreadyInLogs = logs.some(l => l.reference_number === p.receipt_number && l.action === 'reversal');
      if (!alreadyInLogs) {
        const student = this.students.find(s => s.id === p.student_id && s.tenant_id === tenantId);
        logs.push({
          id: p.id,
          tenant_id: tenantId,
          action: 'reversal',
          student_id: p.student_id,
          student_name: student?.full_name || 'Student',
          roll_number: student?.roll_number,
          reference_number: p.receipt_number,
          amount: p.amount_paid,
          reason: p.void_reason || 'Payment reversed by administrator',
          performed_by: p.voided_by || 'Finance Administrator',
          created_at: p.voided_at || p.payment_date || new Date().toISOString(),
        });
      }
    }

    return logs
      .filter(l => l.tenant_id === tenantId && (!studentId || l.student_id === studentId))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // --- Ad-Hoc Dynamic Discounts with Mandatory Audit Remarks ---
  async getDiscounts(tenantId: string, studentId?: string): Promise<FeeDiscount[]> {
    return this.feeDiscounts.filter(d => 
      d.tenant_id === tenantId && (!studentId || d.student_id === studentId)
    );
  }

  async applyDiscount(tenantId: string, data: {
    student_id: string;
    invoice_id?: string;
    fee_head_id?: string;
    discount_type: 'flat' | 'percentage';
    discount_value: number;
    mandatory_reason: string;
    approved_by: string;
  }): Promise<FeeDiscount> {
    if (!data.mandatory_reason || !data.mandatory_reason.trim()) {
      throw new Error('Mandatory approval remarks are required for all fee concessions and discounts');
    }

    const student = this.students.find(s => s.id === data.student_id && s.tenant_id === tenantId);
    if (!student) throw new Error('Student not found');

    let actualDiscount = 0;

    if (data.invoice_id) {
      const invoice = this.invoices.find(i => i.id === data.invoice_id && i.tenant_id === tenantId);
      if (!invoice) throw new Error('Invoice not found');
      if (invoice.status === 'cancelled' || invoice.status === 'voided') {
        throw new Error(`Cannot apply concession to a ${invoice.status} challan`);
      }
      if (invoice.balance_amount <= 0) {
        throw new Error('Cannot apply concession to a fully cleared challan with zero balance');
      }

      if (data.discount_type === 'flat') {
        actualDiscount = Number(data.discount_value);
      } else {
        actualDiscount = (invoice.subtotal_amount * Number(data.discount_value)) / 100;
      }
      actualDiscount = Math.min(actualDiscount, invoice.balance_amount);

      // Apply to invoice
      invoice.discount_amount += actualDiscount;
      invoice.net_amount = Math.max(0, invoice.subtotal_amount - invoice.discount_amount);
      invoice.balance_amount = Math.max(0, invoice.net_amount - invoice.paid_amount);
      invoice.status = invoice.balance_amount <= 0 ? 'paid' : (invoice.paid_amount > 0 ? 'partially_paid' : 'unpaid');
      invoice.updated_at = new Date().toISOString();

      // Distribute discount to items (proportionately or to eligible heads)
      if (data.fee_head_id) {
        const item = invoice.items.find((it: InvoiceItem) => it.fee_head_id === data.fee_head_id);
        if (item) {
          const alloc = Math.min(actualDiscount, item.original_amount);
          item.discount_amount += alloc;
          item.net_amount = Math.max(0, item.original_amount - item.discount_amount);
          item.balance_due = Math.max(0, item.net_amount - item.paid_amount);
        }
      } else {
        let remainingDisc = actualDiscount;
        for (const item of invoice.items) {
          if (remainingDisc <= 0) break;
          const maxDeduct = Math.max(0, item.original_amount - item.discount_amount);
          const deduct = Math.min(remainingDisc, maxDeduct);
          item.discount_amount += deduct;
          item.net_amount = Math.max(0, item.original_amount - item.discount_amount);
          item.balance_due = Math.max(0, item.net_amount - item.paid_amount);
          remainingDisc -= deduct;
        }
      }
    } else {
      actualDiscount = Number(data.discount_value);
    }

    const discount: FeeDiscount = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      student_id: student.id,
      student_name: student.full_name,
      roll_number: student.roll_number,
      invoice_id: data.invoice_id || null,
      fee_head_id: data.fee_head_id || null,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      actual_discount_amount: actualDiscount,
      mandatory_reason: data.mandatory_reason,
      approved_by: data.approved_by,
      applied_at: new Date().toISOString()
    };

    this.feeDiscounts.push(discount);
    this.schedulePersist();
    return discount;
  }

  // --- Financial Reports Suite ---
  async getDailyCashbook(tenantId: string, date?: string, endDate?: string): Promise<DailyCashbookEntry[]> {
    const start = date || '';
    const end = endDate || date || '';
    const payments = this.feePayments.filter(p => {
      if (p.tenant_id !== tenantId) return false;
      if (p.status === 'voided') return false;
      if (start && p.payment_date < start) return false;
      if (end && p.payment_date > end) return false;
      return true;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return payments.map(p => ({
      id: p.id,
      date: p.payment_date,
      receipt_number: p.receipt_number,
      student_name: p.student_name,
      roll_number: p.roll_number,
      payment_method: p.payment_method,
      amount: p.amount_paid,
      collected_by: p.collected_by,
      status: p.status || 'paid',
      void_reason: p.void_reason || null
    }));
  }

  async getStudentLedger(tenantId: string, studentId: string): Promise<StudentLedgerEntry[]> {
    const studentInvoices = this.invoices.filter(i => i.tenant_id === tenantId && i.student_id === studentId);
    const studentPayments = this.feePayments.filter(p => p.tenant_id === tenantId && p.student_id === studentId);

    const entries: StudentLedgerEntry[] = [];

    studentInvoices.forEach(inv => {
      if (inv.status === 'voided' || inv.status === 'cancelled') {
        return;
      }
      const currentCharge = Math.max(0, Number(inv.net_amount) - Number(inv.arrears_amount || 0));
      entries.push({
        id: inv.id,
        date: inv.issue_date,
        description: `Invoice ${inv.invoice_number} (${inv.billing_month})${Number(inv.arrears_amount || 0) > 0 ? ` [Charges: PKR ${currentCharge.toLocaleString()}, Arrears: PKR ${Number(inv.arrears_amount).toLocaleString()}]` : ''}`,
        debit: currentCharge,
        credit: 0,
        running_balance: 0,
        reference: inv.invoice_number
      });
    });

    studentPayments.forEach(pmt => {
      const pmtStatus = String(pmt.status || '');
      if (pmtStatus === 'voided' || pmtStatus === 'cancelled') {
        return;
      }
      entries.push({
        id: pmt.id,
        date: pmt.payment_date,
        description: `Payment Receipt ${pmt.receipt_number} via ${pmt.payment_method.toUpperCase()}`,
        debit: 0,
        credit: pmt.amount_paid,
        running_balance: 0,
        reference: pmt.receipt_number
      });
    });

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let balance = 0;
    for (const entry of entries) {
      balance += (entry.debit - entry.credit);
      entry.running_balance = balance;
    }

    return entries;
  }

  async getFeeHeadCollectionReport(tenantId: string): Promise<Array<{ fee_head_id: string; head_name: string; total_billed: number; total_collected: number; outstanding_balance: number }>> {
    const heads = await this.getFeeHeads(tenantId);
    const tenantInvoices = this.invoices.filter(i => i.tenant_id === tenantId);

    return heads.map(head => {
      let billed = 0;
      let collected = 0;

      tenantInvoices.forEach(inv => {
        if (inv.status === 'rolled_over' || inv.status === 'cancelled' || inv.status === 'voided') return;
        const item = inv.items.find((it: InvoiceItem) => it.fee_head_id === head.id);
        if (item) {
          billed += item.net_amount;
          collected += item.paid_amount;
        }
      });

      return {
        fee_head_id: head.id,
        head_name: head.name,
        total_billed: billed,
        total_collected: collected,
        outstanding_balance: Math.max(0, billed - collected)
      };
    });
  }

  // --- Dynamic Operational Income & Expense (ZERO Hardcoding) ---
  async getAccountHeads(tenantId: string, type?: 'income' | 'expense'): Promise<AccountHead[]> {
    return this.accountHeads.filter(h => h.tenant_id === tenantId && (!type || h.type === type) && h.is_active);
  }

  async createAccountHead(data: Omit<AccountHead, 'id' | 'created_at'>): Promise<AccountHead> {
    const head: AccountHead = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...data,
      is_active: data.is_active ?? true
    };
    this.accountHeads.push(head);
    this.schedulePersist();
    return head;
  }

  async deleteAccountHead(tenantId: string, id: string): Promise<boolean> {
    const head = this.accountHeads.find(h => h.tenant_id === tenantId && h.id === id);
    if (!head) return false;
    head.is_active = false;
    this.schedulePersist();
    return true;
  }

  async getFinancialTransactions(tenantId: string, filters?: { type?: 'income' | 'expense'; head_id?: string; startDate?: string; endDate?: string }): Promise<FinancialTransaction[]> {
    return this.financialTransactions.filter(t => {
      if (t.tenant_id !== tenantId) return false;
      if (filters?.type && t.type !== filters.type) return false;
      if (filters?.head_id && t.account_head_id !== filters.head_id) return false;
      if (filters?.startDate && t.transaction_date < filters.startDate) return false;
      if (filters?.endDate && t.transaction_date > filters.endDate) return false;
      return true;
    }).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  }

  async createFinancialTransaction(data: Omit<FinancialTransaction, 'id' | 'voucher_number' | 'created_at'>): Promise<FinancialTransaction> {
    const count = this.financialTransactions.filter(t => t.tenant_id === data.tenant_id && t.type === data.type).length + 1;
    const prefix = data.type === 'income' ? 'INC' : 'EXP';
    const year = new Date().getFullYear();
    const voucher_number = `VCH-${prefix}-${year}-${count.toString().padStart(4, '0')}`;

    const tx: FinancialTransaction = {
      id: crypto.randomUUID(),
      voucher_number,
      created_at: new Date().toISOString(),
      ...data,
      date: data.date || data.transaction_date,
      payee_payer: data.payee_payer || data.paid_to_or_received_from,
    };
    this.financialTransactions.push(tx);
    this.schedulePersist();
    return tx;
  }

  async getProfitLossReport(tenantId: string, month?: string): Promise<{
    totalFeeIncome: number;
    otherIncome: number;
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    incomeByHead: Record<string, number>;
    expenseByHead: Record<string, number>;
    total_income?: number;
    total_expense?: number;
    net_profit?: number;
    income_breakdown?: Record<string, number>;
    expense_breakdown?: Record<string, number>;
  }> {
    const relevantPayments = this.feePayments.filter(p => {
      if (p.tenant_id !== tenantId) return false;
      if (p.status === 'voided') return false;
      if (month && !p.payment_date.startsWith(month)) return false;
      return true;
    });
    const totalFeeIncome = relevantPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0);

    const relevantTx = this.financialTransactions.filter(t => {
      if (t.tenant_id !== tenantId) return false;
      if (month && !t.transaction_date.startsWith(month)) return false;
      if (Number(t.amount) <= 0) return false;
      if ((t.description || '').startsWith('[VOIDED]')) return false;
      if (t.head_name === 'Fee Receipt Void / Refund') return false;
      return true;
    });

    const incomeByHead: Record<string, number> = {
      'Student Fee Collections': totalFeeIncome
    };
    const expenseByHead: Record<string, number> = {};
    let otherIncome = 0;
    let totalExpenses = 0;

    for (const tx of relevantTx) {
      const amt = Number(tx.amount);
      if (tx.type === 'income') {
        // Exclude automatic fee collection cashbook postings so we don't double count against totalFeeIncome
        if (tx.head_name === 'Student Fee Collection' || tx.description?.startsWith('Tuition & Fee Collection')) {
          continue;
        }
        otherIncome += amt;
        incomeByHead[tx.head_name] = (incomeByHead[tx.head_name] || 0) + amt;
      } else {
        totalExpenses += amt;
        expenseByHead[tx.head_name] = (expenseByHead[tx.head_name] || 0) + amt;
      }
    }

    const totalIncome = totalFeeIncome + otherIncome;
    const netProfit = totalIncome - totalExpenses;

    return {
      totalFeeIncome,
      otherIncome,
      totalIncome,
      totalExpenses,
      netProfit,
      incomeByHead,
      expenseByHead,
      total_income: totalIncome,
      total_expense: totalExpenses,
      net_profit: netProfit,
      income_breakdown: incomeByHead,
      expense_breakdown: expenseByHead,
    };
  }

  // --- Staff Salary Structures & Interactive Payroll ---
  async getStaffSalaryProfiles(tenantId: string): Promise<StaffSalaryProfile[]> {
    return this.staffSalaryProfiles.filter(p => p.tenant_id === tenantId);
  }

  async saveStaffSalaryProfile(data: Omit<StaffSalaryProfile, 'id' | 'created_at' | 'updated_at'>): Promise<StaffSalaryProfile> {
    const existingIdx = this.staffSalaryProfiles.findIndex(p => p.tenant_id === data.tenant_id && p.staff_id === data.staff_id);
    const profile: StaffSalaryProfile = {
      ...data,
      id: existingIdx >= 0 ? this.staffSalaryProfiles[existingIdx].id : crypto.randomUUID(),
      created_at: existingIdx >= 0 ? this.staffSalaryProfiles[existingIdx].created_at : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      this.staffSalaryProfiles[existingIdx] = profile;
    } else {
      this.staffSalaryProfiles.push(profile);
    }
    this.schedulePersist();
    return profile;
  }

  async getPayslips(tenantId: string, options?: { staffId?: string; payrollMonth?: string }): Promise<StaffPayslip[]> {
    return this.staffPayslips.filter(p => {
      if (p.tenant_id !== tenantId) return false;
      if (options?.staffId && p.staff_id !== options.staffId) return false;
      if (options?.payrollMonth && p.payroll_month.toLowerCase() !== options.payrollMonth.toLowerCase()) return false;
      return true;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async generatePayslip(tenantId: string, data: {
    staff_id: string;
    payroll_month: string;
    earnings: PayrollEarningHead[];
    deductions: PayrollDeductionHead[];
    admin_notes?: string;
    processed_by: string;
  }): Promise<StaffPayslip> {
    const profile = this.staffSalaryProfiles.find(p => p.tenant_id === tenantId && p.staff_id === data.staff_id);
    if (!profile) throw new Error('Staff salary profile not configured');

    const existingSlip = this.staffPayslips.find(p =>
      p.tenant_id === tenantId &&
      p.staff_id === data.staff_id &&
      isSameBillingMonth(p.payroll_month, data.payroll_month)
    );
    if (existingSlip) {
      throw new Error(`A payslip already exists for this staff member for ${data.payroll_month} (${existingSlip.slip_number}).`);
    }

    const monthPrefix = (() => {
      const n = normalizeBillingMonth(data.payroll_month);
      const parts = n.split(' ');
      const idx = MONTH_NAMES.indexOf(parts[0] as typeof MONTH_NAMES[number]);
      if (idx < 0 || !parts[1]) return '';
      return `${parts[1]}-${String(idx + 1).padStart(2, '0')}`;
    })();

    const attendanceRecords = this.staffAttendance.filter(a => {
      if (a.tenant_id !== tenantId || a.staff_id !== data.staff_id) return false;
      if (!monthPrefix) return true;
      return (a.date || '').startsWith(monthPrefix);
    });
    const presentDays = attendanceRecords.filter(a => a.status === 'on_time' || a.status === 'late').length;
    const lateCount = attendanceRecords.filter(a => a.status === 'late').length;
    const absentDays = attendanceRecords.filter(a => a.status === 'absent').length;
    const approvedLeaves = attendanceRecords.filter(a => a.status === 'on_leave').length;

    const workingDays = 26;
    const effectivePresentDays = presentDays;
    const effectiveLateCount = lateCount;
    const effectiveAbsentDays = absentDays;
    const effectiveLeaves = approvedLeaves;
    const effectiveHours = presentDays * 2;

    const earningsWithTotal = data.earnings.map(e => ({
      ...e,
      total: Number(e.quantity) * Number(e.unit_rate)
    }));

    const deductionsWithTotal = data.deductions.map(d => ({
      ...d,
      total: Number(d.quantity) * Number(d.unit_rate)
    }));

    const totalEarnings = earningsWithTotal.reduce((s, e) => s + e.total, 0);
    const totalDeductions = deductionsWithTotal.reduce((s, d) => s + d.total, 0);
    const netSalary = Math.max(0, profile.base_amount + totalEarnings - totalDeductions);

    const count = this.staffPayslips.filter(p => p.tenant_id === tenantId).length + 1;
    const cleanMonth = data.payroll_month.replace(/\s+/g, '');
    const slipNumber = `PAY-${cleanMonth}-${count.toString().padStart(4, '0')}`;

    const payslip: StaffPayslip = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      slip_number: slipNumber,
      staff_id: profile.staff_id,
      staff_name: profile.staff_name,
      designation: profile.designation,
      payroll_month: data.payroll_month,
      base_salary: profile.base_amount,
      attendance_summary: {
        working_days: workingDays,
        present_days: effectivePresentDays,
        late_count: effectiveLateCount,
        absent_days: effectiveAbsentDays,
        approved_leaves: effectiveLeaves,
        hours_or_lectures: effectiveHours
      },
      earnings: earningsWithTotal,
      deductions: deductionsWithTotal,
      total_earnings: totalEarnings,
      total_deductions: totalDeductions,
      net_salary: netSalary,
      status: 'processed',
      admin_notes: data.admin_notes || null,
      processed_by: data.processed_by,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.staffPayslips.push(payslip);
    this.schedulePersist();
    return payslip;
  }

  async markPayslipPaid(tenantId: string, payslipId: string, paymentMethod: PaymentMethod, reference?: string): Promise<StaffPayslip> {
    const slip = this.staffPayslips.find(p => p.id === payslipId && p.tenant_id === tenantId);
    if (!slip) throw new Error('Payslip not found');
    if (slip.status === 'paid') {
      throw new Error('This payslip has already been marked paid.');
    }

    slip.status = 'paid';
    slip.payment_date = new Date().toISOString().split('T')[0];
    slip.payment_method = paymentMethod;
    slip.transaction_reference = reference || null;
    slip.updated_at = new Date().toISOString();

    // Auto-post salary expense to Cashbook
    const salaryHead = (await this.getAccountHeads(tenantId, 'expense'))
      .find(h => /salary|payroll|wage/i.test(`${h.name} ${h.code || ''}`));
    await this.createFinancialTransaction({
      tenant_id: tenantId,
      type: 'expense',
      account_head_id: salaryHead?.id || 'head-salaries',
      head_name: salaryHead?.name || 'Staff Salaries & Payroll',
      amount: slip.net_salary,
      payment_method: paymentMethod,
      reference_number: reference || slip.slip_number,
      paid_to_or_received_from: slip.staff_name,
      transaction_date: slip.payment_date,
      description: `Payroll Disbursal: ${slip.staff_name} (${slip.designation}) - Payslip #${slip.slip_number} [${slip.payroll_month}]`,
      recorded_by: 'Administration',
    });

    this.schedulePersist();
    return slip;
  }

  // --- Phase 5: Examination Bank, Dual Question Bank Modes & Hybrid Evaluation ---
  async getQuestionChapters(tenantId: string, subjectId?: string, programId?: string): Promise<QuestionChapter[]> {
    return this.questionChapters
      .filter(c => {
        if (c.tenant_id !== tenantId) return false;
        if (subjectId && c.subject_id !== subjectId) return false;
        if (programId && c.program_id !== programId) return false;
        return true;
      })
      .map(c => {
        const sub = this.subjects.find(s => s.id === c.subject_id && s.tenant_id === tenantId);
        const prog = this.programs.find(p => p.id === c.program_id && p.tenant_id === tenantId);
        const qCount = this.bankQuestions.filter(q => q.chapter_id === c.id && q.tenant_id === tenantId).length;
        return {
          ...c,
          subject_name: sub ? sub.name : c.subject_name,
          program_name: prog ? prog.name : c.program_name,
          question_count: qCount
        };
      });
  }

  async createQuestionChapter(tenantId: string, data: Omit<QuestionChapter, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<QuestionChapter> {
    const chapter: QuestionChapter = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.questionChapters.push(chapter);
    this.schedulePersist();
    return chapter;
  }

  async getBankQuestions(tenantId: string, filters?: { chapterId?: string; subjectId?: string; type?: ExamQuestionType; isQuizBank?: boolean }): Promise<BankQuestion[]> {
    return this.bankQuestions
      .filter(q => {
        if (q.tenant_id !== tenantId) return false;
        if (filters?.chapterId && q.chapter_id !== filters.chapterId) return false;
        if (filters?.subjectId && q.subject_id !== filters.subjectId) return false;
        if (filters?.type && q.question_type !== filters.type) return false;
        if (filters?.isQuizBank !== undefined && q.is_quiz_bank !== filters.isQuizBank) return false;
        return true;
      })
      .map(q => {
        const sub = this.subjects.find(s => s.id === q.subject_id && s.tenant_id === tenantId);
        const chap = this.questionChapters.find(c => c.id === q.chapter_id && c.tenant_id === tenantId);
        return {
          ...q,
          subject_name: sub ? sub.name : q.subject_name,
          chapter_name: chap ? chap.chapter_name : q.chapter_name
        };
      });
  }

  async createBankQuestion(tenantId: string, data: Omit<BankQuestion, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<BankQuestion> {
    const question: BankQuestion = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.bankQuestions.push(question);
    this.schedulePersist();
    return question;
  }

  async importQuestionsFromExcel(tenantId: string, subjectId: string, programId: string, rows: ExcelQuestionImportRow[]): Promise<{ imported_count: number; chapters_created: number; questions: BankQuestion[] }> {
    let chaptersCreated = 0;
    const importedQuestions: BankQuestion[] = [];

    for (const row of rows) {
      let chapterId: string | undefined = undefined;

      if (row.chapter_name || row.chapter_number) {
        let existingChapter = this.questionChapters.find(c => 
          c.tenant_id === tenantId && 
          c.subject_id === subjectId && 
          (row.chapter_number ? c.chapter_number === row.chapter_number : c.chapter_name.toLowerCase() === row.chapter_name?.toLowerCase())
        );

        if (!existingChapter && row.chapter_name) {
          const nextChapNum = row.chapter_number || (this.questionChapters.filter(c => c.tenant_id === tenantId && c.subject_id === subjectId).length + 1);
          existingChapter = {
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            program_id: programId,
            subject_id: subjectId,
            chapter_number: nextChapNum,
            chapter_name: row.chapter_name,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          this.questionChapters.push(existingChapter);
          chaptersCreated++;
        }
        chapterId = existingChapter?.id;
      }

      const qType: ExamQuestionType = row.question_type || 'MCQ';
      let options: Array<{ key: string; text: string }> = [];
      if (qType === 'MCQ') {
        if (row.option_a) options.push({ key: 'A', text: row.option_a });
        if (row.option_b) options.push({ key: 'B', text: row.option_b });
        if (row.option_c) options.push({ key: 'C', text: row.option_c });
        if (row.option_d) options.push({ key: 'D', text: row.option_d });
      }

      const newQ: BankQuestion = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        chapter_id: chapterId || null,
        subject_id: subjectId,
        question_type: qType,
        question_text: row.question_text,
        marks: row.marks || (qType === 'MCQ' ? 1 : (qType === 'SHORT' ? 4 : 8)),
        options: options.length > 0 ? options : undefined,
        correct_option: qType === 'MCQ' ? (row.correct_option?.trim().toUpperCase() || 'A') : null,
        rubric_guide: row.rubric_guide || null,
        difficulty_level: row.difficulty_level || 'MEDIUM',
        is_quiz_bank: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      this.bankQuestions.push(newQ);
      importedQuestions.push(newQ);
    }

    this.schedulePersist();
    return {
      imported_count: importedQuestions.length,
      chapters_created: chaptersCreated,
      questions: importedQuestions
    };
  }

  async deleteBankQuestion(tenantId: string, questionId: string): Promise<boolean> {
    const idx = this.bankQuestions.findIndex(q => q.id === questionId && q.tenant_id === tenantId);
    if (idx === -1) return false;
    this.bankQuestions.splice(idx, 1);
    this.schedulePersist();
    return true;
  }

  async getExams(tenantId: string, batchId?: string, subjectId?: string): Promise<Exam[]> {
    return this.exams
      .filter(e => {
        if (e.tenant_id !== tenantId) return false;
        if (batchId && e.batch_id !== batchId) return false;
        if (subjectId && e.subject_id !== subjectId) return false;
        return true;
      })
      .map(e => {
        const batch = this.batches.find(b => b.id === e.batch_id && b.tenant_id === tenantId);
        const sub = this.subjects.find(s => s.id === e.subject_id && s.tenant_id === tenantId);
        const questions = this.examQuestions
          .filter(q => q.exam_id === e.id && q.tenant_id === tenantId)
          .sort((a, b) => a.display_order - b.display_order);
        return {
          ...e,
          batch_name: batch ? batch.name : e.batch_name,
          subject_name: sub ? sub.name : e.subject_name,
          questions
        };
      });
  }

  async getExamById(tenantId: string, examId: string): Promise<Exam | null> {
    const exam = this.exams.find(e => e.id === examId && e.tenant_id === tenantId);
    if (!exam) return null;

    const batch = this.batches.find(b => b.id === exam.batch_id && b.tenant_id === tenantId);
    const sub = this.subjects.find(s => s.id === exam.subject_id && s.tenant_id === tenantId);
    const questions = this.examQuestions
      .filter(q => q.exam_id === exam.id && q.tenant_id === tenantId)
      .sort((a, b) => a.display_order - b.display_order);

    return {
      ...exam,
      batch_name: batch ? batch.name : exam.batch_name,
      subject_name: sub ? sub.name : exam.subject_name,
      questions
    };
  }

  async createExam(tenantId: string, data: Omit<Exam, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<Exam> {
    const computedMarks = (data.mcq_total_marks || ((data.mcq_count || 0) * (data.mcq_marks_per_q || 0)) || 0) + (data.short_total_marks || 0) + (data.long_total_marks || 0);
    const totalMarks = computedMarks > 0 ? computedMarks : (data.total_marks || 100);
    const defaultLabels = {
      mcq: 'Q.1 (Objective MCQs)',
      short: 'Q.2 (Short Questions)',
      long: 'Q.3 (Long Questions)'
    };

    const exam: Exam = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      ...data,
      total_marks: totalMarks,
      section_labels: data.section_labels || defaultLabels,
      status: data.status || 'DRAFT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.exams.push(exam);
    this.schedulePersist();
    return exam;
  }

  async updateExam(tenantId: string, examId: string, updates: Partial<Exam>): Promise<Exam> {
    const exam = this.exams.find(e => e.id === examId && e.tenant_id === tenantId);
    if (!exam) throw new Error('Exam not found');

    Object.assign(exam, updates);
    if (updates.mcq_total_marks !== undefined || updates.short_total_marks !== undefined || updates.long_total_marks !== undefined) {
      exam.total_marks = (exam.mcq_total_marks || 0) + (exam.short_total_marks || 0) + (exam.long_total_marks || 0);
    }
    exam.updated_at = new Date().toISOString();
    this.schedulePersist();
    return exam;
  }

  async addExamQuestions(tenantId: string, examId: string, questions: Omit<ExamQuestion, 'id' | 'tenant_id' | 'exam_id' | 'created_at'>[]): Promise<ExamQuestion[]> {
    const exam = this.exams.find(e => e.id === examId && e.tenant_id === tenantId);
    if (!exam) throw new Error('Exam not found');

    const added: ExamQuestion[] = [];
    for (const q of questions) {
      const examQ: ExamQuestion = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        exam_id: examId,
        ...q,
        created_at: new Date().toISOString()
      };
      this.examQuestions.push(examQ);
      added.push(examQ);
    }
    this.schedulePersist();
    return added;
  }

  async getExamQuestions(tenantId: string, examId: string): Promise<ExamQuestion[]> {
    return this.examQuestions
      .filter(q => q.exam_id === examId && q.tenant_id === tenantId)
      .sort((a, b) => a.display_order - b.display_order);
  }

  async evaluateStudentExam(tenantId: string, data: {
    exam_id: string;
    student_id: string;
    mcq_answers?: Record<string, string>;
    short_score?: number;
    short_remarks?: string;
    long_score?: number;
    long_remarks?: string;
    status?: EvaluationStatus;
    evaluated_by?: string;
  }): Promise<StudentExamEvaluation> {
    const exam = this.exams.find(e => e.id === data.exam_id && e.tenant_id === tenantId);
    if (!exam) throw new Error('Exam not found');

    const student = this.students.find(s => s.id === data.student_id && s.tenant_id === tenantId);
    if (!student) throw new Error('Student not found');
    if (student.status !== 'active') {
      throw new Error(`Cannot evaluate exam: Student "${student.full_name}" is ${student.status}. Evaluations are restricted to active students.`);
    }

    const subject = this.subjects.find(s => s.id === exam.subject_id && (s.tenant_id === tenantId || !s.tenant_id));
    if (!Array.isArray(student.subjects) || !student.subjects.includes(exam.subject_id)) {
      throw new Error(`Student "${student.full_name}" is not enrolled in subject "${subject?.name || exam.subject_id}". Cannot record exam score.`);
    }

    // 1. Auto-grade MCQs
    const examMcqs = this.examQuestions.filter(q => q.exam_id === exam.id && q.tenant_id === tenantId && q.section_type === 'MCQ');
    let autoMcqScore = 0;
    const userAnswers = data.mcq_answers || {};

    for (const mcq of examMcqs) {
      const chosen = userAnswers[mcq.id]?.trim().toUpperCase();
      if (chosen && mcq.correct_option && chosen === mcq.correct_option.trim().toUpperCase()) {
        autoMcqScore += Number(mcq.marks || exam.mcq_marks_per_q || 1);
      }
    }

    const shortScore = Number(data.short_score || 0);
    const longScore = Number(data.long_score || 0);
    const totalObtained = Number((autoMcqScore + shortScore + longScore).toFixed(2));
    const totalPossible = exam.total_marks > 0 ? exam.total_marks : 100;
    const percentage = Number(((totalObtained / totalPossible) * 100).toFixed(2));

    // Phase 5: Tenant-configurable grading scale or standard Pakistani Matric/F.Sc scale
    const tenant = this.tenants.get(tenantId);
    const customScale = tenant?.settings?.grading_scale;

    let grade = 'F';
    if (customScale && Array.isArray(customScale) && customScale.length > 0) {
      const sortedTiers = [...customScale].sort((a, b) => b.min_percentage - a.min_percentage);
      for (const tier of sortedTiers) {
        if (percentage >= tier.min_percentage) {
          grade = tier.grade;
          break;
        }
      }
    } else {
      // Standard Pakistani Matric/F.Sc Board Grading Scale
      if (percentage >= 80) grade = 'A+';
      else if (percentage >= 70) grade = 'A';
      else if (percentage >= 60) grade = 'B';
      else if (percentage >= 50) grade = 'C';
      else if (percentage >= 40) grade = 'D';
      else if (percentage >= 33) grade = 'E';
      else grade = 'F';
    }

    let evaluation = this.studentExamEvaluations.find(ev => 
      ev.tenant_id === tenantId && 
      ev.exam_id === data.exam_id && 
      ev.student_id === data.student_id
    );

    if (evaluation) {
      evaluation.mcq_answers = userAnswers;
      evaluation.mcq_score = autoMcqScore;
      evaluation.short_score = shortScore;
      evaluation.short_remarks = data.short_remarks || null;
      evaluation.long_score = longScore;
      evaluation.long_remarks = data.long_remarks || null;
      evaluation.total_obtained = totalObtained;
      evaluation.percentage = percentage;
      evaluation.grade = grade;
      evaluation.status = data.status || 'GRADED';
      evaluation.evaluated_by = data.evaluated_by || evaluation.evaluated_by;
      evaluation.updated_at = new Date().toISOString();
    } else {
      evaluation = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        exam_id: data.exam_id,
        student_id: data.student_id,
        student_name: student.full_name,
        roll_number: student.roll_number,
        batch_name: this.batches.find(b => b.id === student.batch_id && b.tenant_id === tenantId)?.name,
        mcq_answers: userAnswers,
        mcq_score: autoMcqScore,
        short_score: shortScore,
        short_remarks: data.short_remarks || null,
        long_score: longScore,
        long_remarks: data.long_remarks || null,
        total_obtained: totalObtained,
        percentage,
        grade,
        status: data.status || 'GRADED',
        evaluated_by: data.evaluated_by || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.studentExamEvaluations.push(evaluation);
    }

    exam.status = 'GRADED';
    this.schedulePersist();
    return evaluation;
  }

  async getExamEvaluations(tenantId: string, examId: string): Promise<StudentExamEvaluation[]> {
    return this.studentExamEvaluations
      .filter(ev => ev.exam_id === examId && ev.tenant_id === tenantId)
      .map(ev => {
        const student = this.students.find(s => s.id === ev.student_id && s.tenant_id === tenantId);
        return {
          ...ev,
          student_name: student ? student.full_name : ev.student_name,
          roll_number: student ? student.roll_number : ev.roll_number
        };
      });
  }

  async getStudentReportCard(tenantId: string, examId: string, studentId: string): Promise<StudentOfficialReportCard | null> {
    const exam = await this.getExamById(tenantId, examId);
    if (!exam) return null;

    const student = this.students.find(s => s.id === studentId && s.tenant_id === tenantId);
    if (!student) return null;

    let evaluation = this.studentExamEvaluations.find(ev => ev.exam_id === examId && ev.student_id === studentId && ev.tenant_id === tenantId);
    if (!evaluation) {
      if (!Array.isArray(student.subjects) || !student.subjects.includes(exam.subject_id)) {
        return null;
      }
      evaluation = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        exam_id: examId,
        student_id: studentId,
        student_name: student.full_name,
        roll_number: student.roll_number,
        mcq_answers: {},
        mcq_score: 0,
        short_score: 0,
        short_remarks: null,
        long_score: 0,
        long_remarks: null,
        total_obtained: 0,
        percentage: 0,
        grade: 'F',
        status: 'ABSENT',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    const allEvals = this.studentExamEvaluations
      .filter(ev => ev.exam_id === examId && ev.tenant_id === tenantId)
      .sort((a, b) => b.total_obtained - a.total_obtained);
    const rank = allEvals.findIndex(ev => ev.student_id === studentId) + 1;

    return {
      exam,
      evaluation,
      student: {
        id: student.id,
        full_name: student.full_name,
        roll_number: student.roll_number,
        guardian_name: student.guardian_name,
        class_name: this.programs.find(p => p.id === student.program_id && p.tenant_id === tenantId)?.name,
        batch_name: this.batches.find(b => b.id === student.batch_id && b.tenant_id === tenantId)?.name
      },
      rank: rank > 0 ? rank : 1,
      total_students: Math.max(allEvals.length, 1)
    };
  }

  // ===========================================================================
  // PHASE 6: WHATSAPP MESSAGING & ABSENTEE RETENTION DESK
  // ===========================================================================

  sanitizePhoneNumber(phone: string, countryCode: string = '92'): { clean_phone: string; is_valid: boolean; warning?: string } {
    if (!phone) {
      return { clean_phone: '', is_valid: false, warning: 'Phone number is missing.' };
    }

    let digits = phone.replace(/\D/g, '');
    while (digits.startsWith('0')) {
      digits = digits.substring(1);
    }

    const cleanCountry = countryCode.replace(/\D/g, '') || '92';
    if (!digits.startsWith(cleanCountry)) {
      digits = cleanCountry + digits;
    }

    const isValid = digits.length >= 10 && digits.length <= 15;
    let warning: string | undefined;
    if (!isValid) {
      warning = `Phone number ${phone} seems incomplete or invalid (${digits.length} digits).`;
    }

    return { clean_phone: digits, is_valid: isValid, warning };
  }

  replaceDynamicTags(template: string, data: Record<string, any>): string {
    let result = template;
    for (const [key, val] of Object.entries(data)) {
      const tag = `{${key}}`;
      const cleanVal = val !== undefined && val !== null ? String(val) : '';
      result = result.split(tag).join(cleanVal);
    }
    result = result.replace(/\{[a-zA-Z0-9_]+\}/g, '');
    return result;
  }

  generateWhatsAppLink(phone: string, message: string, countryCode: string = '92'): WhatsAppSanitizedUrlResult {
    const sanitization = this.sanitizePhoneNumber(phone, countryCode);
    const encoded = encodeURIComponent(message);
    const encoded_url = `https://wa.me/${sanitization.clean_phone}?text=${encoded}`;

    return {
      phone,
      clean_phone: sanitization.clean_phone,
      is_valid: sanitization.is_valid,
      message,
      encoded_url,
      warning: sanitization.warning
    };
  }

  async getWhatsAppTemplates(tenantId: string, category?: string): Promise<WhatsAppTemplate[]> {
    return this.whatsappTemplates.filter(t => {
      if (t.tenant_id !== tenantId) return false;
      if (category && t.category !== category) return false;
      return true;
    });
  }

  async createWhatsAppTemplate(tenantId: string, data: Omit<WhatsAppTemplate, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<WhatsAppTemplate> {
    const tmpl: WhatsAppTemplate = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (tmpl.is_default) {
      this.whatsappTemplates.forEach(t => {
        if (t.tenant_id === tenantId && t.category === tmpl.category) {
          t.is_default = false;
        }
      });
    }
    this.whatsappTemplates.push(tmpl);
    return tmpl;
  }

  async updateWhatsAppTemplate(tenantId: string, id: string, data: Partial<Omit<WhatsAppTemplate, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>): Promise<WhatsAppTemplate | null> {
    const tmpl = this.whatsappTemplates.find(t => t.id === id && t.tenant_id === tenantId);
    if (!tmpl) return null;

    if (data.is_default) {
      this.whatsappTemplates.forEach(t => {
        if (t.tenant_id === tenantId && t.category === (data.category || tmpl.category) && t.id !== id) {
          t.is_default = false;
        }
      });
    }

    Object.assign(tmpl, data, { updated_at: new Date().toISOString() });
    return tmpl;
  }

  async deleteWhatsAppTemplate(tenantId: string, id: string): Promise<boolean> {
    const idx = this.whatsappTemplates.findIndex(t => t.id === id && t.tenant_id === tenantId);
    if (idx === -1) return false;
    this.whatsappTemplates.splice(idx, 1);
    return true;
  }

  async logWhatsAppDispatch(tenantId: string, data: Omit<WhatsAppAuditLog, 'id' | 'tenant_id' | 'dispatched_at'>): Promise<WhatsAppAuditLog> {
    const student = this.students.find(s => s.id === data.student_id);
    const user = data.dispatched_by ? Array.from(this.users.values()).find(u => u.id === data.dispatched_by) : undefined;

    const log: WhatsAppAuditLog = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      ...data,
      student_name: student ? student.full_name : data.student_name,
      roll_number: student ? student.roll_number : data.roll_number,
      dispatched_by_name: user ? user.full_name : undefined,
      dispatched_at: new Date().toISOString()
    };
    this.whatsappAuditLogs.push(log);

    const today = new Date().toISOString().split('T')[0];
    const followup = this.absenteeFollowups.find(f => f.student_id === data.student_id && f.tenant_id === tenantId && f.date === today);
    if (followup) {
      followup.last_whatsapp_sent_at = log.dispatched_at;
      if (followup.status === 'PENDING') {
        followup.status = 'CONTACTED';
        followup.call_outcome = 'WHATSAPP_SENT';
      }
    }

    return log;
  }

  async getWhatsAppAuditLogs(tenantId: string, studentId?: string): Promise<WhatsAppAuditLog[]> {
    return this.whatsappAuditLogs
      .filter(l => {
        if (l.tenant_id !== tenantId) return false;
        if (studentId && l.student_id !== studentId) return false;
        return true;
      })
      .sort((a, b) => new Date(b.dispatched_at).getTime() - new Date(a.dispatched_at).getTime());
  }

  async checkDuplicateAlertToday(tenantId: string, studentId: string, _templateCategory: string): Promise<{ wasDispatchedToday: boolean; lastDispatchedAt?: string; dispatchedBy?: string }> {
    const today = new Date().toISOString().split('T')[0];
    const logs = this.whatsappAuditLogs.filter(l => {
      if (l.tenant_id !== tenantId || l.student_id !== studentId) return false;
      const logDate = l.dispatched_at.split('T')[0];
      return logDate === today;
    });

    if (logs.length > 0) {
      const latest = logs[logs.length - 1];
      return {
        wasDispatchedToday: true,
        lastDispatchedAt: latest.dispatched_at,
        dispatchedBy: latest.dispatched_by_name || undefined
      };
    }

    return { wasDispatchedToday: false };
  }

  async syncDailyAbsenteeRoster(tenantId: string, date: string): Promise<AbsenteeFollowupItem[]> {
    const absentees = this.studentAttendance.filter(a => a.tenant_id === tenantId && a.date === date && a.status === 'absent');

    for (const att of absentees) {
      const existing = this.absenteeFollowups.find(f => f.tenant_id === tenantId && f.student_id === att.student_id && f.date === date);
      if (!existing) {
        const student = this.students.find(s => s.id === att.student_id && s.tenant_id === tenantId);
        const batch = student?.batch_id ? this.batches.find(b => b.id === student.batch_id && b.tenant_id === tenantId) : undefined;

        const prevFollowup = this.absenteeFollowups
          .filter(f => f.tenant_id === tenantId && f.student_id === att.student_id && f.date < date)
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        const consecutive = prevFollowup ? prevFollowup.consecutive_days + 1 : 1;

        this.absenteeFollowups.push({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          student_id: att.student_id,
          student_name: student?.full_name || 'Student',
          roll_number: student?.roll_number || 'N/A',
          guardian_name: student?.guardian_name || 'Guardian',
          guardian_phone: student?.guardian_phone || '+923000000000',
          backup_phone: '+923210000000',
          batch_id: batch?.id || 'batch-1',
          batch_name: batch?.name || 'Batch',
          date,
          consecutive_days: consecutive,
          call_outcome: null,
          reason_category: null,
          parent_remarks: null,
          expected_return_date: null,
          is_snoozed: false,
          snooze_until: null,
          status: 'PENDING',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    this.schedulePersist();
    return this.absenteeFollowups.filter(f => f.tenant_id === tenantId && f.date === date);
  }

  async getAbsenteeFollowups(tenantId: string, filters?: { date?: string; batchId?: string; status?: string }): Promise<AbsenteeFollowupItem[]> {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = filters?.date || today;

    // Dynamically auto-sync any students marked absent in the attendance table
    await this.syncDailyAbsenteeRoster(tenantId, targetDate);

    return this.absenteeFollowups
      .filter(f => {
        if (f.tenant_id !== tenantId) return false;
        if (f.date !== targetDate) return false;
        if (filters?.batchId && f.batch_id !== filters.batchId) return false;
        if (filters?.status && filters.status !== 'ALL' && f.status !== filters.status) return false;
        return true;
      })
      .sort((a, b) => b.consecutive_days - a.consecutive_days);
  }

  async getAbsenteeDeskKPI(tenantId: string, date: string): Promise<AbsenteeDeskSummaryKPI> {
    await this.getAbsenteeFollowups(tenantId, { date });
    const followups = this.absenteeFollowups.filter(f => f.tenant_id === tenantId && f.date === date);
    const total = followups.length;
    const contacted = followups.filter(f => f.status === 'CONTACTED' || f.status === 'RESOLVED_EXCUSED').length;
    const unreachable = followups.filter(f => f.status === 'UNREACHABLE').length;
    const pending = followups.filter(f => f.status === 'PENDING').length;
    const excused = followups.filter(f => f.status === 'RESOLVED_EXCUSED').length;

    const contacted_percentage = total > 0 ? Number(((contacted / total) * 100).toFixed(1)) : 0;

    return {
      total_absentees: total,
      contacted_count: contacted,
      contacted_percentage,
      unreachable_count: unreachable,
      pending_count: pending,
      excused_count: excused
    };
  }

  async logParentResponse(
    tenantId: string,
    id: string,
    data: {
      call_outcome: AbsenteeCallOutcome;
      reason_category: AbsenteeReasonCategory;
      parent_remarks?: string;
      expected_return_date?: string;
      convert_to_medical_leave?: boolean;
    },
    counselorId?: string
  ): Promise<AbsenteeFollowupItem | null> {
    const item = this.absenteeFollowups.find(f => f.id === id && f.tenant_id === tenantId);
    if (!item) return null;

    const counselor = counselorId ? Array.from(this.users.values()).find(u => u.id === counselorId) : undefined;

    item.call_outcome = data.call_outcome;
    item.reason_category = data.reason_category;
    item.parent_remarks = data.parent_remarks || item.parent_remarks;
    item.expected_return_date = data.expected_return_date || item.expected_return_date;
    item.staff_counselor_id = counselorId || item.staff_counselor_id;
    item.staff_counselor_name = counselor ? counselor.full_name : item.staff_counselor_name;
    item.updated_at = new Date().toISOString();

    if (data.convert_to_medical_leave) {
      item.status = 'RESOLVED_EXCUSED';
      const att = this.studentAttendance.find(a => a.tenant_id === tenantId && a.student_id === item.student_id && a.date === item.date);
      if (att) {
        const prevStatus = att.status;
        att.status = 'excused';
        att.remarks = `Excused via Absentee Follow-Up (${data.reason_category}): ${data.parent_remarks || 'Medical/Family explanation'}`;
        
        // Add audit trail so attendance desk reflects regularization
        this.attendanceAuditLogs.push({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          student_id: item.student_id,
          student_name: item.student_name,
          batch_id: item.batch_id,
          date: item.date,
          previous_status: prevStatus,
          new_status: 'excused',
          reason: `Absence Desk Regularization: ${data.reason_category} - ${data.parent_remarks || 'Parent contacted'}`,
          changed_by: item.staff_counselor_name || 'Staff Counselor',
          created_at: new Date().toISOString()
        });
      }
    } else if (data.call_outcome === 'NO_ANSWER' || data.call_outcome === 'SWITCHED_OFF') {
      item.status = 'UNREACHABLE';
    } else {
      item.status = 'CONTACTED';
    }

    if (data.expected_return_date) {
      item.is_snoozed = true;
      item.snooze_until = data.expected_return_date;
    }

    return item;
  }

  async getRetentionCases(tenantId: string): Promise<RetentionCounselingCase[]> {
    return this.retentionCases.filter(c => c.tenant_id === tenantId);
  }

  async scheduleRetentionMeeting(tenantId: string, caseId: string, meetingDate: string, notes: string): Promise<RetentionCounselingCase | null> {
    const c = this.retentionCases.find(rc => rc.id === caseId && rc.tenant_id === tenantId);
    if (!c) return null;

    c.scheduled_meeting_date = meetingDate;
    c.counseling_notes = notes;
    c.status = 'SCHEDULED';
    c.updated_at = new Date().toISOString();
    return c;
  }

  async getAbsenteeResolutionReport(tenantId: string, month: string): Promise<AbsenteeResolutionReport> {
    const followups = this.absenteeFollowups.filter(f => f.tenant_id === tenantId && f.date.startsWith(month));
    const total = followups.length;
    const contacted = followups.filter(f => f.status === 'CONTACTED' || f.status === 'RESOLVED_EXCUSED').length;
    const excused = followups.filter(f => f.status === 'RESOLVED_EXCUSED').length;

    const breakdown: Record<AbsenteeReasonCategory, number> = {
      MEDICAL: 0,
      EMERGENCY: 0,
      TRANSPORT: 0,
      FEE_DISPUTE: 0,
      TRUANCY: 0,
      OTHER: 0
    };

    followups.forEach(f => {
      if (f.reason_category && breakdown[f.reason_category] !== undefined) {
        breakdown[f.reason_category]++;
      }
    });

    const cases = this.retentionCases.filter(c => c.tenant_id === tenantId && c.status === 'RESOLVED');

    return {
      total_absences: total,
      followup_rate: total > 0 ? Number(((contacted / total) * 100).toFixed(1)) : 0,
      reason_breakdown: breakdown,
      medical_leave_converted: excused,
      prevented_dropouts: cases.length
    };
  }

  // =============================================================================
  // PHASE 7: MULTI-PORTAL DASHBOARDS, SAAS BILLING LOCKOUT & CONTROL PLANE
  // =============================================================================

  async getPlatformBankingConfig(): Promise<PlatformBankingConfig> {
    return { ...this.platformBankingConfig };
  }

  async updatePlatformBankingConfig(data: Partial<PlatformBankingConfig>): Promise<PlatformBankingConfig> {
    this.platformBankingConfig = {
      ...this.platformBankingConfig,
      ...data,
      updated_at: new Date().toISOString()
    };
    return { ...this.platformBankingConfig };
  }

  async getTenantTrialStatus(tenantId: string): Promise<TenantTrialStatus> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const now = new Date();
    const trialEnds = new Date(tenant.trial_ends_at);
    const diffMs = trialEnds.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const effectiveGraceDays = tenant.individual_grace_period_days ?? this.platformGlobalConfig?.grace_period_days ?? 5;
    const gracePeriodMs = effectiveGraceDays * 86400000;

    let effectiveStatus = tenant.status;
    if (tenant.status === 'trial' && diffMs <= 0) {
      if (Math.abs(diffMs) <= gracePeriodMs) {
        effectiveStatus = 'grace_period';
      } else {
        effectiveStatus = 'locked';
      }
    }

    const isLocked = effectiveStatus === 'locked' || effectiveStatus === 'suspended' || effectiveStatus === 'archived' || (tenant.status === 'trial' && diffMs < -gracePeriodMs);

    const pendingReceipt = this.subscriptionReceipts.find(
      r => r.tenant_id === tenantId && r.status === 'PENDING'
    ) || null;

    let lockReason: string | null = null;
    if (isLocked) {
      if (tenant.status === 'archived') {
        lockReason = tenant.suspended_reason || 'This academy has been archived by the platform administrator.';
      } else if (tenant.status === 'suspended') {
        lockReason = tenant.suspended_reason || 'Account administratively suspended.';
      } else {
        lockReason = 'Your 30-day free trial has expired. To continue using the academy system, please transfer the subscription fee to the bank details below and send your receipt for immediate account activation.';
      }
    }

    return {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      status: effectiveStatus,
      trial_ends_at: tenant.trial_ends_at,
      subscription_renews_at: tenant.subscription_renews_at || null,
      days_remaining: daysRemaining,
      is_locked: isLocked,
      lock_reason: lockReason,
      banking_config: { ...this.platformBankingConfig },
      pending_receipt: pendingReceipt ? { ...pendingReceipt } : null
    };
  }

  async submitSubscriptionReceipt(tenantId: string, data: {
    amount: number;
    plan_duration_months: number;
    payment_method: string;
    reference_number?: string;
    notes?: string;
    uploaded_by_user_id?: string;
    uploaded_by_email?: string;
    receipt_image_url?: string;
  }): Promise<SubscriptionPaymentReceipt> {
    const tenant = this.tenants.get(tenantId);
    const receipt: SubscriptionPaymentReceipt = {
      id: `sub-rec-${Date.now()}`,
      tenant_id: tenantId,
      tenant_name: tenant?.name || 'Academy',
      uploaded_by_user_id: data.uploaded_by_user_id || null,
      uploaded_by_email: data.uploaded_by_email || 'admin@academy.edu.pk',
      amount: data.amount,
      plan_duration_months: data.plan_duration_months || 1,
      payment_method: data.payment_method || 'BANK_TRANSFER',
      reference_number: data.reference_number || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      receipt_image_url: data.receipt_image_url || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400',
      notes: data.notes || null,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.subscriptionReceipts.unshift(receipt);
    return receipt;
  }

  async getSubscriptionReceipts(tenantId?: string): Promise<SubscriptionPaymentReceipt[]> {
    if (tenantId) {
      return this.subscriptionReceipts.filter(r => r.tenant_id === tenantId);
    }
    return [...this.subscriptionReceipts];
  }

  async reviewSubscriptionReceipt(receiptId: string, status: SubscriptionReceiptStatus, reviewedByEmail: string): Promise<SubscriptionPaymentReceipt> {
    const receipt = this.subscriptionReceipts.find(r => r.id === receiptId);
    if (!receipt) {
      throw new Error(`Receipt not found: ${receiptId}`);
    }

    receipt.status = status;
    receipt.reviewed_by_email = reviewedByEmail;
    receipt.reviewed_at = new Date().toISOString();
    receipt.updated_at = new Date().toISOString();

    if (status === 'APPROVED') {
      await this.activateAcademy(receipt.tenant_id, receipt.plan_duration_months, reviewedByEmail);
    }

    return { ...receipt };
  }

  async activateAcademy(tenantId: string, durationMonths: number, _reviewedByEmail?: string): Promise<Tenant> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const currentExpiry = new Date(tenant.trial_ends_at).getTime() > Date.now()
      ? new Date(tenant.trial_ends_at)
      : new Date();

    const newExpiry = new Date(currentExpiry.getTime() + 86400000 * 30 * durationMonths);

    tenant.status = 'active';
    tenant.trial_ends_at = newExpiry.toISOString();
    tenant.subscription_renews_at = newExpiry.toISOString();
    tenant.updated_at = new Date().toISOString();

    this.tenants.set(tenant.id, tenant);
    return { ...tenant };
  }

  async getTeacherPortalOverview(tenantId: string, teacherId: string, date?: string): Promise<TeacherPortalOverview> {
    const today = date || new Date().toISOString().split('T')[0];
    const teacherUser = Array.from(this.users.values()).find(
      u => (u.id === teacherId || u.email.toLowerCase() === teacherId.toLowerCase()) && u.tenant_id === tenantId
    ) || Array.from(this.users.values()).find(u => u.role === 'teacher' && u.tenant_id === tenantId);

    const teacherName = teacherUser?.full_name || 'Sir Tariq Physics';
    const teacherUserId = teacherUser?.id || teacherId;

    // Timetable slots for this teacher today
    const teacherSchedule = this.timetableSlots.filter(
      s => s.tenant_id === tenantId && (s.teacher_id === teacherUserId || (s.teacher_name?.toLowerCase() || '').includes('tariq'))
    );

    // Batches assigned
    const assignedBatches = this.batches.filter(b => b.tenant_id === tenantId);

    // Attendance pending batches for today
    const markedBatchIds = new Set(
      this.studentAttendance
        .filter(a => a.tenant_id === tenantId && a.date === today)
        .map(a => a.batch_id)
    );
    const pendingAttendanceBatches = assignedBatches.filter(b => !markedBatchIds.has(b.id));

    // Exams with pending evaluations
    const pendingGradingExams = this.exams.filter(
      e => e.tenant_id === tenantId && e.status === 'PUBLISHED'
    );

    // Recent diary entries
    const recentDiary = this.homeworkAssignments
      .filter(h => h.tenant_id === tenantId)
      .slice(0, 5);

    // Geofence status
    const clockInRecord = this.staffAttendance.find(
      sa => sa.tenant_id === tenantId && (sa.staff_id === teacherUserId || (sa.staff_name?.toLowerCase() || '').includes('tariq')) && sa.date === today
    );

    return {
      teacher_id: teacherUserId,
      teacher_name: teacherName,
      today_date: today,
      today_schedule: teacherSchedule.length > 0 ? teacherSchedule : this.timetableSlots.filter(s => s.tenant_id === tenantId),
      assigned_batches: assignedBatches,
      pending_attendance_batches: pendingAttendanceBatches,
      pending_grading_exams: pendingGradingExams,
      recent_diary_entries: recentDiary,
      geofence_status: {
        is_clocked_in: !!clockInRecord && (clockInRecord.status === 'on_time' || clockInRecord.status === 'late'),
        clocked_in_at: clockInRecord?.clock_in_time || '08:24 AM',
        distance_meters: clockInRecord?.distance_meters || 18
      }
    };
  }

  async getStudentParentPortalOverview(tenantId: string, studentId?: string): Promise<StudentParentPortalOverview> {
    const student = studentId
      ? this.students.find(s => s.id === studentId && s.tenant_id === tenantId)
      : null;

    if (!student) {
      throw new Error(`Student not found in tenant: ${tenantId}`);
    }
    const linked = Array.from(this.users.values()).find(u => u.tenant_id === tenantId && (u.id === student.user_id || u.email === student.email));
    if (linked?.metadata?.portal_blocked) {
      throw new Error('Student portal access has been blocked by the academy.');
    }

    const batch = this.batches.find(b => b.id === student.batch_id && b.tenant_id === tenantId);
    const program = this.programs.find(p => p.id === (student.program_id || batch?.program_id) && p.tenant_id === tenantId);

    // Timetable Slots: Today's schedule for this batch
    const daysMap: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDayOfWeek = daysMap[new Date().getDay()];
    const todayDateStr = new Date().toISOString().split('T')[0];

    const batchSlots = this.timetableSlots
      .filter(s => s.tenant_id === tenantId && s.batch_id === student.batch_id && !s.is_cancelled);

    const todayOnlySlots = batchSlots
      .filter(s => s.day_of_week === currentDayOfWeek)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

    // Ground truth: If no lecture periods are scheduled for today (e.g. Sunday or off-day),
    // do NOT dump the entire weekly schedule into today's timeline.
    const effectiveSchedule = todayOnlySlots.map(slot => {
      const sub = (slot.substitutions || []).find(sub => sub.date === todayDateStr);
      if (sub) {
        return {
          ...slot,
          substitute_teacher_id: sub.substitute_teacher_id,
          substitute_teacher_name: sub.substitute_teacher_name || 'Assigned Substitute',
        };
      }
      return slot;
    });

    // Invoices and Balance (Excluding voided or cancelled)
    const studentInvoices = this.invoices.filter(
      i => i.tenant_id === tenantId && 
           (i.student_id === student.id || i.roll_number === student.roll_number) &&
           i.status !== 'voided' && (i.status as any) !== 'cancelled'
    );
    const unpaidBalance = studentInvoices.reduce((sum, inv) => {
      const bal = inv.balance_due ?? inv.balance_amount ?? 0;
      return sum + (typeof bal === 'number' && !isNaN(bal) ? bal : 0);
    }, 0);

    // Payments / Receipts (Excluding voided)
    const studentPayments = this.feePayments.filter(
      p => p.tenant_id === tenantId && 
           (p.student_id === student.id || (student.roll_number && p.roll_number === student.roll_number)) &&
           p.status !== 'voided'
    ).sort((a, b) => (b.payment_date || b.created_at || '').localeCompare(a.payment_date || a.created_at || ''));

    // Homework Assignments
    const homeworkDiary = this.homeworkAssignments
      .filter(h => h.tenant_id === tenantId && h.batch_id === student.batch_id)
      .sort((a, b) => (b.due_date || b.created_at || '').localeCompare(a.due_date || a.created_at || ''))
      .map(h => {
        const check = this.notebookChecks.find(c => c.tenant_id === tenantId && c.assignment_id === h.id && c.student_id === student.id);
        return {
          ...h,
          submission_status: check?.status || 'pending',
          teacher_name: h.teacher_name || 'Course Instructor',
          check_remarks: check?.remarks || null,
          checked_at: check?.checked_at || null,
        };
      });

    // Official Exam Report Cards for this student (Published & Graded exams)
    const studentReportCards: StudentOfficialReportCard[] = [];
    const evals = this.studentExamEvaluations.filter(
      e => e.tenant_id === tenantId && e.student_id === student.id
    );

    for (const ev of evals) {
      const exam = this.exams.find(ex => ex.id === ev.exam_id && ex.tenant_id === tenantId);
      const isPublished = exam && (
        exam.status === 'PUBLISHED' || 
        exam.status === 'GRADED' ||
        (exam as any).status === 'PUBLISHED_GRADED' || 
        (exam as any).status === 'COMPLETED' ||
        (exam as any).status === 'published' ||
        (exam as any).status === 'graded'
      );
      if (exam && isPublished) {
        // Calculate true relative merit rank within batch
        const batchEvals = this.studentExamEvaluations
          .filter(be => be.tenant_id === tenantId && be.exam_id === exam.id)
          .sort((a, b) => (b.total_obtained || 0) - (a.total_obtained || 0));
        const rankIndex = batchEvals.findIndex(be => be.student_id === student.id);
        const actualRank = rankIndex >= 0 ? rankIndex + 1 : 1;
        const totalStudentsInExam = batchEvals.length > 0 ? batchEvals.length : (batch?.current_enrollment || 1);

        studentReportCards.push({
          exam,
          evaluation: ev,
          student: {
            id: student.id,
            full_name: student.full_name,
            roll_number: student.roll_number,
            guardian_name: student.guardian_name,
            batch_name: batch?.name || 'Assigned Batch',
            class_name: program?.name || 'Class',
            program_name: program?.name || 'Class'
          },
          rank: actualRank,
          total_students: totalStudentsInExam
        });
      }
    }

    // Dynamic Attendance calculation (Real historical order)
    const studentAttendanceRecords = this.studentAttendance
      .filter(a => a.tenant_id === tenantId && a.student_id === student.id)
      .sort((a, b) => b.date.localeCompare(a.date));

    // Calculate monthly attendance without penalizing approved excused leaves
    const currentMonthPrefix = todayDateStr.substring(0, 7);
    const monthRecords = studentAttendanceRecords.filter(a => a.date.startsWith(currentMonthPrefix));
    const targetEvalRecords = monthRecords.length > 0 ? monthRecords : studentAttendanceRecords;
    const countableRecords = targetEvalRecords.filter(a => a.status !== 'excused');
    const presentCount = countableRecords.filter(a => a.status === 'present' || a.status === 'late' || (a.status as any) === 'half_day').length;
    const computedAttendancePct = countableRecords.length > 0
      ? Math.round((presentCount / countableRecords.length) * 1000) / 10
      : 100.0;

    // Recent Attendance (Ground truth: empty array if none marked yet)
    const recentAttendance = studentAttendanceRecords
      .slice(0, 15)
      .map(a => {
        const rawStatus = (a.status || '').toLowerCase();
        const status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' = 
          rawStatus === 'present' ? 'PRESENT' :
          rawStatus === 'excused' ? 'EXCUSED' :
          (rawStatus === 'late' || rawStatus === 'half_day') ? 'LATE' : 'ABSENT';
        return {
          date: a.date,
          status,
          remarks: a.remarks || null
        };
      });

    // Leave Applications submitted by this student
    const studentLeaves = this.leaveApplications
      .filter(l => l.tenant_id === tenantId && l.student_id === student.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    // Dynamic Banking config from live Academy Settings
    const tenantObj = this.tenants.get(tenantId);
    const tSettings = (tenantObj as any)?.settings || {};
    const tenantBanking = {
      bank_name: tSettings.bank_name || tSettings.payment_settings?.bank_name || '',
      account_title: tSettings.account_title || '',
      account_number: tSettings.account_number || '',
      iban: tSettings.iban || tSettings.payment_settings?.iban || '',
      branch_code: tSettings.branch_code || '',
      raast_id: tSettings.raast_id || tSettings.payment_settings?.raast_id || '',
      whatsapp_number: tSettings.whatsapp_number || tSettings.phone || (tenantObj as any)?.phone || '',
    };

    // Resolve enrolled subjects from direct student.subjects or compulsory core + elective stream
    let subjectIds: string[] = Array.isArray(student.subjects) && student.subjects.length > 0
      ? [...student.subjects]
      : [];

    if (subjectIds.length === 0) {
      const programId = student.program_id || batch?.program_id;
      const compGroup = this.subjectGroups.find(g => g.tenant_id === tenantId && g.program_id === programId && g.type === 'compulsory');
      if (compGroup) {
        subjectIds.push(...compGroup.subject_ids);
      }
      if (student.elective_group_id) {
        const elecGroup = this.subjectGroups.find(g => g.tenant_id === tenantId && g.id === student.elective_group_id);
        if (elecGroup) {
          subjectIds.push(...elecGroup.subject_ids);
        }
      }
    }

    const resolvedSubjects = Array.from(new Set(subjectIds)).map(sid => {
      const sub = this.subjects.find(s => s.id === sid && s.tenant_id === tenantId);
      return sub ? sub.name : sid;
    });

    return {
      student_profile: {
        id: student.id,
        full_name: student.full_name,
        roll_number: student.roll_number,
        admission_number: student.admission_number,
        program_name: program?.name || 'Academic Program',
        batch_name: batch?.name || 'Assigned Batch',
        shift: batch?.shift,
        start_time: batch?.start_time,
        end_time: batch?.end_time,
        guardian_name: student.guardian_name,
        guardian_phone: student.guardian_phone,
        guardian_id_card: student.guardian_id_card,
        guardian_relation: student.guardian_relation || 'Father / Guardian',
        monthly_attendance_pct: computedAttendancePct,
        photo_url: student.photo_url,
        subjects: resolvedSubjects,
        admission_date: student.admission_date,
      },
      today_schedule: effectiveSchedule,
      weekly_schedule: batchSlots,
      invoices: studentInvoices,
      unpaid_balance: unpaidBalance,
      recent_receipts: studentPayments,
      homework_diary: homeworkDiary,
      exam_report_cards: studentReportCards,
      recent_attendance: recentAttendance,
      leave_applications: studentLeaves,
      tenant_banking: tenantBanking,
    } as any;
  }

  async getSuperAdminOverview(): Promise<SuperAdminOverview> {
    const tenantsList = Array.from(this.tenants.values()).filter(t => !this.isPlatformTenant(t));
    const totalTenants = tenantsList.length;
    const now = Date.now();

    const activeTenants = tenantsList.filter(t => t.status === 'active').length;
    const trialTenants = tenantsList.filter(t => t.status === 'trial' && new Date(t.trial_ends_at).getTime() > now).length;
    const lockedTenants = tenantsList.filter(t => t.status === 'locked' || (t.status === 'trial' && new Date(t.trial_ends_at).getTime() <= now)).length;
    const suspendedTenants = tenantsList.filter(t => t.status === 'suspended').length;
    const archivedTenants = tenantsList.filter(t => t.status === 'archived').length;

    const mrr = activeTenants * (this.platformGlobalConfig?.monthly_subscription_fee || 15000);
    const arr = mrr * 12;

    const pendingReceiptsCount = this.subscriptionReceipts.filter(r => r.status === 'PENDING').length;

    const tenantSummaries: SuperAdminTenantSummary[] = tenantsList.map(t => {
      const studentCount = this.students.filter(s => s.tenant_id === t.id).length;
      const teacherCount = Array.from(this.users.values()).filter(u => u.tenant_id === t.id && u.role === 'teacher').length;
      const pendingReceipt = this.subscriptionReceipts.find(r => r.tenant_id === t.id && r.status === 'PENDING') || null;
      const aliases = this.tenantAliases.filter(a => a.tenant_id === t.id).map(a => a.alias_slug);

      const customFee = t.custom_monthly_fee ?? this.platformGlobalConfig?.monthly_subscription_fee ?? 15000;
      const individualGrace = t.individual_grace_period_days ?? this.platformGlobalConfig?.grace_period_days ?? 5;
      const anchorDay = t.billing_cycle_anchor_day || (new Date(t.trial_ends_at || t.created_at || '2026-09-01').getDate());

      const tenantReceipts = this.subscriptionReceipts.filter(r => r.tenant_id === t.id);
      const totalPaidAmount = tenantReceipts
        .filter(r => r.status === 'APPROVED')
        .reduce((sum, r) => sum + (r.amount || 0), 0);

      const isOverdue = t.status === 'locked' || (t.status === 'trial' && new Date(t.trial_ends_at).getTime() <= now);
      const pendingDues = isOverdue ? customFee : 0;

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        domain: t.domain || `${t.slug}.${process.env.BASE_DOMAIN || 'kampus.pk'}`,
        status: t.status,
        tier: t.tier,
        trial_ends_at: t.trial_ends_at,
        subscription_renews_at: t.subscription_renews_at || null,
        student_count: studentCount,
        teacher_count: teacherCount,
        pending_receipt: pendingReceipt,
        aliases,
        custom_monthly_fee: customFee,
        individual_grace_period_days: individualGrace,
        billing_cycle_anchor_day: anchorDay,
        total_paid_amount: totalPaidAmount,
        pending_dues_amount: pendingDues,
        created_at: t.created_at,
        payment_history: tenantReceipts
      };
    });

    return {
      total_tenants: totalTenants,
      active_tenants: activeTenants,
      trial_tenants: trialTenants,
      locked_tenants: lockedTenants,
      suspended_tenants: suspendedTenants,
      archived_tenants: archivedTenants,
      platform_mrr: mrr,
      platform_arr: arr,
      pending_receipts_count: pendingReceiptsCount,
      platform_config: { ...this.platformGlobalConfig },
      banking_config: { ...this.platformBankingConfig },
      tenants: tenantSummaries,
      recent_receipts: [...this.subscriptionReceipts],
      announcements: [...this.announcements]
    };
  }

  async getPlatformConfig(): Promise<PlatformGlobalConfig> {
    return { ...this.platformGlobalConfig };
  }

  async updatePlatformConfig(updates: Partial<PlatformGlobalConfig>): Promise<PlatformGlobalConfig> {
    this.platformGlobalConfig = {
      ...this.platformGlobalConfig,
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Keep platformBankingConfig synced
    this.platformBankingConfig = {
      ...this.platformBankingConfig,
      bank_name: this.platformGlobalConfig.bank_name,
      account_title: this.platformGlobalConfig.account_title,
      account_number: this.platformGlobalConfig.account_number,
      iban: this.platformGlobalConfig.iban,
      branch_code: this.platformGlobalConfig.branch_code,
      whatsapp_support: this.platformGlobalConfig.whatsapp_support,
      support_email: this.platformGlobalConfig.support_email,
      monthly_subscription_fee: this.platformGlobalConfig.monthly_subscription_fee,
      instructions: this.platformGlobalConfig.instructions || '',
      updated_at: this.platformGlobalConfig.updated_at
    };

    return { ...this.platformGlobalConfig };
  }

  async updateTenantSubdomain(tenantId: string, newSlug: string): Promise<{ tenant: Tenant; previous_slug: string; redirect_url: string }> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

    const clean = newSlug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    if (!clean || clean.length < 3 || clean.length > 32) {
      throw new Error('Subdomain must be between 3 and 32 lowercase alphanumeric characters or hyphens.');
    }

    const reserved = ['app', 'api', 'admin', 'superadmin', 'auth', 'billing', 'mail', 'support', 'cdn', 'www', 'kampus', 'portal', 'edu', 'main'];
    if (reserved.includes(clean)) {
      throw new Error(`Subdomain '${clean}' is a reserved platform keyword.`);
    }

    if (tenant.slug.toLowerCase() === clean) {
      return { tenant: { ...tenant }, previous_slug: tenant.slug, redirect_url: `https://${tenant.domain}` };
    }

    const isAvailable = await this.checkSlugAvailable(clean);
    if (!isAvailable) {
      throw new Error(`Subdomain '${clean}' is already registered by another academy or reserved as an alias.`);
    }

    const previousSlug = tenant.slug;
    const baseDomain = process.env.BASE_DOMAIN || 'kampus.pk';

    // Store old slug as an alias so existing bookmarks/links issue 301 redirect
    this.tenantAliases.push({
      id: crypto.randomUUID(),
      tenant_id: tenant.id,
      alias_slug: previousSlug,
      created_at: new Date().toISOString()
    });

    tenant.slug = clean;
    tenant.domain = `${clean}.${baseDomain}`;
    if (tenant.settings) {
      tenant.settings.subdomain = clean;
      tenant.settings.domain = `${clean}.${baseDomain}`;
    }
    tenant.updated_at = new Date().toISOString();
    this.tenants.set(tenant.id, tenant);
    this.persistQueued = true;
    await this.flushPersist();

    return {
      tenant: { ...tenant },
      previous_slug: previousSlug,
      redirect_url: `https://${tenant.domain}`
    };
  }

  async suspendTenant(tenantId: string, reason?: string): Promise<Tenant> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
    tenant.status = 'suspended';
    tenant.suspended_reason = reason || 'Administrative suspension';
    tenant.updated_at = new Date().toISOString();
    this.tenants.set(tenant.id, tenant);
    return { ...tenant };
  }

  async reinstateTenant(tenantId: string): Promise<Tenant> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
    tenant.status = 'active';
    tenant.suspended_reason = null;
    tenant.updated_at = new Date().toISOString();
    this.tenants.set(tenant.id, tenant);
    return { ...tenant };
  }

  computeRenewalDate(currentDateStr: string | null | undefined, durationMonths: number, anchorDay?: number): string {
    const now = new Date();
    const currentExpiry = currentDateStr && new Date(currentDateStr).getTime() > now.getTime()
      ? new Date(currentDateStr)
      : now;

    const day = anchorDay || currentExpiry.getDate();
    let targetYear = currentExpiry.getFullYear();
    let targetMonth = currentExpiry.getMonth() + durationMonths;

    while (targetMonth >= 12) {
      targetMonth -= 12;
      targetYear += 1;
    }
    while (targetMonth < 0) {
      targetMonth += 12;
      targetYear -= 1;
    }

    const maxDaysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const effectiveDay = Math.min(day, maxDaysInTargetMonth);

    const result = new Date(targetYear, targetMonth, effectiveDay, 23, 59, 59, 999);
    return result.toISOString();
  }

  async updateTenantBillingSettings(
    tenantId: string, 
    updates: { 
      custom_monthly_fee?: number; 
      individual_grace_period_days?: number; 
      billing_cycle_anchor_day?: number; 
    }
  ): Promise<Tenant> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

    if (updates.custom_monthly_fee !== undefined) {
      tenant.custom_monthly_fee = Number(updates.custom_monthly_fee);
    }
    if (updates.individual_grace_period_days !== undefined) {
      tenant.individual_grace_period_days = Number(updates.individual_grace_period_days);
    }
    if (updates.billing_cycle_anchor_day !== undefined) {
      tenant.billing_cycle_anchor_day = Number(updates.billing_cycle_anchor_day);
    }
    tenant.updated_at = new Date().toISOString();
    this.tenants.set(tenant.id, tenant);
    return { ...tenant };
  }

  async renewTenantSubscription(
    tenantId: string, 
    params: { 
      duration_months: number; 
      custom_amount?: number; 
      payment_method?: string; 
      reference_number?: string; 
      notes?: string; 
    },
    reviewedByEmail: string = 'kampuserp@gmail.com'
  ): Promise<{ tenant: Tenant; receipt: SubscriptionPaymentReceipt }> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

    const durationMonths = Math.max(1, params.duration_months || 1);
    const anchorDay = tenant.billing_cycle_anchor_day || new Date(tenant.trial_ends_at || tenant.created_at || Date.now()).getDate();
    const newExpiry = this.computeRenewalDate(tenant.subscription_renews_at || tenant.trial_ends_at, durationMonths, anchorDay);

    tenant.status = 'active';
    tenant.trial_ends_at = newExpiry;
    tenant.subscription_renews_at = newExpiry;
    tenant.suspended_reason = null;
    tenant.updated_at = new Date().toISOString();
    this.tenants.set(tenant.id, tenant);

    const monthlyRate = tenant.custom_monthly_fee ?? this.platformGlobalConfig?.monthly_subscription_fee ?? 15000;
    const amount = params.custom_amount !== undefined ? Number(params.custom_amount) : (monthlyRate * durationMonths);

    const receipt: SubscriptionPaymentReceipt = {
      id: `sub-rec-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      uploaded_by_user_id: null,
      uploaded_by_email: reviewedByEmail,
      amount,
      plan_duration_months: durationMonths,
      payment_method: params.payment_method || 'BANK_TRANSFER',
      reference_number: params.reference_number || `REC-${Date.now().toString().slice(-6)}`,
      receipt_image_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400',
      notes: params.notes || `Subscription renewed for ${durationMonths} month(s) up to ${new Date(newExpiry).toLocaleDateString()}`,
      status: 'APPROVED',
      reviewed_by_email: reviewedByEmail,
      reviewed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.subscriptionReceipts.unshift(receipt);
    return { tenant: { ...tenant }, receipt };
  }

  async archiveTenant(tenantId: string, reason?: string): Promise<Tenant> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

    tenant.status = 'archived';
    tenant.suspended_reason = reason || 'Archived by platform administrator';
    tenant.updated_at = new Date().toISOString();
    this.tenants.set(tenant.id, tenant);
    return { ...tenant };
  }

  async hardDeleteTenant(tenantId: string): Promise<{ success: boolean; deleted_tenant_id: string; freed_slug: string }> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
    const freedSlug = tenant.slug;

    // Purge users & passwords
    const usersToDelete: string[] = [];
    for (const [uid, u] of this.users.entries()) {
      if (u.tenant_id === tenantId) {
        usersToDelete.push(uid);
      }
    }
    for (const uid of usersToDelete) {
      this.users.delete(uid);
    }

    // Purge all academic, attendance, fee, exam, whatsapp entities
    if (this.students) this.students = this.students.filter(s => s.tenant_id !== tenantId);
    if (this.batches) this.batches = this.batches.filter(b => b.tenant_id !== tenantId);
    if (this.programs) this.programs = this.programs.filter(p => p.tenant_id !== tenantId);
    if (this.inquiries) this.inquiries = this.inquiries.filter(i => i.tenant_id !== tenantId);
    if (this.subjects) this.subjects = this.subjects.filter(s => s.tenant_id !== tenantId);
    if (this.subjectGroups) this.subjectGroups = this.subjectGroups.filter(s => s.tenant_id !== tenantId);
    if (this.customFields) this.customFields = this.customFields.filter(c => c.tenant_id !== tenantId);

    if (this.timetableSlots) this.timetableSlots = this.timetableSlots.filter(s => s.tenant_id !== tenantId);
    if (this.rooms) this.rooms = this.rooms.filter(r => r.tenant_id !== tenantId);
    if (this.studentAttendance) this.studentAttendance = this.studentAttendance.filter(a => a.tenant_id !== tenantId);
    if (this.leaveApplications) this.leaveApplications = this.leaveApplications.filter(l => l.tenant_id !== tenantId);
    if (this.staffLeaves) this.staffLeaves = this.staffLeaves.filter(l => l.tenant_id !== tenantId);
    if (this.staffAttendance) this.staffAttendance = this.staffAttendance.filter(a => a.tenant_id !== tenantId);
    if (this.staffAttendanceAuditLogs) this.staffAttendanceAuditLogs = this.staffAttendanceAuditLogs.filter(a => a.tenant_id !== tenantId);
    if (this.staffRegularizationRequests) this.staffRegularizationRequests = this.staffRegularizationRequests.filter(r => r.tenant_id !== tenantId);
    if (this.homeworkAssignments) this.homeworkAssignments = this.homeworkAssignments.filter(h => h.tenant_id !== tenantId);
    if (this.notebookChecks) this.notebookChecks = this.notebookChecks.filter(n => n.tenant_id !== tenantId);
    if (this.complaints) this.complaints = this.complaints.filter(c => c.tenant_id !== tenantId);

    if (this.feeHeads) this.feeHeads = this.feeHeads.filter(f => f.tenant_id !== tenantId);
    if (this.feeStructures) this.feeStructures = this.feeStructures.filter(f => f.tenant_id !== tenantId);
    if (this.invoices) this.invoices = this.invoices.filter(f => f.tenant_id !== tenantId);
    if (this.feePayments) this.feePayments = this.feePayments.filter(p => p.tenant_id !== tenantId);
    if (this.feeDiscounts) this.feeDiscounts = this.feeDiscounts.filter(d => d.tenant_id !== tenantId);
    if (this.accountHeads) this.accountHeads = this.accountHeads.filter(a => a.tenant_id !== tenantId);
    if (this.financialTransactions) this.financialTransactions = this.financialTransactions.filter(t => t.tenant_id !== tenantId);
    if (this.staffSalaryProfiles) this.staffSalaryProfiles = this.staffSalaryProfiles.filter(p => p.tenant_id !== tenantId);
    if (this.staffPayslips) this.staffPayslips = this.staffPayslips.filter(p => p.tenant_id !== tenantId);

    if (this.questionChapters) this.questionChapters = this.questionChapters.filter(c => c.tenant_id !== tenantId);
    if (this.bankQuestions) this.bankQuestions = this.bankQuestions.filter(q => q.tenant_id !== tenantId);
    if (this.exams) this.exams = this.exams.filter(e => e.tenant_id !== tenantId);
    if (this.examQuestions) this.examQuestions = this.examQuestions.filter(q => q.tenant_id !== tenantId);
    if (this.studentExamEvaluations) this.studentExamEvaluations = this.studentExamEvaluations.filter(e => e.tenant_id !== tenantId);

    if (this.whatsappTemplates) this.whatsappTemplates = this.whatsappTemplates.filter(t => t.tenant_id !== tenantId);
    if (this.whatsappAuditLogs) this.whatsappAuditLogs = this.whatsappAuditLogs.filter(l => l.tenant_id !== tenantId);
    if (this.absenteeFollowups) this.absenteeFollowups = this.absenteeFollowups.filter(f => f.tenant_id !== tenantId);
    if (this.retentionCases) this.retentionCases = this.retentionCases.filter(r => r.tenant_id !== tenantId);

    // Purge SaaS receipts and announcement read receipts
    if (this.subscriptionReceipts) this.subscriptionReceipts = this.subscriptionReceipts.filter(r => r.tenant_id !== tenantId);
    if (this.announcementReceipts) this.announcementReceipts = this.announcementReceipts.filter(r => r.tenant_id !== tenantId);

    // Release Subdomain & Aliases so slug is immediately available again
    if (this.tenantAliases) {
      this.tenantAliases = this.tenantAliases.filter(
        a => a.tenant_id !== tenantId && a.alias_slug !== freedSlug
      );
    }
    if (this.geofenceConfigs) this.geofenceConfigs.delete(tenantId);
    if (this.feePriorityConfigs) this.feePriorityConfigs.delete(tenantId);

    // Remove tenant record
    this.tenants.delete(tenantId);

    return {
      success: true,
      deleted_tenant_id: tenantId,
      freed_slug: freedSlug
    };
  }

  async createAnnouncement(params: Omit<PlatformAnnouncement, 'id' | 'created_at'>): Promise<PlatformAnnouncement> {
    const announcement: PlatformAnnouncement = {
      id: `ann-${crypto.randomUUID()}`,
      ...params,
      created_at: new Date().toISOString()
    };
    this.announcements.unshift(announcement);
    this.persistQueued = true;
    void this.flushPersist();
    return { ...announcement };
  }

  async getAnnouncements(onlyActive = false): Promise<PlatformAnnouncement[]> {
    if (onlyActive) {
      return this.announcements.filter(a => a.is_active);
    }
    return [...this.announcements];
  }

  async updateAnnouncement(id: string, updates: Partial<PlatformAnnouncement>): Promise<PlatformAnnouncement> {
    const ann = this.announcements.find(a => a.id === id);
    if (!ann) throw new Error(`Announcement not found: ${id}`);

    if (updates.title !== undefined) ann.title = updates.title;
    if (updates.message !== undefined) ann.message = updates.message;
    if (updates.type !== undefined) ann.type = updates.type;
    if (updates.frequency !== undefined) ann.frequency = updates.frequency;
    if (updates.target_audience !== undefined) ann.target_audience = updates.target_audience;
    if (updates.target_tenant_id !== undefined) ann.target_tenant_id = updates.target_tenant_id;
    if (updates.action_label !== undefined) ann.action_label = updates.action_label;
    if (updates.action_url !== undefined) ann.action_url = updates.action_url;
    if (updates.is_active !== undefined) ann.is_active = updates.is_active;
    ann.updated_at = new Date().toISOString();
    this.persistQueued = true;
    void this.flushPersist();
    return { ...ann };
  }

  async deleteAnnouncement(id: string): Promise<boolean> {
    const index = this.announcements.findIndex(a => a.id === id);
    if (index === -1) throw new Error(`Announcement not found: ${id}`);

    this.announcements.splice(index, 1);
    this.announcementReceipts = this.announcementReceipts.filter(r => r.announcement_id !== id);
    this.persistQueued = true;
    await this.flushPersist();
    return true;
  }

  async toggleAnnouncement(id: string, isActive: boolean): Promise<PlatformAnnouncement> {
    const ann = this.announcements.find(a => a.id === id);
    if (!ann) throw new Error(`Announcement not found: ${id}`);
    ann.is_active = isActive;
    ann.updated_at = new Date().toISOString();
    this.persistQueued = true;
    void this.flushPersist();
    return { ...ann };
  }

  async getActivePopupForTenant(tenantId: string, userId: string, role?: string): Promise<PlatformAnnouncement | null> {
    if (role === 'super_admin') return null;
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return null;

    const activeList = this.announcements.filter(a => a.is_active);
    for (const ann of activeList) {
      if (ann.target_audience === 'specific_academy' && ann.target_tenant_id !== tenantId) {
        continue;
      }
      if (ann.target_audience === 'admin_only' && role && role !== 'tenant_admin') {
        continue;
      }
      if (ann.target_audience === 'trial_expiring') {
        const daysLeft = Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / 86400000);
        if (daysLeft > 5 || daysLeft < 0) continue;
      }
      if (ann.target_audience === 'grace_period') {
        if (tenant.status !== 'grace_period') continue;
      }

      if (ann.frequency === 'once_dismissible') {
        const hasDismissed = this.announcementReceipts.some(
          r => r.announcement_id === ann.id && (r.user_id === userId || r.tenant_id === tenantId)
        );
        if (hasDismissed) continue;
      }

      return { ...ann };
    }
    return null;
  }

  async dismissAnnouncement(announcementId: string, userId: string, tenantId: string): Promise<boolean> {
    const exists = this.announcementReceipts.some(
      r => r.announcement_id === announcementId && (r.user_id === userId || r.tenant_id === tenantId)
    );
    if (!exists) {
      this.announcementReceipts.push({
        id: crypto.randomUUID(),
        announcement_id: announcementId,
        user_id: userId,
        tenant_id: tenantId,
        read_at: new Date().toISOString()
      });
    }
    this.persistQueued = true;
    await this.flushPersist();
    return true;
  }

  async listDataBackups(): Promise<DataBackupMeta[]> {
    return listDataBackups();
  }

  async createManualDataBackup(): Promise<DataBackupMeta> {
    this.persistAllowed = true;
    this.persistQueued = true;
    await this.flushPersist();
    return createManualBackup(this.snapshotState());
  }

  async restoreDataBackup(id: number): Promise<{ academy_count: number }> {
    const payload = await loadBackupPayload(id);
    if (!payload || !Array.isArray(payload.tenants)) {
      throw new Error('Backup not found or empty');
    }
    this.applySnapshot(payload);
    this.persistAllowed = true;
    this.persistQueued = true;
    await this.flushPersist();
    return { academy_count: countRealAcademies(payload) };
  }

  async exportDataBackupFile() {
    const payload = this.snapshotState();
    return {
      kind: 'kampus-academy-backup',
      version: 1,
      exported_at: new Date().toISOString(),
      academy_count: countRealAcademies(payload),
      payload,
    };
  }

  async importDataBackupFile(file: { kind?: string; payload?: Record<string, unknown> }) {
    if (file.kind && file.kind !== 'kampus-academy-backup') {
      throw new Error('This file is not a Kampus academy backup');
    }
    const payload = file.payload;
    if (!payload || !Array.isArray(payload.tenants)) {
      throw new Error('Backup file has no academy data');
    }
    this.applySnapshot(payload);
    this.persistAllowed = true;
    this.persistQueued = true;
    await this.flushPersist();
    return { academy_count: countRealAcademies(payload) };
  }
}

