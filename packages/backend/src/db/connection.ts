import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { X509Certificate } from 'node:crypto';
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
  if (!trimmed.startsWith('-----BEGIN CERTIFICATE-----')) {
    throw new Error('DATABASE_SSL_CA must be a readable certificate file or a PEM certificate. The configured file was not found.');
  }
  return trimmed.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
}

export function getDatabaseSslConfig(url: string, rawCa?: string): pg.ConnectionConfig['ssl'] {
  const hostname = new URL(url).hostname;
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
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

  // pg replaces the explicit ssl object when these URL options are present.
  // Application TLS policy is authoritative, including certificate verification.
  const connectionUrl = new URL(cleaned);
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) {
    connectionUrl.searchParams.delete(key);
  }
  return {
    connectionString: connectionUrl.toString(),
    ssl,
  };
}

/** Public certificate metadata only; never log the URL, password, or PEM. */
export function getDatabaseTlsDiagnostics(config: pg.PoolConfig) {
  const ssl = typeof config.ssl === 'object' ? config.ssl : undefined;
  const ca = ssl?.ca;
  const rawCa = Array.isArray(ca) ? ca[0] : ca;
  let certificate: X509Certificate | undefined;
  if (rawCa) {
    try {
      certificate = new X509Certificate(rawCa);
    } catch {
      throw new Error('DATABASE_SSL_CA contains an invalid PEM certificate. Supply the complete certificate with PEM headers and line breaks.');
    }
  }
  return {
    caLoaded: Boolean(certificate),
    rejectUnauthorized: ssl ? ssl.rejectUnauthorized !== false : null,
    ...(certificate ? {
      fingerprint256: certificate.fingerprint256,
      subject: certificate.subject,
      issuer: certificate.issuer,
    } : {}),
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
    const tlsDiagnostics = getDatabaseTlsDiagnostics(poolConfig);
    if (process.env.NODE_ENV !== 'test') {
      console.info('Database TLS configuration:', tlsDiagnostics);
    }

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
