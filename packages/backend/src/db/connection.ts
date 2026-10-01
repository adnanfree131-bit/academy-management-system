import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { validateAuthConfig } from '../config/env.js';

let pool: pg.Pool | null = null;

export function resolveSslCa(rawCa?: string): string | undefined {
  if (!rawCa) return undefined;
  const trimmed = rawCa.trim();
  if (!trimmed) return undefined;
  if (fs.existsSync(trimmed)) {
    return fs.readFileSync(trimmed, 'utf8');
  }
  const candidate = path.resolve(process.cwd(), trimmed);
  if (fs.existsSync(candidate)) {
    return fs.readFileSync(candidate, 'utf8');
  }
  const rootCandidate = path.resolve(process.cwd(), '../../', trimmed);
  if (fs.existsSync(rootCandidate)) {
    return fs.readFileSync(rootCandidate, 'utf8');
  }
  return trimmed.replace(/\\n/g, '\n');
}

export function getDatabaseSslConfig(url: string, rawCa?: string): pg.ConnectionConfig['ssl'] {
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  const ca = resolveSslCa(rawCa ?? process.env.DATABASE_SSL_CA);

  if (isLocal && !ca) {
    return undefined;
  }

  return {
    rejectUnauthorized: true,
    ...(ca ? { ca } : {}),
  };
}

export function parseDatabaseConfig(raw: string): pg.PoolConfig {
  const cleaned = raw.trim();
  const ssl = getDatabaseSslConfig(cleaned);

  // Handle postgres(ql)://user:[password]@host:port/database
  const bracketMatch = cleaned.match(/^(postgres(?:ql)?:\/\/)([^:]+):\[([^\]]+)\]@([^:]+):(\d+)\/(.+)$/);
  if (bracketMatch) {
    const [, , user, pass, host, port, db] = bracketMatch;
    return {
      user,
      password: pass,
      host,
      port: Number(port),
      database: db.split('?')[0],
      ssl,
    };
  }

  // Handle when password has unencoded '@' sign: postgres(ql)://user:password@with@at@host:port/database
  const atParts = cleaned.split('@');
  if (atParts.length > 2) {
    const hostPortDb = atParts[atParts.length - 1];
    const userPassPart = atParts.slice(0, -1).join('@');
    const firstColonIdx = userPassPart.indexOf('://');
    if (firstColonIdx !== -1) {
      const auth = userPassPart.substring(firstColonIdx + 3);
      const colonIdx = auth.indexOf(':');
      if (colonIdx !== -1) {
        const user = auth.substring(0, colonIdx);
        let pass = auth.substring(colonIdx + 1);
        if (pass.startsWith('[') && pass.endsWith(']')) {
          pass = pass.slice(1, -1);
        }
        const hostPortMatch = hostPortDb.match(/^([^:]+):(\d+)\/(.+)$/);
        if (hostPortMatch) {
          const [, host, port, db] = hostPortMatch;
          return {
            user,
            password: pass,
            host,
            port: Number(port),
            database: db.split('?')[0],
            ssl,
          };
        }
      }
    }
  }

  return {
    connectionString: cleaned,
    ssl,
  };
}

let currentPoolUrl: string | null = null;

export function getDatabasePool(): pg.Pool {
  const config = validateAuthConfig();
  const url = (config.databaseUrl || '').trim() || 'postgres://postgres:postgres@localhost:54322/postgres';

  if (!pool || currentPoolUrl !== url) {
    if (pool) {
      pool.end().catch(() => {});
    }
    currentPoolUrl = url;
    const poolConfig = parseDatabaseConfig(url);

    pool = new pg.Pool({
      ...poolConfig,
      max: Number(process.env.PG_POOL_MAX || 10),
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function verifyDatabaseConnection(): Promise<void> {
  const p = getDatabasePool();
  const client = await p.connect();
  try {
    const res = await client.query('SELECT 1 as healthy');
    if (!res.rows || res.rows.length === 0) {
      throw new Error('Database ping query returned no rows');
    }
  } finally {
    client.release();
  }
}

export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    currentPoolUrl = null;
  }
}
