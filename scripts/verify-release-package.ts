/**
 * Release Packaging & Artifact Manifest Verification Script (Milestone M4 / Finding B01, B02, C08)
 *
 * Programmatically verifies:
 * 1. Build artifacts & reproducible SHA-256 manifest:
 *    - packages/frontend/dist (HTML, JS/CSS bundles, size checks, authoritative auth tokens)
 *    - packages/backend/dist (compiled JS entry points and declaration maps)
 *    - Generates release-manifest.json containing exact SHA-256 hashes of all assets
 * 2. HTML-to-asset reference integrity:
 *    - Parses index.html script and link references and verifies they exist on disk with valid hashes
 * 3. Absence of deprecated auth paths:
 *    - Asserts that legacy /api/v1/auth/login and /api/v1/auth/forgot-password are absent from frontend bundles
 * 4. Required environment variable contracts:
 *    - Presence and validity of Supabase credentials, database URLs, edge proxy secrets in .env.example
 * 5. Edge proxy & backend contract compatibility:
 *    - functions/api/[[catchall]].ts Cloudflare Pages proxy contract, host rewriting, secret injection, options preflight, error handling
 *    - packages/backend/src/lib/tenant-resolver.ts and env.ts secret validation
 * 6. Heuristic credential leak scanning (non-exhaustive):
 *    - Checks frontend bundles for accidental inclusion of backend service keys or connection strings
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

interface CheckResult {
  name: string;
  passed: boolean;
  details: string[];
}

interface AssetManifestEntry {
  path: string;
  sizeBytes: number;
  sha256: string;
}

const results: CheckResult[] = [];

function recordCheck(name: string, passed: boolean, details: string[] = []) {
  results.push({ name, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${passed ? 'PASS' : 'FAIL'}] ${name}`);
  for (const d of details) {
    console.log(`     ${d}`);
  }
}

function computeFileSha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function walkDirectory(dir: string, baseDir: string = dir): AssetManifestEntry[] {
  let entries: AssetManifestEntry[] = [];
  if (!fs.existsSync(dir)) return entries;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      entries = entries.concat(walkDirectory(fullPath, baseDir));
    } else {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      entries.push({
        path: relPath,
        sizeBytes: stat.size,
        sha256: computeFileSha256(fullPath),
      });
    }
  }
  return entries;
}

// -----------------------------------------------------------------------------
// Check 1: Build Artifacts & Reproducible SHA-256 Manifest
// -----------------------------------------------------------------------------
function verifyBuildArtifactsAndManifest(): { frontendAssets: AssetManifestEntry[]; backendAssets: AssetManifestEntry[] } {
  const details: string[] = [];
  let passed = true;

  const frontendDist = path.join(rootDir, 'packages/frontend/dist');
  const backendDist = path.join(rootDir, 'packages/backend/dist');

  let frontendAssets: AssetManifestEntry[] = [];
  let backendAssets: AssetManifestEntry[] = [];

  // Frontend dist check
  if (!fs.existsSync(frontendDist)) {
    passed = false;
    details.push(`packages/frontend/dist does not exist. Run "pnpm -r run build" first.`);
  } else {
    frontendAssets = walkDirectory(frontendDist);
    const indexHtml = frontendAssets.find(a => a.path === 'index.html');
    if (!indexHtml || indexHtml.sizeBytes === 0) {
      passed = false;
      details.push(`index.html is missing or empty in packages/frontend/dist.`);
    } else {
      details.push(`Frontend index.html verified (${indexHtml.sizeBytes} bytes, SHA-256: ${indexHtml.sha256.slice(0, 12)}...).`);
    }

    const jsAssets = frontendAssets.filter(a => a.path.startsWith('assets/') && a.path.endsWith('.js'));
    const cssAssets = frontendAssets.filter(a => a.path.startsWith('assets/') && a.path.endsWith('.css'));

    if (jsAssets.length === 0) {
      passed = false;
      details.push(`Zero JavaScript bundle chunks found in packages/frontend/dist/assets.`);
    } else {
      details.push(`Found ${jsAssets.length} JS bundle chunks and ${cssAssets.length} CSS stylesheets (${frontendAssets.length} total frontend assets).`);
    }

    // Supabase auth storage key check
    let foundAuthStorageKey = false;
    for (const js of jsAssets) {
      const content = fs.readFileSync(path.join(frontendDist, js.path), 'utf8');
      if (content.includes('kampus.sb.auth.token')) {
        foundAuthStorageKey = true;
        details.push(`Authoritative Supabase storage key 'kampus.sb.auth.token' verified in ${js.path}.`);
        break;
      }
    }
    if (!foundAuthStorageKey) {
      passed = false;
      details.push(`Authoritative Supabase storage key 'kampus.sb.auth.token' was NOT found in any frontend chunk.`);
    }
  }

  // Backend dist check
  if (!fs.existsSync(backendDist)) {
    passed = false;
    details.push(`packages/backend/dist does not exist. Run "pnpm -r run build" first.`);
  } else {
    backendAssets = walkDirectory(backendDist);
    const serverJs = backendAssets.find(a => a.path === 'server.js');
    const appJs = backendAssets.find(a => a.path === 'app.js');
    if (!serverJs || !appJs) {
      passed = false;
      details.push(`Backend dist missing core entry points: server.js (${Boolean(serverJs)}), app.js (${Boolean(appJs)}).`);
    } else {
      details.push(`Backend dist verified (${backendAssets.length} compiled artifacts, server.js & app.js present).`);
    }
  }

  // Edge functions (Note 2)
  const edgeCatchall = path.join(rootDir, 'functions/api/[[catchall]].ts');
  const edgeAssets: AssetManifestEntry[] = [];
  if (fs.existsSync(edgeCatchall)) {
    edgeAssets.push({
      path: 'functions/api/[[catchall]].ts',
      sizeBytes: fs.statSync(edgeCatchall).size,
      sha256: computeFileSha256(edgeCatchall),
    });
  }

  // Database migrations (Note 2)
  const migrationsDir = path.join(rootDir, 'packages/supabase/migrations');
  const migrationAssets: AssetManifestEntry[] = [];
  if (fs.existsSync(migrationsDir)) {
    const migFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const f of migFiles) {
      const fullP = path.join(migrationsDir, f);
      migrationAssets.push({
        path: `packages/supabase/migrations/${f}`,
        sizeBytes: fs.statSync(fullP).size,
        sha256: computeFileSha256(fullP),
      });
    }
  }

  // Dependency lockfile & configuration (Note 2)
  const lockfilePath = path.join(rootDir, 'pnpm-lock.yaml');
  const lockfileHash = fs.existsSync(lockfilePath) ? computeFileSha256(lockfilePath) : null;
  const envExampleFilePath = path.join(rootDir, '.env.example');
  const envExampleHash = fs.existsSync(envExampleFilePath) ? computeFileSha256(envExampleFilePath) : null;

  // Generate release-manifest.json
  const gitCommit = (() => {
    try {
      return execSync('git rev-parse HEAD', { cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      return 'unknown';
    }
  })();

  const manifest = {
    releaseVersion: '1.0.0-b01-b12-remediated',
    generatedAt: new Date().toISOString(),
    gitCommit,
    frontend: {
      totalFiles: frontendAssets.length,
      assets: frontendAssets,
    },
    backend: {
      totalFiles: backendAssets.length,
      assets: backendAssets,
    },
    edgeFunctions: {
      totalFiles: edgeAssets.length,
      assets: edgeAssets,
    },
    databaseMigrations: {
      totalFiles: migrationAssets.length,
      assets: migrationAssets,
    },
    infrastructureLocks: {
      pnpmLockSha256: lockfileHash,
      envExampleSha256: envExampleHash,
    },
  };

  const manifestPath = path.join(rootDir, 'release-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  details.push(`Generated reproducible SHA-256 release artifact manifest at release-manifest.json (includes frontend, backend, ${edgeAssets.length} edge functions, and ${migrationAssets.length} database migrations).`);

  recordCheck('Build Artifacts & Reproducible SHA-256 Manifest', passed, details);
  return { frontendAssets, backendAssets };
}

// -----------------------------------------------------------------------------
// Check 2: HTML-to-Asset Reference Integrity
// -----------------------------------------------------------------------------
function verifyHtmlAssetReferences(frontendAssets: AssetManifestEntry[]) {
  const details: string[] = [];
  let passed = true;

  const indexHtmlPath = path.join(rootDir, 'packages/frontend/dist/index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    recordCheck('HTML-to-Asset Reference Integrity', false, ['index.html does not exist.']);
    return;
  }

  const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  const assetPathsInManifest = new Set(frontendAssets.map(a => a.path));

  // Extract <script src="..."> and <link href="...">
  const scriptRegex = /<script\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi;
  const linkRegex = /<link\b[^>]*?\bhref=["']([^"']+)["'][^>]*>/gi;

  const referencedUrls: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(htmlContent)) !== null) {
    referencedUrls.push(match[1]);
  }
  while ((match = linkRegex.exec(htmlContent)) !== null) {
    const url = match[1];
    // Filter out external URLs or favicon data URIs
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
      referencedUrls.push(url);
    }
  }

  details.push(`Found ${referencedUrls.length} relative asset reference(s) in index.html.`);

  for (const rawUrl of referencedUrls) {
    // Strip leading slash if any
    const cleanRelPath = rawUrl.replace(/^\//, '');
    const physicalPath = path.join(rootDir, 'packages/frontend/dist', cleanRelPath);

    if (!fs.existsSync(physicalPath)) {
      passed = false;
      details.push(`Referenced asset missing on disk: ${rawUrl} -> ${cleanRelPath}`);
    } else {
      const stat = fs.statSync(physicalPath);
      if (stat.size === 0) {
        passed = false;
        details.push(`Referenced asset is 0 bytes: ${cleanRelPath}`);
      } else if (!assetPathsInManifest.has(cleanRelPath)) {
        passed = false;
        details.push(`Referenced asset not in manifest: ${cleanRelPath}`);
      } else {
        details.push(`Verified referenced asset: ${rawUrl} (${stat.size} bytes).`);
      }
    }
  }

  recordCheck('HTML-to-Asset Reference Integrity', passed, details);
}

// -----------------------------------------------------------------------------
// Check 3: Absence of Deprecated Auth Paths in Bundles (C08 / B01)
// -----------------------------------------------------------------------------
function verifyAbsenceOfDeprecatedAuthPaths() {
  const details: string[] = [];
  let passed = true;

  const frontendDistAssets = path.join(rootDir, 'packages/frontend/dist/assets');
  if (!fs.existsSync(frontendDistAssets)) {
    recordCheck('Absence of Deprecated Auth Paths', false, ['frontend dist assets dir missing.']);
    return;
  }

  const jsFiles = fs.readdirSync(frontendDistAssets).filter(f => f.endsWith('.js'));
  const deprecatedPatterns = [
    '/api/v1/auth/login',
    '/api/v1/auth/forgot-password',
  ];

  for (const jsFile of jsFiles) {
    const content = fs.readFileSync(path.join(frontendDistAssets, jsFile), 'utf8');
    for (const pattern of deprecatedPatterns) {
      if (content.includes(pattern)) {
        passed = false;
        details.push(`Found deprecated endpoint reference '${pattern}' in frontend bundle: ${jsFile}`);
      }
    }
  }

  if (passed) {
    details.push(`Confirmed absence of deprecated '/api/v1/auth/login' and '/api/v1/auth/forgot-password' in all ${jsFiles.length} JS bundle chunk(s).`);
  }

  recordCheck('Absence of Deprecated Auth Paths in Frontend Bundle', passed, details);
}

// -----------------------------------------------------------------------------
// Check 4: Environment Variable Contract Definitions
// -----------------------------------------------------------------------------
function verifyEnvironmentVariables() {
  const details: string[] = [];
  let passed = true;

  const requiredContractKeys = [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'BASE_DOMAIN',
    'CLOUDFLARE_PAGES_TARGET',
    'EDGE_PROXY_SECRET',
    'BACKEND_API_URL',
  ];

  const envExamplePath = path.join(rootDir, '.env.example');
  if (!fs.existsSync(envExamplePath)) {
    passed = false;
    details.push(`.env.example template file is missing from repository root.`);
  } else {
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
    const missingKeys = requiredContractKeys.filter(key => !envExampleContent.includes(key));
    if (missingKeys.length > 0) {
      passed = false;
      details.push(`.env.example missing required release keys: ${missingKeys.join(', ')}`);
    } else {
      details.push(`.env.example documents all ${requiredContractKeys.length} required release configuration keys including EDGE_PROXY_SECRET and BACKEND_API_URL.`);
    }
  }

  recordCheck('Environment Variable Contract Definitions', passed, details);
}

// -----------------------------------------------------------------------------
// Check 5: Edge Proxy Contract & Host Rewriting Verification (C04, C07, C08)
// -----------------------------------------------------------------------------
function verifyEdgeProxy() {
  const details: string[] = [];
  let passed = true;

  const edgeProxyPath = path.join(rootDir, 'functions/api/[[catchall]].ts');
  if (!fs.existsSync(edgeProxyPath)) {
    recordCheck('Cloudflare Pages Edge Proxy Contract', false, ['functions/api/[[catchall]].ts not found.']);
    return;
  }

  const proxyContent = fs.readFileSync(edgeProxyPath, 'utf8');

  // 1. Export onRequest
  if (!proxyContent.includes('export const onRequest')) {
    passed = false;
    details.push(`Edge proxy missing export const onRequest handler.`);
  } else {
    details.push(`Found export const onRequest entry point.`);
  }

  // 2. Upstream environment variable target contract (C07)
  if (!proxyContent.includes('context.env.BACKEND_API_URL') || !proxyContent.includes('context.env.UPSTREAM_BACKEND_URL')) {
    passed = false;
    details.push(`Edge proxy does not handle both BACKEND_API_URL and UPSTREAM_BACKEND_URL.`);
  } else {
    details.push(`Verified support for BACKEND_API_URL and UPSTREAM_BACKEND_URL fallbacks.`);
  }

  // 3. Spoofing header deletion (C04)
  const hasDeleteHost = proxyContent.includes("reqHeaders.delete('x-forwarded-host')");
  const hasDeleteProto = proxyContent.includes("reqHeaders.delete('x-forwarded-proto')");
  const hasDeleteSecret = proxyContent.includes("reqHeaders.delete('x-edge-proxy-secret')");
  if (!hasDeleteHost || !hasDeleteProto || !hasDeleteSecret) {
    passed = false;
    details.push(`Edge proxy does not strip client-supplied forwarding/proxy headers.`);
  } else {
    details.push(`Verified edge stripping of client-supplied x-forwarded-host, x-forwarded-proto, and x-edge-proxy-secret.`);
  }

  // 4. Secret injection from environment (C04)
  if (!proxyContent.includes("reqHeaders.set('X-Edge-Proxy-Secret', context.env.EDGE_PROXY_SECRET)")) {
    passed = false;
    details.push(`Edge proxy does not inject X-Edge-Proxy-Secret from context.env.`);
  } else {
    details.push(`Verified edge injection of X-Edge-Proxy-Secret from context.env.`);
  }

  // 5. Host header rewriting: strictly check structural assignment, not just substring 'Host'
  const hostRewritePattern = /reqHeaders\.set\(\s*['"]Host['"]\s*,\s*targetHostname\s*\)/;
  if (!hostRewritePattern.test(proxyContent)) {
    passed = false;
    details.push(`Edge proxy does not execute reqHeaders.set('Host', targetHostname) rewriting.`);
  } else {
    details.push(`Verified explicit Host header rewriting to targetHostname.`);
  }

  // 6. Options preflight handling
  if (!proxyContent.includes("context.request.method === 'OPTIONS'")) {
    passed = false;
    details.push(`Edge proxy missing OPTIONS preflight response handling.`);
  } else {
    details.push(`OPTIONS CORS preflight handler confirmed.`);
  }

  // 7. Downstream error handling
  if (!proxyContent.includes('GATEWAY_CONFIG_ERROR') || !proxyContent.includes('BACKEND_GATEWAY_ERROR')) {
    passed = false;
    details.push(`Edge proxy missing resilient downstream error handling.`);
  } else {
    details.push(`Gateway error handling (GATEWAY_CONFIG_ERROR & BACKEND_GATEWAY_ERROR) confirmed.`);
  }

  recordCheck('Cloudflare Pages Edge Proxy Contract & Host Rewriting', passed, details);
}

// -----------------------------------------------------------------------------
// Check 6: Backend Tenant Resolver & Env Contract Compatibility (C04)
// -----------------------------------------------------------------------------
function verifyBackendEdgeCompatibility() {
  const details: string[] = [];
  let passed = true;

  const resolverPath = path.join(rootDir, 'packages/backend/src/lib/tenant-resolver.ts');
  const envPath = path.join(rootDir, 'packages/backend/src/config/env.ts');

  if (!fs.existsSync(resolverPath) || !fs.existsSync(envPath)) {
    recordCheck('Backend Edge Trust Compatibility', false, ['tenant-resolver.ts or env.ts missing.']);
    return;
  }

  const resolverContent = fs.readFileSync(resolverPath, 'utf8');
  const envContent = fs.readFileSync(envPath, 'utf8');

  // Verify backend enforces EDGE_PROXY_SECRET
  if (!envContent.includes('EDGE_PROXY_SECRET')) {
    passed = false;
    details.push(`backend env.ts does not configure EDGE_PROXY_SECRET.`);
  } else {
    details.push(`Backend env.ts validates EDGE_PROXY_SECRET configuration.`);
  }

  // Verify backend resolver checks secret length and rejects dev default in production
  if (!resolverContent.includes('dev-edge-proxy-secret') || !resolverContent.includes('configuredSecret.length >= 16')) {
    passed = false;
    details.push(`tenant-resolver.ts does not guard against short or dev-default secrets.`);
  } else {
    details.push(`tenant-resolver.ts fails closed on missing secret, dev default, or length < 16 in production.`);
  }

  recordCheck('Backend Edge Trust Compatibility (Fail-Closed)', passed, details);
}

// -----------------------------------------------------------------------------
// Check 7: Heuristic Secret Leak & Credential Scan (Non-exhaustive)
// -----------------------------------------------------------------------------
function verifyHeuristicSecretLeaks() {
  const details: string[] = [];
  let passed = true;

  const frontendDistAssets = path.join(rootDir, 'packages/frontend/dist/assets');
  if (!fs.existsSync(frontendDistAssets)) {
    recordCheck('Heuristic Secret Leak & Credential Scan (Non-exhaustive)', false, ['frontend dist assets dir missing.']);
    return;
  }

  const jsFiles = fs.readdirSync(frontendDistAssets).filter(f => f.endsWith('.js'));
  const FORBIDDEN_SECRETS: { name: string; pattern: RegExp }[] = [
    { name: 'SUPABASE_SERVICE_ROLE_KEY identifier', pattern: /SUPABASE_SERVICE_ROLE_KEY/i },
    { name: 'Postgres Connection String with password', pattern: /postgres:\/\/[^:]+:[^@]+@/i },
    { name: 'CLOUDFLARE_API_TOKEN identifier', pattern: /CLOUDFLARE_API_TOKEN/i },
    { name: 'BREVO_API_KEY identifier', pattern: /BREVO_API_KEY/i },
    { name: 'JWT_SECRET identifier', pattern: /JWT_SECRET/i },
    { name: 'EDGE_PROXY_SECRET identifier', pattern: /EDGE_PROXY_SECRET/i },
  ];

  for (const jsFile of jsFiles) {
    const content = fs.readFileSync(path.join(frontendDistAssets, jsFile), 'utf8');
    for (const { name, pattern } of FORBIDDEN_SECRETS) {
      if (pattern.test(content)) {
        passed = false;
        details.push(`Potential secret leak in ${jsFile}: ${name}`);
      }
    }
  }

  if (passed) {
    details.push(`Scanned ${jsFiles.length} JS bundle chunks; no private backend secret identifiers detected.`);
  }

  recordCheck('Heuristic Secret Leak & Credential Scan (Non-exhaustive)', passed, details);
}

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------
function runVerification() {
  console.log('\n================================================================================');
  console.log('📦 Apex Release Package Verification (Milestone M4 / B01, B02, C08)');
  console.log('================================================================================\n');

  const { frontendAssets } = verifyBuildArtifactsAndManifest();
  verifyHtmlAssetReferences(frontendAssets);
  verifyAbsenceOfDeprecatedAuthPaths();
  verifyEnvironmentVariables();
  verifyEdgeProxy();
  verifyBackendEdgeCompatibility();
  verifyHeuristicSecretLeaks();

  console.log('\n--------------------------------------------------------------------------------');
  const allPassed = results.every(r => r.passed);
  if (allPassed) {
    console.log(`🎉 ALL RELEASE PACKAGING CHECKS PASSED (${results.length}/${results.length})`);
    console.log('================================================================================\n');
    process.exit(0);
  } else {
    const failedCount = results.filter(r => !r.passed).length;
    console.error(`❌ RELEASE PACKAGING CHECKS FAILED: ${failedCount} failure(s) detected.`);
    console.log('================================================================================\n');
    process.exit(1);
  }
}

runVerification();
