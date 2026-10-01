# C01–C09 follow-up re-audit — 2026-10-01

Verdict: substantial verified progress, but two functional blockers remain. Do not approve production deployment yet. The reason is the concrete browser failures below, not merely the absence of another staging test run.

## Independent verification

- `pnpm lint`: passed.
- `pnpm build`: passed.
- Frontend: 45 tests passed in 6 files.
- RLS/migrations: 59 tests passed in 5 files, including historical upgrade convergence.
- Release verification after rebuilding: 7/7 checks passed; regenerated `release-manifest.json`.
- Full backend run: 765 passed, 5 failed, 1 skipped. The five failures were teardown tests whose administrative database connection was blocked by the sandbox network. Both affected files were rerun with network access: all 27 tests passed. This distinguishes environmental failures from implementation failures, but also confirms these ordinary tests remain coupled to staging credentials/network.
- Independent Chrome render: superadmin session bootstrap fell from hundreds of requests to one; invitation acceptance uses the current token; an identity with zero memberships gets an accept button.
- Independent Chrome render: valid custom-domain member still gets Campus Access Restricted when canonical host mapping arrives after session bootstrap.
- Independent Chrome render: signed-in zero-membership user clicking Set Up New Academy is sent through signup again; a no-session signup response results in zero onboarding calls and a misleading confirmation message.

These browser checks used the actual React application and Supabase client, with synthetic sessions and intercepted API/Auth responses. They are not live sign-in or email tests. Diagnostic: `/tmp/kampus-remediation-reaudit.cjs`. Screenshots are under `.gstack/browser-reports/2026-10-01-followup-reaudit/`.

No application code was edited. No deployment, DNS change, migration application, real Auth-user provisioning, or email sending occurred. The network-enabled teardown tests connected to staging; their early-failure paths used fake Auth identities and empty database fixture registries, and reported successful cleanup. Build artifacts and the release manifest were regenerated.

## D01 — High: token deduplication prevents custom-domain access after mapping resolves

Confidence: 10/10. Original B07, regression introduced while fixing C01.

Relevant source:

- `packages/frontend/src/context/AuthContext.tsx:248`: `bootstrappedTokenRef.current = accessToken;` runs before canonical domain mapping has necessarily completed.
- Lines 342–343 read `resolvedTenantSlug || hostInfo.tenantSlug` and `resolvedTenantId`.
- Lines 352–358 render unauthorized_for_branded_host when those values do not match the membership. For an external custom domain, the initial fallback tenantSlug is the hostname, not the academy slug.
- Lines 452–455 skip bootstrap when the same token was already processed.
- Line 437 makes bootstrapSession depend on resolved mapping; line 516 reruns the auth effect when that callback changes, but the token-only deduplication then prevents the mapping update from taking effect.

Reproduction: an actual local browser origin `http://portal.example.test` was supplied with a valid mocked session, active membership for canonical slug alpha, and a successful resolve-host response identifying the same tenant. Session returned first; resolve-host returned after 500 ms. After settling, the UI displayed Campus Access Restricted, with only one session call. The same failure also occurred without explicitly delaying the resolver in the first browser run.

Required correction: make authentication and canonical host resolution a coordinated lifecycle. Either wait for authoritative mapping before evaluating branded membership access, or deliberately reevaluate membership selection when mapping changes without recreating the subscription/request loop. A pending mapping must not be treated as an established denial.

Required regression coverage: render the full AuthProvider/custom-domain app with both response orders, reload a stored session, and assert access to the same tenant. Also assert that a nonmember remains denied and requests stay bounded. The existing rendered test checks the advisory component in isolation and therefore cannot catch this lifecycle failure.

## D02 — High: existing-account onboarding continuation uses account registration

Confidence: 10/10. Original B04 continuation remains incomplete.

Relevant source:

- `packages/frontend/src/App.tsx:421`: `return <LoginModal initialMode="register" />;` is used for a signed-in user with no memberships who clicks Set Up New Academy.
- LoginModal's submit calls registerAcademy at line 363.
- `packages/frontend/src/context/AuthContext.tsx:678` always calls `supabase.auth.signUp(...)`.
- Lines 694–708 return the email-confirmation message when that signup response has no session, rather than using the identity's already existing authenticated session to call onboard-tenant.

Reproduction: the browser started with a signed-in identity and no memberships/draft, clicked Set Up New Academy, filled a valid academy form with the existing identity's email, and submitted. The intercepted signup response returned a user without a new session. Observed: signupCount=1, onboardCount=0, and the screen said Account created. Please confirm your email address before continuing. This is an isolated contract reproduction, not a claim that every live duplicate signup returns that exact response. A live duplicate-account error would also prevent this path from completing.

Required correction: distinguish new identity registration from academy creation by an existing authenticated identity. The existing-user continuation should collect academy details and invoke the existing authenticated onboard-tenant API using the active Supabase session; it should not ask the user to recreate their identity or password. Preserve a separate signup/confirmation path for genuinely new users.

Required regression coverage: render the whole continuation with an authenticated identity and no memberships, submit academy details, assert zero signup calls, assert a canonical authenticated onboarding request, and assert entry into the resulting academy workspace. Add error/retry behavior without losing the draft. The current test only confirms that the continuation button invokes a spy callback.

## Previous findings: what improved

| Finding | Follow-up result |
|---|---|
| C01 session loop | Original loop fixed: independent browser observed one session request. D01 is the remaining coordination defect |
| C02 retired token | Fixed: independent invitation click uses the authoritative current bearer token |
| C03 no-membership invitation | Original identity/eligibility defect fixed: independent browser shows accept button; account-creation tab added. The complete live email-confirmation/acceptance journey is not asserted by this audit |
| C04 default proxy secret | Public fallback removed; production backend config rejects missing/weak secrets; hostname helper ignores unconfigured forwarding trust |
| C05 migration convergence | Migration 30 reinstalls hardened definitions and grants. The actual historical-upgrade test passes and service_role EXECUTE is revoked |
| C06 provisioning | Onboarding now awaits provisioning, persists status, and adds an admin retry endpoint. Test-mode Cloudflare credentials are isolated and production missing-credential simulation is blocked |
| C07 upstream variable | Proxy now accepts BACKEND_API_URL and the alias, rejects missing upstream. Deployment proposal includes backend deployment |
| C08 release package | Actual SHA-256 asset manifest, referenced-asset verification, and deprecated-route checks added; 7/7 passes |
| C09 evidence | Rendered component tests added; criterion statuses derive from suite exit codes. Some criterion descriptions still overstate the flows tested, demonstrated by D01/D02 |

## Remaining non-blocking completeness/release notes

1. Domain provisioning statuses are persisted server-side, but no frontend source references domain_provisioning or reconcile-domain. Surface pending/failed state and an authorized retry action in the academy settings. Do not present a failed domain as usable solely because academy creation succeeded. Onboarding also catches status-persistence exceptions and returns success; define the recovery behavior explicitly.
2. Release-manifest.json records frontend/backend build files and Git HEAD but does not hash edge functions or migrations. The current changes are uncommitted, so Git HEAD alone does not identify this source tree. Before release, create a reviewable candidate containing the exact code/configuration/migration set; extend the manifest or attach hashes for edge functions, migrations, and dependency locks.
3. The acceptance runner is no longer hardcoded, but passing a whole suite does not prove every mapped narrative. AC-02 still combines a locally simulated draft-resumption test with a button-callback test; AC-06 does not test delayed custom-domain AuthProvider resolution; AC-08 is mapped to backend_contracts despite claiming a frontend advisory flow. Link criteria to meaningful complete-flow regressions and retain honest evidence tiers.
4. The early provisioning-failure unit tests still open a real administrative database connection during teardown, despite having no database fixtures. Inject cleanup/database dependencies or skip database cleanup when no database registry entries exist. Keep the real staging gate separately opt-in; do not weaken its cleanup assertions.
5. The migration command in the release proposal performs schema mutations; it is not merely a connectivity check. Establish the exact target project and run a read-only preflight first. Apply and verify the new migrations on staging before the approved production rollout.
6. Live deployment and legacy-host retirement are still proposed, not completed. Therefore B01/B10 cannot be called resolved in production. The TSA redirect requires a separately approved Cloudflare change; preserve the user's requirement not to recreate dummy academies. The precise origin-level cause of a 522 was not newly proven by this audit.

## Narrow remediation plan for Gemini

1. Fix D01 with coordinated canonical host mapping and bounded session lifecycle; add the two response-order browser/component regressions.
2. Fix D02 with existing-identity academy onboarding; test the whole rendered continuation rather than only a button callback.
3. Update criterion mappings and add frontend provisioning status/retry visibility; isolate unit cleanup from remote credentials.
4. Run lint/build, rendered frontend regressions, backend suite, RLS/upgrade tests, and packaging verification. Prepare the exact release candidate including edge/migration hashes.
5. Return evidence per finding for Codex re-audit. Keep production deployment, DNS modifications, remote migration application, and legacy data changes pending explicit approval of the concrete release proposal.

Most previously identified major defects are now fixed. Do not rebuild authentication again or remove the verified tenant protections; resolve these specific lifecycle gaps.
