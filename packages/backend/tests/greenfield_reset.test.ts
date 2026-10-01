import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import { GreenfieldResetUtility } from '../src/scripts/greenfield-reset.js';

describe('Phase 1: Greenfield Reset Utility Acceptance Gate', () => {
  let db: PGlite;
  let resetUtil: GreenfieldResetUtility;

  beforeAll(async () => {
    db = new PGlite();
    resetUtil = new GreenfieldResetUtility({ cfToken: '', supabaseUrl: '', dbUrl: '' });

    // 1. Run migrations in sequence
    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await db.exec(sql);
    }

    // 2. Run seed fixture
    const seedPath = path.resolve(__dirname, '../../supabase/seeds/001_dual_tenant_seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await db.exec(seedSql);
  });

  it('Gate 1: Rejects execution with invalid confirmation phrase', async () => {
    await expect(
      resetUtil.run({
        envName: 'staging',
        confirmationPhrase: 'WRONG_CONFIRMATION',
        dryRun: true,
      })
    ).rejects.toThrow(/Invalid confirmation phrase/);
  });

  it('Gate 2: Preserves shared platform hostnames & Brevo records, flags tenant domains', () => {
    // Platform hostnames must be preserved
    expect(resetUtil.isPreservedPlatformHostname('kampus.pk')).toBe(true);
    expect(resetUtil.isPreservedPlatformHostname('app.kampus.pk')).toBe(true);
    expect(resetUtil.isPreservedPlatformHostname('*.kampus.pk')).toBe(true);
    expect(resetUtil.isPreservedPlatformHostname('brevo1._domainkey.kampus.pk')).toBe(true);
    expect(resetUtil.isPreservedPlatformHostname('brevo2._domainkey.kampus.pk')).toBe(true);
    expect(resetUtil.isPreservedPlatformHostname('_dmarc.kampus.pk')).toBe(true);
    expect(resetUtil.isPreservedPlatformHostname('img.kampus.pk')).toBe(true);
    expect(resetUtil.isPreservedPlatformHostname('r.kampus.pk')).toBe(true);

    // Tenant subdomains must NOT be preserved (they must be flagged for deletion)
    expect(resetUtil.isPreservedPlatformHostname('tsa.kampus.pk')).toBe(false);
    expect(resetUtil.isPreservedPlatformHostname('apex-premier.kampus.pk')).toBe(false);
    expect(resetUtil.isPreservedPlatformHostname('ssc.kampus.pk')).toBe(false);
    expect(resetUtil.isPreservedPlatformHostname('custom-academy.kampus.pk')).toBe(false);
  });

  it('Gate 3: Dry run produces full inventory report without mutating database rows', async () => {
    // Verify DB has seed tenants and rows
    const preTenants = await db.query('SELECT COUNT(*) FROM public.tenants');
    expect(parseInt(preTenants.rows[0].count as string, 10)).toBeGreaterThan(0);

    const preStudents = await db.query('SELECT COUNT(*) FROM public.students');
    expect(parseInt(preStudents.rows[0].count as string, 10)).toBeGreaterThan(0);

    const report = await resetUtil.run({
      envName: 'test',
      confirmationPhrase: 'CONFIRM_GREENFIELD_RESET',
      dryRun: true,
      dbPool: db as any,
    });

    expect(report.dryRun).toBe(true);
    expect(report.deletedDatabaseTenants).toBeGreaterThan(0);
    expect(report.deletedMemberships).toBeGreaterThan(0);

    // Assert database rows are still intact
    const postTenants = await db.query('SELECT COUNT(*) FROM public.tenants');
    expect(parseInt(postTenants.rows[0].count as string, 10)).toBe(
      parseInt(preTenants.rows[0].count as string, 10)
    );
  });

  it('Gate 4: Live reset atomically purges tenants, memberships, invitations, and ERP records', async () => {
    const report = await resetUtil.run({
      envName: 'test',
      confirmationPhrase: 'CONFIRM_GREENFIELD_RESET',
      dryRun: false,
      dbPool: db as any,
      preservedEmails: ['superadmin@kampus.pk'],
    });

    expect(report.dryRun).toBe(false);
    expect(report.errors.length).toBe(0);
    expect(report.deletedDatabaseTenants).toBeGreaterThan(0);

    // Acceptance Gate Assertions:
    // 1. Tenant count is zero
    const tenants = await db.query('SELECT COUNT(*) FROM public.tenants');
    expect(parseInt(tenants.rows[0].count as string, 10)).toBe(0);

    // 2. Membership count is zero
    const memberships = await db.query('SELECT COUNT(*) FROM public.tenant_memberships');
    expect(parseInt(memberships.rows[0].count as string, 10)).toBe(0);

    // 3. Invitation count is zero
    const invitations = await db.query('SELECT COUNT(*) FROM public.tenant_invitations');
    expect(parseInt(invitations.rows[0].count as string, 10)).toBe(0);

    // 4. ERP rows are zero
    const students = await db.query('SELECT COUNT(*) FROM public.students');
    expect(parseInt(students.rows[0].count as string, 10)).toBe(0);

    const batches = await db.query('SELECT COUNT(*) FROM public.batches');
    expect(parseInt(batches.rows[0].count as string, 10)).toBe(0);

    const programs = await db.query('SELECT COUNT(*) FROM public.programs');
    expect(parseInt(programs.rows[0].count as string, 10)).toBe(0);

    const invoices = await db.query('SELECT COUNT(*) FROM public.student_invoices');
    expect(parseInt(invoices.rows[0].count as string, 10)).toBe(0);

    const payments = await db.query('SELECT COUNT(*) FROM public.fee_payments');
    expect(parseInt(payments.rows[0].count as string, 10)).toBe(0);

    const attendance = await db.query('SELECT COUNT(*) FROM public.student_attendance');
    expect(parseInt(attendance.rows[0].count as string, 10)).toBe(0);

    const salary = await db.query('SELECT COUNT(*) FROM public.staff_salary_profiles');
    expect(parseInt(salary.rows[0].count as string, 10)).toBe(0);
  });

  it('Gate 5: A second reset run is completely safe, idempotent, and reports nothing to remove', async () => {
    const report = await resetUtil.run({
      envName: 'test',
      confirmationPhrase: 'CONFIRM_GREENFIELD_RESET',
      dryRun: false,
      dbPool: db as any,
    });

    expect(report.deletedDatabaseTenants).toBe(0);
    expect(report.deletedMemberships).toBe(0);
    expect(report.deletedInvitations).toBe(0);
    expect(report.errors.length).toBe(0);
  });
});
