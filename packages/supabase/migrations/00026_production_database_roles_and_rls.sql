-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00026: PRODUCTION DATABASE ROLES & RLS
-- =============================================================================

-- 1. Restricted Fastify Database Role & Least Privilege Grants
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fastify_runtime') THEN
    CREATE ROLE fastify_runtime WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

ALTER ROLE fastify_runtime NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO fastify_runtime, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fastify_runtime, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fastify_runtime, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO fastify_runtime, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fastify_runtime, authenticated;

DO $$
BEGIN
  GRANT USAGE ON SCHEMA auth TO fastify_runtime, authenticated;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO fastify_runtime, authenticated;
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END $$;

-- Grant role membership so fastify_runtime can execute SET LOCAL ROLE authenticated inside transactions
GRANT authenticated TO fastify_runtime;

-- 2. Audit Logs: Append-Only (no UPDATE/DELETE for authenticated; INSERT gated by RLS)
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO fastify_runtime;

-- 3. Database Triggers for Privilege Escalation & Invariant Protection

-- 3.1 Protect platform roles from user-controlled profile updates
CREATE OR REPLACE FUNCTION public.prevent_platform_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.platform_role IS DISTINCT FROM NEW.platform_role) THEN
    -- Bypass for privileged database roles (migrations, seeds, admin scripts)
    IF CURRENT_USER NOT IN ('postgres', 'supabase_admin')
       AND (current_setting('app.is_super_admin', true) IS DISTINCT FROM 'true')
       AND NOT public.is_platform_super_admin() THEN
      RAISE EXCEPTION 'FORBIDDEN_ROLE_CHANGE: Modifying platform_role requires platform super_admin authorization.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_platform_role_escalation ON public.profiles;
DROP TRIGGER IF EXISTS trg_protect_platform_role ON public.profiles;
CREATE TRIGGER trg_prevent_platform_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_platform_role_escalation();

-- 3.2 Prevent Self-Role Promotion or Unauthorized Role Changes in tenant_memberships
CREATE OR REPLACE FUNCTION public.prevent_membership_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.role IS DISTINCT FROM NEW.role) THEN
    -- Bypass for privileged database roles (migrations, seeds, admin scripts)
    IF CURRENT_USER IN ('postgres', 'supabase_admin') THEN
      RETURN NEW;
    END IF;

    IF (current_setting('app.is_super_admin', true) = 'true') OR public.is_platform_super_admin() THEN
      RETURN NEW;
    END IF;

    IF NOT public.is_active_tenant_admin(OLD.tenant_id) THEN
      RAISE EXCEPTION 'FORBIDDEN_ROLE_PROMOTION: Only tenant administrators or platform super_admin can modify membership roles'
        USING ERRCODE = '42501';
    END IF;

    -- Prevent self-promotion: A user cannot change their own role unless they already held admin/owner
    IF OLD.auth_user_id = public.get_current_auth_user_id() THEN
      IF OLD.role NOT IN ('tenant_admin', 'owner') THEN
        RAISE EXCEPTION 'FORBIDDEN_SELF_PROMOTION: Members cannot promote their own role'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_membership_role_escalation ON public.tenant_memberships;
CREATE TRIGGER trg_prevent_membership_role_escalation
  BEFORE UPDATE ON public.tenant_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_membership_role_escalation();

-- 3.3 Prevent Unauthorized Tenant Ownership or Tier Modifications
CREATE OR REPLACE FUNCTION public.prevent_tenant_tampering()
RETURNS TRIGGER AS $$
BEGIN
  -- Bypass for privileged database roles (migrations, seeds, admin scripts)
  IF CURRENT_USER IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF (current_setting('app.is_super_admin', true) = 'true') OR public.is_platform_super_admin() THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_active_tenant_admin(OLD.id) THEN
    RAISE EXCEPTION 'UNAUTHORIZED_TENANT_MUTATION: Only tenant administrators can modify academy settings'
      USING ERRCODE = '42501';
  END IF;

  IF (NEW.tier <> OLD.tier OR NEW.status <> OLD.status OR NEW.max_students <> OLD.max_students OR NEW.max_staff <> OLD.max_staff) THEN
    RAISE EXCEPTION 'UNAUTHORIZED_TIER_MUTATION: Platform tier and status can only be modified by platform super_admin'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_tenant_tampering ON public.tenants;
CREATE TRIGGER trg_prevent_tenant_tampering
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_tenant_tampering();

-- 4. Refined Row-Level Security (RLS) Policies

-- 4.1 Profiles RLS: Users can only select their own profile; super admin can select all
DROP POLICY IF EXISTS profiles_isolation_policy ON public.profiles;
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_policy ON public.profiles;
DROP POLICY IF EXISTS profiles_update_policy ON public.profiles;

CREATE POLICY profiles_select_policy ON public.profiles
  FOR SELECT
  USING (
    id = public.get_current_auth_user_id()
    OR (
      CURRENT_USER LIKE 'fastify_runtime%'
    )
    OR public.is_platform_super_admin()
  );

CREATE POLICY profiles_insert_policy ON public.profiles
  FOR INSERT
  WITH CHECK (
    id = public.get_current_auth_user_id()
    OR public.is_platform_super_admin()
  );

CREATE POLICY profiles_update_policy ON public.profiles
  FOR UPDATE
  USING (
    id = public.get_current_auth_user_id()
    OR public.is_platform_super_admin()
  )
  WITH CHECK (
    id = public.get_current_auth_user_id()
    OR public.is_platform_super_admin()
  );

-- 4.2 Tenants RLS: Active members read, tenant admins update settings, only super admin deletes
DROP POLICY IF EXISTS tenant_isolation_policy ON public.tenants;
DROP POLICY IF EXISTS tenant_select_policy ON public.tenants;
DROP POLICY IF EXISTS tenant_insert_policy ON public.tenants;
DROP POLICY IF EXISTS tenant_update_policy ON public.tenants;
DROP POLICY IF EXISTS tenant_delete_policy ON public.tenants;

CREATE POLICY tenant_select_policy ON public.tenants
  FOR SELECT
  USING (
    (
      CURRENT_USER LIKE 'fastify_runtime%'
      AND status = 'active'
    )
    OR (
      id = get_current_tenant_id()
      AND public.is_active_tenant_member(id)
    )
    OR public.is_platform_super_admin()
  );

CREATE POLICY tenant_insert_policy ON public.tenants
  FOR INSERT
  WITH CHECK (
    public.is_platform_super_admin()
  );

CREATE POLICY tenant_update_policy ON public.tenants
  FOR UPDATE
  USING (
    (
      id = get_current_tenant_id()
      AND public.is_active_tenant_admin(id)
    )
    OR public.is_platform_super_admin()
  )
  WITH CHECK (
    (
      id = get_current_tenant_id()
      AND public.is_active_tenant_admin(id)
    )
    OR public.is_platform_super_admin()
  );

CREATE POLICY tenant_delete_policy ON public.tenants
  FOR DELETE
  USING (
    public.is_platform_super_admin()
  );

-- 4.3 Tenant Memberships RLS: Active members read, tenant admins insert/update/delete
DROP POLICY IF EXISTS tenant_memberships_isolation_policy ON public.tenant_memberships;
DROP POLICY IF EXISTS tenant_memberships_select_policy ON public.tenant_memberships;
DROP POLICY IF EXISTS tenant_memberships_insert_policy ON public.tenant_memberships;
DROP POLICY IF EXISTS tenant_memberships_update_policy ON public.tenant_memberships;
DROP POLICY IF EXISTS tenant_memberships_delete_policy ON public.tenant_memberships;

CREATE POLICY tenant_memberships_select_policy ON public.tenant_memberships
  FOR SELECT
  USING (
    (
      tenant_id = get_current_tenant_id()
      AND public.is_active_tenant_member(tenant_id)
    )
    OR public.is_platform_super_admin()
  );

CREATE POLICY tenant_memberships_insert_policy ON public.tenant_memberships
  FOR INSERT
  WITH CHECK (
    (
      tenant_id = get_current_tenant_id()
      AND public.is_active_tenant_admin(tenant_id)
    )
    OR public.is_platform_super_admin()
  );

CREATE POLICY tenant_memberships_update_policy ON public.tenant_memberships
  FOR UPDATE
  USING (
    (
      tenant_id = get_current_tenant_id()
      AND (
        public.is_active_tenant_admin(tenant_id)
        OR auth_user_id = public.get_current_auth_user_id()
      )
    )
    OR public.is_platform_super_admin()
  )
  WITH CHECK (
    (
      tenant_id = get_current_tenant_id()
      AND (
        public.is_active_tenant_admin(tenant_id)
        OR auth_user_id = public.get_current_auth_user_id()
      )
    )
    OR public.is_platform_super_admin()
  );

CREATE POLICY tenant_memberships_delete_policy ON public.tenant_memberships
  FOR DELETE
  USING (
    (
      tenant_id = get_current_tenant_id()
      AND public.is_active_tenant_admin(tenant_id)
    )
    OR public.is_platform_super_admin()
  );

-- 4.4 Audit Logs RLS: Only tenant admins and super admin can read; normal members denied
DROP POLICY IF EXISTS audit_isolation_policy ON public.audit_logs;
DROP POLICY IF EXISTS audit_select_policy ON public.audit_logs;
DROP POLICY IF EXISTS audit_insert_policy ON public.audit_logs;

CREATE POLICY audit_select_policy ON public.audit_logs
  FOR SELECT
  USING (
    (
      tenant_id = get_current_tenant_id()
      AND public.is_active_tenant_admin(tenant_id)
    )
    OR public.is_platform_super_admin()
  );

CREATE POLICY audit_insert_policy ON public.audit_logs
  FOR INSERT
  WITH CHECK (
    (
      tenant_id = get_current_tenant_id()
      AND public.is_active_tenant_member(tenant_id)
    )
    OR public.is_platform_super_admin()
  );
