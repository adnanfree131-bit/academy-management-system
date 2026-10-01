import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendDist = path.resolve(__dirname, '../packages/frontend/dist');

if (!fs.existsSync(frontendDist)) {
  console.log('⚠️  Frontend dist directory not found. Please run "pnpm -r run build" first.');
  process.exit(1);
}

const FORBIDDEN_PATTERNS = [
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /service_role/i,
  /postgres:\/\/[^:]+:[^@]+@/i,
  /CLOUDFLARE_API_TOKEN/i,
  /BREVO_API_KEY/i,
  /JWT_SECRET/i,
  /OTP_PEPPER/i,
];

let violations = 0;

function scanDir(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (/\.(js|html|css|json)$/i.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          console.error(`🚨 CRITICAL SECURITY VIOLATION: Forbidden pattern ${pattern} found in ${path.relative(process.cwd(), fullPath)}`);
          violations++;
        }
      }
    }
  }
}

console.log('🔍 Scanning frontend production bundle for leaked backend secrets...');
scanDir(frontendDist);

if (violations > 0) {
  console.error(`❌ Bundle scan FAILED with ${violations} violation(s). Secret leakage detected!`);
  process.exit(1);
} else {
  console.log('✅ Bundle scan PASSED. Zero backend secrets, database credentials, or service role keys detected in frontend assets.');
  process.exit(0);
}
