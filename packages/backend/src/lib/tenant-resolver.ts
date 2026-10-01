import type { FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { isReservedSlug } from '@apex/shared-types';
import type { IDataStore } from '../services/store.js';

export interface HostTenantResolution {
  effectiveHostname: string;
  isCentralHost: boolean;
  isBrandedHost: boolean;
  isCustomDomain?: boolean;
  tenantSlug: string | null;
  tenantId: string | null;
  isUnmapped: boolean;
}

const CENTRAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  'app.kampus.pk',
  'edu.kampus.pk',
  'api.kampus.pk',
  'kampus.pk',
  'kampus-academy.pages.dev',
  'academy-management-system.pages.dev',
  'app.toolnestr.com',
  'edu.toolnestr.com',
]);

/**
 * Normalizes effective request hostname safely.
 * Only trusts X-Forwarded-Host if proxy secret is explicitly configured and matches, preventing spoofing.
 * In production or when unconfigured, fails closed (falls back to socket/direct host).
 */
export function normalizeEffectiveHostname(request: FastifyRequest): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredSecret = (process.env.EDGE_PROXY_SECRET || '').trim();

  // If secret is not set, or is the trivial dev placeholder in production, FAIL CLOSED:
  // never trust X-Forwarded-Host.
  const isSecretValid =
    configuredSecret.length > 0 &&
    (!isProduction || (configuredSecret !== 'dev-edge-proxy-secret' && configuredSecret.length >= 16));

  if (isSecretValid) {
    const receivedSecret = request.headers['x-edge-proxy-secret'];
    const secretMatches = typeof receivedSecret === 'string' && receivedSecret === configuredSecret;

    if (secretMatches) {
      const forwardedHost = request.headers['x-forwarded-host'];
      if (forwardedHost) {
        const raw = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
        const clean = raw.split(',')[0].split(':')[0].trim().toLowerCase().replace(/\.$/, '');
        if (clean) return clean;
      }
    }
  }

  // Strictly ignore X-Forwarded-Host if secret is absent/invalid/unconfigured, falling back to direct host
  const raw = (request.headers['host'] as string) || request.hostname || '';
  const first = Array.isArray(raw) ? raw[0] : raw;
  return first.split(',')[0].split(':')[0].trim().toLowerCase().replace(/\.$/, '');
}

/**
 * Resolves effective hostname into central platform vs branded tenant boundary.
 */
export async function resolveHostTenant(
  hostname: string,
  pool: Pool | { query: (text: string, params?: any[]) => Promise<any> },
  store?: IDataStore
): Promise<HostTenantResolution> {
  const cleanHost = hostname.split(':')[0].trim().toLowerCase().replace(/\.$/, '');
  const baseDomain = (process.env.BASE_DOMAIN || 'kampus.pk').trim().toLowerCase();

  // 1. Central Platform Host Check
  if (CENTRAL_HOSTNAMES.has(cleanHost)) {
    return {
      effectiveHostname: cleanHost,
      isCentralHost: true,
      isBrandedHost: false,
      isCustomDomain: false,
      tenantSlug: null,
      tenantId: null,
      isUnmapped: false,
    };
  }

  // 2. Check if host has a reserved platform subdomain
  if (cleanHost.endsWith(`.${baseDomain}`)) {
    const sub = cleanHost.slice(0, -(baseDomain.length + 1));
    if (isReservedSlug(sub)) {
      return {
        effectiveHostname: cleanHost,
        isCentralHost: true,
        isBrandedHost: false,
        isCustomDomain: false,
        tenantSlug: null,
        tenantId: null,
        isUnmapped: false,
      };
    }

    // 3. Branded Subdomain: {slug}.kampus.pk
    let tenantRow: any = null;
    if (store) {
      tenantRow = await store.getTenantBySlug(sub);
    }
    if (!tenantRow && pool) {
      try {
        const res = await pool.query(
          `SELECT id, name, slug, status FROM public.lookup_tenant_by_slug($1)`,
          [sub]
        );
        if (res.rows.length > 0) tenantRow = res.rows[0];
      } catch {
        // Pool query failed or database connection unavailable
      }
    }

    if (tenantRow) {
      return {
        effectiveHostname: cleanHost,
        isCentralHost: false,
        isBrandedHost: true,
        isCustomDomain: false,
        tenantSlug: tenantRow.slug,
        tenantId: tenantRow.id,
        isUnmapped: false,
      };
    }

    // Unmapped/nonexistent tenant subdomain
    return {
      effectiveHostname: cleanHost,
      isCentralHost: false,
      isBrandedHost: true,
      isCustomDomain: false,
      tenantSlug: sub,
      tenantId: null,
      isUnmapped: true,
    };
  }

  // 4. Custom Domain Check: query public.tenant_domains via narrow SECURITY DEFINER function
  let customDomainRow: any = null;
  if (store) {
    try {
      for (const t of (store as any).tenants?.values?.() || []) {
        if (t.domain && t.domain.toLowerCase() === cleanHost) {
          customDomainRow = { tenant_id: t.id, slug: t.slug };
          break;
        }
      }
    } catch {
      // In-memory store might not have tenants map
    }
  }
  if (!customDomainRow && pool) {
    try {
      const res = await pool.query(
        `SELECT tenant_id, slug FROM public.lookup_tenant_by_custom_domain($1)`,
        [cleanHost]
      );
      if (res.rows.length > 0) customDomainRow = res.rows[0];
    } catch {
      // Table might not exist in mock store or isolated unit test
    }
  }

  if (customDomainRow) {
    return {
      effectiveHostname: cleanHost,
      isCentralHost: false,
      isBrandedHost: true,
      isCustomDomain: true,
      tenantSlug: customDomainRow.slug,
      tenantId: customDomainRow.tenant_id,
      isUnmapped: false,
    };
  }

  // Unrecognized custom domain
  return {
    effectiveHostname: cleanHost,
    isCentralHost: false,
    isBrandedHost: true,
    isCustomDomain: true,
    tenantSlug: null,
    tenantId: null,
    isUnmapped: true,
  };
}
