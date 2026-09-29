import React, { createContext, useContext, useState, useEffect } from 'react';
import { TenantSettings, AcademicSession } from '@apex/shared-types';

export interface UserSession {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url?: string | null;
  permissions?: string[];
  access?: Record<string, 'view' | 'edit'>;
  teaching_assignments?: any[];
  designation?: string;
  must_change_password?: boolean;
  working_session?: string;
  year_closed?: boolean;
}

export interface TenantSession {
  id: string;
  name: string;
  slug: string;
  status: string;
  academic_session: string;
  academic_sessions?: AcademicSession[];
  campus_name: string;
  logo_url?: string | null;
  phone?: string | null;
  city?: string | null;
  domain?: string | null;
  suspended_reason?: string | null;
  settings?: TenantSettings | null;
}

export interface RegisterAcademyPayload {
  name: string;
  slug: string;
  city?: string;
  phone?: string;
  logo_url?: string;
  admin_name: string;
  admin_email: string;
  password: string;
}

interface AuthContextType {
  user: UserSession | null;
  tenant: TenantSession | null;
  token: string | null;
  isLoading: boolean;
  working_session: string;
  setWorkingSession: (name: string) => Promise<void>;
  loginWithPassword: (email: string, password: string, tenantSlug?: string) => Promise<{ success: boolean }>;
  registerAcademy: (payload: RegisterAcademyPayload) => Promise<{ success: boolean; message: string; dev_otp?: string; tenant: any; admin: any }>;
  verifyRegistrationOTP: (email: string, otp: string, tenantSlug: string, autoStartSession?: boolean) => Promise<{ success: boolean; sessionData?: any }>;
  applySession: (sessionData: any) => void;
  requestOTP: (email: string, tenantSlug: string) => Promise<{ success: boolean; message: string; dev_otp?: string }>;
  verifyOTP: (email: string, otp: string, tenantSlug: string) => Promise<{ success: boolean; message?: string }>;
  forgotPassword: (email: string, tenantSlug?: string) => Promise<{ success: boolean; message: string; dev_otp?: string }>;
  resetPassword: (email: string, otp: string, newPassword: string, tenantSlug?: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  switchDemoAccount: (email: string, tenantSlug?: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

if (typeof window !== 'undefined' && !(window as any).__kampus_fetch_intercepted) {
  (window as any).__kampus_fetch_intercepted = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const session = localStorage.getItem('kampus.working_session');
    if (session) {
      if (typeof input === 'string' || input instanceof URL) {
        init = init || {};
        const headers = new Headers(init.headers || {});
        if (!headers.has('X-Kampus-Session')) {
          headers.set('X-Kampus-Session', session);
        }
        init.headers = headers;
      } else if (input instanceof Request) {
        if (!input.headers.has('X-Kampus-Session')) {
          input.headers.set('X-Kampus-Session', session);
        }
      }
    }
    return originalFetch(input, init);
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [tenant, setTenant] = useState<TenantSession | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('apex_jwt_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate existing token on boot
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/v1/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const body = await res.json();
          const u = body.data.user;
          const t = body.data.tenant;
          const activeYear = t.settings?.academic_session || t.academic_session || '2026-2027';
          const workingYear = u.working_session || localStorage.getItem('kampus.working_session') || activeYear;
          localStorage.setItem('kampus.working_session', workingYear);
          setUser({
            ...u,
            working_session: workingYear,
            year_closed: u.year_closed ?? (workingYear !== activeYear),
          });
          setTenant({
            id: t.id,
            name: t.name,
            slug: t.slug,
            status: t.status,
            academic_session: activeYear,
            academic_sessions: t.academic_sessions || t.settings?.academic_sessions || [],
            campus_name: t.settings?.campus_name || t.campus_name || 'Main Campus',
            logo_url: t.logo_url || t.settings?.logo_url || (t.slug === 'tsa' ? '/tsa-logo.png' : null),
            phone: t.phone || t.settings?.phone || null,
            city: t.city || t.settings?.city || null,
            domain: t.domain || null,
            settings: t.settings || null,
          });
        } else {
          // Token expired or invalid
          localStorage.removeItem('apex_jwt_token');
          localStorage.removeItem('apex_active_screen');
          localStorage.removeItem('apex_staff_attendance_tab');
          localStorage.removeItem('kampus.working_session');
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname);
          }
          setToken(null);
          setUser(null);
          setTenant(null);
        }
      } catch (err) {
        console.error('Failed to verify existing session:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, [token]);

  useEffect(() => {
    const onFocus = () => {
      const currentToken = localStorage.getItem('apex_jwt_token');
      if (!currentToken) return;
      fetch('/api/v1/auth/me', { headers: { Authorization: `Bearer ${currentToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(body => {
          if (body?.data?.user) {
            const u = body.data.user;
            const t = body.data.tenant;
            const activeYear = t?.settings?.academic_session || t?.academic_session || '2026-2027';
            const workingYear = u.working_session || localStorage.getItem('kampus.working_session') || activeYear;
            setUser({
              ...u,
              working_session: workingYear,
              year_closed: u.year_closed ?? (workingYear !== activeYear),
            });
          }
        })
        .catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

async function parseJsonResponse(res: Response, fallbackMsg: string): Promise<any> {
  const text = await res.text();
  if (!text || !text.trim()) {
    if (res.status === 405) {
      throw new Error('Cloudflare edge proxy is updating. Please refresh the page and try again.');
    }
    if (res.status === 502 || res.status === 504 || res.status === 524) {
      throw new Error('Backend server is waking up. Please retry in a few seconds.');
    }
    throw new Error(`${fallbackMsg} (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${fallbackMsg} (Server returned invalid response)`);
  }
}

  const handleSessionData = (sessionData: any) => {
    if (!sessionData) return;
    localStorage.setItem('apex_jwt_token', sessionData.token);
    setToken(sessionData.token);

    const u = sessionData.user;
    const t = sessionData.tenant;
    const activeYear = t?.settings?.academic_session || t?.academic_session || '2026-2027';
    const workingYear = u?.working_session || localStorage.getItem('kampus.working_session') || activeYear;
    localStorage.setItem('kampus.working_session', workingYear);

    setUser({
      ...u,
      working_session: workingYear,
      year_closed: u?.year_closed ?? (workingYear !== activeYear),
    });

    setTenant({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      academic_session: activeYear,
      academic_sessions: t.academic_sessions || t.settings?.academic_sessions || [],
      campus_name: t.settings?.campus_name || t.campus_name || 'Main Campus',
      logo_url: t.logo_url || t.settings?.logo_url || (t.slug === 'tsa' ? '/tsa-logo.png' : null),
      phone: t.phone || t.settings?.phone || null,
      city: t.city || t.settings?.city || null,
      domain: t.domain || null,
      settings: t.settings || null,
    });
  };

  /**
   * Daily Operational Login with Email & Password
   */
  const loginWithPassword = async (email: string, password: string, tenantSlug?: string) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        password,
        tenant_slug: tenantSlug?.trim() || undefined,
      }),
    });

    const body = await parseJsonResponse(res, 'Login failed.');
    if (!res.ok) {
      throw new Error(body.error?.message || 'Invalid email or password.');
    }

    handleSessionData(body.data);
    return { success: true };
  };

  /**
   * Register a new academy with subdomain provisioning & Brevo OTP dispatch
   */
  const registerAcademy = async (payload: RegisterAcademyPayload) => {
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      const body = await parseJsonResponse(res, 'Failed to register academy.');
      if (!res.ok) {
        throw new Error(body.error?.message || 'Failed to register academy.');
      }

      return {
        success: true,
        message: body.data.message,
        dev_otp: body.data.otp_preview,
        tenant: body.data.tenant,
        admin: body.data.admin,
      };
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new Error('Registration request timed out. Please check your connection or retry.');
      }
      throw err;
    }
  };

  /**
   * Apply user session directly from session response
   */
  const applySession = (sessionData: any) => {
    handleSessionData(sessionData);
  };

  /**
   * Verify Registration 6-Digit OTP & optionally start session
   */
  const verifyRegistrationOTP = async (email: string, otp: string, tenantSlug: string, autoStartSession: boolean = false) => {
    const res = await fetch('/api/v1/auth/verify-registration-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), otp: otp.trim(), tenant_slug: tenantSlug.trim() }),
    });

    const body = await parseJsonResponse(res, 'Verification failed.');
    if (!res.ok) {
      throw new Error(body.error?.message || 'Verification failed.');
    }

    const sessionData = body.data;
    if (autoStartSession) {
      applySession(sessionData);
    }

    return { success: true, sessionData };
  };

  const requestOTP = async (email: string, tenantSlug: string) => {
    const res = await fetch('/api/v1/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, tenant_slug: tenantSlug }),
    });

    const body = await parseJsonResponse(res, 'Failed to send verification code.');
    if (!res.ok) {
      throw new Error(body.error?.message || 'Failed to send verification code.');
    }

    return {
      success: true,
      message: body.data.message,
      dev_otp: body.data.dev_otp_preview,
    };
  };

  const verifyOTP = async (email: string, otp: string, tenantSlug: string) => {
    const res = await fetch('/api/v1/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, tenant_slug: tenantSlug }),
    });

    const body = await parseJsonResponse(res, 'Verification failed.');
    if (!res.ok) {
      throw new Error(body.error?.message || 'Verification failed.');
    }

    handleSessionData(body.data);
    return { success: true };
  };

  const forgotPassword = async (email: string, tenantSlug?: string) => {
    const res = await fetch('/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), tenant_slug: tenantSlug?.trim() || undefined }),
    });

    const body = await parseJsonResponse(res, 'Failed to request password reset code.');
    if (!res.ok) {
      throw new Error(body.error?.message || 'Failed to request password reset code.');
    }

    return {
      success: true,
      message: body.data?.message || body.message || 'Verification code sent.',
      dev_otp: body.data?.dev_otp_preview,
    };
  };

  const resetPassword = async (email: string, otp: string, newPassword: string, tenantSlug?: string) => {
    const res = await fetch('/api/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        otp: otp.trim(),
        new_password: newPassword,
        tenant_slug: tenantSlug?.trim() || undefined,
      }),
    });

    const body = await parseJsonResponse(res, 'Failed to update password.');
    if (!res.ok) {
      throw new Error(body.error?.message || 'Failed to update password.');
    }

    return {
      success: true,
      message: body.message || 'Password updated successfully.',
    };
  };

  const logout = () => {
    localStorage.removeItem('apex_jwt_token');
    localStorage.removeItem('apex_active_screen');
    localStorage.removeItem('apex_staff_attendance_tab');
    localStorage.removeItem('kampus.working_session');
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    setToken(null);
    setUser(null);
    setTenant(null);
  };

  const refreshSession = async () => {
    const currentToken = localStorage.getItem('apex_jwt_token');
    if (!currentToken) return;
    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      if (res.ok) {
        const body = await res.json();
        const u = body.data.user;
        const t = body.data.tenant;
        const activeYear = t?.settings?.academic_session || t?.academic_session || '2026-2027';
        const workingYear = u?.working_session || localStorage.getItem('kampus.working_session') || activeYear;
        localStorage.setItem('kampus.working_session', workingYear);

        setUser({
          ...u,
          working_session: workingYear,
          year_closed: u?.year_closed ?? (workingYear !== activeYear),
        });

        setTenant({
          id: t.id,
          name: t.name,
          slug: t.slug,
          status: t.status,
          academic_session: activeYear,
          academic_sessions: t.academic_sessions || t.settings?.academic_sessions || [],
          campus_name: t.settings?.campus_name || t.campus_name || 'Main Campus',
          logo_url: t.logo_url || t.settings?.logo_url || (t.slug === 'tsa' ? '/tsa-logo.png' : null),
          phone: t.phone || t.settings?.phone || null,
          city: t.city || t.settings?.city || null,
          domain: t.domain || null,
          settings: t.settings || null,
        });
      }
    } catch (err) {
      console.error('Failed to refresh session:', err);
    }
  };

  const setWorkingSession = async (name: string) => {
    if (!token || !user) return;
    if (user.role === 'student' || user.role === 'parent') return;

    const res = await fetch('/api/v1/academic/working-session', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Kampus-Session': name,
      },
      body: JSON.stringify({ academic_session: name }),
    });

    const body = await parseJsonResponse(res, 'Failed to update working academic session.');
    if (!res.ok) {
      throw new Error(body.error?.message || 'Failed to update working academic session.');
    }

    const data = body.data || body;
    localStorage.setItem('kampus.working_session', name);
    setUser(prev => prev ? {
      ...prev,
      working_session: data.working_session || name,
      year_closed: data.year_closed ?? (name !== (data.academic_session || tenant?.academic_session)),
    } : null);

    setTenant(prev => prev ? {
      ...prev,
      academic_session: data.academic_session || prev.academic_session,
      academic_sessions: data.academic_sessions || prev.academic_sessions,
    } : null);
  };

  const switchDemoAccount = async (targetEmail: string, slug = 'apex') => {
    setIsLoading(true);
    try {
      // Direct password login for fast demo switching
      await loginWithPassword(targetEmail, 'Admin@123', slug);
    } catch {
      // Fallback to OTP flow
      try {
        const res = await requestOTP(targetEmail, slug);
        const otpCode = res.dev_otp || '123456';
        await verifyOTP(targetEmail, otpCode, slug);
      } catch (err) {
        console.error('Failed switching demo account:', err);
        throw err;
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        isLoading,
        working_session: user?.working_session || tenant?.academic_session || '2026-2027',
        setWorkingSession,
        loginWithPassword,
        registerAcademy,
        verifyRegistrationOTP,
        applySession,
        requestOTP,
        verifyOTP,
        forgotPassword,
        resetPassword,
        logout,
        switchDemoAccount,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
