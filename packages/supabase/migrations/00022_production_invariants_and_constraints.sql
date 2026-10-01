-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00020: PRODUCTION INVARIANTS & INTEGRITY CONSTRAINTS
-- Enforces non-negative financial values, tenant-qualified uniqueness,
-- and multi-row business constraints directly in the database.
-- =============================================================================

-- 1. Student Invoices: Non-negative financial amounts & Tenant-qualified unique invoice number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_invoices_nonnegative_amounts'
  ) THEN
    ALTER TABLE public.student_invoices 
      ADD CONSTRAINT chk_student_invoices_nonnegative_amounts 
      CHECK (
        subtotal_amount >= 0 AND 
        discount_amount >= 0 AND 
        net_amount >= 0 AND 
        paid_amount >= 0 AND 
        balance_amount >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_student_invoices_tenant_number'
  ) THEN
    ALTER TABLE public.student_invoices 
      ADD CONSTRAINT uq_student_invoices_tenant_number 
      UNIQUE (tenant_id, invoice_number);
  END IF;
END $$;

-- 2. Fee Payments: Positive payment amounts & Tenant-qualified unique receipt number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_fee_payments_positive_amount'
  ) THEN
    ALTER TABLE public.fee_payments 
      ADD CONSTRAINT chk_fee_payments_positive_amount 
      CHECK (amount_paid > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_fee_payments_tenant_receipt'
  ) THEN
    ALTER TABLE public.fee_payments 
      ADD CONSTRAINT uq_fee_payments_tenant_receipt 
      UNIQUE (tenant_id, receipt_number);
  END IF;
END $$;

-- 3. Students: Unique roll number within a tenant batch
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_students_tenant_batch_roll'
  ) THEN
    ALTER TABLE public.students 
      ADD CONSTRAINT uq_students_tenant_batch_roll 
      UNIQUE (tenant_id, batch_id, roll_number);
  END IF;
END $$;

-- 4. Staff Salary Profiles: Non-negative base amount
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_staff_salary_base_nonnegative'
  ) THEN
    ALTER TABLE public.staff_salary_profiles 
      ADD CONSTRAINT chk_staff_salary_base_nonnegative 
      CHECK (base_amount >= 0);
  END IF;
END $$;

-- 5. Staff Payslips: Non-negative gross and net amounts & Unique monthly payslip per staff
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_staff_payslips_nonnegative'
  ) THEN
    ALTER TABLE public.staff_payslips 
      ADD CONSTRAINT chk_staff_payslips_nonnegative 
      CHECK (total_earnings >= 0 AND net_salary >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_staff_payslips_tenant_month'
  ) THEN
    ALTER TABLE public.staff_payslips 
      ADD CONSTRAINT uq_staff_payslips_tenant_month 
      UNIQUE (tenant_id, staff_id, payroll_month);
  END IF;
END $$;

-- 6. Student Attendance: Unique daily batch attendance per student
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_student_attendance_daily'
  ) THEN
    ALTER TABLE public.student_attendance 
      ADD CONSTRAINT uq_student_attendance_daily 
      UNIQUE (tenant_id, student_id, batch_id, date);
  END IF;
END $$;

-- 7. Staff Attendance: Unique daily attendance per staff
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_staff_attendance_daily'
  ) THEN
    ALTER TABLE public.staff_attendance 
      ADD CONSTRAINT uq_staff_attendance_daily 
      UNIQUE (tenant_id, staff_id, date);
  END IF;
END $$;
