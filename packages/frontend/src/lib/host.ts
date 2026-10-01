import { isReservedSlug } from '@apex/shared-types';

export interface HostInfo {
  isBrandedHost: boolean;
  isCustomDomain: boolean;
  customDomain: string | null;
  tenantSlug: string | null;
  baseDomain: string;
  hostname: string;
}

/**
 * Resolves whether the current application is running on the central platform
 * (e.g. app.kampus.pk, localhost) or on a tenant-specific branded host (e.g. beaconhouse.kampus.pk).
 * Accurately differentiates between platform subdomains and external custom domains.
 */
export function resolveHostInfo(
  hostname: string = typeof window !== 'undefined' ? window.location.hostname : '',
  resolvedSlug?: string | null
): HostInfo {
  const host = hostname.toLowerCase().trim().replace(/\.$/, '');

  let baseDomain = 'kampus.pk';
  if (host.includes('toolnestr.com')) {
    baseDomain = 'toolnestr.com';
  }

  // Central platform hosts (dev, localhost, apex app, staging)
  const isPlatformHost =
    !host ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('localhost:') ||
    host === `app.${baseDomain}` ||
    host === `edu.${baseDomain}` ||
    host === 'kampus-academy.pages.dev' ||
    host === 'academy-management-system.pages.dev' ||
    host === 'app.kampus.pk' ||
    host === 'edu.kampus.pk';

  if (isPlatformHost) {
    // Check if query parameter or preview parameter is explicitly supplied for dev testing
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const campusParam = params.get('campus') || params.get('subdomain');
      if (campusParam && !isReservedSlug(campusParam)) {
        return {
          isBrandedHost: true,
          isCustomDomain: false,
          customDomain: null,
          tenantSlug: campusParam.toLowerCase().trim(),
          baseDomain,
          hostname: host,
        };
      }
    }
    return {
      isBrandedHost: false,
      isCustomDomain: false,
      customDomain: null,
      tenantSlug: null,
      baseDomain,
      hostname: host,
    };
  }

  // Subdomain of base domain (e.g., alpha.kampus.pk)
  if (host.endsWith(`.${baseDomain}`)) {
    const sub = host.slice(0, -(baseDomain.length + 1)).trim();
    if (sub && !isReservedSlug(sub) && sub !== 'app' && sub !== 'edu' && sub !== 'www' && sub !== 'api') {
      return {
        isBrandedHost: true,
        isCustomDomain: false,
        customDomain: null,
        tenantSlug: resolvedSlug || sub,
        baseDomain,
        hostname: host,
      };
    }
    return {
      isBrandedHost: false,
      isCustomDomain: false,
      customDomain: null,
      tenantSlug: null,
      baseDomain,
      hostname: host,
    };
  }

  // Custom domain (e.g., portal.myacademy.edu.pk)
  // Fix B07/B09: Allow resolved canonical slug override while preserving backward compatibility
  return {
    isBrandedHost: true,
    isCustomDomain: true,
    customDomain: host,
    tenantSlug: resolvedSlug !== undefined ? resolvedSlug : host,
    baseDomain,
    hostname: host,
  };
}

/**
 * Cleanly formats domain for UI presentation without malformed concatenation.
 */
export function formatHostDisplay(hostInfo: HostInfo): string {
  if (hostInfo.isCustomDomain && hostInfo.customDomain) {
    return hostInfo.customDomain;
  }
  if (hostInfo.tenantSlug) {
    return `${hostInfo.tenantSlug}.${hostInfo.baseDomain}`;
  }
  return `app.${hostInfo.baseDomain}`;
}
