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

const WEEKLY_BACKUP_KEEP = 2;
const MANUAL_BACKUP_KEEP = 10;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

let tablesEnsured = false;
let lastWrittenJson: string | null = null;

async function ensureTable(client: pg.Pool): Promise<void> {
  if (tablesEnsured) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS kampus_store_snapshot (
      id INTEGER PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`ALTER TABLE kampus_store_snapshot ADD COLUMN IF NOT EXISTS academy_count INTEGER`);
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
  // Per-save history copies filled the free 500 MB disk. Auto backup is weekly.
  await client.query(`DELETE FROM kampus_store_snapshot_history`);
  await client.query(`DELETE FROM kampus_store_backups WHERE kind = 'hourly'`);
  await trimBackups(client, 'daily', 0);
  await trimBackups(client, 'weekly', WEEKLY_BACKUP_KEEP);
  await trimBackups(client, 'manual', MANUAL_BACKUP_KEEP);
  tablesEnsured = true;
}

async function trimBackups(client: pg.Pool, kind: 'daily' | 'weekly' | 'manual', keep: number): Promise<void> {
  await client.query(
    `
      DELETE FROM kampus_store_backups
      WHERE kind = $1 AND id NOT IN (
        SELECT id FROM kampus_store_backups WHERE kind = $1 ORDER BY created_at DESC LIMIT $2
      )
    `,
    [kind, keep]
  );
}

export interface DataBackupMeta {
  id: number;
  kind: 'hourly' | 'daily' | 'weekly' | 'manual';
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

export function wouldWipeAcademies(previousCount: number, nextCount: number): boolean {
  return previousCount > 0 && nextCount === 0;
}

async function readStoredAcademyCount(client: pg.Pool): Promise<number> {
  const countRow = await client.query('SELECT academy_count FROM kampus_store_snapshot WHERE id = 1');
  if (!countRow.rows[0]) return 0;
  const stored = countRow.rows[0].academy_count;
  if (stored !== null && stored !== undefined) return Number(stored);

  const full = await client.query('SELECT payload FROM kampus_store_snapshot WHERE id = 1');
  const previousCount = countRealAcademies(full.rows[0]?.payload);
  await client.query('UPDATE kampus_store_snapshot SET academy_count = $1 WHERE id = 1', [previousCount]);
  return previousCount;
}

export async function loadSnapshot(): Promise<Record<string, unknown> | null> {
  if (process.env.DATABASE_URL && persistenceEnabled()) {
    try {
      const client = getPool();
      await ensureTable(client);
      const result = await client.query('SELECT payload, academy_count FROM kampus_store_snapshot WHERE id = 1');
      if (result.rows[0]?.payload) {
        const dbPayload = result.rows[0].payload as Record<string, unknown>;
        if (result.rows[0].academy_count === null || result.rows[0].academy_count === undefined) {
          await client.query('UPDATE kampus_store_snapshot SET academy_count = $1 WHERE id = 1', [
            countRealAcademies(dbPayload),
          ]);
        }
        saveLocalFileSnapshot(dbPayload);
        lastWrittenJson = JSON.stringify(dbPayload);
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

  const json = JSON.stringify(payload);
  if (json === lastWrittenJson) return;

  try {
    const client = getPool();
    await ensureTable(client);

    const nextCount = countRealAcademies(payload);
    const previousCount = await readStoredAcademyCount(client);
    if (wouldWipeAcademies(previousCount, nextCount)) {
      throw new Error(
        `Refusing to overwrite snapshot: would delete ${previousCount} live academ${previousCount === 1 ? 'y' : 'ies'}`
      );
    }

    await archiveNamedBackups(client, json, nextCount);

    await client.query(
      `INSERT INTO kampus_store_snapshot (id, payload, academy_count, updated_at)
       VALUES (1, $1::jsonb, $2, NOW())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, academy_count = EXCLUDED.academy_count, updated_at = NOW()`,
      [json, nextCount]
    );
    lastWrittenJson = json;
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

async function archiveNamedBackups(client: pg.Pool, json: string, count: number): Promise<void> {
  if (count <= 0) return;

  const lastAuto = await client.query(
    `SELECT created_at FROM kampus_store_backups WHERE kind IN ('weekly', 'daily') ORDER BY created_at DESC LIMIT 1`
  );
  const lastAt = lastAuto.rows[0]?.created_at as string | Date | undefined;
  const due = !lastAt || Date.now() - new Date(lastAt).getTime() >= WEEK_MS;
  if (!due) return;

  await client.query(
    `INSERT INTO kampus_store_backups (kind, academy_count, payload) VALUES ('weekly', $1, $2::jsonb)`,
    [count, json]
  );
  await trimBackups(client, 'weekly', WEEKLY_BACKUP_KEEP);
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
    await trimBackups(client, 'manual', MANUAL_BACKUP_KEEP);
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

