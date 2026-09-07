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
}

interface AuthContextType {
  user: UserSession | null;
  tenant: TenantSession | null;
  token: string | null;
  isLoading: boolean;
  requestOTP: (email: string, tenantSlug: string) => Promise<{ success: boolean; message: string; dev_otp?: string }>;
  verifyOTP: (email: string, otp: string, tenantSlug: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
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

  const requestOTP = async (email: string, tenantSlug: string) => {
    const res = await fetch('/api/v1/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, tenant_slug: tenantSlug }),
    });

    const body = await res.json();
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

    const body = await res.json();
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

  const logout = () => {
    localStorage.removeItem('apex_jwt_token');
    setToken(null);
    setUser(null);
    setTenant(null);
  };

  return (
    <AuthContext.Provider value={{ user, tenant, token, isLoading, requestOTP, verifyOTP, logout }}>
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
