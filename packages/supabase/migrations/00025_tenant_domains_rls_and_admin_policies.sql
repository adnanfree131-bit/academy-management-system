-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00025: TENANT DOMAINS RLS POLICIES
-- =============================================================================

-- Helper: Check if current auth user is an active tenant admin or owner
CREATE OR REPLACE FUNCTION public.is_active_tenant_admin(check_tenant_id UUID) RETURNS BOOLEAN AS $$
DECLARE
  v_auth_id UUID;
BEGIN
  IF public.is_platform_super_admin() THEN
    RETURN TRUE;
  END IF;

  IF check_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  v_auth_id := public.get_current_auth_user_id();
  IF v_auth_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE tenant_id = check_tenant_id
      AND auth_user_id = v_auth_id
      AND role IN ('tenant_admin', 'owner')
      AND status = 'active'
  );
EXCEPTION
  WHEN OTHERS THEN RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- Grant permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_domains TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.domain_provisioning_jobs TO authenticated;

-- Policies for tenant admins on tenant_domains
DROP POLICY IF EXISTS tenant_admin_manage_domains ON public.tenant_domains;
CREATE POLICY tenant_admin_manage_domains ON public.tenant_domains
FOR ALL TO authenticated
USING (public.is_active_tenant_admin(tenant_id))
WITH CHECK (public.is_active_tenant_admin(tenant_id));

-- Policies for tenant admins on domain_provisioning_jobs
DROP POLICY IF EXISTS tenant_admin_manage_domain_jobs ON public.domain_provisioning_jobs;
CREATE POLICY tenant_admin_manage_domain_jobs ON public.domain_provisioning_jobs
FOR ALL TO authenticated
USING (public.is_active_tenant_admin(tenant_id))
WITH CHECK (public.is_active_tenant_admin(tenant_id));
