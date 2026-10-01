import dotenv from 'dotenv';

// Ensure .env is loaded
dotenv.config({ path: '../../.env' });
dotenv.config();

export interface BackendAuthConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  supabaseJwtIssuer: string;
  supabaseJwksUrl: string;
  supabaseJwtAudience: string;
  authRedirectUrl: string;
  databaseUrl: string;
  edgeProxySecret: string;
  isProduction: boolean;
  isTest: boolean;
}

export function validateAuthConfig(): BackendAuthConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  const supabaseUrl = (process.env.SUPABASE_URL || (isTest ? 'http://localhost:54321' : '')).trim();
  const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || (isTest ? 'test-anon-key' : '')).trim();
  const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || (isTest ? 'test-service-role-key' : '')).trim();
  const databaseUrl = (process.env.DATABASE_URL || (isTest ? 'postgres://postgres:postgres@localhost:54322/postgres' : '')).trim();
  const edgeProxySecret = (process.env.EDGE_PROXY_SECRET || (isTest ? 'test-edge-proxy-secret-long' : '')).trim();

  if (isProduction) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('SUPABASE_ANON_KEY');
    if (!supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!databaseUrl) missing.push('DATABASE_URL');
    if (!edgeProxySecret) {
      missing.push('EDGE_PROXY_SECRET');
    } else if (edgeProxySecret === 'dev-edge-proxy-secret' || edgeProxySecret.length < 16) {
      throw new Error('FATAL: Insecure or default EDGE_PROXY_SECRET detected in production. Must be at least 16 characters.');
    }

    if (missing.length > 0) {
      throw new Error(`FATAL: Missing required Supabase Auth production environment variables: ${missing.join(', ')}`);
    }

    const insecurePlaceholders = [
      'placeholder',
      'test-anon-key',
      'test-service-role-key',
      'your-anon-key',
      'your_anon_key',
      'your-service-role-key',
      'your_service_role_key',
      'supabase-service-role-secret',
    ];

    if (insecurePlaceholders.some((p) => supabaseAnonKey.toLowerCase().includes(p))) {
      throw new Error(`FATAL: Insecure or placeholder SUPABASE_ANON_KEY detected in production.`);
    }

    if (insecurePlaceholders.some((p) => supabaseServiceRoleKey.toLowerCase().includes(p))) {
      throw new Error(`FATAL: Insecure or placeholder SUPABASE_SERVICE_ROLE_KEY detected in production.`);
    }

    if (databaseUrl.includes('postgres:postgres@localhost') || databaseUrl.includes('placeholder')) {
      throw new Error(`FATAL: Insecure local default DATABASE_URL detected in production.`);
    }

    if (process.env.ALLOW_DEMO_SEED === 'true') {
      throw new Error('FATAL: ALLOW_DEMO_SEED cannot be enabled in production environments.');
    }
  }

  const baseAuthUrl = supabaseUrl ? supabaseUrl.replace(/\/+$/, '') : 'http://localhost:54321';
  const supabaseJwtIssuer = (process.env.SUPABASE_JWT_ISSUER || `${baseAuthUrl}/auth/v1`).trim();
  const supabaseJwksUrl = (process.env.SUPABASE_JWKS_URL || `${baseAuthUrl}/auth/v1/.well-known/jwks.json`).trim();
  const supabaseJwtAudience = (process.env.SUPABASE_JWT_AUDIENCE || 'authenticated').trim();
  const authRedirectUrl = (
    process.env.AUTH_REDIRECT_URL ||
    (isProduction ? 'https://app.kampus.pk/auth/callback' : 'http://localhost:5173/auth/callback')
  ).trim();

  // Validate exact redirect callback URL format
  if (authRedirectUrl.includes('*')) {
    throw new Error(`FATAL: Wildcards are prohibited in AUTH_REDIRECT_URL (${authRedirectUrl}).`);
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    supabaseJwtIssuer,
    supabaseJwksUrl,
    supabaseJwtAudience,
    authRedirectUrl,
    databaseUrl,
    edgeProxySecret,
    isProduction,
    isTest,
  };
}
