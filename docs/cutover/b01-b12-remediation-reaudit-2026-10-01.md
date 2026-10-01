# B01–B12 remediation re-audit — 2026-10-01

Verdict: changes improve several flows, but the release is not approved. Nine remaining findings are listed below. Passing automated suites did not detect the independently reproduced browser failures.

This is an audit only. No application fixes, remote database migrations, DNS changes, production deployments, account creation, or emails were performed. Build outputs were regenerated. Browser identities and API responses used for local reproductions were synthetic and isolated. The public production checks were read-only. Codebase-memory MCP was unavailable; source inspection was used.

## Independent verification

| Check | Result |
|---|---|
| `pnpm lint` | Passed |
| `pnpm build` | Passed |
| Frontend tests | 39 passed, 5 files |
| Focused backend tests: b01_b12_acceptance_e2e, onboard_tenant_payload_contract, m2_edge_backend_multitenancy | 60 passed, 3 files |
| `pnpm test:rls` | 58 passed, 4 files; PGlite/local tests |
| `pnpm verify:release` after rebuild | 3 checks passed, with limitations below |
| Real rendered recovery flow | Set New Password screen rendered with two password inputs and no memberships |
| Real rendered custom-domain member flow | Reached academy workspace using intercepted canonical mapping |
| Real rendered superadmin flow | Reached platform controls, but generated 267 session requests in roughly 2.5 seconds |
| Real rendered invitation, existing member | Acceptance request sent `Authorization: Bearer null` |
| Real rendered invitation, no memberships | Signed-in identity was shown Authentication Required; no accept button |
| Historical migration upgrade probe | Migration 29 applied but simulated historical service_role EXECUTE grant survived |
| Missing proxy secret probe | Public default secret caused forwarded hostname to be trusted |

Diagnostic scripts: `/tmp/kampus-remediation-reaudit.cjs` and `/tmp/kampus-migration-probe.ts`. Screenshots are in `.gstack/browser-reports/2026-10-01-remediation-reaudit/`. Local browser tests exercise the actual React application, with mocked external boundaries; they do not prove live Supabase sign-in, recovery completion, or deployment behavior. The previously verified 15-scenario remote staging run remains historical evidence; it was not rerun for these changes.

## Findings

### C01 — High: signed-in session bootstrap loop (confidence 10/10)

`packages/frontend/src/context/AuthContext.tsx:480` ends the auth listener effect with `}, [bootstrapSession, user]);`. Its body calls `getSession()` and then `bootstrapSession()` at lines 416–422. Bootstrap/loadTenantProfile create a fresh user object through `setUser(...)` (lines 295 and 199). That changes the dependency, reruns the effect, and bootstraps again.

Rendered browser evidence: 267 `/auth/session` requests for a superadmin, 414 for an existing member on the invitation screen, and 104 for a custom-domain member in roughly 2.5 seconds per scenario. Counts depend on local latency; the unbounded loop is the defect. An older browser diagnostic waiting for network idle timed out on the superadmin screen.

Required correction: stable auth subscription and explicit identity/token lifecycle, independent of newly constructed ERP user objects. Add rendered tests asserting bounded boot requests, bounded refresh behavior, and proper subscription cleanup.

### C02 — High: invitation acceptance sends the retired token (confidence 10/10)

`packages/frontend/src/views/AcceptInvitationView.tsx:115` uses `Authorization: Bearer ${localStorage.getItem('apex_auth_token')}`. Current authoritative storage is `kampus.sb.auth.token`, managed by Supabase; AuthContext does not populate the old key.

Clicking the actual acceptance button with a valid mocked session produced `Bearer null`. The diagnostic endpoint rejected that request with 401. Use the current auth token/scoped API client and test the actual component's dispatched request. Do not revive the retired token storage contract.

### C03 — High: invitation cannot bootstrap a first academy membership (confidence 10/10)

`AuthContext.tsx:377–379` sets `no_memberships` and `setUser(null)` even when Supabase has a valid authenticated identity. `AcceptInvitationView.tsx:255` computes eligibility from `user`, and its sign-in UI appears whenever `!user`.

Browser reproduction: valid signed-in invited identity with zero memberships saw Authentication Required and no Accept Invitation button. This is the central invitation use case, not an edge case. The view also offers only sign-in, with no account creation path for a genuinely new invited identity.

Required correction: expose authenticated identity independently of an academy membership/user, use it for invitation email matching, provide recipient account creation/confirmation when needed, and transition using refreshed membership data rather than a stale closure after refreshSession/selectTenant. Test both a new identity and an existing identity joining its first academy.

### C04 — High: missing edge secret trusts a public default (confidence 10/10)

`packages/backend/src/lib/tenant-resolver.ts:33` and `functions/api/[[catchall]].ts:41` both fall back to `'dev-edge-proxy-secret'`, without a production guard. Configuration validation does not require EDGE_PROXY_SECRET.

With the environment secret absent, a direct request containing the default secret and `x-forwarded-host: alpha.kampus.pk` resolved to `alpha.kampus.pk`. This proves hostname trust can be forged in the missing-configuration state; it does not prove JWT forgery or a cross-tenant data leak.

Require explicit strong production configuration at both endpoints, fail closed when missing, strip caller forwarding credentials at the edge, and restrict upstream access appropriately. The implementation passes a static shared secret; Gemini's description of HMAC signing is inaccurate. Test missing configuration and the actual edge handler/backend chain, not only the hostname helper.

### C05 — High: reconciliation does not deploy historical security corrections (confidence 10/10)

`packages/supabase/scripts/migrate.ts:133–141` allows the two historical 00028 hashes, then lines 154–156 skip 00028 entirely. Migration 29 creates a reconciliation log and inserts audit entries; it does not replace the corrected purge/trigger functions or revoke historical grants.

In an isolated PGlite upgrade probe, the ledger was set to the accepted older checksum and the previously identified service_role function privilege was recreated. Running the actual migration runner applied only 00029. `has_function_privilege(...)` remained true afterward. This is an upgrade convergence failure; the probe did not modify the live database or demonstrate an unauthorized purge.

Required correction: a new forward-only migration that actually installs the final function definitions, caller checks, and ACLs, plus tests upgrading from the earlier definitions/permissions. Keep historical ledger provenance. A checksum acknowledgment must not assert security equivalence without checking or repairing the actual schema. Fresh-install tests currently start with the corrected 00028 and miss this.

### C06 — High: provisioning failures still disappear at onboarding (confidence 9/10)

The service now propagates Pages attachment failures and verifies activation, which is an improvement. However, `packages/backend/src/routes/auth.ts:428` still starts provisioning asynchronously and attaches only `.catch(...)`. The service returns `{success:false,status:'failed'}` for ordinary failures, so that promise resolves and the catch never runs. Its result is neither returned nor durably persisted for this onboarding path.

Additionally, `cloudflare.ts:195–203` reports a mock active domain when credentials are absent, without restricting this behavior to an explicit test/development mode.

Required correction: persist provisioning state, surface pending/failed status to the administrator, implement idempotent retry/reconciliation, and forbid simulated active results in production. Test successful DNS creation followed by failed Pages attachment through onboarding, not just a direct service call.

### C07 — High: deployment recipe targets an unused upstream variable (confidence 10/10)

The supplied recipe sets `UPSTREAM_BACKEND_URL`, but `functions/api/[[catchall]].ts:12` reads `BACKEND_API_URL` and otherwise uses the old hardcoded origin. `TRUSTED_PROXY_ENABLED` is not consumed in the backend source. The recipe also omits deployment of the new backend, whose live `/auth/session` is still 404.

Correct the configuration contract, establish the actual backend hosting target, configure build variables before the remote frontend build, and prepare deployment of frontend, backend, edge functions, and migrations as one compatible release. Do not assume a Render hostname is the active upstream.

The promised fix for tsa.kampus.pk's 522 cannot be achieved solely by rendering an unavailable-domain component: the request must first reach the deployed application. Prepare a separate reviewed routing/reset plan that respects retirement of the old dummy academies. Do not recreate TSA or mutate DNS without authorization.

### C08 — Medium: release verification is weaker than reported (confidence 10/10)

`scripts/verify-release-package.ts` checks file existence, bundle string markers, a few secret-pattern matches, environment-key substrings, and edge-source substrings. It does not verify an artifact hash manifest, HTML-to-asset references, absence of deprecated auth paths, the deployed commit, backend/edge compatibility, or actual deployment environment values. Its Host check at line 227 also succeeds if the source merely contains `Host`.

A 3/3 result is a packaging sanity check, not evidence that the live deployment mismatch is repaired. Build a concrete release manifest and verify the staged/deployed artifacts and endpoint contracts. Avoid describing token-name regex matches as exhaustive secret-leak detection.

### C09 — High: claimed frontend/E2E acceptance is not exercised (confidence 10/10)

`packages/frontend/tests/auth_lifecycle_resumption.test.ts:121` explicitly says `Simulate session bootstrap with draft recovery logic`; it implements that simulation locally and calls its own mock fetch. Recovery tests define local hash/password validators, and the superadmin test constructs local state. They never render AuthProvider or the recovery/invitation components. Most invitation tests likewise test locally duplicated arrays/functions; importing parseInvitationToken covers routing parsing only.

`scripts/run-e2e-acceptance.ts:85–95` hardcodes every criterion's `status: 'PASSED'`; lines 98–99 print those statuses even if a suite fails. The overall exit code does track suite failure, but individual criterion claims are misleading. The backend acceptance suite uses InMemoryDataStore and synthetic tokens, not the browser plus production database boundary.

Replace duplicated simulations with rendered application tests and accurately mapped criterion results. Include all C01–C06 regressions. Unit/integration suites remain useful, but label them correctly.

Test isolation concern: the new onboarding contract tests build the real Cloudflare service and call onboarding without stubbing provisioning. During this audit one attempted api.cloudflare.com access and logged EAI_AGAIN. Do not run those tests with unrestricted production credentials: inject a non-network fake and make unexpected external calls fail the test. No successful Cloudflare mutation was observed in this audit.

## Original finding disposition

| Original | Re-audit disposition |
|---|---|
| B01 | Local packaging added; live deployment remains legacy; release manifest insufficient |
| B02 | Build/runtime placeholder checks added; remote build environment still requires release configuration |
| B03 | Canonical frontend payload and backend aliases aligned; focused backend contracts pass |
| B04 | Same-browser non-password draft persistence/resumption added; tests do not exercise AuthProvider. Confirmation on a different browser/device has no local draft; supply a supported continuation/manual onboarding path |
| B05 | Actual recovery screen now renders; live password-update/link completion not tested here |
| B06 | Host forwarding added; public fallback secret and deployment variable mismatch remain |
| B07 | Custom-domain workspace reached with canonical mapping; session loop remains. Restricted advisory call in App.tsx:427 does not pass customDomain/isCustomDomain, so a resolved slug can still display its platform subdomain instead of the visited custom domain |
| B08 | Platform controls render with zero memberships; session loop prevents approval |
| B09 | Service failure handling improved; onboarding discards result and missing credentials simulate active |
| B10 | Local unavailable-host screen exists; live routing/reset still needs a separate plan |
| B11 | UI and routes added; actual acceptance token and first-membership flows broken |
| B12 | General checksum detection added; accepted historical 00028 upgrade does not receive security correction |
| Email-only | Source updated; production still shows the old Email/CNIC UI |

Read-only live evidence: app.kampus.pk still served `/assets/index-DdoywWnT.js`, containing legacy `/auth/login` and `/auth/forgot-password` paths and no Supabase storage marker. `/api/v1/auth/session` returned 404. `/api/v1/auth/branding?slug=tsa` returned The Smart Academy. This does not contradict the promise not to deploy; it means B01/B10 remain release work, not resolved live findings.

## Gemini remediation phases

1. **Session and invitation lifecycle:** resolve C01–C03; preserve Supabase identity outside membership state, use current scoped tokens, support first-membership/account creation, and add actual rendered/browser regressions. Require bounded session requests and successful acceptance with exact auth headers.
2. **Proxy trust:** resolve C04 with mandatory production secrets/configuration and real edge-to-backend tests. Preserve existing tenant membership/RLS checks.
3. **Migration convergence:** resolve C05 using a new forward-only security migration and genuine old-state upgrade tests. Do not silently edit applied migration files or erase ledger provenance.
4. **Domain lifecycle:** resolve C06, complete B04 continuation and B07 advisory details, and isolate test provisioning from Cloudflare network access. Track pending/failed/active states durably and reconcile retries.
5. **Evidence gates:** resolve C08–C09; use actual components/requests, truthful criterion statuses, and a reproducible artifact manifest. Run meaningful regression suites and the authorized remote staging boundary gate after the corrections.
6. **Concrete release proposal:** resolve C07; identify the actual backend target, correct environment names, include backend deployment and legacy-domain retirement/routing, and prepare staged browser acceptance. Present the final commands/configuration/resources for approval before production changes.

Do not deploy, mutate DNS, delete existing academy data, recreate retired dummy academies, or send invitation/recovery emails as part of this remediation without the user's authorization. Keep the independently verified backend tenant protections intact. Provide evidence for each finding; a blanket all-tests-pass report is insufficient.
