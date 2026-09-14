import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

async function main() {
  console.log('step1: pglite open')
  const db = new PGlite({ extensions: { btree_gist } })
  await db.waitReady
  console.log('step2: read migrations')
  const dir = join(import.meta.dirname, '../src/db/migrations')
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  for (const f of files) {
    console.log('step2 exec:', f)
    await db.exec(readFileSync(join(dir, f), 'utf8'))
  }
  console.log('step3: build server (imports routes)')
  const { buildServer } = await import('../src/server.js')
  const app = await buildServer()
  console.log('step4: seed tenant')
  const t = await db.query<{ id: string }>(
    "INSERT INTO tenants (slug, name) VALUES ('t1','T1') RETURNING id")
  const tenantId = t.rows[0]!.id
  await db.query("INSERT INTO tenant_serials (tenant_id) VALUES ($1)", [tenantId])
  const u = await db.query<{ id: string }>(
    "INSERT INTO users (email, full_name) VALUES ('a@t.test','A') RETURNING id")
  await db.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'ADMIN')", [tenantId, u.rows[0]!.id])
  console.log('step5: otp request via handler')
  const otpRes = await app.inject({ method: 'POST', url: '/api/auth/otp', payload: { email: 'a@t.test' } })
  console.log('otp status', otpRes.statusCode, otpRes.body.slice(0, 120))
  const code = (otpRes.json() as any).devCode
  const vRes = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { email: 'a@t.test', code, tenantId } })
  console.log('verify status', vRes.statusCode, vRes.body.slice(0, 120))
  console.log('DONE')
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
