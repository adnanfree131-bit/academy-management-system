import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env from root and local
dotenv.config({ path: '../../.env' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      ssl: { rejectUnauthorized: false },
    };
  }

  // Handle when password has unencoded '@' sign: postgres(ql)://user:password@with@at@host:port/database
  // Everything after the last '@' is host:port/database
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
            ssl: { rejectUnauthorized: false },
          };
        }
      }
    }
  }

  return {
    connectionString: cleaned,
    ssl: { rejectUnauthorized: false },
  };
}

async function runMigration() {
  const rawConnectionString = process.argv[2] || process.env.DATABASE_URL;

  if (!rawConnectionString) {
    console.error('❌ Error: No DATABASE_URL provided.');
    console.error('Usage: pnpm --filter @apex/supabase run migrate <connection_string>');
    console.error('Or set DATABASE_URL in .env');
    process.exit(1);
  }

  const clientConfig = getClientConfig(rawConnectionString);
  console.log('🔄 Connecting to PostgreSQL database (Host: ' + (clientConfig.host || 'URI') + ', Port: ' + (clientConfig.port || 'default') + ')...');
  
  const client = new pg.Client(clientConfig);

  try {
    await client.connect();
    console.log('✅ Connected successfully to PostgreSQL / Supabase!');

    const ddlPath = path.resolve(__dirname, '../deploy_all_migrations.sql');
    if (!fs.existsSync(ddlPath)) {
      throw new Error(`DDL file not found at ${ddlPath}`);
    }

    const sql = fs.readFileSync(ddlPath, 'utf8');
    console.log(`📄 Executing ${sql.split('\n').length} lines of DDL migrations & RLS policies...`);

    const startTime = Date.now();
    await client.query(sql);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`🎉 Migrations completed successfully in ${duration}s!`);

    const seedPath = path.resolve(__dirname, '../seeds/001_dual_tenant_seed.sql');
    if (fs.existsSync(seedPath)) {
      console.log('🌱 Seeding initial academy data (Tenants, Admin Users, Batches)...');
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await client.query(seedSql);
      console.log('✅ Seed data applied successfully!');
    }

    // Verify created tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log(`\n📊 Verified ${res.rows.length} tables in public schema:`);
    const tableNames = res.rows.map((r: any) => r.table_name);
    console.log(tableNames.join(', '));

    // Verify seeded tenants
    const tenantRes = await client.query(`SELECT id, name, slug FROM tenants;`);
    console.log(`\n🏫 Initialized Tenants (${tenantRes.rows.length}):`);
    tenantRes.rows.forEach((t: any) => console.log(` - ${t.name} (slug: ${t.slug}, id: ${t.id})`));

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
