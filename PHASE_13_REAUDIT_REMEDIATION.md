# Phase 13 Re-audit Remediation

## Verdict

Phase 13 is not complete. The implementation provides useful TLS, preflight, command, and documentation scaffolding, but it has not passed a real staging test and the current runner cannot prove the production boundary.

Do not mark Phase 13 complete until every acceptance criterion below is demonstrated against the staging Supabase project.

## Required corrections

### 1. Put all production store queries in request-scoped database context

`PostgresDataStore` still sends most queries directly through `this.pool.query`. Authentication also loads profiles, tenants, and memberships before any tenant/user database transaction exists.

Implement a request-scoped PostgreSQL client and transaction for real Fastify requests:

- acquire one pool client for the request;
- begin a transaction;
- after JWT verification, set `app.current_user_id` before profile queries;
- after tenant resolution, set `app.current_tenant_id` before tenant data queries;
- make every store query for that request use the same client;
- commit after a successful response;
- roll back after errors;
- always release the client;
- prove no context leaks when a pooled connection is reused.

Do not weaken or bypass RLS to make authentication queries work.

### 2. Use real Supabase authentication in the real staging suite

The staging runner must not use `createTestSupabaseToken`, `TEST_JWT_SECRET`, locally signed HS256 tokens, or `NODE_ENV=test` authentication behavior.

Create dedicated staging Auth users through the Supabase Admin API, sign them in through the normal Supabase Auth API, and use the returned access tokens for Fastify HTTP requests. Delete only those generated Auth users during cleanup.

The application under test must use the normal JWKS verifier with the staging issuer and audience.

### 3. Separate fixture administration from application runtime

The Fastify application must use only `DATABASE_URL` with `fastify_runtime`.

Fixture creation, integrity verification, and cleanup may use `MIGRATION_DATABASE_URL` only inside the opt-in staging harness. Before using it, enforce all of these checks:

- explicit `RUN_REAL_STAGING_TESTS=true`;
- explicit staging project allowlist/project reference;
- refuse known production hosts/project references;
- generated run ID attached to every fixture;
- cleanup restricted to exact recorded IDs;
- cleanup continues per resource after one deletion fails;
- remaining IDs are printed when cleanup is incomplete.

Do not grant `fastify_runtime` direct INSERT, UPDATE, or DELETE access to `auth.users`. Remove that grant from migrations and operator documentation. Supabase Auth users must be managed through the Admin API.

### 4. Repair the acceptance scenarios

The final suite must prove all of these with real evidence:

1. A Tenant A user can read Tenant A data through Fastify.
2. Tenant A cannot read Tenant B data through Fastify.
3. Tenant A cannot mutate or delete Tenant B data through Fastify.
4. Tenant header spoofing is rejected.
5. Missing tenant context is rejected.
6. Suspended profile and suspended membership are independently rejected.
7. A normal member cannot update their own role, status, tenant ID, auth user ID, permission metadata, or access metadata.
8. A tenant administrator cannot call platform-only routes.
9. Audit records created by a real application action contain the correct actor and tenant.
10. Tenant B cannot read Tenant A audit records.

Integrity checks must run with an authorized verification connection/context. Do not interpret an RLS-hidden zero-row result as proof that a record was unchanged.

### 5. Make preflight identity checks exact

Accept only the intended runtime database role. Do not use a broad `startsWith('fastify_runtime')` check.

Verify and fail on:

- unexpected role name;
- `rolsuper=true`;
- `rolbypassrls=true`;
- `rolcreaterole=true`;
- `rolcreatedb=true`;
- ownership of application schemas or tables;
- CREATE privilege on application schemas;
- direct privileges on `auth.users` beyond the explicitly approved minimum, preferably none.

Keep the negative DDL probe inside a transaction and ensure rollback is attempted on every path.

### 6. Fix cleanup and reporting

The current runtime-role cleanup is incompatible with RLS and the audit-log DELETE revocation. Move fixture cleanup to the guarded staging administrative connection.

The final report must distinguish:

- local unit tests;
- local PGlite tests;
- preflight result;
- real Supabase Auth result;
- real Fastify plus `fastify_runtime` result;
- cleanup result.

Never print `VICTORY CONFIRMED`, `PASS`, or `Phase 13 complete` when the real staging command was skipped, blocked, or run with locally signed tokens.

## Mandatory validation

Run:

```bash
pnpm lint
pnpm build
pnpm test
pnpm db:preflight
RUN_REAL_STAGING_TESTS=true pnpm test:staging
```

Provide redacted evidence showing:

- `current_user` is the exact intended runtime role;
- `rolsuper`, `rolbypassrls`, `rolcreaterole`, and `rolcreatedb` are false;
- the application uses `PostgresDataStore` with request-scoped context;
- normal JWKS verification accepted real Supabase access tokens;
- every scenario passed;
- all generated staging fixtures and Auth users were removed.

## Completion rule

If the Supabase root CA, runtime password/URL, staging Admin API credentials, or explicit staging project allowlist are unavailable, implement the safe harness but report Phase 13 as `BLOCKED`, not complete.
