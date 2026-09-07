/**
 * @apex/shared-types
 * Core domain types and API contract definitions for Apex Academy Management System
 */

// =============================================================================
// 1. TENANCY & SUBSCRIPTION
// =============================================================================
export type TenantStatus = 'active' | 'trial' | 'grace_period' | 'locked' | 'suspended';
export type SubscriptionTier = 'starter' | 'standard' | 'enterprise';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  status: TenantStatus;
  tier: SubscriptionTier;
  max_students: number;
  max_staff: number;
  trial_ends_at: string;
  subscription_renews_at?: string | null;
  settings: TenantSettings;
  created_at: string;
  updated_at: string;
}

export interface TenantSettings {
  currency: string;
  timezone: string;
  date_format: string;
  academic_session: string;
  campus_name: string;
  phone_country_code: string;
  features: {
    mobile_pwa_enabled: boolean;
    whatsapp_rapid_queue: boolean;
    geofence_attendance: boolean;
  };
}

// =============================================================================
// 2. USERS & RBAC (ROLE-BASED ACCESS CONTROL)
// =============================================================================
export type UserRole = 
  | 'super_admin'     // Global SaaS platform operator
  | 'tenant_admin'    // Academy Director / Campus Principal
  | 'academic_head'   // Vice Principal / Academic Coordinator
  | 'teacher'         // Faculty member
  | 'finance_manager' // Accountant / Cashier
  | 'parent'          // Guardian
  | 'student';        // Enrolled pupil

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  phone?: string | null;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  avatar_url?: string | null;
  metadata?: Record<string, unknown>;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  role: UserRole;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage';
}

// =============================================================================
// 3. AUTHENTICATION & BREVO OTP CONTRACTS
// =============================================================================
export interface JWTPayload {
  sub: string;       // User UUID
  user_id?: string;  // Convenient alias for user UUID
  tenant_id: string; // Tenant UUID
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface RequestOTPRequest {
  email: string;
  tenant_slug?: string; // Optional: Auto-inferred if accessing via tenant subdomain
}

export interface RequestOTPResponse {
  success: boolean;
  message: string;
  cooldown_seconds: number;
  expires_in_seconds: number;
  // Included ONLY in development environment for zero-credential testing
  dev_otp_preview?: string;
}

export interface VerifyOTPRequest {
  email: string;
  otp: string;
  tenant_slug?: string;
}

export interface AuthSessionResponse {
  token: string;
  expires_at: string;
  user: {
    id: string;
    tenant_id: string;
    email: string;
    full_name: string;
    role: UserRole;
    avatar_url?: string | null;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: TenantStatus;
    academic_session: string;
    campus_name: string;
  };
}

// =============================================================================
// 4. AUDIT LOGGING & COMPLIANCE
// =============================================================================
export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  actor_email: string;
  action: string;
  resource: string;
  resource_id?: string | null;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  } | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

// =============================================================================
// 5. STANDARD API RESPONSE WRAPPERS
// =============================================================================
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

// =============================================================================
// 6. PHASE 2: ACADEMIC HIERARCHY & DYNAMIC ENROLLMENT (MODULES 2 & 3 & 5)
// =============================================================================

export interface AcademicProgram {
  id: string;
  tenant_id: string;
  name: string;      // e.g. "Grade 10", "FSc Pre-Medical", "MDCAT Crash"
  code: string;      // e.g. "G10", "FSC-MED", "MDCAT"
  description?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  tenant_id: string;
  name: string;      // e.g. "Physics", "Mathematics", "English"
  code: string;      // e.g. "PHY-101", "MATH-201"
  is_core: boolean;  // Standard core subject indicator
  created_at: string;
}

export type SubjectGroupType = 'compulsory' | 'elective_track';

export interface SubjectGroup {
  id: string;
  tenant_id: string;
  program_id: string;
  name: string;              // e.g. "Compulsory General", "Pre-Engineering Track"
  type: SubjectGroupType;
  subject_ids: string[];
  created_at: string;
}

export interface Batch {
  id: string;
  tenant_id: string;
  program_id: string;
  name: string;              // e.g. "MDCAT Morning - Batch A"
  shift: 'morning' | 'evening';
  academic_session: string;  // e.g. "2026-2027"
  max_capacity: number;      // e.g. 50
  current_enrollment: number;
  room_number?: string | null; // Nullable for Single-Room default setup
  created_at: string;
  updated_at: string;
}

export type CustomFieldType = 'text' | 'number' | 'select' | 'date' | 'checkbox';

export interface CustomFieldDefinition {
  id: string;
  tenant_id: string;
  entity_type: 'student' | 'inquiry';
  field_key: string;         // e.g. "emergency_contact", "blood_group"
  label: string;             // e.g. "Emergency Contact Number"
  field_type: CustomFieldType;
  options?: string[] | null; // For dropdown select options
  is_required: boolean;
  sort_order: number;
  created_at: string;
}

export type InquiryStage = 
  | 'new' 
  | 'follow_up' 
  | 'trial_scheduled' 
  | 'trial_attended' 
  | 'fee_discussion' 
  | 'admitted' 
  | 'closed';

export type InquiryPriority = 'high' | 'medium' | 'low';

export interface StudentInquiry {
  id: string;
  tenant_id: string;
  inquiry_number: string;
  student_name: string;
  phone: string;
  email?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  program_id?: string | null;
  source: string;            // Walk-in, Website, Social Media, Recommendation
  stage: InquiryStage;
  priority: InquiryPriority;
  notes?: string | null;
  next_follow_up_date?: string | null;
  created_at: string;
  updated_at: string;
}

export type StudentStatus = 'active' | 'on_leave' | 'suspended' | 'alumni' | 'withdrawn';

export interface Student {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  admission_number: string;  // Unique institutional admission no. e.g. "ADM-2026-0042"
  roll_number: string;       // Dynamic batch roll no. e.g. "A-101"
  full_name: string;
  email?: string | null;
  phone?: string | null;
  guardian_name: string;
  guardian_phone: string;
  guardian_whatsapp?: string | null;
  photo_url?: string | null;
  program_id: string;
  batch_id: string;
  elective_group_id?: string | null;
  status: StudentStatus;
  custom_field_values: Record<string, unknown>;
  subjects: string[];        // Array of enrolled Subject UUIDs
  admission_date: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// 7. PHASE 3: TIMETABLE, ATTENDANCE, GEOFENCING & HOMEWORK (MODULES 5, 6, 9, 13)
// =============================================================================

export interface Room {
  id: string;
  tenant_id: string;
  name: string;              // e.g. "Hall 1", "Physics Lab", "Room 204"
  capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface TimetableSlot {
  id: string;
  tenant_id: string;
  batch_id: string;
  subject_id: string;
  teacher_id: string;
  teacher_name?: string;     // Hydrated for display
  batch_name?: string;       // Hydrated for display
  subject_name?: string;     // Hydrated for display
  room_id?: string | null;   // Nullable for Single-Room default setup
  room_name?: string | null; // Hydrated for display
  day_of_week: DayOfWeek;
  start_time: string;        // e.g. "08:30"
  end_time: string;          // e.g. "10:00"
  substitute_teacher_id?: string | null;
  substitute_teacher_name?: string | null;
  is_cancelled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimetableCollisionResult {
  has_conflict: boolean;
  conflict_type?: 'teacher_conflict' | 'batch_conflict' | 'room_conflict';
  message?: string;
  conflicting_slot?: TimetableSlot;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface StudentAttendanceRecord {
  id: string;
  tenant_id: string;
  student_id: string;
  student_name?: string;     // Hydrated
  roll_number?: string;      // Hydrated
  batch_id: string;
  subject_id?: string | null; // Nullable for daily batch attendance
  date: string;              // YYYY-MM-DD
  status: AttendanceStatus;
  marked_by?: string | null;
  remarks?: string | null;
  check_in_time?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchAttendanceSubmission {
  batch_id: string;
  date: string;
  records: Array<{
    student_id: string;
    status: AttendanceStatus;
    remarks?: string;
  }>;
}

export type LeaveCategory = 'medical' | 'personal' | 'emergency';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveApplication {
  id: string;
  tenant_id: string;
  student_id: string;
  student_name?: string;
  batch_name?: string;
  start_date: string;
  end_date: string;
  category: LeaveCategory;
  reason: string;
  status: LeaveStatus;
  reviewed_by?: string | null;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampusGeofenceConfig {
  tenant_id: string;
  campus_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  shift_start_time: string;   // e.g. "08:00:00"
  grace_period_minutes: number;
  multi_room_enabled: boolean; // Settings toggle for Multi-Room mode
  created_at: string;
  updated_at: string;
}

export type StaffAttendanceStatus = 'on_time' | 'late' | 'absent' | 'on_leave';

export interface StaffAttendanceRecord {
  id: string;
  tenant_id: string;
  staff_id: string;
  staff_name: string;
  date: string;              // YYYY-MM-DD
  clock_in_time: string;     // ISO timestamp
  clock_out_time?: string | null;
  clock_in_lat: number;
  clock_in_lng: number;
  distance_meters: number;
  status: StaffAttendanceStatus;
  is_geofence_verified: boolean;
  admin_adjusted?: boolean;
  admin_adjustment_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HomeworkAssignment {
  id: string;
  tenant_id: string;
  batch_id: string;
  batch_name?: string;
  subject_id: string;
  subject_name?: string;
  teacher_id: string;
  teacher_name?: string;
  title: string;
  description: string;
  assigned_date: string;     // YYYY-MM-DD
  due_date: string;          // YYYY-MM-DD
  attachment_url?: string | null;
  created_at: string;
}

export type NotebookStatus = 'done' | 'incomplete' | 'missing';

export interface NotebookCheckRecord {
  id: string;
  tenant_id: string;
  assignment_id: string;
  student_id: string;
  student_name?: string;
  roll_number?: string;
  status: NotebookStatus;
  remarks?: string | null;
  checked_by: string;
  checked_at: string;
}

export type ComplaintCategory = 'teaching_quality' | 'facility' | 'fee_billing' | 'disciplinary' | 'general';
export type ComplaintPriority = 'urgent' | 'high' | 'normal';
export type ComplaintStatus = 'open' | 'under_investigation' | 'action_taken' | 'resolved';

export interface ComplaintTicket {
  id: string;
  tenant_id: string;
  user_id: string;
  user_name?: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  subject: string;
  description: string;
  status: ComplaintStatus;
  internal_notes?: string | null;
  resolution_reply?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// 8. PHASE 4: FINANCE, FEE COLLECTION, SMART AUTO-DISTRIBUTION & PAYROLL (MODULES 7, 8 & 14)
// =============================================================================

export interface FeeHead {
  id: string;
  tenant_id: string;
  name: string;                // e.g. "Monthly Tuition Fee", "Previous Arrears", "Annual Charges"
  code: string;                // e.g. "TUITION", "ARREARS", "ANNUAL", "EXAM", "LAB", "ADMISSION"
  is_system_default: boolean;
  default_amount: number;
  priority_order: number;      // 1 = highest liquidation priority
  created_at: string;
}

export interface FeePriorityConfig {
  id: string;
  tenant_id: string;
  priority_order: string[];    // Array of FeeHead IDs in descending liquidation priority
  updated_at: string;
}

export interface StudentFeeStructure {
  id: string;
  tenant_id: string;
  batch_id?: string | null;
  student_id?: string | null;  // If set, individual student override
  items: {
    fee_head_id: string;
    head_name: string;
    amount: number;
  }[];
  academic_session: string;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'voided';

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  fee_head_id: string;
  head_name: string;
  head_code: string;
  original_amount: number;
  discount_amount: number;
  net_amount: number;
  paid_amount: number;
  balance_due: number;
}

export interface StudentInvoice {
  id: string;
  tenant_id: string;
  invoice_number: string;      // e.g. "INV-2026-00101"
  student_id: string;
  student_name: string;
  roll_number: string;
  batch_id: string;
  batch_name: string;
  billing_month: string;       // e.g. "September 2026"
  issue_date: string;          // YYYY-MM-DD
  due_date: string;            // YYYY-MM-DD
  subtotal_amount: number;
  discount_amount: number;
  net_amount: number;
  paid_amount: number;
  balance_amount: number;
  status: InvoiceStatus;
  items: InvoiceItem[];
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentDistributionItem {
  fee_head_id: string;
  head_name: string;
  allocated_amount: number;
}

export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'wallet';

export interface FeePayment {
  id: string;
  tenant_id: string;
  receipt_number: string;      // e.g. "REC-2026-00042"
  invoice_id: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  payment_date: string;        // YYYY-MM-DD
  amount_paid: number;
  payment_method: PaymentMethod;
  reference_number?: string | null;
  is_override: boolean;        // Cashier manually adjusted distribution
  override_reason?: string | null;
  allocations: PaymentDistributionItem[];
  collected_by: string;
  created_at: string;
}

export interface FeeDiscount {
  id: string;
  tenant_id: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  invoice_id?: string | null;
  fee_head_id?: string | null;
  discount_type: 'flat' | 'percentage';
  discount_value: number;
  actual_discount_amount: number;
  mandatory_reason: string;    // Required audit remark
  approved_by: string;
  applied_at: string;
}

export type SalaryContractType = 'fixed_monthly' | 'per_lecture';

export interface StaffSalaryProfile {
  id: string;
  tenant_id: string;
  staff_id: string;
  staff_name: string;
  designation: string;
  contract_type: SalaryContractType;
  base_amount: number;
  created_at: string;
  updated_at: string;
}

export interface PayrollEarningHead {
  id: string;
  name: string;
  quantity: number;
  unit_rate: number;
  total: number;
}

export interface PayrollDeductionHead {
  id: string;
  name: string;
  quantity: number;
  unit_rate: number;
  total: number;
}

export type StaffPayslipStatus = 'draft' | 'processed' | 'paid';

export interface StaffPayslip {
  id: string;
  tenant_id: string;
  slip_number: string;
  staff_id: string;
  staff_name: string;
  designation: string;
  payroll_month: string;       // e.g. "August 2026"
  base_salary: number;
  attendance_summary: {
    working_days: number;
    present_days: number;
    late_count: number;
    absent_days: number;
    approved_leaves: number;
    hours_or_lectures: number;
  };
  earnings: PayrollEarningHead[];
  deductions: PayrollDeductionHead[];
  total_earnings: number;
  total_deductions: number;
  net_salary: number;
  status: StaffPayslipStatus;
  payment_date?: string | null;
  payment_method?: PaymentMethod | null;
  transaction_reference?: string | null;
  admin_notes?: string | null;
  processed_by: string;
  created_at: string;
  updated_at: string;
}

export interface DailyCashbookEntry {
  id: string;
  date: string;
  receipt_number: string;
  student_name: string;
  roll_number: string;
  payment_method: PaymentMethod;
  amount: number;
  collected_by: string;
}

export interface StudentLedgerEntry {
  id: string;
  date: string;
  description: string;
  debit: number;               // Invoiced
  credit: number;              // Paid
  running_balance: number;
  reference: string;
}

// =============================================================================
// 9. PHASE 5: EXAMINATION BANK, EXCEL CHAPTER UPLOAD & HYBRID EVALUATION (MODULE 8)
// =============================================================================

export type ExamQuestionType = 'MCQ' | 'SHORT' | 'LONG';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'GRADED';
export type EvaluationStatus = 'ABSENT' | 'IN_PROGRESS' | 'GRADED';

export interface McqOption {
  key: string;                 // 'A' | 'B' | 'C' | 'D'
  text: string;
}

export interface QuestionChapter {
  id: string;
  tenant_id: string;
  program_id: string;
  program_name?: string;
  class_id?: string;
  class_name?: string;
  subject_id: string;
  subject_name?: string;
  chapter_number: number;
  chapter_name: string;
  question_count?: number;
  created_at: string;
  updated_at: string;
}

export interface BankQuestion {
  id: string;
  tenant_id: string;
  chapter_id?: string | null;
  chapter_name?: string | null;
  subject_id: string;
  subject_name?: string | null;
  question_type: ExamQuestionType;
  question_text: string;
  marks: number;
  options?: McqOption[];
  correct_option?: string | null;       // 'A', 'B', 'C', 'D' for MCQs
  rubric_guide?: string | null;         // Guidance for Short/Long scoring
  difficulty_level: QuestionDifficulty;
  is_quiz_bank: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExamSectionLabels {
  mcq: string;                 // e.g. "Q.1 (Objective MCQs)"
  short: string;               // e.g. "Q.2 (Short Questions)"
  long: string;                // e.g. "Q.3 (Long Questions)"
}

export interface Exam {
  id: string;
  tenant_id: string;
  batch_id: string;
  batch_name?: string;
  subject_id: string;
  subject_name?: string;
  title: string;
  exam_date: string;
  duration_minutes: number;
  total_marks: number;
  mcq_count: number;
  mcq_marks_per_q: number;
  mcq_total_marks: number;
  short_total_marks: number;
  long_total_marks: number;
  section_labels: ExamSectionLabels;
  status: ExamStatus;
  questions?: ExamQuestion[];
  created_at: string;
  updated_at: string;
}

export interface ExamQuestion {
  id: string;
  tenant_id: string;
  exam_id: string;
  question_id?: string | null;
  section_type: ExamQuestionType;
  display_order: number;
  question_text: string;
  marks: number;
  options?: McqOption[];
  correct_option?: string | null;
  created_at: string;
}

export interface StudentExamEvaluation {
  id: string;
  tenant_id: string;
  exam_id: string;
  student_id: string;
  student_name?: string;
  roll_number?: string;
  batch_name?: string;
  mcq_answers: Record<string, string>;   // questionId -> chosenOptionKey ('A', 'B', etc.)
  mcq_score: number;                     // 100% auto-calculated
  short_score: number;                   // Manual entry
  short_remarks?: string | null;         // Question-level feedback remark
  long_score: number;                    // Manual entry
  long_remarks?: string | null;          // Question-level feedback remark
  total_obtained: number;                // mcq_score + short_score + long_score
  percentage: number;
  grade: string;                         // 'A*', 'A', 'B', 'C', 'D', 'E', 'F'
  status: EvaluationStatus;
  evaluated_by?: string | null;
  evaluated_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExcelQuestionImportRow {
  chapter_number?: number;
  chapter_name?: string;
  question_type: ExamQuestionType;
  question_text: string;
  marks?: number;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_option?: string;
  rubric_guide?: string;
  difficulty_level?: QuestionDifficulty;
}

export interface StudentOfficialReportCard {
  exam: Exam;
  evaluation: StudentExamEvaluation;
  student: {
    id: string;
    full_name: string;
    roll_number: string;
    guardian_name: string;
    class_name?: string;
    batch_name?: string;
  };
  rank?: number;
  total_students?: number;
}
