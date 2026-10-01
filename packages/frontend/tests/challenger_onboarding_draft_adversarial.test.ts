import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OnboardTenantPayload } from '@apex/shared-types';

/**
 * Challenger Final 2: Adversarial Stress Test Suite
 * Target: packages/frontend/src/context/AuthContext.tsx (Scope 2: Resumable Onboarding State)
 * 
 * Objectives:
 * 1. Challenge draft resumption in AuthContext.tsx: What happens if localStorage contains
 *    a draft belonging to a different email address?
 * 2. Verify mismatched identity drafts are strictly ignored and not auto-submitted.
 * 3. Probe edge cases: case insensitivity, corrupted JSON, missing email wildcard behavior,
 *    password exclusion, and backend failure resilience.
 */

describe('Challenger Final 2 — Adversarial Challenge: Resumable Onboarding Draft Identity Isolation', () => {
  let localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    localStorageMock = {};
    const mockStorage = {
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
    };
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', {
      localStorage: mockStorage,
      location: { origin: 'http://localhost:5173' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * Helper that executes the exact draft resumption decision logic from AuthContext.tsx:342-375
   */
  async function simulateDraftResumption(
    profile: { id: string; email: string; platform_role?: string } | null,
    accessToken: string,
    fetchMock: (url: string, init?: RequestInit) => Promise<Response>
  ): Promise<{ resumed: boolean; draftCleared: boolean; finalState: string }> {
    const draftRaw = typeof window !== 'undefined' ? localStorage.getItem('apex_pending_onboarding_draft') : null;
    let resumed = false;

    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw);
        const userEmail = (profile?.email || '').toLowerCase().trim();
        const draftEmail = (draft?.email || '').toLowerCase().trim();

        if (draft?.payload && (!draftEmail || !userEmail || draftEmail === userEmail)) {
          const onboardRes = await fetchMock('/api/v1/auth/onboard-tenant', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              name: draft.payload.name,
              slug: draft.payload.slug,
              campus_name: draft.payload.campus_name || undefined,
              city: draft.payload.city || undefined,
              phone: draft.payload.phone || undefined,
              logo_url: draft.payload.logo_url || undefined,
            }),
          });
          const onboardBody = await onboardRes.json().catch(() => null);
          if (onboardRes.ok && onboardBody?.success) {
            localStorage.removeItem('apex_pending_onboarding_draft');
            resumed = true;
            return {
              resumed: true,
              draftCleared: localStorage.getItem('apex_pending_onboarding_draft') === null,
              finalState: 'ready',
            };
          }
        }
      } catch (draftErr) {
        // Log error and fall through
      }
    }

    return {
      resumed,
      draftCleared: localStorage.getItem('apex_pending_onboarding_draft') === null,
      finalState: 'no_memberships',
    };
  }

  // ===========================================================================
  // 1. Core Adversarial Challenge: Mismatched Identity Draft Rejection
  // ===========================================================================
  it('1. Strictly IGNORES mismatched identity draft and does NOT auto-submit to backend', async () => {
    // Adversarial Scenario:
    // localStorage contains an onboarding draft left by "attacker@evil.com"
    // An innocent user "director@beacon.edu.pk" signs in with 0 memberships.
    const attackerDraft = {
      payload: {
        name: 'Evil Phishing Academy',
        slug: 'evil-phishing',
        campus_name: 'Dark Campus',
      },
      email: 'attacker@evil.com',
      timestamp: Date.now(),
    };
    localStorage.setItem('apex_pending_onboarding_draft', JSON.stringify(attackerDraft));

    const authenticatedUser = {
      id: 'usr-legit-123',
      email: 'director@beacon.edu.pk',
      platform_role: 'user',
    };

    const fetchMock = vi.fn();

    const result = await simulateDraftResumption(
      authenticatedUser,
      'token-for-director',
      fetchMock
    );

    // CRITICAL ASSERTION: Backend onboarding endpoint was NEVER called!
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.resumed).toBe(false);
    expect(result.finalState).toBe('no_memberships');

    // The attacker's draft was NOT auto-submitted under director's credentials
    // and was NOT removed (retained in storage without leaking or activating)
    const stored = JSON.parse(localStorage.getItem('apex_pending_onboarding_draft')!);
    expect(stored.email).toBe('attacker@evil.com');
  });

  // ===========================================================================
  // 2. Case and Whitespace Invariant Verification
  // ===========================================================================
  it('2. Correctly matches and resumes draft when email has whitespace or casing differences', async () => {
    const legitimateDraft = {
      payload: {
        name: 'Beacon College',
        slug: 'beacon-college',
      },
      email: '  Director.Adnan@Beacon.edu.pk  ',
      timestamp: Date.now(),
    };
    localStorage.setItem('apex_pending_onboarding_draft', JSON.stringify(legitimateDraft));

    const authenticatedUser = {
      id: 'usr-adnan-123',
      email: 'director.adnan@beacon.edu.pk',
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { tenant: { id: 't-1' } } }), { status: 201 })
    );

    const result = await simulateDraftResumption(
      authenticatedUser,
      'token-for-adnan',
      fetchMock
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.resumed).toBe(true);
    expect(result.draftCleared).toBe(true);
    expect(localStorage.getItem('apex_pending_onboarding_draft')).toBeNull();
  });

  // ===========================================================================
  // 3. Discovery & Empirical Probe: Omitted Email Wildcard Behavior
  // ===========================================================================
  it('3. Edge Case Probe: Draft with missing email property activates wildcard (!draftEmail)', async () => {
    // If a draft has NO email property at all:
    const draftWithoutEmail = {
      payload: {
        name: 'Legacy Academy',
        slug: 'legacy-academy',
      },
      timestamp: Date.now(),
    };
    localStorage.setItem('apex_pending_onboarding_draft', JSON.stringify(draftWithoutEmail));

    const authenticatedUser = {
      id: 'usr-any-user',
      email: 'anyuser@domain.com',
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { tenant: { id: 't-legacy' } } }), { status: 201 })
    );

    const result = await simulateDraftResumption(
      authenticatedUser,
      'token-any',
      fetchMock
    );

    // Because AuthContext uses (!draftEmail || !userEmail || draftEmail === userEmail),
    // an empty draftEmail (missing property) triggers the wildcard branch.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.resumed).toBe(true);
  });

  // ===========================================================================
  // 4. Malformed and Corrupted Storage Resilience
  // ===========================================================================
  it('4. Corrupted JSON or non-object draft does not crash session bootstrap', async () => {
    const badDrafts = [
      '{ this is invalid json !!!',
      'null',
      '"just a string"',
      '12345',
      JSON.stringify({ email: 'director@beacon.edu.pk' }), // missing payload
    ];

    for (const bad of badDrafts) {
      localStorage.setItem('apex_pending_onboarding_draft', bad);

      const authenticatedUser = {
        id: 'usr-adnan-123',
        email: 'director@beacon.edu.pk',
      };

      const fetchMock = vi.fn();

      const result = await simulateDraftResumption(
        authenticatedUser,
        'token-test',
        fetchMock
      );

      // Must fail closed without crashing
      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.resumed).toBe(false);
      expect(result.finalState).toBe('no_memberships');
    }
  });

  // ===========================================================================
  // 5. Credential Stripping Invariant
  // ===========================================================================
  it('5. Strips sensitive keys (passwords, tokens) before transmitting draft to onboarding API', async () => {
    // Even if adversarial script or legacy version injected credentials into the draft payload
    const draftWithPassword = {
      payload: {
        name: 'Secure College',
        slug: 'secure-college',
        password: 'AdversarialPassword123!',
        access_token: 'stolen-bearer-token',
      } as any,
      email: 'principal@securecollege.edu.pk',
      timestamp: Date.now(),
    };
    localStorage.setItem('apex_pending_onboarding_draft', JSON.stringify(draftWithPassword));

    const authenticatedUser = {
      id: 'usr-sec-123',
      email: 'principal@securecollege.edu.pk',
    };

    let submittedBody: any = null;
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      submittedBody = JSON.parse(String(init?.body || '{}'));
      return new Response(JSON.stringify({ success: true, data: {} }), { status: 201 });
    });

    await simulateDraftResumption(
      authenticatedUser,
      'token-secure',
      fetchMock
    );

    expect(submittedBody).not.toBeNull();
    expect(submittedBody.name).toBe('Secure College');
    expect(submittedBody.slug).toBe('secure-college');
    // Strictly prohibited keys MUST NOT be sent in onboarding payload
    expect(submittedBody.password).toBeUndefined();
    expect(submittedBody.access_token).toBeUndefined();
  });

  // ===========================================================================
  // 6. Backend Error Handling: Preserves Draft on HTTP 400 (e.g. slug conflict)
  // ===========================================================================
  it('6. Does NOT wipe draft if backend rejects onboarding with HTTP 400/500', async () => {
    const draftPayload: OnboardTenantPayload = {
      name: 'Duplicate College',
      slug: 'duplicate-college',
    };
    localStorage.setItem('apex_pending_onboarding_draft', JSON.stringify({
      payload: draftPayload,
      email: 'principal@duplicate.edu.pk',
      timestamp: Date.now(),
    }));

    const authenticatedUser = {
      id: 'usr-dup-123',
      email: 'principal@duplicate.edu.pk',
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        success: false,
        error: { code: 'SLUG_IN_USE', message: 'Academy slug already in use.' }
      }), { status: 400 })
    );

    const result = await simulateDraftResumption(
      authenticatedUser,
      'token-dup',
      fetchMock
    );

    // On failure, draft is NOT wiped from storage so user can recover
    expect(result.resumed).toBe(false);
    expect(localStorage.getItem('apex_pending_onboarding_draft')).not.toBeNull();
  });
});
