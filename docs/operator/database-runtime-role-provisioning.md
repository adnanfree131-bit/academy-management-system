# Database Runtime Role Provisioning & Operational Guide

## 1. Overview & Security Architecture

The Apex Academy Management System enforces strict separation between database administrative operations and application runtime execution.

| Connection Variable | Target Database Role | Privileges | Purpose |
| :--- | :--- | :--- | :--- |
| `MIGRATION_DATABASE_URL` | `postgres` / `supabase_admin` | Table Owner, Schema DDL | Schema migrations, index creation, trigger management |
| `DATABASE_URL` | `fastify_runtime` | `NOBYPASSRLS`, `NOSUPERUSER`, DML only | Real-time Fastify HTTP route processing & tenant transactions |

Under this architecture:
- Application routes never connect as `postgres` or superusers.
- Row Level Security (RLS) policies are always enforced because `fastify_runtime` has `rolbypassrls = false`.
- The database preflight check fails closed if connecting as `postgres` or any role with superuser or BYPASSRLS privileges.

---

## 2. Provisioning the `fastify_runtime` Role

An infrastructure administrator must execute the following commands using an administrative session (`psql` or Supabase SQL Editor via `MIGRATION_DATABASE_URL`).

### 2.1 Role Creation & Privilege Grants

```sql
-- 1. Ensure role exists with least privilege
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fastify_runtime') THEN
    CREATE ROLE fastify_runtime WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

-- 2. Explicitly enforce NOBYPASSRLS
ALTER ROLE fastify_runtime NOBYPASSRLS;

-- 3. Grant schema usage and table DML privileges
GRANT USAGE ON SCHEMA public, auth TO fastify_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fastify_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fastify_runtime;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO fastify_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fastify_runtime;

-- 4. Grant authenticated role membership for SET LOCAL ROLE in tenant transactions
GRANT authenticated TO fastify_runtime;

-- 5. Lock down audit logs to append-only (no UPDATE/DELETE)
REVOKE UPDATE, DELETE ON public.audit_logs FROM fastify_runtime;
GRANT SELECT, INSERT ON public.audit_logs TO fastify_runtime;
```

### 2.2 Secure Password Provisioning

**Never commit passwords to source control or migrations.**  
Generate a high-entropy password using OpenSSL and set it dynamically:

```bash
# Generate high-entropy password
RUNTIME_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)

# Set password in PostgreSQL via administrative connection
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 <<EOF
ALTER ROLE fastify_runtime WITH PASSWORD '$RUNTIME_PASSWORD';
EOF
```

Store `RUNTIME_PASSWORD` securely in your production secrets store (e.g. AWS Secrets Manager, Doppler, Vault, or Cloudflare Secrets).

---

## 3. Connection Configuration Matrix

### 3.1 Supabase Shared Pooler Username Mapping (Port 6543)

When connecting through the Supabase Supavisor connection pooler on port `6543`, the username must include the Supabase Project Reference:

```text
fastify_runtime.<SUPABASE_PROJECT_REF>
```

#### Connection String Format:
```text
postgres://fastify_runtime.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?sslmode=require
```

### 3.2 Supabase Direct / Session Pooler (Port 5432)

When connecting directly to the PostgreSQL instance or through the session pooler:

```text
postgres://fastify_runtime:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres?sslmode=require
```

---

## 4. Root CA Certificate Configuration (`DATABASE_SSL_CA`)

Remote connections require strict TLS certificate verification (`rejectUnauthorized: true`). The application runtime supports both filesystem paths and inline PEM strings.

### 4.1 Supplying via Filesystem Path
Download the official Supabase Root CA:

```bash
curl -sS https://raw.githubusercontent.com/supabase/supabase/master/packages/common/src/certificates/prod-ca-2021.crt -o ./certs/prod-ca-2021.crt
```

Set in environment:
```bash
DATABASE_SSL_CA=./certs/prod-ca-2021.crt
```

### 4.2 Supplying via Inline Environment Variable (Container Platforms)
In container environments (e.g. Fly.io, Railway, Kubernetes), provide the PEM content directly with escaped newlines:

```bash
DATABASE_SSL_CA="-----BEGIN CERTIFICATE-----\nMIIDrzCCApegAwIBAgIQCDvgVpBCRrGhdWrJWZHHSjANBgkqhkiG9w0BAQsFADBh\n...\n-----END CERTIFICATE-----"
```

---

## 5. Operational Verification Commands

### 5.1 Preflight Verification
To verify that the database role satisfies all security boundaries without launching the HTTP server:

```bash
pnpm db:preflight
```

The script asserts:
- Connected role is exact `fastify_runtime` (or `fastify_runtime.<PROJECT_REF>`).
- `rolsuper = false`, `rolbypassrls = false`, `rolcreaterole = false`, and `rolcreatedb = false`.
- Role has role membership in `authenticated`.
- Negative DDL Probe: `CREATE TABLE` inside a transaction returns PostgreSQL error `42501` (`insufficient_privilege`).
- Public schema and public tables are not owned by `fastify_runtime`.

### 5.2 Real Staging Acceptance Boundary Suite
To execute the comprehensive 9-scenario tenant boundary acceptance suite:

```bash
RUN_REAL_STAGING_TESTS=true \
DATABASE_URL="postgres://fastify_runtime.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?sslmode=require" \
DATABASE_SSL_CA="./certs/prod-ca-2021.crt" \
pnpm test:staging
```

The suite validates:
1. S1: Tenant A authenticated user reads permitted Tenant A data (200 OK).
2. S2: Tenant A user cannot read Tenant B data (404 Not Found / Empty).
3. S3: Tenant A user cannot mutate or delete Tenant B data (404/403 Denied).
4. S4: Tenant B credentials with Tenant A header rejected (403 Forbidden).
5. S5: Missing tenant context rejected for tenant-scoped routes (400 Bad Request).
6. S6: Suspended user/tenant rejected (403 Forbidden).
7. S7: Self-elevation & permission modification denial (403 Forbidden on route; trigger 42501 in DB).
8. S8: Platform-only endpoint protection (403 Forbidden).
9. S9: Route-driven audit log provenance and cross-tenant isolation.
10. Teardown: Non-destructive ID-scoped purge via platform admin context. Cleanly handles append-only audit logs.

---

## 6. Troubleshooting & Failure Modes

| Error / Symptom | Root Cause | Operator Resolution |
| :--- | :--- | :--- |
| `ERROR: 42501: permission denied to set role "authenticated"` | Missing role membership grant | Run `GRANT authenticated TO fastify_runtime;` as admin. |
| `PREFLIGHT SECURITY VIOLATION: Role has rolbypassrls=true` | Connected role bypasses RLS | Connect with `fastify_runtime`. Run `ALTER ROLE fastify_runtime NOBYPASSRLS;`. |
| `PREFLIGHT SECURITY VIOLATION: Role cannot be postgres` | `DATABASE_URL` configured with admin user | Update `DATABASE_URL` to use `fastify_runtime`. Reserve admin user for `MIGRATION_DATABASE_URL`. |
| `ERR_OSSL_PEM_NO_START_LINE` | Invalid PEM certificate format | Verify `DATABASE_SSL_CA` points to an existing file path or contains valid `-----BEGIN CERTIFICATE-----` headers. |
| `STAGING TEST HALTED: Opt-in guardrail not met` | Missing flag or URL | Set `RUN_REAL_STAGING_TESTS=true` and provide `DATABASE_URL`. |
