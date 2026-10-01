import dotenv from 'dotenv';
import path from 'path';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const { Pool } = pg;

async function runInventory() {
  const dbUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  const cfZone = process.env.CLOUDFLARE_ZONE_ID;
  const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID;

  console.log('================ ENVIRONMENT INVENTORY ================');

  // 1. Supabase Auth Users
  console.log('\n--- 1. Supabase Auth Users ---');
  if (supabaseUrl && serviceRoleKey) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
      if (usersErr) {
        console.error('Supabase listUsers error:', usersErr.message);
      } else {
        console.log(`Total Supabase Auth Users: ${usersData.users.length}`);
        for (const u of usersData.users) {
          console.log(`  * ID: ${u.id} | Email: ${u.email} | Created: ${u.created_at}`);
        }
      }
    } catch (e: any) {
      console.error('Supabase Auth check failed:', e.message);
    }
  } else {
    console.log('Supabase URL or Service Role Key missing.');
  }

  // 2. PostgreSQL Tenants, Memberships, Platform Admins, Tenant Domains, ERP Rows
  console.log('\n--- 2. PostgreSQL Database Objects ---');
  if (dbUrl) {
    let cleanUrl = dbUrl.replace(/:6543([/'"?]|$)/, ':5432$1').replace(/[?&]sslmode=[^&]*/g, '');
    const pool = new Pool({
      connectionString: cleanUrl,
      ssl: { rejectUnauthorized: false },
    });

    try {
      const client = await pool.connect();
      try {
        const tenantsRes = await client.query('SELECT id, name, slug, status, created_at FROM public.tenants ORDER BY created_at');
        console.log(`Total Tenants: ${tenantsRes.rows.length}`);
        for (const t of tenantsRes.rows) {
          console.log(`  * Tenant ID: ${t.id} | Slug: ${t.slug} | Name: ${t.name} | Status: ${t.status}`);
        }

        const membersRes = await client.query('SELECT id, tenant_id, auth_user_id, email, role, status FROM public.tenant_memberships ORDER BY created_at');
        console.log(`Total Tenant Memberships: ${membersRes.rows.length}`);
        for (const m of membersRes.rows) {
          console.log(`  * Membership ID: ${m.id} | Tenant: ${m.tenant_id} | AuthID: ${m.auth_user_id} | Email: ${m.email} | Role: ${m.role}`);
        }

        const profilesRes = await client.query('SELECT id, email, platform_role, status FROM public.profiles WHERE platform_role IS NOT NULL');
        console.log(`Total Platform Roles (super_admin / staff): ${profilesRes.rows.length}`);
        for (const p of profilesRes.rows) {
          console.log(`  * Profile ID: ${p.id} | Email: ${p.email} | Platform Role: ${p.platform_role} | Status: ${p.status}`);
        }

        try {
          const domainsRes = await client.query('SELECT * FROM public.tenant_domains');
          console.log(`Total Tenant Domains: ${domainsRes.rows.length}`);
          for (const d of domainsRes.rows) {
            console.log(`  * Domain: ${d.hostname || d.domain} | Tenant: ${d.tenant_id} | Status: ${d.status}`);
          }
        } catch {
          console.log('Total Tenant Domains: 0 (table does not exist yet)');
        }

        try {
          const invRes = await client.query('SELECT id, tenant_id, email, role, status FROM public.tenant_invitations');
          console.log(`Total Invitations: ${invRes.rows.length}`);
          for (const i of invRes.rows) {
            console.log(`  * Invitation ID: ${i.id} | Tenant: ${i.tenant_id} | Email: ${i.email} | Role: ${i.role} | Status: ${i.status}`);
          }
        } catch {
          console.log('Total Invitations: 0 (table does not exist yet)');
        }

        // Count ERP rows across core tables
        const erpTables = [
          'students', 'staff', 'classes', 'batches', 'subjects', 'attendance_records',
          'fee_invoices', 'fee_challans', 'fee_payments', 'transactions', 'exam_terms'
        ];
        console.log('ERP Row Counts:');
        for (const tbl of erpTables) {
          try {
            const countRes = await client.query(`SELECT COUNT(*) as count FROM public.${tbl}`);
            console.log(`  - ${tbl}: ${countRes.rows[0].count}`);
          } catch {
            console.log(`  - ${tbl}: (table not found)`);
          }
        }
      } finally {
        client.release();
      }
      await pool.end();
    } catch (e: any) {
      console.error('PostgreSQL query error:', e.message);
    }
  } else {
    console.log('DATABASE_URL is not set.');
  }

  // 3. Cloudflare DNS Records & Pages Custom Hostnames
  console.log('\n--- 3. Cloudflare DNS & Custom Hostnames ---');
  if (cfToken && cfZone) {
    try {
      const dnsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${cfZone}/dns_records?per_page=100`, {
        headers: { Authorization: `Bearer ${cfToken}` },
      });
      const dnsBody: any = await dnsRes.json();
      if (dnsBody.success) {
        console.log(`Total Cloudflare DNS Records: ${dnsBody.result.length}`);
        for (const r of dnsBody.result) {
          console.log(`  * DNS: ${r.type} ${r.name} -> ${r.content} (proxied: ${r.proxied}, id: ${r.id})`);
        }
      } else {
        console.error('Cloudflare DNS query error:', dnsBody.errors);
      }
    } catch (e: any) {
      console.error('Cloudflare DNS check failed:', e.message);
    }
  }

  if (cfToken && cfAccount) {
    const pagesProject = process.env.CLOUDFLARE_PAGES_PROJECT || 'kampus-academy';
    try {
      const pagesRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/pages/projects/${pagesProject}/domains`, {
        headers: { Authorization: `Bearer ${cfToken}` },
      });
      const pagesBody: any = await pagesRes.json();
      if (pagesBody.success) {
        console.log(`Total Cloudflare Pages Domains: ${pagesBody.result.length}`);
        for (const d of pagesBody.result) {
          console.log(`  * Pages Domain: ${d.name} (status: ${d.status}, id: ${d.id})`);
        }
      } else {
        console.error('Cloudflare Pages domains error:', pagesBody.errors);
      }
    } catch (e: any) {
      console.error('Cloudflare Pages domains check failed:', e.message);
    }
  }

  console.log('\n=======================================================\n');
}

runInventory().catch(console.error);
