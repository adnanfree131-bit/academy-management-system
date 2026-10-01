import * as jose from 'jose';
import { validateAuthConfig } from '../config/env.js';

export interface SupabaseJwtClaims {
  sub: string;
  email?: string;
  aud: string;
  iss: string;
  exp: number;
  iat?: number;
  role?: string;
  aal?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export interface IJwtVerifier {
  verify(token: string): Promise<SupabaseJwtClaims>;
}

let jwksRemoteSet: ReturnType<typeof jose.createRemoteJWKSet> | null = null;
let testSecretKey: Uint8Array | null = null;

export class SupabaseJwtVerifier implements IJwtVerifier {
  private getConfig() {
    return validateAuthConfig();
  }

  private getJWKS() {
    const config = this.getConfig();
    if (!jwksRemoteSet) {
      jwksRemoteSet = jose.createRemoteJWKSet(new URL(config.supabaseJwksUrl), {
        cacheMaxAge: 10 * 60 * 1000, // 10 minutes cache
        cooldownDuration: 30 * 1000, // 30 seconds cooldown between refreshes
      });
    }
    return jwksRemoteSet;
  }

  async verify(token: string): Promise<SupabaseJwtClaims> {
    if (!token || typeof token !== 'string') {
      throw new Error('Missing or empty authorization token');
    }

    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    if (!cleanToken) {
      throw new Error('Empty bearer token');
    }

    const config = this.getConfig();

    // In local test environments, allow test signing key verification if JWKS is offline
    if (config.isTest) {
      try {
        const decodedHeader = jose.decodeProtectedHeader(cleanToken);
        if (decodedHeader.alg === 'HS256') {
          testSecretKey = new TextEncoder().encode(process.env.TEST_JWT_SECRET || 'test-jwt-secret-key-at-least-32-chars-long');
          const { payload } = await jose.jwtVerify(cleanToken, testSecretKey, {
            issuer: config.supabaseJwtIssuer,
            audience: config.supabaseJwtAudience,
          });
          return payload as unknown as SupabaseJwtClaims;
        }
      } catch (err: any) {
        if (err.code === 'ERR_JWT_EXPIRED' || err.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
          throw err;
        }
      }
    }

    // Production / Standard Asymmetric JWKS verification
    const jwks = this.getJWKS();
    const { payload } = await jose.jwtVerify(cleanToken, jwks, {
      issuer: config.supabaseJwtIssuer,
      audience: config.supabaseJwtAudience,
    });

    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('Token payload missing valid subject (sub) claim');
    }

    return payload as unknown as SupabaseJwtClaims;
  }
}

export const defaultJwtVerifier = new SupabaseJwtVerifier();

export async function createTestSupabaseToken(
  claims: Partial<SupabaseJwtClaims> & { sub: string },
  secret = process.env.TEST_JWT_SECRET || 'test-jwt-secret-key-at-least-32-chars-long'
): Promise<string> {
  const config = validateAuthConfig();
  const key = new TextEncoder().encode(secret);
  return new jose.SignJWT({
    email: claims.email || 'user@example.com',
    role: claims.role || 'authenticated',
    aal: claims.aal || 'aal1',
    ...claims,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(claims.iss || config.supabaseJwtIssuer)
    .setAudience(claims.aud || config.supabaseJwtAudience)
    .setIssuedAt()
    .setExpirationTime(claims.exp ? claims.exp : '2h')
    .sign(key);
}
