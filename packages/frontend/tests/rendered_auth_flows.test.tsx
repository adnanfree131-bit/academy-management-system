/**
 * @vitest-environment happy-dom
 */

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// @ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { AcceptInvitationView } from '../src/views/AcceptInvitationView';
import { PasswordRecoveryModal } from '../src/components/PasswordRecoveryModal';
import { NoMembershipsAdvisory } from '../src/components/NoMembershipsAdvisory';
import { BrandedHostRestrictedAdvisory } from '../src/components/BrandedHostRestrictedAdvisory';
import { CreateAcademyModal } from '../src/components/CreateAcademyModal';
import { AcademySettingsView } from '../src/views/AcademySettingsView';
import { supabase } from '../src/lib/supabase';

// Mock Supabase client
vi.mock('../src/lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(),
        updateUser: vi.fn(),
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
      },
    },
  };
});

describe('Phase 5 Rendered Component Flows: C01-C03, B04, B05, B07', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  // ---------------------------------------------------------------------------
  // C01: Bounded Session Bootstrap (No infinite loop)
  // ---------------------------------------------------------------------------
  it('C01: AuthProvider performs bounded session bootstrap (exactly 1 call to /session, no loop)', async () => {
    const sessionToken = 'jwt-superadmin-token-12345';
    let sessionFetchCount = 0;

    // Spy on window.fetch
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/v1/auth/session')) {
        sessionFetchCount++;
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              profile: {
                id: 'super-admin-auth-id',
                email: 'superadmin@kampus.pk',
                display_name: 'Platform Superadmin',
                platform_role: 'super_admin',
              },
              memberships: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    // Mock getSession to return active session once
    (supabase.auth.getSession as any).mockResolvedValue({
      data: {
        session: {
          access_token: sessionToken,
          user: { id: 'super-admin-auth-id', email: 'superadmin@kampus.pk' },
        },
      },
      error: null,
    });

    (supabase.auth.onAuthStateChange as any).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    function Consumer() {
      const { user, authenticatedIdentity, isLoading } = useAuth();
      return (
        <div>
          <span id="loading">{String(isLoading)}</span>
          <span id="role">{user?.role || 'no-user'}</span>
          <span id="identity">{authenticatedIdentity?.email || 'no-identity'}</span>
        </div>
      );
    }

    await act(async () => {
      root.render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>
      );
    });

    // Allow async microtasks and state updates to settle
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    // Verify identity was resolved and session request is strictly bounded to 1
    const identityEl = container.querySelector('#identity');
    expect(identityEl?.textContent).toBe('superadmin@kampus.pk');
    expect(sessionFetchCount).toBe(1);

    // Trigger an extra tick to ensure no re-entrant loop occurs
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    expect(sessionFetchCount).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // C02 & C03: AcceptInvitationView with zero memberships sends valid bearer token
  // ---------------------------------------------------------------------------
  it('C02 & C03: Zero-membership invited identity sends valid Bearer token on acceptance', async () => {
    const validAuthToken = 'valid-supabase-auth-token-c02';
    let interceptedAuthHeader: string | null = null;
    let acceptedUrl: string | null = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init: any) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/invitations/inv-token-abc/inspect')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              tenant_name: 'Oxford Cambridge Academy',
              tenant_slug: 'oxford',
              email: 'newuser@oxford.edu.pk',
              role: 'teacher',
              expires_at: '2026-10-31T00:00:00Z',
              is_valid: true,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/invitations/inv-token-abc/accept') || url.includes('/invitations/accept')) {
        interceptedAuthHeader = new Headers(init?.headers).get('Authorization');
        acceptedUrl = url;
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              membership_id: 'mem-123',
              tenant_id: 'tenant-oxford',
              role: 'teacher',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    // Mock getSession to return the current token
    (supabase.auth.getSession as any).mockResolvedValue({
      data: {
        session: {
          access_token: validAuthToken,
          user: { id: 'u-1', email: 'newuser@oxford.edu.pk' },
        },
      },
      error: null,
    });

    // Render AuthProvider with simulated zero-membership state
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init: any) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/v1/auth/session')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              profile: {
                id: 'auth-user-0-memberships',
                email: 'newuser@oxford.edu.pk',
                display_name: 'New Teacher',
                platform_role: 'user',
              },
              memberships: [], // Zero memberships!
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/inspect')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              tenant_name: 'Oxford Cambridge Academy',
              tenant_slug: 'oxford',
              email: 'newuser@oxford.edu.pk',
              role: 'teacher',
              expires_at: '2026-10-31T00:00:00Z',
              is_valid: true,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/accept')) {
        interceptedAuthHeader = new Headers(init?.headers).get('Authorization');
        acceptedUrl = url;
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              membership_id: 'mem-123',
              tenant_id: 'tenant-oxford',
              role: 'teacher',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    await act(async () => {
      root.render(
        <AuthProvider>
          <AcceptInvitationView token="inv-token-abc" />
        </AuthProvider>
      );
    });

    // Let inspect and auth bootstrap complete
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    // Verify invitation details rendered
    expect(container.textContent).toContain('Oxford Cambridge Academy');
    expect(container.textContent).toContain('newuser@oxford.edu.pk');

    // Find the accept button
    const acceptBtn = container.querySelector('button') as HTMLButtonElement | null;
    expect(acceptBtn).not.toBeNull();
    expect(acceptBtn?.textContent).toContain('Accept');

    // Click the accept button
    await act(async () => {
      acceptBtn?.click();
      await new Promise(r => setTimeout(r, 100));
    });

    // C02 Assertion: Authorization header MUST NOT be Bearer null or empty
    expect(interceptedAuthHeader).toBe(`Bearer ${validAuthToken}`);
    expect(acceptedUrl).toContain('/api/v1/auth/invitations/accept');
  });

  // ---------------------------------------------------------------------------
  // C03: AcceptInvitationView unauthenticated dual tabs (Sign In vs Create Account)
  // ---------------------------------------------------------------------------
  it('C03: Unauthenticated invitation view renders dual tabs (Sign In & Create New Account)', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/inspect')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              tenant_name: 'Apex Future Academy',
              tenant_slug: 'apex-future',
              email: 'invitee@future.edu.pk',
              role: 'student',
              expires_at: '2026-10-31T00:00:00Z',
              is_valid: true,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    await act(async () => {
      root.render(
        <AuthProvider>
          <AcceptInvitationView token="inv-future-123" />
        </AuthProvider>
      );
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 80));
    });

    expect(container.textContent).toContain('Apex Future Academy');
    expect(container.textContent).toContain('Sign In');
    expect(container.textContent).toContain('Create New Account');

    // Click Create New Account tab
    const buttons = Array.from(container.querySelectorAll('button'));
    const createAccountTab = buttons.find(b => b.textContent?.includes('Create New Account'));
    expect(createAccountTab).toBeDefined();

    await act(async () => {
      createAccountTab?.click();
    });

    // Assert Full Name input is rendered
    expect(container.textContent).toContain('Full Name');
    const inputs = Array.from(container.querySelectorAll('input'));
    const fullNameInput = inputs.find(i => i.placeholder?.includes('Sarah Khan') || i.type === 'text');
    expect(fullNameInput).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // B05: PasswordRecoveryModal renders inputs and executes updateUser
  // ---------------------------------------------------------------------------
  it('B05: PasswordRecoveryModal renders inputs, verifies passwords match, and calls updateUser', async () => {
    const onCompleteSpy = vi.fn();
    (supabase.auth.updateUser as any).mockResolvedValue({
      data: { user: { id: 'u-123' } },
      error: null,
    });

    await act(async () => {
      root.render(
        <PasswordRecoveryModal onComplete={onCompleteSpy} />
      );
    });

    expect(container.textContent).toContain('Set New Password');

    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBe(2); // New password and confirm password

    const newPasswordInput = inputs[0] as HTMLInputElement;
    const confirmPasswordInput = inputs[1] as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    const setReactInputValue = (input: HTMLInputElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (setter) {
        setter.call(input, val);
      } else {
        input.value = val;
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // Test password mismatch
    await act(async () => {
      setReactInputValue(newPasswordInput, 'SecretPassword123!');
      setReactInputValue(confirmPasswordInput, 'MismatchedPassword123!');
      form.dispatchEvent(new Event('submit', { bubbles: true }));
    });

    expect(container.textContent).toContain('Passwords do not match');
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();

    // Test password match and submit
    await act(async () => {
      setReactInputValue(confirmPasswordInput, 'SecretPassword123!');
      form.dispatchEvent(new Event('submit', { bubbles: true }));
    });

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: 'SecretPassword123!',
    });
  });

  // ---------------------------------------------------------------------------
  // B04 & B07: NoMembershipsAdvisory continuation & BrandedHostRestrictedAdvisory
  // ---------------------------------------------------------------------------
  it('B04: NoMembershipsAdvisory provides Set Up New Academy continuation button', async () => {
    const onCreateAcademySpy = vi.fn();

    await act(async () => {
      root.render(
        <NoMembershipsAdvisory
          email="director@newacademy.pk"
          onLogout={vi.fn()}
          onCreateAcademy={onCreateAcademySpy}
        />
      );
    });

    expect(container.textContent).toContain('No Academy Memberships Found');
    const setupBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Set Up New Academy')
    );
    expect(setupBtn).toBeDefined();

    await act(async () => {
      setupBtn?.click();
    });

    expect(onCreateAcademySpy).toHaveBeenCalled();
  });

  it('B07: BrandedHostRestrictedAdvisory displays custom domain cleanly without malformed platform concatenation', async () => {
    await act(async () => {
      root.render(
        <BrandedHostRestrictedAdvisory
          email="teacher@oxford.edu.pk"
          expectedSlug="portal.oxford.edu.pk"
          onLogout={vi.fn()}
          isCustomDomain={true}
          customDomain="portal.oxford.edu.pk"
        />
      );
    });

    expect(container.textContent).toContain('Campus Access Restricted');
    expect(container.textContent).toContain('portal.oxford.edu.pk');
    expect(container.textContent).not.toContain('portal.oxford.edu.pk.kampus.pk');
  });

  // ---------------------------------------------------------------------------
  // D01: Custom-domain login lifecycle coordination (both response orders & non-member)
  // ---------------------------------------------------------------------------
  function CustomDomainConsumer() {
    const { user, tenant, membershipState, isLoading } = useAuth();
    return (
      <div>
        <span id="loading">{String(isLoading)}</span>
        <span id="state">{membershipState}</span>
        <span id="tenant-name">{tenant?.name || 'no-tenant'}</span>
        <span id="user-name">{user?.full_name || 'no-user'}</span>
      </div>
    );
  }

  it('D01 Order 1: Custom domain login grants access when session completes before host mapping resolves', async () => {
    window.location.href = 'http://portal.example.test';
    let sessionFetchCount = 0;

    (supabase.auth.getSession as any).mockResolvedValue({
      data: {
        session: {
          access_token: 'member-alpha-token-1',
          user: { id: 'u-alpha', email: 'member@example.com' },
        },
      },
      error: null,
    });
    (supabase.auth.onAuthStateChange as any).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/v1/auth/session')) {
        sessionFetchCount++;
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              profile: { id: 'u-alpha', email: 'member@example.com', display_name: 'Alpha Member', platform_role: 'user' },
              memberships: [
                {
                  id: 'mem-alpha',
                  tenant_id: 'tenant-alpha',
                  tenant_name: 'Alpha Academy',
                  tenant_slug: 'alpha',
                  role: 'teacher',
                  is_active: true,
                  status: 'active',
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/api/v1/auth/resolve-host')) {
        // Resolve host takes 40ms to simulate slower mapping response
        await new Promise(r => setTimeout(r, 40));
        return new Response(
          JSON.stringify({
            success: true,
            data: { tenant_id: 'tenant-alpha', slug: 'alpha', name: 'Alpha Academy' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/api/v1/auth/me')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              user: { id: 'u-alpha', full_name: 'Alpha Member', role: 'teacher' },
              tenant: { id: 'tenant-alpha', name: 'Alpha Academy', slug: 'alpha', status: 'active' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    try {
      await act(async () => {
        root.render(
          <AuthProvider>
            <CustomDomainConsumer />
          </AuthProvider>
        );
      });

      // Wait for delayed resolveHost to settle
      await act(async () => {
        await new Promise(r => setTimeout(r, 120));
      });

      expect(container.querySelector('#state')?.textContent).toBe('ready');
      expect(container.querySelector('#tenant-name')?.textContent).toBe('Alpha Academy');
      expect(sessionFetchCount).toBe(1); // Exactly 1 bounded session request, no loop
    } finally {
      window.location.href = 'http://localhost';
    }
  });

  it('D01 Order 2: Custom domain login grants access when host mapping resolves before session completes', async () => {
    window.location.href = 'http://portal.example.test';
    let sessionFetchCount = 0;

    (supabase.auth.getSession as any).mockResolvedValue({
      data: {
        session: {
          access_token: 'member-alpha-token-2',
          user: { id: 'u-alpha', email: 'member@example.com' },
        },
      },
      error: null,
    });
    (supabase.auth.onAuthStateChange as any).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/v1/auth/resolve-host')) {
        // Resolve host completes immediately
        return new Response(
          JSON.stringify({
            success: true,
            data: { tenant_id: 'tenant-alpha', slug: 'alpha', name: 'Alpha Academy' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/api/v1/auth/session')) {
        sessionFetchCount++;
        // Session takes 40ms to simulate slower session response
        await new Promise(r => setTimeout(r, 40));
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              profile: { id: 'u-alpha', email: 'member@example.com', display_name: 'Alpha Member', platform_role: 'user' },
              memberships: [
                {
                  id: 'mem-alpha',
                  tenant_id: 'tenant-alpha',
                  tenant_name: 'Alpha Academy',
                  tenant_slug: 'alpha',
                  role: 'teacher',
                  is_active: true,
                  status: 'active',
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/api/v1/auth/me')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              user: { id: 'u-alpha', full_name: 'Alpha Member', role: 'teacher' },
              tenant: { id: 'tenant-alpha', name: 'Alpha Academy', slug: 'alpha', status: 'active' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    try {
      await act(async () => {
        root.render(
          <AuthProvider>
            <CustomDomainConsumer />
          </AuthProvider>
        );
      });

      // Wait for delayed session to settle
      await act(async () => {
        await new Promise(r => setTimeout(r, 120));
      });

      expect(container.querySelector('#state')?.textContent).toBe('ready');
      expect(container.querySelector('#tenant-name')?.textContent).toBe('Alpha Academy');
      expect(sessionFetchCount).toBe(1);
    } finally {
      window.location.href = 'http://localhost';
    }
  });

  it('D01 Non-member: Custom domain login for non-member definitively denies access after mapping resolves', async () => {
    window.location.href = 'http://portal.example.test';
    let sessionFetchCount = 0;

    (supabase.auth.getSession as any).mockResolvedValue({
      data: {
        session: {
          access_token: 'member-beta-token-3',
          user: { id: 'u-beta', email: 'beta@example.com' },
        },
      },
      error: null,
    });
    (supabase.auth.onAuthStateChange as any).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/v1/auth/resolve-host')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { tenant_id: 'tenant-alpha', slug: 'alpha', name: 'Alpha Academy' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/api/v1/auth/session')) {
        sessionFetchCount++;
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              profile: { id: 'u-beta', email: 'beta@example.com', display_name: 'Beta Member', platform_role: 'user' },
              memberships: [
                {
                  id: 'mem-beta',
                  tenant_id: 'tenant-beta',
                  tenant_name: 'Beta Academy',
                  tenant_slug: 'beta',
                  role: 'teacher',
                  is_active: true,
                  status: 'active',
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    try {
      await act(async () => {
        root.render(
          <AuthProvider>
            <CustomDomainConsumer />
          </AuthProvider>
        );
      });

      await act(async () => {
        await new Promise(r => setTimeout(r, 80));
      });

      expect(container.querySelector('#state')?.textContent).toBe('unauthorized_for_branded_host');
      expect(sessionFetchCount).toBe(1);
    } finally {
      window.location.href = 'http://localhost';
    }
  });

  // ---------------------------------------------------------------------------
  // D02: Existing authenticated identity onboarding continuation
  // ---------------------------------------------------------------------------
  it('D02: Existing authenticated identity creates academy without signUp and handles error/retry without losing draft', async () => {
    const activeToken = 'existing-user-jwt-token-456';
    let onboardCallCount = 0;
    let lastOnboardBody: any = null;

    (supabase.auth.getSession as any).mockResolvedValue({
      data: {
        session: {
          access_token: activeToken,
          user: { id: 'u-existing', email: 'existing.director@example.com' },
        },
      },
      error: null,
    });
    (supabase.auth.onAuthStateChange as any).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init: any) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/v1/auth/session')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              profile: { id: 'u-existing', email: 'existing.director@example.com', display_name: 'Existing Director', platform_role: 'user' },
              memberships: onboardCallCount > 0 ? [
                {
                  id: 'mem-horizon',
                  tenant_id: 'tenant-horizon',
                  tenant_name: 'Horizon Institute',
                  tenant_slug: 'horizon-pk',
                  role: 'director',
                  is_active: true,
                  status: 'active',
                }
              ] : [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/api/v1/auth/check-domain')) {
        const u = new URL(url, 'http://localhost');
        const s = u.searchParams.get('slug') || '';
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              slug: s,
              available: true,
              domain: `${s}.kampus.pk`,
              message: 'Subdomain available!',
            },
            timestamp: new Date().toISOString(),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/api/v1/auth/onboard-tenant')) {
        onboardCallCount++;
        lastOnboardBody = JSON.parse(init.body);

        // First call fails with duplicate slug to test error banner & draft retention
        if (onboardCallCount === 1) {
          return new Response(
            JSON.stringify({
              success: false,
              error: { message: 'Subdomain horizon is already reserved' },
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Second call succeeds
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              tenant: { id: 'tenant-horizon', name: 'Horizon Institute', slug: 'horizon-pk', status: 'active' },
              admin: { id: 'mem-horizon' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/api/v1/auth/me')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              user: { id: 'u-existing', full_name: 'Existing Director', role: 'director' },
              tenant: { id: 'tenant-horizon', name: 'Horizon Institute', slug: 'horizon-pk', status: 'active' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    const setReactInputValue = (input: HTMLInputElement, val: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (setter) {
        setter.call(input, val);
      } else {
        input.value = val;
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    let createdTenantResult: any = null;

    function OnboardingFlowTest() {
      return (
        <CreateAcademyModal
          onCancel={vi.fn()}
          onSuccess={(t) => {
            createdTenantResult = t;
          }}
        />
      );
    }

    await act(async () => {
      root.render(
        <AuthProvider>
          <OnboardingFlowTest />
        </AuthProvider>
      );
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 60));
    });

    // Verify modal rendered with authenticated account badge
    expect(container.textContent).toContain('Set Up New Academy');
    expect(container.textContent).toContain('existing.director@example.com');

    // Fill form inputs
    const nameInput = container.querySelector('input[placeholder*="Oxford Grammar School"]') as HTMLInputElement;
    const slugInput = container.querySelector('input[placeholder="oxford"]') as HTMLInputElement;
    const campusInput = container.querySelector('input[placeholder="Main Campus"]') as HTMLInputElement;
    const cityInput = container.querySelector('input[placeholder*="Lahore"]') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    expect(nameInput).toBeDefined();
    expect(slugInput).toBeDefined();

    await act(async () => {
      setReactInputValue(nameInput, 'Horizon Institute');
      setReactInputValue(slugInput, 'horizon');
      setReactInputValue(campusInput, 'North Campus');
      setReactInputValue(cityInput, 'Islamabad');
    });

    // 1st submission: should fail with 400 and retain form fields
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true }));
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 60));
    });

    expect(container.textContent).toContain('Subdomain horizon is already reserved');
    expect(nameInput.value).toBe('Horizon Institute');
    expect(campusInput.value).toBe('North Campus');
    expect(cityInput.value).toBe('Islamabad');
    expect(supabase.auth.signUp).not.toHaveBeenCalled(); // ZERO signup calls!

    // Correct slug and submit again
    await act(async () => {
      setReactInputValue(slugInput, 'horizon-pk');
      form.dispatchEvent(new Event('submit', { bubbles: true }));
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 60));
    });

    // Verify successful onboarding without signup
    expect(supabase.auth.signUp).not.toHaveBeenCalled(); // ZERO signup calls!
    expect(onboardCallCount).toBe(2);
    expect(lastOnboardBody).toEqual({
      name: 'Horizon Institute',
      slug: 'horizon-pk',
      campus_name: 'North Campus',
      city: 'Islamabad',
    });
    expect(createdTenantResult).toEqual({
      id: 'tenant-horizon',
      name: 'Horizon Institute',
      slug: 'horizon-pk',
      status: 'active',
    });
  });
});

describe('E01 Contract: CreateAcademyModal Real Backend Availability Scenarios', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  const setReactInputValue = (input: HTMLInputElement, val: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(input, val);
    } else {
      input.value = val;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  it('handles available, taken, reserved, and 500 error with retry using authentic /api/v1/auth/check-domain Fastify contract', async () => {
    let endpointCalledWith: string[] = [];
    let shouldFailWithError = false;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/v1/auth/check-domain')) {
        const u = new URL(url, 'http://localhost');
        const slug = u.searchParams.get('slug') || '';
        endpointCalledWith.push(slug);

        if (shouldFailWithError) {
          return new Response(
            JSON.stringify({
              success: false,
              error: { code: 'SERVER_ERROR', message: 'Internal server error' },
              timestamp: new Date().toISOString(),
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (slug === 'admin') {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                slug,
                available: false,
                domain: 'admin.kampus.pk',
                message: "'admin' is a reserved platform subdomain and cannot be used.",
              },
              timestamp: new Date().toISOString(),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (slug === 'taken-academy') {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                slug,
                available: false,
                domain: 'taken-academy.kampus.pk',
                message: 'This subdomain is already registered by another academy.',
              },
              timestamp: new Date().toISOString(),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              slug,
              available: true,
              domain: `${slug}.kampus.pk`,
              message: 'Subdomain available!',
            },
            timestamp: new Date().toISOString(),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    (supabase.auth.getSession as any).mockResolvedValue({
      data: {
        session: {
          access_token: 'valid-token',
          user: { id: 'u-1', email: 'director@example.com' },
        },
      },
      error: null,
    });
    (supabase.auth.onAuthStateChange as any).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    await act(async () => {
      root.render(
        <AuthProvider>
          <CreateAcademyModal onCancel={vi.fn()} onSuccess={vi.fn()} />
        </AuthProvider>
      );
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 60));
    });

    const nameInput = container.querySelector('input[placeholder*="Oxford Grammar School"]') as HTMLInputElement;
    const slugInput = container.querySelector('input[placeholder="oxford"]') as HTMLInputElement;
    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    // 1. Enter institution name
    await act(async () => {
      setReactInputValue(nameInput, 'Apex Academy');
    });

    // 2. Scenario: Reserved slug ('admin')
    await act(async () => {
      setReactInputValue(slugInput, 'admin');
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 350));
    });
    expect(endpointCalledWith).toContain('admin');
    expect(container.textContent).toContain('Reserved');
    expect(submitBtn.disabled).toBe(true);

    // 3. Scenario: Taken slug ('taken-academy')
    await act(async () => {
      setReactInputValue(slugInput, 'taken-academy');
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 350));
    });
    expect(endpointCalledWith).toContain('taken-academy');
    expect(container.textContent).toContain('Taken');
    expect(submitBtn.disabled).toBe(true);

    // 4. Scenario: Server 500 error & Retry recovery
    shouldFailWithError = true;
    await act(async () => {
      setReactInputValue(slugInput, 'flaky-slug');
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 350));
    });
    expect(container.textContent).toContain('Check failed');
    expect(container.textContent).toContain('Retry');
    expect(submitBtn.disabled).toBe(true);

    // Recover from error by clicking Retry
    shouldFailWithError = false;
    const retryBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Retry'));
    expect(retryBtn).toBeDefined();

    await act(async () => {
      retryBtn!.click();
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });
    expect(container.textContent).toContain('Available');
    expect(submitBtn.disabled).toBe(false);
  });
});

describe('E02 Settings: AcademySettingsView Domain Provisioning Status Display', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  const renderSettingsWithProvisioningStatus = async (status: string | undefined) => {
    (supabase.auth.getSession as any).mockResolvedValue({
      data: {
        session: {
          access_token: 'token-settings',
          user: { id: 'u-settings', email: 'admin@apex.test' },
        },
      },
      error: null,
    });
    (supabase.auth.onAuthStateChange as any).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/v1/auth/session')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              profile: { id: 'u-settings', email: 'admin@apex.test', display_name: 'Admin', platform_role: 'user' },
              memberships: [
                {
                  id: 'mem-settings',
                  tenant_id: 'tenant-settings',
                  tenant_name: 'Apex Academy',
                  tenant_slug: 'apex',
                  role: 'director',
                  is_active: true,
                  status: 'active',
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/api/v1/auth/me')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              user: { id: 'u-settings', full_name: 'Admin', role: 'director' },
              tenant: {
                id: 'tenant-settings',
                name: 'Apex Academy',
                slug: 'apex',
                settings: status ? { domain_provisioning_status: status } : {},
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/api/v1/academic/academy-settings')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: 'tenant-settings',
              name: 'Apex Academy',
              slug: 'apex',
              settings: status ? { domain_provisioning_status: status } : {},
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('/api/v1/academic/batches')) {
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (url.includes('/api/v1/finance/heads')) {
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    await act(async () => {
      root.render(
        <AuthProvider>
          <AcademySettingsView />
        </AuthProvider>
      );
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 80));
    });
  };

  it('renders "Domain Status Unverified" and "Verify Domain" button when status is missing/undefined', async () => {
    await renderSettingsWithProvisioningStatus(undefined);
    expect(container.textContent).toContain('Dedicated Portal Domain');
    expect(container.textContent).toContain('Domain Status Unverified');
    expect(container.textContent).toContain('Verify Domain');
    expect(container.textContent).not.toContain('Domain Verified & Active');
  });

  it('renders "Domain Setup Incomplete" and "Retry Domain Setup" button when status is failed', async () => {
    await renderSettingsWithProvisioningStatus('failed');
    expect(container.textContent).toContain('Dedicated Portal Domain');
    expect(container.textContent).toContain('Domain Setup Incomplete');
    expect(container.textContent).toContain('Retry Domain Setup');
    expect(container.textContent).not.toContain('Domain Verified & Active');
  });

  it('renders "DNS / Pages Attach Pending" and "Check Status" button when status is pending', async () => {
    await renderSettingsWithProvisioningStatus('pending');
    expect(container.textContent).toContain('Dedicated Portal Domain');
    expect(container.textContent).toContain('DNS / Pages Attach Pending');
    expect(container.textContent).toContain('Check Status');
    expect(container.textContent).not.toContain('Domain Verified & Active');
  });

  it('renders "Domain Verified & Active" badge without retry button when status is active', async () => {
    await renderSettingsWithProvisioningStatus('active');
    expect(container.textContent).toContain('Dedicated Portal Domain');
    expect(container.textContent).toContain('Domain Verified & Active');
    expect(container.textContent).not.toContain('Retry Domain Setup');
    expect(container.textContent).not.toContain('Verify Domain');
  });
});

