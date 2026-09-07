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
