-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00001: MULTI-TENANT CORE & RLS
-- =============================================================================

-- 1. Native gen_random_uuid() is built-in to PostgreSQL 13+

-- 2. Tenant Table (Root institutional boundary)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  domain VARCHAR(255) UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'trial' 
    CHECK (status IN ('active', 'trial', 'grace_period', 'locked', 'suspended')),
  tier VARCHAR(50) NOT NULL DEFAULT 'starter' 
    CHECK (tier IN ('starter', 'standard', 'enterprise')),
  max_students INT NOT NULL DEFAULT 500,
  max_staff INT NOT NULL DEFAULT 50,
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  subscription_renews_at TIMESTAMPTZ,
  settings JSONB NOT NULL DEFAULT '{
    "currency": "PKR",
    "timezone": "Asia/Karachi",
    "date_format": "DD/MM/YYYY",
    "academic_session": "2026-2027",
    "campus_name": "Main Campus",
    "phone_country_code": "+92",
    "features": {
      "mobile_pwa_enabled": true,
      "whatsapp_rapid_queue": true,
      "geofence_attendance": true
    }
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Users Table (Scoped strictly to a tenant)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL 
    CHECK (role IN ('super_admin', 'tenant_admin', 'academic_head', 'teacher', 'finance_manager', 'parent', 'student')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'inactive', 'suspended', 'pending_verification')),
  avatar_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_user_email UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(tenant_id, role);

-- 4. OTP Verification Codes Table
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_lookup ON otp_codes(tenant_id, email, used_at);

-- 5. Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_resource ON audit_logs(tenant_id, resource, created_at DESC);

-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS & POLICIES
-- =============================================================================

-- Helper to safely extract current tenant ID from session context
CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Enable and FORCE RLS on all tenant-sensitive tables (prevents owner/superuser bypass)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- Tenants Policy
DROP POLICY IF EXISTS tenant_isolation_policy ON tenants;
CREATE POLICY tenant_isolation_policy ON tenants
  FOR ALL
  USING (
    id = get_current_tenant_id() 
    OR current_setting('app.is_super_admin', true) = 'true'
  );

-- Users Policy
DROP POLICY IF EXISTS users_isolation_policy ON users;
CREATE POLICY users_isolation_policy ON users
  FOR ALL
  USING (
    tenant_id = get_current_tenant_id() 
    OR current_setting('app.is_super_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id = get_current_tenant_id() 
    OR current_setting('app.is_super_admin', true) = 'true'
  );

-- OTP Codes Policy
DROP POLICY IF EXISTS otp_isolation_policy ON otp_codes;
CREATE POLICY otp_isolation_policy ON otp_codes
  FOR ALL
  USING (
    tenant_id = get_current_tenant_id() 
    OR current_setting('app.is_super_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id = get_current_tenant_id() 
    OR current_setting('app.is_super_admin', true) = 'true'
  );

-- Audit Logs Policy
DROP POLICY IF EXISTS audit_isolation_policy ON audit_logs;
CREATE POLICY audit_isolation_policy ON audit_logs
  FOR ALL
  USING (
    tenant_id = get_current_tenant_id() 
    OR current_setting('app.is_super_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id = get_current_tenant_id() 
    OR current_setting('app.is_super_admin', true) = 'true'
  );

-- =============================================================================
-- 7. APPLICATION ROLE & PERMISSIONS (Standard Supabase / Production Role)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00002: ACADEMIC HIERARCHY & SIS
-- Zero-Hardcoded Hierarchy, Dynamic Form Fields, Inquiries Desk, & Student SIS
-- =============================================================================

-- 1. Academic Programs / Grades (e.g. Grade 9, Grade 10, FSc Pre-Medical, MDCAT)
CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_program_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_programs_tenant ON programs(tenant_id);

-- 2. Subjects (Dynamic per academy)
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  is_core BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_subject_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_subjects_tenant ON subjects(tenant_id);

-- 3. Subject Groups (Compulsory Package vs Elective Tracks)
CREATE TABLE IF NOT EXISTS subject_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('compulsory', 'elective_track')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subject_groups_tenant ON subject_groups(tenant_id, program_id);

-- Junction: Subject Group Items
CREATE TABLE IF NOT EXISTS subject_group_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES subject_groups(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  CONSTRAINT uq_group_subject UNIQUE (group_id, subject_id)
);

-- 4. Batches / Sections (Single-Room default concept)
CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  shift VARCHAR(50) NOT NULL DEFAULT 'morning' CHECK (shift IN ('morning', 'evening')),
  academic_session VARCHAR(50) NOT NULL DEFAULT '2026-2027',
  max_capacity INT NOT NULL DEFAULT 40,
  room_number VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_tenant ON batches(tenant_id, program_id);

-- 5. Dynamic Custom Form Fields (For Academy Admission Forms)
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL DEFAULT 'student' CHECK (entity_type IN ('student', 'inquiry')),
  field_key VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'number', 'select', 'date', 'checkbox')),
  options JSONB DEFAULT '[]'::jsonb,
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_custom_field UNIQUE (tenant_id, entity_type, field_key)
);

CREATE INDEX IF NOT EXISTS idx_custom_fields_tenant ON custom_field_definitions(tenant_id, entity_type);

-- 6. Student Inquiries Desk
CREATE TABLE IF NOT EXISTS student_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inquiry_number VARCHAR(50) NOT NULL,
  student_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  guardian_name VARCHAR(255),
  guardian_phone VARCHAR(50),
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  source VARCHAR(100) NOT NULL DEFAULT 'Walk-in',
  stage VARCHAR(50) NOT NULL DEFAULT 'new' 
    CHECK (stage IN ('new', 'follow_up', 'trial_scheduled', 'trial_attended', 'fee_discussion', 'admitted', 'closed')),
  priority VARCHAR(50) NOT NULL DEFAULT 'medium' 
    CHECK (priority IN ('high', 'medium', 'low')),
  notes TEXT,
  next_follow_up_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_tenant ON student_inquiries(tenant_id, stage, priority);

-- 7. Student SIS (Master Directory)
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admission_number VARCHAR(100) NOT NULL,
  roll_number VARCHAR(50) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  guardian_name VARCHAR(255) NOT NULL,
  guardian_phone VARCHAR(50) NOT NULL,
  guardian_whatsapp VARCHAR(50),
  photo_url TEXT,
  program_id UUID NOT NULL REFERENCES programs(id),
  batch_id UUID NOT NULL REFERENCES batches(id),
  elective_group_id UUID REFERENCES subject_groups(id),
  status VARCHAR(50) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'on_leave', 'suspended', 'alumni', 'withdrawn')),
  custom_field_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_admission_number UNIQUE (tenant_id, admission_number)
);

CREATE INDEX IF NOT EXISTS idx_students_tenant ON students(tenant_id, batch_id, status);

-- Junction: Enrolled Subjects per Student
CREATE TABLE IF NOT EXISTS student_enrolled_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  CONSTRAINT uq_student_subject UNIQUE (student_id, subject_id)
);

-- =============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES ON ALL ACADEMIC & SIS TABLES
-- =============================================================================

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs FORCE ROW LEVEL SECURITY;

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects FORCE ROW LEVEL SECURITY;

ALTER TABLE subject_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_groups FORCE ROW LEVEL SECURITY;

ALTER TABLE subject_group_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_group_items FORCE ROW LEVEL SECURITY;

ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches FORCE ROW LEVEL SECURITY;

ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions FORCE ROW LEVEL SECURITY;

ALTER TABLE student_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_inquiries FORCE ROW LEVEL SECURITY;

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE students FORCE ROW LEVEL SECURITY;

ALTER TABLE student_enrolled_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrolled_subjects FORCE ROW LEVEL SECURITY;

-- Dynamic Policy Generator
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT unnest(ARRAY[
      'programs', 
      'subjects', 
      'subject_groups', 
      'subject_group_items', 
      'batches', 
      'custom_field_definitions', 
      'student_inquiries', 
      'students', 
      'student_enrolled_subjects'
    ])
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS %I ON %I;
      CREATE POLICY %I ON %I
        FOR ALL
        USING (
          tenant_id = get_current_tenant_id() 
          OR current_setting(''app.is_super_admin'', true) = ''true''
        )
        WITH CHECK (
          tenant_id = get_current_tenant_id() 
          OR current_setting(''app.is_super_admin'', true) = ''true''
        );
    ', tbl || '_isolation_policy', tbl, tbl || '_isolation_policy', tbl);
  END LOOP;
END
$$;

-- Grant permissions to authenticated application role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- =============================================================================
-- Migration 00003: Timetable Collision Engine, Attendance, Geofencing & Homework
-- Strictly Enforced Row-Level Security (RLS) for multi-tenant containment
-- =============================================================================

-- 1. PHYSICAL ROOMS (Default: Single-Room Setup; Multi-room activated via tenant config)
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  capacity INT NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_tenant ON rooms(tenant_id);
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms FORCE ROW LEVEL SECURITY;

-- 2. TIMETABLE SLOTS & COLLISION SCHEDULES
CREATE TABLE IF NOT EXISTS timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  subject_id VARCHAR(100) NOT NULL,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  substitute_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timetable_tenant ON timetable_slots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_timetable_batch ON timetable_slots(tenant_id, batch_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON timetable_slots(tenant_id, teacher_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_room ON timetable_slots(tenant_id, room_id, day_of_week);

ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots FORCE ROW LEVEL SECURITY;

-- 3. STUDENT ATTENDANCE (Daily Batch Roster & Period-wise)
CREATE TABLE IF NOT EXISTS student_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  subject_id VARCHAR(100),
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  remarks TEXT,
  check_in_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_attendance_record 
  ON student_attendance(tenant_id, student_id, batch_id, date, COALESCE(subject_id, 'ALL'));
CREATE INDEX IF NOT EXISTS idx_student_att_date ON student_attendance(tenant_id, batch_id, date);

ALTER TABLE student_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_attendance FORCE ROW LEVEL SECURITY;

-- 4. LEAVE APPLICATIONS (Student & Parent requests with auto-excuse)
CREATE TABLE IF NOT EXISTS leave_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('medical', 'personal', 'emergency')),
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_tenant_student ON leave_applications(tenant_id, student_id);

ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_applications FORCE ROW LEVEL SECURITY;

-- 5. CAMPUS GEOFENCE CONFIGURATION
CREATE TABLE IF NOT EXISTS campus_geofence_configs (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  campus_name VARCHAR(150) NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  radius_meters INT NOT NULL DEFAULT 100,
  shift_start_time TIME NOT NULL DEFAULT '08:00:00',
  grace_period_minutes INT NOT NULL DEFAULT 15,
  multi_room_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE campus_geofence_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_geofence_configs FORCE ROW LEVEL SECURITY;

-- 6. STAFF ATTENDANCE WITH GEOFENCING & HAVERSINE VERIFICATION
CREATE TABLE IF NOT EXISTS staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in_time TIMESTAMPTZ NOT NULL,
  clock_out_time TIMESTAMPTZ,
  clock_in_lat NUMERIC(10, 7) NOT NULL,
  clock_in_lng NUMERIC(10, 7) NOT NULL,
  distance_meters NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('on_time', 'late', 'absent', 'on_leave')),
  is_geofence_verified BOOLEAN NOT NULL DEFAULT true,
  admin_adjusted BOOLEAN NOT NULL DEFAULT false,
  admin_adjustment_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_attendance_day ON staff_attendance(tenant_id, staff_id, date);

ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_attendance FORCE ROW LEVEL SECURITY;

-- 7. HOMEWORK ASSIGNMENTS & DIGITAL DIARY
CREATE TABLE IF NOT EXISTS homework_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  subject_id VARCHAR(100) NOT NULL,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_homework_batch ON homework_assignments(tenant_id, batch_id);

ALTER TABLE homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_assignments FORCE ROW LEVEL SECURITY;

-- 8. IN-CLASS PHYSICAL NOTEBOOK CHECKING ROSTER
CREATE TABLE IF NOT EXISTS notebook_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('done', 'incomplete', 'missing')),
  remarks TEXT,
  checked_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notebook_check_student ON notebook_checks(tenant_id, assignment_id, student_id);

ALTER TABLE notebook_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_checks FORCE ROW LEVEL SECURITY;

-- 9. COMPLAINT & FEEDBACK TICKETS
CREATE TABLE IF NOT EXISTS complaint_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL CHECK (category IN ('teaching_quality', 'facility', 'fee_billing', 'disciplinary', 'general')),
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal')),
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_investigation', 'action_taken', 'resolved')),
  internal_notes TEXT,
  resolution_reply TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaint_tenant_status ON complaint_tickets(tenant_id, status);

ALTER TABLE complaint_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_tickets FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- APPLY POLICIES LOOP
-- =============================================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'rooms',
      'timetable_slots',
      'student_attendance',
      'leave_applications',
      'campus_geofence_configs',
      'staff_attendance',
      'homework_assignments',
      'notebook_checks',
      'complaint_tickets'
    ])
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS %I ON %I;
      CREATE POLICY %I ON %I
        FOR ALL
        USING (
          tenant_id = get_current_tenant_id() 
          OR current_setting(''app.is_super_admin'', true) = ''true''
        )
        WITH CHECK (
          tenant_id = get_current_tenant_id() 
          OR current_setting(''app.is_super_admin'', true) = ''true''
        );
    ', tbl || '_isolation_policy', tbl, tbl || '_isolation_policy', tbl);
  END LOOP;
END
$$;

-- Grant permissions to authenticated application role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- =============================================================================
-- Migration 00004: Multi-Head Invoicing, Priority Auto-Distribution, Vouchers & Payroll
-- Strictly Enforced Row-Level Security (RLS) for multi-tenant containment
-- =============================================================================

-- 1. FEE HEADS (Zero hardcoding: Tuition, Arrears, Annual, Exam, Lab, etc.)
CREATE TABLE IF NOT EXISTS fee_heads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  is_system_default BOOLEAN NOT NULL DEFAULT false,
  default_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  priority_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_heads_tenant ON fee_heads(tenant_id);
ALTER TABLE fee_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_heads FORCE ROW LEVEL SECURITY;

-- 2. FEE PRIORITY CONFIGURATION (Academy drag-and-drop liquidation rule)
CREATE TABLE IF NOT EXISTS fee_priority_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  priority_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_priority_tenant ON fee_priority_configs(tenant_id);
ALTER TABLE fee_priority_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_priority_configs FORCE ROW LEVEL SECURITY;

-- 3. STUDENT & BATCH FEE STRUCTURES (Class default with student overrides)
CREATE TABLE IF NOT EXISTS fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  academic_session VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_structures_tenant ON fee_structures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_batch ON fee_structures(tenant_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_student ON fee_structures(tenant_id, student_id);
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures FORCE ROW LEVEL SECURITY;

-- 4. STUDENT INVOICES / CHALLANS (Multi-Head Itemized Invoices)
CREATE TABLE IF NOT EXISTS student_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_name VARCHAR(150) NOT NULL,
  roll_number VARCHAR(50) NOT NULL,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  batch_name VARCHAR(150) NOT NULL,
  billing_month VARCHAR(50) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  balance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(30) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'voided')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_month ON student_invoices(tenant_id, billing_month);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON student_invoices(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON student_invoices(tenant_id, status);
ALTER TABLE student_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_invoices FORCE ROW LEVEL SECURITY;

-- 5. INVOICE ITEMS (Itemized breakdown per fee head)
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES student_invoices(id) ON DELETE CASCADE,
  fee_head_id UUID NOT NULL REFERENCES fee_heads(id) ON DELETE RESTRICT,
  head_name VARCHAR(100) NOT NULL,
  head_code VARCHAR(50) NOT NULL,
  original_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_items_tenant_inv ON invoice_items(tenant_id, invoice_id);
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items FORCE ROW LEVEL SECURITY;

-- 6. FEE PAYMENTS & RECEIPTS (Allocations & Cashier Review Overrides)
CREATE TABLE IF NOT EXISTS fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  receipt_number VARCHAR(100) NOT NULL,
  invoice_id UUID NOT NULL REFERENCES student_invoices(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_name VARCHAR(150) NOT NULL,
  roll_number VARCHAR(50) NOT NULL,
  payment_date DATE NOT NULL,
  amount_paid NUMERIC(12, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'wallet')),
  reference_number VARCHAR(100),
  is_override BOOLEAN NOT NULL DEFAULT false,
  override_reason TEXT,
  allocations JSONB NOT NULL DEFAULT '[]'::jsonb,
  collected_by VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_date ON fee_payments(tenant_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_student ON fee_payments(tenant_id, student_id);
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments FORCE ROW LEVEL SECURITY;

-- 7. FEE DISCOUNTS & CONCESSIONS (Mandatory approval audit tracking)
CREATE TABLE IF NOT EXISTS fee_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_name VARCHAR(150) NOT NULL,
  roll_number VARCHAR(50) NOT NULL,
  invoice_id UUID REFERENCES student_invoices(id) ON DELETE SET NULL,
  fee_head_id UUID REFERENCES fee_heads(id) ON DELETE SET NULL,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('flat', 'percentage')),
  discount_value NUMERIC(12, 2) NOT NULL,
  actual_discount_amount NUMERIC(12, 2) NOT NULL,
  mandatory_reason TEXT NOT NULL,
  approved_by VARCHAR(150) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discounts_tenant_student ON fee_discounts(tenant_id, student_id);
ALTER TABLE fee_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_discounts FORCE ROW LEVEL SECURITY;

-- 8. STAFF SALARY PROFILES (Fixed Monthly vs Per-Lecture)
CREATE TABLE IF NOT EXISTS staff_salary_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_name VARCHAR(150) NOT NULL,
  designation VARCHAR(100) NOT NULL,
  contract_type VARCHAR(50) NOT NULL CHECK (contract_type IN ('fixed_monthly', 'per_lecture')),
  base_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_profiles_staff ON staff_salary_profiles(tenant_id, staff_id);
ALTER TABLE staff_salary_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_salary_profiles FORCE ROW LEVEL SECURITY;

-- 9. STAFF PAYSLIPS (Interactive Month-End Payroll Calculations)
CREATE TABLE IF NOT EXISTS staff_payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slip_number VARCHAR(100) NOT NULL,
  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_name VARCHAR(150) NOT NULL,
  designation VARCHAR(100) NOT NULL,
  payroll_month VARCHAR(50) NOT NULL,
  base_salary NUMERIC(12, 2) NOT NULL,
  attendance_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  earnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  deductions JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_earnings NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processed', 'paid')),
  payment_date DATE,
  payment_method VARCHAR(50) CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'wallet')),
  transaction_reference VARCHAR(100),
  admin_notes TEXT,
  processed_by VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payslips_tenant_month ON staff_payslips(tenant_id, payroll_month);
CREATE INDEX IF NOT EXISTS idx_payslips_staff ON staff_payslips(tenant_id, staff_id);
ALTER TABLE staff_payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_payslips FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- APPLY MULTI-TENANT ISOLATION POLICIES LOOP
-- =============================================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'fee_heads',
      'fee_priority_configs',
      'fee_structures',
      'student_invoices',
      'invoice_items',
      'fee_payments',
      'fee_discounts',
      'staff_salary_profiles',
      'staff_payslips'
    ])
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS %I ON %I;
      CREATE POLICY %I ON %I
        FOR ALL
        USING (
          tenant_id = get_current_tenant_id() 
          OR current_setting(''app.is_super_admin'', true) = ''true''
        )
        WITH CHECK (
          tenant_id = get_current_tenant_id() 
          OR current_setting(''app.is_super_admin'', true) = ''true''
        );
    ', tbl || '_isolation_policy', tbl, tbl || '_isolation_policy', tbl);
  END LOOP;
END
$$;

-- Grant permissions to authenticated application role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- ==============================================================================
-- Migration: 00005_examination_question_bank.sql
-- Description: Phase 5 - Question Bank, Excel Chapter Upload, Simple Exam Setup &
--              Hybrid Grading with Auto-MCQs & Question-Level Remarks
-- ==============================================================================

-- 1. Question Chapters (Hierarchical tree: Class -> Subject -> Chapter)
CREATE TABLE IF NOT EXISTS question_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  chapter_number INT NOT NULL,
  chapter_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, subject_id, chapter_number)
);

CREATE INDEX IF NOT EXISTS idx_question_chapters_tenant ON question_chapters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_question_chapters_subject ON question_chapters(tenant_id, subject_id);

-- 2. Bank Questions (Dual Mode: Permanent Master Bank vs Fast Ad-Hoc Quiz)
CREATE TABLE IF NOT EXISTS bank_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES question_chapters(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('MCQ', 'SHORT', 'LONG')),
  question_text TEXT NOT NULL,
  marks NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  options JSONB DEFAULT '[]'::jsonb, -- Array of { "key": "A", "text": "..." }
  correct_option TEXT,               -- 'A', 'B', 'C', 'D' for MCQs
  rubric_guide TEXT,
  difficulty_level TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (difficulty_level IN ('EASY', 'MEDIUM', 'HARD')),
  is_quiz_bank BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_questions_tenant ON bank_questions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bank_questions_chapter ON bank_questions(tenant_id, chapter_id);
CREATE INDEX IF NOT EXISTS idx_bank_questions_type ON bank_questions(tenant_id, question_type);

-- 3. Exams Master
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  exam_date DATE NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  total_marks NUMERIC(6,2) NOT NULL,
  mcq_count INT NOT NULL DEFAULT 0,
  mcq_marks_per_q NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  mcq_total_marks NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  short_total_marks NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  long_total_marks NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  section_labels JSONB DEFAULT '{"mcq": "Q.1 (Objective MCQs)", "short": "Q.2 (Short Questions)", "long": "Q.3 (Long Questions)"}'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'COMPLETED', 'GRADED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exams_tenant ON exams(tenant_id);
CREATE INDEX IF NOT EXISTS idx_exams_batch ON exams(tenant_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_exams_subject ON exams(tenant_id, subject_id);

-- 4. Exam Questions (Linked questions in the test paper)
CREATE TABLE IF NOT EXISTS exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id UUID REFERENCES bank_questions(id) ON DELETE SET NULL,
  section_type TEXT NOT NULL CHECK (section_type IN ('MCQ', 'SHORT', 'LONG')),
  display_order INT NOT NULL,
  question_text TEXT NOT NULL,
  marks NUMERIC(5,2) NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,
  correct_option TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_questions_tenant ON exam_questions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(tenant_id, exam_id);

-- 5. Student Exam Evaluations (Hybrid: Instant MCQ grading + Short/Long with remarks)
CREATE TABLE IF NOT EXISTS student_exam_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  mcq_answers JSONB DEFAULT '{}'::jsonb,
  mcq_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  short_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  short_remarks TEXT,
  long_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  long_remarks TEXT,
  total_obtained NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  grade TEXT NOT NULL DEFAULT 'F',
  status TEXT NOT NULL DEFAULT 'GRADED' CHECK (status IN ('ABSENT', 'IN_PROGRESS', 'GRADED')),
  evaluated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, exam_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_evaluations_tenant ON student_exam_evaluations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_evaluations_exam ON student_exam_evaluations(tenant_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_student_evaluations_student ON student_exam_evaluations(tenant_id, student_id);

-- Enable RLS and force isolation across all Phase 5 tables
ALTER TABLE question_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_chapters FORCE ROW LEVEL SECURITY;

ALTER TABLE bank_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_questions FORCE ROW LEVEL SECURITY;

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams FORCE ROW LEVEL SECURITY;

ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions FORCE ROW LEVEL SECURITY;

ALTER TABLE student_exam_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_exam_evaluations FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'question_chapters',
      'bank_questions',
      'exams',
      'exam_questions',
      'student_exam_evaluations'
    ])
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS %I ON %I;
      CREATE POLICY %I ON %I
        FOR ALL
        USING (
          tenant_id = get_current_tenant_id() 
          OR current_setting(''app.is_super_admin'', true) = ''true''
        )
        WITH CHECK (
          tenant_id = get_current_tenant_id() 
          OR current_setting(''app.is_super_admin'', true) = ''true''
        );
    ', tbl || '_isolation_policy', tbl, tbl || '_isolation_policy', tbl);
  END LOOP;
END
$$;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- ==============================================================================
-- Migration: 00006_whatsapp_absentee_retention.sql
-- Description: Phase 6 - WhatsApp Direct Messaging Engine with Dynamic Tags,
--              Rapid Queue, Daily Morning Absentee Follow-Up & Retention Desk
-- ==============================================================================

-- 1. WhatsApp Templates Master
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ABSENCE', 'FEE_REMINDER', 'EXAM_RESULT', 'GENERAL')),
  body TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_tenant ON whatsapp_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_category ON whatsapp_templates(tenant_id, category);

-- 2. WhatsApp Audit Logs (Zero duplicate warnings & dispatch logs)
CREATE TABLE IF NOT EXISTS whatsapp_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  recipient_phone TEXT NOT NULL,
  phone_type TEXT NOT NULL DEFAULT 'PRIMARY' CHECK (phone_type IN ('PRIMARY', 'BACKUP')),
  template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPENED' CHECK (status IN ('OPENED', 'SENT', 'FAILED')),
  dispatched_by UUID REFERENCES users(id) ON DELETE SET NULL,
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_audit_tenant ON whatsapp_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_audit_student ON whatsapp_audit_logs(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_audit_dispatched ON whatsapp_audit_logs(tenant_id, dispatched_at);

-- 3. Absentee Follow-Ups (Daily morning front-desk call roster)
CREATE TABLE IF NOT EXISTS absentee_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  consecutive_days INT NOT NULL DEFAULT 1,
  call_outcome TEXT CHECK (call_outcome IN ('CONNECTED', 'NO_ANSWER', 'SWITCHED_OFF', 'WHATSAPP_SENT')),
  reason_category TEXT CHECK (reason_category IN ('MEDICAL', 'EMERGENCY', 'TRANSPORT', 'FEE_DISPUTE', 'TRUANCY', 'OTHER')),
  parent_remarks TEXT,
  expected_return_date DATE,
  is_snoozed BOOLEAN NOT NULL DEFAULT false,
  snooze_until DATE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONTACTED', 'UNREACHABLE', 'RESOLVED_EXCUSED')),
  staff_counselor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_absentee_followups_tenant ON absentee_followups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_absentee_followups_date ON absentee_followups(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_absentee_followups_student ON absentee_followups(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_absentee_followups_status ON absentee_followups(tenant_id, status);

-- 4. Retention & Chronic Dropout Counseling Cases
CREATE TABLE IF NOT EXISTS retention_counseling_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  monthly_attendance_pct NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  consecutive_absences INT NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'MODERATE' CHECK (risk_level IN ('MODERATE', 'HIGH', 'CRITICAL')),
  scheduled_meeting_date TIMESTAMPTZ,
  counseling_notes TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'SCHEDULED', 'RESOLVED', 'DROPPED_OUT')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retention_cases_tenant ON retention_counseling_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_retention_cases_student ON retention_counseling_cases(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_retention_cases_risk ON retention_counseling_cases(tenant_id, risk_level);

-- Enable RLS and force isolation across all Phase 6 tables
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates FORCE ROW LEVEL SECURITY;

ALTER TABLE whatsapp_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_audit_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE absentee_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE absentee_followups FORCE ROW LEVEL SECURITY;

ALTER TABLE retention_counseling_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_counseling_cases FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'whatsapp_templates',
      'whatsapp_audit_logs',
      'absentee_followups',
      'retention_counseling_cases'
    ])
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS %I ON %I;
      CREATE POLICY %I ON %I
        FOR ALL
        USING (
          tenant_id = get_current_tenant_id() 
          OR current_setting(''app.is_super_admin'', true) = ''true''
        )
        WITH CHECK (
          tenant_id = get_current_tenant_id() 
          OR current_setting(''app.is_super_admin'', true) = ''true''
        );
    ', tbl || '_isolation_policy', tbl, tbl || '_isolation_policy', tbl);
  END LOOP;
END
$$;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00007: SAAS BILLING & TRIAL LOCKOUT
-- =============================================================================

-- 1. Global Platform Banking Configuration (Super-Admin Managed)
CREATE TABLE IF NOT EXISTS platform_banking_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name VARCHAR(255) NOT NULL,
  account_title VARCHAR(255) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  iban VARCHAR(100),
  branch_code VARCHAR(50),
  whatsapp_support VARCHAR(50),
  support_email VARCHAR(255),
  monthly_subscription_fee NUMERIC(12, 2) NOT NULL DEFAULT 15000.00,
  instructions TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default banking configuration if none exists
INSERT INTO platform_banking_config (
  id,
  bank_name,
  account_title,
  account_number,
  iban,
  branch_code,
  whatsapp_support,
  support_email,
  monthly_subscription_fee,
  instructions
) VALUES (
  'b1000000-0000-0000-0000-000000000001',
  'Bank Alfalah Limited',
  'Apex ERP SaaS Technologies Pvt Ltd',
  '0123-1005678901',
  'PK36ALFH01231005678901',
  '0123 - Gulberg Main Boulevard',
  '+923001234567',
  'billing@apexacademyerp.com',
  15000.00,
  'Please transfer your subscription fee via online banking / Raast / ATM and upload the screenshot with transaction reference number for immediate automated activation.'
) ON CONFLICT (id) DO NOTHING;

-- 2. Multi-Tenant Subscription Payment Proof Receipts
CREATE TABLE IF NOT EXISTS subscription_payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  plan_duration_months INT NOT NULL DEFAULT 1,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'BANK_TRANSFER',
  reference_number VARCHAR(100),
  receipt_image_url TEXT,
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by_email VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_receipts_tenant ON subscription_payment_receipts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_receipts_status ON subscription_payment_receipts(status, created_at DESC);

-- Enable RLS
ALTER TABLE subscription_payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payment_receipts FORCE ROW LEVEL SECURITY;

-- Multi-Tenant Isolation Policy for Subscription Receipts
DROP POLICY IF EXISTS subscription_receipts_isolation_policy ON subscription_payment_receipts;
CREATE POLICY subscription_receipts_isolation_policy ON subscription_payment_receipts
  FOR ALL
  USING (
    tenant_id = get_current_tenant_id()
    OR current_setting('app.is_super_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id = get_current_tenant_id()
    OR current_setting('app.is_super_admin', true) = 'true'
  );

-- =============================================================================
-- MIGRATION 00008: SUPERADMIN PLATFORM CONTROLS, ALIASES & POPUPS
-- =============================================================================

-- 1. Tenant Suspension & Audit Columns
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- 2. Platform Banking & Global Config Extensions
ALTER TABLE platform_banking_config ADD COLUMN IF NOT EXISTS default_trial_days INT NOT NULL DEFAULT 30;
ALTER TABLE platform_banking_config ADD COLUMN IF NOT EXISTS grace_period_days INT NOT NULL DEFAULT 5;

-- 3. Tenant Subdomain & Slug Aliases (Permanent 301 Ingestion)
CREATE TABLE IF NOT EXISTS tenant_slug_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_slug VARCHAR(100) NOT NULL UNIQUE,
  target_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_slug_aliases_original ON tenant_slug_aliases(original_slug);
CREATE INDEX IF NOT EXISTS idx_tenant_slug_aliases_target ON tenant_slug_aliases(target_tenant_id);

ALTER TABLE tenant_slug_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_slug_aliases FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_slug_aliases_isolation_policy ON tenant_slug_aliases;
CREATE POLICY tenant_slug_aliases_isolation_policy ON tenant_slug_aliases
  FOR ALL
  USING (
    target_tenant_id = get_current_tenant_id()
    OR current_setting('app.is_super_admin', true) = 'true'
  )
  WITH CHECK (
    target_tenant_id = get_current_tenant_id()
    OR current_setting('app.is_super_admin', true) = 'true'
  );

-- 4. Global & Academy-Targeted Broadcast Announcements
CREATE TABLE IF NOT EXISTS platform_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'custom' CHECK (type IN ('billing', 'grace_period', 'system', 'custom', 'urgent', 'warning', 'maintenance')),
  frequency VARCHAR(50) NOT NULL DEFAULT 'once_dismissible' CHECK (frequency IN ('every_login', 'once_dismissible')),
  target_audience VARCHAR(50) NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'admin_only', 'trial_expiring', 'grace_period', 'specific_academy')),
  target_tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  action_label VARCHAR(100),
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_announcements_active ON platform_announcements(is_active, created_at DESC);

ALTER TABLE platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_announcements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_announcements_read_policy ON platform_announcements;
CREATE POLICY platform_announcements_read_policy ON platform_announcements
  FOR SELECT
  USING (
    is_active = true
    OR current_setting('app.is_super_admin', true) = 'true'
  );

DROP POLICY IF EXISTS platform_announcements_write_policy ON platform_announcements;
CREATE POLICY platform_announcements_write_policy ON platform_announcements
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
  );

-- 5. User Announcement Read Receipts
CREATE TABLE IF NOT EXISTS platform_announcement_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES platform_announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_announcement UNIQUE(user_id, announcement_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_receipts_user ON platform_announcement_receipts(user_id, announcement_id);

ALTER TABLE platform_announcement_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_announcement_receipts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcement_receipts_isolation_policy ON platform_announcement_receipts;
CREATE POLICY announcement_receipts_isolation_policy ON platform_announcement_receipts
  FOR ALL
  USING (
    tenant_id = get_current_tenant_id()
    OR current_setting('app.is_super_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id = get_current_tenant_id()
    OR current_setting('app.is_super_admin', true) = 'true'
  );

-- Grant permissions to authenticated role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00009: INDIVIDUAL ACADEMY CONTROLS
-- =============================================================================
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'trial', 'grace_period', 'locked', 'suspended', 'archived', 'pending_verification'));
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_monthly_fee NUMERIC(12, 2);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS individual_grace_period_days INT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_cycle_anchor_day INT DEFAULT 1;
