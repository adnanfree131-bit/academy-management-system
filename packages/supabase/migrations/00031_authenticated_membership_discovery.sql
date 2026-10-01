-- Discover only the signed-in identity's academies before selecting a tenant.
-- Ordinary table RLS remains unchanged and still requires tenant context.
CREATE OR REPLACE FUNCTION public.lookup_memberships_by_auth_id(p_auth_user_id UUID)
RETURNS TABLE (membership JSONB, tenant JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT to_jsonb(m), to_jsonb(t)
  FROM public.tenant_memberships m
  JOIN public.tenants t ON t.id = m.tenant_id
  WHERE p_auth_user_id = public.get_current_auth_user_id()
    AND m.auth_user_id = p_auth_user_id
    AND m.status = 'active'
    AND t.status = 'active';
$$;

REVOKE ALL ON FUNCTION public.lookup_memberships_by_auth_id(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_memberships_by_auth_id(UUID) TO authenticated, fastify_runtime;
