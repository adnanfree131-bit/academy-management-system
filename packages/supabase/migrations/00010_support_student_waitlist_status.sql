-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00010: SUPPORT STUDENT WAITLIST STATUS
-- =============================================================================

-- 1. Support 'waitlisted' in students status constraint
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE students ADD CONSTRAINT students_status_check CHECK (status IN ('active', 'on_leave', 'suspended', 'alumni', 'withdrawn', 'waitlisted'));
