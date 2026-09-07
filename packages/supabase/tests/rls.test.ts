import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 1: Multi-Tenant Row-Level Security (RLS) Isolation Suite', () => {
  let db: PGlite;

  const TENANT_A_ID = 'a0000000-0000-0000-0000-000000000001'; // Apex Academy
  const TENANT_B_ID = 'b0000000-0000-0000-0000-000000000002'; // Crescent College

  beforeAll(async () => {
    db = new PGlite();

    // 1. Execute Migration 00001 (Core Tenancy & Users)
    const mig1Path = path.join(__dirname, '../migrations/00001_tenants_and_core_auth.sql');
    const mig1Sql = fs.readFileSync(mig1Path, 'utf8');
    await db.exec(mig1Sql);

    // 2. Execute Migration 00002 (Academic Hierarchy & Student SIS)
    const mig2Path = path.join(__dirname, '../migrations/00002_academic_hierarchy_and_sis.sql');
    const mig2Sql = fs.readFileSync(mig2Path, 'utf8');
    await db.exec(mig2Sql);

    // 3. Execute Dual-Tenant Seed Fixture
    const seedPath = path.join(__dirname, '../seeds/001_dual_tenant_seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await db.exec(seedSql);
  });

  beforeEach(async () => {
    // Reset session context and switch to authenticated role to enforce RLS
    await db.exec(`
      RESET app.current_tenant_id;
      RESET app.is_super_admin;
      SET ROLE authenticated;
    `);
  });

  it('Gate 1: Should return 0 rows when queried with NO tenant context set', async () => {
    const res = await db.query<{ count: string }>('SELECT count(*)::text as count FROM users');
    expect(res.rows[0].count).toBe('0');

    const tenantsRes = await db.query<{ count: string }>('SELECT count(*)::text as count FROM tenants');
    expect(tenantsRes.rows[0].count).toBe('0');
  });

  it('Gate 2: Tenant A context must ONLY see Tenant A users and tenants', async () => {
    await db.exec(`SET app.current_tenant_id = '${TENANT_A_ID}';`);

    const usersRes = await db.query<{ email: string; tenant_id: string }>(
      'SELECT email, tenant_id FROM users ORDER BY email'
    );
    expect(usersRes.rows.length).toBe(3);
    
    // Validate only Apex users exist
    const emails = usersRes.rows.map(r => r.email);
    expect(emails).toContain('adnan@apexacademy.edu.pk');
    expect(emails).toContain('tariq@apexacademy.edu.pk');
    expect(emails).toContain('parent.hamza@gmail.com');
    expect(emails).not.toContain('fatima@crescent.edu.pk');

    // Validate tenant_id strictly matches Tenant A
    usersRes.rows.forEach(r => {
      expect(r.tenant_id).toBe(TENANT_A_ID);
    });

    const tenantRes = await db.query<{ id: string; name: string }>(
      'SELECT id, name FROM tenants'
    );
    expect(tenantRes.rows.length).toBe(1);
    expect(tenantRes.rows[0].id).toBe(TENANT_A_ID);
    expect(tenantRes.rows[0].name).toBe('Apex Academy Lahore');
  });

  it('Gate 3: Tenant B context must ONLY see Tenant B users and tenants', async () => {
    await db.exec(`SET app.current_tenant_id = '${TENANT_B_ID}';`);

    const usersRes = await db.query<{ email: string; tenant_id: string }>(
      'SELECT email, tenant_id FROM users ORDER BY email'
    );
    expect(usersRes.rows.length).toBe(2);

    const emails = usersRes.rows.map(r => r.email);
    expect(emails).toContain('fatima@crescent.edu.pk');
    expect(emails).toContain('ayesha@crescent.edu.pk');
    expect(emails).not.toContain('adnan@apexacademy.edu.pk');

    usersRes.rows.forEach(r => {
      expect(r.tenant_id).toBe(TENANT_B_ID);
    });

    const tenantRes = await db.query<{ id: string; name: string }>(
      'SELECT id, name FROM tenants'
    );
    expect(tenantRes.rows.length).toBe(1);
    expect(tenantRes.rows[0].id).toBe(TENANT_B_ID);
    expect(tenantRes.rows[0].name).toBe('Crescent College Karachi');
  });

  it('Gate 4: Cross-Tenant Injection: Tenant A must be BLOCKED from inserting row for Tenant B', async () => {
    await db.exec(`SET app.current_tenant_id = '${TENANT_A_ID}';`);

    // Attempt to write into Tenant B while authenticated as Tenant A
    await expect(
      db.exec(`
        INSERT INTO users (tenant_id, email, full_name, role)
        VALUES ('${TENANT_B_ID}', 'hacker@crescent.edu.pk', 'Infiltrator', 'teacher');
      `)
    ).rejects.toThrow(/new row violates row-level security policy/i);
  });

  it('Gate 5: Super Admin bypass allows full cross-tenant visibility', async () => {
    await db.exec(`SET app.is_super_admin = 'true';`);

    const usersRes = await db.query<{ count: string }>('SELECT count(*)::text as count FROM users');
    expect(usersRes.rows[0].count).toBe('5');

    const tenantsRes = await db.query<{ count: string }>('SELECT count(*)::text as count FROM tenants');
    expect(tenantsRes.rows[0].count).toBe('2');
  });

  it('Gate 6: Phase 2 - Tenant A context must ONLY see Tenant A students, programs, and inquiries', async () => {
    await db.exec(`SET app.current_tenant_id = '${TENANT_A_ID}';`);

    const studentsRes = await db.query<{ full_name: string; roll_number: string }>(
      'SELECT full_name, roll_number FROM students'
    );
    expect(studentsRes.rows.length).toBe(1);
    expect(studentsRes.rows[0].full_name).toBe('Muhammad Ali Raza');
    expect(studentsRes.rows[0].roll_number).toBe('A-101');

    const inquiriesRes = await db.query<{ student_name: string }>(
      'SELECT student_name FROM student_inquiries'
    );
    expect(inquiriesRes.rows.length).toBe(1);
    expect(inquiriesRes.rows[0].student_name).toBe('Prospective Hamza');

    const programsRes = await db.query<{ name: string }>(
      'SELECT name FROM programs'
    );
    expect(programsRes.rows.length).toBe(1);
    expect(programsRes.rows[0].name).toBe('MDCAT Comprehensive Prep');
  });

  it('Gate 7: Phase 2 - Tenant B context must ONLY see Tenant B students, programs, and batches', async () => {
    await db.exec(`SET app.current_tenant_id = '${TENANT_B_ID}';`);

    const studentsRes = await db.query<{ full_name: string; roll_number: string }>(
      'SELECT full_name, roll_number FROM students'
    );
    expect(studentsRes.rows.length).toBe(1);
    expect(studentsRes.rows[0].full_name).toBe('Zoya Tariq');
    expect(studentsRes.rows[0].roll_number).toBe('B-101');

    const programsRes = await db.query<{ name: string }>(
      'SELECT name FROM programs'
    );
    expect(programsRes.rows.length).toBe(1);
    expect(programsRes.rows[0].name).toBe('O-Levels Science Track');
  });

  it('Gate 8: Phase 2 - Cross-Tenant Student Injection must be blocked by RLS', async () => {
    await db.exec(`SET app.current_tenant_id = '${TENANT_A_ID}';`);

    // Attempt to inject a student into Tenant B
    await expect(
      db.exec(`
        INSERT INTO students (
          tenant_id, admission_number, roll_number, full_name, guardian_name, guardian_phone, program_id, batch_id
        ) VALUES (
          '${TENANT_B_ID}', 'INJECT-001', 'X-999', 'Spy Student', 'Guardian', '+923000000000',
          'b2000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001'
        );
      `)
    ).rejects.toThrow(/new row violates row-level security policy/i);
  });
});
