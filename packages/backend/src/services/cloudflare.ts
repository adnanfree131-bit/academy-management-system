/**
 * Cloudflare for SaaS Domain Management Service
 * Handles subdomain DNS creation, custom hostname provisioning, and domain verification.
 */

import { isReservedSlug } from '@apex/shared-types';
import { createHash } from 'crypto';

export interface ICloudflareService {
  checkSubdomainAvailable(slug: string): Promise<{ available: boolean; domain: string; reason?: string }>;
  provisionSubdomain(slug: string): Promise<{ success: boolean; domain: string; status: 'active' | 'pending' | 'failed'; record_id?: string; error?: string }>;
  verifyPagesHostname(domain: string): Promise<{ success: boolean; status: 'active' | 'pending' | 'failed'; error?: string }>;
  validateCustomDomain(hostname: string): { valid: boolean; reason?: string; normalized?: string };
  createCustomHostname(hostname: string): Promise<{
    success: boolean;
    id?: string;
    hostname: string;
    status: 'pending' | 'active' | 'failed';
    verification_txt_name?: string;
    verification_txt_value?: string;
    cname_target: string;
    error?: string;
  }>;
  getCustomHostnameStatus(customHostnameId: string): Promise<{
    success: boolean;
    status: 'pending' | 'verifying' | 'active' | 'failed';
    ssl_status?: string;
    error?: string;
  }>;
  deleteCustomHostname(customHostnameId: string): Promise<{
    success: boolean;
    deleted: boolean;
    error?: string;
  }>;
}

export class CloudflareService implements ICloudflareService {
  private apiToken: string;
  private zoneId: string;
  private accountId: string;
  private baseDomain: string;
  private pagesTarget: string;
  private pagesProject: string;

  constructor() {
    const isTest = process.env.NODE_ENV === 'test';
    const allowLiveApiInTest = process.env.CLOUDFLARE_LIVE_TEST === 'true';

    this.apiToken = (isTest && !allowLiveApiInTest) ? '' : (process.env.CLOUDFLARE_API_TOKEN || '');
    this.zoneId = (isTest && !allowLiveApiInTest) ? '' : (process.env.CLOUDFLARE_ZONE_ID || '');
    this.accountId = (isTest && !allowLiveApiInTest) ? '' : (process.env.CLOUDFLARE_ACCOUNT_ID || '');
    this.baseDomain = (process.env.BASE_DOMAIN || 'kampus.pk').trim().toLowerCase();
    this.pagesTarget = (process.env.CLOUDFLARE_PAGES_TARGET || 'kampus-academy.pages.dev').trim().toLowerCase();
    this.pagesProject = process.env.CLOUDFLARE_PAGES_PROJECT || 'kampus-academy';
  }

  /**
   * Helper: Fetch with exponential backoff on HTTP 429 rate limit
   */
  private async fetchWithBackoff(url: string, options: RequestInit, retries: number = 3): Promise<Response> {
    let delay = 500;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(url, options);
      if (res.status === 429 && attempt < retries) {
        const retryAfter = res.headers.get('Retry-After');
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;
        await new Promise((r) => setTimeout(r, waitMs));
        delay *= 2;
        continue;
      }
      return res;
    }
    return fetch(url, options);
  }

  /**
   * Validate slug format and reserve special system slugs
   */
  private validateSlugFormat(slug: string): { valid: boolean; reason?: string } {
    const clean = slug.toLowerCase().trim();
    if (!clean) return { valid: false, reason: 'Subdomain identifier cannot be empty' };
    if (clean.length < 3) return { valid: false, reason: 'Subdomain must be at least 3 characters' };
    if (clean.length > 32) return { valid: false, reason: 'Subdomain cannot exceed 32 characters' };
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(clean)) {
      return { valid: false, reason: 'Subdomain can only contain lowercase letters, numbers, and hyphens' };
    }

    if (isReservedSlug(clean)) {
      return { valid: false, reason: `'${clean}' is a reserved platform subdomain` };
    }

    return { valid: true };
  }

  /**
   * Strictly validate FQDN custom domain name before persistence
   */
  validateCustomDomain(hostname: string): { valid: boolean; reason?: string; normalized?: string } {
    const clean = (hostname || '').toLowerCase().trim().replace(/\.$/, '');
    if (!clean) {
      return { valid: false, reason: 'Custom domain hostname cannot be empty' };
    }

    if (clean.length > 253) {
      return { valid: false, reason: 'Custom domain hostname exceeds 253 characters' };
    }

    // Must be valid FQDN syntax: labels of 1-63 chars separated by dots
    const fqdnRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
    if (!fqdnRegex.test(clean)) {
      return { valid: false, reason: 'Custom domain must be a valid fully-qualified domain name (FQDN)' };
    }

    // Must not end with base platform domain or pages target (that is internal routing, not customer custom domain)
    if (
      clean === this.baseDomain ||
      clean.endsWith(`.${this.baseDomain}`) ||
      clean === this.pagesTarget ||
      clean.endsWith(`.${this.pagesTarget}`) ||
      clean.endsWith('.pages.dev')
    ) {
      return {
        valid: false,
        reason: `Domains ending in .${this.baseDomain} or platform targets are managed via platform routing, not custom domains.`,
      };
    }

    // IP address rejection
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) {
      return { valid: false, reason: 'Custom domain cannot be an IP address' };
    }

    return { valid: true, normalized: clean };
  }

  /**
   * Check if a subdomain is available
   */
  async checkSubdomainAvailable(slug: string): Promise<{ available: boolean; domain: string; reason?: string }> {
    const clean = slug.toLowerCase().trim();
    const domain = `${clean}.${this.baseDomain}`;

    const validation = this.validateSlugFormat(clean);
    if (!validation.valid) {
      return { available: false, domain, reason: validation.reason };
    }

    // If Cloudflare credentials are configured, query Cloudflare DNS API
    if (this.apiToken && this.zoneId) {
      try {
        const res = await this.fetchWithBackoff(
          `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records?name=${encodeURIComponent(domain)}`,
          {
            headers: {
              Authorization: `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(5000),
          }
        );

        if (res.ok) {
          const body: any = await res.json();
          const records = body.result || [];
          if (records.length > 0) {
            const ours = records.every(
              (r: any) =>
                String(r.type).toUpperCase() === 'CNAME' &&
                String(r.content || '').replace(/\.$/, '') === this.pagesTarget
            );
            if (ours) {
              return { available: true, domain };
            }
            return { available: false, domain, reason: `Domain ${domain} is already registered in DNS.` };
          }
        }
      } catch (err) {
        console.warn('[Cloudflare SaaS] DNS check error, falling back to local verification:', err);
      }
    }

    return { available: true, domain };
  }

  /**
   * Provision a tenant subdomain: exact DNS CNAME (so it appears in Cloudflare DNS
   * and availability checks work) plus a Pages custom hostname (so the host does
   * not 522). Never writes the zone apex — that record is reserved for another project.
   */
  async provisionSubdomain(slug: string): Promise<{ success: boolean; domain: string; status: 'active' | 'pending' | 'failed'; record_id?: string; error?: string }> {
    const clean = slug.toLowerCase().trim();
    const domain = `${clean}.${this.baseDomain}`;

    if (!clean || clean === '@' || domain === this.baseDomain) {
      return { success: false, domain, status: 'failed', error: 'Invalid subdomain target' };
    }

    if (!this.apiToken || !this.zoneId) {
      if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
        console.error('[Cloudflare SaaS] Missing credentials for this deployment!');
        return {
          success: false,
          domain,
          status: 'failed',
          error: 'Cloudflare credentials not configured for this deployment',
        };
      }
      // Offline / Local / Dev Simulation
      console.log(`[Cloudflare SaaS Mock] Subdomain provisioned: ${domain} -> ${this.pagesTarget} (Proxied: true)`);
      return {
        success: true,
        domain,
        status: 'active',
        record_id: `mock-dns-${clean}`,
      };
    }

    try {
      const headers = {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      };

      const res = await this.fetchWithBackoff(`https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'CNAME',
          name: clean,
          content: this.pagesTarget,
          ttl: 1,
          proxied: true,
        }),
        signal: AbortSignal.timeout(8000),
      });

      const body: any = await res.json();
      const dnsAlreadyExists = body.errors?.some(
        (e: any) => e.code === 81057 || String(e.message || '').toLowerCase().includes('already exists')
      );
      if (!res.ok || !body.success) {
        if (!dnsAlreadyExists) {
          console.error('[Cloudflare SaaS] DNS creation failed:', body.errors);
          return {
            success: false,
            domain,
            status: 'failed',
            error: body.errors?.[0]?.message || 'Cloudflare DNS record creation failed',
          };
        }
      }

      const attachRes = await this.attachPagesHostname(domain, headers);
      if (!attachRes.success) {
        console.error('[Cloudflare SaaS] Pages hostname attach failed:', attachRes.error);
        return {
          success: false,
          domain,
          status: 'failed',
          error: attachRes.error || 'Cloudflare Pages hostname attach failed',
        };
      }

      // Verify activation status
      const verifyRes = await this.verifyPagesHostname(domain);
      const finalStatus: 'active' | 'pending' | 'failed' = verifyRes.status;

      return {
        success: finalStatus !== 'failed',
        domain,
        status: finalStatus,
        record_id: body.result?.id,
        error: verifyRes.error,
      };
    } catch (err: any) {
      console.error('[Cloudflare SaaS] API Exception:', err);
      // Strictly do NOT silently report success when Cloudflare fails
      return {
        success: false,
        domain,
        status: 'failed',
        error: err.message || 'Network exception connecting to Cloudflare',
      };
    }
  }

  /**
   * Provision a Cloudflare Custom Hostname for tenant-owned domain
   */
  async createCustomHostname(hostname: string): Promise<{
    success: boolean;
    id?: string;
    hostname: string;
    status: 'pending' | 'active' | 'failed';
    verification_txt_name?: string;
    verification_txt_value?: string;
    cname_target: string;
    error?: string;
  }> {
    const val = this.validateCustomDomain(hostname);
    if (!val.valid || !val.normalized) {
      return {
        success: false,
        hostname,
        status: 'failed',
        cname_target: this.pagesTarget,
        error: val.reason || 'Invalid custom domain',
      };
    }

    const cleanHost = val.normalized;

    if (!this.apiToken || !this.zoneId) {
      if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
        return {
          success: false,
          hostname: cleanHost,
          status: 'failed',
          cname_target: this.pagesTarget,
          error: 'Cloudflare credentials not configured for this deployment',
        };
      }
      // Mock / Local mode: generate deterministic verification instructions
      const mockHash = createHash('sha256').update(cleanHost).digest('hex').slice(0, 32);
      return {
        success: true,
        id: `mock-ch-${mockHash.slice(0, 16)}`,
        hostname: cleanHost,
        status: 'pending',
        verification_txt_name: `_cf-custom-hostname.${cleanHost}`,
        verification_txt_value: `cf-verify-${mockHash}`,
        cname_target: this.pagesTarget,
      };
    }

    try {
      const res = await this.fetchWithBackoff(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/custom_hostnames`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            hostname: cleanHost,
            ssl: {
              method: 'txt',
              type: 'dv',
              settings: {
                min_tls_version: '1.2',
              },
            },
          }),
          signal: AbortSignal.timeout(10000),
        }
      );

      const body: any = await res.json();
      if (!res.ok || !body.success) {
        const errorMsg = body.errors?.[0]?.message || 'Failed provisioning Cloudflare custom hostname';
        console.error('[Cloudflare SaaS] Custom Hostname Creation Failed:', body.errors);
        return {
          success: false,
          hostname: cleanHost,
          status: 'failed',
          cname_target: this.pagesTarget,
          error: errorMsg,
        };
      }

      const result = body.result;
      const ssl = result.ssl || {};
      const status: 'pending' | 'active' | 'failed' =
        result.status === 'active' && ssl.status === 'active' ? 'active' : 'pending';

      const txtName = ssl.txt_name || `_cf-custom-hostname.${cleanHost}`;
      const txtValue = ssl.txt_value || result.ownership_verification?.value || '';

      return {
        success: true,
        id: result.id,
        hostname: cleanHost,
        status,
        verification_txt_name: txtName,
        verification_txt_value: txtValue,
        cname_target: this.pagesTarget,
      };
    } catch (err: any) {
      console.error('[Cloudflare SaaS] Custom Hostname API Exception:', err);
      return {
        success: false,
        hostname: cleanHost,
        status: 'failed',
        cname_target: this.pagesTarget,
        error: err.message || 'Connection error to Cloudflare Custom Hostnames API',
      };
    }
  }

  /**
   * Query status of an existing Cloudflare Custom Hostname
   */
  async getCustomHostnameStatus(customHostnameId: string): Promise<{
    success: boolean;
    status: 'pending' | 'verifying' | 'active' | 'failed';
    ssl_status?: string;
    error?: string;
  }> {
    if (!this.apiToken || !this.zoneId) {
      // Mock mode
      return {
        success: true,
        status: 'verifying',
        ssl_status: 'pending_validation',
      };
    }

    try {
      const res = await this.fetchWithBackoff(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/custom_hostnames/${customHostnameId}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        }
      );

      const body: any = await res.json();
      if (!res.ok || !body.success) {
        return {
          success: false,
          status: 'failed',
          error: body.errors?.[0]?.message || 'Failed fetching custom hostname status',
        };
      }

      const result = body.result;
      const sslStatus = result.ssl?.status;
      let status: 'pending' | 'verifying' | 'active' | 'failed' = 'pending';
      if (result.status === 'active' && sslStatus === 'active') {
        status = 'active';
      } else if (result.status === 'pending' || sslStatus === 'pending_validation') {
        status = 'verifying';
      } else if (result.status === 'blocked' || sslStatus === 'timed_out') {
        status = 'failed';
      }

      return {
        success: true,
        status,
        ssl_status: sslStatus,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: err.message || 'Connection error while checking custom hostname status',
      };
    }
  }

  /**
   * Delete a Cloudflare Custom Hostname
   */
  async deleteCustomHostname(customHostnameId: string): Promise<{
    success: boolean;
    deleted: boolean;
    error?: string;
  }> {
    if (!this.apiToken || !this.zoneId) {
      console.log(`[Cloudflare SaaS Mock] Custom hostname deleted: ${customHostnameId}`);
      return { success: true, deleted: true };
    }

    try {
      const res = await this.fetchWithBackoff(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/custom_hostnames/${customHostnameId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      // If already deleted (404), count as successful cleanup
      if (res.status === 404) {
        return { success: true, deleted: true };
      }

      const body: any = await res.json();
      if (!res.ok || !body.success) {
        console.error('[Cloudflare SaaS] Custom Hostname Deletion Failed:', body.errors);
        return {
          success: false,
          deleted: false,
          error: body.errors?.[0]?.message || 'Failed deleting Cloudflare custom hostname',
        };
      }

      return { success: true, deleted: true };
    } catch (err: any) {
      console.error('[Cloudflare SaaS] Custom Hostname Deletion Exception:', err);
      return {
        success: false,
        deleted: false,
        error: err.message || 'Connection error while deleting custom hostname',
      };
    }
  }

  private async attachPagesHostname(
    domain: string,
    headers: Record<string, string>
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.accountId || !this.pagesProject) {
      console.warn('[Cloudflare SaaS] CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_PAGES_PROJECT missing; skipped Pages hostname attach for', domain);
      return {
        success: false,
        error: 'CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_PAGES_PROJECT is not configured',
      };
    }

    try {
      const res = await this.fetchWithBackoff(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/pages/projects/${this.pagesProject}/domains`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: domain }),
          signal: AbortSignal.timeout(8000),
        }
      );
      const body: any = await res.json();
      if (res.ok && body.success) return { success: true };
      const already = body.errors?.some((e: any) =>
        String(e.message || '').toLowerCase().match(/already|exist|taken/)
      );
      if (already) return { success: true };

      const errorMsg = body.errors?.[0]?.message || `Cloudflare Pages hostname attach failed (HTTP ${res.status})`;
      console.error('[Cloudflare SaaS] Pages hostname attach failed:', body.errors);
      return { success: false, error: errorMsg };
    } catch (err: any) {
      console.error('[Cloudflare SaaS] Pages hostname attach exception:', err);
      return { success: false, error: err.message || 'Exception during Cloudflare Pages hostname attach' };
    }
  }

  /**
   * Verify activation status of a Cloudflare Pages custom hostname
   */
  async verifyPagesHostname(domain: string): Promise<{
    success: boolean;
    status: 'active' | 'pending' | 'failed';
    error?: string;
  }> {
    const clean = domain.toLowerCase().trim();
    if (!this.apiToken || !this.zoneId) {
      if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
        return { success: false, status: 'failed', error: 'Cloudflare credentials not configured for this deployment' };
      }
      return { success: true, status: 'active' };
    }

    if (!this.accountId || !this.pagesProject) {
      return {
        success: false,
        status: 'failed',
        error: 'CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_PAGES_PROJECT is not configured',
      };
    }

    try {
      const res = await this.fetchWithBackoff(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/pages/projects/${this.pagesProject}/domains/${encodeURIComponent(clean)}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!res.ok) {
        if (res.status === 404) {
          return {
            success: false,
            status: 'failed',
            error: `Domain ${clean} is not attached to Pages project`,
          };
        }
        const body: any = await res.json().catch(() => null);
        return {
          success: false,
          status: 'failed',
          error: body?.errors?.[0]?.message || `Pages domain verification failed (HTTP ${res.status})`,
        };
      }

      const body: any = await res.json();
      const statusStr = String(body.result?.status || '').toLowerCase();
      if (statusStr === 'active' || body.result?.verification_status === 'active') {
        return { success: true, status: 'active' };
      }
      return { success: true, status: 'pending' };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: err.message || 'Error verifying Pages hostname status',
      };
    }
  }
}
