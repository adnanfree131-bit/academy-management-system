import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import type { FastifyInstance } from 'fastify'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildServer } from '../src/server.js'
import { useDb } from '../src/db/db.js'

export type TenantSeed = {
  id: string
  campusId: string
  yearId: string
  grades: Record<string, string>
  sections: Record<string, string>
}

export type TestContext = {
  db: PGlite
  app: FastifyInstance
  tenantA: TenantSeed
  tenantB: TenantSeed
  adminA: { userId: string; email: string; token: string }
  adminB: { userId: string; email: string; token: string }
}

export async function setupTest(): Promise<TestContext> {
  console.log('setup: opening pglite')
  const db = new PGlite({ extensions: { btree_gist } })
  await db.waitReady

  console.log('setup: migrating')
  const dir = join(import.meta.dirname, '../src/db/migrations')
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  for (const f of files) await db.exec(readFileSync(join(dir, f), 'utf8'))

  console.log('setup: building server')
  useDb(db) // routes share the same in-memory instance
  const app: FastifyInstance = await buildServer()

  const ctx = { db, app } as TestContext
  console.log('setup: seeding tenants')
  ctx.tenantA = await seedTenant(db, 'alpha-school', 'Alpha School', 2026)
  ctx.tenantB = await seedTenant(db, 'beta-school', 'Beta School', 2026)

  console.log('setup: seeding admins')
  ctx.adminA = await seedAdmin(db, ctx.app, ctx.tenantA.id, 'admin@alpha.test')
  ctx.adminB = await seedAdmin(db, ctx.app, ctx.tenantB.id, 'admin@beta.test')
  console.log('setup: done')
  return ctx
}

export async function seedTenant(db: PGlite, slug: string, name: string, year: number): Promise<TenantSeed> {
  const t = await db.query<{ id: string }>(
    'INSERT INTO tenants (slug, name, country_code) VALUES ($1, $2, $3) RETURNING id', [slug, name, 'PK'])
  const tenantId = t.rows[0]!.id
  const c = await db.query<{ id: string }>(
    'INSERT INTO campuses (tenant_id, name) VALUES ($1, $2) RETURNING id', [tenantId, 'Main Campus'])
  const campusId = c.rows[0]!.id
  const y = await db.query<{ id: string }>(
    `INSERT INTO academic_years (tenant_id, name, start_date, end_date, status)
     VALUES ($1, $2, $3, $4, 'ACTIVE') RETURNING id`,
    [tenantId, `${year}-${year + 1}`, `${year}-08-01`, `${year + 1}-05-31`])
  const yearId = y.rows[0]!.id
  const gradeNames = ['Grade 1', 'Grade 2', 'Grade 3']
  const grades: Record<string, string> = {}
  const sections: Record<string, string> = {}
  for (let i = 0; i < gradeNames.length; i++) {
    const gname = gradeNames[i]!
    const g = await db.query<{ id: string }>(
      'INSERT INTO grades (tenant_id, name, rank) VALUES ($1, $2, $3) RETURNING id', [tenantId, gname, i + 1])
    grades[gname] = g.rows[0]!.id
    const s = await db.query<{ id: string }>(
      'INSERT INTO sections (tenant_id, campus_id, grade_id, name) VALUES ($1, $2, $3, $4) RETURNING id',
      [tenantId, campusId, g.rows[0]!.id, 'A'])
    sections[gname] = s.rows[0]!.id
  }
  // calendar: Mon-Fri in-session for the whole year
  await db.query(
    `INSERT INTO calendar_days (tenant_id, year_id, day, day_type)
     SELECT $1, $2, d::date,
       CASE WHEN EXTRACT(ISODOW FROM d) IN (6,7) THEN 'WEEKEND' ELSE 'IN_SESSION' END
     FROM generate_series($3::date, $4::date, '1 day') d`,
    [tenantId, yearId, `${year}-08-01`, `${year + 1}-05-31`])
  for (const [n, p] of [['Tuition', 10], ['Transport', 20], ['Exam', 30]] as const) {
    await db.query('INSERT INTO fee_heads (tenant_id, name, priority) VALUES ($1, $2, $3)', [tenantId, n, p])
  }
  await db.query('INSERT INTO tenant_serials (tenant_id) VALUES ($1)', [tenantId])
  return { id: tenantId, campusId, yearId, grades, sections }
}

export async function seedAdmin(
  db: PGlite,
  app: FastifyInstance,
  tenantId: string,
  email: string,
): Promise<{ userId: string; email: string; token: string }> {
  const u = await db.query<{ id: string }>(
    'INSERT INTO users (email, full_name) VALUES ($1, $2) RETURNING id', [email, 'Admin User'])
  await db.query(`INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'ADMIN')`, [tenantId, u.rows[0]!.id])

  // sign in through the real auth path (handlers via fastify inject)
  const otpRes = await app.inject({ method: 'POST', url: '/api/auth/otp', payload: { email } })
  const code = (otpRes.json() as { devCode?: string }).devCode
  if (!code) throw new Error(`otp request failed: ${otpRes.statusCode} ${otpRes.body}`)
  const verify = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { email, code, tenantId } })
  const vj = verify.json() as { token?: string; session?: { userId: string }; status?: string }
  if (verify.statusCode !== 200 || !vj.token) throw new Error(`verify failed: ${verify.statusCode} ${verify.body}`)
  return { userId: vj.session!.userId, email, token: vj.token }
}

export async function api(
  ctx: TestContext,
  method: string,
  url: string,
  body?: unknown,
  token?: string,
): Promise<{ statusCode: number; json: any }> {
  const res = await ctx.app.inject({
    method: method as any,
    url,
    payload: body as any,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
  let json: any = null
  try { json = res.json() } catch { json = res.body }
  return { statusCode: res.statusCode, json }
}
