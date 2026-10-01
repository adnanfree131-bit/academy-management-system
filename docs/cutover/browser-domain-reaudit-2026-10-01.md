# Browser, domain, and deployment re-audit — 2026-10-01

## Verdict

The independently executed 15-scenario remote Supabase backend suite passed and its temporary data was independently verified absent. That result remains valid for its tested scope. The live website is serving older code and different data. Current frontend onboarding, recovery, custom-domain entry, and platform-superadmin entry have additional defects that the 15-scenario suite does not cover. Production browser acceptance is incomplete.

No production code, DNS, Cloudflare settings, authentication credentials, or database contents were changed during this investigation. Temporary scripts were placed under `/tmp`; an isolated Vite server used fake Supabase configuration. Local browser scenarios intercepted authentication and API requests with synthetic responses. Those scenarios are UI reproductions, not genuine Supabase authentication tests.

## Evidence and limitations

- Playwright 1.63.0 successfully launched installed `/usr/bin/google-chrome` with `chromiumSandbox: true`. The gstack bundled Chromium launch failed. A browser extension is not required.
- Live browser inspection of `app.kampus.pk` and `tsa.kampus.pk`; inspection of public frontend JavaScript and public API GET responses.
- Read-only Cloudflare DNS and Pages API inspection using existing credentials. Cloudflare Custom Hostnames inspection returned HTTP 403, so its configuration remains unassessed.
- Read-only staging PostgreSQL inspection of tenants, domain mappings, and the migration ledger.
- Actual backend onboarding route executed with an isolated in-memory store and a synthetic verifier to test payload validation only.
- Actual Pages proxy handler executed with a mocked outbound fetch to observe host forwarding.
- Actual current frontend rendered in local Chrome with mocked identity/API responses for recovery, custom-domain selection, superadmin entry, unknown branding, and registration requiring confirmation.
- No recovery/invitation email was sent. No real password was entered or changed. Live authenticated login, token refresh, and logout were not completed; the deployed site uses the previous auth system and no appropriate disposable live account was used.

## Findings

### B01 — High: Live deployment does not contain the audited Supabase cutover

Cloudflare Pages production branch is `main`. Its canonical deployment was created on 2026-09-29 at 04:38:35 UTC from commit `9b4fa4e94f83324e7d3a815f696dfa11816897a0`.

Live `/assets/index-DdoywWnT.js` contains `/api/v1/auth/login` and `/api/v1/auth/forgot-password`; it contains neither `signInWithPassword`, `resetPasswordForEmail`, nor `kampus.sb.auth.token`. No Supabase host was found in that entry asset. Live `/api/v1/auth/session` returns HTTP 404. Together these establish deployment mismatch, rather than inferring it solely from the deployment date.

**Repair:** Establish an explicit release commit containing all reviewed changes. Configure and deploy the frontend, backend, edge proxy, and database as one verified cutover. Confirm the real backend selected by the Pages proxy; do not assume the Render service is receiving requests. Do not deploy the current code until the other blockers below are addressed.

### B02 — High: Supabase frontend build variables are absent in Pages

Cloudflare Pages preview and production deployment configurations contain only `COREPACK_INTEGRITY_KEYS`, `NODE_VERSION`, and `PNPM_VERSION`. Neither contains `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY`. Those two frontend variables are also absent in the root environment inspected locally.

`packages/frontend/src/lib/supabase.ts` constructs a client with `https://placeholder.supabase.co` and `placeholder-anon-key` when variables are missing. Vite environment values are compiled into the frontend; setting only backend environment values will not supply them.

**Repair:** Configure the correct project URL and browser publishable/anon key for the intended environment and fail the production build when required frontend variables are absent. Keep service-role keys exclusively on the backend.

### B03 — High: Academy registration payload is rejected by the backend

`packages/frontend/src/context/AuthContext.tsx:508` sends `tenant_name` and `tenant_slug`. `packages/backend/src/routes/auth.ts:262` requires `name` and `slug`.

Actual route reproduction with the frontend-shaped request returned HTTP 400 `VALIDATION_ERROR`, with `name: Required` and `slug: Required`. This did not create any live data.

**Repair:** Share a canonical request schema/type and use its field names. Test registration through the actual frontend-to-backend contract, rather than only the transaction helper.

### B04 — High: Email-confirmation registration does not resume academy setup

`AuthContext.tsx:492` returns when signup provides no session, instructing the user to confirm email. The academy name, slug, and other setup fields are not persisted as resumable onboarding state. Subsequent session bootstrap treats an identity with no memberships as `no_memberships`.

Local browser reproduction made one mocked signup request and zero onboarding requests. It showed the confirmation instruction, then lost the academy setup after reload. A separately simulated confirmed session with no memberships displayed the advisory whose only actions are refresh and sign out.

**Repair:** Implement resumable, authenticated academy onboarding after confirmation, including validation of slug availability at final submission. Store no password in the draft. Distinguish a director completing setup from an invited user waiting for membership.

### B05 — High: Password recovery has no completion screen

`AuthContext.tsx:378` requests recovery with a redirect to `/#reset-password`. No frontend `PASSWORD_RECOVERY` handler or dedicated recovery completion route/screen was found. The main hash parser treats the fragment as an ordinary screen identifier.

In an isolated browser scenario, a synthetic recovery session was accepted by the mocked Auth service, but the frontend showed `No Academy Memberships Found` and rendered zero password inputs.

**Repair:** Handle recovery callback/session establishment explicitly, render a dedicated new-password form independent of academy membership, and clear recovery state afterward. Test expired, malformed, consumed, and valid links. Align recovery redirects with the actual allowed callback configuration. Email delivery and real password mutation remain untested.

### B06 — High: Pages proxy discards the host needed by backend tenant resolution

`functions/api/[[catchall]].ts:31` replaces `Host` with the upstream backend host without preserving the original academy hostname. The current Fastify construction does not enable a trusted proxy-host resolution mechanism; `normalizeEffectiveHostname()` relies on `request.hostname`.

Executing the actual proxy handler on `https://alpha.kampus.pk/api/v1/auth/session` with a mocked upstream produced `Host: backend.example.test` and no `X-Forwarded-Host`. Thus the backend is not given the browser academy hostname in this path.

**Repair:** Define a trustworthy origin-host forwarding contract between Pages and the backend. Overwrite untrusted incoming forwarding headers at the edge. Authenticate or otherwise constrain the proxy hop, configure trust narrowly, and test central, subdomain, custom-domain, spoofed-header, and direct-backend requests through the actual proxy. Simply enabling unrestricted `trustProxy` would not be an adequate fix.

### B07 — High: Custom-domain members are rejected by frontend slug comparison

`packages/frontend/src/lib/host.ts:72` places the complete custom hostname into `tenantSlug`. `AuthContext.tsx:219` compares that value with the membership's ordinary academy slug.

The isolated browser custom-domain path used `portal.example.test` and an active membership with slug `alpha`. The frontend displayed `Campus Access Restricted`, despite that membership. The advisory also incorrectly rendered `portal.example.test.kampus.pk`. This used the development campus override to reproduce the same frontend comparison; it did not register a real custom domain.

**Repair:** Resolve the effective hostname to a canonical tenant ID/slug using a trusted backend endpoint. Bind frontend selection and branding to that mapping. Display custom hostnames as hostnames without appending the platform domain.

### B08 — High: Platform superadmin with no tenant memberships cannot enter the UI

The `/auth/session` backend response includes `profile`, but frontend bootstrap only uses memberships to decide initial entry. With zero memberships, it clears user state and renders `NoMembershipsAdvisory`, including for a `super_admin` profile.

The isolated browser scenario supplied a superadmin profile with zero memberships and reproduced that advisory.

**Repair:** Handle the platform role from the authoritative backend profile independently of academy memberships. Preserve tenant guards and do not infer platform privileges from user-editable metadata. Test superadmins with zero, one, and multiple memberships.

### B09 — High: Domain provisioning can report active when Pages attachment fails

`CloudflareService.attachPagesHostname()` at `packages/backend/src/services/cloudflare.ts:481` logs exceptions or unsuccessful API responses and returns normally. `provisionSubdomain()` then returns `success: true, status: active` at line 242. Missing account configuration also returns without failing attachment. No actual Pages activation check precedes that active result.

**Repair:** Propagate attachment failures, persist explicit pending/failed/active states, verify activation before advertising a working portal, and support idempotent repair/retry. A successful DNS write alone is not enough.

### B10 — Medium: `tsa.kampus.pk` is not registered on the current Pages project

Live browser response is Cloudflare HTTP 522. Cloudflare DNS has no exact `tsa.kampus.pk` record; a proxied wildcard CNAME sends it to `kampus-academy.pages.dev`. Pages domain inventory includes only `app.kampus.pk` and `apex-premier.kampus.pk`, both active.

Staging Supabase contains no `tsa` tenant or domain mapping. Its only visible tenant in the administrative inventory was `Probe Academy` / `probe-academy-adv`, status `trial`; this pre-existing record was not created or deleted by this investigation. The production branding endpoint nevertheless returns `The Smart Academy` for `tsa`, confirming the live data/configuration differs from staging.

**Repair:** Respect the requested reset of previous academies. Do not recreate TSA solely to hide the timeout. Decide which academies should exist, clean or reconcile stale mappings in the correct environment, and register Pages hostnames only for intended active tenants. Verify unknown/retired domains fail cleanly.

### B11 — Medium: Invitation backend lifecycle is not connected to a complete frontend flow

Backend routes exist for creation, inspection, revocation, and acceptance. Creation at `packages/backend/src/routes/auth.ts:363` returns an invitation and raw token. No frontend call to invitation inspection/acceptance or invitation callback screen was found. The no-membership advisory tells users to click an invitation email link, but that link handling is not implemented in the inspected frontend. The creation handler itself does not dispatch an email.

**Repair:** Provide an administrator invitation UI and a recipient callback/acceptance flow tied to the authenticated verified identity. Implement delivery or an explicit administrator copy-link flow. Test existing and new identities, wrong email, expiry, revocation, and repeated acceptance. Do not claim end-to-end invitation delivery is verified from backend transaction tests alone.

### B12 — Medium: Recorded migration 00028 differs from current source and runner ignores drift

Live staging has 28 recorded migrations. Checksums for 00025–00027 match current source; 00028 does not. `packages/supabase/scripts/migrate.ts:122` skips existing versions without comparing the stored checksum to the freshly calculated checksum.

The live function ACL and `SESSION_USER` protections were already verified correct. This finding concerns reproducibility: a different database that applied the earlier 00028 would silently skip the updated file and retain the earlier behavior.

**Repair:** Use forward-only corrective migrations for already-applied changes. Reject checksum drift instead of silently ignoring it. Reconcile the existing ledger through a documented operator procedure; do not blindly rewrite checksums to conceal drift.

## Additional concerns

- The login form advertises CNIC/username sign-in, but `AuthContext.tsx:359` sends the identifier directly as Supabase's email field. No CNIC-to-identity resolution was found in that login path. Decide whether email-only login is intended or implement a tenant-safe identifier flow before promising CNIC access.
- A missing branding response currently falls back to an invented academy title such as `DOES-NOT-EXIST Academy` and still renders login. Local browser reproduction confirmed this. Unknown/retired domains should receive a clear unavailable-domain state.
- Cloudflare Custom Hostnames API returned HTTP 403 with current credentials. Pages domains were inspectable. SaaS custom-hostname configuration and required permissions are therefore a recorded gap, not a verified clean configuration.
- The current frontend tests mostly exercise helpers or restate membership/storage behavior directly, without rendering `AuthProvider` and completing UI flows. Their passing results do not cover the reproduced defects.

## Recommended remediation order

1. Fix registration request alignment, confirmation-resume onboarding, recovery completion, and platform-superadmin entry. Add actual rendered frontend/API contract tests.
2. Define a secure edge-to-backend hostname contract and canonical custom-domain mapping. Fix domain attachment failure propagation and unknown-host behavior.
3. Finish invitation UI and delivery/acceptance; resolve the CNIC sign-in contract explicitly.
4. Repair migration drift handling with forward-only corrections and verify repeatable migrations against an already-initialized database.
5. Prepare one concrete release candidate with explicit frontend, backend, database, and edge configuration. Configure browser Supabase variables and the intended backend URL. Reconcile the requested old-tenant/domain reset without recreating stale academies.
6. Run the existing real Supabase boundary suite and browser acceptance against that candidate. Then obtain approval for live configuration/deployment changes and verify the deployed artifact hashes, routes, domains, and cleanup.

## Artifacts

Screenshots: `.gstack/browser-reports/2026-10-01-auth-domain/screenshots/`.

Temporary diagnostic scripts: `/tmp/kampus-deployed-browser-audit.cjs` and `/tmp/kampus-local-auth-flows.cjs`. These contain synthetic fixture identities; no live credentials or JWTs were written into them.

The browser runs closed their contexts. The isolated Vite server was stopped after the investigation. No real invitation, recovery, or registration email was sent.
