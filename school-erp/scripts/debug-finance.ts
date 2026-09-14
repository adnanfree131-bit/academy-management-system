import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { useDb } from '../src/db/db.js'
import { buildServer } from '../src/server.js'
import { createStudent } from '../src/kernel/people.js'
import { admitStudent } from '../src/kernel/enrollment.js'
import { postInvoice, collectPayment, openCharges, bounceReceipt, studentBalance, openCashSession } from '../src/kernel/finance.js'
import { withTenant } from '../src/db/db.js'

const db = new PGlite({ extensions: { btree_gist } })
await db.waitReady
useDb(db)
const dir = join(import.meta.dirname, '../src/db/migrations')
for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(dir, f), 'utf8'))
}
const app: any = await buildServer()

// seed tenant + admin
const t = await db.query<{ id: string }>("INSERT INTO tenants (slug, name) VALUES ('d1','D1') RETURNING id")
const tenantId = t.rows[0]!.id
await db.query('INSERT INTO tenant_serials (tenant_id) VALUES ($1)', [tenantId])
const c = await db.query<{ id: string }>("INSERT INTO campuses (tenant_id, name) VALUES ($1,'C') RETURNING id", [tenantId])
const y = await db.query<{ id: string }>(
  "INSERT INTO academic_years (tenant_id, name, start_date, end_date, status) VALUES ($1,'Y','2026-08-01','2027-05-31','ACTIVE') RETURNING id", [tenantId])
await db.query(
  `INSERT INTO calendar_days (tenant_id, year_id, day, day_type)
   SELECT $1,$2,d::date, CASE WHEN EXTRACT(ISODOW FROM d) IN (6,7) THEN 'WEEKEND' ELSE 'IN_SESSION' END
   FROM generate_series('2026-08-01'::date,'2027-05-31'::date,'1 day') d`, [tenantId, y.rows[0]!.id])
const g = await db.query<{ id: string }>("INSERT INTO grades (tenant_id,name,rank) VALUES ($1,'G1',1) RETURNING id", [tenantId])
const s = await db.query<{ id: string }>("INSERT INTO sections (tenant_id,campus_id,grade_id,name) VALUES ($1,$2,$3,'A') RETURNING id", [tenantId, c.rows[0]!.id, g.rows[0]!.id])
for (const [n, p] of [['Tuition', 10], ['Transport', 20], ['Exam', 30]] as const) {
  await db.query('INSERT INTO fee_heads (tenant_id, name, priority) VALUES ($1,$2,$3)', [tenantId, n, p])
}
const u = await db.query<{ id: string }>("INSERT INTO users (email, full_name) VALUES ('d@d.test','D') RETURNING id")
await db.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'ADMIN')", [tenantId, u.rows[0]!.id])
const otp = await app.inject({ method: 'POST', url: '/api/auth/otp', payload: { email: 'd@d.test' } })
const code = (otp.json() as any).devCode
const v = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { email: 'd@d.test', code, tenantId } })
const userId = (v.json() as any).session.userId as string

await withTenant(db, tenantId, async (tx) => {
  const pid = await createStudent(tx, { legalName: 'Debug Kid' })
  await admitStudent(tx, { personId: pid, campusId: c.rows[0]!.id, gradeId: g.rows[0]!.id, yearId: y.rows[0]!.id, entryDate: '2026-08-03' })
  const heads = await tx.query<{ id: string; name: string }>('SELECT id, name FROM fee_heads ORDER BY priority')
  const tuition = heads.rows.find((h) => h.name === 'Tuition')!
  const transport = heads.rows.find((h) => h.name === 'Transport')!
  await postInvoice(tx, { personId: pid, lines: [{ feeHeadId: transport.id, amount: 2000 }, { feeHeadId: tuition.id, amount: 8000 }] })

  console.log('--- charges before payment:', JSON.stringify(await openCharges(tx, pid)))
  const sessionId = await openCashSession(tx, userId, 0)
  const r1 = await collectPayment(tx, { personId: pid, amount: 5000, method: 'CASH', cashSessionId: sessionId, collectedBy: userId })
  console.log('--- r1:', JSON.stringify(r1))
  console.log('--- balance after r1:', JSON.stringify(await studentBalance(tx, pid)))

  const r2 = await collectPayment(tx, { personId: pid, amount: 5000, method: 'CASH', cashSessionId: sessionId, collectedBy: userId })
  console.log('--- r2:', JSON.stringify(r2))
  console.log('--- balance after r2:', JSON.stringify(await studentBalance(tx, pid)))
  const allocs = await tx.query('SELECT a.receipt_id, a.invoice_line_id, a.amount::text AS amount FROM allocations a ORDER BY a.amount DESC')
  console.log('--- all allocations:', JSON.stringify(allocs.rows))

  // F9 flow on a fresh student
  const pid2 = await createStudent(tx, { legalName: 'Cheque Kid' })
  await admitStudent(tx, { personId: pid2, campusId: c.rows[0]!.id, gradeId: g.rows[0]!.id, yearId: y.rows[0]!.id, entryDate: '2026-08-03' })
  await postInvoice(tx, { personId: pid2, lines: [{ feeHeadId: tuition.id, amount: 8000 }] })
  const rc = await collectPayment(tx, { personId: pid2, amount: 8000, method: 'CHEQUE', reference: 'CH-9', collectedBy: userId })
  console.log('--- cheque receipt:', JSON.stringify(rc), 'balance:', JSON.stringify(await studentBalance(tx, pid2)))
  await bounceReceipt(tx, { receiptId: rc.receiptId, reason: 'bounced', byUserId: userId })
  const receipts = await tx.query('SELECT serial, status, amount::text AS amount FROM receipts ORDER BY serial')
  console.log('--- receipts:', JSON.stringify(receipts.rows))
  const allocs2 = await tx.query('SELECT receipt_id, amount::text AS amount FROM allocations ORDER BY amount DESC')
  console.log('--- allocations after bounce:', JSON.stringify(allocs2.rows))
  console.log('--- balance after bounce:', JSON.stringify(await studentBalance(tx, pid2)))
})
process.exit(0)
