-- Migration: 00013_student_guardian_email_and_identity.sql
-- Description: Add guardian_email and enhance student identity linking and photo support

ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_email VARCHAR(255);
ALTER TABLE students ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10);
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_relation VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_students_guardian_email ON students(tenant_id, guardian_email);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(tenant_id, user_id);
