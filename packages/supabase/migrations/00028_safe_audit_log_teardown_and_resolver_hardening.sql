-- =============================================================================
-- Migration 00028: Safe Transaction-Local Audit Log Teardown & Resolver Hardening
-- Eliminates global ALTER TABLE DISABLE TRIGGER and hardens profile resolvers.
-- =============================================================================

-- 1. Update prevent_audit_log_modification to support transaction-scoped purge
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
DECLARE
  v_allow_purge text;
  v_is_admin boolean;
BEGIN
  -- Check transaction-local setting
  v_allow_purge := current_setting('app.allow_staging_audit_purge', true);

  IF v_allow_purge = 'on' THEN
    -- Strict check: session caller must be administrative role (postgres, supabase_admin, or superuser)
    SELECT (
      SESSION_USER IN ('postgres', 'supabase_admin')
      OR pg_has_role(SESSION_USER, 'postgres', 'USAGE')
      OR (SELECT rolsuper FROM pg_roles WHERE rolname = SESSION_USER)
    ) INTO v_is_admin;

    IF v_is_admin IS TRUE AND TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
  END IF;

  RAISE EXCEPTION 'AUDIT_LOG_IMMUTABLE: Audit log records are append-only. Updates and deletions are strictly prohibited.'
    USING ERRCODE = '23505';
END;
$$ LANGUAGE plpgsql;

-- 2. Dedicated Administrative Function for Staging Fixture Purge
CREATE OR REPLACE FUNCTION public.purge_staging_audit_logs(
  target_log_ids UUID[],
  target_tenant_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER := 0;
  v_is_admin boolean;
BEGIN
  -- Strict administrative caller validation: check SESSION_USER rather than CURRENT_USER
  -- because inside a SECURITY DEFINER function, CURRENT_USER evaluates to the function owner (postgres).
  SELECT (
    SESSION_USER IN ('postgres', 'supabase_admin')
    OR pg_has_role(SESSION_USER, 'postgres', 'USAGE')
    OR (SELECT rolsuper FROM pg_roles WHERE rolname = SESSION_USER)
  ) INTO v_is_admin;

  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: purge_staging_audit_logs is strictly restricted to administrative superusers.'
      USING ERRCODE = '42501';
  END IF;

  IF (target_log_ids IS NULL OR array_length(target_log_ids, 1) IS NULL)
     AND (target_tenant_ids IS NULL OR array_length(target_tenant_ids, 1) IS NULL) THEN
    RETURN 0;
  END IF;

  -- Activate transaction-local flag (3rd param is_local=true guarantees cleanup on commit/rollback)
  PERFORM set_config('app.allow_staging_audit_purge', 'on', true);

  IF target_tenant_ids IS NOT NULL AND array_length(target_tenant_ids, 1) > 0 THEN
    DELETE FROM public.audit_logs
    WHERE (target_log_ids IS NOT NULL AND id = ANY(target_log_ids))
       OR tenant_id = ANY(target_tenant_ids);
  ELSE
    DELETE FROM public.audit_logs
    WHERE id = ANY(target_log_ids);
  END IF;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Ensure supabase_admin and service_role roles exist for local testing/PGlite
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

-- Restrict function execution strictly to database administrators
REVOKE ALL ON FUNCTION public.purge_staging_audit_logs(UUID[], UUID[]) FROM PUBLIC, anon, authenticated, fastify_runtime, service_role;
GRANT EXECUTE ON FUNCTION public.purge_staging_audit_logs(UUID[], UUID[]) TO postgres, supabase_admin;

-- 3. Hardened Profile Resolvers: Revoke from PUBLIC, anon, and authenticated
REVOKE EXECUTE ON FUNCTION public.lookup_profile_by_auth_id(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lookup_profile_by_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_auth_id(UUID) TO fastify_runtime;
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_email(TEXT) TO fastify_runtime;
