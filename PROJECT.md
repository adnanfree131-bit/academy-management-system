# Project: Apex Academy Management System — Audit Remediation (B01–B12)

## Architecture
- **Frameworks**: Fastify v5 (TypeScript) in `packages/backend`, React 18 + Vite in `packages/frontend`, Cloudflare Pages Functions in `functions/api/[[catchall]].ts`.
- **Database & Migrations**: PostgreSQL on Supabase (`packages/supabase/migrations/`), runner in `packages/supabase/scripts/migrate.ts`.
- **Authentication & Multi-Tenancy**:
  - Supabase GoTrue Auth (asymmetric ES256 EC JWKS cryptographic verification).
  - Explicit email authentication with clean institutional ergonomics (CNIC preserved strictly for demographic/family grouping on student/guardian profiles).
  - Multi-tenant host resolution via authenticated edge proxy forwarding contract (`X-Forwarded-Host` + `X-Edge-Proxy-Secret`).
  - Resumable onboarding state across Supabase email confirmation boundaries.
  - Dedicated password recovery modal for `#reset-password` independent of academy memberships.
  - Platform superadmin direct entry to control plane with zero academy memberships.
- **Invitations Lifecycle**:
  - Administrator invitation management UI (create, list, copy, revoke).
  - Backend listing and tracking endpoints.
  - Recipient invitation inspection and acceptance tied to authenticated identities.
- **Migration Ledger Integrity**:
  - Forward-only corrective migration (00029) and migration runner checksum validation rejecting drift.
- **Build & Packaging**:
  - Vite build-time env var assertion (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) failing closed on missing keys.
  - Release package verification script.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Academy Registration Payload Alignment (B03) | Align frontend `AuthContext.tsx` payload (`name`, `slug`) with backend `/api/v1/auth/onboard-tenant` schema | M1 | ORIGINAL_REQUEST R1 |
| 2 | Resumable Onboarding State (B04) | Preserve draft academy setup in persistent storage and resume onboarding upon verified session confirmation | M1 | ORIGINAL_REQUEST R1 |
| 3 | Dedicated Password Recovery Screen (B05) | Dedicated `PasswordRecoveryModal` and route handler for `#reset-password` sessions independent of memberships | M1 | ORIGINAL_REQUEST R1 |
| 4 | Platform Superadmin Zero-Membership Entry (B08) | Permit `super_admin` platform role to enter and access control plane directly with 0 tenant memberships | M1 | ORIGINAL_REQUEST R1 |
| 5 | Explicit Email Login Standardization | Eliminate CNIC labels/placeholders from login forms while keeping CNIC on student/guardian demographic profiles | M1 | ORIGINAL_REQUEST R1 |
| 6 | Secure Edge Proxy Host Forwarding (B06, B07) | Forward incoming client hostname via `X-Forwarded-Host` with shared `X-Edge-Proxy-Secret` in `[[catchall]].ts` | M2 | ORIGINAL_REQUEST R2 |
| 7 | Secure Backend Host Tenant Resolution | Configure Fastify and tenant resolver to trust proxy host only with valid proxy secret, preventing header spoofing | M2 | ORIGINAL_REQUEST R2 |
| 8 | Canonical Custom Domain Host Mapping (B09) | Resolve custom domains via canonical backend lookup, eliminating malformed `.kampus.pk` concatenation | M2 | ORIGINAL_REQUEST R2 |
| 9 | Cloudflare Domain Provisioning Hardening (B10) | Propagate attachment errors, track pending/failed/active statuses, and verify activation in `cloudflare.ts` | M2 | ORIGINAL_REQUEST R2 |
| 10 | Explicit Unavailable Domain Screen | Display institutional `UnavailableDomainAdvisory` for unknown/retired domains instead of synthetic fallbacks | M2 | ORIGINAL_REQUEST R2 |
| 11 | Admin Invitation Management UI (B11) | UI in Academy Settings / Staff Desk to create, list, copy links, and revoke invitations with specific roles | M3 | ORIGINAL_REQUEST R3 |
| 12 | Backend Invitation Listing Endpoint (B11) | Add `GET /api/v1/auth/invitations` route and `store.listInvitations` method | M3 | ORIGINAL_REQUEST R3 |
| 13 | Recipient Invitation Acceptance Flow (B11) | Render recipient inspection and acceptance flow (`/invite/:token`) tied to authenticated identities | M3 | ORIGINAL_REQUEST R3 |
| 14 | Migration 00028 Drift Reconciliation (B12) | Forward-only Migration 00029 + migration runner checksum alias baseline without rewriting historical records | M4 | ORIGINAL_REQUEST R4 |
| 15 | Migration Runner Drift Hardening (B12) | Verify SHA-256 checksums of applied migrations in `migrate.ts` and fail closed on modified historical files | M4 | ORIGINAL_REQUEST R4 |
| 16 | Frontend Supabase Build Var Validation (B01) | Validate `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `vite.config.ts` during build; runtime fail-closed guard | M4 | ORIGINAL_REQUEST R5 |
| 17 | Release Packaging Verification (B02) | Script `verify-release-package.ts` asserting build artifacts, environment variables, and proxy configuration | M4 | ORIGINAL_REQUEST R5 |
| 18 | E2E Test Suite (Tiers 1–4) Acceptance Pass | 100% pass of requirement-driven E2E test suite across all 18 features (Tiers 1–4) | Final | ORIGINAL_REQUEST R5 |
| 19 | Adversarial Coverage Hardening (Tier 5) | White-box stress testing, gap analysis, and adversarial tests verifying robustness | Final | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Auth, Registration & Onboarding Lifecycle | R1: Features 1, 2, 3, 4, 5 (B03, B04, B05, B08, CNIC cleanup) | none | DONE (worker_m1 passed: 726/726 backend, 21/21 frontend) |
| M2 | Edge-to-Backend Multi-Tenancy & Host Resolution | R2: Features 6, 7, 8, 9, 10 (B06, B07, B09, B10, Unknown domains) | none | DONE (worker_m2 passed: 745/745 backend, 21/21 frontend, 10/10 acceptance) |
| M3 | User Invitation Management & Acceptance | R3: Features 11, 12, 13 (B11 UI, API, Acceptance flow) | M1 | DONE (worker_m3 passed: 753/754 backend, 33/33 frontend, 10/10 acceptance) |
| M4 | Migration Ledger Hardening & Build Packaging | R4 & R5: Features 14, 15, 16, 17 (B12, B01, B02) | none | DONE (worker_m4 passed: 50/50 RLS tests, verify:release 3/3) |
| Final | E2E Test Suite Pass & Adversarial Hardening | Phase 1 (100% E2E Pass Tiers 1-4) + Phase 2 (Tier 5 Adversarial Hardening) | M1, M2, M3, M4 | IN_PROGRESS (Verification Swarm & Victory Audit) |

## Interface Contracts

### M1: Auth & Onboarding Contracts
- **Onboarding Payload**:
  ```typescript
  export interface OnboardTenantPayload {
    name: string;        // Academy name
    slug: string;        // Subdomain slug
    campus_name?: string;
    city?: string;
    phone?: string;
    logo_url?: string;
  }
  ```
  Backend schema in `packages/backend/src/routes/auth.ts`: accepts `name` and `slug` (with backward compatibility fallback for `tenant_name`, `tenant_slug`).
- **Resumable Onboarding Storage**:
  - Key: `apex_pending_onboarding_draft`
  - Stored: `{ payload: OnboardTenantPayload, email: string, timestamp: number }`
  - Lifecycle: written on `signUp` when session is pending; cleared upon successful `/api/v1/auth/onboard-tenant`.
- **Password Recovery Route**:
  - URL Hash: `/#reset-password`
  - Supabase Auth Event: `PASSWORD_RECOVERY`
  - Handler renders `PasswordRecoveryModal`, permits updating password via `supabase.auth.updateUser({ password })` without requiring academy membership.
- **Platform Superadmin State**:
  - In `AuthContext.tsx`: If `profile?.platform_role === 'super_admin'`, bypass `no_memberships` lockout and set `membershipState = 'platform_superadmin'`.

### M2: Edge Proxy & Host Resolution Contracts
- **Edge Forwarding**:
  - `functions/api/[[catchall]].ts`:
    - Reads incoming `url.hostname`.
    - Sets header `X-Forwarded-Host: url.hostname`.
    - Sets header `X-Edge-Proxy-Secret: <EDGE_PROXY_SECRET>`.
    - Rewrites `Host: targetHostname`.
- **Backend Host Resolution**:
  - `packages/backend/src/lib/tenant-resolver.ts`:
    - Checks `request.headers['x-edge-proxy-secret'] === env.EDGE_PROXY_SECRET`.
    - If valid, trusts `request.headers['x-forwarded-host']`.
    - Otherwise, falls back to direct `Host` header, preventing external spoofing.
- **Tenant Host Resolution Endpoint**:
  - `GET /api/v1/auth/resolve-host?host=<hostname>`:
    - Returns `{ success: true, data: { tenant_id: string, slug: string, name: string, status: string, is_custom_domain: boolean } }`.
    - If unmapped: returns HTTP 404 with `{ success: false, error: { code: 'UNMAPPED_HOST' } }`.
- **Frontend Unknown Host UI**:
  - Renders `UnavailableDomainAdvisory` with explicit unmapped domain message (Zero AI slop).

### M3: Invitation Management Contracts
- **Listing API**:
  - `GET /api/v1/auth/invitations`: Requires `admin` or `owner` role.
  - Returns `Array<{ id: string, email: string, role: string, created_at: string, expires_at: string, status: string }>`.
- **Invitation Acceptance URL**:
  - `/#invite/:token` or `/invite/:token`
  - Displays academy name, target role, and inviter identity.
  - Requires sign-in / registration with matching email or verified identity before calling `/api/v1/auth/invitations/:token/accept`.

### M4: Migration Ledger & Build Contracts
- **Migration 00029**:
  - Forward-only SQL migration reconciling version 00028 checksum recording without altering historical rows.
- **Migration Runner Checksum Preflight**:
  - `packages/supabase/scripts/migrate.ts`:
    - Iterates over all applied rows in `schema_migrations`.
    - Calculates SHA-256 of corresponding disk file.
    - Permits whitelisted historical baseline aliases for 00028.
    - If checksum does not match and is not whitelisted: aborts with error `DATABASE_MIGRATION_INTEGRITY_VIOLATION`.
- **Vite Build Validation**:
  - `packages/frontend/vite.config.ts`:
    - Validates presence of `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
    - Throws error and halts build if missing or placeholder.

## Code Layout
- `packages/backend/src/routes/auth.ts`: Auth endpoints (onboard, session, invitations, branding, resolve-host)
- `packages/backend/src/services/store.ts` & `postgres-store.ts`: Database store implementation
- `packages/backend/src/lib/tenant-resolver.ts`: Host parsing, edge secret verification, tenant mapping
- `packages/backend/src/services/cloudflare.ts`: Custom domain attachment, status tracking, error propagation
- `functions/api/[[catchall]].ts`: Cloudflare Pages Functions edge proxy
- `packages/frontend/src/context/AuthContext.tsx`: Session bootstrap, onboarding resumption, role guards
- `packages/frontend/src/lib/host.ts`: Client hostname parsing and host info resolution
- `packages/frontend/src/components/LoginModal.tsx`: Email authentication, CNIC cleanup
- `packages/frontend/src/components/PasswordRecoveryModal.tsx`: Dedicated password reset modal
- `packages/frontend/src/components/UnavailableDomainAdvisory.tsx`: Explicit unmapped domain state
- `packages/frontend/src/components/InvitationsManagementModal.tsx`: Admin invitation management
- `packages/frontend/src/views/AcceptInvitationView.tsx`: Recipient invitation acceptance flow
- `packages/supabase/migrations/00029_reconcile_migration_ledger.sql`: Forward-only migration
- `packages/supabase/scripts/migrate.ts`: Checksum preflight and drift prevention
- `packages/frontend/vite.config.ts`: Environment variable build assertions
