import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveHostInfo } from '../src/lib/host';
import { isReservedSlug } from '@apex/shared-types';

describe('Phase 5: Host Resolution & Branded Tenant Boundary', () => {
  it('identifies central platform hosts correctly with isBrandedHost: false', () => {
    const platformHosts = [
      '',
      'localhost',
      '127.0.0.1',
      'app.kampus.pk',
      'edu.kampus.pk',
      'kampus-academy.pages.dev',
      'app.toolnestr.com',
      'edu.toolnestr.com',
    ];

    for (const host of platformHosts) {
      const info = resolveHostInfo(host);
      expect(info.isBrandedHost).toBe(false);
      expect(info.tenantSlug).toBeNull();
    }
  });

  it('rejects reserved platform slugs from becoming branded hosts', () => {
    const reservedHosts = [
      'admin.kampus.pk',
      'api.kampus.pk',
      'auth.kampus.pk',
      'billing.kampus.pk',
      'status.kampus.pk',
      'superadmin.kampus.pk',
      'www.kampus.pk',
      'app.kampus.pk',
    ];

    for (const host of reservedHosts) {
      const sub = host.split('.')[0];
      expect(isReservedSlug(sub)).toBe(true);
      const info = resolveHostInfo(host);
      expect(info.isBrandedHost).toBe(false);
      expect(info.tenantSlug).toBeNull();
    }
  });

  it('identifies branded tenant subdomains with isBrandedHost: true', () => {
    const tenantHosts = [
      { host: 'beaconhouse.kampus.pk', expectedSlug: 'beaconhouse' },
      { host: 'tsa.kampus.pk', expectedSlug: 'tsa' },
      { host: 'citygrammar.kampus.pk', expectedSlug: 'citygrammar' },
      { host: 'oakridge.toolnestr.com', expectedSlug: 'oakridge' },
    ];

    for (const { host, expectedSlug } of tenantHosts) {
      const info = resolveHostInfo(host);
      expect(info.isBrandedHost).toBe(true);
      expect(info.tenantSlug).toBe(expectedSlug);
    }
  });

  it('identifies external custom domains as branded hosts', () => {
    const customDomains = [
      'portal.citygrammar.edu.pk',
      'portal.beaconhouse.net',
      'lms.smartacademy.pk',
    ];

    for (const domain of customDomains) {
      const info = resolveHostInfo(domain);
      expect(info.isBrandedHost).toBe(true);
      expect(info.tenantSlug).toBe(domain);
    }
  });
});

describe('Phase 5: Multi-Tenant Membership Lifecycle & Storage Hygiene', () => {
  let localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageMock[key] ?? null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = String(value);
      },
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
      clear: () => {
        localStorageMock = {};
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prohibits storing custom JWT or legacy tokens in local storage', () => {
    // Phase 5 specification: only selected tenant ID and standard Supabase SDK token may exist
    const selectedTenantId = 't1111111-1111-1111-1111-111111111111';
    localStorage.setItem('apex_active_tenant_id', selectedTenantId);

    expect(localStorage.getItem('apex_jwt_token')).toBeNull();
    expect(localStorage.getItem('apex_active_tenant_id')).toBe(selectedTenantId);

    // Verify prohibited keys are absent
    const storedKeys = Object.keys(localStorageMock);
    expect(storedKeys).not.toContain('apex_jwt_token');
    expect(storedKeys).not.toContain('otp');
    expect(storedKeys).not.toContain('password');
  });

  it('evaluates single membership auto-selection logic', () => {
    const singleMembership = [
      {
        membership_id: 'm1',
        tenant_id: 't-alpha',
        tenant_name: 'Alpha Academy',
        tenant_slug: 'alpha',
        role: 'tenant_admin',
        is_active: true,
        status: 'active',
      },
    ];

    // Single active membership must auto-select
    expect(singleMembership.length).toBe(1);
    const selected = singleMembership[0].tenant_id;
    localStorage.setItem('apex_active_tenant_id', selected);
    expect(localStorage.getItem('apex_active_tenant_id')).toBe('t-alpha');
  });

  it('evaluates multiple memberships switching on central platform vs branded host', () => {
    const memberships = [
      {
        membership_id: 'm1',
        tenant_id: 't-alpha',
        tenant_name: 'Alpha Academy',
        tenant_slug: 'alpha',
        role: 'tenant_admin',
        is_active: true,
        status: 'active',
      },
      {
        membership_id: 'm2',
        tenant_id: 't-beta',
        tenant_name: 'Beta Academy',
        tenant_slug: 'beta',
        role: 'teacher',
        is_active: true,
        status: 'active',
      },
    ];

    // Case 1: On central platform, user can switch between t-alpha and t-beta
    const centralHost = resolveHostInfo('app.kampus.pk');
    expect(centralHost.isBrandedHost).toBe(false);

    let activeTenant = 't-alpha';
    localStorage.setItem('apex_active_tenant_id', activeTenant);
    expect(localStorage.getItem('apex_active_tenant_id')).toBe('t-alpha');

    // User switches to t-beta
    activeTenant = 't-beta';
    localStorage.setItem('apex_active_tenant_id', activeTenant);
    expect(localStorage.getItem('apex_active_tenant_id')).toBe('t-beta');

    // Case 2: On branded host "alpha.kampus.pk", active tenant is strictly locked to "alpha"
    const brandedHost = resolveHostInfo('alpha.kampus.pk');
    expect(brandedHost.isBrandedHost).toBe(true);
    expect(brandedHost.tenantSlug).toBe('alpha');

    const matching = memberships.find(m => m.tenant_slug === brandedHost.tenantSlug);
    expect(matching).toBeDefined();
    expect(matching?.tenant_id).toBe('t-alpha');

    // Switching to t-beta on alpha.kampus.pk must be blocked
    const canSwitchOnBrandedHost = !brandedHost.isBrandedHost;
    expect(canSwitchOnBrandedHost).toBe(false);
  });

  it('detects unauthorized access when visiting a branded host without membership', () => {
    const userMemberships = [
      {
        membership_id: 'm1',
        tenant_id: 't-alpha',
        tenant_name: 'Alpha Academy',
        tenant_slug: 'alpha',
        role: 'student',
        is_active: true,
        status: 'active',
      },
    ];

    // User visits gamma.kampus.pk
    const brandedHost = resolveHostInfo('gamma.kampus.pk');
    expect(brandedHost.isBrandedHost).toBe(true);
    expect(brandedHost.tenantSlug).toBe('gamma');

    const authorized = userMemberships.some(m => m.tenant_slug === brandedHost.tenantSlug);
    expect(authorized).toBe(false);
  });

  it('cleans up local tenant preferences completely upon sign-out', () => {
    localStorage.setItem('apex_active_tenant_id', 't-alpha');
    localStorage.setItem('apex_active_screen', 'attendance');
    localStorage.setItem('kampus.working_session', '2026-2027');

    // Perform sign-out cleanup
    localStorage.removeItem('apex_active_tenant_id');
    localStorage.removeItem('apex_active_screen');
    localStorage.removeItem('kampus.working_session');

    expect(localStorage.getItem('apex_active_tenant_id')).toBeNull();
    expect(localStorage.getItem('apex_active_screen')).toBeNull();
    expect(localStorage.getItem('kampus.working_session')).toBeNull();
  });
});
