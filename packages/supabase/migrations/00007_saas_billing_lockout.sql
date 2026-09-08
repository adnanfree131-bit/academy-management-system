-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00007: SAAS BILLING & TRIAL LOCKOUT
-- =============================================================================

-- 1. Global Platform Banking Configuration (Super-Admin Managed)
CREATE TABLE IF NOT EXISTS platform_banking_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name VARCHAR(255) NOT NULL,
  account_title VARCHAR(255) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  iban VARCHAR(100),
  branch_code VARCHAR(50),
  whatsapp_support VARCHAR(50),
  support_email VARCHAR(255),
  monthly_subscription_fee NUMERIC(12, 2) NOT NULL DEFAULT 15000.00,
  instructions TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default banking configuration if none exists
INSERT INTO platform_banking_config (
  id,
  bank_name,
  account_title,
  account_number,
  iban,
  branch_code,
  whatsapp_support,
  support_email,
  monthly_subscription_fee,
  instructions
) VALUES (
  'b1000000-0000-0000-0000-000000000001',
  'Bank Alfalah Limited',
  'Apex ERP SaaS Technologies Pvt Ltd',
  '0123-1005678901',
  'PK36ALFH01231005678901',
  '0123 - Gulberg Main Boulevard',
  '+923001234567',
  'billing@apexacademyerp.com',
  15000.00,
  'Please transfer your subscription fee via online banking / Raast / ATM and upload the screenshot with transaction reference number for immediate automated activation.'
) ON CONFLICT (id) DO NOTHING;

-- 2. Multi-Tenant Subscription Payment Proof Receipts
CREATE TABLE IF NOT EXISTS subscription_payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  plan_duration_months INT NOT NULL DEFAULT 1,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'BANK_TRANSFER',
  reference_number VARCHAR(100),
  receipt_image_url TEXT,
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by_email VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_receipts_tenant ON subscription_payment_receipts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_receipts_status ON subscription_payment_receipts(status, created_at DESC);

-- Enable RLS
ALTER TABLE subscription_payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payment_receipts FORCE ROW LEVEL SECURITY;

-- Multi-Tenant Isolation Policy for Subscription Receipts
DROP POLICY IF EXISTS subscription_receipts_isolation_policy ON subscription_payment_receipts;
CREATE POLICY subscription_receipts_isolation_policy ON subscription_payment_receipts
  FOR ALL
  USING (
    tenant_id = get_current_tenant_id()
    OR current_setting('app.is_super_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id = get_current_tenant_id()
    OR current_setting('app.is_super_admin', true) = 'true'
  );

-- Grant permissions to authenticated role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
