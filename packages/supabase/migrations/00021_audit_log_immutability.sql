-- =============================================================================
-- Migration 00020: Enforce Immutable Append-Only Audit Logs
-- Ensures all audit log records cannot be updated or deleted by any runtime role.
-- =============================================================================

-- 1. Immutability Trigger Function
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_LOG_IMMUTABLE: Audit log records are append-only. Updates and deletions are strictly prohibited.'
    USING ERRCODE = '23505';
END;
$$ LANGUAGE plpgsql;

-- 2. Attach Trigger on audit_logs
DROP TRIGGER IF EXISTS trg_prevent_audit_log_modification ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_log_modification
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();

-- 3. Revoke UPDATE and DELETE privileges from application runtime roles
REVOKE UPDATE, DELETE ON TABLE public.audit_logs FROM fastify_runtime, authenticated;

-- Ensure SELECT and INSERT are preserved for authenticated runtime
GRANT SELECT, INSERT ON TABLE public.audit_logs TO fastify_runtime, authenticated;
