-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00027: HARDENED RLS & NARROW RESOLVERS
-- =============================================================================

-- 1. Tighten Profiles RLS: Strictly require matching auth user ID or platform super admin
-- Removes CURRENT_USER LIKE 'fastify_runtime%' broad bypass
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
CREATE POLICY profiles_select_policy ON public.profiles
  FOR SELECT
  USING (
    id = public.get_current_auth_user_id()
    OR public.is_platform_super_admin()
  );

-- 2. Tighten Tenants RLS: Strictly require active tenant membership or platform super admin
-- Removes (CURRENT_USER LIKE 'fastify_runtime%' AND status = 'active') broad bypass
DROP POLICY IF EXISTS tenant_select_policy ON public.tenants;
CREATE POLICY tenant_select_policy ON public.tenants
  FOR SELECT
  USING (
    (
      id = get_current_tenant_id()
      AND public.is_active_tenant_member(id)
    )
    OR public.is_platform_super_admin()
  );

-- 3. Narrow SECURITY DEFINER Helper: Resolve Tenant by Slug (Unauthenticated Routing)
CREATE OR REPLACE FUNCTION public.lookup_tenant_by_slug(p_slug TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name::TEXT, t.slug::TEXT, t.status::TEXT
  FROM public.tenants t
  WHERE LOWER(t.slug) = LOWER(TRIM(p_slug))
  LIMIT 1;
END;
$$;

-- 4. Narrow SECURITY DEFINER Helper: Resolve Tenant by Custom Domain (Unauthenticated Routing)
CREATE OR REPLACE FUNCTION public.lookup_tenant_by_custom_domain(p_hostname TEXT)
RETURNS TABLE (
  tenant_id UUID,
  slug TEXT,
  status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT td.tenant_id, t.slug::TEXT, td.status::TEXT
  FROM public.tenant_domains td
  JOIN public.tenants t ON t.id = td.tenant_id
  WHERE LOWER(td.hostname) = LOWER(TRIM(p_hostname))
    AND td.status = 'active'
  LIMIT 1;
END;
$$;

-- 5. Narrow SECURITY DEFINER Helper: Lookup Profile by Auth User ID (Auth Discovery)
CREATE OR REPLACE FUNCTION public.lookup_profile_by_auth_id(p_auth_user_id UUID)
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.profiles
  WHERE id = p_auth_user_id
  LIMIT 1;
END;
$$;

-- 6. Narrow SECURITY DEFINER Helper: Lookup Profile by Email (Auth Discovery)
CREATE OR REPLACE FUNCTION public.lookup_profile_by_email(p_email TEXT)
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.profiles
  WHERE LOWER(email) = LOWER(TRIM(p_email))
  LIMIT 1;
END;
$$;

-- 7. Grant narrow function execution to fastify_runtime and authenticated
GRANT EXECUTE ON FUNCTION public.lookup_tenant_by_slug(TEXT) TO fastify_runtime, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_tenant_by_custom_domain(TEXT) TO fastify_runtime, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_auth_id(UUID) TO fastify_runtime, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_email(TEXT) TO fastify_runtime, authenticated;
