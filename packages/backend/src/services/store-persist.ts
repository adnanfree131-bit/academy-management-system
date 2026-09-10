import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function persistenceEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL) && process.env.NODE_ENV !== 'test';
}

function normalizeDatabaseUrl(raw: string): string {
  // Supabase transaction pooler (6543) hangs on DDL/session features.
  // Session pooler on 5432 is required for snapshot CREATE TABLE / UPSERT.
  let url = raw.replace(/:6543([/'"?]|$)/, ':5432$1');
  if (!/sslmode=/.test(url) && !/localhost|127\.0\.0\.1/.test(url)) {
    url += url.includes('?') ? '&sslmode=require' : '?sslmode=require';
  }
  return url;
}

function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL || '');
    const local = /localhost|127\.0\.0\.1/.test(connectionString);
    pool = new Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function ensureTable(client: pg.Pool): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS kampus_store_snapshot (
      id INTEGER PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function loadSnapshot(): Promise<Record<string, unknown> | null> {
  if (!persistenceEnabled()) return null;
  const client = getPool();
  await ensureTable(client);
  const result = await client.query('SELECT payload FROM kampus_store_snapshot WHERE id = 1');
  if (!result.rows[0]) return null;
  return result.rows[0].payload as Record<string, unknown>;
}

export async function saveSnapshot(payload: Record<string, unknown>): Promise<void> {
  if (!persistenceEnabled()) return;
  const client = getPool();
  await ensureTable(client);
  await client.query(
    `INSERT INTO kampus_store_snapshot (id, payload, updated_at)
     VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [JSON.stringify(payload)]
  );
}
