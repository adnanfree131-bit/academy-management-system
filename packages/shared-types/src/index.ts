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
