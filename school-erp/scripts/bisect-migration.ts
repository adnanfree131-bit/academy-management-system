import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { readFileSync } from 'node:fs'

const db = new PGlite({ extensions: { btree_gist } })
const sql = readFileSync('src/db/migrations/0001_kernel.sql', 'utf8')

// bisect: split on top-level statements not inside $$ blocks
const stmts: string[] = []
let buf = ''
let depth = 0
for (const line of sql.split('\n')) {
  buf += line + '\n'
  const opens = (line.match(/\$\$/g) || []).length
  depth += opens
  if (depth % 2 === 0) {
    if (buf.trim().endsWith(';')) {
      stmts.push(buf)
      buf = ''
    }
  }
}
if (buf.trim()) stmts.push(buf)

let n = 0
for (const s of stmts) {
  n++
  if (!s.trim()) continue
  try {
    await db.exec(s)
  } catch (err: any) {
    console.error(`FAILED at statement #${n}:`)
    console.error(s.split('\n').slice(0, 6).join('\n'))
    console.error('ERROR:', err.message)
    process.exit(1)
  }
}
console.log(`ALL ${n} STATEMENTS OK`)
