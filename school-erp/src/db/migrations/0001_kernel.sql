-- ============================================================
-- School ERP kernel schema — append-only temporal facts + RLS
-- Source: docs/designs/multi-tenant-k12-school-erp.md
-- Iron rules:
--   * every tenant-scoped table has tenant_id uuid NOT NULL
--   * app runs as role `authenticated`; RLS is the tenancy boundary
--   * posted rows (invoices, receipts, results) are never UPDATEd —
--     corrections are new rows (credit/debit notes, reversals)
-- ============================================================

-- gen_random_uuid() is Postgres 13+ core. btree_gist is loaded by the app
-- (PGlite contrib bundle) before migrations run, for the enrollment exclusion constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ------------------------------------------------------------
-- Roles: the application never runs as superuser against tenant data.
-- Every tenant-scoped transaction does SET ROLE authenticated;
-- PGlite runs tests/seed as superuser (owner, bypasses RLS) only for setup.
-- ------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

-- ------------------------------------------------------------
-- Tenancy & identity
-- ------------------------------------------------------------
CREATE TABLE tenants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE,
  name         text NOT NULL,
  country_code text NOT NULL DEFAULT 'XX',
  timezone     text NOT NULL DEFAULT 'UTC',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Platform users. Passwordless: OTP codes hash here, JWTs carry user_id.
CREATE TABLE users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL UNIQUE,
  full_name    text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE otp_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    int NOT NULL DEFAULT 0 CHECK (attempts < 5),
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_codes_email_idx ON otp_codes (email, created_at DESC);

-- superadmin flag lives on the user row; memberships are tenant-scoped
ALTER TABLE users ADD COLUMN is_super_admin boolean NOT NULL DEFAULT false;

-- One person may belong to many tenants with different roles
-- (a teacher at school A can be a parent at school B).
CREATE TABLE memberships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('ADMIN','STAFF','GUARDIAN')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

-- ------------------------------------------------------------
-- Kernel: people & relationships (effective-dated)
-- ------------------------------------------------------------
CREATE TABLE persons (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_no  text NOT NULL,                -- human-facing admission/staff number
  is_student boolean NOT NULL DEFAULT false,
  is_staff   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, person_no)
);
CREATE INDEX persons_tenant_idx ON persons (tenant_id, id);

-- Link a membership to the person it acts as in this tenant (parent portal).
ALTER TABLE memberships ADD COLUMN person_id uuid REFERENCES persons(id) ON DELETE SET NULL;
CREATE INDEX memberships_user_idx ON memberships (user_id);

-- Legal identity is a timeline. Never overwrite history: close valid_to, open new row.
CREATE TABLE identities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id    uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  legal_name   text NOT NULL,
  preferred_name text,
  date_of_birth date,
  gender       text,
  valid_from   date NOT NULL DEFAULT CURRENT_DATE,
  valid_to     date,                       -- null = current
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE INDEX identities_person_idx ON identities (person_id, valid_from DESC);

-- Contact points are dated too (phones change, emails die)
CREATE TABLE contact_points (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id  uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('phone','email','address')),
  value      text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to   date
);
CREATE INDEX contact_points_person_idx ON contact_points (person_id);

-- Guardianship & staff-ward links: person↔person with rights, not a parent_name field
CREATE TABLE relationships (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE, -- guardian/staff
  to_person_id   uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE, -- student
  kind           text NOT NULL CHECK (kind IN ('GUARDIAN','STAFF_WARD')),
  relation_label text,                    -- mother, father, uncle…
  can_view       boolean NOT NULL DEFAULT true,
  can_pay        boolean NOT NULL DEFAULT false,
  can_pickup     boolean NOT NULL DEFAULT false,
  is_financially_responsible boolean NOT NULL DEFAULT false,
  court_order_id text,                    -- protective order blocks rights when set
  valid_from     date NOT NULL DEFAULT CURRENT_DATE,
  valid_to       date,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (from_person_id <> to_person_id),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE INDEX relationships_to_idx ON relationships (to_person_id);
CREATE INDEX relationships_from_idx ON relationships (from_person_id);

-- ------------------------------------------------------------
-- Kernel: organisation, academic year, calendar
-- ------------------------------------------------------------
CREATE TABLE campuses (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      text NOT NULL,
  address   text NOT NULL DEFAULT '',
  UNIQUE (tenant_id, name)
);

CREATE TABLE academic_years (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,               -- "2026-2027"
  start_date date NOT NULL,
  end_date   date NOT NULL,
  status     text NOT NULL DEFAULT 'PLANNING' CHECK (status IN ('PLANNING','ACTIVE','CLOSED')),
  UNIQUE (tenant_id, name),
  CHECK (end_date > start_date)
);

-- The calendar is the source of "membership days" — attendance denominators.
CREATE TABLE calendar_days (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year_id    uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  day        date NOT NULL,
  day_type   text NOT NULL DEFAULT 'IN_SESSION'
             CHECK (day_type IN ('IN_SESSION','HOLIDAY','WEEKEND','EXAM','STAFF_ONLY','HALF_DAY')),
  UNIQUE (year_id, day)
);
CREATE INDEX calendar_days_year_idx ON calendar_days (year_id, day);

CREATE TABLE grades (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      text NOT NULL,                -- "Grade 4"
  rank      int NOT NULL DEFAULT 0,       -- ordering for promotion (next by rank)
  UNIQUE (tenant_id, name)
);

CREATE TABLE sections (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campus_id uuid NOT NULL REFERENCES campuses(id),
  grade_id  uuid NOT NULL REFERENCES grades(id),
  name      text NOT NULL,                -- "A"
  capacity  int NOT NULL DEFAULT 40,
  UNIQUE (tenant_id, grade_id, name)
);

-- ------------------------------------------------------------
-- Kernel: enrollment (school membership) — Ed-Fi-shaped, close-and-open.
-- Ed-Fi key: student + school + entry_date. Grade changes open a new row.
-- exit_date convention: first day NOT enrolled (PowerSchool), so
-- active on day d ⇔ entry_date <= d AND (exit_date IS NULL OR exit_date > d).
-- ------------------------------------------------------------
CREATE TABLE enrollments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id    uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  campus_id    uuid NOT NULL REFERENCES campuses(id),
  grade_id     uuid NOT NULL REFERENCES grades(id),
  year_id      uuid NOT NULL REFERENCES academic_years(id),
  calendar_id  uuid REFERENCES academic_years(id),  -- which calendar governs membership days
  entry_date   date NOT NULL,
  entry_type   text NOT NULL DEFAULT 'NEW'
               CHECK (entry_type IN ('NEW','RE_ENTRY','TRANSFER_IN','PROMOTED','RETAINED')),
  exit_date    date,
  exit_type    text CHECK (exit_type IN ('TRANSFERRED_OUT','GRADUATED','WITHDRAWN','DECEASED','NO_SHOW','PROMOTED','RETAINED')),
  is_primary   boolean NOT NULL DEFAULT true,
  repeat_grade boolean NOT NULL DEFAULT false,
  next_year_grade_id uuid REFERENCES grades(id),   -- rollover decision (Y1)
  next_year_action   text CHECK (next_year_action IN ('PROMOTE','RETAIN','GRADUATE','DO_NOT_ENROLL')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (exit_date IS NULL OR exit_date > entry_date),
  CHECK ((exit_date IS NULL) = (exit_type IS NULL) OR (exit_date IS NOT NULL AND exit_type IS NOT NULL))
);
-- at most one open primary enrollment per student (E5)
CREATE UNIQUE INDEX enrollments_one_open_primary_idx
  ON enrollments (tenant_id, person_id) WHERE exit_date IS NULL AND is_primary;
-- non-overlapping enrollment intervals per student (E2/E5) — real exclusion
-- constraint; a plain unique index cannot express interval overlap
ALTER TABLE enrollments ADD CONSTRAINT enrollments_no_overlap_excl
  EXCLUDE USING gist (
    tenant_id WITH =,
    person_id WITH =,
    daterange(entry_date, exit_date, '[)') WITH &&
  );
CREATE INDEX enrollments_person_idx ON enrollments (person_id, entry_date);

-- Section membership is separate from school enrollment (E1: transfers
-- re-roster; attendance stays with the section that owned the day)
CREATE TABLE section_rosters (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  person_id  uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date   date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX rosters_section_idx ON section_rosters (section_id, start_date);
CREATE INDEX rosters_person_idx ON section_rosters (person_id, start_date);

-- ------------------------------------------------------------
-- Attendance: "taken" event + per-student events. Categories, not booleans.
-- Denominator = in-session calendar days ∩ enrollment window (AT4/AT5).
-- ------------------------------------------------------------
CREATE TABLE attendance_taken (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  day        date NOT NULL,
  taken_by   uuid NOT NULL REFERENCES users(id),
  taken_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, day)
);

CREATE TABLE attendance_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id  uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  day        date NOT NULL,
  period     int NOT NULL DEFAULT 0,       -- 0 = daily attendance
  category   text NOT NULL CHECK (category IN
             ('PRESENT','ABSENT_UNEXCUSED','ABSENT_EXCUSED','LATE','HALF_DAY','SCHOOL_ACTIVITY','SUSPENDED')),
  source     text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','IMPORT','DEVICE')),
  taken_by   uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, day, period)
);
CREATE INDEX attendance_events_day_idx ON attendance_events (tenant_id, day);

-- ------------------------------------------------------------
-- Finance: posted documents, deterministic allocation, cash sessions.
-- Corrections are new documents (credit/debit notes). Receipt serials
-- are unique and never reused, including bounced ones (F9/F16).
-- ------------------------------------------------------------
CREATE TABLE fee_heads (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name      text NOT NULL,               -- Tuition, Transport, Exam…
  priority  int NOT NULL DEFAULT 100,    -- lower = allocated first (F1 determinism)
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, name)
);

CREATE TABLE invoices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id   uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  billing_period text,                  -- "2026-09"
  status      text NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED','CANCELLED')),
  posted_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
  notes       text NOT NULL DEFAULT ''
);
CREATE INDEX invoices_person_idx ON invoices (person_id, posted_at DESC);

CREATE TABLE invoice_lines (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  fee_head_id uuid NOT NULL REFERENCES fee_heads(id),
  amount     numeric(14,2) NOT NULL CHECK (amount > 0),
  description text NOT NULL DEFAULT ''
);

CREATE TABLE cash_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cashier_id   uuid NOT NULL REFERENCES users(id),
  opened_at    timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz,
  opening_float numeric(14,2) NOT NULL DEFAULT 0,
  counted_total numeric(14,2),
  variance     numeric(14,2),
  variance_reason text NOT NULL DEFAULT '',
  CHECK (closed_at IS NULL OR counted_total IS NOT NULL)
);
-- one open session per cashier per tenant (F11)
CREATE UNIQUE INDEX cash_sessions_one_open_idx
  ON cash_sessions (tenant_id, cashier_id) WHERE closed_at IS NULL;

CREATE TABLE receipts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  serial         bigint NOT NULL,       -- per-tenant sequence, unique forever (F9)
  person_id      uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  method         text NOT NULL CHECK (method IN ('CASH','BANK_TRANSFER','CHEQUE','CARD','GATEWAY')),
  amount         numeric(14,2) NOT NULL CHECK (amount > 0),
  status         text NOT NULL DEFAULT 'CLEARED'
                 CHECK (status IN ('CLEARED','DEPOSITED','BOUNCED','REVERSED')),
  cash_session_id uuid REFERENCES cash_sessions(id),
  reference      text NOT NULL DEFAULT '',   -- cheque no / txn id
  received_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  notes          text NOT NULL DEFAULT '',
  created_by     uuid NOT NULL REFERENCES users(id)
);
CREATE INDEX receipts_person_idx ON receipts (person_id, received_at DESC);

-- Allocation: receipt money applied to invoice lines, deterministic split (F1)
CREATE TABLE allocations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  receipt_id     uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  invoice_line_id uuid NOT NULL REFERENCES invoice_lines(id) ON DELETE CASCADE,
  amount         numeric(14,2) NOT NULL CHECK (amount <> 0)  -- negative = contra (bounce reversal)
);

-- F2 — overpayment credit on account (advance), never a silent extra month
CREATE TABLE student_credits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id  uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  receipt_id uuid REFERENCES receipts(id),
  amount     numeric(14,2) NOT NULL CHECK (amount > 0),
  consumed   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX allocations_receipt_idx ON allocations (receipt_id);
CREATE INDEX allocations_line_idx ON allocations (invoice_line_id);

CREATE TABLE credit_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  serial      bigint NOT NULL,
  person_id   uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  reason      text NOT NULL,
  amount      numeric(14,2) NOT NULL CHECK (amount > 0),
  invoice_id  uuid REFERENCES invoices(id),
  created_by  uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_notes_person_idx ON credit_notes (person_id);

-- Bounce handling: original receipt stays, marked BOUNCED; reversal is a
-- contra-receipt that negates the allocation (F9). Never delete rows.
CREATE TABLE receipt_reversals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  original_receipt_id uuid NOT NULL REFERENCES receipts(id),
  contra_receipt_id   uuid NOT NULL REFERENCES receipts(id),
  reason        text NOT NULL,
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (original_receipt_id)
);

-- ------------------------------------------------------------
-- Rollover: promotion decisions drive the nightly job (Y1), never
-- "UPDATE students SET grade = grade + 1".
-- ------------------------------------------------------------
CREATE TABLE promotion_runs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_year_id uuid NOT NULL REFERENCES academic_years(id),
  to_year_id   uuid NOT NULL REFERENCES academic_years(id),
  executed_at timestamptz NOT NULL DEFAULT now(),
  executed_by uuid NOT NULL REFERENCES users(id),
  summary     jsonb NOT NULL DEFAULT '{}'
);

-- ------------------------------------------------------------
-- Sequences & triggers: tenant-scoped serials, tenant_id immutability
-- ------------------------------------------------------------
CREATE TABLE tenant_serials (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  receipt_serial bigint NOT NULL DEFAULT 0,
  credit_note_serial bigint NOT NULL DEFAULT 0
);

-- tenant_id must never change on an existing row (tenancy guarantee)
CREATE OR REPLACE FUNCTION enforce_tenant_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'persons','identities','contact_points','relationships','campuses',
    'academic_years','calendar_days','grades','sections','enrollments',
    'section_rosters','attendance_taken','attendance_events','fee_heads',
    'invoices','invoice_lines','cash_sessions','receipts','allocations',
    'credit_notes','receipt_reversals','promotion_runs','memberships','student_credits'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_tenant_immutable BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION enforce_tenant_immutable()', t, t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- Row-Level Security: the tenancy boundary.
-- Every tenant-scoped table: ENABLE + FORCE RLS, policy compares
-- tenant_id against the session GUC set right after SET ROLE.
-- ------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'persons','identities','contact_points','relationships','campuses',
    'academic_years','calendar_days','grades','sections','enrollments',
    'section_rosters','attendance_taken','attendance_events','fee_heads',
    'invoices','invoice_lines','cash_sessions','receipts','allocations',
    'credit_notes','receipt_reversals','promotion_runs','memberships',
    'tenant_serials','student_credits'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I_isolation ON %I FOR ALL
       USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)
       WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)',
      t, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', t);
  END LOOP;
END $$;

-- users & tenants readable cross-tenant (needed for login/tenant switching),
-- but writable only by the app role via controlled paths
GRANT SELECT ON users, tenants, otp_codes TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- ------------------------------------------------------------
-- Views (superuser-owned; app queries use base tables)
-- ------------------------------------------------------------
CREATE VIEW v_current_enrollments AS
SELECT e.*
FROM enrollments e
WHERE e.exit_date IS NULL;

CREATE VIEW v_student_balances AS
SELECT i.tenant_id,
       i.person_id,
       COALESCE(SUM(l.amount), 0) AS billed,
       COALESCE((SELECT SUM(a.amount) FROM allocations a
                 JOIN receipts r ON r.id = a.receipt_id
                 JOIN invoice_lines l2 ON l2.id = a.invoice_line_id
                 WHERE l2.invoice_id = i.id
                   AND r.status IN ('CLEARED','DEPOSITED')), 0) AS allocated,
       COALESCE(SUM(l.amount), 0)
         - COALESCE((SELECT SUM(a.amount) FROM allocations a
                     JOIN receipts r ON r.id = a.receipt_id
                     JOIN invoice_lines l2 ON l2.id = a.invoice_line_id
                     WHERE l2.invoice_id = i.id
                       AND r.status IN ('CLEARED','DEPOSITED')), 0) AS balance
FROM invoices i
JOIN invoice_lines l ON l.invoice_id = i.id
WHERE i.status = 'POSTED'
GROUP BY i.tenant_id, i.person_id, i.id;
