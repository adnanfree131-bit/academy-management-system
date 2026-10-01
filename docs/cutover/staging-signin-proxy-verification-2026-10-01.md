# Staging sign-in verification — 2026-10-01

Staging-only release: `1c8a1ccf7753db6e7360456d8f2816ea2f971533`.

## Reproduction and root cause

A confirmed temporary Supabase identity could acquire a real session. Calling the backend session endpoint inside its container returned 200; requesting the same endpoint through staging routing returned 404 UNMAPPED_HOST identifying staging-api.kampus.pk. Cloudflare and backend EDGE_PROXY_SECRET SHA-256 fingerprints differed. After correcting the staging Pages secret, an intermediate proxy still rewrote the standard forwarded hostname. The dedicated X-Kampus-Edge-Host header now preserves the original edge hostname; backend trusts it only after matching the configured proxy secret. The edge strips and replaces any client-supplied value. Historical X-Forwarded-Host support remains for compatibility.

## Deployed verification

- Cloudflare staging project: academy-management-system. Deployment a037399b-86b6-4b36-8a7b-a0b2adde43b5 succeeded.
- Coolify staging deployment: 134c2cef-ba05-4738-a655-d07c3766cbca finished; container 2kufijdklnl9tzaa5gzotllg-155010105020 healthy.
- Real browser sign-in through the deployed staging frontend: PASS, /api/v1/auth/session HTTP 200, zero-membership Set Up New Academy continuation rendered.
- Temporary confirmed auth identities removed through Supabase admin API; cleanup HTTP 200. No academy/DNS fixtures created.
- Frontend: 59 tests passed; build passed.
- Backend: 782 tests passed, one opt-in staging test skipped; backend build passed.
- Error feedback moved into the sign-in panel; expired-link/resend, verified confirmation success, and account-loading errors are visible and accessible.
- Public production Pages project kampus-academy, main branch, and production DNS unchanged.

A separate feedback-page navigation encountered ERR_QUIC_PROTOCOL_ERROR after the successful real sign-in test; the fixture cleanup still completed. Visual feedback checks run separately with QUIC disabled in the test browser. No browser workaround was added to product code.

Email sender branding/custom SMTP and complete academy domain provisioning remain separate work; this report does not claim those are verified.

## Account-specific oversized token failure

The real registered account remained blocked after the routing repair. Its Supabase user_metadata contained a 36,127-byte inline academy logo inside pending_tenant; total metadata size was 36,417 bytes. The signup implementation copied the full onboarding payload into authentication metadata, which Supabase includes in access tokens. A separate confirmed fixture with equivalent image metadata reproduced HTTP 431 through the staging Pages endpoint with a 49,066-byte access token. Removing pending_tenant from that fixture reduced the token to 822 bytes and the same identity's session endpoint returned HTTP 200. Fixture cleanup returned HTTP 200.

The registered account's original onboarding metadata was preserved privately on the VPS at /home/ubuntu/kampus-staging-onboarding-metadata-backup.json (mode 0600). Only pending_tenant.logo_url was removed from its authentication metadata; resulting metadata size 276 bytes, profile active, confirmation preserved. Existing browser-held access tokens require a fresh sign-in to pick up the corrected metadata.

Future signup sends full_name and bounded scalar academy details as authentication metadata, excluding inline logos. This allows recovery after confirmation in a different browser. Full academy details and uploaded logo remain in the browser onboarding draft and the authenticated onboard-tenant request. A rendered provider regression verifies that a 36-KB logo remains in the draft but is excluded from signUp authentication metadata. Frontend suite: 60 passed across eight files; build passed.

## Saved registration recovery

When the confirmed identity has no memberships and no matching browser draft, the provider recovers pending_tenant from that same authenticated identity and resumes the canonical onboard-tenant request. A failed continuation retains a prefilled draft for correction. Staging without Cloudflare credentials now reports failed provisioning, rather than simulating an active domain. DNS cutover is not included in this change.

## Central membership discovery under runtime RLS

Live staging recovery created the saved academy and logo successfully (onboard-tenant HTTP 201), but subsequent central session discovery returned zero memberships. Existing RLS requires a selected tenant for direct membership/tenant reads; central login has no selected tenant. Migration 00031 adds a SECURITY DEFINER resolver restricted to the current authenticated identity, active memberships, and active tenants. Ordinary table policies remain unchanged. Anonymous execution is revoked; a different requested identity returns no rows. The backend uses this resolver before selecting a tenant. Database suite: 60 passed, including own-identity discovery and cross-identity/anonymous denial.

The request-scoped repository adapter also dropped the outer transaction markers. Nested onboarding then issued a top-level commit, clearing local RLS settings before the provisioning status update. The adapter now forwards transaction markers while keeping release managed by Fastify. A PostgreSQL regression verifies nested onboarding, provisioning-status persistence, and complete rollback by the outer request transaction. The real staging resolver returns exactly one tsa tenant_admin membership with its original logo.
