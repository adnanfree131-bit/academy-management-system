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
