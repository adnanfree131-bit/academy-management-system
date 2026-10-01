# Staging readiness and release verification

## Live database readiness

Run from the project root with the intended staging configuration in the root `.env`:

```bash
pnpm db:preflight
```

`DATABASE_URL` must connect as `fastify_runtime`, using strict TLS and the configured `DATABASE_SSL_CA`. `MIGRATION_DATABASE_URL` is an administrative connection for reviewed migrations and fixture cleanup; it must not be the application's runtime connection.

The preflight checks live PostgreSQL role flags, grants, ownership, and rejection of schema DDL. Running `tests/db_preflight_and_connection.test.ts` checks mocked preflight behavior and is not a live readiness check.

## Real database boundary acceptance

```bash
RUN_REAL_STAGING_TESTS=true pnpm test:staging
```

This opt-in runner uses the allowlisted staging Supabase project, genuine Supabase Auth users and tokens, and Fastify with PostgresDataStore. It creates temporary fixtures and deletes them at the end. Require both a passing scenario matrix and successful cleanup.

The runner uses Fastify `app.inject`. It exercises the actual backend route handlers and remote database, but does not exercise deployed HTTPS routing, Cloudflare Pages, DNS, or browser callbacks.

## Deployed staging verification

Establish a separate staging backend URL and frontend URL before deploying or testing browser flows. Confirm that they are staging targets and that the configured Supabase project is the intended staging project.

Required configuration includes:

- Backend: runtime database connection, TLS CA, Supabase configuration, and a strong `EDGE_PROXY_SECRET`.
- Cloudflare Pages runtime: `BACKEND_API_URL` or `UPSTREAM_BACKEND_URL` pointing to that staging backend, and the matching `EDGE_PROXY_SECRET`.
- Frontend build: the staging `VITE_SUPABASE_URL` and public `VITE_SUPABASE_ANON_KEY`.
- Supabase Auth: redirect URLs for the actual staging sign-in, confirmation, invitation, and recovery flows.

Probe the deployed backend's `/api/v1/health` for process liveness only. Then exercise authenticated tenant reads through the deployed frontend proxy, permitted writes with cleanup, cross-tenant denials, academy onboarding, email confirmation resumption, recovery completion, invitations, and branded-host login. Match served assets to the reviewed release manifest.

Keep service-role keys and database passwords on server/operator systems. Never place them in frontend build variables or paste them into audit reports.

## Current verification record

See `staging-verification-2026-10-01.md` for the independently executed checks, applied staging migrations, and outstanding deployment verification.
