/** @vitest-environment happy-dom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi } from 'vitest';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { supabase } from '../src/lib/supabase';
vi.mock('../src/lib/supabase', () => ({ supabase: { auth: {
  getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  signUp: vi.fn(async () => ({ data: { user: { id: 'new-identity' }, session: null }, error: null })),
} } }));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
describe('Registration with an uploaded academy logo', () => {
  it('keeps the full logo in the onboarding draft without embedding it in auth token metadata', async () => {
    const logo = 'data:image/webp;base64,' + 'A'.repeat(36000);
    let register: ReturnType<typeof useAuth>['registerAcademy'];
    function Harness() { register = useAuth().registerAcademy; return null; }
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(<AuthProvider><Harness /></AuthProvider>));
      await act(async () => { await register!({ name: 'Logo Academy', slug: 'logo-academy', admin_email: 'director@example.test', admin_name: 'Director', password: 'TestPassword123!', logo_url: logo }); });
      const signup = vi.mocked(supabase.auth.signUp).mock.calls[0][0];
      expect(signup.options?.data?.full_name).toBe('Director');
      expect(signup.options?.data?.pending_tenant).toMatchObject({ name: 'Logo Academy', slug: 'logo-academy' });
      expect(signup.options?.data?.pending_tenant).not.toHaveProperty('logo_url');
      expect(JSON.stringify(signup.options?.data).length).toBeLessThan(1000);
      const draft = JSON.parse(localStorage.getItem('apex_pending_onboarding_draft')!);
      expect(draft.payload.logo_url).toBe(logo);
      expect(draft.payload.slug).toBe('logo-academy');
    } finally {
      act(() => root.unmount()); container.remove(); localStorage.removeItem('apex_pending_onboarding_draft');
    }
  });
  it('resumes the saved authenticated registration when this browser has no local draft', async () => {
    localStorage.clear();
    vi.clearAllMocks();
    const profile = { id: 'saved-identity', email: 'director@example.test', platform_role: 'user' };
    const pending = { name: 'The Smart Academy', slug: 'tsa', city: 'Lahore' };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: 'confirmed-token', user: { ...profile, user_metadata: { pending_tenant: pending } } } }, error: null } as any);
    let sessionCalls = 0;
    const onboarding: any[] = [];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input);
      if (path.includes('/onboard-tenant')) {
        onboarding.push({ body: JSON.parse(init?.body as string), token: new Headers(init?.headers).get('Authorization') });
        return new Response(JSON.stringify({ success: true }), { status: 201 });
      }
      if (path.includes('/auth/session')) {
        sessionCalls++;
        return new Response(JSON.stringify({ success: true, data: { profile, memberships: sessionCalls === 1 ? [] : [{ id: 'member', tenant_id: 'tenant', tenant_slug: 'tsa', role: 'tenant_admin', status: 'active' }] } }));
      }
      return new Response(JSON.stringify({ success: true, data: { user: { id: profile.id, role: 'tenant_admin', permissions: [] }, tenant: { id: 'tenant', name: pending.name, slug: pending.slug, settings: {} } } }));
    });
    let state: ReturnType<typeof useAuth>;
    function Harness() { state = useAuth(); return null; }
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
    try {
      await act(async () => { root.render(<AuthProvider><Harness /></AuthProvider>); });
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
      expect(onboarding).toEqual([{ body: pending, token: 'Bearer confirmed-token' }]);
      expect(supabase.auth.signUp).not.toHaveBeenCalled();
      expect(sessionCalls).toBe(2);
      expect(state!.tenant?.slug).toBe('tsa');
      expect(localStorage.getItem('apex_pending_onboarding_draft')).toBeNull();
    } finally { act(() => root.unmount()); container.remove(); fetchMock.mockRestore(); localStorage.clear(); }
  });

});
