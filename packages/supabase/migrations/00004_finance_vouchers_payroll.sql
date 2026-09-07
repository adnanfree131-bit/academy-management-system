-- =============================================================================
-- Migration 00004: Multi-Head Invoicing, Priority Auto-Distribution, Vouchers & Payroll
-- Strictly Enforced Row-Level Security (RLS) for multi-tenant containment
-- =============================================================================

-- 1. FEE HEADS (Zero hardcoding: Tuition, Arrears, Annual, Exam, Lab, etc.)
CREATE TABLE IF NOT EXISTS fee_heads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  is_system_default BOOLEAN NOT NULL DEFAULT false,
  default_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  priority_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_heads_tenant ON fee_heads(tenant_id);
ALTER TABLE fee_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_heads FORCE ROW LEVEL SECURITY;

-- 2. FEE PRIORITY CONFIGURATION (Academy drag-and-drop liquidation rule)
CREATE TABLE IF NOT EXISTS fee_priority_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  priority_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_priority_tenant ON fee_priority_configs(tenant_id);
ALTER TABLE fee_priority_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_priority_configs FORCE ROW LEVEL SECURITY;

-- 3. STUDENT & BATCH FEE STRUCTURES (Class default with student overrides)
CREATE TABLE IF NOT EXISTS fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  academic_session VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_structures_tenant ON fee_structures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_batch ON fee_structures(tenant_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_student ON fee_structures(tenant_id, student_id);
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures FORCE ROW LEVEL SECURITY;

-- 4. STUDENT INVOICES / CHALLANS (Multi-Head Itemized Invoices)
CREATE TABLE IF NOT EXISTS student_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_name VARCHAR(150) NOT NULL,
  roll_number VARCHAR(50) NOT NULL,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  batch_name VARCHAR(150) NOT NULL,
  billing_month VARCHAR(50) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  balance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(30) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'voided')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_month ON student_invoices(tenant_id, billing_month);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON student_invoices(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON student_invoices(tenant_id, status);
ALTER TABLE student_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_invoices FORCE ROW LEVEL SECURITY;

-- 5. INVOICE ITEMS (Itemized breakdown per fee head)
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES student_invoices(id) ON DELETE CASCADE,
  fee_head_id UUID NOT NULL REFERENCES fee_heads(id) ON DELETE RESTRICT,
  head_name VARCHAR(100) NOT NULL,
  head_code VARCHAR(50) NOT NULL,
  original_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_items_tenant_inv ON invoice_items(tenant_id, invoice_id);
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items FORCE ROW LEVEL SECURITY;

-- 6. FEE PAYMENTS & RECEIPTS (Allocations & Cashier Review Overrides)
CREATE TABLE IF NOT EXISTS fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  receipt_number VARCHAR(100) NOT NULL,
  invoice_id UUID NOT NULL REFERENCES student_invoices(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_name VARCHAR(150) NOT NULL,
  roll_number VARCHAR(50) NOT NULL,
  payment_date DATE NOT NULL,
  amount_paid NUMERIC(12, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'wallet')),
  reference_number VARCHAR(100),
  is_override BOOLEAN NOT NULL DEFAULT false,
  override_reason TEXT,
  allocations JSONB NOT NULL DEFAULT '[]'::jsonb,
  collected_by VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_date ON fee_payments(tenant_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_student ON fee_payments(tenant_id, student_id);
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments FORCE ROW LEVEL SECURITY;

-- 7. FEE DISCOUNTS & CONCESSIONS (Mandatory approval audit tracking)
CREATE TABLE IF NOT EXISTS fee_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_name VARCHAR(150) NOT NULL,
  roll_number VARCHAR(50) NOT NULL,
  invoice_id UUID REFERENCES student_invoices(id) ON DELETE SET NULL,
  fee_head_id UUID REFERENCES fee_heads(id) ON DELETE SET NULL,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('flat', 'percentage')),
  discount_value NUMERIC(12, 2) NOT NULL,
  actual_discount_amount NUMERIC(12, 2) NOT NULL,
  mandatory_reason TEXT NOT NULL,
  approved_by VARCHAR(150) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discounts_tenant_student ON fee_discounts(tenant_id, student_id);
ALTER TABLE fee_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_discounts FORCE ROW LEVEL SECURITY;

-- 8. STAFF SALARY PROFILES (Fixed Monthly vs Per-Lecture)
CREATE TABLE IF NOT EXISTS staff_salary_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_name VARCHAR(150) NOT NULL,
  designation VARCHAR(100) NOT NULL,
  contract_type VARCHAR(50) NOT NULL CHECK (contract_type IN ('fixed_monthly', 'per_lecture')),
  base_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_profiles_staff ON staff_salary_profiles(tenant_id, staff_id);
ALTER TABLE staff_salary_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_salary_profiles FORCE ROW LEVEL SECURITY;

-- 9. STAFF PAYSLIPS (Interactive Month-End Payroll Calculations)
CREATE TABLE IF NOT EXISTS staff_payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slip_number VARCHAR(100) NOT NULL,
  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_name VARCHAR(150) NOT NULL,
  designation VARCHAR(100) NOT NULL,
  payroll_month VARCHAR(50) NOT NULL,
  base_salary NUMERIC(12, 2) NOT NULL,
  attendance_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  earnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  deductions JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_earnings NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processed', 'paid')),
  payment_date DATE,
  payment_method VARCHAR(50) CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'wallet')),
  transaction_reference VARCHAR(100),
  admin_notes TEXT,
  processed_by VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payslips_tenant_month ON staff_payslips(tenant_id, payroll_month);
CREATE INDEX IF NOT EXISTS idx_payslips_staff ON staff_payslips(tenant_id, staff_id);
ALTER TABLE staff_payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_payslips FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- APPLY MULTI-TENANT ISOLATION POLICIES LOOP
-- =============================================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'fee_heads',
      'fee_priority_configs',
      'fee_structures',
      'student_invoices',
      'invoice_items',
      'fee_payments',
      'fee_discounts',
      'staff_salary_profiles',
      'staff_payslips'
    ])
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS %I ON %I;
      CREATE POLICY %I ON %I
        FOR ALL
        USING (
          tenant_id = get_current_tenant_id() 
          OR current_setting(''app.is_super_admin'', true) = ''true''
        )
        WITH CHECK (
          tenant_id = get_current_tenant_id() 
          OR current_setting(''app.is_super_admin'', true) = ''true''
        );
    ', tbl || '_isolation_policy', tbl, tbl || '_isolation_policy', tbl);
  END LOOP;
END
$$;

-- Grant permissions to authenticated application role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
