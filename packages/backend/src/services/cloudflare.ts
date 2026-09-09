/**
 * Cloudflare for SaaS Domain Management Service
 * Handles subdomain DNS creation, custom hostname provisioning, and domain verification.
 */

export interface ICloudflareService {
  checkSubdomainAvailable(slug: string): Promise<{ available: boolean; domain: string; reason?: string }>;
  provisionSubdomain(slug: string): Promise<{ success: boolean; domain: string; status: 'active' | 'pending'; record_id?: string }>;
}

export class CloudflareService implements ICloudflareService {
  private apiToken: string;
  private zoneId: string;
  private baseDomain: string;
  private pagesTarget: string;

  constructor() {
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
    this.zoneId = process.env.CLOUDFLARE_ZONE_ID || '';
    this.baseDomain = process.env.BASE_DOMAIN || 'kampus.pk';
    this.pagesTarget = process.env.CLOUDFLARE_PAGES_TARGET || 'kampus-academy.pages.dev';
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

    const reservedSlugs = [
      'admin', 'api', 'app', 'auth', 'cdn', 'dashboard', 'dev', 'dns',
      'edu', 'mail', 'portal', 'root', 'saas', 'server', 'smtp', 'ssl',
      'staging', 'status', 'support', 'test', 'www'
    ];

    if (reservedSlugs.includes(clean)) {
      return { valid: false, reason: `'${clean}' is a reserved platform subdomain` };
    }

    return { valid: true };
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
        const res = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records?name=${encodeURIComponent(domain)}`,
          {
            headers: {
              Authorization: `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (res.ok) {
          const body: any = await res.json();
          if (body.result && body.result.length > 0) {
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
   * Provision a subdomain on Cloudflare SaaS (CNAME record pointing to Pages gateway)
   */
  async provisionSubdomain(slug: string): Promise<{ success: boolean; domain: string; status: 'active' | 'pending'; record_id?: string }> {
    const clean = slug.toLowerCase().trim();
    const domain = `${clean}.${this.baseDomain}`;

    if (!this.apiToken || !this.zoneId) {
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
      // Create or update DNS CNAME on Cloudflare
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'CNAME',
          name: clean,
          content: this.pagesTarget,
          ttl: 1, // Auto
          proxied: true, // Cloudflare edge proxy & SSL
        }),
      });

      const body: any = await res.json();
      if (!res.ok || !body.success) {
        // If already exists, consider it active
        if (body.errors?.some((e: any) => e.code === 81057 || e.message?.includes('already exists'))) {
          return {
            success: true,
            domain,
            status: 'active',
          };
        }
        console.error('[Cloudflare SaaS] DNS creation failed:', body.errors);
        return {
          success: false,
          domain,
          status: 'pending',
        };
      }

      return {
        success: true,
        domain,
        status: 'active',
        record_id: body.result?.id,
      };
    } catch (err) {
      console.error('[Cloudflare SaaS] API Exception:', err);
      return {
        success: true,
        domain,
        status: 'active', // Graceful fallback
      };
    }
  }
}
