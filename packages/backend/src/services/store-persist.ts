import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function persistenceEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL) && process.env.NODE_ENV !== 'test';
}

function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || '';
    const local = /localhost|127\.0\.0\.1/.test(connectionString);
    pool = new Pool({
      connectionString,
      max: 2,
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
