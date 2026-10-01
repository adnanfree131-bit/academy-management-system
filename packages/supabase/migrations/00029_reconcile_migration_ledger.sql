-- =============================================================================
-- Migration 00029: Migration Ledger Reconciliation & Drift Hardening
-- Acknowledges historical migration 00028 checksum alignment without mutating
-- historical rows in public.schema_migrations.
-- =============================================================================

-- 1. Create dedicated migration reconciliation log table to maintain immutable audit trail
CREATE TABLE IF NOT EXISTS public.migration_reconciliation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(255) NOT NULL,
  migration_name VARCHAR(255) NOT NULL,
  historical_checksum VARCHAR(64) NOT NULL,
  canonical_checksum VARCHAR(64) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'RECONCILED',
  reason TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable and force RLS on migration reconciliation logs
ALTER TABLE public.migration_reconciliation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_reconciliation_logs FORCE ROW LEVEL SECURITY;

-- Grant permissions: read access to runtime roles, write restricted to administrative role
REVOKE ALL ON public.migration_reconciliation_logs FROM PUBLIC, anon;
GRANT SELECT ON public.migration_reconciliation_logs TO fastify_runtime, authenticated, postgres;
GRANT INSERT ON public.migration_reconciliation_logs TO postgres;

-- 2. Record immutable reconciliation entry for migration 00028
INSERT INTO public.migration_reconciliation_logs (
  version,
  migration_name,
  historical_checksum,
  canonical_checksum,
  status,
  reason,
  recorded_at
)
VALUES (
  '00028',
  '00028_safe_audit_log_teardown_and_resolver_hardening.sql',
  '0d52b2b205f068fc004650c3ae193c0a4aae7b52d1d43e246acb36789a531769',
  '106d2c36d2940fd79b52b477f083393aa5a1e6c45bb2d2f262d061aaa8bd2d26',
  'RECONCILED',
  'Migration 00028 historical staging checksum baseline alignment acknowledged via forward-only migration without mutating historical schema_migrations rows.',
  NOW()
);

-- 3. If any tenant exists, also record an event in public.audit_logs
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;
  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      tenant_id,
      actor_email,
      action,
      resource,
      resource_id,
      changes,
      created_at
    ) VALUES (
      v_tenant_id,
      'system@platform.local',
      'MIGRATION_LEDGER_RECONCILED',
      'migration',
      '00028',
      jsonb_build_object(
        'version', '00028',
        'historical_checksum', '0d52b2b205f068fc004650c3ae193c0a4aae7b52d1d43e246acb36789a531769',
        'canonical_checksum', '106d2c36d2940fd79b52b477f083393aa5a1e6c45bb2d2f262d061aaa8bd2d26',
        'policy', 'forward_only_non_mutating'
      ),
      NOW()
    );
  END IF;
END $$;
