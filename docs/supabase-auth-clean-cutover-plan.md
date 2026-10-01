# Supabase Auth and Multi-Tenant ERP Clean Cutover Plan

## Purpose

Replace the project's custom password, OTP, JWT, session, and snapshot-persistence systems with Supabase Auth plus normalized PostgreSQL persistence and database-enforced tenant isolation.

This is a clean cutover. There is no production data to preserve, no legacy password migration, no dual-auth period, and no compatibility requirement for existing sessions. The existing business behavior and ERP permission model should remain unless this plan explicitly changes it.

This plan supersedes the authentication and staged snapshot-migration portions of `backend-auth-hardening-plan.md`. Keep the tenant-ownership fixes, CORS restrictions, security headers, TLS verification, production seed restrictions, and other security improvements that remain applicable.

## Existing dummy academies and seed data

The current two or three dummy academies and their associated records are disposable development fixtures, not migration data. The clean database reset will delete them, their users, and their business records. Do not copy their password hashes, OTP records, sessions, or privileged credentials into Supabase Auth.

Recreate useful demo scenarios only after the new Auth, membership, normalized persistence, and RLS foundations pass their gates:

- migrations create schema and policies only; they must not create demo tenants or users
- an explicit `seed:dev` command may create demo Auth identities through the Supabase Admin API, then create profiles, tenant memberships, and tenant-owned ERP records using the returned Auth IDs
- `seed:dev` must require an unmistakable opt-in such as `ALLOW_DEMO_SEED=true` and must reject production
- preferably restrict the seed command to a local Supabase URL; staging seeding requires a separate explicit environment allowlist
- generate development passwords at seed time and print/write them only to a local ignored artifact, or accept them through local environment variables; do not commit reusable passwords
- automated tests may use deterministic credentials only inside isolated test infrastructure
- seed at least two tenants with overlapping data shapes so cross-tenant isolation tests have realistic foreign IDs to attack
- keep fixtures idempotent or require a documented local reset before reseeding
- production startup and production migrations must never invoke fixture seeding

If any current dummy scenario is valuable, export only its non-sensitive business shape before reset and turn it into a reviewed fixture. Strip credentials, password hashes, OTPs, tokens, secrets, personal contact details, and generated IDs that conflict with the new Auth/membership model. There is no runtime fallback to the old snapshot after cutover.

## Tenant-domain reset and login experience

Treat platform tenant subdomains and external custom domains as different resources:

- `tsa.kampus.pk` is a platform tenant subdomain.
- A domain such as `portal.tsa.edu.pk` is an external custom domain.

The clean cutover deletes every dummy tenant's domain mapping. It must also clean up external infrastructure because resetting PostgreSQL does not delete Cloudflare DNS records, Cloudflare for SaaS custom hostnames, certificates, workers/routes, or edge caches.

Before cleanup, create a domain inventory. Preserve only platform infrastructure such as the root domain and the explicitly configured `app`, `api`, `www`, and other reserved hosts. For each dummy tenant:

- delete its tenant-domain and slug-alias rows
- delete individual DNS records created for that tenant, if the platform creates them
- delete/deactivate Cloudflare custom-hostname records for external domains
- remove tenant-specific worker routes or redirect rules
- purge relevant edge caches
- verify that the old hostname returns a deliberate unknown-tenant response or no longer resolves

If the platform uses one wildcard DNS record such as `*.kampus.pk`, keep that infrastructure record. In that model, deleting `tsa.kampus.pk` means deleting the application mapping, not the wildcard. Requests for an unknown or deleted host must return a neutral `404 Unknown academy`; they must never fall back to another tenant, a demo tenant, or the platform tenant.

Maintain a reserved-slug list including at least `app`, `api`, `www`, `admin`, `auth`, `support`, `status`, `mail`, `cdn`, and infrastructure names. Tenant creation must reject these values.

### Central login: `app.kampus.pk`

- This is the global sign-in and account-discovery entry point.
- The user authenticates with Supabase Auth, then the backend returns their active memberships.
- With one membership, select it automatically. With multiple memberships, show an academy selector.
- The user may operate the selected academy while remaining on `app.kampus.pk`; load its logo, name, colors, and other safe branding from the tenant record.
- Never discover or disclose tenant memberships from an unauthenticated email-only lookup.

### Branded login: `{tenant}.kampus.pk` or an approved external domain

- Resolve the hostname to one active tenant before rendering the login page.
- Show that tenant's logo, academy name, colors, support details, and approved login-page branding.
- Authenticate through the same Supabase Auth project and identity store.
- After authentication, require an active membership for the hostname's tenant. A valid identity without that membership receives a neutral access-denied response and no tenant data.
- Lock the active tenant to the resolved hostname. Do not honor an arbitrary `X-Tenant-ID` for a different tenant on a branded host.
- Provide a link to `app.kampus.pk` for users who need to choose another academy.

### Session boundary

Browser storage and cookies are origin/domain scoped. A session established on `app.kampus.pk` must not be assumed to exist on `tsa.kampus.pk` or an external domain. For the first cutover:

- central login stays on `app.kampus.pk`
- branded login stays on its branded origin
- the same credentials work at either entry point, but each origin may require its own sign-in
- do not put access or refresh tokens in redirect query strings
- do not create a broad `.kampus.pk` JavaScript-readable session shared with every tenant subdomain

Automatic central-to-branded single sign-on is out of the first cutover. If added later, use a backend-created opaque, single-use, short-lived authorization code bound to the Auth user, tenant, destination origin, PKCE-style verifier, and initiating session. Exchange it over a back channel, prevent replay, redact it from logs, and test open-redirect and confused-deputy attacks. Never redirect with Supabase access or refresh tokens.

### Confirmation, invitation, and recovery links

- Use an exact central callback such as `https://app.kampus.pk/auth/callback` as the production default.
- Carry only a signed/validated tenant or destination hint; never redirect to an arbitrary user-provided URL.
- After central confirmation or recovery, offer a validated link back to the tenant's branded login.
- If branded callbacks are later enabled for platform subdomains, constrain Supabase's redirect allowlist to the single controlled host level and exact callback path, and ensure no untrusted party can claim a platform subdomain. Supabase supports wildcard redirect patterns but recommends exact production redirect URLs.
- External custom-domain callbacks require an exact allowlisted HTTPS URL and verified domain ownership before activation.

### Domain activation lifecycle after reset

1. Tenant chooses an available, non-reserved slug.
2. Create the tenant and membership transactionally, reserving the slug in PostgreSQL.
3. Provision/verify DNS or custom hostname outside the transaction with an observable `pending` state.
4. Activate the hostname only after TLS and ownership checks pass.
5. Roll back or retry failed provisioning without deleting the tenant.
6. On rename/removal, deactivate routing first, then remove the mapping and external resource, with an audit record.

## Mandatory architecture decisions

1. Supabase Auth is the only credential and session authority.
2. Do not store password hashes, reset codes, login OTPs, refresh tokens, or custom JWT signing secrets in application tables.
3. Do not issue application JWTs. The frontend sends the Supabase access token to Fastify.
4. Fastify verifies Supabase access tokens using the project's asymmetric JWKS, expected issuer, signature, expiration, and `authenticated` audience.
5. A Supabase identity is global. Tenant role and status live in a membership row, allowing one identity to belong to multiple tenants.
6. The active tenant is explicit. The frontend sends `X-Tenant-ID`; the backend verifies an active membership before any tenant operation.
7. Roles and permissions are loaded from the current membership on every request. Never authorize from editable user metadata or a stale JWT role claim.
8. Business data is stored in normalized PostgreSQL tables. Remove the all-tenant runtime snapshot from the application path.
9. The normal database runtime role must be `NOSUPERUSER`, `NOBYPASSRLS`, and must not own application tables.
10. The Supabase secret/service-role key is backend-only and is used only for Auth administration that requires it. Do not use it as the default business-data client because it bypasses RLS.
11. No production demo users, fixture passwords, implicit platform administrators, or hardcoded tenant fallbacks are allowed.
12. Do not weaken or disable TLS certificate verification.

## Target identity and tenancy model

### `auth.users`

Supabase-owned identity record. Supabase owns credentials, confirmation state, factors, sessions, and recovery flows. Application code must not write directly to this schema.

### `public.profiles`

- `id uuid primary key references auth.users(id) on delete cascade`
- `email text not null`
- `display_name text not null`
- `phone text null`
- `avatar_url text null`
- `platform_role text not null default 'user' check (platform_role in ('user', 'super_admin'))`
- `status text not null default 'active' check (status in ('active', 'suspended', 'archived'))`
- timestamps

Only `platform_role` can grant platform-wide administration. It must be changed through a protected backend operation or controlled bootstrap script, never from client-editable Auth metadata.

### `public.tenant_memberships`

Use the existing `users` table as the starting point so current foreign keys can continue to reference a tenant-scoped actor ID. Rename it to `tenant_memberships` in a new migration; PostgreSQL will update its foreign-key references.

- `id uuid primary key` — membership/tenant actor ID used by existing ERP foreign keys
- `tenant_id uuid not null references tenants(id) on delete cascade`
- `auth_user_id uuid not null references auth.users(id) on delete cascade`
- tenant-specific `full_name`, `email`, `phone`, `avatar_url`, and `metadata` where existing features need them
- existing ERP `role`
- existing membership `status`
- timestamps and `last_login_at`
- `unique (tenant_id, auth_user_id)`
- indexed `(auth_user_id, status)` and `(tenant_id, role, status)`

Remove all password and authentication-version fields from this domain model. Rename application concepts carefully: an ERP `user.id` currently means the membership actor ID; the Supabase JWT `sub` means `auth_user_id`. Never interchange them.

### `public.tenant_invitations`

- invitation ID, tenant ID, normalized email, intended role, inviter membership ID
- hashed one-time token, expiration, accepted timestamp, revoked timestamp
- unique active invitation semantics
- RLS denied to ordinary browser reads; acceptance is through a protected backend endpoint

Do not return default passwords. New staff, guardians, and students receive an invitation or recovery link through Supabase. A person without a unique email or verified phone does not receive a portal login until a usable identity is assigned. Do not generate fake email addresses.

## Request security model

For every protected Fastify request:

1. Read the bearer token.
2. Verify it against Supabase JWKS and validate issuer, audience, expiry, and subject.
3. Reject tokens with missing or malformed required claims.
4. Load `profiles` by JWT `sub`; reject non-active profiles.
5. Read and validate `X-Tenant-ID` for tenant routes.
6. Load the active membership using `(auth_user_id, tenant_id)`; reject missing, inactive, suspended, or archived memberships.
7. Load the tenant and apply existing suspended/locked tenant behavior.
8. Derive the existing feature-access map from the live membership.
9. Put both IDs into request context: `auth_user_id` and membership `id`.
10. Open business-data transactions under a restricted runtime role and set request-local actor and tenant context. RLS must independently confirm membership; a forged tenant header must fail even if application filtering is missed.

Public platform endpoints such as domain availability remain unauthenticated. Platform administration requires an active profile with `platform_role = 'super_admin'`; it must not rely on a tenant role or a client claim.

## Database RLS model

Create security-invoker helper functions with a locked `search_path`:

- current authenticated identity, using `auth.uid()` for PostgREST and a request-local setting for the restricted Fastify database role
- current active tenant from request-local context
- active membership lookup
- tenant-role checks
- platform-super-admin check

Revoke direct execution where appropriate. Do not create broad `SECURITY DEFINER` functions owned by `postgres` unless a narrowly scoped operation cannot be expressed safely; document and test every exception.

Replace policies based only on `app.current_tenant_id` with policies that require both:

- the row's `tenant_id` equals the selected tenant; and
- the authenticated identity has an active membership in that tenant.

Do not use one `FOR ALL` policy that gives every member write access. Build a table-by-table operation matrix from the existing Fastify route guards:

- read roles
- insert roles
- update roles
- delete roles
- any self-only conditions for students, parents, and staff

Finance, payroll, fee reversals, attendance corrections, role changes, and platform controls require explicit restrictive policies and backend authorization. Preserve audit rows for sensitive operations.

## Phase 0 — Baseline and destructive-reset guard

### Work

- Confirm and record that there is no production data to migrate.
- Classify every existing tenant as disposable demo/test data and record the decision. Stop if any real tenant or real personal/financial data is discovered.
- Inventory the useful dummy scenarios and decide which ones will be recreated by `seed:dev`; do not treat their credentials or IDs as durable.
- Inventory all platform subdomains, external custom domains, Cloudflare DNS/custom-hostname resources, certificates, and worker routes. Mark each as preserve or delete.
- Export the current schema for reference, but do not build a data backfill.
- Record current lint, build, backend-test, and Supabase-test results.
- Inventory every custom auth route, password helper, OTP path, JWT dependency, auth type, frontend token use, and account-provisioning call site.
- Inventory every table and route that references the existing `users.id` membership actor.
- Add a visible migration/reset warning to the implementation PR: applying the clean baseline destroys existing application data and invalidates all sessions.

### Gate

- A machine-readable inventory lists all legacy auth symbols and all membership foreign keys.
- A fixture manifest lists each dummy academy to delete and any sanitized scenario to recreate.
- A domain manifest identifies the database and Cloudflare resources for `tsa.kampus.pk` and every other dummy hostname, while protecting reserved platform hosts.
- No implementation begins while an unknown production database may contain data.

## Phase 1 — Supabase project and environment foundation

### Work

- Configure Supabase Auth with asymmetric signing keys.
- Configure allowed site URL and exact redirect URLs for development, staging, and production.
- Use `https://app.kampus.pk/auth/callback` as the default production Auth callback; do not add an unrestricted redirect wildcard.
- Configure custom SMTP before production use.
- Configure password minimum length and character policy.
- Enable leaked-password protection when the selected Supabase plan supports it.
- Enable CAPTCHA for signup, login, and recovery where supported by the flow.
- Configure Auth endpoint rate limits.
- Decide and document email-confirmation behavior. Production tenant creation must require a verified identity.
- Add frontend variables for Supabase URL and publishable key.
- Add backend variables for Supabase URL, JWT issuer/JWKS URL, publishable key, and backend secret key.
- Validate required production environment variables at boot.
- Ensure secret/service-role values cannot be included in Vite variables or frontend bundles.

### Gate

- Startup fails clearly when required production Auth configuration is absent.
- A bundle scan finds no backend secret/service-role key.
- Redirect allowlists contain no wildcard controlled by an untrusted domain.
- Reserved platform hosts cannot be registered as tenant slugs, and unknown tenant hosts fail closed.

## Phase 2 — Clean identity and membership schema

### Work

- Add a new migration after the existing migrations.
- Rename `public.users` to `public.tenant_memberships` while preserving membership IDs and foreign keys.
- Add `auth_user_id` and the required uniqueness/index constraints.
- Create `profiles` and `tenant_invitations`.
- Remove `otp_codes` and any application password/session storage.
- Remove compatibility snapshot, history, and backup tables because no data requires a bridge.
- Remove database grants that expose internal or sensitive tables to `anon`, `authenticated`, or `PUBLIC` without a deliberate policy.
- Create the restricted Fastify runtime database role and explicit least-privilege grants.
- Add a safe profile-creation trigger for new `auth.users`, limited to basic profile initialization. Tenant and role creation must not happen from untrusted Auth metadata.
- Create tenant/membership/RLS helper functions.
- Rewrite core policies and then every module policy to use identity plus active membership.
- Update the consolidated deployment SQL or replace it with a reproducible migration command so there is one authoritative migration path.

### Gate

- A fresh local Supabase reset applies all migrations without manual SQL.
- Schema tests prove the runtime role is not owner, superuser, or `BYPASSRLS`.
- `anon` cannot read membership, invitation, audit, snapshot, or internal tables.
- Authenticated tenant A cannot read or mutate tenant B.
- A suspended membership loses access without waiting for a token refresh.

## Phase 3 — Normalized PostgreSQL repository cutover

### Work

- Replace `InMemoryDataStore` as the production runtime repository.
- Implement normalized PostgreSQL repositories for all collections currently serialized in the runtime snapshot.
- Every repository method takes explicit tenant context unless it is a documented platform operation.
- Use transactions for multi-row financial, enrollment, payroll, and attendance workflows.
- Set request-local auth identity and tenant context inside each transaction before any query.
- Add database constraints for invariants currently enforced only in memory: tenant-qualified uniqueness, nonnegative financial values where applicable, valid statuses, and tenant-consistent foreign references.
- Keep an in-memory store only as a test fixture if useful; it must not be reachable in production.
- Delete production snapshot hydration, persistence, reconciliation, and file fallback.
- Production must fail closed when PostgreSQL is unavailable. It must never silently start with empty or local state.

### Gate

- Production boot has no snapshot path.
- Repository integration tests run against PostgreSQL and exercise real RLS.
- Two concurrent writes do not lose updates.
- Transaction rollback tests cover admission, invoice/payment, payroll, and attendance corrections.

## Phase 4 — Fastify Supabase authentication boundary

### Work

- Replace `@fastify/jwt` custom-token verification with Supabase token verification.
- Cache JWKS according to library behavior while handling signing-key rotation safely.
- Validate exact issuer and audience; reject wrong-project tokens.
- Implement a typed request auth context containing profile, tenant, membership, role, access map, and both identity IDs.
- Replace all uses of `request.user.sub`/`user_id` that assume it is the membership ID.
- Require `X-Tenant-ID` on tenant-scoped routes; do not infer a production tenant from a slug fallback or hardcoded ID.
- Preserve live account status, tenant suspension, portal blocking, working-session, and feature-access checks using normalized rows.
- Keep tenant-ownership checks added during the earlier audit.
- Add a dedicated platform-auth guard for super-admin routes.
- Return stable errors: missing/invalid token `401`, missing tenant selection `400`, no membership `403`, inactive membership/profile `403`, suspended tenant according to current product rules.

### Gate

- Tampered, expired, wrong-audience, and wrong-issuer JWTs fail.
- A valid user token with a forged tenant header fails.
- Removing or suspending a membership revokes API access immediately.
- Platform routes cannot be reached with a tenant-admin role.

## Phase 5 — Frontend session and tenant switching

### Work

- Install and configure one Supabase browser client using only the publishable key.
- Replace manual `apex_jwt_token` storage and custom token parsing with Supabase session APIs and auth-state subscription.
- Use email/password sign-in through Supabase Auth.
- Use Supabase recovery and password-update flows.
- On sign-in, call a backend session/bootstrap endpoint to fetch profile plus active memberships.
- If there are zero memberships, show onboarding/invitation state.
- If there is one membership, select it automatically.
- If there are multiple memberships, show a tenant selector.
- Store only the selected tenant ID locally; send it as `X-Tenant-ID` on API requests.
- Detect whether the app is running on `app.kampus.pk` or a resolved branded host. On a branded host, fix the active tenant to the host mapping and reject membership switching to another tenant.
- Load tenant branding before showing the branded login without exposing private tenant data.
- Refresh UI authorization from backend membership data; do not trust `user_metadata` for role decisions.
- Sign out through Supabase and clear selected tenant and cached ERP state.
- Remove demo account switching and all fixture credentials.

### Gate

- Refresh-token rotation and page reload preserve a valid session.
- Sign-out removes access and tenant state.
- Switching tenants changes the header and reloads tenant-scoped data.
- Browser storage contains no custom JWT, password, OTP, or backend secret.
- Central and branded login flows both work, and neither leaks a session token through a URL.
- A user who belongs to tenant A cannot use a tenant A session/context to access a tenant B branded host.

## Phase 6 — Tenant onboarding and invitation lifecycle

### Work

- Replace custom registration/OTP verification with Supabase signup and email confirmation.
- Add an authenticated, idempotent tenant-onboarding endpoint that creates the tenant and first `tenant_admin` membership in one database transaction.
- Require a verified email before tenant creation.
- Validate and reserve tenant slug/domain server-side.
- Add invite, resend, revoke, inspect, and accept endpoints for tenant memberships.
- Hash invitation tokens at rest and make acceptance single-use and transactional.
- If the invited email already has a Supabase identity, attach a membership after verified acceptance.
- If it does not, use Supabase invitation/magic-link behavior and finish membership acceptance after authentication.
- Replace staff/student/guardian default-password creation with invitations.
- Make portal account creation optional when a student or guardian lacks a usable identity.
- Add a controlled one-time platform-admin bootstrap command that requires an existing verified Auth user ID/email and explicit operator action. Never run it during normal startup or migration.
- Add asynchronous domain provisioning with explicit `pending`, `active`, `failed`, and `disabled` states and idempotent Cloudflare operations.

### Gate

- Replaying, expiring, revoking, or changing an invitation fails safely.
- Concurrent onboarding cannot create duplicate tenants or memberships.
- No API response returns a generated/default password.
- Tenant signup cannot assign `super_admin` or arbitrary roles from request metadata.
- Failed or repeated domain provisioning cannot hijack an existing hostname or leave the tenant marked active on an unverified domain.

## Phase 7 — Password, recovery, MFA, and session security

### Work

- Delete custom password hashing, verification, OTP generation, OTP storage, reset, and change-password execution.
- Delete application `auth_version` session logic and custom token lifetime settings.
- Use Supabase password update with reauthentication for sensitive changes.
- Add TOTP MFA enrollment and challenge UI.
- Require `aal2` for platform admins and high-risk actions such as role changes, fee reversals, payroll payment, banking changes, and tenant suspension.
- Decide whether tenant admins also require MFA in production; default to required.
- Provide session/device listing and revoke-session behavior where supported by the selected plan and API.
- Ensure account deletion, suspension, and membership removal have defined immediate effects.

### Gate

- Password and recovery traffic goes only to Supabase Auth endpoints.
- High-risk routes reject `aal1` when `aal2` is required.
- Source search finds no password hash, custom OTP, custom JWT signing, fixture password, or plaintext-password fallback in runtime code.

## Phase 8 — Authorization matrix and auditability

### Work

- Produce a checked-in role/operation matrix covering every backend route and every RLS-protected table.
- Reconcile Fastify guards with RLS policies so the database is at least as restrictive as the API.
- Define self-access for students, guardians, and teachers explicitly.
- Audit login-related business events, invitation lifecycle, tenant switching, membership/role changes, MFA changes, impersonation if added, financial reversals, payroll payment, and platform actions.
- Store actor Auth ID, actor membership ID, tenant ID, action, target, request ID, IP, user agent, and timestamp where applicable.
- Make audit records append-only to normal application roles.
- Add structured security logs without tokens, passwords, OTPs, invitation secrets, or sensitive request bodies.

### Gate

- Every protected route maps to a matrix entry and automated authorization test.
- Audit records cannot be updated or deleted by ordinary tenant users.
- Logs contain no bearer tokens or credential material.

## Phase 9 — Remove legacy code and close the cutover

### Work

- Delete obsolete custom auth routes or retain only compatibility-shaped endpoints that delegate to Supabase and contain no credential logic. Prefer direct Supabase frontend flows.
- Delete `services/auth.ts`, `services/password.ts`, the process-local auth limiter, custom JWT plugin/configuration, OTP mail templates, and obsolete shared auth types when no longer referenced.
- Remove `JWT_SECRET`, `OTP_PEPPER`, and custom JWT lifetime variables from examples and deployment configuration.
- Remove `@fastify/jwt` if unused.
- Remove runtime snapshot code, migration `00018` if migrations are intentionally squashed before first deployment, and local snapshot artifacts.
- Update architecture, local setup, environment, onboarding, recovery, MFA, RLS, and incident-response documentation.
- Add the guarded `seed:dev` workflow and sanitized multi-tenant fixtures only after the production cutover path is complete.
- Resolve the high-severity `xlsx` advisories before accepting untrusted spreadsheet uploads.

### Gate

- `rg` searches demonstrate that all prohibited legacy paths are gone.
- Fresh setup documentation works from an empty database.
- No test depends on hardcoded demo credentials.
- Production boot and production migration tests prove that demo tenants are never created automatically.

## Required automated test suite

### Token verification

- valid Supabase token
- expired token
- malformed/tampered token
- wrong issuer/project
- wrong audience
- unknown/deleted profile
- suspended profile
- key rotation behavior

### Tenant isolation

- tenant A cannot read, insert, update, or delete tenant B rows for every tenant table
- forged `X-Tenant-ID` is rejected
- missing tenant header is rejected on tenant routes
- one Auth identity with two memberships can deliberately switch between only those tenants
- inactive/suspended membership is denied immediately
- tenant suspension and allowed billing exceptions retain intended behavior
- platform admin access is tested separately from tenant membership
- unknown, deleted, suspended, and mismatched branded hostnames fail closed
- reserved platform hostnames cannot become tenant slugs
- hostname resolution is tested against forged `Host`/forwarded-host values using an explicit trusted-proxy configuration

### Domain and login surfaces

- database reset removes every dummy domain mapping
- Cloudflare cleanup preserves reserved platform infrastructure and removes each inventoried dummy resource
- `app.kampus.pk` supports membership selection without unauthenticated membership discovery
- a tenant subdomain renders only public branding and admits only that tenant's members
- external custom domains require ownership and TLS verification
- confirmation/recovery callbacks reject unallowlisted origins and open redirects
- access and refresh tokens never appear in URLs or logs
- central and branded sessions follow the documented origin boundary

### Role authorization

- one allow and one deny case for every route/method
- finance and payroll restrictions
- attendance and grading restrictions
- student/guardian self-access boundaries
- membership/role management restrictions
- MFA assurance checks for high-risk actions

### Account lifecycle

- signup plus verified onboarding
- duplicate/idempotent onboarding
- invite new identity
- invite existing identity
- expired/revoked/replayed invitation
- password recovery
- password update with reauthentication
- MFA enrollment/challenge/removal
- sign-out and session revocation behavior
- membership removal and account deletion

### Persistence and failure behavior

- fresh migration/reset
- transaction rollback
- concurrency/duplicate prevention
- database unavailable causes production fail-closed behavior
- runtime role cannot bypass RLS
- service key never appears in frontend output

## Validation commands and evidence

The implementer must discover and use the repository's exact commands, then report at minimum:

- install/lockfile result
- lint/typecheck
- production build
- backend unit tests
- backend/PostgreSQL integration tests
- local Supabase reset and database tests
- frontend auth-flow tests
- production dependency audit
- `git diff --check`
- source searches for prohibited legacy auth and snapshot symbols
- frontend bundle secret scan

Do not report a phase complete with skipped tests, mocked RLS, or only in-memory tests. Record command, exit code, test count, and any warning or exception.

## Implementation discipline for the coding agent

1. Work in phase order because later phases depend on the identity and persistence foundations.
2. Before each phase, list the files and schema objects to change.
3. After each phase, run its gate tests and fix failures before continuing.
4. Do not preserve legacy auth merely to keep old tests green; replace those tests with Supabase behavior tests.
5. Do not add a second authentication abstraction that reimplements Supabase sessions.
6. Do not place role or tenant authority in client-editable metadata.
7. Do not use the service-role client for ordinary ERP queries.
8. Do not weaken RLS to repair integration failures.
9. Keep every tenant lookup explicit and tenant-qualified.
10. At completion, provide a phase-by-phase change report, migration list, environment checklist, test evidence, and all known residual risks.

## Definition of done

- Supabase Auth exclusively owns credentials, sessions, recovery, and MFA.
- Fastify verifies Supabase tokens and resolves a live profile and active tenant membership.
- The same identity can safely belong to multiple tenants.
- Normalized PostgreSQL repositories are the only production persistence path.
- RLS and backend checks independently prevent unauthorized cross-tenant access.
- Role changes and membership suspension take effect immediately.
- There are no hardcoded privileged accounts, custom password/OTP/JWT implementations, or all-tenant runtime snapshots.
- Production configuration, onboarding, invitations, recovery, MFA, audit logging, tests, and operational documentation are complete.
- All validation gates pass from a fresh database.

## Re-audit handoff

After implementation, provide the complete diff and validation output for an independent re-audit. The re-audit should treat the implementation as untrusted and repeat token, tenant-isolation, RLS-bypass, privilege-escalation, invitation-replay, frontend-secret, production-seeding, and fail-closed tests. Passing unit tests alone is insufficient.
