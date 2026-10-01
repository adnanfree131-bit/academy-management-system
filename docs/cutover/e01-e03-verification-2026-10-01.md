# E01–E03 independent verification — 2026-10-01

Scope: Gemini's latest contract remediation. No production deployment, DNS change, or remote database migration was performed in this verification.

## Findings

- **E01: verified fixed.** CreateAcademyModal calls the canonical `/api/v1/auth/check-domain` route and reads the nested response data. Availability errors remain errors and offer retry. The rendered regression suite covers available, taken, reserved, and error/retry states. A real Chromium diagnostic using synthetic sessions and intercepted API responses completed existing-identity academy setup: zero signup calls, one onboarding call, then entry into the workspace.
- **E02: verified fixed.** AcademySettingsView no longer treats missing provisioning status as active. Only explicit `active` renders verified status; missing/unknown status renders unverified. Rendered tests cover unverified, failed, pending, and active states.
- **E03: liveness documentation corrected; one readiness instruction still needs correction.** `/api/v1/health` is process liveness only. Running `tests/db_preflight_and_connection.test.ts` does not establish live database readiness: those preflight tests use mocked database clients. The operator should run `pnpm db:preflight` with the intended target's runtime `DATABASE_URL` and strict TLS CA configuration, followed by authenticated tenant API probes against the deployed backend.

## Independently executed checks

- Frontend suite: 54 tests passed across 6 files.
- Workspace lint/type checks: passed.
- Workspace build: passed.
- Release verification: 7/7 checks passed; regenerated release-manifest.json.
- Chromium lifecycle diagnostics: delayed custom-domain mapping reached the authorized workspace with one session request; existing-identity onboarding completed without duplicate signup.

Browser diagnostics used synthetic sessions and intercepted API responses. They establish browser lifecycle behavior, not live Supabase or deployed Cloudflare integration. The full backend, RLS, and remote staging suites were not rerun during this focused verification.

## Next gate

No remaining code blocker was identified in E01–E02. Correct the readiness command in the release instructions, then validate the release against the intended staging deployment and database before production rollout. Local test/build success does not establish that live production serves this release.
