import fs from 'fs';
import path from 'path';
import type pg from 'pg';

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

export function saveLocalFileSnapshot(payload: Record<string, unknown>, filePath = getLocalSnapshotPath()): void {
  try {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tempPath, filePath);
    fs.chmodSync(filePath, 0o600);
  } catch (err) {
    console.warn('[StorePersist] Failed saving local snapshot file:', err);
  }
}

export function persistenceEnabled(): boolean {
  return process.env.NODE_ENV !== 'test';
}

export function getDatabaseSslConfig(connectionString: string): pg.ConnectionConfig['ssl'] {
  if (/localhost|127\.0\.0\.1/.test(connectionString)) return undefined;
  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, '\n');
  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
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

/**
 * Phase 3: PostgreSQL is the exclusive production application data store.
 * Database snapshot tables, database hydration, and snapshot persistence to PostgreSQL have been permanently retired.
 * Snapshot methods remain only as local disk fixtures for offline test suites.
 */

export async function loadSnapshot(): Promise<Record<string, unknown> | null> {
  return loadLocalFileSnapshot();
}

export async function saveSnapshot(payload: Record<string, unknown>): Promise<void> {
  saveLocalFileSnapshot(payload);
}

export async function listDataBackups(): Promise<DataBackupMeta[]> {
  return [];
}

export async function createManualBackup(payload: Record<string, unknown>): Promise<DataBackupMeta> {
  saveLocalFileSnapshot(payload);
  return {
    id: 1,
    kind: 'manual',
    academy_count: countRealAcademies(payload),
    created_at: new Date().toISOString(),
  };
}

export async function loadBackupPayload(_id: number): Promise<Record<string, unknown> | null> {
  return loadLocalFileSnapshot();
}
