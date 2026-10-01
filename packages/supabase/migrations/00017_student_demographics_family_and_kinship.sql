-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00016
-- Student Demographics, Dual Parent/Family Particulars, & Kinship Linkage
-- =============================================================================

ALTER TABLE students 
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
  ADD COLUMN IF NOT EXISTS student_b_form VARCHAR(50),
  ADD COLUMN IF NOT EXISTS residential_address TEXT,
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS father_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS father_cnic VARCHAR(50),
  ADD COLUMN IF NOT EXISTS father_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS father_occupation VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mother_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mother_cnic VARCHAR(50),
  ADD COLUMN IF NOT EXISTS mother_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS mother_occupation VARCHAR(100),
  ADD COLUMN IF NOT EXISTS primary_contact VARCHAR(20) DEFAULT 'father',
  ADD COLUMN IF NOT EXISTS sibling_student_id UUID REFERENCES students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_sibling ON students(tenant_id, sibling_student_id);
CREATE INDEX IF NOT EXISTS idx_students_b_form ON students(tenant_id, student_b_form);
CREATE INDEX IF NOT EXISTS idx_students_father_cnic ON students(tenant_id, father_cnic);
