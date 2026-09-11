-- Migration 00011: Fix Platform Announcements Tenant Isolation RLS Leak (FINDING-BUG-05)
-- Ensures non-superadmin tenants cannot read announcements targeted specifically to other tenants.

DROP POLICY IF EXISTS platform_announcements_read_policy ON platform_announcements;
CREATE POLICY platform_announcements_read_policy ON platform_announcements
  FOR SELECT
  USING (
    (is_active = true AND (target_tenant_id IS NULL OR target_tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid))
    OR current_setting('app.is_super_admin', true) = 'true'
  );
