# Backend and Authentication Hardening Plan

This plan turns the September 2026 multitenancy audit into independently deployable phases. Each completed phase has regression coverage and can ship without waiting for the later persistence migration.

## Phase 1 — Immediate containment (implemented)

- Seed fixture tenants and privileged users only in tests or explicitly opted-in local development.
- Require an explicit non-production flag before database demo seeding.
- Enforce tenant ownership for WhatsApp dispatches, staff leave, attendance, payroll, counselor, student, batch, invoice, and rollback lookups.
- Return `404` when a tenant submits a foreign student identifier.

## Phase 2 — Authentication controls (implemented)

- Add `auth_version` to users and JWTs. Increment it with every password reset or change and reject stale tokens.
- Limit access-token lifetime to 8 hours by default, configurable from 15 minutes to 24 hours.
- Rate-limit login, registration, OTP request/verification, and password reset/change endpoints by client, tenant, and account identifier.
- Enforce per-account OTP resend cooldowns.
- Hash purpose-bound OTPs with HMAC-SHA256 and compare them in constant time.
- Require 12-character passwords for new registrations and password changes/resets.

The application limiter is process-local. Multi-replica production deployments must apply the same limits in a shared gateway or shared limiter store so requests cannot rotate between replicas.

## Phase 3 — Sensitive storage and transport (implemented)

- Stop persisting OTP records in the all-tenant snapshot.
- Write local snapshots atomically with mode `0600`; the existing workspace snapshot was corrected to `0600`.
- Remove plaintext-password verification compatibility.
- Verify hosted PostgreSQL certificates and support a private CA through `DATABASE_SSL_CA`.
- Restrict production CORS to configured origins and HTTPS tenant subdomains.
- Add baseline browser security headers and enforce a 32-character production JWT secret.

## Phase 4 — Persistence safety bridge (implemented)

- Add optimistic snapshot versions so concurrent backend replicas fail on stale writes instead of silently losing data.
- Deny `authenticated`, `anon`, and `PUBLIC` database roles access to compatibility snapshot and backup tables.
- Add migration `00018_secure_runtime_snapshot.sql` and RLS regression coverage for the denial boundary.

The compatibility snapshot remains an all-tenant service-owned payload. These controls protect it from browser-facing database roles and concurrent overwrite, but they do not turn it into tenant-row RLS storage.

## Phase 5 — Normalized PostgreSQL cutover (deployment program)

This is a data migration rather than a safe one-shot code edit. Execute it in four releases:

1. **Shadow write:** introduce repositories backed by the existing normalized tables. For each mutation, write the normalized row and current snapshot in one observable operation; record reconciliation failures.
2. **Backfill and reconcile:** migrate every snapshot collection by `tenant_id`, reject orphaned or cross-tenant references, and compare per-tenant counts and financial totals.
3. **Shadow read:** read normalized tables in parallel, compare responses, and keep snapshot responses authoritative until mismatch rates reach zero.
4. **Cut over:** make normalized repositories authoritative, set tenant context with `SET LOCAL app.current_tenant_id` inside every request transaction, then remove snapshot writes after the rollback window.

Release gates:

- The application database role must not own tables, be a superuser, or have `BYPASSRLS`.
- API integration tests must authenticate through Fastify and query the production persistence implementation, rather than configuring RLS directly in tests.
- Backfill must produce zero unowned records, zero duplicate tenant identifiers, and matching per-tenant financial control totals.
- A restore rehearsal and rollback procedure must pass before cutover.

## Validation

- `pnpm lint`
- `pnpm build`
- `pnpm --filter @apex/backend test`
- `pnpm --filter @apex/supabase test`
- `pnpm audit --prod --audit-level high`

The remaining dependency-audit exceptions are the frontend SheetJS advisories. They should be removed by replacing `xlsx` before accepting untrusted spreadsheet files in production.
