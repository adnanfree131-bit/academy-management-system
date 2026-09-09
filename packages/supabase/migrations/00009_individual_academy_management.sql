-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00009: INDIVIDUAL ACADEMY CONTROLS
-- =============================================================================

-- 1. Support 'archived' in tenants status constraint
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'trial', 'grace_period', 'locked', 'suspended', 'archived', 'pending_verification'));

-- 2. Individual Academy Billing Parameters
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_monthly_fee NUMERIC(12, 2);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS individual_grace_period_days INT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_cycle_anchor_day INT DEFAULT 1;
