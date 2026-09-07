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
