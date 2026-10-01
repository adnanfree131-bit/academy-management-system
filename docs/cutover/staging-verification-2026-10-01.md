# Independent staging verification — 2026-10-01

## Completed work

Target: allowlisted Supabase staging project `mddjjlkmdqzghculpjcd`, session pooler in Singapore on port 5432. Database runtime identity: `fastify_runtime`; strict certificate verification enabled.

1. Ran `pnpm db:preflight` against the remote staging database: PASS. Runtime is neither superuser nor RLS-bypassing, cannot create roles/databases or schema objects, owns no public tables, and has no direct SELECT/INSERT/UPDATE/DELETE access to `auth.users`.
2. Ran `RUN_REAL_STAGING_TESTS=true pnpm test:staging` before upgrading: 15/15 scenarios passed. Temporary Supabase Auth users and database records were cleaned up.
3. Read the remote migration ledger and inspected migrations 00029–00030. Applied those two prepared forward-only migrations through the canonical migration runner. The first 28 migrations were skipped; the remote ledger now contains 30 migrations and no migration is pending.
4. Ran the live boundary suite again after the upgrade: 15/15 scenarios passed, including tenant isolation, membership tampering denials, suspended access, platform authorization, and route-generated audit provenance.
5. Independently queried the administrative connection in a read-only transaction for the exact four tenant IDs and eight Auth identity IDs from both runs. Students, batches, programs, memberships, audit logs, tenants, profiles, and `auth.users` all returned zero remaining matching records.
6. Verified the live audit-purge function ACL: execution is limited to `postgres` and `supabase_admin`; PUBLIC, anon, authenticated, fastify_runtime, and service_role have no explicit execution grant. Profile resolvers remain granted to postgres, service_role, and fastify_runtime, with no PUBLIC/anon/authenticated grant.
7. `pnpm check:request-db-bypass`: PASS, 21 files scanned, zero secondary request-path pool checkouts detected.
8. `pnpm verify:release`: PASS, 7/7 checks after migration bundle regeneration.

The historical 00028 ledger hash remains unchanged. Its difference from the current source matches the runner's two explicitly allowlisted historical checksums; 00029 records reconciliation and 00030 applies the forward-only security convergence. This was not silently rewritten.

## Deployed application observations

Read-only Chromium checks of `https://app.kampus.pk` show that it still serves `/assets/index-DdoywWnT.js`, containing legacy `/api/v1/auth/login` and `/api/v1/auth/forgot-password` paths and lacking the new Supabase session storage marker. The reviewed local release contains `/assets/index-D6bYOKF7.js`.

The public `/api/v1/auth/session` returns 404. Public branding for slug `tsa` still returns The Smart Academy. These observations establish that the public deployment differs from the reviewed candidate. They do not establish that retired tenant data remains in the staging Supabase database.

Local `.env` does not identify a BACKEND_API_URL or UPSTREAM_BACKEND_URL, and EDGE_PROXY_SECRET is absent. Hosted environment settings were not inspected, so these local findings do not establish what is configured in Cloudflare or the backend host.

## Remaining gate

The live boundary suite uses the current local Fastify application with real remote Supabase Auth and PostgreSQL. It does not traverse a deployed staging frontend, Cloudflare proxy, HTTPS backend, or real email callback flow.

A separate staging frontend and backend deployment target must be identified before that browser/deployment gate can proceed. No production deployment or DNS change was performed. No dummy academies were recreated.

Corrected operator instructions: [staging-readiness-and-release-verification.md](staging-readiness-and-release-verification.md).
