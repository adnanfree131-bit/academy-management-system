-- Migration 00012: Staff Attendance Audit Trail, Half-Day Status, Heads and Multi-Session Columns

-- 1. Update status CHECK constraint on staff_attendance to include 'half_day'
ALTER TABLE staff_attendance DROP CONSTRAINT IF EXISTS staff_attendance_status_check;
ALTER TABLE staff_attendance ADD CONSTRAINT staff_attendance_status_check 
  CHECK (status IN ('on_time', 'late', 'half_day', 'absent', 'on_leave'));

-- 2. Add modern runtime columns to staff_attendance if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'head_id') THEN
    ALTER TABLE staff_attendance ADD COLUMN head_id VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'head_name') THEN
    ALTER TABLE staff_attendance ADD COLUMN head_name VARCHAR(150);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'head_code') THEN
    ALTER TABLE staff_attendance ADD COLUMN head_code VARCHAR(20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'clock_out_lat') THEN
    ALTER TABLE staff_attendance ADD COLUMN clock_out_lat NUMERIC(10, 7);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'clock_out_lng') THEN
    ALTER TABLE staff_attendance ADD COLUMN clock_out_lng NUMERIC(10, 7);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'work_duration_minutes') THEN
    ALTER TABLE staff_attendance ADD COLUMN work_duration_minutes INT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'verification_mode') THEN
    ALTER TABLE staff_attendance ADD COLUMN verification_mode VARCHAR(50) DEFAULT 'geofence';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'adjusted_by') THEN
    ALTER TABLE staff_attendance ADD COLUMN adjusted_by VARCHAR(150);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_attendance' AND column_name = 'sessions') THEN
    ALTER TABLE staff_attendance ADD COLUMN sessions JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 3. Add dynamic heads configuration and enforcement_mode to campus_geofence_configs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campus_geofence_configs' AND column_name = 'heads') THEN
    ALTER TABLE campus_geofence_configs ADD COLUMN heads JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campus_geofence_configs' AND column_name = 'enforcement_mode') THEN
    ALTER TABLE campus_geofence_configs ADD COLUMN enforcement_mode VARCHAR(20) DEFAULT 'strict';
  END IF;
END $$;

-- 4. Create staff_attendance_audit_logs table with RLS
CREATE TABLE IF NOT EXISTS staff_attendance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  record_id UUID REFERENCES staff_attendance(id) ON DELETE SET NULL,
  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_name VARCHAR(150) NOT NULL,
  date DATE NOT NULL,
  action VARCHAR(50) NOT NULL,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  head_id VARCHAR(100),
  head_name VARCHAR(150),
  previous_clock_in TIMESTAMPTZ,
  new_clock_in TIMESTAMPTZ,
  previous_clock_out TIMESTAMPTZ,
  new_clock_out TIMESTAMPTZ,
  reason_head VARCHAR(255) NOT NULL,
  notes TEXT,
  adjusted_by VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_att_audit_tenant_date ON staff_attendance_audit_logs(tenant_id, staff_id, date);

ALTER TABLE staff_attendance_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_attendance_audit_logs FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'staff_attendance_audit_logs' AND policyname = 'tenant_staff_attendance_audit_logs_isolation'
  ) THEN
    CREATE POLICY tenant_staff_attendance_audit_logs_isolation ON staff_attendance_audit_logs
      FOR ALL
      USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
      WITH CHECK (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
  END IF;
END $$;

-- 5. Create staff_regularization_requests table with RLS
CREATE TABLE IF NOT EXISTS staff_regularization_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_name VARCHAR(150) NOT NULL,
  employee_code VARCHAR(50),
  department VARCHAR(100),
  designation VARCHAR(100),
  date DATE NOT NULL,
  clock_in_time TIMESTAMPTZ,
  clock_out_time TIMESTAMPTZ,
  reason_type VARCHAR(100) NOT NULL,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by VARCHAR(150),
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_reg_req_tenant_staff ON staff_regularization_requests(tenant_id, staff_id, date);

ALTER TABLE staff_regularization_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_regularization_requests FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'staff_regularization_requests' AND policyname = 'tenant_staff_reg_requests_isolation'
  ) THEN
    CREATE POLICY tenant_staff_reg_requests_isolation ON staff_regularization_requests
      FOR ALL
      USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
      WITH CHECK (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
  END IF;
END $$;
