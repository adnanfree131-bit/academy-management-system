/**
 * @apex/shared-types
 * Core domain types and API contract definitions for Apex Academy Management System
 */
export type TenantStatus = 'active' | 'trial' | 'grace_period' | 'locked' | 'suspended' | 'pending_verification' | 'archived';
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
    suspended_reason?: string | null;
    settings: TenantSettings;
    custom_monthly_fee?: number;
    individual_grace_period_days?: number;
    billing_cycle_anchor_day?: number;
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
    address?: string;
    phone?: string | null;
    email?: string;
    bank_name?: string;
    account_title?: string;
    account_number?: string;
    iban?: string;
    branch_code?: string;
    morning_shift_start?: string;
    morning_shift_end?: string;
    evening_shift_start?: string;
    evening_shift_end?: string;
    affiliation_number?: string;
    liquidation_rules?: {
        due_day?: number;
        grace_days?: number;
        late_fee_per_day?: number;
        priority_order?: string[];
    };
    shifts?: {
        morning?: {
            start?: string;
            end?: string;
        };
        evening?: {
            start?: string;
            end?: string;
        };
    };
    logo_url?: string | null;
    city?: string | null;
    domain?: string | null;
    subdomain?: string | null;
    domain_verified?: boolean;
    is_platform?: boolean;
    features: {
        mobile_pwa_enabled: boolean;
        whatsapp_rapid_queue: boolean;
        geofence_attendance: boolean;
    };
    grading_scale?: GradingTier[];
}
export interface GradingTier {
    grade: string;
    min_percentage: number;
    max_percentage: number;
    remarks?: string;
    gpa_points?: number;
}
export type UserRole = 'super_admin' | 'tenant_admin' | 'academic_head' | 'teacher' | 'finance_manager' | 'parent' | 'student';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification' | 'on_leave' | 'archived';
export interface User {
    id: string;
    tenant_id: string;
    email: string;
    phone?: string | null;
    full_name: string;
    role: UserRole;
    status: UserStatus;
    password_hash?: string;
    avatar_url?: string | null;
    metadata?: Record<string, unknown>;
    last_login_at?: string | null;
    created_at: string;
    updated_at: string;
}
export type EmploymentType = 'permanent' | 'probationary' | 'contractual' | 'visiting';
export type StaffDepartment = 'Science' | 'Mathematics' | 'Humanities' | 'Languages' | 'Commerce' | 'Administration' | 'Accounts' | 'General';
export type StaffStatus = 'active' | 'on_leave' | 'inactive' | 'archived';
export interface StaffTeachingAssignment {
    program_id: string;
    program_name: string;
    batch_id: string;
    batch_name: string;
    subject_id: string;
    subject_name: string;
    weekly_periods?: number;
}
export interface StaffLeaveBalance {
    casual_allowed: number;
    casual_used: number;
    sick_allowed: number;
    sick_used: number;
    annual_allowed: number;
    annual_used: number;
}
export interface StaffMemberRecord {
    id: string;
    tenant_id: string;
    user_id: string;
    employee_code: string;
    full_name: string;
    father_or_spouse_name?: string | null;
    cnic?: string | null;
    blood_group?: string | null;
    gender?: 'male' | 'female' | 'other' | null;
    dob?: string | null;
    email: string;
    phone?: string | null;
    whatsapp?: string | null;
    emergency_contact?: string | null;
    emergency_relation?: string | null;
    address?: string | null;
    department: StaffDepartment;
    designation: string;
    employment_type: EmploymentType;
    joining_date: string;
    probation_end_date?: string | null;
    relieving_date?: string | null;
    qualification: string;
    experience_years: number;
    base_salary: number;
    bank_name?: string | null;
    bank_account_title?: string | null;
    bank_account_number?: string | null;
    bank_iban?: string | null;
    teaching_assignments: StaffTeachingAssignment[];
    permissions: string[];
    status: StaffStatus;
    role?: string;
    avatar_url?: string | null;
    leave_balance?: StaffLeaveBalance;
    created_at: string;
    updated_at: string;
}
export interface Permission {
    id: string;
    role: UserRole;
    resource: string;
    action: 'create' | 'read' | 'update' | 'delete' | 'manage';
}
export interface JWTPayload {
    sub: string;
    user_id?: string;
    tenant_id: string;
    email: string;
    role: UserRole;
    iat?: number;
    exp?: number;
}
export interface RequestOTPRequest {
    email: string;
    tenant_slug?: string;
}
export interface RequestOTPResponse {
    success: boolean;
    message: string;
    cooldown_seconds: number;
    expires_in_seconds: number;
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
        permissions?: string[];
        designation?: string;
    };
    tenant: {
        id: string;
        name: string;
        slug: string;
        status: TenantStatus;
        academic_session: string;
        campus_name: string;
        logo_url?: string | null;
        city?: string | null;
    };
}
export interface LoginWithPasswordRequest {
    email: string;
    password: string;
    tenant_slug?: string;
}
export interface RegisterAcademyRequest {
    name: string;
    slug: string;
    city?: string;
    phone?: string;
    logo_url?: string;
    admin_name: string;
    admin_email: string;
    password: string;
}
export interface VerifyRegistrationOTPRequest {
    email: string;
    otp: string;
    tenant_slug: string;
}
export interface ForgotPasswordRequest {
    email: string;
    tenant_slug?: string;
}
export interface ResetPasswordRequest {
    email: string;
    otp: string;
    new_password: string;
    tenant_slug?: string;
}
export interface DomainAvailabilityResponse {
    slug: string;
    available: boolean;
    domain: string;
    message?: string;
}
export interface AcademyBranding {
    id: string;
    name: string;
    slug: string;
    campus_name: string;
    academic_session: string;
    domain: string;
    logo_url?: string | null;
    city?: string | null;
    phone?: string | null;
}
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
export interface FeeScheduleItem {
    fee_head_id?: string;
    head_name?: string;
    fee_type?: string;
    name?: string;
    amount: number;
    is_monthly?: boolean;
    is_recurring?: boolean;
}
export interface AcademicProgram {
    id: string;
    tenant_id: string;
    name: string;
    code?: string | null;
    description?: string | null;
    sort_order: number;
    fee_schedule?: FeeScheduleItem[];
    created_at: string;
    updated_at: string;
}
export interface Subject {
    id: string;
    tenant_id: string;
    name: string;
    code: string;
    is_core: boolean;
    created_at: string;
}
export type SubjectGroupType = 'compulsory' | 'elective_track';
export interface SubjectGroup {
    id: string;
    tenant_id: string;
    program_id: string;
    name: string;
    type: SubjectGroupType;
    subject_ids: string[];
    created_at: string;
}
export interface Batch {
    id: string;
    tenant_id: string;
    program_id: string;
    name: string;
    shift: 'morning' | 'evening';
    academic_session: string;
    max_capacity: number;
    current_enrollment: number;
    room_number?: string | null;
    fee_schedule?: FeeScheduleItem[];
    created_at: string;
    updated_at: string;
}
export type CustomFieldType = 'text' | 'number' | 'select' | 'date' | 'checkbox';
export interface CustomFieldDefinition {
    id: string;
    tenant_id: string;
    entity_type: 'student' | 'inquiry';
    field_key: string;
    label: string;
    field_type: CustomFieldType;
    options?: string[] | null;
    is_required: boolean;
    sort_order: number;
    created_at: string;
}
export type InquiryStage = 'new' | 'follow_up' | 'trial_scheduled' | 'trial_attended' | 'fee_discussion' | 'admitted' | 'closed';
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
    source: string;
    stage: InquiryStage;
    priority: InquiryPriority;
    notes?: string | null;
    next_follow_up_date?: string | null;
    created_at: string;
    updated_at: string;
}
export type StudentStatus = 'active' | 'on_leave' | 'suspended' | 'alumni' | 'withdrawn' | 'waitlisted';
export interface Student {
    id: string;
    tenant_id: string;
    user_id?: string | null;
    admission_number: string;
    roll_number: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    guardian_name: string;
    guardian_phone: string;
    guardian_email?: string | null;
    guardian_whatsapp?: string | null;
    photo_url?: string | null;
    program_id: string;
    batch_id: string;
    elective_group_id?: string | null;
    status: StudentStatus;
    custom_field_values: Record<string, unknown>;
    subjects: string[];
    blood_group?: string | null;
    fee_structure?: any;
    first_invoice_id?: string | null;
    admission_date: string;
    status_reason?: string | null;
    status_change_history?: Array<{
        previous_status: StudentStatus;
        new_status: StudentStatus;
        reason: string;
        changed_by: string;
        changed_at: string;
    }>;
    created_at: string;
    updated_at: string;
}
export interface Room {
    id: string;
    tenant_id: string;
    name: string;
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
    teacher_name?: string;
    batch_name?: string;
    subject_name?: string;
    room_id?: string | null;
    room_name?: string | null;
    day_of_week: DayOfWeek;
    start_time: string;
    end_time: string;
    substitute_teacher_id?: string | null;
    substitute_teacher_name?: string | null;
    substitutions?: TimetableSubstitution[];
    is_cancelled?: boolean;
    created_at: string;
    updated_at: string;
}
export interface TimetableSubstitution {
    id: string;
    date: string;
    substitute_teacher_id: string;
    substitute_teacher_name?: string | null;
    reason?: string | null;
    created_at: string;
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
    student_name?: string;
    roll_number?: string;
    batch_id: string;
    subject_id?: string | null;
    date: string;
    status: AttendanceStatus;
    marked_by?: string | null;
    remarks?: string | null;
    check_in_time?: string | null;
    created_at: string;
    updated_at: string;
}
export interface AttendanceAuditLog {
    id: string;
    tenant_id: string;
    student_id: string;
    student_name?: string;
    batch_id: string;
    date: string;
    previous_status: AttendanceStatus;
    new_status: AttendanceStatus;
    changed_by: string;
    changed_at?: string;
    created_at?: string;
    reason?: string | null;
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
    shift_start_time: string;
    shift_end_time?: string;
    grace_period_minutes: number;
    half_day_hours?: number;
    enforcement_mode?: 'strict' | 'flagged';
    multi_room_enabled?: boolean;
    created_at: string;
    updated_at: string;
}
export type StaffAttendanceStatus = 'on_time' | 'late' | 'half_day' | 'absent' | 'on_leave';
export interface StaffAttendanceRecord {
    id: string;
    tenant_id: string;
    staff_id: string;
    staff_name: string;
    date: string;
    clock_in_time: string;
    clock_out_time?: string | null;
    clock_in_lat: number;
    clock_in_lng: number;
    clock_out_lat?: number | null;
    clock_out_lng?: number | null;
    work_duration_minutes?: number | null;
    early_departure?: boolean;
    distance_meters: number;
    status: StaffAttendanceStatus;
    is_geofence_verified: boolean;
    verification_mode?: 'geofence' | 'manual_regularization' | 'biometric_sync';
    admin_adjusted?: boolean;
    admin_adjustment_notes?: string | null;
    adjusted_by?: string | null;
    created_at: string;
    updated_at: string;
}
export interface DailyStaffRosterEntry {
    staff_id: string;
    staff_name: string;
    employee_code: string;
    department: string;
    designation: string;
    date: string;
    status: StaffAttendanceStatus | 'not_marked';
    clock_in_time?: string | null;
    clock_out_time?: string | null;
    work_duration_minutes?: number | null;
    early_departure?: boolean;
    distance_meters?: number | null;
    is_geofence_verified: boolean;
    verification_mode?: 'geofence' | 'manual_regularization' | 'biometric_sync';
    admin_adjusted?: boolean;
    admin_adjustment_notes?: string | null;
    record_id?: string | null;
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
    assigned_date: string;
    due_date: string;
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
export interface FeeHead {
    id: string;
    tenant_id: string;
    name: string;
    code: string;
    is_system_default: boolean;
    default_amount: number;
    priority_order: number;
    created_at: string;
}
export interface FeePriorityConfig {
    id: string;
    tenant_id: string;
    priority_order: string[];
    updated_at: string;
}
export interface StudentFeeStructure {
    id: string;
    tenant_id: string;
    batch_id?: string | null;
    student_id?: string | null;
    items: {
        fee_head_id: string;
        head_name: string;
        amount: number;
    }[];
    academic_session: string;
    created_at: string;
    updated_at: string;
}
export type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'voided' | 'cancelled' | 'PAID' | 'UNPAID' | 'PARTIAL' | 'OVERDUE' | 'VOID';
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
    invoice_number: string;
    student_id: string;
    student_name: string;
    roll_number: string;
    batch_id: string;
    batch_name: string;
    billing_month: string;
    issue_date: string;
    due_date: string;
    subtotal_amount: number;
    subtotal?: number;
    discount_amount: number;
    discount_total?: number;
    net_amount: number;
    net_total?: number;
    paid_amount: number;
    balance_amount: number;
    balance_due?: number;
    status: InvoiceStatus;
    items: InvoiceItem[];
    notes?: string | null;
    fine_amount?: number;
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
    receipt_number: string;
    invoice_id: string;
    student_id: string;
    student_name: string;
    roll_number: string;
    payment_date: string;
    amount_paid: number;
    payment_method: PaymentMethod;
    reference_number?: string | null;
    is_override: boolean;
    override_reason?: string | null;
    allocations: PaymentDistributionItem[];
    collected_by: string;
    status?: 'paid' | 'voided';
    voided_at?: string | null;
    voided_by?: string | null;
    void_reason?: string | null;
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
    mandatory_reason: string;
    approved_by: string;
    applied_at: string;
}
export interface AccountHead {
    id: string;
    tenant_id: string;
    type: 'income' | 'expense';
    name: string;
    code: string;
    description?: string | null;
    is_active: boolean;
    created_at: string;
}
export type FinancialPaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'online' | 'wallet' | 'easypaisa' | 'jazzcash';
export interface FinancialTransaction {
    id: string;
    tenant_id: string;
    voucher_number: string;
    type: 'income' | 'expense';
    account_head_id: string;
    head_name: string;
    amount: number;
    transaction_date: string;
    date?: string;
    payment_method: FinancialPaymentMethod;
    reference_number?: string | null;
    paid_to_or_received_from: string;
    payee_payer?: string;
    description?: string | null;
    attachment_url?: string | null;
    recorded_by: string;
    created_at: string;
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
    payroll_month: string;
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
    status?: 'paid' | 'voided';
    void_reason?: string | null;
}
export interface StudentLedgerEntry {
    id: string;
    date: string;
    description: string;
    debit: number;
    credit: number;
    running_balance: number;
    reference: string;
}
export type ExamQuestionType = 'MCQ' | 'SHORT' | 'LONG';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'GRADED';
export type EvaluationStatus = 'ABSENT' | 'IN_PROGRESS' | 'GRADED';
export interface McqOption {
    key: string;
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
    correct_option?: string | null;
    rubric_guide?: string | null;
    difficulty_level: QuestionDifficulty;
    is_quiz_bank: boolean;
    created_at: string;
    updated_at: string;
}
export interface ExamSectionLabels {
    mcq: string;
    short: string;
    long: string;
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
    mcq_answers: Record<string, string>;
    mcq_score: number;
    short_score: number;
    short_remarks?: string | null;
    long_score: number;
    long_remarks?: string | null;
    total_obtained: number;
    percentage: number;
    grade: string;
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
export type WhatsAppTemplateCategory = 'ABSENCE' | 'FEE_REMINDER' | 'EXAM_RESULT' | 'GENERAL';
export type WhatsAppPhoneType = 'PRIMARY' | 'BACKUP';
export interface WhatsAppTemplate {
    id: string;
    tenant_id: string;
    title: string;
    category: WhatsAppTemplateCategory;
    body: string;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}
export interface WhatsAppAuditLog {
    id: string;
    tenant_id: string;
    student_id: string;
    student_name?: string;
    roll_number?: string;
    recipient_phone: string;
    phone_type: WhatsAppPhoneType;
    template_id?: string | null;
    message_body: string;
    status: 'OPENED' | 'SENT' | 'FAILED';
    dispatched_by?: string | null;
    dispatched_by_name?: string | null;
    dispatched_at: string;
}
export interface WhatsAppSanitizedUrlResult {
    phone: string;
    clean_phone: string;
    is_valid: boolean;
    message: string;
    encoded_url: string;
    warning?: string | null;
}
export type AbsenteeCallOutcome = 'CONNECTED' | 'NO_ANSWER' | 'SWITCHED_OFF' | 'WHATSAPP_SENT';
export type AbsenteeReasonCategory = 'MEDICAL' | 'EMERGENCY' | 'TRANSPORT' | 'FEE_DISPUTE' | 'TRUANCY' | 'OTHER';
export type AbsenteeFollowupStatus = 'PENDING' | 'CONTACTED' | 'UNREACHABLE' | 'RESOLVED_EXCUSED';
export type RetentionRiskLevel = 'MODERATE' | 'HIGH' | 'CRITICAL';
export interface AbsenteeFollowupItem {
    id: string;
    tenant_id: string;
    student_id: string;
    student_name: string;
    roll_number: string;
    guardian_name: string;
    guardian_phone: string;
    backup_phone?: string | null;
    batch_id: string;
    batch_name: string;
    date: string;
    consecutive_days: number;
    call_outcome?: AbsenteeCallOutcome | null;
    reason_category?: AbsenteeReasonCategory | null;
    parent_remarks?: string | null;
    expected_return_date?: string | null;
    is_snoozed: boolean;
    snooze_until?: string | null;
    status: AbsenteeFollowupStatus;
    staff_counselor_id?: string | null;
    staff_counselor_name?: string | null;
    last_whatsapp_sent_at?: string | null;
    created_at: string;
    updated_at: string;
}
export interface AbsenteeDeskSummaryKPI {
    total_absentees: number;
    contacted_count: number;
    contacted_percentage: number;
    unreachable_count: number;
    pending_count: number;
    excused_count: number;
}
export interface RetentionCounselingCase {
    id: string;
    tenant_id: string;
    student_id: string;
    student_name: string;
    roll_number: string;
    batch_name: string;
    monthly_attendance_pct: number;
    consecutive_absences: number;
    risk_level: RetentionRiskLevel;
    scheduled_meeting_date?: string | null;
    counseling_notes?: string | null;
    status: 'OPEN' | 'SCHEDULED' | 'RESOLVED' | 'DROPPED_OUT';
    created_at: string;
    updated_at: string;
}
export interface AbsenteeResolutionReport {
    total_absences: number;
    followup_rate: number;
    reason_breakdown: Record<AbsenteeReasonCategory, number>;
    medical_leave_converted: number;
    prevented_dropouts: number;
}
export interface PlatformBankingConfig {
    id: string;
    bank_name: string;
    account_title: string;
    account_number: string;
    iban?: string | null;
    branch_code?: string | null;
    whatsapp_support?: string | null;
    support_email?: string | null;
    monthly_subscription_fee: number;
    instructions?: string | null;
    updated_at: string;
}
export type SubscriptionReceiptStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface SubscriptionPaymentReceipt {
    id: string;
    tenant_id: string;
    tenant_name?: string;
    uploaded_by_user_id?: string | null;
    uploaded_by_email?: string | null;
    amount: number;
    plan_duration_months: number;
    payment_method: string;
    reference_number?: string | null;
    receipt_image_url?: string | null;
    notes?: string | null;
    status: SubscriptionReceiptStatus;
    reviewed_by_email?: string | null;
    reviewed_at?: string | null;
    created_at: string;
    updated_at: string;
}
export interface TenantTrialStatus {
    tenant_id: string;
    tenant_name: string;
    status: string;
    trial_ends_at: string;
    subscription_renews_at?: string | null;
    days_remaining: number;
    is_locked: boolean;
    lock_reason?: string | null;
    banking_config?: PlatformBankingConfig;
    pending_receipt?: SubscriptionPaymentReceipt | null;
}
export interface TeacherPortalOverview {
    teacher_id: string;
    teacher_name: string;
    today_date: string;
    today_schedule: TimetableSlot[];
    assigned_batches: Batch[];
    pending_attendance_batches: Batch[];
    pending_grading_exams: Exam[];
    recent_diary_entries: HomeworkAssignment[];
    geofence_status: {
        is_clocked_in: boolean;
        clocked_in_at?: string | null;
        distance_meters?: number | null;
    };
}
export interface StudentParentPortalOverview {
    student_profile: {
        id: string;
        full_name: string;
        roll_number: string;
        guardian_name: string;
        guardian_phone: string;
        batch_name: string;
        monthly_attendance_pct: number;
    };
    today_schedule: TimetableSlot[];
    invoices: StudentInvoice[];
    unpaid_balance: number;
    recent_receipts: FeePayment[];
    homework_diary: HomeworkAssignment[];
    exam_report_cards: StudentOfficialReportCard[];
    recent_attendance: {
        date: string;
        status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
        remarks?: string | null;
    }[];
}
export interface TenantSlugAlias {
    id: string;
    tenant_id: string;
    alias_slug: string;
    created_at: string;
}
export interface PlatformGlobalConfig {
    id: string;
    default_trial_days: number;
    grace_period_days: number;
    monthly_subscription_fee: number;
    bank_name: string;
    account_title: string;
    account_number: string;
    iban?: string;
    branch_code?: string;
    whatsapp_support?: string;
    support_email?: string;
    instructions?: string;
    updated_at: string;
}
export type PlatformAnnouncementType = 'billing' | 'grace_period' | 'system' | 'custom' | 'urgent' | 'warning' | 'maintenance';
export type PlatformAnnouncementFrequency = 'every_login' | 'once_dismissible';
export type PlatformAnnouncementAudience = 'all' | 'admin_only' | 'trial_expiring' | 'grace_period' | 'specific_academy';
export interface PlatformAnnouncement {
    id: string;
    title: string;
    message: string;
    type: PlatformAnnouncementType;
    frequency: PlatformAnnouncementFrequency;
    target_audience: PlatformAnnouncementAudience;
    target_tenant_id?: string | null;
    is_active: boolean;
    action_label?: string | null;
    action_url?: string | null;
    created_at: string;
    updated_at?: string;
}
export interface AnnouncementReadReceipt {
    id: string;
    announcement_id: string;
    user_id: string;
    tenant_id: string;
    read_at: string;
}
export interface SuperAdminTenantSummary {
    id: string;
    name: string;
    slug: string;
    domain?: string | null;
    status: string;
    tier: string;
    trial_ends_at: string;
    subscription_renews_at?: string | null;
    student_count: number;
    teacher_count: number;
    pending_receipt?: SubscriptionPaymentReceipt | null;
    aliases?: string[];
    custom_monthly_fee?: number;
    individual_grace_period_days?: number;
    billing_cycle_anchor_day?: number;
    total_paid_amount?: number;
    pending_dues_amount?: number;
    created_at?: string;
    payment_history?: SubscriptionPaymentReceipt[];
}
export interface SuperAdminOverview {
    total_tenants: number;
    active_tenants: number;
    trial_tenants: number;
    locked_tenants: number;
    suspended_tenants: number;
    archived_tenants?: number;
    platform_mrr: number;
    platform_arr: number;
    pending_receipts_count: number;
    platform_config: PlatformGlobalConfig;
    banking_config: PlatformBankingConfig;
    tenants: SuperAdminTenantSummary[];
    recent_receipts: SubscriptionPaymentReceipt[];
    announcements: PlatformAnnouncement[];
}
export interface UpdateTenantBillingRequest {
    custom_monthly_fee?: number;
    individual_grace_period_days?: number;
    billing_cycle_anchor_day?: number;
}
export interface RenewTenantSubscriptionRequest {
    duration_months: number;
    custom_amount?: number;
    payment_method?: string;
    reference_number?: string;
    notes?: string;
}
//# sourceMappingURL=index.d.ts.map