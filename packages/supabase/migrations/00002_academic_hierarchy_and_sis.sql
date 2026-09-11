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
    CHECK (status IN ('active', 'on_leave', 'suspended', 'alumni', 'withdrawn', 'waitlisted')),
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
