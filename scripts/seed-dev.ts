#!/usr/bin/env tsx
/**
 * Controlled Local Development Seeder
 * 
 * Safety Rules:
 * - NEVER runs in production (strictly blocked if NODE_ENV === 'production')
 * - Requires explicit environment flag: ALLOW_DEMO_SEED=true
 * - Uses transactional PostgreSQL inserts
 * - Zero plaintext/application password hashes stored (all identities authenticate via Supabase Auth)
 */

import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

async function seedDev() {
  console.log('--- KAMPUS LOCAL DEVELOPMENT SEEDER ---');

  if (process.env.NODE_ENV === 'production') {
    console.error('❌ SAFETY HALT: seed:dev cannot be executed in production environment.');
    process.exit(1);
  }

  if (process.env.ALLOW_DEMO_SEED !== 'true') {
    console.error('❌ SAFETY HALT: Explicit confirmation required to seed demo data.');
    console.error('Run with environment variable: ALLOW_DEMO_SEED=true');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL is not set.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create a development demo tenant if it doesn't already exist
    const tenantSlug = 'demo';
    const tenantName = 'Demo Academy';

    const existingTenantRes = await client.query(
      `SELECT * FROM public.tenants WHERE slug = $1`,
      [tenantSlug]
    );

    let tenantId: string;

    if (existingTenantRes.rows.length > 0) {
      tenantId = existingTenantRes.rows[0].id;
      console.log(`ℹ️ Demo tenant '${tenantSlug}' already exists (${tenantId}).`);
    } else {
      tenantId = crypto.randomUUID();
      await client.query(
        `INSERT INTO public.tenants (id, name, slug, status, currency, timezone, academic_session, settings)
         VALUES ($1, $2, $3, 'active', 'PKR', 'Asia/Karachi', '2026-2027', $4)`,
        [
          tenantId,
          tenantName,
          tenantSlug,
          JSON.stringify({
            contact_email: 'demo@kampus.pk',
            phone: '042-35800000',
            city: 'Lahore',
            address: 'Main Campus, Gulberg III',
          }),
        ]
      );
      console.log(`✅ Created demo tenant '${tenantName}' (${tenantId}).`);

      // 2. Insert primary domain mapping
      await client.query(
        `INSERT INTO public.tenant_domains (id, tenant_id, hostname, is_primary, ssl_status, verification_status)
         VALUES ($1, $2, $3, true, 'active', 'verified')
         ON CONFLICT (hostname) DO NOTHING`,
        [crypto.randomUUID(), tenantId, `${tenantSlug}.kampus.pk`]
      );

      // 3. Insert canonical academic program & batches
      const programId = crypto.randomUUID();
      await client.query(
        `INSERT INTO public.programs (id, tenant_id, name, code, description, sort_order)
         VALUES ($1, $2, $3, $4, $5, 1)`,
        [programId, tenantId, 'Matric Science', 'MAT-SCI', 'Secondary School Certificate in Science']
      );

      const batchId = crypto.randomUUID();
      await client.query(
        `INSERT INTO public.batches (id, tenant_id, program_id, name, academic_session, shift, capacity, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [batchId, tenantId, programId, '10-A (Morning)', '2026-2027', 'morning', 40]
      );

      // 4. Insert core subjects
      const subjects = [
        { code: 'PHY-10', name: 'Physics', type: 'core' },
        { code: 'CHM-10', name: 'Chemistry', type: 'core' },
        { code: 'MTH-10', name: 'Mathematics', type: 'core' },
        { code: 'ENG-10', name: 'English', type: 'core' },
        { code: 'URD-10', name: 'Urdu', type: 'core' },
      ];

      for (const subj of subjects) {
        await client.query(
          `INSERT INTO public.subjects (id, tenant_id, program_id, name, code, is_elective)
           VALUES ($1, $2, $3, $4, $5, false)`,
          [crypto.randomUUID(), tenantId, programId, subj.name, subj.code]
        );
      }

      // 5. Insert sample financial account heads
      const accountHeads = [
        { name: 'Tuition Fees', type: 'income', code: 'INC-TUI' },
        { name: 'Admission Fees', type: 'income', code: 'INC-ADM' },
        { name: 'Campus Utilities', type: 'expense', code: 'EXP-UTL' },
        { name: 'Staff Salaries', type: 'expense', code: 'EXP-SAL' },
      ];

      for (const head of accountHeads) {
        await client.query(
          `INSERT INTO public.account_heads (id, tenant_id, name, type, code, is_active)
           VALUES ($1, $2, $3, $4, $5, true)
           ON CONFLICT DO NOTHING`,
          [crypto.randomUUID(), tenantId, head.name, head.type, head.code]
        );
      }

      // 6. Record audit entry
      await client.query(
        `INSERT INTO public.audit_logs (tenant_id, action, resource, resource_id, changes, actor_email)
         VALUES ($1, 'DEV_SEED', 'tenants', $2, $3, 'operator@dev-seed')`,
        [
          tenantId,
          tenantId,
          JSON.stringify({ tenant_name: tenantName, tenant_slug: tenantSlug, env: 'development' }),
        ]
      );

      console.log('✅ Created demo academic structure (Programs, Batches, Subjects, Account Heads).');
    }

    await client.query('COMMIT');
    console.log('🎉 Development seed completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error during dev seed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDev();
