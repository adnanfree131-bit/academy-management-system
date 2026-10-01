import { describe, it, expect } from 'vitest';
import * as jose from 'jose';
import { SupabaseJwtVerifier, createTestSupabaseToken } from '../src/lib/jwt-verifier.js';
import { validateAuthConfig } from '../src/config/env.js';

describe('Phase 4: Supabase Token Verification Boundary', () => {
  const verifier = new SupabaseJwtVerifier();
  const config = validateAuthConfig();
  const validSub = 'e1000000-0000-0000-0000-000000000001';

  it('successfully verifies a valid Supabase token and extracts subject', async () => {
    const token = await createTestSupabaseToken({
      sub: validSub,
      email: 'adnan@apexacademy.edu.pk',
      role: 'authenticated',
      aal: 'aal1',
    });

    const claims = await verifier.verify(token);
    expect(claims.sub).toBe(validSub);
    expect(claims.email).toBe('adnan@apexacademy.edu.pk');
    expect(claims.aud).toBe(config.supabaseJwtAudience);
    expect(claims.iss).toBe(config.supabaseJwtIssuer);
  });

  it('rejects an expired Supabase token', async () => {
    const token = await createTestSupabaseToken({
      sub: validSub,
      exp: Math.floor(Date.now() / 1000) - 60, // expired 1 minute ago
    });

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it('rejects a token with the wrong issuer', async () => {
    const token = await createTestSupabaseToken({
      sub: validSub,
      iss: 'https://malicious-project.supabase.co/auth/v1',
    });

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it('rejects a token with the wrong audience', async () => {
    const token = await createTestSupabaseToken({
      sub: validSub,
      aud: 'anon', // wrong audience (expected 'authenticated')
    });

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it('rejects a tampered token signature', async () => {
    const validToken = await createTestSupabaseToken({
      sub: validSub,
    });
    // Corrupt the signature at the end
    const tamperedToken = validToken.slice(0, -6) + 'abcdef';

    await expect(verifier.verify(tamperedToken)).rejects.toThrow();
  });

  it('rejects an empty or malformed token string', async () => {
    await expect(verifier.verify('')).rejects.toThrow();
    await expect(verifier.verify('Bearer ')).rejects.toThrow();
    await expect(verifier.verify('not.a.valid.jwt')).rejects.toThrow();
  });
});
