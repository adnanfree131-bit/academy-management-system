import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from workspace root or local
const possibleEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(process.cwd(), '../../.env'),
];
for (const p of possibleEnvPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}
dotenv.config();

const { Pool } = pg;

export interface ResetOptions {
  envName: string;
  confirmationPhrase: string;
  dryRun?: boolean;
  preservedEmails?: string[];
  dbPool?: pg.Pool;
}

export interface ResetReport {
  dryRun: boolean;
  preservedPlatformRecords: string[];
  deletedDnsRecords: string[];
  deletedPagesDomains: string[];
  deletedDatabaseTenants: number;
  deletedMemberships: number;
  deletedInvitations: number;
  deletedErpRows: Record<string, number>;
  deletedSupabaseUsers: string[];
  errors: string[];
}

export interface GreenfieldResetConfig {
  baseDomain?: string;
  cfToken?: string;
  cfZoneId?: string;
  cfAccountId?: string;
  cfPagesProject?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  dbUrl?: string;
}

export class GreenfieldResetUtility {
  private baseDomain: string;
  private cfToken: string;
  private cfZoneId: string;
  private cfAccountId: string;
  private cfPagesProject: string;
  private supabaseUrl: string;
  private supabaseKey: string;
  private dbUrl: string;

  constructor(config: GreenfieldResetConfig = {}) {
    this.baseDomain = (config.baseDomain ?? process.env.BASE_DOMAIN ?? 'kampus.pk').trim().toLowerCase();
    this.cfToken = (config.cfToken ?? process.env.CLOUDFLARE_API_TOKEN ?? '').trim();
    this.cfZoneId = (config.cfZoneId ?? process.env.CLOUDFLARE_ZONE_ID ?? '').trim();
    this.cfAccountId = (config.cfAccountId ?? process.env.CLOUDFLARE_ACCOUNT_ID ?? '').trim();
    this.cfPagesProject = (config.cfPagesProject ?? process.env.CLOUDFLARE_PAGES_PROJECT ?? 'kampus-academy').trim();
    this.supabaseUrl = (config.supabaseUrl ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').trim();
    this.supabaseKey = (config.supabaseKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
    this.dbUrl = (config.dbUrl ?? process.env.DATABASE_URL ?? '').trim();
  }

  isPreservedPlatformHostname(name: string): boolean {
    const clean = name.trim().toLowerCase().replace(/\.$/, '');
    const base = this.baseDomain;

    if (clean === base) return true;
    if (clean === `app.${base}`) return true;
    if (clean === `*.${base}`) return true;
    if (clean.endsWith('.dkim.brevo.com')) return true;
    if (clean.includes('_domainkey') || clean.includes('_dmarc') || clean.startsWith('brevo')) return true;
    if (clean === `img.${base}` || clean === `r.${base}`) return true;

    return false;
  }

  async run(options: ResetOptions): Promise<ResetReport> {
    const expectedConfirm = `RESET_GREENFIELD_${options.envName.toUpperCase()}`;
    if (options.confirmationPhrase !== expectedConfirm && options.confirmationPhrase !== 'CONFIRM_GREENFIELD_RESET') {
      throw new Error(
        `Invalid confirmation phrase. Expected '${expectedConfirm}' or 'CONFIRM_GREENFIELD_RESET', received: '${options.confirmationPhrase}'`
      );
    }

    const report: ResetReport = {
      dryRun: Boolean(options.dryRun),
      preservedPlatformRecords: [],
      deletedDnsRecords: [],
      deletedPagesDomains: [],
      deletedDatabaseTenants: 0,
      deletedMemberships: 0,
      deletedInvitations: 0,
      deletedErpRows: {},
      deletedSupabaseUsers: [],
      errors: [],
    };

    console.log(`\n=======================================================`);
    console.log(`🧹 GREENFIELD RESET UTILITY [Environment: ${options.envName}]`);
    console.log(`Mode: ${report.dryRun ? '🔍 DRY RUN (No changes will be applied)' : '⚡ LIVE DESTRUCTION'}`);
    console.log(`=======================================================\n`);

    // 1. Cloudflare DNS & Pages Teardown
    await this.cleanupCloudflare(report, Boolean(options.dryRun));

    // 2. Database Cleanup (if DATABASE_URL is set and reachable, or custom pool provided)
    await this.cleanupDatabase(report, Boolean(options.dryRun), options.dbPool);

    // 3. Supabase Auth Cleanup
    await this.cleanupSupabaseAuth(report, Boolean(options.dryRun), options.preservedEmails || []);

    // 4. Verify post-cleanup state if not dry-run
    if (!options.dryRun) {
      console.log('\n🔎 Verifying zero orphaned tenant resources...');
      await this.verifyZeroResidue(report, options.dbPool, options.preservedEmails || []);
    }

    console.log(`\n=======================================================`);
    console.log(`Summary:`);
    console.log(`  - Preserved Platform Records: ${report.preservedPlatformRecords.length}`);
    console.log(`  - Tenant DNS Records Cleaned: ${report.deletedDnsRecords.length}`);
    console.log(`  - Pages Custom Domains Cleaned: ${report.deletedPagesDomains.length}`);
    console.log(`  - Database Tenants Cleaned: ${report.deletedDatabaseTenants}`);
    console.log(`  - Memberships Cleaned: ${report.deletedMemberships}`);
    console.log(`  - Supabase Auth Users Cleaned: ${report.deletedSupabaseUsers.length}`);
    console.log(`  - Errors Encountered: ${report.errors.length}`);
    console.log(`=======================================================\n`);

    if (report.errors.length > 0) {
      throw new Error(`Greenfield reset failed with ${report.errors.length} error(s):\n${report.errors.join('\n')}`);
    }

    return report;
  }

  private async cleanupCloudflare(report: ResetReport, dryRun: boolean): Promise<void> {
    if (!this.cfToken || !this.cfZoneId) {
      console.log('⏭️  Cloudflare credentials not configured, skipping Cloudflare cleanup.');
      return;
    }

    console.log('📡 Scanning Cloudflare DNS records for tenant subdomains...');
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.cfZoneId}/dns_records?per_page=100`,
        { headers: { Authorization: `Bearer ${this.cfToken}` } }
      );
      const data: any = await res.json();
      if (!data.success) {
        report.errors.push(`Failed to list Cloudflare DNS records: ${JSON.stringify(data.errors)}`);
        return;
      }

      for (const record of data.result || []) {
        if (this.isPreservedPlatformHostname(record.name)) {
          report.preservedPlatformRecords.push(`DNS: ${record.type} ${record.name}`);
        } else {
          // This is a tenant-specific DNS record (e.g. tsa.kampus.pk, apex-premier.kampus.pk)
          if (dryRun) {
            report.deletedDnsRecords.push(`[DryRun] Would delete DNS: ${record.name} (${record.id})`);
            console.log(`  - [DryRun] Candidate tenant DNS record: ${record.name} (${record.id})`);
          } else {
            console.log(`  - Deleting tenant DNS record: ${record.name} (${record.id})...`);
            const delRes = await fetch(
              `https://api.cloudflare.com/client/v4/zones/${this.cfZoneId}/dns_records/${record.id}`,
              { method: 'DELETE', headers: { Authorization: `Bearer ${this.cfToken}` } }
            );
            const delData: any = await delRes.json();
            if (delData.success) {
              report.deletedDnsRecords.push(`${record.name} (${record.id})`);
            } else {
              report.errors.push(`Failed deleting DNS record ${record.name}: ${JSON.stringify(delData.errors)}`);
            }
          }
        }
      }
    } catch (e: any) {
      report.errors.push(`Cloudflare DNS exception: ${e.message}`);
    }

    // Pages Custom Domains
    if (this.cfAccountId && this.cfPagesProject) {
      console.log('📡 Scanning Cloudflare Pages custom domains...');
      try {
        const pagesRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${this.cfAccountId}/pages/projects/${this.cfPagesProject}/domains`,
          { headers: { Authorization: `Bearer ${this.cfToken}` } }
        );
        const pagesData: any = await pagesRes.json();
        if (!pagesData.success) {
          report.errors.push(`Failed to list Pages custom domains: ${JSON.stringify(pagesData.errors)}`);
          return;
        }

        for (const dom of pagesData.result || []) {
          if (this.isPreservedPlatformHostname(dom.name)) {
            report.preservedPlatformRecords.push(`Pages Domain: ${dom.name}`);
          } else {
            if (dryRun) {
              report.deletedPagesDomains.push(`[DryRun] Would delete Pages domain: ${dom.name}`);
              console.log(`  - [DryRun] Candidate Pages custom domain: ${dom.name}`);
            } else {
              console.log(`  - Deleting Pages custom domain: ${dom.name}...`);
              const delRes = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${this.cfAccountId}/pages/projects/${this.cfPagesProject}/domains/${dom.name}`,
                { method: 'DELETE', headers: { Authorization: `Bearer ${this.cfToken}` } }
              );
              const delData: any = await delRes.json();
              if (delData.success) {
                report.deletedPagesDomains.push(dom.name);
              } else {
                report.errors.push(`Failed deleting Pages domain ${dom.name}: ${JSON.stringify(delData.errors)}`);
              }
            }
          }
        }
      } catch (e: any) {
        report.errors.push(`Cloudflare Pages custom domain exception: ${e.message}`);
      }
    }
  }

  private async cleanupDatabase(report: ResetReport, dryRun: boolean, customPool?: any): Promise<void> {
    let pool = customPool;
    let ownPool = false;

    if (!pool && this.dbUrl) {
      try {
        const cleanUrl = this.dbUrl.replace(/:6543([/'"?]|$)/, ':5432$1').replace(/[?&]sslmode=[^&]*/g, '');
        pool = new Pool({
          connectionString: cleanUrl,
          connectionTimeoutMillis: 5000,
          ssl: { rejectUnauthorized: false },
        });
        ownPool = true;
      } catch (err: any) {
        console.warn(`Could not connect to database at ${this.dbUrl}:`, err.message);
        return;
      }
    }

    if (!pool) {
      console.log('⏭️  No active database connection available, skipping database cleanup.');
      return;
    }

    let client: any = null;
    let releaseFn = () => {};

    try {
      if (typeof pool.connect === 'function') {
        client = await pool.connect();
        releaseFn = () => client.release();
      } else {
        client = pool;
      }
    } catch (err: any) {
      console.warn(`Database connect skipped (ECONNREFUSED / unreachable): ${err.message}`);
      if (ownPool) await pool.end();
      return;
    }

    try {
      console.log('🗄️ Inspecting PostgreSQL tenant tables...');

      // Find tenant count
      const tenantsRes = await client.query('SELECT COUNT(*) FROM public.tenants');
      const tenantCount = parseInt(tenantsRes.rows[0].count, 10);

      const memRes = await client.query('SELECT COUNT(*) FROM public.tenant_memberships');
      const memCount = parseInt(memRes.rows[0].count, 10);

      let invCount = 0;
      try {
        const invRes = await client.query('SELECT COUNT(*) FROM public.tenant_invitations');
        invCount = parseInt(invRes.rows[0].count, 10);
      } catch {
        // Table might not exist yet
      }

      console.log(`Found in database: ${tenantCount} tenant(s), ${memCount} membership(s), ${invCount} invitation(s).`);

      if (dryRun) {
        report.deletedDatabaseTenants = tenantCount;
        report.deletedMemberships = memCount;
        report.deletedInvitations = invCount;
        return;
      }

      // 1. Discover all existing tables in public schema to avoid aborted transaction errors
      const existingTablesRes = await client.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
      );
      const existingTables = new Set(existingTablesRes.rows.map((r: any) => r.tablename));

      // Execute full transactional deletion
      console.log('⚡ Beginning atomic database reset transaction...');
      await client.query('BEGIN');

      const erpTables = [
        'student_profile_audit_logs',
        'staff_attendance_audit_logs',
        'whatsapp_audit_logs',
        'retention_counseling_cases',
        'absentee_followups',
        'notebook_checks',
        'homework_assignments',
        'leave_applications',
        'complaint_tickets',
        'student_exam_evaluations',
        'exam_questions',
        'exams',
        'question_chapters',
        'bank_questions',
        'student_attendance',
        'staff_attendance',
        'staff_regularization_requests',
        'timetable_slots',
        'rooms',
        'fee_payments',
        'invoice_items',
        'student_invoices',
        'fee_invoices',
        'fee_challans',
        'fee_discounts',
        'fee_priority_configs',
        'fee_structures',
        'fee_heads',
        'staff_payslips',
        'staff_salary_profiles',
        'student_enrolled_subjects',
        'subject_group_items',
        'subject_groups',
        'subjects',
        'student_inquiries',
        'students',
        'batches',
        'classes',
        'programs',
        'custom_field_definitions',
        'platform_announcement_receipts',
        'platform_announcements',
        'tenant_announcement_receipts',
        'tenant_announcements',
        'tenant_slug_aliases',
        'subscription_payment_receipts',
        'subscription_payment_proofs',
        'tenant_invitations',
        'tenant_domains',
        'tenant_memberships',
      ];

      const getRowCount = (res: any): number => res?.rowCount ?? res?.affectedRows ?? 0;

      for (const tbl of erpTables) {
        if (existingTables.has(tbl)) {
          const res = await client.query(`DELETE FROM public.${tbl}`);
          report.deletedErpRows[tbl] = getRowCount(res);
        }
      }

      // Delete tenants
      if (existingTables.has('tenants')) {
        const delTenants = await client.query('DELETE FROM public.tenants');
        report.deletedDatabaseTenants = getRowCount(delTenants) || tenantCount;
      }
      report.deletedMemberships = memCount;
      report.deletedInvitations = invCount;

      // Delete non-superadmin profiles
      if (existingTables.has('profiles')) {
        await client.query(`
          DELETE FROM public.profiles
          WHERE platform_role IS NULL OR platform_role != 'super_admin'
        `);
      }

      await client.query('COMMIT');
      console.log('✅ Atomic database reset transaction committed.');
    } catch (e: any) {
      if (client) {
        await client.query('ROLLBACK').catch(() => {});
      }
      report.errors.push(`Database reset transaction failed: ${e.message}`);
    } finally {
      releaseFn();
      if (ownPool) await pool.end();
    }
  }

  private async cleanupSupabaseAuth(report: ResetReport, dryRun: boolean, preservedEmails: string[]): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.log('⏭️  Supabase URL/Key missing, skipping Supabase Auth user cleanup.');
      return;
    }

    let supabaseAdmin: ReturnType<typeof createClient>;
    try {
      supabaseAdmin = createClient(this.supabaseUrl, this.supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    } catch (e: any) {
      console.warn(`Supabase client init error: ${e.message}`);
      return;
    }

    console.log('👤 Inspecting Supabase Auth users...');
    try {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
      if (error) {
        console.warn('Supabase listUsers skipped:', error.message);
        return;
      }

      const preservedSet = new Set(preservedEmails.map(e => e.trim().toLowerCase()));

      for (const u of data.users) {
        const email = (u.email || '').toLowerCase();
        if (preservedSet.has(email)) {
          report.preservedPlatformRecords.push(`Supabase User: ${email} (${u.id})`);
        } else {
          if (dryRun) {
            report.deletedSupabaseUsers.push(`[DryRun] Would delete Auth user: ${email} (${u.id})`);
            console.log(`  - [DryRun] Candidate disposable Supabase user: ${email}`);
          } else {
            console.log(`  - Deleting disposable Supabase user: ${email} (${u.id})...`);
            const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(u.id);
            if (delErr) {
              report.errors.push(`Failed deleting Supabase user ${email}: ${delErr.message}`);
            } else {
              report.deletedSupabaseUsers.push(`${email} (${u.id})`);
            }
          }
        }
      }
    } catch (e: any) {
      console.warn(`Supabase auth cleanup skipped: ${e.message}`);
    }
  }

  private async verifyZeroResidue(report: ResetReport, customPool?: any, preservedEmails: string[] = []): Promise<void> {
    // 1. Verify Cloudflare
    if (this.cfToken && this.cfZoneId) {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.cfZoneId}/dns_records?per_page=100`,
        { headers: { Authorization: `Bearer ${this.cfToken}` } }
      );
      const data: any = await res.json();
      if (data.success) {
        for (const record of data.result || []) {
          if (!this.isPreservedPlatformHostname(record.name)) {
            report.errors.push(`Residual tenant DNS record found: ${record.name} (${record.id})`);
          }
        }
      }
    }

    if (this.cfToken && this.cfAccountId && this.cfPagesProject) {
      const pagesRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.cfAccountId}/pages/projects/${this.cfPagesProject}/domains`,
        { headers: { Authorization: `Bearer ${this.cfToken}` } }
      );
      const pagesData: any = await pagesRes.json();
      if (pagesData.success) {
        for (const dom of pagesData.result || []) {
          if (!this.isPreservedPlatformHostname(dom.name)) {
            report.errors.push(`Residual Pages domain found: ${dom.name}`);
          }
        }
      }
    }

    // 2. Verify Database
    let pool = customPool;
    let ownPool = false;
    if (!pool && this.dbUrl) {
      try {
        const cleanUrl = this.dbUrl.replace(/:6543([/'"?]|$)/, ':5432$1').replace(/[?&]sslmode=[^&]*/g, '');
        pool = new Pool({ connectionString: cleanUrl, connectionTimeoutMillis: 3000, ssl: { rejectUnauthorized: false } });
        ownPool = true;
      } catch {
        // unreachable
      }
    }

    if (pool) {
      let client: any = null;
      let releaseFn = () => {};
      try {
        if (typeof pool.connect === 'function') {
          client = await pool.connect();
          releaseFn = () => client.release();
        } else {
          client = pool;
        }

        const t = await client.query('SELECT COUNT(*) FROM public.tenants');
        if (parseInt(t.rows[0].count, 10) > 0) {
          report.errors.push(`Residual tenants found: ${t.rows[0].count}`);
        }
        const m = await client.query('SELECT COUNT(*) FROM public.tenant_memberships');
        if (parseInt(m.rows[0].count, 10) > 0) {
          report.errors.push(`Residual memberships found: ${m.rows[0].count}`);
        }
      } catch {
        // ECONNREFUSED
      } finally {
        releaseFn();
        if (ownPool) await pool.end();
      }
    }

    // 3. Verify Supabase Auth
    if (this.supabaseUrl && this.supabaseKey) {
      try {
        const supabaseAdmin = createClient(this.supabaseUrl, this.supabaseKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
        const preservedSet = new Set(preservedEmails.map(e => e.trim().toLowerCase()));
        if (data?.users) {
          for (const u of data.users) {
            const email = (u.email || '').toLowerCase();
            if (!preservedSet.has(email)) {
              report.errors.push(`Residual disposable Supabase Auth user found: ${email} (${u.id})`);
            }
          }
        }
      } catch {
        // fetch failed
      }
    }
  }
}

// CLI entrypoint
import { pathToFileURL } from 'url';

if (process.argv[1] && (import.meta.url === pathToFileURL(process.argv[1]).href || process.argv[1].endsWith('greenfield-reset.ts'))) {
  const args = process.argv.slice(2);
  const getArg = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    const arg = args.find(a => a.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : undefined;
  };
  const hasFlag = (name: string): boolean => args.includes(`--${name}`);

  const envName = getArg('env') || process.env.NODE_ENV || 'development';
  const confirmationPhrase = getArg('confirm') || '';
  const dryRun = hasFlag('dry-run');
  const preservedEmails = (getArg('preserved-emails') || process.env.PRESERVED_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  const utility = new GreenfieldResetUtility();

  utility
    .run({
      envName,
      confirmationPhrase,
      dryRun,
      preservedEmails,
    })
    .then(() => {
      console.log('✨ Greenfield reset script completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Greenfield reset terminated with error:\n', err.message);
      process.exit(1);
    });
}
