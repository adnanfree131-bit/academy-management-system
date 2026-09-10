import { 
  Tenant, 
  TenantStatus,
  TenantSettings,
  User, 
  AcademicProgram, 
  Subject, 
  SubjectGroup, 
  Batch, 
  CustomFieldDefinition, 
  StudentInquiry, 
  Student, 
  InquiryStage,
  Room,
  TimetableSlot,
  TimetableCollisionResult,
  DayOfWeek,
  StudentAttendanceRecord,
  AttendanceStatus,
  LeaveApplication,
  LeaveStatus,
  CampusGeofenceConfig,
  StaffAttendanceRecord,
  StaffAttendanceStatus,
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
  SuperAdminTenantSummary
} from '@apex/shared-types';

import { hashPassword, verifyPassword } from './password.js';
import { countRealAcademies, loadSnapshot, persistenceEnabled, saveSnapshot } from './store-persist.js';

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

export interface IDataStore {
  // Tenancy & Auth
  getTenantBySlug(slug: string): Promise<Tenant | null>;
  getTenantById(id: string): Promise<Tenant | null>;
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

  // Academic Hierarchy (Phase 2)
  getPrograms(tenantId: string): Promise<AcademicProgram[]>;
  createProgram(data: Omit<AcademicProgram, 'id' | 'created_at' | 'updated_at'>): Promise<AcademicProgram>;
  deleteProgram(tenantId: string, id: string): Promise<boolean>;
  
  getSubjects(tenantId: string): Promise<Subject[]>;
  createSubject(data: Omit<Subject, 'id' | 'created_at'>): Promise<Subject>;
  deleteSubject(tenantId: string, id: string): Promise<boolean>;

  getSubjectGroups(tenantId: string, programId?: string): Promise<SubjectGroup[]>;
  createSubjectGroup(data: Omit<SubjectGroup, 'id' | 'created_at'>): Promise<SubjectGroup>;
  deleteSubjectGroup(tenantId: string, id: string): Promise<boolean>;

  getBatches(tenantId: string, programId?: string): Promise<Batch[]>;
  createBatch(data: Omit<Batch, 'id' | 'created_at' | 'updated_at' | 'current_enrollment'>): Promise<Batch>;
  deleteBatch(tenantId: string, id: string): Promise<boolean>;

  // Custom Fields (Phase 2)
  getCustomFields(tenantId: string, entityType: 'student' | 'inquiry'): Promise<CustomFieldDefinition[]>;
  createCustomField(data: Omit<CustomFieldDefinition, 'id' | 'created_at'>): Promise<CustomFieldDefinition>;

  // Inquiries Desk (Phase 2)
  getInquiries(tenantId: string): Promise<StudentInquiry[]>;
  createInquiry(data: Omit<StudentInquiry, 'id' | 'inquiry_number' | 'created_at' | 'updated_at'>): Promise<StudentInquiry>;
  updateInquiryStage(tenantId: string, id: string, stage: InquiryStage): Promise<StudentInquiry | null>;

  // Student SIS (Phase 2)
  getStudents(tenantId: string, batchId?: string): Promise<Student[]>;
  createStudent(data: Omit<Student, 'id' | 'admission_number' | 'roll_number' | 'admission_date' | 'created_at' | 'updated_at'>): Promise<Student>;
  updateStudent(tenantId: string, id: string, data: Partial<Student>): Promise<Student | null>;
  admitInquiry(tenantId: string, inquiryId: string, batchId: string, electiveGroupId?: string, customSubjectIds?: string[]): Promise<Student>;

  // --- Phase 3: Timetable & Collision Engine ---
  getRooms(tenantId: string): Promise<Room[]>;
  createRoom(data: Omit<Room, 'id' | 'created_at' | 'updated_at'>): Promise<Room>;
  getTimetable(tenantId: string, batchId?: string, day?: DayOfWeek): Promise<TimetableSlot[]>;
  checkCollision(tenantId: string, slot: {
    batchId: string;
    teacherId: string;
    roomId?: string | null;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    excludeSlotId?: string;
  }): Promise<TimetableCollisionResult>;
  createTimetableSlot(data: Omit<TimetableSlot, 'id' | 'created_at' | 'updated_at'>): Promise<TimetableSlot>;
  assignSubstitute(tenantId: string, slotId: string, substituteTeacherId: string): Promise<TimetableSlot>;
  getAvailableTeachers(tenantId: string, dayOfWeek: DayOfWeek, startTime: string, endTime: string): Promise<User[]>;

  // --- Phase 3: Student Attendance & Leaves ---
  getStudentAttendance(tenantId: string, batchId: string, date: string): Promise<StudentAttendanceRecord[]>;
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

  // --- Phase 3: Campus Geofence & Staff Attendance ---
  getGeofenceConfig(tenantId: string): Promise<CampusGeofenceConfig>;
  updateGeofenceConfig(tenantId: string, config: Partial<CampusGeofenceConfig>): Promise<CampusGeofenceConfig>;
  staffClockIn(tenantId: string, staffId: string, staffName: string, lat: number, lng: number): Promise<StaffAttendanceRecord>;
  getStaffAttendance(tenantId: string, date?: string): Promise<StaffAttendanceRecord[]>;
  adjustStaffAttendance(tenantId: string, id: string, status: StaffAttendanceStatus, notes: string): Promise<StaffAttendanceRecord>;

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
  getFeePriorityConfig(tenantId: string): Promise<FeePriorityConfig>;
  updateFeePriorityConfig(tenantId: string, priorityOrder: string[]): Promise<FeePriorityConfig>;

  // --- Phase 4: Fee Structures & Invoicing ---
  getFeeStructures(tenantId: string, batchId?: string, studentId?: string): Promise<StudentFeeStructure[]>;
  saveFeeStructure(data: Omit<StudentFeeStructure, 'id' | 'created_at' | 'updated_at'>): Promise<StudentFeeStructure>;
  getInvoices(tenantId: string, options?: { studentId?: string; batchId?: string; billingMonth?: string; status?: InvoiceStatus }): Promise<StudentInvoice[]>;
  getInvoiceById(tenantId: string, id: string): Promise<StudentInvoice | null>;
  generateInvoice(tenantId: string, data: {
    student_id: string;
    billing_month: string;
    due_date: string;
    custom_items?: Array<{ fee_head_id: string; amount: number }>;
    notes?: string;
  }): Promise<StudentInvoice>;
  generateBatchInvoices(tenantId: string, batchId: string, billingMonth: string, dueDate: string): Promise<StudentInvoice[]>;

  // --- Phase 4: Payment Distribution & Cashier Review ---
  previewPaymentDistribution(tenantId: string, invoiceId: string, amount: number): Promise<PaymentDistributionItem[]>;
  recordPayment(tenantId: string, data: {
    invoice_id: string;
    amount_paid: number;
    payment_method: PaymentMethod;
    reference_number?: string;
    is_override?: boolean;
    override_reason?: string;
    allocations?: PaymentDistributionItem[];
    collected_by: string;
  }): Promise<{ payment: FeePayment; invoice: StudentInvoice }>;

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
  getDailyCashbook(tenantId: string, date?: string): Promise<DailyCashbookEntry[]>;
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
  private leaveApplications: LeaveApplication[] = [];
  private geofenceConfigs: Map<string, CampusGeofenceConfig> = new Map();
  private staffAttendance: StaffAttendanceRecord[] = [];
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

    if (process.env.NODE_ENV === 'test') {
      this.seedDemoAcademy();
      this.seedTestData();
    } else {
      this.seedPlatformOperator();
    }

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
      leaveApplications: this.leaveApplications,
      geofenceConfigs: [...this.geofenceConfigs.entries()],
      staffAttendance: this.staffAttendance,
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

    if (payload.tenants) this.tenants = new Map(asEntries(payload.tenants));
    if (payload.users) this.users = new Map(asEntries(payload.users));
    if (payload.otps) this.otps = asArray(payload.otps);
    if (payload.programs) this.programs = asArray(payload.programs);
    if (payload.subjects) this.subjects = asArray(payload.subjects);
    if (payload.subjectGroups) this.subjectGroups = asArray(payload.subjectGroups);
    if (payload.batches) this.batches = asArray(payload.batches);
    if (payload.customFields) this.customFields = asArray(payload.customFields);
    if (payload.inquiries) this.inquiries = asArray(payload.inquiries);
    if (payload.students) this.students = asArray(payload.students);
    if (payload.rooms) this.rooms = asArray(payload.rooms);
    if (payload.timetableSlots) this.timetableSlots = asArray(payload.timetableSlots);
    if (payload.studentAttendance) this.studentAttendance = asArray(payload.studentAttendance);
    if (payload.leaveApplications) this.leaveApplications = asArray(payload.leaveApplications);
    if (payload.geofenceConfigs) this.geofenceConfigs = new Map(asEntries(payload.geofenceConfigs));
    if (payload.staffAttendance) this.staffAttendance = asArray(payload.staffAttendance);
    if (payload.homeworkAssignments) this.homeworkAssignments = asArray(payload.homeworkAssignments);
    if (payload.notebookChecks) this.notebookChecks = asArray(payload.notebookChecks);
    if (payload.complaints) this.complaints = asArray(payload.complaints);
    if (payload.feeHeads) this.feeHeads = asArray(payload.feeHeads);
    if (payload.feePriorityConfigs) this.feePriorityConfigs = new Map(asEntries(payload.feePriorityConfigs));
    if (payload.feeStructures) this.feeStructures = asArray(payload.feeStructures);
    if (payload.invoices) this.invoices = asArray(payload.invoices);
    if (payload.feePayments) this.feePayments = asArray(payload.feePayments);
    if (payload.feeDiscounts) this.feeDiscounts = asArray(payload.feeDiscounts);
    if (payload.accountHeads) this.accountHeads = asArray(payload.accountHeads);
    if (payload.financialTransactions) this.financialTransactions = asArray(payload.financialTransactions);
    if (payload.staffSalaryProfiles) this.staffSalaryProfiles = asArray(payload.staffSalaryProfiles);
    if (payload.staffPayslips) this.staffPayslips = asArray(payload.staffPayslips);
    if (payload.questionChapters) this.questionChapters = asArray(payload.questionChapters);
    if (payload.bankQuestions) this.bankQuestions = asArray(payload.bankQuestions);
    if (payload.exams) this.exams = asArray(payload.exams);
    if (payload.examQuestions) this.examQuestions = asArray(payload.examQuestions);
    if (payload.studentExamEvaluations) this.studentExamEvaluations = asArray(payload.studentExamEvaluations);
    if (payload.whatsappTemplates) this.whatsappTemplates = asArray(payload.whatsappTemplates);
    if (payload.whatsappAuditLogs) this.whatsappAuditLogs = asArray(payload.whatsappAuditLogs);
    if (payload.absenteeFollowups) this.absenteeFollowups = asArray(payload.absenteeFollowups);
    if (payload.retentionCases) this.retentionCases = asArray(payload.retentionCases);
    if (payload.platformBankingConfig) this.platformBankingConfig = payload.platformBankingConfig as PlatformBankingConfig;
    if (payload.platformGlobalConfig) this.platformGlobalConfig = payload.platformGlobalConfig as PlatformGlobalConfig;
    if (payload.subscriptionReceipts) this.subscriptionReceipts = asArray(payload.subscriptionReceipts);
    if (payload.tenantAliases) this.tenantAliases = asArray(payload.tenantAliases);
    if (payload.announcements) this.announcements = asArray(payload.announcements);
    if (payload.announcementReceipts) this.announcementReceipts = asArray(payload.announcementReceipts);
  }

  async hydrateFromDatabase(): Promise<void> {
    if (!persistenceEnabled()) return;
    try {
      const payload = await Promise.race([
        loadSnapshot(),
        new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('hydrate timed out')), 8000);
        }),
      ]);
      if (payload && Array.isArray(payload.tenants) && payload.tenants.length > 0) {
        this.applySnapshot(payload);
        this.persistAllowed = true;
        console.log(`[Store] Restored snapshot with ${this.tenants.size} academies`);
        return;
      }
      const existingCount = countRealAcademies(payload);
      if (existingCount > 0) {
        this.persistAllowed = false;
        console.error('[Store] Snapshot present with academies but failed to apply; refusing to persist seed');
        return;
      }
      this.persistAllowed = true;
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
          setTimeout(() => reject(new Error('persist timed out')), 8000);
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
      { id: 'fh-1', tenant_id: primaryTenant.id, name: 'Monthly Tuition Fee', code: 'TUITION', is_system_default: true, default_amount: 5000, priority_order: 1, created_at: new Date().toISOString() },
      { id: 'fh-2', tenant_id: primaryTenant.id, name: 'Admission Fee', code: 'ADMISSION', is_system_default: true, default_amount: 10000, priority_order: 2, created_at: new Date().toISOString() },
      { id: 'fh-3', tenant_id: primaryTenant.id, name: 'Examination Fee', code: 'EXAM', is_system_default: true, default_amount: 2500, priority_order: 3, created_at: new Date().toISOString() },
      { id: 'fh-4', tenant_id: primaryTenant.id, name: 'Laboratory Charges', code: 'LAB', is_system_default: false, default_amount: 1500, priority_order: 4, created_at: new Date().toISOString() },
      { id: 'fh-5', tenant_id: primaryTenant.id, name: 'Library & Activities Fee', code: 'LIBRARY', is_system_default: false, default_amount: 1000, priority_order: 5, created_at: new Date().toISOString() },
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
    this.programs.push(mdcatProg, fscProg, crescentProg);

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
      shift: 'morning',
      academic_session: '2026-2027',
      max_capacity: 50,
      current_enrollment: 1,
      room_number: 'Hall 1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const batchB: Batch = {
      id: 'a3000000-0000-0000-0000-000000000002',
      tenant_id: tenantAId,
      program_id: fscProg.id,
      name: 'FSc Morning - Alpha',
      shift: 'morning',
      academic_session: '2026-2027',
      max_capacity: 40,
      current_enrollment: 0,
      room_number: 'Room 204',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const crescentBatch: Batch = {
      id: 'b3000000-0000-0000-0000-000000000001',
      tenant_id: tenantB.id,
      program_id: crescentProg.id,
      name: 'O-Levels Morning Section 1',
      shift: 'morning',
      academic_session: '2026-2027',
      max_capacity: 30,
      current_enrollment: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.batches.push(batchA, batchB, crescentBatch);

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
      admission_number: 'ADM-2026-001',
      roll_number: 'A-101',
      full_name: 'Muhammad Ali Raza',
      email: 'ali.raza@gmail.com',
      phone: '+923001122334',
      guardian_name: 'Raza Ahmed',
      guardian_phone: '+923009876543',
      guardian_whatsapp: '+923009876543',
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

    const headArrears: FeeHead = { id: 'head-arrears', tenant_id: tenantAId, name: 'Previous Arrears', code: 'ARREARS', is_system_default: true, default_amount: 0, priority_order: 1, created_at: new Date().toISOString() };
    const headTuition: FeeHead = { id: 'head-tuition', tenant_id: tenantAId, name: 'Monthly Tuition Fee', code: 'TUITION', is_system_default: true, default_amount: 8000, priority_order: 2, created_at: new Date().toISOString() };
    const headAnnual: FeeHead = { id: 'head-annual', tenant_id: tenantAId, name: 'Annual Development Charges', code: 'ANNUAL', is_system_default: true, default_amount: 5000, priority_order: 3, created_at: new Date().toISOString() };
    const headExam: FeeHead = { id: 'head-exam', tenant_id: tenantAId, name: 'Examination & Assessment Fee', code: 'EXAM', is_system_default: true, default_amount: 2500, priority_order: 4, created_at: new Date().toISOString() };
    const headLab: FeeHead = { id: 'head-lab', tenant_id: tenantAId, name: 'Science & Computer Lab Fee', code: 'LAB', is_system_default: true, default_amount: 1500, priority_order: 5, created_at: new Date().toISOString() };
    const headAdmission: FeeHead = { id: 'head-admission', tenant_id: tenantAId, name: 'One-Time Admission Fee', code: 'ADMISSION', is_system_default: true, default_amount: 10000, priority_order: 6, created_at: new Date().toISOString() };
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
        return { tenant, is_alias: false, primary_slug: tenant.slug };
      }
    }
    const alias = this.tenantAliases.find(a => a.alias_slug.toLowerCase() === clean);
    if (alias) {
      const tenant = this.tenants.get(alias.tenant_id);
      if (tenant) {
        return { tenant, is_alias: true, primary_slug: tenant.slug };
      }
    }
    return { tenant: null, is_alias: false, primary_slug: null };
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    return this.tenants.get(id) || null;
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

    // Seed initial operational fee heads for the newly registered academy
    const defaultFeeHeads: FeeHead[] = [
      { id: crypto.randomUUID(), tenant_id: newTenant.id, name: 'Monthly Tuition Fee', code: 'TUITION', is_system_default: true, default_amount: 5000, priority_order: 1, created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), tenant_id: newTenant.id, name: 'Admission Fee', code: 'ADMISSION', is_system_default: true, default_amount: 10000, priority_order: 2, created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), tenant_id: newTenant.id, name: 'Examination Fee', code: 'EXAM', is_system_default: true, default_amount: 2500, priority_order: 3, created_at: new Date().toISOString() },
    ];
    this.feeHeads.push(...defaultFeeHeads);

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
    this.tenants.set(tenantId, tenant);
    return tenant;
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
    return this.programs.filter(p => p.tenant_id === tenantId);
  }

  async createProgram(data: Omit<AcademicProgram, 'id' | 'created_at' | 'updated_at'>): Promise<AcademicProgram> {
    const program: AcademicProgram = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.programs.push(program);
    return program;
  }

  async deleteProgram(tenantId: string, id: string): Promise<boolean> {
    const initLen = this.programs.length;
    this.programs = this.programs.filter(p => !(p.tenant_id === tenantId && p.id === id));
    return this.programs.length < initLen;
  }

  async getSubjects(tenantId: string): Promise<Subject[]> {
    return this.subjects.filter(s => s.tenant_id === tenantId);
  }

  async createSubject(data: Omit<Subject, 'id' | 'created_at'>): Promise<Subject> {
    const subject: Subject = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.subjects.push(subject);
    return subject;
  }

  async deleteSubject(tenantId: string, id: string): Promise<boolean> {
    const initLen = this.subjects.length;
    this.subjects = this.subjects.filter(s => !(s.tenant_id === tenantId && s.id === id));
    return this.subjects.length < initLen;
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
    return group;
  }

  async deleteSubjectGroup(tenantId: string, id: string): Promise<boolean> {
    const initLen = this.subjectGroups.length;
    this.subjectGroups = this.subjectGroups.filter(g => !(g.tenant_id === tenantId && g.id === id));
    return this.subjectGroups.length < initLen;
  }

  async getBatches(tenantId: string, programId?: string): Promise<Batch[]> {
    return this.batches.filter(b => 
      b.tenant_id === tenantId && (!programId || b.program_id === programId)
    );
  }

  async createBatch(data: Omit<Batch, 'id' | 'created_at' | 'updated_at' | 'current_enrollment'>): Promise<Batch> {
    const batch: Batch = {
      ...data,
      id: crypto.randomUUID(),
      current_enrollment: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.batches.push(batch);
    return batch;
  }

  async deleteBatch(tenantId: string, id: string): Promise<boolean> {
    const initLen = this.batches.length;
    this.batches = this.batches.filter(b => !(b.tenant_id === tenantId && b.id === id));
    return this.batches.length < initLen;
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
    return inquiry;
  }

  async updateInquiryStage(tenantId: string, id: string, stage: InquiryStage): Promise<StudentInquiry | null> {
    const inq = this.inquiries.find(i => i.id === id && i.tenant_id === tenantId);
    if (!inq) return null;
    inq.stage = stage;
    inq.updated_at = new Date().toISOString();
    return inq;
  }

  // --- Student SIS Methods ---
  async getStudents(tenantId: string, batchId?: string): Promise<Student[]> {
    return this.students.filter(s => 
      s.tenant_id === tenantId && (!batchId || s.batch_id === batchId)
    );
  }

  async createStudent(data: Omit<Student, 'id' | 'admission_number' | 'roll_number' | 'admission_date' | 'created_at' | 'updated_at'>): Promise<Student> {
    const batchStudents = this.students.filter(s => s.tenant_id === data.tenant_id && s.batch_id === data.batch_id);
    const count = this.students.filter(s => s.tenant_id === data.tenant_id).length + 1;

    const batch = this.batches.find(b => b.id === data.batch_id);
    const isFull = Boolean(batch && batch.current_enrollment >= batch.max_capacity);
    const student: Student = {
      ...data,
      id: crypto.randomUUID(),
      admission_number: `ADM-2026-${count.toString().padStart(3, '0')}`,
      roll_number: `R-${(batchStudents.length + 101).toString()}`,
      admission_date: new Date().toISOString().split('T')[0],
      status: isFull ? 'waitlisted' : (data.status || 'active'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.students.push(student);

    if (batch && !isFull) batch.current_enrollment += 1;
    this.persistQueued = true;
    void this.flushPersist();

    // Auto-generate first month invoice if fee_structure is set
    if (student.fee_structure && (student.fee_structure.first_month_total > 0 || (data as any).generate_first_month_invoice)) {
      const invoiceId = crypto.randomUUID();
      const invoiceCount = this.invoices.filter(i => i.tenant_id === data.tenant_id).length + 1;
      const invoiceNumber = `INV-2026-${invoiceCount.toString().padStart(4, '0')}`;
      const now = new Date();
      const dueDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const billingMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

      const items: InvoiceItem[] = [];
      const tuitionHead = this.feeHeads.find(h => h.tenant_id === data.tenant_id && h.code === 'TUITION') || this.feeHeads[0];
      const admHead = this.feeHeads.find(h => h.tenant_id === data.tenant_id && h.code === 'ADMISSION') || tuitionHead;
      const examHead = this.feeHeads.find(h => h.tenant_id === data.tenant_id && h.code === 'EXAM') || tuitionHead;

      if (student.fee_structure.net_tuition > 0) {
        items.push({
          id: crypto.randomUUID(),
          invoice_id: invoiceId,
          fee_head_id: tuitionHead?.id || 'head-tuition',
          head_name: 'Monthly Tuition Fee',
          head_code: 'TUITION',
          original_amount: student.fee_structure.base_tuition || student.fee_structure.net_tuition,
          discount_amount: Math.max(0, (student.fee_structure.base_tuition || student.fee_structure.net_tuition) - student.fee_structure.net_tuition),
          net_amount: student.fee_structure.net_tuition,
          paid_amount: 0,
          balance_due: student.fee_structure.net_tuition,
        });
      }

      if (student.fee_structure.admission_fee > 0) {
        items.push({
          id: crypto.randomUUID(),
          invoice_id: invoiceId,
          fee_head_id: admHead?.id || 'head-admission',
          head_name: 'Admission Fee',
          head_code: 'ADMISSION',
          original_amount: student.fee_structure.admission_fee,
          discount_amount: 0,
          net_amount: student.fee_structure.admission_fee,
          paid_amount: 0,
          balance_due: student.fee_structure.admission_fee,
        });
      }

      if (student.fee_structure.exam_fee > 0) {
        items.push({
          id: crypto.randomUUID(),
          invoice_id: invoiceId,
          fee_head_id: examHead?.id || 'head-exam',
          head_name: 'Exam & Lab Charges',
          head_code: 'EXAM',
          original_amount: student.fee_structure.exam_fee,
          discount_amount: 0,
          net_amount: student.fee_structure.exam_fee,
          paid_amount: 0,
          balance_due: student.fee_structure.exam_fee,
        });
      }

      const totalAmount = items.reduce((acc, it) => acc + it.net_amount, 0);
      if (items.length > 0) {
        this.invoices.push({
          id: invoiceId,
          tenant_id: data.tenant_id,
          student_id: student.id,
          student_name: student.full_name,
          roll_number: student.roll_number,
          batch_id: student.batch_id,
          batch_name: batch?.name || 'Section',
          invoice_number: invoiceNumber,
          billing_month: billingMonth,
          due_date: dueDate,
          issue_date: new Date().toISOString().split('T')[0],
          subtotal_amount: items.reduce((acc, it) => acc + it.original_amount, 0),
          subtotal: items.reduce((acc, it) => acc + it.original_amount, 0),
          discount_amount: items.reduce((acc, it) => acc + it.discount_amount, 0),
          discount_total: items.reduce((acc, it) => acc + it.discount_amount, 0),
          fine_amount: 0,
          net_amount: totalAmount,
          net_total: totalAmount,
          paid_amount: 0,
          balance_amount: totalAmount,
          balance_due: totalAmount,
          status: 'UNPAID',
          items,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        student.first_invoice_id = invoiceId;
      }
    }

    return student;
  }

  async updateStudent(tenantId: string, id: string, data: Partial<Student>): Promise<Student | null> {
    const student = this.students.find(s => s.id === id && s.tenant_id === tenantId);
    if (!student) return null;

    Object.assign(student, {
      ...data,
      id: student.id,
      tenant_id: student.tenant_id,
      admission_number: student.admission_number,
      admission_date: student.admission_date,
      created_at: student.created_at,
      updated_at: new Date().toISOString(),
    });

    return student;
  }

  async admitInquiry(tenantId: string, inquiryId: string, batchId: string, electiveGroupId?: string, customSubjectIds?: string[]): Promise<Student> {
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

    return this.createStudent({
      tenant_id: tenantId,
      full_name: inq.student_name,
      phone: inq.phone,
      email: inq.email,
      guardian_name: inq.guardian_name || 'Guardian',
      guardian_phone: inq.guardian_phone || inq.phone,
      program_id: batch.program_id,
      batch_id: batch.id,
      elective_group_id: electiveGroupId,
      status: 'active',
      custom_field_values: {},
      subjects,
    });
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

  async getTimetable(tenantId: string, batchId?: string, day?: DayOfWeek): Promise<TimetableSlot[]> {
    return this.timetableSlots.filter(s => 
      s.tenant_id === tenantId &&
      (!batchId || s.batch_id === batchId) &&
      (!day || s.day_of_week === day) &&
      !s.is_cancelled
    );
  }

  async checkCollision(tenantId: string, slot: {
    batchId: string;
    teacherId: string;
    roomId?: string | null;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    excludeSlotId?: string;
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
      const assignedTeacherId = existing.substitute_teacher_id || existing.teacher_id;
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
    const batch = this.batches.find(b => b.id === data.batch_id);
    const subject = this.subjects.find(s => s.id === data.subject_id);
    const teacher = Array.from(this.users.values()).find(u => u.id === data.teacher_id);
    const room = data.room_id ? this.rooms.find(r => r.id === data.room_id) : undefined;

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
    return slot;
  }

  async assignSubstitute(tenantId: string, slotId: string, substituteTeacherId: string): Promise<TimetableSlot> {
    const slot = this.timetableSlots.find(s => s.id === slotId && s.tenant_id === tenantId);
    if (!slot) throw new Error('Timetable slot not found');

    const substitute = Array.from(this.users.values()).find(u => u.id === substituteTeacherId && u.tenant_id === tenantId);
    if (!substitute) throw new Error('Substitute teacher not found');

    // Check if substitute teacher is already engaged during this time
    const collision = await this.checkCollision(tenantId, {
      batchId: 'none', // skip batch collision
      teacherId: substituteTeacherId,
      dayOfWeek: slot.day_of_week,
      startTime: slot.start_time,
      endTime: slot.end_time,
      excludeSlotId: slotId,
    });

    if (collision.has_conflict && collision.conflict_type === 'teacher_conflict') {
      throw new Error(`Substitute conflict: Teacher ${substitute.full_name} is already teaching another class during this time.`);
    }

    slot.substitute_teacher_id = substituteTeacherId;
    slot.substitute_teacher_name = substitute.full_name;
    slot.updated_at = new Date().toISOString();
    return slot;
  }

  async getAvailableTeachers(tenantId: string, dayOfWeek: DayOfWeek, startTime: string, endTime: string): Promise<User[]> {
    const allTeachers = Array.from(this.users.values()).filter(u => u.tenant_id === tenantId && (u.role === 'teacher' || u.role === 'tenant_admin'));
    
    // Find teachers with conflicting slots
    const busyTeacherIds = new Set<string>();
    for (const slot of this.timetableSlots) {
      if (slot.tenant_id === tenantId && slot.day_of_week === dayOfWeek && !slot.is_cancelled) {
        const overlaps = startTime < slot.end_time && endTime > slot.start_time;
        if (overlaps) {
          busyTeacherIds.add(slot.substitute_teacher_id || slot.teacher_id);
        }
      }
    }

    return allTeachers.filter(t => !busyTeacherIds.has(t.id));
  }

  // --- Phase 3: Student Attendance & Leaves ---
  async getStudentAttendance(tenantId: string, batchId: string, date: string): Promise<StudentAttendanceRecord[]> {
    return this.studentAttendance.filter(a => 
      a.tenant_id === tenantId && a.batch_id === batchId && a.date === date
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
        this.studentAttendance[existingIdx] = record;
      } else {
        this.studentAttendance.push(record);
      }
      results.push(record);
    }

    return results;
  }

  async getLeaveApplications(tenantId: string, studentId?: string): Promise<LeaveApplication[]> {
    return this.leaveApplications.filter(l => 
      l.tenant_id === tenantId && (!studentId || l.student_id === studentId)
    );
  }

  async submitLeaveApplication(data: Omit<LeaveApplication, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<LeaveApplication> {
    const student = this.students.find(s => s.id === data.student_id && s.tenant_id === data.tenant_id);
    const batch = student?.batch_id ? this.batches.find(b => b.id === student.batch_id) : undefined;

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

    return leave;
  }

  // --- Phase 3: Campus Geofence & Staff Attendance ---
  async getGeofenceConfig(tenantId: string): Promise<CampusGeofenceConfig> {
    const config = this.geofenceConfigs.get(tenantId);
    if (config) return config;

    // Default configuration for tenant
    const defaultConfig: CampusGeofenceConfig = {
      tenant_id: tenantId,
      campus_name: 'Main Campus',
      latitude: 31.5204,
      longitude: 74.3587,
      radius_meters: 150,
      shift_start_time: '08:00:00',
      grace_period_minutes: 15,
      multi_room_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.geofenceConfigs.set(tenantId, defaultConfig);
    return defaultConfig;
  }

  async updateGeofenceConfig(tenantId: string, updates: Partial<CampusGeofenceConfig>): Promise<CampusGeofenceConfig> {
    const current = await this.getGeofenceConfig(tenantId);
    const updated: CampusGeofenceConfig = {
      ...current,
      ...updates,
      tenant_id: tenantId,
      updated_at: new Date().toISOString(),
    };
    this.geofenceConfigs.set(tenantId, updated);
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

    if (distanceMeters > config.radius_meters) {
      throw new Error(`Clock-in rejected: Outside campus boundary (${distanceMeters}m away, maximum allowed radius is ${config.radius_meters}m)`);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const dateStr = nowIso.split('T')[0];

    // Calculate on_time vs late
    const [startH, startM] = config.shift_start_time.split(':').map(Number);
    const cutoffMinutes = (startH || 8) * 60 + (startM || 0) + config.grace_period_minutes;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const status: StaffAttendanceStatus = currentMinutes > cutoffMinutes ? 'late' : 'on_time';

    const record: StaffAttendanceRecord = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      staff_id: staffId,
      staff_name: staffName,
      date: dateStr,
      clock_in_time: nowIso,
      clock_in_lat: lat,
      clock_in_lng: lng,
      distance_meters: distanceMeters,
      status,
      is_geofence_verified: true,
      created_at: nowIso,
      updated_at: nowIso,
    };

    this.staffAttendance.push(record);
    return record;
  }

  async getStaffAttendance(tenantId: string, date?: string): Promise<StaffAttendanceRecord[]> {
    return this.staffAttendance.filter(s => 
      s.tenant_id === tenantId && (!date || s.date === date)
    );
  }

  async adjustStaffAttendance(tenantId: string, id: string, status: StaffAttendanceStatus, notes: string): Promise<StaffAttendanceRecord> {
    const record = this.staffAttendance.find(s => s.id === id && s.tenant_id === tenantId);
    if (!record) throw new Error('Staff attendance record not found');

    record.status = status;
    record.admin_adjusted = true;
    record.admin_adjustment_notes = notes;
    record.updated_at = new Date().toISOString();
    return record;
  }

  // --- Phase 3: Homework Diary & Physical Notebook Checking ---
  async getHomework(tenantId: string, batchId?: string): Promise<HomeworkAssignment[]> {
    return this.homeworkAssignments.filter(h => 
      h.tenant_id === tenantId && (!batchId || h.batch_id === batchId)
    );
  }

  async createHomework(data: Omit<HomeworkAssignment, 'id' | 'created_at'>): Promise<HomeworkAssignment> {
    const batch = this.batches.find(b => b.id === data.batch_id);
    const subject = this.subjects.find(s => s.id === data.subject_id);

    const hw: HomeworkAssignment = {
      ...data,
      id: crypto.randomUUID(),
      batch_name: batch?.name || data.batch_name,
      subject_name: subject?.name || data.subject_name,
      created_at: new Date().toISOString(),
    };

    this.homeworkAssignments.push(hw);
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
      created_at: new Date().toISOString()
    };
    this.feeHeads.push(head);

    // Append to tenant priority config if existing
    const prio = this.feePriorityConfigs.get(data.tenant_id);
    if (prio) {
      prio.priority_order.push(head.id);
      prio.updated_at = new Date().toISOString();
    }
    return head;
  }

  async getFeePriorityConfig(tenantId: string): Promise<FeePriorityConfig> {
    let config = this.feePriorityConfigs.get(tenantId);
    if (!config) {
      const heads = await this.getFeeHeads(tenantId);
      config = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        priority_order: heads.map(h => h.id),
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
    return record;
  }

  // --- Invoicing & Challans ---
  async getInvoices(tenantId: string, options?: { studentId?: string; batchId?: string; billingMonth?: string; status?: InvoiceStatus }): Promise<StudentInvoice[]> {
    return this.invoices.filter(i => {
      if (i.tenant_id !== tenantId) return false;
      if (options?.studentId && i.student_id !== options.studentId) return false;
      if (options?.batchId && i.batch_id !== options.batchId) return false;
      if (options?.billingMonth && i.billing_month.toLowerCase() !== options.billingMonth.toLowerCase()) return false;
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
    notes?: string;
  }): Promise<StudentInvoice> {
    const student = this.students.find(s => s.id === data.student_id && s.tenant_id === tenantId);
    if (!student) throw new Error('Student not found for invoice generation');

    const batch = this.batches.find(b => b.id === student.batch_id);
    const invoiceId = crypto.randomUUID();
    const count = this.invoices.filter(i => i.tenant_id === tenantId).length + 1;
    const invoiceNumber = `INV-2026-${count.toString().padStart(4, '0')}`;

    const items: InvoiceItem[] = [];
    let subtotal = 0;

    if (data.custom_items && data.custom_items.length > 0) {
      for (const ci of data.custom_items) {
        const head = this.feeHeads.find(h => h.id === ci.fee_head_id);
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
      // Inherit from student fee structure or batch default
      const studentStructure = this.feeStructures.find(fs => fs.tenant_id === tenantId && fs.student_id === student.id)
        || this.feeStructures.find(fs => fs.tenant_id === tenantId && fs.batch_id === student.batch_id);

      if (studentStructure && studentStructure.items.length > 0) {
        for (const it of studentStructure.items) {
          const head = this.feeHeads.find(h => h.id === it.fee_head_id);
          const amount = Number(it.amount) || 0;
          items.push({
            id: crypto.randomUUID(),
            invoice_id: invoiceId,
            fee_head_id: it.fee_head_id,
            head_name: head?.name || it.head_name,
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
        // Fallback to default tuition
        const tuitionHead = this.feeHeads.find(h => h.tenant_id === tenantId && h.code === 'TUITION') || this.feeHeads[0];
        const defaultAmount = tuitionHead?.default_amount || 8000;
        if (tuitionHead) {
          items.push({
            id: crypto.randomUUID(),
            invoice_id: invoiceId,
            fee_head_id: tuitionHead.id,
            head_name: tuitionHead.name,
            head_code: tuitionHead.code,
            original_amount: defaultAmount,
            discount_amount: 0,
            net_amount: defaultAmount,
            paid_amount: 0,
            balance_due: defaultAmount
          });
          subtotal += defaultAmount;
        }
      }
    }

    const invoice: StudentInvoice = {
      id: invoiceId,
      tenant_id: tenantId,
      invoice_number: invoiceNumber,
      student_id: student.id,
      student_name: student.full_name,
      roll_number: student.roll_number,
      batch_id: student.batch_id,
      batch_name: batch?.name || 'General Batch',
      billing_month: data.billing_month,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: data.due_date,
      subtotal_amount: subtotal,
      discount_amount: 0,
      net_amount: subtotal,
      paid_amount: 0,
      balance_amount: subtotal,
      status: 'unpaid',
      items,
      notes: data.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.invoices.push(invoice);
    return invoice;
  }

  async generateBatchInvoices(tenantId: string, batchId: string, billingMonth: string, dueDate: string): Promise<StudentInvoice[]> {
    const studentsInBatch = this.students.filter(s => s.tenant_id === tenantId && s.batch_id === batchId && s.status === 'active');
    const created: StudentInvoice[] = [];

    for (const student of studentsInBatch) {
      // Check if invoice already exists for this student and billing month
      const existing = this.invoices.find(i => 
        i.tenant_id === tenantId &&
        i.student_id === student.id &&
        i.billing_month.toLowerCase() === billingMonth.toLowerCase()
      );
      if (!existing) {
        const inv = await this.generateInvoice(tenantId, {
          student_id: student.id,
          billing_month: billingMonth,
          due_date: dueDate
        });
        created.push(inv);
      }
    }
    return created;
  }

  // --- Smart Auto-Distribution Algorithm & Cashier Review ---
  async previewPaymentDistribution(tenantId: string, invoiceId: string, amount: number): Promise<PaymentDistributionItem[]> {
    const invoice = this.invoices.find(i => i.id === invoiceId && i.tenant_id === tenantId);
    if (!invoice) throw new Error('Invoice not found for distribution calculation');

    const prioConfig = await this.getFeePriorityConfig(tenantId);
    const priorityOrder = prioConfig.priority_order;

    // Sort items by liquidation priority
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
      const due = item.balance_due;
      let alloc = 0;
      if (due > 0 && remaining > 0) {
        alloc = Math.min(remaining, due);
        remaining -= alloc;
      }
      distribution.push({
        fee_head_id: item.fee_head_id,
        head_name: item.head_name,
        allocated_amount: alloc
      });
    }

    // If remaining amount exceeds total outstanding due, distribute to the first item (advance/excess)
    if (remaining > 0 && distribution.length > 0) {
      distribution[0].allocated_amount += remaining;
    }

    return distribution;
  }

  async recordPayment(tenantId: string, data: {
    invoice_id: string;
    amount_paid: number;
    payment_method: PaymentMethod;
    reference_number?: string;
    is_override?: boolean;
    override_reason?: string;
    allocations?: PaymentDistributionItem[];
    collected_by: string;
  }): Promise<{ payment: FeePayment; invoice: StudentInvoice }> {
    const invoice = this.invoices.find(i => i.id === data.invoice_id && i.tenant_id === tenantId);
    if (!invoice) throw new Error('Invoice not found');

    const amountPaid = Number(data.amount_paid);
    if (amountPaid <= 0) throw new Error('Payment amount must be greater than zero');

    // Determine allocations: use provided cashier review override or compute smart distribution
    const allocations = data.allocations && data.allocations.length > 0
      ? data.allocations
      : await this.previewPaymentDistribution(tenantId, data.invoice_id, amountPaid);

    const sumAllocated = allocations.reduce((s, a) => s + Number(a.allocated_amount), 0);
    if (Math.abs(sumAllocated - amountPaid) > 0.05) {
      throw new Error(`Allocated sum (${sumAllocated}) does not match paid amount (${amountPaid})`);
    }

    // Apply allocations to individual invoice items
    for (const alloc of allocations) {
      const item = invoice.items.find((i: InvoiceItem) => i.fee_head_id === alloc.fee_head_id);
      if (item) {
        item.paid_amount += Number(alloc.allocated_amount);
        item.balance_due = Math.max(0, item.net_amount - item.paid_amount);
      }
    }

    invoice.paid_amount = invoice.items.reduce((s: number, it: InvoiceItem) => s + it.paid_amount, 0);
    invoice.balance_amount = Math.max(0, invoice.net_amount - invoice.paid_amount);
    invoice.status = invoice.balance_amount <= 0 ? 'paid' : (invoice.paid_amount > 0 ? 'partially_paid' : 'unpaid');
    invoice.updated_at = new Date().toISOString();

    const count = this.feePayments.filter(p => p.tenant_id === tenantId).length + 1;
    const receiptNumber = `REC-2026-${count.toString().padStart(5, '0')}`;

    const payment: FeePayment = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      receipt_number: receiptNumber,
      invoice_id: invoice.id,
      student_id: invoice.student_id,
      student_name: invoice.student_name,
      roll_number: invoice.roll_number,
      payment_date: new Date().toISOString().split('T')[0],
      amount_paid: amountPaid,
      payment_method: data.payment_method,
      reference_number: data.reference_number || null,
      is_override: Boolean(data.is_override),
      override_reason: data.override_reason || null,
      allocations,
      collected_by: data.collected_by,
      created_at: new Date().toISOString()
    };

    this.feePayments.push(payment);
    return { payment, invoice };
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

      // Distribute discount to items (proportionately or to first eligible head)
      if (data.fee_head_id) {
        const item = invoice.items.find((it: InvoiceItem) => it.fee_head_id === data.fee_head_id);
        if (item) {
          item.discount_amount += actualDiscount;
          item.net_amount = Math.max(0, item.original_amount - item.discount_amount);
          item.balance_due = Math.max(0, item.net_amount - item.paid_amount);
        }
      } else if (invoice.items.length > 0) {
        invoice.items[0].discount_amount += actualDiscount;
        invoice.items[0].net_amount = Math.max(0, invoice.items[0].original_amount - invoice.items[0].discount_amount);
        invoice.items[0].balance_due = Math.max(0, invoice.items[0].net_amount - invoice.items[0].paid_amount);
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
    return discount;
  }

  // --- Financial Reports Suite ---
  async getDailyCashbook(tenantId: string, date?: string): Promise<DailyCashbookEntry[]> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const payments = this.feePayments.filter(p => p.tenant_id === tenantId && p.payment_date === targetDate);

    return payments.map(p => ({
      id: p.id,
      date: p.payment_date,
      receipt_number: p.receipt_number,
      student_name: p.student_name,
      roll_number: p.roll_number,
      payment_method: p.payment_method,
      amount: p.amount_paid,
      collected_by: p.collected_by
    }));
  }

  async getStudentLedger(tenantId: string, studentId: string): Promise<StudentLedgerEntry[]> {
    const studentInvoices = this.invoices.filter(i => i.tenant_id === tenantId && i.student_id === studentId);
    const studentPayments = this.feePayments.filter(p => p.tenant_id === tenantId && p.student_id === studentId);

    const entries: StudentLedgerEntry[] = [];

    studentInvoices.forEach(inv => {
      entries.push({
        id: inv.id,
        date: inv.issue_date,
        description: `Invoice ${inv.invoice_number} (${inv.billing_month})`,
        debit: inv.net_amount,
        credit: 0,
        running_balance: 0,
        reference: inv.invoice_number
      });
    });

    studentPayments.forEach(pmt => {
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
    return head;
  }

  async deleteAccountHead(tenantId: string, id: string): Promise<boolean> {
    const head = this.accountHeads.find(h => h.tenant_id === tenantId && h.id === id);
    if (!head) return false;
    head.is_active = false;
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
      ...data
    };
    this.financialTransactions.push(tx);
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
      if (month && !p.payment_date.startsWith(month)) return false;
      return true;
    });
    const totalFeeIncome = relevantPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0);

    const relevantTx = this.financialTransactions.filter(t => {
      if (t.tenant_id !== tenantId) return false;
      if (month && !t.transaction_date.startsWith(month)) return false;
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

    // Aggregate attendance summary from Module 13 records
    const attendanceRecords = this.staffAttendance.filter(a => a.tenant_id === tenantId && a.staff_id === data.staff_id);
    const presentDays = attendanceRecords.filter(a => a.status === 'on_time' || a.status === 'late').length;
    const lateCount = attendanceRecords.filter(a => a.status === 'late').length;
    const absentDays = attendanceRecords.filter(a => a.status === 'absent').length;

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
        working_days: 26,
        present_days: presentDays > 0 ? presentDays : 25,
        late_count: lateCount,
        absent_days: absentDays,
        approved_leaves: 1,
        hours_or_lectures: 45
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
    return payslip;
  }

  async markPayslipPaid(tenantId: string, payslipId: string, paymentMethod: PaymentMethod, reference?: string): Promise<StaffPayslip> {
    const slip = this.staffPayslips.find(p => p.id === payslipId && p.tenant_id === tenantId);
    if (!slip) throw new Error('Payslip not found');

    slip.status = 'paid';
    slip.payment_date = new Date().toISOString().split('T')[0];
    slip.payment_method = paymentMethod;
    slip.transaction_reference = reference || null;
    slip.updated_at = new Date().toISOString();

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
        const sub = this.subjects.find(s => s.id === c.subject_id);
        const prog = this.programs.find(p => p.id === c.program_id);
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
        const sub = this.subjects.find(s => s.id === q.subject_id);
        const chap = this.questionChapters.find(c => c.id === q.chapter_id);
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
        const batch = this.batches.find(b => b.id === e.batch_id);
        const sub = this.subjects.find(s => s.id === e.subject_id);
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

    const batch = this.batches.find(b => b.id === exam.batch_id);
    const sub = this.subjects.find(s => s.id === exam.subject_id);
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
    const totalMarks = (data.mcq_total_marks || (data.mcq_count * data.mcq_marks_per_q) || 0) + (data.short_total_marks || 0) + (data.long_total_marks || 0);
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

    let grade = 'F';
    if (percentage >= 90) grade = 'A*';
    else if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B';
    else if (percentage >= 60) grade = 'C';
    else if (percentage >= 50) grade = 'D';
    else if (percentage >= 40) grade = 'E';

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
        batch_name: this.batches.find(b => b.id === student.batch_id)?.name,
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
    return evaluation;
  }

  async getExamEvaluations(tenantId: string, examId: string): Promise<StudentExamEvaluation[]> {
    return this.studentExamEvaluations
      .filter(ev => ev.exam_id === examId && ev.tenant_id === tenantId)
      .map(ev => {
        const student = this.students.find(s => s.id === ev.student_id);
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
        class_name: this.programs.find(p => p.id === student.program_id)?.name,
        batch_name: this.batches.find(b => b.id === student.batch_id)?.name
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
        const student = this.students.find(s => s.id === att.student_id);
        const batch = student?.batch_id ? this.batches.find(b => b.id === student.batch_id) : undefined;

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
          staff_counselor_id: null,
          staff_counselor_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    return this.getAbsenteeFollowups(tenantId, { date });
  }

  async getAbsenteeFollowups(tenantId: string, filters?: { date?: string; batchId?: string; status?: string }): Promise<AbsenteeFollowupItem[]> {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = filters?.date || today;

    // Handle date rollover for demo seeds
    const existingForTarget = this.absenteeFollowups.filter(f => f.tenant_id === tenantId && f.date === targetDate);
    if (existingForTarget.length === 0) {
      this.absenteeFollowups.forEach(f => {
        if (f.tenant_id === tenantId && (f.id === 'af-1' || f.id === 'af-2' || f.id === 'af-3')) {
          f.date = targetDate;
        }
      });
    }

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
        att.status = 'excused';
        att.remarks = `Converted to approved leave by ${item.staff_counselor_name || 'Staff'}: ${data.parent_remarks || 'Medical reasons'}`;
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
      : this.students.find(s => s.tenant_id === tenantId) || this.students[0];

    if (!student) {
      throw new Error(`Student not found in tenant: ${tenantId}`);
    }

    const batch = this.batches.find(b => b.id === student.batch_id);
    const todaySchedule = this.timetableSlots.filter(
      s => s.tenant_id === tenantId && s.batch_id === student.batch_id
    );

    const studentInvoices = this.invoices.filter(
      i => i.tenant_id === tenantId && (i.student_id === student.id || i.roll_number === student.roll_number)
    );
    const unpaidBalance = studentInvoices.reduce((sum, inv) => sum + inv.balance_amount, 0);

    const studentPayments = this.feePayments.filter(
      p => p.tenant_id === tenantId && (p.student_id === student.id || p.roll_number === student.roll_number)
    );

    const homeworkDiary = this.homeworkAssignments.filter(
      h => h.tenant_id === tenantId && h.batch_id === student.batch_id
    );

    // Official Exam Report Cards for this student
    const studentReportCards: StudentOfficialReportCard[] = [];
    const evals = this.studentExamEvaluations.filter(
      e => e.tenant_id === tenantId && e.student_id === student.id
    );

    for (const ev of evals) {
      const exam = this.exams.find(ex => ex.id === ev.exam_id);
      if (exam) {
        studentReportCards.push({
          exam,
          evaluation: ev,
          student: {
            id: student.id,
            full_name: student.full_name,
            roll_number: student.roll_number,
            guardian_name: student.guardian_name,
            batch_name: batch?.name || 'Batch 2026-A'
          },
          rank: 1,
          total_students: 48
        });
      }
    }

    // Recent Attendance
    const recentAttendance = this.studentAttendance
      .filter(a => a.tenant_id === tenantId && a.student_id === student.id)
      .slice(-7)
      .map(a => ({
        date: a.date,
        status: (a.status.toUpperCase() === 'PRESENT' ? 'PRESENT' : a.status.toUpperCase() === 'EXCUSED' ? 'EXCUSED' : 'ABSENT') as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
        remarks: a.remarks || null
      }));

    return {
      student_profile: {
        id: student.id,
        full_name: student.full_name,
        roll_number: student.roll_number,
        guardian_name: student.guardian_name,
        guardian_phone: student.guardian_phone,
        batch_name: batch?.name || 'Batch 2026-A',
        monthly_attendance_pct: 94.8
      },
      today_schedule: todaySchedule,
      invoices: studentInvoices,
      unpaid_balance: unpaidBalance,
      recent_receipts: studentPayments,
      homework_diary: homeworkDiary,
      exam_report_cards: studentReportCards,
      recent_attendance: recentAttendance.length > 0 ? recentAttendance : [
        { date: '2026-09-08', status: 'PRESENT', remarks: 'On time for Physics lecture' },
        { date: '2026-09-07', status: 'PRESENT', remarks: null },
        { date: '2026-09-06', status: 'PRESENT', remarks: null },
        { date: '2026-09-05', status: 'EXCUSED', remarks: 'Family event leave' }
      ]
    };
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
    if (this.staffAttendance) this.staffAttendance = this.staffAttendance.filter(a => a.tenant_id !== tenantId);
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
}

