#!/usr/bin/env tsx
/**
 * Controlled One-Time Platform Admin Bootstrap Command
 * 
 * Requirements:
 * - Requires explicit operator confirmation: OPERATOR_CONFIRM=CONFIRM_SUPER_ADMIN_BOOTSTRAP
 * - Requires an existing verified profile in public.profiles (user must have signed up via Supabase)
 * - Promotes the profile to platform_role = 'super_admin'
 * - Records an immutable audit log entry
 * - Never run automatically during normal startup or migrations
 */

import pg from 'pg';
import { parseArgs } from 'util';

const { Pool } = pg;

async function bootstrapSuperAdmin() {
  console.log('--- KAMPUS PLATFORM SUPER ADMIN BOOTSTRAP ---');

  if (process.env.OPERATOR_CONFIRM !== 'CONFIRM_SUPER_ADMIN_BOOTSTRAP') {
    console.error('❌ SAFETY HALT: Explicit operator confirmation is required.');
    console.error('Run with environment variable: OPERATOR_CONFIRM=CONFIRM_SUPER_ADMIN_BOOTSTRAP');
    process.exit(1);
  }

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      email: { type: 'string' },
      'auth-id': { type: 'string' },
    },
    strict: false,
  });

  const targetEmail = (values.email || process.env.BOOTSTRAP_SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const targetAuthId = (values['auth-id'] || '').trim();

  if (!targetEmail && !targetAuthId) {
    console.error('❌ Error: Either --email <email> or --auth-id <uuid> must be specified.');
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

    // 1. Locate profile
    let query = 'SELECT * FROM public.profiles WHERE ';
    const params: any[] = [];
    if (targetAuthId) {
      query += 'id = $1';
      params.push(targetAuthId);
    } else {
      query += 'LOWER(email) = LOWER($1)';
      params.push(targetEmail);
    }

    const res = await client.query(query, params);
    if (res.rows.length === 0) {
      console.error(`❌ Profile not found for ${targetEmail || targetAuthId}.`);
      console.error('The identity must first exist in Supabase Auth and have an initialized profile.');
      await client.query('ROLLBACK');
      process.exit(1);
    }

    const profile = res.rows[0];

    if (profile.platform_role === 'super_admin') {
      console.log(`ℹ️ Profile '${profile.email}' (${profile.id}) is already a platform super_admin.`);
      await client.query('COMMIT');
      process.exit(0);
    }

    // 2. Promote to super_admin
    await client.query(
      `UPDATE public.profiles
       SET platform_role = 'super_admin', updated_at = NOW()
       WHERE id = $1`,
      [profile.id]
    );

    // 3. Emit immutable audit log
    await client.query(
      `INSERT INTO public.audit_logs (
        tenant_id, action, resource, resource_id,
        changes, actor_email
      ) VALUES ($1, 'PLATFORM_SUPERADMIN_BOOTSTRAP', 'profiles', $2, $3, $4)`,
      [
        '00000000-0000-0000-0000-000000000000', // Platform sentinel UUID
        profile.id,
        JSON.stringify({ previous_role: profile.platform_role, new_role: 'super_admin' }),
        'operator@bootstrap-cli',
      ]
    );

    await client.query('COMMIT');
    console.log(`✅ SUCCESS: Profile '${profile.email}' (${profile.id}) promoted to platform 'super_admin'.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Bootstrap error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

bootstrapSuperAdmin();
