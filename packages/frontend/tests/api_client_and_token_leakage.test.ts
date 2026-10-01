import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiFetch, isInternalKampusApiUrl, setApiContext } from '../src/lib/api-client';

describe('Phase 4 Acceptance Gate: Scoped API Client & Token Leakage Prevention', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    setApiContext({
      token: 'test-supabase-bearer-token-secret-12345',
      tenantId: 'tenant-uuid-abc-123',
      session: '2026-2027',
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setApiContext({
      token: null,
      tenantId: null,
      session: null,
    });
    vi.restoreAllMocks();
  });

  it('Gate 1: window.fetch is not globally overridden or monkey-patched', () => {
    // Verify no monkey-patch flag exists
    expect((globalThis as any).window?.__kampus_fetch_intercepted).toBeUndefined();
    expect((globalThis as any).__kampus_fetch_intercepted).toBeUndefined();
  });

  it('Gate 2: Correctly identifies internal vs external API URLs', () => {
    // Internal paths
    expect(isInternalKampusApiUrl('/api/v1/auth/me')).toBe(true);
    expect(isInternalKampusApiUrl('/api/v1/academic/programs')).toBe(true);
    expect(isInternalKampusApiUrl('api/v1/sis/students')).toBe(true);

    // External destinations that must NEVER receive tokens
    expect(isInternalKampusApiUrl('https://images.unsplash.com/photo-123')).toBe(false);
    expect(isInternalKampusApiUrl('https://api.cloudflare.com/client/v4')).toBe(false);
    expect(isInternalKampusApiUrl('https://s3.eu-central-1.amazonaws.com/tenant-logos/tsa.png')).toBe(false);
    expect(isInternalKampusApiUrl('https://evil-hacker.com/steal-token')).toBe(false);
    expect(isInternalKampusApiUrl('http://thirdparty.org/webhook')).toBe(false);
  });

  it('Gate 3: Attaches Authorization, X-Tenant-ID, and X-Kampus-Session to internal API calls', async () => {
    await apiFetch('/api/v1/auth/me');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('/api/v1/auth/me');

    const headers = new Headers(calledInit?.headers);
    expect(headers.get('Authorization')).toBe('Bearer test-supabase-bearer-token-secret-12345');
    expect(headers.get('X-Tenant-ID')).toBe('tenant-uuid-abc-123');
    expect(headers.get('X-Kampus-Session')).toBe('2026-2027');
  });

  it('Gate 4: NEVER attaches Authorization, X-Tenant-ID, or X-Kampus-Session to external URLs (zero token leakage)', async () => {
    const externalUrls = [
      'https://images.unsplash.com/photo-123',
      'https://api.cloudflare.com/client/v4/zones',
      'https://s3.amazonaws.com/bucket/academy-logo.png',
      'https://evil-tracker.com/beacon',
    ];

    for (const url of externalUrls) {
      fetchMock.mockClear();
      await apiFetch(url);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchMock.mock.calls[0];
      expect(calledUrl).toBe(url);

      const headers = new Headers(calledInit?.headers);
      expect(headers.get('Authorization')).toBeNull();
      expect(headers.get('X-Tenant-ID')).toBeNull();
      expect(headers.get('X-Kampus-Session')).toBeNull();
    }
  });

  it('Gate 5: Clears credentials and sends unauthenticated requests when session is logged out', async () => {
    setApiContext({
      token: null,
      tenantId: null,
      session: null,
    });

    await apiFetch('/api/v1/auth/me');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, calledInit] = fetchMock.mock.calls[0];
    const headers = new Headers(calledInit?.headers);

    expect(headers.get('Authorization')).toBeNull();
  });
});
