import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendSrc = path.resolve(__dirname, '..');

interface Violation {
  file: string;
  line: number;
  snippet: string;
  rule: string;
}

const violations: Violation[] = [];

// 1. Collect all files in request paths: routes, services/postgres-store.ts, and lib
const requestPathFiles: string[] = [];

function collectFiles(dir: string) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'scripts' && entry.name !== 'tests') {
        collectFiles(fullPath);
      }
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      requestPathFiles.push(fullPath);
    }
  }
}

collectFiles(path.join(backendSrc, 'routes'));
collectFiles(path.join(backendSrc, 'lib'));
const postgresStorePath = path.join(backendSrc, 'services', 'postgres-store.ts');
if (fs.existsSync(postgresStorePath)) {
  requestPathFiles.push(postgresStorePath);
}

// 2. Scan each file for forbidden patterns
for (const file of requestPathFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Rule 1: No direct this.pool.connect() in routes or postgres-store methods
    if (/this\.pool\.connect\s*\(/.test(line) && !line.includes('// bypass-ok')) {
      violations.push({
        file: path.relative(backendSrc, file),
        line: lineNum,
        snippet: line.trim(),
        rule: 'Forbidden `this.pool.connect()` checkout on request path',
      });
    }

    // Rule 2: No getDatabasePool().connect() on request path
    if (/getDatabasePool\s*\(\s*\)\.connect\s*\(/.test(line)) {
      violations.push({
        file: path.relative(backendSrc, file),
        line: lineNum,
        snippet: line.trim(),
        rule: 'Forbidden `getDatabasePool().connect()` on request path',
      });
    }

    // Rule 3: No pool.connect() inside route handler
    if (file.includes('routes') && /pool\.connect\s*\(/.test(line)) {
      violations.push({
        file: path.relative(backendSrc, file),
        line: lineNum,
        snippet: line.trim(),
        rule: 'Forbidden `pool.connect()` inside route handler',
      });
    }
  });
}

console.log(`\n============================================================`);
console.log(` Static Check: Request-Path Database Bypass Verification`);
console.log(` Scanned ${requestPathFiles.length} request-path files`);
console.log(`============================================================`);

if (violations.length > 0) {
  console.error(`\n❌ FAILED: Found ${violations.length} database bypass violation(s):\n`);
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line} [${v.rule}]`);
    console.error(`    Code: ${v.snippet}`);
  }
  console.error(`\nAll request-path operations MUST reuse request.dbClient / getRequestContextDb().\n`);
  process.exit(1);
} else {
  console.log(`\n✅ PASSED: 0 secondary pool checkouts found on request path.`);
  console.log(`All operations strictly reuse request-scoped transaction clients.\n`);
  process.exit(0);
}
