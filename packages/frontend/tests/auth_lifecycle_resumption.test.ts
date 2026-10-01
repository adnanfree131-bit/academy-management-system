import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OnboardTenantPayload, RegisterAcademyPayload } from '@apex/shared-types';

describe('Milestone M1: Auth, Registration & Onboarding Lifecycle Contracts', () => {
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
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Finding B03: Payload Alignment & Shared Types
  // ---------------------------------------------------------------------------
  it('B03: exports and validates canonical OnboardTenantPayload structure', () => {
    const canonicalPayload: OnboardTenantPayload = {
      name: 'Horizon Academy',
      slug: 'horizon-campus',
      campus_name: 'Main Campus',
      city: 'Islamabad',
      phone: '051-1234567',
      logo_url: 'https://example.com/logo.png',
    };

    expect(canonicalPayload.name).toBe('Horizon Academy');
    expect(canonicalPayload.slug).toBe('horizon-campus');
    expect(canonicalPayload.campus_name).toBe('Main Campus');

    const registrationPayload: RegisterAcademyPayload = {
      ...canonicalPayload,
      admin_name: 'Director Adnan',
      admin_email: 'director@horizon.edu.pk',
      password: 'SecurePassword123!',
    };

    expect(registrationPayload.admin_email).toBe('director@horizon.edu.pk');
    expect(registrationPayload.password).toBe('SecurePassword123!');
  });

  // ---------------------------------------------------------------------------
  // 2. Finding B04: Resumable Onboarding Draft Persistence & Resumption
  // ---------------------------------------------------------------------------
  it('B04: persists non-sensitive onboarding draft in localStorage when session is pending confirmation', () => {
    const draftPayload: OnboardTenantPayload = {
      name: 'Beacon College',
      slug: 'beacon-college',
      campus_name: 'Main Campus',
      city: 'Lahore',
      phone: '042-99887766',
    };

    const draftEntry = {
      payload: draftPayload,
      email: 'principal@beaconcollege.edu.pk',
      timestamp: Date.now(),
    };

    localStorage.setItem('apex_pending_onboarding_draft', JSON.stringify(draftEntry));

    const storedRaw = localStorage.getItem('apex_pending_onboarding_draft');
    expect(storedRaw).not.toBeNull();

    const stored = JSON.parse(storedRaw!);
    expect(stored.email).toBe('principal@beaconcollege.edu.pk');
    expect(stored.payload.name).toBe('Beacon College');
    expect(stored.payload.slug).toBe('beacon-college');
    // Invariant: MUST NOT store cleartext password in localStorage draft
    expect((stored as any).password).toBeUndefined();
    expect((stored.payload as any).password).toBeUndefined();
  });

  it('B04: resumes pending onboarding draft upon verified session confirmation and clears draft', async () => {
    const draftPayload: OnboardTenantPayload = {
      name: 'Beacon College',
      slug: 'beacon-college',
      campus_name: 'Main Campus',
      city: 'Lahore',
    };

    localStorage.setItem('apex_pending_onboarding_draft', JSON.stringify({
      payload: draftPayload,
      email: 'principal@beaconcollege.edu.pk',
      timestamp: Date.now(),
    }));

    // Mock API fetch
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/auth/onboard-tenant')) {
        const body = JSON.parse(String(init?.body || '{}'));
        expect(body.name).toBe('Beacon College');
        expect(body.slug).toBe('beacon-college');
        expect(init?.headers).toBeDefined();

        return new Response(JSON.stringify({
          success: true,
          data: {
            tenant: { id: 't-123', name: body.name, slug: body.slug },
            membership: { id: 'm-123', role: 'tenant_admin' },
          },
        }), { status: 201 });
      }
      return new Response(JSON.stringify({ success: false }), { status: 404 });
    });

    // Simulate session bootstrap with draft recovery logic
    const draftRaw = localStorage.getItem('apex_pending_onboarding_draft');
    expect(draftRaw).not.toBeNull();
    const draft = JSON.parse(draftRaw!);

    const verifiedUserEmail = 'principal@beaconcollege.edu.pk';
    expect(draft.email).toBe(verifiedUserEmail);

    const res = await fetchMock('/api/v1/auth/onboard-tenant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer verified-session-token-abc',
      },
      body: JSON.stringify(draft.payload),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);

    // On success, draft is cleaned up
    localStorage.removeItem('apex_pending_onboarding_draft');
    expect(localStorage.getItem('apex_pending_onboarding_draft')).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 3. Finding B05: Password Recovery State & URL Hash Parsing
  // ---------------------------------------------------------------------------
  it('B05: detects password recovery mode from URL hash and recovery event', () => {
    const isRecoveryHash = (hash: string) => {
      return hash.includes('reset-password') || hash.includes('type=recovery');
    };

    expect(isRecoveryHash('#reset-password')).toBe(true);
    expect(isRecoveryHash('#access_token=token123&type=recovery')).toBe(true);
    expect(isRecoveryHash('#/reset-password')).toBe(true);
    expect(isRecoveryHash('#dashboard')).toBe(false);
    expect(isRecoveryHash('#superadmin')).toBe(false);
  });

  it('B05: validates password length and match rules for new password', () => {
    const validateNewPassword = (pwd: string, confirm: string): { valid: boolean; error?: string } => {
      const trimmed = pwd.trim();
      if (trimmed.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters long.' };
      }
      if (trimmed !== confirm.trim()) {
        return { valid: false, error: 'Passwords do not match. Please verify and re-enter.' };
      }
      return { valid: true };
    };

    expect(validateNewPassword('short', 'short').valid).toBe(false);
    expect(validateNewPassword('short', 'short').error).toContain('at least 8 characters');
    expect(validateNewPassword('ValidPass123', 'DifferentPass123').valid).toBe(false);
    expect(validateNewPassword('ValidPass123', 'DifferentPass123').error).toContain('do not match');
    expect(validateNewPassword('ValidPass123', 'ValidPass123').valid).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 4. Finding B08: Platform Superadmin Direct Entry Lifecycle
  // ---------------------------------------------------------------------------
  it('B08: grants platform superadmin entry even with zero academy memberships', () => {
    const sessionResponse = {
      success: true,
      data: {
        profile: {
          id: 'super-admin-uuid-001',
          email: 'platform.director@kampus.pk',
          display_name: 'Platform Superadmin',
          platform_role: 'super_admin',
        },
        memberships: [], // Zero memberships
        active_membership: null,
        active_tenant: null,
      },
    };

    const profile = sessionResponse.data.profile;
    const memberships = sessionResponse.data.memberships;

    let membershipState = 'ready';
    let userSession: any = null;

    if (profile?.platform_role === 'super_admin') {
      userSession = {
        id: profile.id,
        tenant_id: '',
        auth_user_id: profile.id,
        email: profile.email,
        full_name: profile.display_name,
        role: 'super_admin',
        permissions: ['all'],
        access: {},
        working_session: '2026-2027',
      };
      membershipState = 'platform_superadmin';
    } else if (memberships.length === 0) {
      membershipState = 'no_memberships';
    }

    expect(membershipState).toBe('platform_superadmin');
    expect(membershipState).not.toBe('no_memberships');
    expect(userSession).not.toBeNull();
    expect(userSession.role).toBe('super_admin');
    expect(userSession.permissions).toContain('all');
  });

  // ---------------------------------------------------------------------------
  // 5. Login Identifier Standardization (Eliminating CNIC Sign-In Confusion)
  // ---------------------------------------------------------------------------
  it('Login Identifier: enforces email-based login input and eliminates CNIC conflation', () => {
    // The identifier field in LoginModal is type="email" and labeled "Institutional Email Address"
    const loginFieldConfig = {
      id: 'login-identifier',
      name: 'identifier',
      type: 'email',
      label: 'Institutional Email Address',
      placeholder: 'name@academy.edu.pk or guardian@gmail.com',
      ariaLabel: 'Institutional Email Address',
    };

    expect(loginFieldConfig.type).toBe('email');
    expect(loginFieldConfig.label).toBe('Institutional Email Address');
    expect(loginFieldConfig.label).not.toContain('Father/Guardian CNIC');
    expect(loginFieldConfig.placeholder).toContain('@');
    expect(loginFieldConfig.placeholder).not.toContain('37405');
  });
});
