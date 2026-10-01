/**
 * Scoped internal API client for Kampus ERP.
 * 
 * Rules:
 * 1. Do not globally override window.fetch.
 * 2. Add authentication headers only for configured Kampus API destinations.
 * 3. Never send tokens to logo URLs, Cloudflare, external assets, or arbitrary origins.
 */

let _activeToken: string | null = null;
let _activeTenantId: string | null = null;
let _activeSession: string | null = null;

export function setApiContext(params: {
  token?: string | null;
  tenantId?: string | null;
  session?: string | null;
}) {
  if (params.token !== undefined) _activeToken = params.token;
  if (params.tenantId !== undefined) _activeTenantId = params.tenantId;
  if (params.session !== undefined) _activeSession = params.session;
}

export function isInternalKampusApiUrl(input: RequestInfo | URL): boolean {
  let urlStr: string;
  if (typeof input === 'string') {
    urlStr = input;
  } else if (input instanceof URL) {
    urlStr = input.href;
  } else {
    urlStr = (input as Request).url;
  }

  // Relative API paths are always internal
  if (urlStr.startsWith('/api/') || urlStr.startsWith('api/')) {
    return true;
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(urlStr, origin);

    // Same origin /api/ paths
    if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
      return parsed.pathname.startsWith('/api/');
    }

    // Configured backend API URL origin
    const configuredApiUrl = (import.meta as any).env?.VITE_API_URL || '';
    if (configuredApiUrl) {
      const parsedConfig = new URL(configuredApiUrl);
      if (parsed.origin === parsedConfig.origin) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const isInternal = isInternalKampusApiUrl(input);

  // If external destination, execute standard unauthenticated fetch
  if (!isInternal) {
    return fetch(input, init);
  }

  init = init || {};
  const headers = new Headers(init.headers || {});

  const token = _activeToken;
  const tenantId = _activeTenantId || (typeof window !== 'undefined' ? localStorage.getItem('apex_active_tenant_id') : null);
  const session = _activeSession || (typeof window !== 'undefined' ? localStorage.getItem('kampus.working_session') : null);

  if (token && !headers.has('Authorization') && !headers.has('authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (tenantId && !headers.has('X-Tenant-ID') && !headers.has('x-tenant-id')) {
    headers.set('X-Tenant-ID', tenantId);
  }

  if (session && !headers.has('X-Kampus-Session')) {
    headers.set('X-Kampus-Session', session);
  }

  init.headers = headers;
  return fetch(input, init);
}
