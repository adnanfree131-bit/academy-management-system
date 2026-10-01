import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { TenantSettings, AcademicSession, OnboardTenantPayload, RegisterAcademyPayload } from '@apex/shared-types';
import { supabase } from '../lib/supabase';
import { resolveHostInfo, HostInfo } from '../lib/host';
import { TenantMembershipSummary } from '../components/TenantSelectorModal';

export type { OnboardTenantPayload, RegisterAcademyPayload };

export interface UserSession {
  id: string;
  tenant_id: string;
  auth_user_id?: string;
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

export type MembershipState =
  | 'ready'
  | 'no_memberships'
  | 'tenant_selection_required'
  | 'unauthorized_for_branded_host'
  | 'platform_superadmin'
  | 'unmapped_host';

export interface AuthenticatedIdentity {
  id: string;
  email: string;
  displayName?: string;
  platformRole?: string;
}

interface AuthContextType {
  user: UserSession | null;
  tenant: TenantSession | null;
  token: string | null;
  authenticatedIdentity: AuthenticatedIdentity | null;
  isLoading: boolean;
  working_session: string;
  memberships: TenantMembershipSummary[];
  activeTenantId: string | null;
  membershipState: MembershipState;
  isBrandedHost: boolean;
  hostTenantSlug: string | null;
  isHostUnmapped: boolean;
  resolvedTenantSlug: string | null;
  resolvedTenantId: string | null;
  resolvedTenantName: string | null;
  isPasswordRecovery: boolean;
  setIsPasswordRecovery: (val: boolean) => void;
  setWorkingSession: (name: string) => Promise<void>;
  selectTenant: (tenantId: string) => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  loginWithPassword: (email: string, password: string, tenantSlug?: string) => Promise<{ success: boolean }>;
  registerAcademy: (payload: RegisterAcademyPayload) => Promise<{ success: boolean; message: string; tenant: any; admin: any }>;
  onboardAcademy: (payload: {
    name: string;
    slug: string;
    campus_name?: string;
    city?: string;
    phone?: string;
    logo_url?: string;
  }) => Promise<{ success: boolean; tenant: any; admin: any; message?: string; domain_provisioning?: any }>;
  applySession: (sessionData: any) => void;
  forgotPassword: (email: string, tenantSlug?: string) => Promise<{ success: boolean; message: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; message: string }>;
  enrollMfa: () => Promise<{ factorId: string; qrCode: string; secret: string }>;
  verifyMfa: (factorId: string, code: string) => Promise<boolean>;
  unenrollMfa: (factorId: string) => Promise<boolean>;
  listMfaFactors: () => Promise<any[]>;
  logout: () => void;
  refreshSession: () => Promise<void>;
}

import { apiFetch, setApiContext } from '../lib/api-client';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [tenant, setTenant] = useState<TenantSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authenticatedIdentity, setAuthenticatedIdentity] = useState<AuthenticatedIdentity | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [memberships, setMemberships] = useState<TenantMembershipSummary[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('apex_active_tenant_id') : null;
  });
  const [membershipState, setMembershipState] = useState<MembershipState>('ready');
  const [isHostUnmapped, setIsHostUnmapped] = useState<boolean>(false);
  const [resolvedTenantSlug, setResolvedTenantSlug] = useState<string | null>(null);
  const [resolvedTenantId, setResolvedTenantId] = useState<string | null>(null);
  const [resolvedTenantName, setResolvedTenantName] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.hash.includes('reset-password') || window.location.hash.includes('type=recovery');
  });

  const userRef = useRef<UserSession | null>(null);
  userRef.current = user;

  const membershipsRef = useRef<TenantMembershipSummary[]>([]);
  membershipsRef.current = memberships;

  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  const isBootstrappingRef = useRef<boolean>(false);
  const bootstrappedTokenRef = useRef<string | null>(null);

  const resolvedTenantIdRef = useRef<string | null>(null);
  const resolvedTenantSlugRef = useRef<string | null>(null);
  const hostResolutionPromiseRef = useRef<Promise<{
    tenantId: string | null;
    slug: string | null;
    name: string | null;
    isUnmapped: boolean;
  } | null> | null>(null);

  const hostInfoRef = useRef<HostInfo>(resolveHostInfo());
  const hostInfo = hostInfoRef.current;

  const updateTokensAndTenant = (newToken: string | null, newTenantId: string | null) => {
    setToken(newToken);
    setActiveTenantId(newTenantId);
    setApiContext({ token: newToken, tenantId: newTenantId });
    if (newTenantId) {
      localStorage.setItem('apex_active_tenant_id', newTenantId);
    } else {
      localStorage.removeItem('apex_active_tenant_id');
    }
  };

  /**
   * Load active tenant context and permissions via /api/v1/auth/me
   */
  const loadTenantProfile = useCallback(async (tenantId: string, accessToken: string) => {
    try {
      const res = await apiFetch('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Tenant-ID': tenantId,
        },
      });

      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          // Membership suspended or revoked
          console.warn('[Auth] Tenant access denied for tenantId:', tenantId);
          setMembershipState('tenant_selection_required');
          setUser(null);
          setTenant(null);
          return;
        }
        throw new Error(`Failed to load tenant profile (HTTP ${res.status})`);
      }

      const body = await res.json();
      const u = body.data?.user;
      const t = body.data?.tenant;

      if (!u || !t) {
        throw new Error('Invalid /me response: missing user or tenant payload');
      }

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
        logo_url: t.logo_url || t.settings?.logo_url || null,
        phone: t.phone || t.settings?.phone || null,
        city: t.city || t.settings?.city || null,
        domain: t.domain || null,
        settings: t.settings || null,
      });

      updateTokensAndTenant(accessToken, tenantId);
      setMembershipState('ready');
    } catch (err) {
      console.error('[Auth] loadTenantProfile error:', err);
      setMembershipState('tenant_selection_required');
    }
  }, []);

  // Resolve host canonical mapping on mount for branded hosts (Finding B07, B09, B10, D01)
  const resolveHostCanonical = useCallback(async () => {
    if (!hostInfo.isBrandedHost) return null;
    try {
      const queryHost = hostInfo.hostname || (typeof window !== 'undefined' ? window.location.hostname : '');
      const res = await apiFetch(`/api/v1/auth/resolve-host?host=${encodeURIComponent(queryHost)}`);

      if (res.status === 404) {
        const body = await res.json().catch(() => null);
        if (body?.error?.code === 'UNMAPPED_HOST') {
          setIsHostUnmapped(true);
          setMembershipState('unmapped_host');
          setUser(null);
          setTenant(null);
          return { tenantId: null, slug: null, name: null, isUnmapped: true };
        }
        return null;
      }

      if (res.ok) {
        const body = await res.json();
        if (body?.data) {
          const tenantId = body.data.tenant_id || null;
          const slug = body.data.slug || null;
          const name = body.data.name || null;
          resolvedTenantIdRef.current = tenantId;
          resolvedTenantSlugRef.current = slug;
          setResolvedTenantId(tenantId);
          setResolvedTenantSlug(slug);
          setResolvedTenantName(name);
          setIsHostUnmapped(false);

          // If session was already bootstrapped and memberships exist, re-evaluate branded host membership (D01)
          if (membershipsRef.current.length > 0 && tokenRef.current) {
            const currentMemberships = membershipsRef.current;
            const currentToken = tokenRef.current;
            const matchingMembership = currentMemberships.find(m => {
              if (tenantId && m.tenant_id === tenantId) return true;
              if (slug && m.tenant_slug.toLowerCase() === slug.toLowerCase()) return true;
              return false;
            });

            if (matchingMembership) {
              await loadTenantProfile(matchingMembership.tenant_id, currentToken);
              setMembershipState('ready');
            } else {
              setMembershipState('unauthorized_for_branded_host');
              setUser(null);
              setTenant(null);
            }
          }

          return { tenantId, slug, name, isUnmapped: false };
        }
      }
    } catch (err) {
      console.warn('[Auth] Host resolution network error:', err);
    }
    return null;
  }, [hostInfo.isBrandedHost, hostInfo.hostname, loadTenantProfile]);

  useEffect(() => {
    if (!hostInfo.isBrandedHost) return;
    hostResolutionPromiseRef.current = resolveHostCanonical();
  }, [hostInfo.isBrandedHost, resolveHostCanonical]);

  /**
   * Bootstrap Supabase user: call /api/v1/auth/session to resolve identity profile and memberships
   */
  const bootstrapSession = useCallback(async (accessToken: string) => {
    if (isBootstrappingRef.current) return;
    isBootstrappingRef.current = true;
    bootstrappedTokenRef.current = accessToken;

    setToken(accessToken);
    setApiContext({ token: accessToken });

    try {
      const res = await apiFetch('/api/v1/auth/session', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        console.warn('[Auth] /session bootstrap returned status:', res.status);
        if (res.status === 404) {
          const body = await res.json().catch(() => null);
          if (body?.error?.code === 'UNMAPPED_HOST') {
            setIsHostUnmapped(true);
            setMembershipState('unmapped_host');
            setUser(null);
            setTenant(null);
            setIsLoading(false);
            return;
          }
        }
        if (res.status === 401 || res.status === 403) {
          // Account suspended or revoked
          logout();
          return;
        }
        setIsLoading(false);
        return;
      }

      const body = await res.json();
      const profile = body.data?.profile;
      if (profile) {
        setAuthenticatedIdentity({
          id: profile.id,
          email: profile.email,
          displayName: profile.display_name,
          platformRole: profile.platform_role,
        });
      }

      const rawMemberships: any[] = body.data?.memberships || [];
      const normalizedMemberships: TenantMembershipSummary[] = rawMemberships.map((m: any) => ({
        membership_id: m.membership_id || m.id,
        tenant_id: m.tenant_id,
        tenant_name: m.tenant_name || 'Academy',
        tenant_slug: m.tenant_slug || 'academy',
        role: m.role || 'staff',
        campus_name: m.campus_name || null,
        city: m.city || null,
        logo_url: m.logo_url || null,
        is_active: m.is_active ?? (m.status === 'active'),
        status: m.status || 'active',
      })).filter(m => m.is_active && m.status === 'active');

      setMemberships(normalizedMemberships);

      // PLATFORM SUPERADMIN DIRECT ENTRY GUARD (Finding B08)
      if (profile?.platform_role === 'super_admin') {
        const storedId = localStorage.getItem('apex_active_tenant_id');
        const validStoredMembership = storedId
          ? normalizedMemberships.find(m => m.tenant_id === storedId)
          : null;

        if (validStoredMembership) {
          await loadTenantProfile(validStoredMembership.tenant_id, accessToken);
          setIsLoading(false);
          return;
        }

        setUser({
          id: profile.id,
          tenant_id: '',
          auth_user_id: profile.id,
          email: profile.email,
          full_name: profile.display_name || 'Platform Superadmin',
          role: 'super_admin',
          permissions: ['all'],
          access: {},
          working_session: '2026-2027',
        });
        setTenant(null);
        setMembershipState('platform_superadmin');
        updateTokensAndTenant(accessToken, null);
        setIsLoading(false);
        return;
      }

      // Handle Host & Multi-tenancy boundaries (Finding B07, B09, D01)
      if (hostInfo.isBrandedHost) {
        let targetSlug = resolvedTenantSlugRef.current || resolvedTenantSlug;
        let targetId = resolvedTenantIdRef.current || resolvedTenantId;

        // Coordinate with in-flight canonical host resolution if not yet resolved (D01)
        if (!targetId && !targetSlug && hostResolutionPromiseRef.current) {
          const resolved = await hostResolutionPromiseRef.current;
          if (resolved?.isUnmapped) {
            setIsLoading(false);
            return;
          }
          if (resolved) {
            targetId = resolved.tenantId;
            targetSlug = resolved.slug;
          }
        }

        // If targetId/targetSlug are still missing and it is not a custom domain, fall back to hostInfo.tenantSlug
        if (!targetSlug && !hostInfo.isCustomDomain) {
          targetSlug = hostInfo.tenantSlug;
        }

        // Branded Host mode: strictly lock to this host's tenant by resolved canonical slug or tenant_id
        const matchingMembership = normalizedMemberships.find(m => {
          if (targetId && m.tenant_id === targetId) return true;
          if (targetSlug && m.tenant_slug.toLowerCase() === targetSlug.toLowerCase()) return true;
          return false;
        });

        if (!matchingMembership) {
          // If host resolution is somehow still pending on a custom domain, do NOT prematurely deny
          if (!targetId && !targetSlug && hostInfo.isCustomDomain) {
            setIsLoading(true);
            return;
          }
          // Signed-in identity is definitively not a member of this branded academy
          setMembershipState('unauthorized_for_branded_host');
          setUser(null);
          setTenant(null);
          setIsLoading(false);
          return;
        }

        // Lock to this branded tenant
        await loadTenantProfile(matchingMembership.tenant_id, accessToken);
        setIsLoading(false);
        return;
      }

      // Central Platform mode: app.kampus.pk / localhost
      if (normalizedMemberships.length === 0) {
        // Check for pending onboarding draft (Finding B04)
        const draftRaw = typeof window !== 'undefined' ? localStorage.getItem('apex_pending_onboarding_draft') : null;
        if (draftRaw) {
          try {
            const draft = JSON.parse(draftRaw);
            const userEmail = (profile?.email || '').toLowerCase().trim();
            const draftEmail = (draft?.email || '').toLowerCase().trim();
            if (draft?.payload && (!draftEmail || !userEmail || draftEmail === userEmail)) {
              const onboardRes = await apiFetch('/api/v1/auth/onboard-tenant', {
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
                isBootstrappingRef.current = false;
                return await bootstrapSession(accessToken);
              } else {
                console.warn('[Auth] Resuming pending onboarding draft failed:', onboardBody?.error);
              }
            }
          } catch (draftErr) {
            console.error('[Auth] Error parsing onboarding draft:', draftErr);
          }
        }

        setMembershipState('no_memberships');
        setUser(null);
        setTenant(null);
        setIsLoading(false);
        return;
      }

      if (normalizedMemberships.length === 1) {
        // Automatically select the single active membership
        await loadTenantProfile(normalizedMemberships[0].tenant_id, accessToken);
        setIsLoading(false);
        return;
      }

      // Multiple memberships: check stored preference or prompt selection
      const storedId = localStorage.getItem('apex_active_tenant_id');
      const validStoredMembership = storedId
        ? normalizedMemberships.find(m => m.tenant_id === storedId)
        : null;

      if (validStoredMembership) {
        await loadTenantProfile(validStoredMembership.tenant_id, accessToken);
      } else {
        setMembershipState('tenant_selection_required');
      }
    } catch (err) {
      console.error('[Auth] Session bootstrap error:', err);
    } finally {
      isBootstrappingRef.current = false;
      setIsLoading(false);
    }
  }, [hostInfo, loadTenantProfile]);

  /**
   * Initialize Supabase Auth state listener
   */
  useEffect(() => {
    let mounted = true;

    // 1. Check existing session on boot
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      if (error || !session) {
        setIsLoading(false);
        return;
      }
      if (session.access_token && session.access_token !== bootstrappedTokenRef.current) {
        bootstrapSession(session.access_token);
      } else {
        setIsLoading(false);
      }
    }).catch(err => {
      console.error('[Auth] Failed to get session:', err);
      if (mounted) setIsLoading(false);
    });

    // 2. Subscribe to auth events (sign-in, token refresh, sign-out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        bootstrappedTokenRef.current = null;
        setApiContext({ token: null, tenantId: null });
        localStorage.removeItem('apex_active_tenant_id');
        localStorage.removeItem('apex_active_screen');
        localStorage.removeItem('apex_staff_attendance_tab');
        localStorage.removeItem('kampus.working_session');
        setToken(null);
        setUser(null);
        setTenant(null);
        setAuthenticatedIdentity(null);
        setMemberships([]);
        setMembershipState('ready');
        setIsPasswordRecovery(false);
        setIsLoading(false);
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        if (session) {
          setToken(session.access_token);
          setApiContext({ token: session.access_token });
        }
        setIsLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setToken(session.access_token);
        setApiContext({ token: session.access_token });
        // Only run full bootstrap if token is fresh or user profile not loaded
        if (session.access_token !== bootstrappedTokenRef.current || !userRef.current) {
          await bootstrapSession(session.access_token);
        }
      }
    });

    const handleHashChange = () => {
      if (typeof window !== 'undefined' && (window.location.hash.includes('reset-password') || window.location.hash.includes('type=recovery'))) {
        setIsPasswordRecovery(true);
      }
    };
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [bootstrapSession]);

  /**
   * Select and activate an academy workspace
   */
  const selectTenant = async (tenantId: string) => {
    const activeToken = token || (await supabase.auth.getSession()).data.session?.access_token;
    if (!activeToken) throw new Error('Not authenticated.');

    setIsLoading(true);
    try {
      await loadTenantProfile(tenantId, activeToken);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Switch between academies (disallowed on branded hosts)
   */
  const switchTenant = async (tenantId: string) => {
    if (hostInfo.isBrandedHost) {
      throw new Error('Workspace switching is not permitted on a campus-specific domain.');
    }
    await selectTenant(tenantId);
  };

  /**
   * Daily Operational Sign In through Supabase Auth
   */
  const loginWithPassword = async (email: string, password: string, _tenantSlug?: string) => {
    setErrorState: {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw new Error(error.message || 'Invalid email or password.');
      }

      if (data?.session) {
        await bootstrapSession(data.session.access_token);
      }
      return { success: true };
    }
  };

  /**
   * Password Recovery Flow via Supabase Auth
   */
  const forgotPassword = async (email: string, _tenantSlug?: string) => {
    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/#reset-password`
      : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });

    if (error) {
      throw new Error(error.message || 'Failed to send password recovery email.');
    }

    return {
      success: true,
      message: 'Password recovery email sent. Please check your inbox.',
    };
  };



  /**
   * Sign Out through Supabase Auth
   */
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[Auth] Error during Supabase signOut:', err);
    } finally {
      updateTokensAndTenant(null, null);
      localStorage.removeItem('apex_active_screen');
      localStorage.removeItem('apex_staff_attendance_tab');
      localStorage.removeItem('kampus.working_session');
      if (typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      setUser(null);
      setTenant(null);
      setMemberships([]);
      setMembershipState('ready');
      setIsPasswordRecovery(false);
    }
  };

  /**
   * Re-verify session and active tenant
   */
  const refreshSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      if (activeTenantId) {
        await loadTenantProfile(activeTenantId, session.access_token);
      } else {
        await bootstrapSession(session.access_token);
      }
    }
  };

  /**
   * Update working academic session
   */
  const setWorkingSession = async (name: string) => {
    if (!token || !user) return;
    if (user.role === 'student' || user.role === 'parent') return;

    const res = await apiFetch('/api/v1/academic/working-session', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Kampus-Session': name,
      },
      body: JSON.stringify({ academic_session: name }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error?.message || 'Failed to update working academic session.');
    }

    const body = await res.json();
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

  // Account Registration & Atomic Onboarding through Supabase Auth
  const registerAcademy = async (payload: RegisterAcademyPayload) => {
    const cleanSlug = payload.slug.trim().toLowerCase();
    const onboardingPayload: OnboardTenantPayload = {
      name: payload.name.trim(),
      slug: cleanSlug,
      campus_name: payload.campus_name?.trim() || 'Main Campus',
      city: payload.city?.trim() || undefined,
      phone: payload.phone?.trim() || undefined,
      logo_url: payload.logo_url?.trim() || undefined,
    };

    // 1. Create identity via Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: payload.admin_email.trim(),
      password: payload.password,
      options: {
        data: {
          full_name: payload.admin_name.trim(),
          pending_tenant: onboardingPayload,
        },
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/#onboarding-confirmed` : undefined,
      },
    });

    if (signUpError) {
      throw new Error(signUpError.message || 'Failed to create user account.');
    }

    if (!signUpData.session) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('apex_pending_onboarding_draft', JSON.stringify({
          payload: onboardingPayload,
          email: payload.admin_email.trim().toLowerCase(),
          timestamp: Date.now(),
        }));
      }

      return {
        success: true,
        message: 'Account created. Please confirm your email address before continuing.',
        tenant: null,
        admin: null,
      };
    }

    // 2. Execute transactional onboarding on backend
    const res = await apiFetch('/api/v1/auth/onboard-tenant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${signUpData.session.access_token}`,
      },
      body: JSON.stringify(onboardingPayload),
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      throw new Error(body?.error?.message || 'Failed to complete academy setup.');
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('apex_pending_onboarding_draft');
    }

    await bootstrapSession(signUpData.session.access_token);
    return {
      success: true,
      message: 'Academy onboarded successfully.',
      tenant: body.data.tenant,
      admin: body.data.membership,
    };
  };

  /**
   * Onboard a new academy for an existing authenticated identity (Finding D02)
   * Strictly uses the active authenticated session to call /api/v1/auth/onboard-tenant.
   * Zero calls to supabase.auth.signUp.
   */
  const onboardAcademy = async (payload: {
    name: string;
    slug: string;
    campus_name?: string;
    city?: string;
    phone?: string;
    logo_url?: string;
  }) => {
    const activeToken = token || (await supabase.auth.getSession()).data.session?.access_token;
    if (!activeToken) {
      throw new Error('Authenticated session not found. Please sign in again.');
    }

    const res = await apiFetch('/api/v1/auth/onboard-tenant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
      },
      body: JSON.stringify({
        name: payload.name.trim(),
        slug: payload.slug.trim().toLowerCase(),
        campus_name: payload.campus_name?.trim() || undefined,
        city: payload.city?.trim() || undefined,
        phone: payload.phone?.trim() || undefined,
        logo_url: payload.logo_url?.trim() || undefined,
      }),
    });

    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) {
      throw new Error(body?.error?.message || `Failed to set up academy (HTTP ${res.status}).`);
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('apex_pending_onboarding_draft');
    }

    // Refresh bootstrap session so the newly created membership is loaded into state
    isBootstrappingRef.current = false;
    bootstrappedTokenRef.current = null;
    await bootstrapSession(activeToken);

    return {
      success: true,
      message: 'Academy onboarded successfully.',
      tenant: body.data?.tenant,
      admin: body.data?.membership || body.data?.admin,
      domain_provisioning: body.data?.domain_provisioning,
    };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      throw new Error(error.message || 'Failed to update password.');
    }
    return {
      success: true,
      message: 'Password updated successfully.',
    };
  };

  const enrollMfa = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
    });
    if (error || !data) {
      throw new Error(error?.message || 'Failed to enroll MFA factor.');
    }
    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    };
  };

  const verifyMfa = async (factorId: string, code: string) => {
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError || !challengeData) {
      throw new Error(challengeError?.message || 'Failed to create MFA challenge.');
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: code.trim(),
    });
    if (verifyError) {
      throw new Error(verifyError.message || 'Invalid MFA verification code.');
    }
    return true;
  };

  const unenrollMfa = async (factorId: string) => {
    const { error } = await supabase.auth.mfa.unenroll({
      factorId,
    });
    if (error) {
      throw new Error(error.message || 'Failed to unenroll MFA factor.');
    }
    return true;
  };

  const listMfaFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return [];
    return data?.totp || [];
  };

  const applySession = (sessionData: any) => {
    if (!sessionData) return;
    if (sessionData.token) {
      setToken(sessionData.token);
      setApiContext({ token: sessionData.token });
    }
    if (sessionData.tenant?.id) {
      setActiveTenantId(sessionData.tenant.id);
      setApiContext({ tenantId: sessionData.tenant.id });
      localStorage.setItem('apex_active_tenant_id', sessionData.tenant.id);
    }
    if (sessionData.user) setUser(sessionData.user);
    if (sessionData.tenant) setTenant(sessionData.tenant);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        authenticatedIdentity,
        isLoading,
        working_session: user?.working_session || tenant?.academic_session || '2026-2027',
        memberships,
        activeTenantId,
        membershipState,
        isBrandedHost: hostInfo.isBrandedHost,
        hostTenantSlug: resolvedTenantSlug || hostInfo.tenantSlug,
        isHostUnmapped,
        resolvedTenantSlug,
        resolvedTenantId,
        resolvedTenantName,
        isPasswordRecovery,
        setIsPasswordRecovery,
        setWorkingSession,
        selectTenant,
        switchTenant,
        loginWithPassword,
        registerAcademy,
        onboardAcademy,
        applySession,
        forgotPassword,
        updatePassword,
        enrollMfa,
        verifyMfa,
        unenrollMfa,
        listMfaFactors,
        logout,
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
