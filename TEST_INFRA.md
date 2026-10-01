# TEST_INFRA.md — Comprehensive E2E Testing Infrastructure (Tiers 1–4)

**Project:** Apex Academy Management System — Audit Remediation (B01–B12)  
**Track:** Dual Track E2E Testing Strategy & Acceptance Test Infrastructure  
**Author:** `test_writer_e2e_1`  
**Date:** 2026-10-01  
**Integrity Mode:** Institutional ERP Grade (Zero AI Slop per GEMINI.md)

---

## 1. Executive Summary & Dual Track Architecture

The Apex Academy Management System ERP operates across distributed boundaries: Cloudflare Pages edge proxy functions (`functions/api/[[catchall]].ts`), Fastify v5 application server (`packages/backend`), React 18 SPA (`packages/frontend`), and PostgreSQL on Supabase (`packages/supabase`).

To guarantee continuous quality and eliminate regressions during the B01–B12 audit remediation, this workspace employs a **Dual Track Engineering Model**:
1. **Implementation Track:** Milestone workers (M1, M2, M3, M4) develop production feature remediations across auth, host resolution, invitations, and migration ledger hardening.
2. **Testing Track (This Infrastructure):** Test writers establish an independent, authoritative 4-Tier test catalog and implement programmatic test suites covering all acceptance criteria prior to deployment gates.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                    DUAL TRACK TEST INFRASTRUCTURE                         │
├─────────────────────────────────────┬─────────────────────────────────────┤
│        IMPLEMENTATION TRACK         │            TESTING TRACK            │
├─────────────────────────────────────┼─────────────────────────────────────┤
│ M1: Auth & Onboarding Lifecycle     │ Tier 1: Isolated Feature Coverage   │
│     (B03, B04, B05, B08, CNIC)      │ (>=5 cases/feature, 90 total)       │
│ M2: Edge-to-Backend Multi-Tenancy   │ Tier 2: Boundary & Corner Cases     │
│     (B06, B07, B09, B10, Unmapped)  │ (>=5 cases/feature, 90 total)       │
│ M3: User Invitation Management      │ Tier 3: Cross-Feature Interactions  │
│     (B11 UI, API, Acceptance Flow)  │ (Pairwise multi-hop transactions)   │
│ M4: Migration Ledger & Packaging    │ Tier 4: Real-World Academy Scenarios│
│     (B12, B01, B02, Verify Release) │ (Production end-to-end lifecycles)  │
└─────────────────────────────────────┴─────────────────────────────────────┘
```

---

## 2. Core Ethos & Zero AI Slop Compliance

All test cases, test data fixtures, assertion messages, and UI mock data strictly comply with `GEMINI.md`:
- **Institutional Pakistani Academy Terminology:** Tests use realistic school parameters: Classes (Class 9, Class 10, F.Sc Pre-Medical), Campuses (Main Campus, Gulberg Campus, F-8 Islamabad Campus), Roles (`tenant_admin`, `academic_head`, `teacher`, `finance_manager`, `parent`, `student`), and Phone/Address formats (`+92 300 1234567`, Lahore, Rawalpindi).
- **Prohibited Buzzwords:** Zero instances of "Mission Control", "Command Center", "360° Profile", "Liquidation Engine", "AI-powered", or "Seamless".
- **Authentic Verification:** Every test validates observable runtime contracts (HTTP status, JSON schemas, DOM components, database state, cryptographic signatures) against authoritative specifications in `PROJECT.md` and `docs/cutover/browser-domain-reaudit-2026-10-01.md`.

---

## 3. Four-Tier Test Strategy Overview

| Tier | Category | Scope & Objective | Target Count |
| :--- | :--- | :--- | :--- |
| **Tier 1** | **Feature Coverage** | Isolates each feature, asserting the primary happy-path behaviors against interface contracts. | 90 test cases (18 features × 5 cases) |
| **Tier 2** | **Boundary & Corner Cases** | Exercises boundary limits, empty inputs, malformed types, nulls, negative numbers, extreme lengths, and security tampering. | 90 test cases (18 features × 5 cases) |
| **Tier 3** | **Cross-Feature Combinations** | Validates pairwise and multi-stage interactions across system boundaries (e.g. Onboard -> Session -> Edge Proxy -> Resolve Host -> Invite -> Accept). | 10 integration interaction suites |
| **Tier 4** | **Real-World Scenarios** | Validates complete institutional operational lifecycles from start to finish under authentic school operating conditions. | 5 end-to-end academy operational flows |

---

## 4. Feature Inventory & 4-Tier Test Matrix

### Feature 1: Academy Registration Payload Alignment (B03)
*Authoritative Source:* `PROJECT.md` § Interface Contracts (M1) & `packages/backend/src/routes/auth.ts:262`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F01-01`: Standard onboarding with canonical `{ name, slug }` payload returns HTTP 201 and provisions tenant.
2. `T1-F01-02`: Onboarding payload with legacy `{ tenant_name, tenant_slug }` is accepted via backwards compatibility transform and returns HTTP 201.
3. `T1-F01-03`: Onboarding with optional institutional details (`campus_name`, `city`, `phone`, `logo_url`) saves all attributes accurately.
4. `T1-F01-04`: Onboarding with uppercase or mixed-case slug (e.g. `"Apex-Premier"`) is automatically lowercased and trimmed to `"apex-premier"`.
5. `T1-F01-05`: Authenticated user creating an academy is automatically assigned the `tenant_admin` role in `tenant_memberships`.

#### Tier 2: Boundary & Corner Cases
1. `T2-F01-01`: Submission missing both `name` and `tenant_name` returns HTTP 400 `VALIDATION_ERROR` with path `['name']`.
2. `T2-F01-02`: Submission with slug shorter than 3 characters (e.g. `"ab"`) or longer than 32 characters returns HTTP 400.
3. `T2-F01-03`: Submission with illegal slug characters (e.g. `"apex academy!"` or `"apex_slug$"`) is rejected or sanitized according to slug rules.
4. `T2-F01-04`: Duplicate slug submission where slug already exists in `public.tenants` returns HTTP 409 `SLUG_TAKEN`.
5. `T2-F01-05`: Unauthenticated request (missing or invalid Bearer token) returns HTTP 401 Unauthorized.

---

### Feature 2: Resumable Onboarding State (B04)
*Authoritative Source:* `PROJECT.md` § Interface Contracts (M1) & `docs/cutover/browser-domain-reaudit-2026-10-01.md` § B04

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F02-01`: `registerAcademy` saves non-sensitive academy draft in `localStorage` under `apex_pending_onboarding_draft` when `signUpData.session` is null.
2. `T1-F02-02`: Draft payload includes `name`, `slug`, `campus_name`, `city`, `phone`, and `admin_email`.
3. `T1-F02-03`: Upon post-confirmation login, `bootstrapSession` detects matching pending draft and calls `/api/v1/auth/onboard-tenant`.
4. `T1-F02-04`: Upon successful automatic onboarding, the local draft `apex_pending_onboarding_draft` is deleted from storage.
5. `T1-F02-05`: State transition updates `membershipState` to `'ready'` and loads the newly provisioned tenant directly into application state.

#### Tier 2: Boundary & Corner Cases
1. `T2-F02-01`: Draft in `localStorage` never contains the cleartext user password under any circumstances.
2. `T2-F02-02`: Draft with mismatched email is ignored when a different authenticated user logs in.
3. `T2-F02-03`: Malformed or corrupted JSON in `apex_pending_onboarding_draft` fails safely without throwing unhandled exceptions.
4. `T2-F02-04`: Expired draft (timestamp older than 7 days) is pruned and not automatically executed.
5. `T2-F02-05`: If slug became unavailable between signup and email confirmation, UI transitions to `onboarding_slug_conflict` allowing alternative slug selection.

---

### Feature 3: Dedicated Password Recovery Screen (B05)
*Authoritative Source:* `PROJECT.md` § Interface Contracts (M1) & `packages/frontend/src/components/PasswordRecoveryModal.tsx`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F03-01`: Arrival with URL hash containing `#reset-password` activates `isPasswordRecoveryMode`.
2. `T1-F03-02`: Supabase `PASSWORD_RECOVERY` auth event triggers `PasswordRecoveryModal` display.
3. `T1-F03-03`: Submitting matching new passwords (minimum 8 characters) invokes `supabase.auth.updateUser({ password })`.
4. `T1-F03-04`: Successful password update clears `isPasswordRecoveryMode` and cleans URL hash via `replaceState`.
5. `T1-F03-05`: Dedicated modal renders cleanly without being blocked by `NoMembershipsAdvisory`.

#### Tier 2: Boundary & Corner Cases
1. `T2-F03-01`: Submission with password shorter than 8 characters is rejected with validation message.
2. `T2-F03-02`: Submission where password and confirm password do not match is rejected prior to API dispatch.
3. `T2-F03-03`: Expired recovery token emits Supabase error and displays clear institutional error notice.
4. `T2-F03-04`: User with zero academy memberships can still complete password reset without being locked out.
5. `T2-F03-05`: Rapid duplicate clicks on "Update Password" button disable the button to prevent duplicate RPC calls.

---

### Feature 4: Platform Superadmin Zero-Membership Entry (B08)
*Authoritative Source:* `PROJECT.md` § Interface Contracts (M1) & `packages/frontend/src/context/AuthContext.tsx`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F04-01`: Authenticated user with `profile.platform_role === 'super_admin'` and `memberships: []` enters system with `membershipState = 'platform_superadmin'` (or `'ready'`).
2. `T1-F04-02`: Superadmin with zero memberships defaults to `currentScreen = 'superadmin'`.
3. `T1-F04-03`: `App.tsx` renders `SuperAdminControlPlaneView` directly without displaying `NoMembershipsAdvisory`.
4. `T1-F04-04`: Superadmin profile retains `role = 'super_admin'` and `permissions = ['all']`.
5. `T1-F04-05`: Platform control plane API calls to `/api/v1/saas/*` succeed with superadmin Bearer token without `X-Tenant-ID`.

#### Tier 2: Boundary & Corner Cases
1. `T2-F04-01`: Ordinary user (`platform_role = null`) with zero memberships is strictly redirected to `NoMembershipsAdvisory`.
2. `T2-F04-02`: Superadmin with 1 or more memberships can toggle between tenant context and global platform mode.
3. `T2-F04-03`: Client-side tampering of profile object cannot bypass backend RLS on platform endpoints.
4. `T2-F04-04`: Suspended superadmin profile (`is_active = false`) is rejected with HTTP 403 `ACCOUNT_NOT_ACTIVE`.
5. `T2-F04-05`: Request to `/api/v1/saas/*` by a tenant admin is rejected with HTTP 403 `FORBIDDEN_ROLE`.

---

### Feature 5: Explicit Email Login Standardization
*Authoritative Source:* `PROJECT.md` § R1 & `packages/frontend/src/components/LoginModal.tsx`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F05-01`: Login form displays explicit "Institutional Email Address" label and email input type.
2. `T1-F05-02`: Valid email and password triggers `supabase.auth.signInWithPassword({ email, password })`.
3. `T1-F05-03`: Student profile and guardian forms preserve `guardian_id_card` (CNIC) as demographic data without conflating with login credentials.
4. `T1-F05-04`: Input trimming automatically trims leading and trailing whitespace from the email.
5. `T1-F05-05`: Error message on failed login clearly references email or password credentials.

#### Tier 2: Boundary & Corner Cases
1. `T2-F05-01`: Submitting Pakistani CNIC pattern (`37405-1234567-1`) without domain emits frontend validation requiring a valid email format.
2. `T2-F05-02`: Empty email or empty password prevents form submission.
3. `T2-F05-03`: Malformed email format (`"admin@"`, `"admin@.com"`) fails HTML5 and client-side email validation.
4. `T2-F05-04`: Case-insensitivity: uppercase email (`"Admin@Academy.Edu.Pk"`) is normalized to lowercase prior to authentication.
5. `T2-F05-05`: Password masking: password field uses `type="password"` with secure toggle.

---

### Feature 6: Secure Edge Proxy Host Forwarding (B06, B07)
*Authoritative Source:* `PROJECT.md` § Interface Contracts (M2) & `functions/api/[[catchall]].ts`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F06-01`: Proxy extracts `url.hostname` and sets `X-Forwarded-Host: url.hostname` on upstream request.
2. `T1-F06-02`: Proxy injects shared `X-Edge-Proxy-Secret` configured in environment.
3. `T1-F06-03`: Proxy rewrites `Host` header to upstream backend hostname (`targetHostname`) for TLS SNI routing.
4. `T1-F06-04`: Proxy forwards HTTP methods (GET, POST, PUT, DELETE, PATCH, OPTIONS) with intact query strings and bodies.
5. `T1-F06-05`: Preflight OPTIONS requests return 204 with required CORS headers and allow `X-Tenant-ID`.

#### Tier 2: Boundary & Corner Cases
1. `T2-F06-01`: Incoming client-supplied `X-Forwarded-Host` is stripped or overwritten by the edge proxy.
2. `T2-F06-02`: Incoming client-supplied `X-Edge-Proxy-Secret` is stripped and replaced with the genuine server-side secret.
3. `T2-F06-03`: Request to unmapped or invalid path returns 502 with structured `BACKEND_GATEWAY_ERROR` if backend is unreachable.
4. `T2-F06-04`: Hostnames with custom ports (e.g. `localhost:3000`) are safely parsed without port corruption in `X-Forwarded-Host`.
5. `T2-F06-05`: Large payloads (e.g. student batch uploads) stream through the proxy with `duplex: 'half'` without truncation.

---

### Feature 7: Secure Backend Host Tenant Resolution
*Authoritative Source:* `PROJECT.md` § Interface Contracts (M2) & `packages/backend/src/lib/tenant-resolver.ts`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F07-01`: Request with matching `X-Edge-Proxy-Secret` trusts `X-Forwarded-Host` and resolves tenant accordingly.
2. `T1-F07-02`: Subdomain request (e.g. `alpha.kampus.pk`) resolves to tenant with slug `'alpha'`.
3. `T1-F07-03`: Central platform domain (`app.kampus.pk` or `localhost`) resolves as central platform mode (`isCentralHost: true`).
4. `T1-F07-04`: Development environment without configured secret falls back to direct `Host` or `request.hostname`.
5. `T1-F07-05`: Resolved tenant context binds `tenant_id` to `app.current_tenant_id` in database transaction.

#### Tier 2: Boundary & Corner Cases
1. `T2-F07-01`: Spoofing test: Request from direct client with forged `X-Forwarded-Host` but NO valid `X-Edge-Proxy-Secret` ignores the forwarded host.
2. `T2-F07-02`: Request with invalid or expired `X-Edge-Proxy-Secret` falls back to direct `Host` header.
3. `T2-F07-03`: Comma-separated multi-proxy `X-Forwarded-Host` (e.g. `"spoofed.com, real.com"`) safely extracts only the verified client host.
4. `T2-F07-04`: Host containing whitespace or non-ASCII characters is sanitized before database lookup.
5. `T2-F07-05`: Direct request to backend IP address without host mapping returns `UNMAPPED_HOST`.

---

### Feature 8: Canonical Custom Domain Host Mapping (B09)
*Authoritative Source:* `PROJECT.md` § Interface Contracts (M2) & `packages/backend/src/routes/auth.ts:resolve-host`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F08-01`: `GET /api/v1/auth/resolve-host?host=portal.myacademy.edu.pk` resolves to active tenant `tenant_id` and canonical `tenant_slug`.
2. `T1-F08-02`: Custom domain response sets `is_custom_domain: true` and includes branding metadata.
3. `T1-F08-03`: Frontend `host.ts` sets `tenantSlug` to canonical database slug (not the custom domain FQDN).
4. `T1-F08-04`: Membership comparison matches `m.tenant_slug === hostInfo.tenantSlug`, allowing custom domain users to log in successfully.
5. `T1-F08-05`: UI displays clean custom domain hostname without appending `.kampus.pk`.

#### Tier 2: Boundary & Corner Cases
1. `T2-F08-01`: Custom domain registered to pending or inactive tenant returns appropriate inactive domain notice.
2. `T2-F08-02`: Uppercase custom domain (e.g. `PORTAL.MYACADEMY.EDU.PK`) resolves identically to lowercase domain.
3. `T2-F08-03`: Domain with trailing period (`portal.myacademy.edu.pk.`) is normalized cleanly.
4. `T2-F08-04`: Query parameter with non-existent custom domain returns HTTP 404 with `code: 'UNMAPPED_HOST'`.
5. `T2-F08-05`: User attempting to access Custom Domain A with credentials for Tenant B is rejected with `unauthorized_for_branded_host`.

---

### Feature 9: Cloudflare Domain Provisioning Hardening (B10)
*Authoritative Source:* `PROJECT.md` § Interface Contracts (M2) & `packages/backend/src/services/cloudflare.ts`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F09-01`: `provisionSubdomain` creates DNS record and attaches hostname to Cloudflare Pages project.
2. `T1-F09-02`: Successful provisioning sets `status: 'active'` only after verifying Pages attachment.
3. `T1-F09-03`: Record ID and domain details are returned in response object.
4. `T1-F09-04`: Idempotent retry: Re-attaching already registered hostname detects existing status and succeeds cleanly.
5. `T1-F09-05`: Provisioning logs operational audit entry recording domain attachment attempt.

#### Tier 2: Boundary & Corner Cases
1. `T2-F09-01`: `attachPagesHostname` error (HTTP 400 or 403) is propagated; `provisionSubdomain` returns `status: 'failed'` with error detail.
2. `T2-F09-02`: Missing `CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_PAGES_PROJECT` returns `status: 'failed'` instead of silently declaring active.
3. `T2-F09-03`: Network timeout during Cloudflare API call is caught and returns explicit timeout error.
4. `T2-F09-04`: Invalid characters in requested subdomain (e.g. `sub_domain` with underscore) fail domain validation.
5. `T2-F09-05`: Cloudflare rate limit (HTTP 429) triggers backoff retry and fails gracefully if retry budget is exhausted.

---

### Feature 10: Explicit Unavailable Domain Screen
*Authoritative Source:* `PROJECT.md` § Feature Inventory & `packages/frontend/src/components/UnavailableDomainAdvisory.tsx`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F10-01`: Visiting unmapped hostname renders `UnavailableDomainAdvisory` component.
2. `T1-F10-02`: Advisory displays explicit text: "Academy Portal Not Found".
3. `T1-F10-03`: Advisory displays the unmapped hostname in monospaced font.
4. `T1-F10-04`: Advisory contains a link/button to "Go to Central Portal (app.kampus.pk)".
5. `T1-F10-05`: Advisory suppresses the login form, preventing users from attempting authentication on a nonexistent tenant.

#### Tier 2: Boundary & Corner Cases
1. `T2-F10-01`: Visiting retired domain (`tsa.kampus.pk`) renders `UnavailableDomainAdvisory` instead of synthetic "The Smart Academy" title.
2. `T2-F10-02`: Visiting random unknown domain (`random.kampus.pk`) does not invent synthetic `${slug.toUpperCase()} Academy`.
3. `T2-F10-03`: Advisory contains zero AI slop, zero emojis, and uses institutional neutral slate styling.
4. `T2-F10-04`: Deep link under unmapped domain (e.g. `unknown.kampus.pk/#dashboard`) halts at advisory and does not leak views.
5. `T2-F10-05`: Clicking "Go to Central Portal" navigates cleanly to central portal origin.

---

### Feature 11: Admin Invitation Management UI (B11)
*Authoritative Source:* `PROJECT.md` § Interface Contracts (M3) & `packages/frontend/src/components/InvitationsManagementModal.tsx`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F11-01`: Admin opens Staff Desk / Settings and sees "Staff & Member Invitations" section.
2. `T1-F11-02`: Admin creates invitation specifying recipient email and role (`teacher`, `academic_head`, etc.).
3. `T1-F11-03`: UI displays generated invitation link (`/#invite/<token>`).
4. `T1-F11-04`: "Copy Link" button copies the URL to clipboard and provides visual feedback.
5. `T1-F11-05`: Admin can revoke a pending invitation, updating its status badge to "Revoked".

#### Tier 2: Boundary & Corner Cases
1. `T2-F11-01`: Non-admin staff members cannot see or access invitation creation controls.
2. `T2-F11-02`: Submitting invalid email format in invitation modal displays validation error.
3. `T2-F11-03`: Inviting an email that already has an active invitation displays duplicate invitation advisory.
4. `T2-F11-04`: Revoking an already accepted invitation is prevented with appropriate notice.
5. `T2-F11-05`: Table displays pagination/scrolling when tenant has dozens of issued invitations.

---

### Feature 12: Backend Invitation Listing Endpoint (B11)
*Authoritative Source:* `PROJECT.md` § Interface Contracts (M3) & `packages/backend/src/routes/auth.ts`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F12-01`: `GET /api/v1/auth/invitations` with valid tenant admin token returns array of invitations for that tenant.
2. `T1-F12-02`: Response includes `id`, `email`, `role`, `expires_at`, `status`, `created_at`.
3. `T1-F12-03`: Results are strictly scoped to the tenant specified in `X-Tenant-ID`.
4. `T1-F12-04`: Status correctly computes as `'pending'`, `'accepted'`, `'revoked'`, or `'expired'`.
5. `T1-F12-05`: Invitations list is ordered descending by creation date.

#### Tier 2: Boundary & Corner Cases
1. `T2-F12-01`: Calling `GET /api/v1/auth/invitations` without `X-Tenant-ID` returns HTTP 400 `TENANT_REQUIRED`.
2. `T2-F12-02`: Calling endpoint as a teacher or parent returns HTTP 403 `FORBIDDEN_ROLE`.
3. `T2-F12-03`: Tenant A admin cannot view Tenant B invitations (cross-tenant isolation).
4. `T2-F12-04`: Calling endpoint with unauthenticated token returns HTTP 401.
5. `T2-F12-05`: Tenant with zero invitations returns empty array `[]` with HTTP 200.

---

### Feature 13: Recipient Invitation Acceptance Flow (B11)
*Authoritative Source:* `PROJECT.md` § Interface Contracts (M3) & `packages/frontend/src/views/AcceptInvitationView.tsx`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F13-01`: Visiting `/#invite/:token` calls `GET /api/v1/auth/invitations/:token/inspect` and displays academy details.
2. `T1-F13-02`: Authenticated user whose email matches the invitation sees "Accept Invitation & Join Academy".
3. `T1-F13-03`: Clicking accept invokes `POST /api/v1/auth/invitations/accept` with token.
4. `T1-F13-04`: Successful acceptance creates `tenant_memberships` record with assigned role.
5. `T1-F13-05`: On success, user session refreshes and redirects to academy dashboard.

#### Tier 2: Boundary & Corner Cases
1. `T2-F13-01`: Visiting expired invitation link displays "Invitation Expired" advisory.
2. `T2-F13-02`: Visiting revoked invitation link displays "Invitation Revoked" advisory.
3. `T2-F13-03`: Visiting invalid or non-existent token displays "Invalid Invitation" error.
4. `T2-F13-04`: Authenticated user with email `teacher_b@gmail.com` attempting to accept invitation issued to `teacher_a@gmail.com` receives `EMAIL_MISMATCH` 403 error.
5. `T2-F13-05`: Repeated submission on already accepted invitation returns `ALREADY_ACCEPTED`.

---

### Feature 14: Migration 00028 Drift Reconciliation (B12)
*Authoritative Source:* `PROJECT.md` § Interface Contracts (M4) & `packages/supabase/migrations/00029_*.sql`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F14-01`: Migration 00029 applies cleanly on top of existing staging database with 28 migrations.
2. `T1-F14-02`: Migration 00029 preserves all historical migration rows without deleting or truncating `schema_migrations`.
3. `T1-F14-03`: Function ACLs on `lookup_profile_by_auth_id` and `lookup_profile_by_email` remain revoked from `PUBLIC` and `anon`.
4. `T1-F14-04`: Audit log purge trigger `prevent_audit_log_modification()` remains enforced.
5. `T1-F14-05`: Clean greenfield database applying 00001 through 00029 completes with zero errors.

#### Tier 2: Boundary & Corner Cases
1. `T2-F14-01`: Re-running Migration 00029 is strictly idempotent and does not corrupt schema state.
2. `T2-F14-02`: Historical checksum for 00028 matches recognized alias in runner preflight.
3. `T2-F14-03`: Unprivileged database role (`fastify_runtime`) cannot run migration scripts (fails 42501).
4. `T2-F14-04`: Transaction rollback test: A simulated SQL error inside a migration aborts the transaction cleanly.
5. `T2-F14-05`: Migration ledger records authentic UTC timestamp on applied migrations.

---

### Feature 15: Migration Runner Drift Hardening (B12)
*Authoritative Source:* `PROJECT.md` § Interface Contracts (M4) & `packages/supabase/scripts/migrate.ts`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F15-01`: Runner verifies SHA-256 checksum of all on-disk migration files against `schema_migrations`.
2. `T1-F15-02`: Clean database matching checksums applies pending migrations smoothly.
3. `T1-F15-03`: Known historical aliases (such as staging 00028 baseline) are recognized and permitted.
4. `T1-F15-04`: Runner asserts all recorded versions in the database exist on disk.
5. `T1-F15-05`: Runner logs clear verification status for each inspected migration file.

#### Tier 2: Boundary & Corner Cases
1. `T2-F15-01`: Runner modifies a historical migration file on disk (tampered file) and asserts runner aborts with `DATABASE_MIGRATION_INTEGRITY_VIOLATION`.
2. `T2-F15-02`: Tampering detection occurs BEFORE any pending migration SQL is executed.
3. `T2-F15-03`: Missing migration file on disk for a recorded database version halts execution.
4. `T2-F15-04`: Modified migration file message prints recorded vs calculated checksums for operator auditability.
5. `T2-F15-05`: Runner fails closed if database connection is lost during checksum verification.

---

### Feature 16: Frontend Supabase Build Var Validation (B01)
*Authoritative Source:* `PROJECT.md` § Interface Contracts (M4) & `packages/frontend/vite.config.ts`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F16-01`: Production build with valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` succeeds cleanly.
2. `T1-F16-02`: Build compiles environment variables into distribution bundle without placeholder values.
3. `T1-F16-03`: Development mode allows local development with warning if variables are absent.
4. `T1-F16-04`: Production runtime `packages/frontend/src/lib/supabase.ts` throws error if initialized with placeholders in PROD.
5. `T1-F16-05`: Build scripts read variables from workspace `.env` or system environment.

#### Tier 2: Boundary & Corner Cases
1. `T2-F16-01`: Production build with empty `VITE_SUPABASE_URL` throws build error and exits non-zero.
2. `T2-F16-02`: Production build with placeholder `https://placeholder.supabase.co` throws configuration error.
3. `T2-F16-03`: Production build with placeholder anon key `placeholder-anon-key` throws configuration error.
4. `T2-F16-04`: Production build fails closed if `VITE_SUPABASE_ANON_KEY` is a malformed JWT.
5. `T2-F16-05`: Service-role key (`SUPABASE_SERVICE_ROLE_KEY`) is never bundled into frontend assets (verified via bundle scan).

---

### Feature 17: Release Packaging Verification (B02)
*Authoritative Source:* `PROJECT.md` § R5 & `scripts/verify-release-package.ts`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F17-01`: `release:check` script verifies existence and non-zero size of all build distribution files.
2. `T1-F17-02`: Script verifies frontend bundle contains Supabase auth cutover markers (`kampus.sb.auth.token`).
3. `T1-F17-03`: Script verifies frontend bundle contains zero legacy auth endpoints (`/api/v1/auth/login`).
4. `T1-F17-04`: Script verifies edge proxy function `functions/api/[[catchall]].ts` compiles with correct types.
5. `T1-F17-05`: Script produces clear release integrity checklist output with exit code 0.

#### Tier 2: Boundary & Corner Cases
1. `T2-F17-01`: Missing `dist/` directory causes release verification script to fail immediately.
2. `T2-F17-02`: Bundle containing forbidden patterns (e.g. `service_role_key`, database passwords) fails verification.
3. `T2-F17-03`: Outdated bundle built from old git commit fails release verification.
4. `T2-F17-04`: Verification script asserts TypeScript compile pass (`tsc -b`) across all packages.
5. `T2-F17-05`: Verification script asserts zero linting errors across workspace.

---

### Feature 18: E2E Test Suite (Tiers 1–4) Acceptance Pass
*Authoritative Source:* `PROJECT.md` § Milestones & `TEST_INFRA.md`

#### Tier 1: Feature Coverage (Happy Path)
1. `T1-F18-01`: Automated test harness executes all acceptance test suites across packages.
2. `T1-F18-02`: Test runner reports unambiguous pass/fail status and execution durations.
3. `T1-F18-03`: Test runner operates cleanly in both local development and CI environments.
4. `T1-F18-04`: Mock servers and in-memory test databases initialize and tear down without residual leaks.
5. `T1-F18-05`: Test suite completes within specified timeout budgets (< 60 seconds total execution).

#### Tier 2: Boundary & Corner Cases
1. `T2-F18-01`: Test runner fails closed with non-zero exit code if any single assertion fails.
2. `T2-F18-02`: Runner handles unhandled promise rejections and logs stack traces.
3. `T2-F18-03`: Concurrency safety: Parallel test workers do not interfere with each other's test fixtures.
4. `T2-F18-04`: Database port/connection exhaustion is prevented through connection pooling or client reuse.
5. `T2-F18-05`: Runner outputs structured test metrics and coverage data.

---

## 5. Tier 3: Cross-Feature Combinations (Pairwise & Multi-Boundary Matrix)

Tier 3 exercises the complex interactions that occur across architectural layers (Browser SPA -> Edge Proxy -> Fastify API -> PostgreSQL RLS):

| ID | Combined Features | Scenario Description | Expected Outcome |
| :--- | :--- | :--- | :--- |
| `T3-INT-01` | F01 + F02 + F07 | Director registers academy -> session requires email confirmation -> draft saved -> director confirms -> session resumes -> tenant onboarded. | End-to-end onboarding succeeds; director is logged in as `tenant_admin` of the newly created academy. |
| `T3-INT-02` | F06 + F07 + F08 | Browser accesses `alpha.custom.edu.pk` -> Edge proxy injects `X-Forwarded-Host` + `X-Edge-Proxy-Secret` -> Backend resolves canonical slug `'alpha'` -> Frontend matches membership. | User is authenticated into Tenant Alpha without `unauthorized_for_branded_host` error; URL retains clean custom domain. |
| `T3-INT-03` | F06 + F07 + F10 | Attacker sends direct request to backend with spoofed `X-Forwarded-Host: victim.kampus.pk` but missing edge secret -> Backend rejects forwarded host -> Resolves as unmapped or direct. | Backend falls back to direct host; tenant isolation prevents arbitrary host boundary spoofing. |
| `T3-INT-04` | F11 + F12 + F13 | Tenant admin creates invitation -> lists invitations via GET -> copies link -> invitee opens link -> inspects details -> accepts invitation. | Invitee is added to `tenant_memberships` with designated role; invitation marks `accepted_at`; session refreshes to active tenant. |
| `T3-INT-05` | F03 + F04 | Platform superadmin with zero memberships requests password reset -> completes `#reset-password` -> enters control plane directly. | Superadmin updates password without membership lockout; lands in `SuperAdminControlPlaneView` with full governance access. |
| `T3-INT-06` | F08 + F09 | Tenant admin configures custom domain -> Cloudflare provisioning initiates -> attachment verification succeeds -> host resolver binds domain. | Domain moves from `pending` to `active` in `public.tenant_domains`; host resolution immediately maps incoming domain. |
| `T3-INT-07` | F14 + F15 | Migration runner executes against database with applied 00028 -> runner validates alias checksum -> applies Migration 00029 -> ledger harmonized. | Runner succeeds without error; drift is reconciled with full audit record in `schema_migrations` and `audit_logs`. |
| `T3-INT-08` | F05 + F13 | User invited to academy -> arrives with unregistered email -> signs up with matching email -> accepts invitation -> completes onboarding. | Clean onboarding without CNIC confusion; user is immediately placed into the target academy. |
| `T3-INT-09` | F01 + F09 | Director onboards new tenant -> backend triggers Cloudflare subdomain provisioning -> fails with Cloudflare API 400 -> error caught and logged. | Tenant creation completes in DB; domain record marks `status: 'failed'` with error detail; onboarding does not crash. |
| `T3-INT-10` | F16 + F17 | Production build runs with valid Supabase env vars -> dist assets created -> `release:check` runs -> asserts bundle integrity and zero leaks. | Full release pipeline validates bundle cutover markers and passes all quality checks. |

---

## 6. Tier 4: Real-World Academy Application Scenarios

Tier 4 exercises complete institutional lifecycles typical of real Pakistani school operations:

### Scenario 1: New Academy Founding & Branch Setup
**Workflow:**
1. A school director visits `app.kampus.pk` and submits the registration form for "Apex Premier Academy" (slug: `apex-premier`, campus: "Main Campus", city: "Lahore", phone: "+92 300 1234567").
2. The platform sends a Supabase email confirmation link; local storage preserves the draft.
3. The director clicks the confirmation link, landing on `/#onboarding-confirmed`.
4. Session bootstrap resumes the draft, successfully calling `/api/v1/auth/onboard-tenant` with `{ name, slug, campus_name, city, phone }`.
5. The director enters the portal, configures class structures (Class 9, Class 10), and sets up academic terms.

### Scenario 2: Staff Invitation, Delegation & Claims
**Workflow:**
1. The academy administrator navigates to Staff Desk -> Staff & Member Invitations.
2. The administrator issues an invitation to `headmaster@apexpremier.edu.pk` with role `academic_head`.
3. The administrator copies the generated secure link (`https://app.kampus.pk/#invite/token-123`).
4. The headmaster opens the link, inspects the invitation details (Academy: "Apex Premier Academy", Role: "Academic Head"), signs in with their verified email, and clicks "Accept Invitation & Join Academy".
5. The headmaster's session switches to Apex Premier Academy with full academic governance permissions.

### Scenario 3: Custom Domain Onboarding & Edge Host Resolution
**Workflow:**
1. Apex Premier Academy upgrades to an institutional custom domain: `portal.apexpremier.edu.pk`.
2. Cloudflare Pages custom domain is attached and verified.
3. An instructor visits `https://portal.apexpremier.edu.pk/`.
4. The Cloudflare Pages edge proxy intercepts the request, attaches `X-Forwarded-Host: portal.apexpremier.edu.pk` and `X-Edge-Proxy-Secret`.
5. The backend resolves the custom domain to tenant slug `'apex-premier'`.
6. The frontend renders the portal with custom academy branding and no synthetic domain concatenation.

### Scenario 4: Platform Superadmin Multi-Tenant Inspection
**Workflow:**
1. A platform SaaS superadmin signs in with verified platform credentials.
2. The superadmin has 0 academy memberships in `public.tenant_memberships`.
3. The frontend bootstrap checks `profile.platform_role === 'super_admin'`, sets `membershipState = 'ready'`, and navigates to `#superadmin`.
4. The superadmin inspects tenant metrics, provisions resources, and reviews platform audit logs across all academies without being blocked by `NoMembershipsAdvisory`.

### Scenario 5: Dedicated Password Reset for Locked Staff Member
**Workflow:**
1. A teacher forgets their password and clicks "Forgot Password" on the login modal.
2. An email with `#reset-password` is dispatched.
3. The teacher clicks the link and is presented with `PasswordRecoveryModal` regardless of whether their academy membership is active.
4. The teacher enters a strong 12-character password.
5. The password updates successfully in Supabase Auth, and the teacher signs in to resume gradebook entry.

---

## 7. Programmatic Test Suite Implementation Plan

To execute these tests programmatically, we implement automated test suites covering all required acceptance criteria:

1. `packages/backend/tests/b01_b12_acceptance_e2e.test.ts`:
   - Academy registration payload integration test (valid `{ name, slug }` vs `{ tenant_name, tenant_slug }` vs invalid payload rejection).
   - Platform superadmin test (entry and control plane access with 0 memberships).
   - Edge proxy forwarding tests (host preservation with proxy secret vs untrusted header rejection).
   - Custom domain host mapping tests (tenant resolution and canonical slug mapping).
   - Cloudflare provisioning test (error propagation and status tracking when attachment fails).
   - Unknown host test (explicit `UNMAPPED_HOST` 404 response).
   - Invitation flow tests (invitation creation, listing, inspection, and acceptance).
2. `packages/frontend/tests/auth_lifecycle_acceptance.test.ts`:
   - Resumable onboarding state test (draft preservation in storage and post-confirmation auto-submission).
   - Password recovery flow test (rendering of new-password modal and password update completion).
   - Unknown host UI test (explicit `UnavailableDomainAdvisory` rendering instead of synthetic title).
   - Explicit email login standardization test (clean email inputs and CNIC isolation).
3. `packages/supabase/tests/migration_runner_drift.test.ts`:
   - Migration runner test (verifies modified historical migration files on disk trigger `DATABASE_MIGRATION_INTEGRITY_VIOLATION`).
   - Migration 00028 checksum reconciliation test (verifies recognized alias permits execution).

---

## 8. Verification & Execution Commands

| Test Suite | Command | Expected Result |
| :--- | :--- | :--- |
| **Backend Acceptance Suite** | `pnpm --filter @apex/backend test tests/b01_b12_acceptance_e2e.test.ts` | 100% Pass (All API & boundary contracts verified) |
| **Frontend Lifecycle Suite** | `pnpm --filter @apex/frontend test tests/auth_lifecycle_acceptance.test.ts` | 100% Pass (All UI & lifecycle flows verified) |
| **Migration Drift Suite** | `pnpm --filter @apex/supabase test tests/migration_runner_drift.test.ts` | 100% Pass (Drift rejection verified) |
| **Full Workspace Quality Gates** | `pnpm test && pnpm lint && pnpm build` | 0 errors across all 5 workspace packages |

---

*End of TEST_INFRA.md*
