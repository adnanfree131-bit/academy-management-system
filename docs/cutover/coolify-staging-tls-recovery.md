# Coolify staging TLS recovery

## Verified configuration bug

The real node-postgres Client discards the explicit `ssl.ca` when its connection
string contains `sslmode`. The database connection helper now removes URL TLS
options so the application's strict TLS configuration stays authoritative.
Certificate files and inline PEM values with literal `\\n` are supported.
Missing files and invalid PEM contents fail with explicit configuration errors.
Startup prints only public certificate metadata: loaded status, verification
status, fingerprint, subject, and issuer. It never prints the connection URL,
password, PEM contents, or file path.

This reproduced driver bug does not establish the cause of the prior Coolify
failure: the displayed URL had no SSL query parameters. The actual container
must still be checked for injected certificate contents and deployed revision.

## Backend-only Coolify settings

Use the repository root as the build directory. Set these custom commands in
Coolify's build configuration:

- Install: `corepack enable && pnpm install --frozen-lockfile --prod=false`
- Build: `pnpm build:backend`
- Start: `pnpm start:backend`
- Container port: `4000`
- Health path: `/api/v1/health`

`build:backend` selects the backend and its workspace dependencies (currently
shared-types). It does not build the frontend. Supabase migrations are an
independent administrative step and are not executed by this build.
NODE_ENV must be runtime-only; do not exclude build dependencies during install.
Backend startup requires DATABASE_SSL_CA to be available at runtime. Set it to
either the complete PEM value or a readable path inside the container. A path
on the developer's laptop is not available inside a VPS container.

## Staging verification

1. Confirm the deployed Git revision and saved Coolify commands before deployment.
2. Check the startup `Database TLS configuration` message. For this Supabase
   certificate setup expect `caLoaded: true` and `rejectUnauthorized: true`.
3. Run the compiled preflight inside the running backend container, from `/app`:
   `node packages/backend/dist/scripts/db-preflight.js`.
4. Confirm the runtime role/least-privilege assertions pass.
5. Check `/api/v1/health` and authenticated tenant API requests through the Pages
   proxy. Health alone proves process liveness, not database readiness.

The prior healthy response does not establish which Git revision is deployed.
The Pages staging hostname also needs to be recognized as a central platform
host before browser login/onboarding testing can proceed.

## Verification on 2026-10-01

- Focused connection/preflight tests: 29 passed.
- Workspace lint: passed.
- `pnpm build:backend`: passed; only shared-types and backend built.
- Full backend suite with two workers: 779 passed, one opt-in staging test skipped.
  The first run alongside compilation hit a setup timeout; the bounded rerun passed.
- Live Supabase runtime preflight: passed with strict TLS and fastify_runtime.
- Live escaped-inline CA with `sslmode=require`: connected as fastify_runtime.
- Existing VPS IP SSH attempt: timed out. Current static IP is required to inspect
  the actual Coolify container and build configuration. No deployment performed.

## Direct Coolify investigation (2026-10-01)

Connected to the current static VPS address via SSH. The running application
image was still revision 9b4fa4e. Its old runtime database/CA values were invalid;
a healthy liveness endpoint did not establish database readiness.

Coolify's saved DATABASE_URL had the expected Supabase pooler host and password,
with no sslmode query parameter. Its saved DATABASE_SSL_CA was 1366 characters,
had PEM headers but zero actual or escaped newline sequences, and failed
OpenSSL parsing. This confirms a malformed stored certificate as the staging
configuration defect; the separately reproduced pg sslmode override is a
preventive code fix rather than the cause shown in this configuration.

Replaced the saved staging CA using Coolify's EnvironmentVariable model with
the locally verified public root certificate (22 newlines, matching SHA-256
fingerprint). Set the CA as multiline/literal and runtime-only. DATABASE_URL
and NODE_ENV were also made runtime-only. Saved an encrypted configuration
backup in the Coolify container. Installation explicitly includes development
build dependencies. Existing Coolify build commands already selected only
shared-types/backend, disproving the earlier frontend-build hypothesis.

Started one staging rollout pinned to audited revision 00b364b, deployment
7ab25aca-cc30-4688-bea2-10e01a75f694. Local defensive source changes are not
included in that published Git revision. No shared-branch push was performed.

At inspection, VPS disk was 66% used with 20 GB free and memory had 835 MB
available. No kernel OOM entry was returned by the post-recovery query. The
cause of the earlier unresponsiveness remains unproven.

### Completed rollout evidence

- Deployment 7ab25aca-cc30-4688-bea2-10e01a75f694 finished successfully; the new
  00b364b container passed its first health check.
- Compiled database preflight executed inside that container passed all runtime
  role/privilege checks with strict TLS, connected as fastify_runtime.
- Corrected invalid saved Supabase anon/service-role key values using verified
  local keys. Added the staging Pages origin to CORS and made those settings
  runtime-only. No key contents were printed. Temporary plaintext transfer
  files were removed; encrypted configuration backups remain in Coolify.
- Configuration refresh 869d8ac7-c6cc-436a-92f2-d83cab428769 finished successfully
  using the existing 00b364b image; its new container is healthy.
- Public backend and staging Pages proxy `/api/v1/health` both return healthy.

Remaining browser-flow prerequisites: add the specific staging Pages hostname
as a central platform host in frontend/backend resolution, and configure real
Cloudflare provisioning credentials before claiming automatic domain setup is
verified. No DNS writes or automatic academy provisioning were performed here.
