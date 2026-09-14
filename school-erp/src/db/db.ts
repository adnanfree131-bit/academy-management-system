import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export type Db = PGlite

const DATA_DIR = process.env.SCHOOL_ERP_DB_DIR ?? join(process.cwd(), '.school-erp-data')

let db: Db | null = null
let override: Db | null = null

/** Inject a pre-opened instance (tests, embedded use). Takes precedence over DATA_DIR. */
export function useDb(instance: Db): void {
  override = instance
}

export async function getDb(): Promise<Db> {
  if (override) return override
  if (db) return db
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  db = new PGlite(DATA_DIR, { extensions: { btree_gist } })
  await db.waitReady
  return db
}

/** Run all .sql migrations in src/db/migrations in filename order, once. */
export async function migrate(db: Db): Promise<void> {
  await db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`)
  const dir = join(import.meta.dirname, 'migrations')
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  for (const file of files) {
    const applied = await db.query<{ name: string }>('SELECT name FROM _migrations WHERE name = $1', [file])
    if (applied.rows.length > 0) continue
    const sql = readFileSync(join(dir, file), 'utf8')
    await db.exec(sql)
    await db.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
  }
}

/**
 * Run fn inside a transaction as the `authenticated` role with a tenant GUC.
 * This is the ONLY sanctioned path for tenant-scoped work: RLS + SET ROLE
 * enforce tenancy at the database layer, not in app code.
 */
export async function withTenant<T>(
  db: Db,
  tenantId: string,
  fn: (tx: TxLike) => Promise<T>,
): Promise<T> {
  await db.exec('BEGIN')
  try {
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId])
    const out = await fn(db as TxLike)
    await db.exec('COMMIT')
    return out
  } catch (err) {
    await db.exec('ROLLBACK')
    throw err
  }
}

/** Run fn as superuser (setup, seeding, global admin paths). */
export async function asAdmin<T>(db: Db, fn: (tx: TxLike) => Promise<T>): Promise<T> {
  await db.exec('BEGIN')
  try {
    const out = await fn(db as TxLike)
    await db.exec('COMMIT')
    return out
  } catch (err) {
    await db.exec('ROLLBACK')
    throw err
  }
}

export type TxLike = Pick<Db, 'query' | 'exec'>
