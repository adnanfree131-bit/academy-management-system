import { describe, it, expect } from 'vitest';
import { runStagingBoundarySuite } from '../src/scripts/run-staging-boundary.js';

const isStagingEnabled = process.env.RUN_REAL_STAGING_TESTS === 'true' && Boolean(process.env.DATABASE_URL);

describe('Milestone M4: Real Supabase Staging Database Boundary Acceptance Suite (15-Scenario Matrix)', () => {
  if (!isStagingEnabled) {
    it.skip('opt-in staging acceptance suite skipped because RUN_REAL_STAGING_TESTS !== true', () => {});
    return;
  }

  it('executes full 15-scenario tenant isolation matrix and preflight against remote Supabase', async () => {
    const report = await runStagingBoundarySuite();
    expect(report.preflight.status).toBe('PASS');
    expect(report.preflight.rolsuper).toBe(false);
    expect(report.preflight.rolbypassrls).toBe(false);
    expect(report.preflight.rolcreaterole).toBe(false);
    expect(report.preflight.rolcreatedb).toBe(false);
    expect(report.preflight.isAuthenticatedMember).toBe(true);
    expect(report.preflight.ddlBlocked).toBe(true);
    expect(report.scenarios).toHaveLength(15);
    for (const scenario of report.scenarios) {
      expect(scenario.passed).toBe(true);
    }
    expect(report.teardown.clean).toBe(true);
    expect(report.teardown.errors).toHaveLength(0);
    expect(report.passed).toBe(true);
  }, 180000);
});
