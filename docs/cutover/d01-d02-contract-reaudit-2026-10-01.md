# D01–D02 and supporting notes: contract re-audit — 2026-10-01

Verdict: D01 is fixed in the tested browser flow. D02 now correctly separates existing-user onboarding from signup, but a new availability API mismatch blocks the actual setup form. One high-priority functional blocker remains, plus a domain-status correction and a release-check documentation correction.

## Independently verified

- Lint and workspace build passed.
- Frontend: 49 tests passed in 6 files.
- Backend: 770 tests passed, 1 opt-in staging test skipped, 56 files passed. This run succeeded inside the network-restricted sandbox, confirming early cleanup no longer requires a remote connection in these tested paths.
- RLS/migrations: 59 tests passed in 5 files.
- Chrome browser with a stored synthetic session: a valid custom-domain member reached the academy workspace after host mapping was delayed by 500 ms. Session requests remained bounded at one. The rendered tests for both response orders and a nonmember also passed.
- Existing-identity setup now renders CreateAcademyModal and invokes no signup. However, after the availability check returns the real missing-route response, the form marks the free address Taken, disables Create Academy, and sends zero onboarding requests.
- Direct Fastify route probe confirmed the mismatch below. It used InMemoryDataStore, no database pool, and a fake Cloudflare availability service; no external writes were made.

Diagnostics: `/tmp/kampus-remediation-reaudit.cjs`, `/tmp/kampus-academy-contract-probe.ts`. Screenshots: `.gstack/browser-reports/2026-10-01-contract-reaudit/`.

No application changes, deployments, remote migrations, real Auth-user operations, emails, or DNS modifications were performed. Only audit artifacts and regenerated build/release artifacts were written.

## E01 — High: academy setup calls a missing route and reads the wrong response shape

Confidence: 10/10. This is the remaining D02 blocker.

`packages/frontend/src/components/CreateAcademyModal.tsx:77` calls:

```ts
apiFetch(`/api/v1/auth/check-slug?slug=${encodeURIComponent(cleanSlug)}`)
```

Line 79 checks `data?.available`. The actual backend route is `/api/v1/auth/check-domain` (`packages/backend/src/routes/auth.ts:23`), and its response places availability inside `data.available` in a `{success,data,timestamp}` envelope. There is no check-slug route in backend source.

Actual Fastify results:

| Request | Result |
|---|---|
| `/api/v1/auth/check-slug?slug=free-academy` | 404, Route not found |
| `/api/v1/auth/check-domain?slug=free-academy` | 200, `{success:true,data:{available:true,...}}` |

Browser reproduction: signed-in identity without memberships opens Set Up New Academy, fills a valid unused name/slug, and waits for the check. A 404 is treated as unavailable, the screen says Taken, and Create Academy is disabled. Observed signupCount=0 and onboardCount=0.

Why the reported regression test passed: `packages/frontend/tests/rendered_auth_flows.test.tsx:779–780` mocks the missing check-slug route and returns `{available:true}` at the top level. This reproduces the frontend's assumed API rather than the existing backend contract.

Required correction:

1. Use the canonical backend availability route and its actual response envelope, preferably shared with the existing registration flow.
2. Check HTTP status and distinguish taken/reserved from service/network failure. The catch at CreateAcademyModal.tsx:84–85 currently reports Address available on a network error; use an unknown/error state with retry rather than inventing success.
3. Add a component/API contract regression using the actual Fastify response. Verify available, taken, reserved, 404/500, and retry. A successful existing-user submission must make zero signup calls and then enter its new academy.

This is a small contract correction. Do not rebuild authentication or change the verified tenant guards.

## E02 — Medium: unknown provisioning state is displayed as verified active

Confidence: 9/10; source verified.

`packages/frontend/src/views/AcademySettingsView.tsx:929` uses:

```ts
const status = (tenant?.settings as any)?.domain_provisioning_status || 'active';
```

An academy without a persisted provisioning status therefore receives the active/verified presentation without verification evidence. Such a state can exist for older tenants or if status persistence failed. The new failed/pending badges and retry action are otherwise wired to the correct authenticated endpoint.

Use an unknown/unverified state unless persisted verification confirms activation, and allow an administrator to reconcile it. Add a rendered settings check for missing status as well as failed, pending, and active.

## E03 — Release proposal: health check path and evidence are incorrect

Confidence: 10/10; source verified.

The supplied proposal says GET `https://api.kampus.pk/health` confirms database connectivity. The actual route in `packages/backend/src/app.ts:732` is `/api/v1/health`, and it returns a static liveness payload without querying PostgreSQL.

Correct the release instructions. Use this endpoint for liveness only; use the database preflight and a real restricted-role database/API probe for database readiness. Establish the actual backend hosting target before rollout rather than assuming api.kampus.pk/Render is already configured.

## Supporting notes disposition

- Domain provisioning badges and authorized retry action: implemented, with E02 remaining.
- Manifest: source now hashes edge function, all migration files, and pnpm-lock.yaml in addition to frontend/backend artifacts. This identifies the files hashed; production artifact verification still belongs to the approved rollout.
- Acceptance runner: dynamically maps suite exit codes, but E01 demonstrates that a mocked endpoint can still falsely substantiate a claimed whole-flow criterion. Fix the contract test, not just the result label.
- Teardown decoupling: the tested early-auth failure paths now pass without remote database access. `hasDbFixtures` gates pool creation; real fixture cleanup is retained.
- Live deployment, new remote migration application, and retired TSA routing remain pending. They are not failed local implementation tests and must not be described as already completed in production.

## Gemini's next task

Fix E01 and its real component/API contract regression, correct E02, and amend the release health-check instructions in E03. Run the frontend regressions, lint/build, backend suite, RLS/migration checks, and release verification. Return the specific evidence for these items for Codex review. Keep production deployment, DNS changes, and remote migration application pending approval of the concrete target and release package.
