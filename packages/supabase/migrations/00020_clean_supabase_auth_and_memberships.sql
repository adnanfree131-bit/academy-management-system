-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00019: CLEAN SUPABASE AUTH & MEMBERSHIPS
-- =============================================================================

-- 1. Ensure auth schema and auth.users exist (compatible with standalone PG / PGlite / Supabase)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    CREATE SCHEMA auth;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    CREATE TABLE auth.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE,
      raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'auth' AND p.proname = 'uid') THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $body$
        SELECT NULLIF(
          COALESCE(
            NULLIF(current_setting('request.jwt.claim.sub', true), ''),
            (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'),
            NULLIF(current_setting('app.current_user_id', true), ''),
            NULLIF(current_setting('app.auth_user_id', true), '')
          ),
          ''
        )::UUID;
      $body$ LANGUAGE sql STABLE;
    $func$;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END $$;

-- 2. Create public.profiles (Global identity profile keyed to auth.users.id)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  platform_role TEXT NOT NULL DEFAULT 'user' CHECK (platform_role IN ('user', 'super_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_platform_role ON public.profiles(platform_role);

-- 3. Rename public.users to public.tenant_memberships (preserves foreign keys)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'tenant_memberships'
  ) THEN
    ALTER TABLE public.users RENAME TO tenant_memberships;
  END IF;
END $$;

-- 4. Add auth_user_id and constraints to tenant_memberships
ALTER TABLE public.tenant_memberships 
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_membership_auth_user 
  ON public.tenant_memberships(tenant_id, auth_user_id) 
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_memberships_auth_user_status 
  ON public.tenant_memberships(auth_user_id, status);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant_role_status 
  ON public.tenant_memberships(tenant_id, role, status);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant_email 
  ON public.tenant_memberships(tenant_id, email);

-- 5. Create public.tenant_invitations
CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL 
    CHECK (role IN ('tenant_admin', 'academic_head', 'teacher', 'finance_manager', 'parent', 'student')),
  invited_by_membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_invitation_active UNIQUE (tenant_id, email, token_hash)
);

CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token ON public.tenant_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_lookup ON public.tenant_invitations(tenant_id, email);

-- 6. Drop obsolete legacy tables (OTPs, compatibility snapshots)
DROP TABLE IF EXISTS public.otp_codes CASCADE;
DROP TABLE IF EXISTS public.kampus_store_snapshot CASCADE;
DROP TABLE IF EXISTS public.kampus_store_snapshot_history CASCADE;
DROP TABLE IF EXISTS public.kampus_store_backups CASCADE;
DROP TABLE IF EXISTS public.runtime_snapshots CASCADE;

-- 7. Profile Creation Trigger for new auth.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, platform_role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'display_name',
      split_part(COALESCE(NEW.email, 'user'), '@', 1)
    ),
    'user', -- Always 'user' - super_admin can only be granted via protected platform script
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END $$;

-- 8. Security Invoker / Definer RLS Helper Functions
CREATE OR REPLACE FUNCTION public.get_current_auth_user_id() RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    auth.uid(),
    NULLIF(current_setting('app.current_user_id', true), '')::UUID,
    NULLIF(current_setting('app.auth_user_id', true), '')::UUID
  );
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.is_platform_super_admin() RETURNS BOOLEAN AS $$
BEGIN
  -- Check explicit super admin session override
  IF current_setting('app.is_super_admin', true) = 'true' THEN
    RETURN TRUE;
  END IF;

  -- Check public.profiles platform_role
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = public.get_current_auth_user_id()
      AND platform_role = 'super_admin'
      AND status = 'active'
  );
EXCEPTION
  WHEN OTHERS THEN RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.is_active_tenant_member(check_tenant_id UUID) RETURNS BOOLEAN AS $$
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
      AND status = 'active'
  );
EXCEPTION
  WHEN OTHERS THEN RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.has_tenant_role(check_tenant_id UUID, allowed_roles TEXT[]) RETURNS BOOLEAN AS $$
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
      AND status = 'active'
      AND role = ANY(allowed_roles)
  );
EXCEPTION
  WHEN OTHERS THEN RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.get_active_membership_id(check_tenant_id UUID) RETURNS UUID AS $$
DECLARE
  v_membership_id UUID;
BEGIN
  SELECT id INTO v_membership_id
  FROM public.tenant_memberships
  WHERE tenant_id = check_tenant_id
    AND auth_user_id = public.get_current_auth_user_id()
    AND status = 'active'
  LIMIT 1;

  RETURN v_membership_id;
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- 9. Restricted Fastify Database Role & Least Privilege Grants
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
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fastify_runtime, authenticated;

-- Ensure anon role exists in test / standalone environment
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
END $$;

-- Allow client and runtime roles to access schema auth and call auth functions
GRANT USAGE ON SCHEMA auth TO fastify_runtime, authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO fastify_runtime, authenticated, anon;

-- Revoke sensitive tables from anon role
REVOKE ALL ON public.tenant_memberships FROM anon;
REVOKE ALL ON public.tenant_invitations FROM anon;
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.profiles FROM anon;

-- 10. Enable & FORCE RLS on identity tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invitations FORCE ROW LEVEL SECURITY;

-- Profiles RLS
DROP POLICY IF EXISTS profiles_isolation_policy ON public.profiles;
CREATE POLICY profiles_isolation_policy ON public.profiles
  FOR ALL
  USING (
    id = public.get_current_auth_user_id()
    OR public.is_platform_super_admin()
  )
  WITH CHECK (
    id = public.get_current_auth_user_id()
    OR public.is_platform_super_admin()
  );

-- Tenants RLS
DROP POLICY IF EXISTS tenant_isolation_policy ON public.tenants;
CREATE POLICY tenant_isolation_policy ON public.tenants
  FOR ALL
  USING (
    (
      id = get_current_tenant_id()
      AND public.is_active_tenant_member(id)
    )
    OR public.is_platform_super_admin()
  )
  WITH CHECK (
    (
      id = get_current_tenant_id()
      AND public.is_active_tenant_member(id)
    )
    OR public.is_platform_super_admin()
  );

-- Tenant Memberships RLS
DROP POLICY IF EXISTS users_isolation_policy ON public.tenant_memberships;
DROP POLICY IF EXISTS tenant_memberships_isolation_policy ON public.tenant_memberships;
CREATE POLICY tenant_memberships_isolation_policy ON public.tenant_memberships
  FOR ALL
  USING (
    (
      tenant_id = get_current_tenant_id()
      AND public.is_active_tenant_member(tenant_id)
    )
    OR public.is_platform_super_admin()
  )
  WITH CHECK (
    (
      tenant_id = get_current_tenant_id()
      AND public.is_active_tenant_member(tenant_id)
    )
    OR public.is_platform_super_admin()
  );

-- Tenant Invitations RLS
DROP POLICY IF EXISTS tenant_invitations_isolation_policy ON public.tenant_invitations;
CREATE POLICY tenant_invitations_isolation_policy ON public.tenant_invitations
  FOR ALL
  USING (
    (
      tenant_id = get_current_tenant_id()
      AND public.is_active_tenant_member(tenant_id)
    )
    OR public.is_platform_super_admin()
  )
  WITH CHECK (
    (
      tenant_id = get_current_tenant_id()
      AND public.is_active_tenant_member(tenant_id)
    )
    OR public.is_platform_super_admin()
  );

-- Audit Logs RLS
DROP POLICY IF EXISTS audit_isolation_policy ON public.audit_logs;
CREATE POLICY audit_isolation_policy ON public.audit_logs
  FOR ALL
  USING (
    (
      tenant_id = get_current_tenant_id()
      AND public.is_active_tenant_member(tenant_id)
    )
    OR public.is_platform_super_admin()
  )
  WITH CHECK (
    (
      tenant_id = get_current_tenant_id()
      AND public.is_active_tenant_member(tenant_id)
    )
    OR public.is_platform_super_admin()
  );

-- 11. Rewrite RLS Policies for all operational module tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN 
    SELECT DISTINCT c.table_name 
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.table_schema = 'public' 
      AND c.column_name = 'tenant_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('tenants', 'tenant_memberships', 'tenant_invitations', 'audit_logs')
  LOOP
    EXECUTE format('
      ALTER TABLE %I ENABLE ROW LEVEL SECURITY;
      ALTER TABLE %I FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS %I ON %I;
        CREATE POLICY %I ON %I
          FOR ALL
          USING (
            (
              tenant_id = get_current_tenant_id()
              AND public.is_active_tenant_member(tenant_id)
            )
            OR public.is_platform_super_admin()
          )
          WITH CHECK (
            (
              tenant_id = get_current_tenant_id()
              AND public.is_active_tenant_member(tenant_id)
            )
            OR public.is_platform_super_admin()
          );
      ', tbl, tbl, tbl || '_isolation_policy', tbl, tbl || '_isolation_policy', tbl);
  END LOOP;
END
$$;

-- 12. Create backward-compatible VIEW for public.users
CREATE OR REPLACE VIEW public.users WITH (security_invoker = true) AS
  SELECT 
    id,
    tenant_id,
    email,
    phone,
    full_name,
    role,
    status,
    avatar_url,
    metadata,
    last_login_at,
    created_at,
    updated_at
  FROM public.tenant_memberships;

GRANT SELECT ON public.users TO authenticated, fastify_runtime;
