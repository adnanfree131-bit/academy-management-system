import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { generateCanonicalBundle } from './bundle.js';

// Load .env from root and local
dotenv.config({ path: '../../.env' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sslConfig(hostOrUrl: string): pg.ConnectionConfig['ssl'] {
  if (/localhost|127\.0\.0\.1/.test(hostOrUrl)) return undefined;
  const rawCa = process.env.DATABASE_SSL_CA;
  let ca: string | undefined;
  if (rawCa) {
    const trimmed = rawCa.trim();
    if (fs.existsSync(trimmed)) {
      ca = fs.readFileSync(trimmed, 'utf8');
    } else if (fs.existsSync(path.resolve(process.cwd(), trimmed))) {
      ca = fs.readFileSync(path.resolve(process.cwd(), trimmed), 'utf8');
    } else if (fs.existsSync(path.resolve(__dirname, '../../..', trimmed))) {
      ca = fs.readFileSync(path.resolve(__dirname, '../../..', trimmed), 'utf8');
    } else {
      ca = trimmed.replace(/\\n/g, '\n');
    }
  }
  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
}

function getClientConfig(raw: string): pg.ClientConfig {
  let cleaned = raw.trim();

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
      ssl: sslConfig(host),
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
            ssl: sslConfig(host),
          };
        }
      }
    }
  }

  return {
    connectionString: cleaned,
    ssl: sslConfig(cleaned),
  };
}

export const HISTORICAL_CHECKSUM_WHITELIST: Record<string, string[]> = {
  '00028': [
    '0d52b2b205f068fc004650c3ae193c0a4aae7b52d1d43e246acb36789a531769',
    '106d2c36d2940fd79b52b477f083393aa5a1e6c45bb2d2f262d061aaa8bd2d26',
  ],
};

export async function runMigrationLedger(
  client: pg.Client | any,
  customMigrationsDir?: string
): Promise<{ applied: string[]; skipped: string[] }> {
  // 1. Ensure schema_migrations table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // 2. Query already applied migrations
  const ledgerRes = await client.query('SELECT version, name, checksum FROM public.schema_migrations');
  const appliedMap = new Map<string, { name: string; checksum: string }>();
  for (const r of ledgerRes.rows) {
    appliedMap.set(r.version, { name: r.name, checksum: r.checksum });
  }

  // 3. Scan migrations directory
  const migrationsDir = customMigrationsDir || path.resolve(__dirname, '../migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // 4. Strict Preflight Verification: Detect checksum drift on previously applied migrations
  for (const file of migrationFiles) {
    const version = file.split('_')[0];
    if (appliedMap.has(version)) {
      const appliedRow = appliedMap.get(version)!;
      const dbHash = appliedRow.checksum;
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      const diskHash = createHash('sha256').update(sql).digest('hex');

      if (diskHash !== dbHash) {
        const whitelist = HISTORICAL_CHECKSUM_WHITELIST[version] || [];
        const isWhitelisted = whitelist.includes(dbHash) && whitelist.includes(diskHash);
        if (!isWhitelisted) {
          throw new Error(
            `DATABASE_MIGRATION_INTEGRITY_VIOLATION: Migration ${file} checksum mismatch. Expected ${dbHash}, got ${diskHash}. Modifying applied migrations is strictly forbidden; use forward-only migrations.`
          );
        }
      }
    }
  }

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of migrationFiles) {
    const version = file.split('_')[0];
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');

    if (appliedMap.has(version)) {
      skipped.push(file);
      continue;
    }

    console.log(`  Applying: ${file} (checksum: ${checksum.slice(0, 10)})...`);
    if (typeof client.exec === 'function') {
      await client.exec(sql);
    } else {
      await client.query(sql);
    }

    await client.query(
      `INSERT INTO public.schema_migrations (version, name, checksum, applied_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (version) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()`,
      [version, file, checksum]
    );
    applied.push(file);
  }

  return { applied, skipped };
}

async function runMigration() {
  const rawConnectionString = process.env.MIGRATION_DATABASE_URL || process.argv[2] || process.env.DATABASE_URL;

  if (!rawConnectionString) {
    console.error('❌ Error: No MIGRATION_DATABASE_URL or DATABASE_URL provided.');
    console.error('Usage: pnpm --filter @apex/supabase run migrate <connection_string>');
    console.error('Or set MIGRATION_DATABASE_URL / DATABASE_URL in .env');
    process.exit(1);
  }

  // First, guarantee canonical bundle is up-to-date and clean
  generateCanonicalBundle();

  const clientConfig = getClientConfig(rawConnectionString);
  console.log('🔄 Connecting to PostgreSQL database (Host: ' + (clientConfig.host || 'URI') + ', Port: ' + (clientConfig.port || 'default') + ')...');
  
  const client = new pg.Client(clientConfig);

  try {
    await client.connect();
    console.log('✅ Connected successfully to PostgreSQL / Supabase!');

    const startTime = Date.now();
    const result = await runMigrationLedger(client);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n🎉 Migrations completed in ${duration}s!`);
    console.log(`   - Newly Applied: ${result.applied.length}`);
    console.log(`   - Already Applied (Skipped): ${result.skipped.length}`);

    // Verify created tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log(`\n📊 Verified ${res.rows.length} tables in public schema.`);

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMigration();
}
