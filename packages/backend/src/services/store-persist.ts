import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getLocalSnapshotPath(): string {
  const isBackendDir = process.cwd().endsWith('backend');
  return path.resolve(process.cwd(), isBackendDir ? '../..' : '.', '.local-store-snapshot.json');
}

export function loadLocalFileSnapshot(): Record<string, unknown> | null {
  try {
    const filePath = getLocalSnapshotPath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn('[StorePersist] Failed reading local snapshot file:', err);
  }
  return null;
}

export function saveLocalFileSnapshot(payload: Record<string, unknown>): void {
  try {
    const filePath = getLocalSnapshotPath();
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.warn('[StorePersist] Failed saving local snapshot file:', err);
  }
}

export function persistenceEnabled(): boolean {
  return process.env.NODE_ENV !== 'test';
}

function normalizeDatabaseUrl(raw: string): string {
  // Session pooler on 5432. Do not put sslmode=require in the URL:
  // node-pg treats that as verify-full and the snapshot never saves.
  let url = raw.replace(/:6543([/'"?]|$)/, ':5432$1');
  url = url.replace(/[?&]sslmode=[^&]*/g, '');
  url = url.replace(/\?$/, '');
  return url;
}

function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL || '');
    const local = /localhost|127\.0\.0\.1/.test(connectionString);
    pool = new Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
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
  await client.query(`
    CREATE TABLE IF NOT EXISTS kampus_store_snapshot_history (
      id BIGSERIAL PRIMARY KEY,
      payload JSONB NOT NULL,
      saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS kampus_store_backups (
      id BIGSERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      academy_count INTEGER NOT NULL DEFAULT 0,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS kampus_store_backups_kind_created ON kampus_store_backups (kind, created_at DESC)`);
}

export interface DataBackupMeta {
  id: number;
  kind: 'hourly' | 'daily' | 'manual';
  academy_count: number;
  created_at: string;
}

export function countRealAcademies(payload: Record<string, unknown> | null | undefined): number {
  if (!payload || !Array.isArray(payload.tenants)) return 0;
  return payload.tenants.filter((entry: unknown) => {
    const tenant = Array.isArray(entry) ? entry[1] : entry;
    if (!tenant || typeof tenant !== 'object') return false;
    const t = tenant as { slug?: string; settings?: { is_platform?: boolean } };
    return t.slug !== 'app' && t.settings?.is_platform !== true;
  }).length;
}

export async function loadSnapshot(): Promise<Record<string, unknown> | null> {
  if (process.env.DATABASE_URL && persistenceEnabled()) {
    try {
      const client = getPool();
      await ensureTable(client);
      const result = await client.query('SELECT payload FROM kampus_store_snapshot WHERE id = 1');
      if (result.rows[0]?.payload) {
        const dbPayload = result.rows[0].payload as Record<string, unknown>;
        saveLocalFileSnapshot(dbPayload);
        return dbPayload;
      }
    } catch (err: any) {
      console.warn(`[StorePersist] Database unavailable (${err.code || err.message}). Checking local snapshot file...`);
    }
  }

  const localPayload = loadLocalFileSnapshot();
  if (localPayload) {
    console.log('[StorePersist] Restored snapshot from local disk file.');
    return localPayload;
  }

  return null;
}

export async function saveSnapshot(payload: Record<string, unknown>): Promise<void> {
  saveLocalFileSnapshot(payload);

  if (!process.env.DATABASE_URL || !persistenceEnabled()) return;

  try {
    const client = getPool();
    await ensureTable(client);

    const existing = await client.query('SELECT payload FROM kampus_store_snapshot WHERE id = 1');
    const previous = (existing.rows[0]?.payload || null) as Record<string, unknown> | null;
    const previousCount = countRealAcademies(previous);
    const nextCount = countRealAcademies(payload);
    if (previousCount > 0 && nextCount === 0) {
      throw new Error(
        `Refusing to overwrite snapshot: would delete ${previousCount} live academ${previousCount === 1 ? 'y' : 'ies'}`
      );
    }

    if (previous) {
      await client.query(
        `INSERT INTO kampus_store_snapshot_history (payload) VALUES ($1::jsonb)`,
        [JSON.stringify(previous)]
      );
      await client.query(`
        DELETE FROM kampus_store_snapshot_history
        WHERE id NOT IN (
          SELECT id FROM kampus_store_snapshot_history ORDER BY saved_at DESC LIMIT 50
        )
      `);
      await archiveNamedBackups(client, previous);
    }
    await archiveNamedBackups(client, payload);

    await client.query(
      `INSERT INTO kampus_store_snapshot (id, payload, updated_at)
       VALUES (1, $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [JSON.stringify(payload)]
    );
  } catch (err: any) {
    if (
      err.code === 'ECONNREFUSED' ||
      err.code === 'ETIMEDOUT' ||
      err.code === 'ENOTFOUND' ||
      err.code === 'EHOSTUNREACH' ||
      /ECONNREFUSED|ETIMEDOUT|timed out|timeout/i.test(err.message)
    ) {
      console.warn(`[StorePersist] PostgreSQL connection unavailable (${err.code || err.message}) — state safely saved to local disk file.`);
      return;
    }
    throw err;
  }
}

async function archiveNamedBackups(client: pg.Pool, payload: Record<string, unknown>): Promise<void> {
  const count = countRealAcademies(payload);
  if (count <= 0) return;
  const json = JSON.stringify(payload);

  const lastDaily = await client.query(
    `SELECT created_at FROM kampus_store_backups WHERE kind = 'daily' ORDER BY created_at DESC LIMIT 1`
  );
  const sameUtcDay = lastDaily.rows[0]
    && new Date(lastDaily.rows[0].created_at).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
  if (!sameUtcDay) {
    await client.query(
      `INSERT INTO kampus_store_backups (kind, academy_count, payload) VALUES ('daily', $1, $2::jsonb)`,
      [count, json]
    );
    await client.query(`
      DELETE FROM kampus_store_backups
      WHERE kind = 'daily' AND id NOT IN (
        SELECT id FROM kampus_store_backups WHERE kind = 'daily' ORDER BY created_at DESC LIMIT 14
      )
    `);
  }
}

export async function listDataBackups(): Promise<DataBackupMeta[]> {
  if (!process.env.DATABASE_URL || !persistenceEnabled()) return [];
  try {
    const client = getPool();
    await ensureTable(client);
    const result = await client.query(
      `SELECT id, kind, academy_count, created_at
       FROM kampus_store_backups
       ORDER BY created_at DESC
       LIMIT 80`
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      kind: row.kind,
      academy_count: Number(row.academy_count),
      created_at: new Date(row.created_at).toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function createManualBackup(payload: Record<string, unknown>): Promise<DataBackupMeta> {
  saveLocalFileSnapshot(payload);
  if (!process.env.DATABASE_URL || !persistenceEnabled()) {
    return {
      id: 1,
      kind: 'manual',
      academy_count: countRealAcademies(payload),
      created_at: new Date().toISOString(),
    };
  }
  try {
    const client = getPool();
    await ensureTable(client);
    const count = countRealAcademies(payload);
    const result = await client.query(
      `INSERT INTO kampus_store_backups (kind, academy_count, payload)
       VALUES ('manual', $1, $2::jsonb)
       RETURNING id, kind, academy_count, created_at`,
      [count, JSON.stringify(payload)]
    );
    await client.query(`
      DELETE FROM kampus_store_backups
      WHERE kind = 'manual' AND id NOT IN (
        SELECT id FROM kampus_store_backups WHERE kind = 'manual' ORDER BY created_at DESC LIMIT 20
      )
    `);
    const row = result.rows[0];
    return {
      id: Number(row.id),
      kind: 'manual',
      academy_count: Number(row.academy_count),
      created_at: new Date(row.created_at).toISOString(),
    };
  } catch {
    return {
      id: 1,
      kind: 'manual',
      academy_count: countRealAcademies(payload),
      created_at: new Date().toISOString(),
    };
  }
}

export async function loadBackupPayload(id: number): Promise<Record<string, unknown> | null> {
  if (!process.env.DATABASE_URL || !persistenceEnabled()) return loadLocalFileSnapshot();
  try {
    const client = getPool();
    await ensureTable(client);
    const result = await client.query(`SELECT payload FROM kampus_store_backups WHERE id = $1`, [id]);
    return result.rows[0]?.payload || loadLocalFileSnapshot();
  } catch {
    return loadLocalFileSnapshot();
  }
}

