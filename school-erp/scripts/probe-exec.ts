import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { readFileSync } from 'node:fs'

const db = new PGlite({ extensions: { btree_gist } })
await db.waitReady
try {
  await db.exec(readFileSync('src/db/migrations/0001_kernel.sql', 'utf8'))
  console.log('exec: no error')
} catch (e: any) {
  console.log('exec THREW:', e.message)
}
for (const t of ['tenants', 'otp_codes', 'persons', 'enrollments', 'receipts']) {
  const r = await db.query(`SELECT to_regclass($1) AS reg`, [`public.${t}`])
  console.log(t, '→', (r.rows[0] as any).reg)
}
process.exit(0)
