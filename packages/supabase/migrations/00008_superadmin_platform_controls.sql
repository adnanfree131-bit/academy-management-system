-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00008: SUPERADMIN PLATFORM CONTROLS
-- =============================================================================

-- 1. Tenant Suspension & Audit Columns
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- 2. Platform Banking & Global Config Extensions
ALTER TABLE platform_banking_config ADD COLUMN IF NOT EXISTS default_trial_days INT NOT NULL DEFAULT 30;
ALTER TABLE platform_banking_config ADD COLUMN IF NOT EXISTS grace_period_days INT NOT NULL DEFAULT 5;

-- 3. Tenant Subdomain & Slug Aliases (Permanent 301 Ingestion)
CREATE TABLE IF NOT EXISTS tenant_slug_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_slug VARCHAR(100) NOT NULL UNIQUE,
  target_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_slug_aliases_original ON tenant_slug_aliases(original_slug);
CREATE INDEX IF NOT EXISTS idx_tenant_slug_aliases_target ON tenant_slug_aliases(target_tenant_id);

ALTER TABLE tenant_slug_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_slug_aliases FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_slug_aliases_isolation_policy ON tenant_slug_aliases;
CREATE POLICY tenant_slug_aliases_isolation_policy ON tenant_slug_aliases
  FOR ALL
  USING (
    target_tenant_id = get_current_tenant_id()
    OR current_setting('app.is_super_admin', true) = 'true'
  )
  WITH CHECK (
    target_tenant_id = get_current_tenant_id()
    OR current_setting('app.is_super_admin', true) = 'true'
  );

-- 4. Global & Academy-Targeted Broadcast Announcements
CREATE TABLE IF NOT EXISTS platform_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'custom' CHECK (type IN ('billing', 'grace_period', 'system', 'custom', 'urgent', 'warning', 'maintenance')),
  frequency VARCHAR(50) NOT NULL DEFAULT 'once_dismissible' CHECK (frequency IN ('every_login', 'once_dismissible')),
  target_audience VARCHAR(50) NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'admin_only', 'trial_expiring', 'grace_period', 'specific_academy')),
  target_tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  action_label VARCHAR(100),
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_announcements_active ON platform_announcements(is_active, created_at DESC);

ALTER TABLE platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_announcements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_announcements_read_policy ON platform_announcements;
CREATE POLICY platform_announcements_read_policy ON platform_announcements
  FOR SELECT
  USING (
    is_active = true
    OR current_setting('app.is_super_admin', true) = 'true'
  );

DROP POLICY IF EXISTS platform_announcements_write_policy ON platform_announcements;
CREATE POLICY platform_announcements_write_policy ON platform_announcements
  FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
  );

-- 5. User Announcement Read Receipts
CREATE TABLE IF NOT EXISTS platform_announcement_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES platform_announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_announcement UNIQUE(user_id, announcement_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_receipts_user ON platform_announcement_receipts(user_id, announcement_id);

ALTER TABLE platform_announcement_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_announcement_receipts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcement_receipts_isolation_policy ON platform_announcement_receipts;
CREATE POLICY announcement_receipts_isolation_policy ON platform_announcement_receipts
  FOR ALL
  USING (
    tenant_id = get_current_tenant_id()
    OR current_setting('app.is_super_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id = get_current_tenant_id()
    OR current_setting('app.is_super_admin', true) = 'true'
  );

-- Grant permissions to authenticated role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
