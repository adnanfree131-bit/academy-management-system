-- Migration: 00014_guardian_id_card_and_audit.sql
-- Description: Add guardian_id_card (CNIC) and student_profile_audit_logs

ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_id_card VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_students_guardian_id_card ON students(tenant_id, guardian_id_card);

ALTER TABLE student_inquiries ADD COLUMN IF NOT EXISTS guardian_id_card VARCHAR(30);

CREATE TABLE IF NOT EXISTS student_profile_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  changed_by_user_id UUID NOT NULL REFERENCES users(id),
  changed_by_name VARCHAR(255) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_audit_student ON student_profile_audit_logs(tenant_id, student_id);
