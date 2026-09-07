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
