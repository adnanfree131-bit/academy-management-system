# Phase 13: Real Production Database Boundary Testing

## Objective

Prove that the deployed Fastify backend can connect to PostgreSQL using the restricted `fastify_runtime` role and that Supabase RLS prevents cross-tenant access.

This phase must test the real production boundary. Existing PGlite, in-memory, owner-role, and mocked tests are not sufficient evidence for this phase.

## Safety rules

- Do not modify or delete production data.
- Do not run greenfield reset, seed, truncate, drop, or cleanup commands.
- Do not commit `.env`, passwords, database URLs, Supabase certificates, JWT secrets, or service-role keys.
- Do not disable TLS verification.
- Do not use the `postgres` or other BYPASSRLS role for application runtime tests.
- Use a dedicated staging project or staging tenant records only.
- Make the test fail closed when required credentials or TLS configuration are missing.

## Required implementation

### 1. Separate migration and runtime connections

Keep these variables separate:

- `MIGRATION_DATABASE_URL`: administrative/session-pooler connection used only for migrations.
- `DATABASE_URL`: restricted application connection using `fastify_runtime`.
- `DATABASE_SSL_CA`: path or supported configuration for the Supabase server root certificate.

Do not silently convert ports or remove SSL parameters from the supplied URL. Preserve the URL's TLS and pooler semantics.

### 2. Runtime role preflight

Add a safe preflight check that runs before the real acceptance suite and reports:

- `current_user` is `fastify_runtime`.
- `rolsuper` is false.
- `rolbypassrls` is false.
- The role can connect and use the required schema.
- The role cannot perform migration or ownership operations.

The preflight must fail with a clear message if the application is accidentally using `postgres`, an owner role, or a BYPASSRLS role.

### 3. Runtime role provisioning documentation

Document how an administrator provisions the `fastify_runtime` password without committing it. The migration must not contain a hard-coded password.

Document the shared-pooler username format when required:

```text
fastify_runtime.<SUPABASE_PROJECT_REF>
```

### 4. Real Fastify acceptance tests

Add an opt-in test command that:

- Connects using the actual `DATABASE_URL`.
- Starts or invokes the actual Fastify application.
- Obtains real test authentication tokens.
- Sends requests through HTTP routes and middleware.
- Sets tenant context through the same mechanism used in production.
- Does not instantiate `InMemoryDataStore`.
- Does not use PGlite as the database owner.

The command must refuse to run unless an explicit environment flag such as `RUN_REAL_STAGING_TESTS=true` is present.

### 5. Tenant isolation tests

Create two dedicated staging tenants, Tenant A and Tenant B, with test users.

Prove all of the following:

1. A valid Tenant A user can read permitted Tenant A data.
2. The same user cannot read Tenant B data.
3. The same user cannot update or delete Tenant B data.
4. A Tenant B user cannot use a Tenant A tenant header to bypass isolation.
5. Missing tenant context is rejected for tenant-scoped routes.
6. Suspended users are rejected.
7. A user cannot modify their own membership status or permissions.
8. Platform-only routes remain inaccessible to tenant users.
9. Audit records contain the correct tenant and user context.

Use harmless uniquely identifiable test records and clean up only those records after successful tests. If cleanup fails, report the record IDs clearly; never perform broad cleanup.

### 6. Transaction and RLS verification

Verify that each tenant request sets the expected database context inside the same transaction used by the query. Test the exact behavior of:

- tenant ID context;
- authenticated user ID context;
- role switching, if used;
- commit behavior;
- rollback behavior;
- denied access behavior.

If the transaction helper uses `SET LOCAL ROLE authenticated`, prove that `fastify_runtime` is explicitly allowed to use that role. Otherwise revise the design so the restricted runtime role works without an unsafe privilege escalation.

### 7. Test reporting

The command must print:

- database host and database name, with passwords and query credentials redacted;
- verified database role;
- verified RLS flags;
- tenant IDs used;
- each test result;
- cleanup result;
- a final PASS or FAIL status.

A green result is invalid if the test ran as `postgres`, an owner, a BYPASSRLS role, PGlite, an in-memory store, or a mock.

## Required validation

Run and report:

```bash
pnpm lint
pnpm build
pnpm test
pnpm <real-staging-test-command>
```

The final report must distinguish local tests from real staging tests. Do not claim production-boundary verification until the real staging test passes.

## Completion criteria

Phase 13 is complete only when:

- TLS verification succeeds using the Supabase root CA.
- The backend connects as `fastify_runtime`.
- The runtime role is not superuser and does not bypass RLS.
- Real Fastify HTTP requests are used.
- Cross-tenant reads and writes are denied.
- Suspended and unauthorized users are denied.
- No secrets are committed.
- No production or unrelated staging data is changed.
- The test output and setup instructions are documented.

If any requirement cannot be demonstrated, mark Phase 13 as BLOCKED and explain the exact missing prerequisite.
