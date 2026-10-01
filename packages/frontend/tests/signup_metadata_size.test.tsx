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
      expect(signup.options?.data).toEqual({ full_name: 'Director' });
      expect(JSON.stringify(signup.options?.data).length).toBeLessThan(100);
      const draft = JSON.parse(localStorage.getItem('apex_pending_onboarding_draft')!);
      expect(draft.payload.logo_url).toBe(logo);
      expect(draft.payload.slug).toBe('logo-academy');
    } finally {
      act(() => root.unmount()); container.remove(); localStorage.removeItem('apex_pending_onboarding_draft');
    }
  });
});
