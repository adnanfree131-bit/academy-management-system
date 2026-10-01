-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00023: CANONICAL DOMAINS,
-- LIFECYCLE STATES & PLATFORM ROLE PROTECTION
-- =============================================================================

-- 1. Tenant Domains Table
CREATE TABLE IF NOT EXISTS public.tenant_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  hostname VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'verifying', 'active', 'failed', 'pending_cleanup')),
  is_custom_domain BOOLEAN NOT NULL DEFAULT true,
  verification_txt_name VARCHAR(255),
  verification_txt_value TEXT,
  verified_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_domains_hostname UNIQUE (hostname),
  CONSTRAINT chk_tenant_domains_hostname_lowercase CHECK (hostname = LOWER(hostname))
);

CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant ON public.tenant_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_status ON public.tenant_domains(status);

-- 2. Domain Provisioning & Deprovisioning Jobs Table
CREATE TABLE IF NOT EXISTS public.domain_provisioning_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  hostname VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('provision', 'deprovision', 'verify', 'cleanup')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  last_error TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_jobs_status ON public.domain_provisioning_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_domain_jobs_tenant ON public.domain_provisioning_jobs(tenant_id);

-- 3. Model Tenant Lifecycle States Explicitly
-- States: 'pending', 'active', 'suspended', 'deleting', 'deleted', 'trial', 'grace_period', 'locked'
DO $$
BEGIN
  ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
  ALTER TABLE public.tenants ADD CONSTRAINT tenants_status_check 
    CHECK (status IN ('pending', 'active', 'suspended', 'deleting', 'deleted', 'trial', 'grace_period', 'locked'));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 4. Protect platform roles from user-controlled profile updates
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_platform_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.platform_role IS DISTINCT FROM NEW.platform_role) THEN
    -- Check if current execution has super admin authorization or is database superuser
    IF CURRENT_USER NOT IN ('postgres', 'supabase_admin')
       AND NOT public.is_platform_super_admin() THEN
      RAISE EXCEPTION 'FORBIDDEN_ROLE_CHANGE: Modifying platform_role requires platform super_admin authorization.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_platform_role ON public.profiles;
CREATE TRIGGER trg_protect_platform_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_unauthorized_platform_role_change();

-- 5. Row-Level Security Policies for Tenant Domains
ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_provisioning_jobs ENABLE ROW LEVEL SECURITY;

-- Grant appropriate permissions to authenticated and fastify_runtime roles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fastify_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_domains TO fastify_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.domain_provisioning_jobs TO fastify_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON TABLE public.tenant_domains TO authenticated;
  END IF;
END $$;

-- Policy: Super Admin full access
DROP POLICY IF EXISTS superadmin_all_tenant_domains ON public.tenant_domains;
CREATE POLICY superadmin_all_tenant_domains ON public.tenant_domains
FOR ALL TO authenticated
USING (public.is_platform_super_admin())
WITH CHECK (public.is_platform_super_admin());

-- Policy: Tenant members can view their own tenant's domains
DROP POLICY IF EXISTS tenant_view_domains ON public.tenant_domains;
CREATE POLICY tenant_view_domains ON public.tenant_domains
FOR SELECT TO authenticated
USING (
  public.is_active_tenant_member(tenant_id)
);

-- Policy: Domain provisioning jobs restricted to platform super admins
DROP POLICY IF EXISTS superadmin_all_domain_jobs ON public.domain_provisioning_jobs;
CREATE POLICY superadmin_all_domain_jobs ON public.domain_provisioning_jobs
FOR ALL TO authenticated
USING (public.is_platform_super_admin())
WITH CHECK (public.is_platform_super_admin());
