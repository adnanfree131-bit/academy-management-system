-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00017
-- Student Previous School, Religion, & Dynamic Submitted Documents Checklist
-- =============================================================================

ALTER TABLE students 
  ADD COLUMN IF NOT EXISTS previous_school VARCHAR(255),
  ADD COLUMN IF NOT EXISTS religion VARCHAR(50),
  ADD COLUMN IF NOT EXISTS submitted_documents JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_students_religion ON students(tenant_id, religion);
