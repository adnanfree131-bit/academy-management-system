# Phase 0 Completion Report: Baseline & Destructive-Reset Guard

> [!WARNING]
> **DESTRUCTIVE RESET GUARD ACKNOWLEDGMENT:**
> Applying the clean baseline destroys all existing dummy application data, in-memory snapshot stores, and invalidates all active sessions. 
> Supabase Auth and normalized PostgreSQL repositories will exclusively replace the legacy `@fastify/jwt`, custom OTPs, password hashes, and `.local-store-snapshot.json` persistence.

## 1. Production Data & Fixture Audit
- **Audit Finding:** Zero production data exists in this environment. All tenant entities (`apex`, `crescent`, `tsa`, `platform`) are development and testing fixtures.
- **Decision:** Classified as disposable fixtures. No passwords, hashes, OTPs, or legacy tokens will be migrated or preserved.
- **Fixture Manifest:** Created at [`docs/cutover/fixture-manifest.json`](file:///home/adnan/Desktop/academy%20management%20system/docs/cutover/fixture-manifest.json).
- **Future Seeding Policy:** Re-seeding demo scenarios will be strictly gated via an explicit `seed:dev` script requiring `ALLOW_DEMO_SEED=true` and rejecting production environments.

## 2. Domain & Routing Inventory
- **Domain Manifest:** Created at [`docs/cutover/domain-manifest.json`](file:///home/adnan/Desktop/academy%20management%20system/docs/cutover/domain-manifest.json).
- **Reserved Hosts:** Protected hosts include `app.kampus.pk`, `api.kampus.pk`, `www.kampus.pk`, `admin.kampus.pk`, `auth.kampus.pk`, `cdn.kampus.pk`, and infrastructure entries.
- **Dummy Subdomains to Purge:** `apex.kampus.pk`, `crescent.kampus.pk`, `tsa.kampus.pk`.
- **External Custom Domains to Detach:** `portal.tsa.edu.pk`, `crescent.edu.pk`.
- **Unknown Host Handling:** Wildcard requests for unknown hostnames will fail closed with a neutral `404 Unknown academy`.

## 3. Legacy Auth & Schema Inventory
- **Legacy Auth Inventory:** Created at [`docs/cutover/legacy-auth-inventory.json`](file:///home/adnan/Desktop/academy%20management%20system/docs/cutover/legacy-auth-inventory.json).
- **Membership Foreign Keys:** Identified 21 foreign key constraints referencing `users(id)`. Renaming `users` to `tenant_memberships` in PostgreSQL retains all constraint integrity while transitioning actor semantics to tenant memberships.
- **Reference Schema Export:** Preserved at [`docs/cutover/schema-reference.sql`](file:///home/adnan/Desktop/academy%20management%20system/docs/cutover/schema-reference.sql).

## 4. Baseline Quality & Gate Verification
- **Backend Tests:** 36 test files, 541 tests passing (100%).
- **Supabase RLS Tests:** 23 tests passing (100%).
- **Workspace Lint:** All 5 workspace packages passing (`tsc --noEmit`).
- **Workspace Build:** Vite + React and Fastify builds cleanly passing.
- **Baseline Verification Record:** [`docs/cutover/baseline-verification.json`](file:///home/adnan/Desktop/academy%20management%20system/docs/cutover/baseline-verification.json).

Phase 0 is complete and all gates are satisfied. Proceeding to Phase 1.
