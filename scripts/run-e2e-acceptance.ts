/**
 * Unified E2E Acceptance Test Runner for B01–B12 Audit Remediation & C01–C09 Re-Audit Verification
 *
 * Executes real test suites across frontend rendered components, backend API/tenant boundaries,
 * PostgreSQL migration convergence/RLS, and release packaging verification.
 *
 * Dynamically computes pass/fail statuses for every criterion and reports evidence tiers truthfully.
 */

import { spawnSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

interface TestSuiteTarget {
  id: string;
  name: string;
  scope: string;
  command: string;
  args: string[];
  cwd: string;
}

const suites: TestSuiteTarget[] = [
  {
    id: 'frontend_rendered',
    name: 'Frontend Rendered Flows & Component Lifecycle',
    scope: 'Rendered DOM tests: bounded session bootstrap (C01), invitation Bearer token & dual tabs (C02, C03), onboarding continuation (B04), password recovery (B05), custom domain advisory (B07)',
    command: 'pnpm',
    args: ['--filter', '@apex/frontend', 'test', 'tests/rendered_auth_flows.test.tsx', 'tests/auth_lifecycle_resumption.test.ts', 'tests/invitations_management_and_acceptance.test.ts'],
    cwd: rootDir,
  },
  {
    id: 'backend_contracts',
    name: 'Backend Acceptance & Multi-Tenancy Boundary Contracts',
    scope: 'Registration contracts (B03), superadmin entry (B08), edge proxy forwarding (B06, C04), custom domains (B07), Cloudflare provisioning & test isolation (B09, C06), unknown hosts (B10), invitations (B11)',
    command: 'pnpm',
    args: ['--filter', '@apex/backend', 'test', 'tests/b01_b12_acceptance_e2e.test.ts', 'tests/onboard_tenant_payload_contract.test.ts', 'tests/m2_edge_backend_multitenancy.test.ts'],
    cwd: rootDir,
  },
  {
    id: 'migration_convergence',
    name: 'Database Migration Ledger & Upgrade Convergence',
    scope: 'Migration runner drift detection & checksum whitelist (B12), historical 00028 upgrade convergence & privilege revocation (C05)',
    command: 'pnpm',
    args: ['--filter', '@apex/supabase', 'test', 'tests/migration_runner_drift.test.ts', 'tests/upgrade_convergence.test.ts'],
    cwd: rootDir,
  },
  {
    id: 'rls_tenant_boundary',
    name: 'PostgreSQL Row-Level Security Policies & Boundary Enforcement',
    scope: 'Tenant isolation boundaries, audit log immutability triggers, and platform role protection policies',
    command: 'pnpm',
    args: ['--filter', '@apex/supabase', 'test', 'tests/rls.test.ts'],
    cwd: rootDir,
  },
  {
    id: 'release_packaging',
    name: 'Release Packaging & Artifact Manifest Verification',
    scope: 'Reproducible SHA-256 release manifest, HTML-to-asset references, absence of deprecated auth routes, edge proxy and backend env contracts (B01, B02, C08)',
    command: 'pnpm',
    args: ['verify:release'],
    cwd: rootDir,
  },
];

console.log('================================================================================');
console.log('   APEX ACADEMY MANAGEMENT SYSTEM — B01–B12 & C01–C09 E2E ACCEPTANCE RUNNER');
console.log('================================================================================\n');

let allPassed = true;
const suiteResults: Record<string, { passed: boolean; durationMs: number }> = {};

for (const suite of suites) {
  console.log(`▶ Executing: ${suite.name}`);
  console.log(`  Scope: ${suite.scope}`);
  console.log(`  Command: ${suite.command} ${suite.args.join(' ')}\n`);

  const startTime = Date.now();
  const result = spawnSync(suite.command, suite.args, {
    cwd: suite.cwd,
    stdio: 'inherit',
    env: { ...process.env, CI: 'true', NODE_ENV: 'test' },
  });
  const durationMs = Date.now() - startTime;
  const passed = result.status === 0;

  if (!passed) allPassed = false;
  suiteResults[suite.id] = { passed, durationMs };

  console.log(`\n✔ Completed: ${suite.name} — Status: ${passed ? 'PASSED' : 'FAILED'} (${(durationMs / 1000).toFixed(2)}s)\n`);
  console.log('--------------------------------------------------------------------------------\n');
}

// -----------------------------------------------------------------------------
// Dynamically Evaluated Acceptance Criteria Matrix
// -----------------------------------------------------------------------------
interface CriterionDefinition {
  id: string;
  finding: string;
  title: string;
  tier: string;
  requiredSuites: string[];
}

const criteriaDefinitions: CriterionDefinition[] = [
  {
    id: 'AC-01',
    finding: 'B03',
    title: 'Academy registration integration contract (valid payload & rejection of invalid)',
    tier: 'Fastify API / DataStore Contract',
    requiredSuites: ['backend_contracts'],
  },
  {
    id: 'AC-02',
    finding: 'B04/D02',
    title: 'Resumable onboarding draft recovery & authenticated academy setup without duplicate signup',
    tier: 'Rendered DOM / Web Storage',
    requiredSuites: ['frontend_rendered'],
  },
  {
    id: 'AC-03',
    finding: 'B05',
    title: 'Dedicated password recovery modal with dual password inputs and completion',
    tier: 'Rendered DOM (Happy-DOM)',
    requiredSuites: ['frontend_rendered'],
  },
  {
    id: 'AC-04',
    finding: 'B08',
    title: 'Platform superadmin entry and control plane access with zero memberships',
    tier: 'Rendered DOM & Fastify API',
    requiredSuites: ['frontend_rendered', 'backend_contracts'],
  },
  {
    id: 'AC-05',
    finding: 'B06/C04',
    title: 'Edge proxy host forwarding with fail-closed secret validation & header sanitization',
    tier: 'Edge Function & Backend Resolver',
    requiredSuites: ['backend_contracts', 'release_packaging'],
  },
  {
    id: 'AC-06',
    finding: 'B07/D01',
    title: 'Custom domain lifecycle coordination under both response orders & clean branded restricted advisory',
    tier: 'Rendered DOM & Fastify API',
    requiredSuites: ['frontend_rendered', 'backend_contracts'],
  },
  {
    id: 'AC-07',
    finding: 'B09/C06',
    title: 'Cloudflare domain provisioning status persistence, retry, and test network isolation',
    tier: 'Backend SaaS Service & Test Stub',
    requiredSuites: ['backend_contracts'],
  },
  {
    id: 'AC-08',
    finding: 'B10',
    title: 'Unknown host handling: backend unmapped host contract and frontend unavailable domain advisory',
    tier: 'Fastify API & Rendered Advisory',
    requiredSuites: ['backend_contracts', 'frontend_rendered'],
  },
  {
    id: 'AC-09',
    finding: 'B11/C02',
    title: 'Invitation acceptance uses authoritative Bearer token (no Bearer null)',
    tier: 'Rendered DOM Component Flow',
    requiredSuites: ['frontend_rendered'],
  },
  {
    id: 'AC-10',
    finding: 'C03',
    title: 'Zero-membership invited identity acceptance & dual tabs with account creation',
    tier: 'Rendered DOM Component Flow',
    requiredSuites: ['frontend_rendered'],
  },
  {
    id: 'AC-11',
    finding: 'C01',
    title: 'AuthProvider performs bounded session bootstrap without infinite request loop',
    tier: 'Rendered React Lifecycle',
    requiredSuites: ['frontend_rendered'],
  },
  {
    id: 'AC-12',
    finding: 'D01',
    title: 'Custom domain session login coordinates with delayed host mapping with bounded requests',
    tier: 'Rendered React Lifecycle',
    requiredSuites: ['frontend_rendered'],
  },
  {
    id: 'AC-13',
    finding: 'D02/E01',
    title: 'Existing identity creates academy with authentic check-domain contract (available/taken/reserved/error-retry)',
    tier: 'Rendered Component & Contract Flow',
    requiredSuites: ['frontend_rendered'],
  },
  {
    id: 'AC-18',
    finding: 'E02',
    title: 'AcademySettingsView domain provisioning status display (unverified default, pending, failed, active)',
    tier: 'Rendered Component Flow',
    requiredSuites: ['frontend_rendered'],
  },
  {
    id: 'AC-14',
    finding: 'B12',
    title: 'Migration runner drift detection & historical baseline checksum whitelisting',
    tier: 'Migration Runner / PGlite',
    requiredSuites: ['migration_convergence'],
  },
  {
    id: 'AC-15',
    finding: 'C05',
    title: 'Forward-only 00030 migration upgrade convergence & security privilege revocation',
    tier: 'PostgreSQL DDL / PGlite',
    requiredSuites: ['migration_convergence'],
  },
  {
    id: 'AC-16',
    finding: 'RLS',
    title: 'PostgreSQL Row-Level Security multi-tenant boundary and audit immutability',
    tier: 'PostgreSQL RLS / PGlite',
    requiredSuites: ['rls_tenant_boundary'],
  },
  {
    id: 'AC-17',
    finding: 'B01/C08',
    title: 'Release packaging integrity, SHA-256 artifact manifest, & absence of legacy auth routes',
    tier: 'Release Manifest & Build Artifacts',
    requiredSuites: ['release_packaging'],
  },
];

console.log('================================================================================');
console.log('                      ACCEPTANCE CRITERIA AUDIT MATRIX                          ');
console.log('================================================================================\n');
console.log(' ID    | Finding | Evidence Tier               | Status | Criterion');
console.log('-------+---------+-----------------------------+--------+---------------------------------------------------');

for (const c of criteriaDefinitions) {
  // Dynamically compute status from required suite results
  const passed = c.requiredSuites.every(sId => suiteResults[sId]?.passed === true);
  const statusStr = passed ? 'PASSED' : 'FAILED';
  const icon = passed ? '✔' : '✖';
  const paddedId = c.id.padEnd(5);
  const paddedFinding = c.finding.padEnd(7);
  const paddedTier = c.tier.padEnd(27);
  const paddedStatus = statusStr.padEnd(6);

  console.log(` ${paddedId} | ${paddedFinding} | ${paddedTier} | ${icon} ${paddedStatus} | ${c.title}`);
}

console.log('\n================================================================================');
console.log(` OVERALL RESULT: ${allPassed ? `ALL ACCEPTANCE SUITES PASSED (${criteriaDefinitions.length}/${criteriaDefinitions.length} CRITERIA VERIFIED)` : 'FAILURES DETECTED'}`);
console.log('================================================================================\n');

process.exit(allPassed ? 0 : 1);
