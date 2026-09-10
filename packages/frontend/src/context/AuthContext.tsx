import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserSession {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url?: string | null;
}

export interface TenantSession {
  id: string;
  name: string;
  slug: string;
  status: string;
  academic_session: string;
  campus_name: string;
  logo_url?: string | null;
  phone?: string | null;
  city?: string | null;
  domain?: string | null;
  suspended_reason?: string | null;
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
          setUser(body.data.user);
          setTenant({
            id: body.data.tenant.id,
            name: body.data.tenant.name,
            slug: body.data.tenant.slug,
            status: body.data.tenant.status,
            academic_session: body.data.tenant.settings?.academic_session || '2026-2027',
            campus_name: body.data.tenant.settings?.campus_name || 'Main Campus',
            logo_url: body.data.tenant.settings?.logo_url || null,
            phone: body.data.tenant.settings?.phone || null,
            city: body.data.tenant.settings?.city || null,
            domain: body.data.tenant.domain || null,
          });
        } else {
          // Token expired or invalid
          localStorage.removeItem('apex_jwt_token');
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

    const sessionData = body.data;
    localStorage.setItem('apex_jwt_token', sessionData.token);
    setToken(sessionData.token);
    setUser(sessionData.user);
    setTenant(sessionData.tenant);

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
    if (!sessionData) return;
    localStorage.setItem('apex_jwt_token', sessionData.token);
    setToken(sessionData.token);
    setUser(sessionData.user);
    setTenant(sessionData.tenant);
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

    const sessionData = body.data;
    localStorage.setItem('apex_jwt_token', sessionData.token);
    setToken(sessionData.token);
    setUser(sessionData.user);
    setTenant(sessionData.tenant);

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
        setUser(body.data.user);
        setTenant({
          id: body.data.tenant.id,
          name: body.data.tenant.name,
          slug: body.data.tenant.slug,
          status: body.data.tenant.status,
          academic_session: body.data.tenant.settings?.academic_session || '2026-2027',
          campus_name: body.data.tenant.settings?.campus_name || 'Main Campus',
          logo_url: body.data.tenant.settings?.logo_url || null,
          phone: body.data.tenant.settings?.phone || null,
          city: body.data.tenant.settings?.city || null,
          domain: body.data.tenant.domain || null,
        });
      }
    } catch (err) {
      console.error('Failed to refresh session:', err);
    }
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
