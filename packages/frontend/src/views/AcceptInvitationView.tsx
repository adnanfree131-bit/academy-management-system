import { apiFetch } from '../lib/api-client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LogOut,
  Clock,
  Ban,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { InstitutionalLoader } from '../components/InstitutionalLoader';

interface InvitationDetails {
  tenant_name: string;
  tenant_slug: string;
  email: string;
  role: string;
  expires_at: string;
  is_valid: boolean;
}

interface AcceptInvitationViewProps {
  token: string;
  onComplete?: () => void;
}

export const AcceptInvitationView: React.FC<AcceptInvitationViewProps> = ({
  token,
  onComplete,
}) => {
  const {
    user,
    authenticatedIdentity,
    token: authToken,
    loginWithPassword,
    logout,
    refreshSession,
    selectTenant,
  } = useAuth();

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [inspectError, setInspectError] = useState<{ code: string; message: string } | null>(null);

  // Acceptance State
  const [isAccepting, setIsAccepting] = useState<boolean>(false);
  const [acceptSuccess, setAcceptSuccess] = useState<boolean>(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Auth Tabs (for unauthenticated users)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Inline Sign-In State
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  // Inline Sign-Up State
  const [signUpFullName, setSignUpFullName] = useState<string>('');
  const [signUpPassword, setSignUpPassword] = useState<string>('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState<string>('');
  const [isSigningUp, setIsSigningUp] = useState<boolean>(false);
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [signUpSuccessMessage, setSignUpSuccessMessage] = useState<string | null>(null);

  const fetchInspection = useCallback(async () => {
    if (!token) {
      setInspectError({ code: 'TOKEN_REQUIRED', message: 'No invitation token was provided.' });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setInspectError(null);

    try {
      const res = await apiFetch(`/api/v1/auth/invitations/${encodeURIComponent(token)}/inspect`);
      const data = await res.json();

      if (!res.ok) {
        setInspectError({
          code: data.error?.code || 'INSPECT_FAILED',
          message: data.error?.message || 'Failed to inspect invitation.',
        });
        setIsLoading(false);
        return;
      }

      setInvitation(data.data);
    } catch (err: any) {
      setInspectError({
        code: 'NETWORK_ERROR',
        message: err.message || 'Unable to connect to the academy server. Please check your network.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInspection();
  }, [fetchInspection]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation?.email) return;
    setSignInError(null);
    setIsSigningIn(true);

    try {
      const res = await loginWithPassword(invitation.email, passwordInput);
      if (!res.success) {
        setSignInError('Authentication failed. Please check your password.');
      }
    } catch (err: any) {
      setSignInError(err.message || 'Sign in failed. Please verify credentials.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation?.email) return;

    if (!signUpFullName.trim()) {
      setSignUpError('Please enter your full name.');
      return;
    }
    if (signUpPassword !== signUpConfirmPassword) {
      setSignUpError('Passwords do not match.');
      return;
    }
    if (signUpPassword.length < 8) {
      setSignUpError('Password must be at least 8 characters long.');
      return;
    }

    setSignUpError(null);
    setIsSigningUp(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: invitation.email,
        password: signUpPassword,
        options: {
          data: {
            display_name: signUpFullName.trim(),
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        // Direct session acquired -> trigger session bootstrap
        await refreshSession();
      } else {
        setSignUpSuccessMessage(
          `Confirmation email sent to ${invitation.email}. Please verify your email, then return here to claim your membership.`
        );
      }
    } catch (err: any) {
      setSignUpError(err.message || 'Account registration failed.');
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!token) return;
    setIsAccepting(true);
    setAcceptError(null);

    try {
      let activeToken = authToken;
      if (!activeToken) {
        const { data: { session } } = await supabase.auth.getSession();
        activeToken = session?.access_token || null;
      }

      if (!activeToken) {
        throw new Error('Authentication required. Please sign in before accepting this invitation.');
      }

      const res = await apiFetch('/api/v1/auth/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to accept invitation.');
      }

      setAcceptSuccess(true);
      await refreshSession();

      if (data.data?.tenant_id) {
        try {
          await selectTenant(data.data.tenant_id);
        } catch (selErr) {
          console.warn('[Invitation] selectTenant auto-switch note:', selErr);
        }
      }

      // Allow brief moment for user to see success, then transition to dashboard
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.hash = '#dashboard';
        }
        if (onComplete) {
          onComplete();
        }
      }, 1500);
    } catch (err: any) {
      setAcceptError(err.message || 'Failed to claim invitation.');
    } finally {
      setIsAccepting(false);
    }
  };

  const formatRoleLabel = (role: string) => {
    switch (role) {
      case 'tenant_admin': return 'Academy Administrator';
      case 'academic_head': return 'Academic Head / Coordinator';
      case 'teacher': return 'Teacher / Faculty';
      case 'finance_manager': return 'Accountant / Finance Manager';
      case 'student': return 'Student';
      case 'parent': return 'Parent / Guardian';
      default: return role;
    }
  };

  const handleReturnHome = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = '#dashboard';
    }
    if (onComplete) {
      onComplete();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <InstitutionalLoader variant="card" label="Verifying institutional invitation..." />
      </div>
    );
  }

  // Error States: Invalid, Expired, Revoked, or Already Accepted
  if (inspectError || !invitation) {
    const isRevoked = inspectError?.code === 'INVITATION_REVOKED';
    const isExpired = inspectError?.code === 'INVITATION_EXPIRED';
    const isAccepted = inspectError?.code === 'INVITATION_ALREADY_ACCEPTED';

    let errorTitle = 'Invalid Invitation Link';
    let errorDescription = inspectError?.message || 'This invitation link is unrecognized or has expired.';
    let IconComponent = AlertTriangle;

    if (isRevoked) {
      errorTitle = 'Invitation Revoked';
      errorDescription = 'This invitation was revoked by the academy administration and is no longer valid.';
      IconComponent = Ban;
    } else if (isExpired) {
      errorTitle = 'Invitation Expired';
      errorDescription = 'This invitation link has passed its expiration window. Please contact the academy administration to issue a new invitation.';
      IconComponent = Clock;
    } else if (isAccepted) {
      errorTitle = 'Invitation Already Accepted';
      errorDescription = 'This invitation has already been accepted and claimed into an active academy membership.';
      IconComponent = CheckCircle2;
    }

    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-slate-800">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 sm:p-8 space-y-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 mx-auto">
            <IconComponent className="w-6 h-6 text-slate-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">{errorTitle}</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {errorDescription}
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleReturnHome}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-black text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              Return to Central Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Acceptance Success State
  if (acceptSuccess) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-slate-800">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 sm:p-8 space-y-6 text-center animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">Welcome to {invitation.tenant_name}</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your invitation has been accepted. You are now an active member with the role of{' '}
              <span className="font-semibold text-slate-900">{formatRoleLabel(invitation.role)}</span>.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 font-mono">
            Redirecting to your dashboard...
          </div>
        </div>
      </div>
    );
  }

  // Valid Invitation Inspection View — Check authenticated identity
  const currentEmail = (authenticatedIdentity?.email || user?.email || '').toLowerCase().trim();
  const invitedEmail = (invitation.email || '').toLowerCase().trim();
  const isAuthenticated = Boolean(authenticatedIdentity || user);
  const isMatchingEmail = isAuthenticated && currentEmail === invitedEmail;
  const isMismatchedEmail = isAuthenticated && currentEmail !== invitedEmail;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-slate-800 font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 space-y-6">
        
        {/* Academy & Invitation Header */}
        <div className="flex items-center gap-3.5 border-b border-slate-100 pb-5">
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
              Academy Membership Invitation
            </div>
            <h1 className="text-lg font-bold text-slate-900 truncate">
              {invitation.tenant_name}
            </h1>
            <p className="text-xs text-slate-500 font-mono">
              {invitation.tenant_slug}.kampus.pk
            </p>
          </div>
        </div>

        {/* Invitation Role & Recipient Details */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs space-y-2">
          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Designated Role</span>
            <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {formatRoleLabel(invitation.role)}
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Invited Email</span>
            <span className="font-mono text-slate-800 font-semibold">{invitation.email}</span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 font-medium">Invitation Expiry</span>
            <span className="font-mono text-slate-600 text-[11px]">
              {new Date(invitation.expires_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* Acceptance Error Banner */}
        {acceptError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{acceptError}</span>
          </div>
        )}

        {/* STATE A: User is Authenticated with MATCHING Email (Finding C03) */}
        {isMatchingEmail && (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Authenticated as <span className="font-bold font-mono">{currentEmail}</span>. You are eligible to accept this invitation.
              </span>
            </div>

            <button
              type="button"
              disabled={isAccepting}
              onClick={handleAcceptInvitation}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:bg-black text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>{isAccepting ? 'Activating Membership...' : 'Accept Invitation & Join Academy'}</span>
            </button>
          </div>
        )}

        {/* STATE B: User is Authenticated with MISMATCHED Email */}
        {isMismatchedEmail && (
          <div className="space-y-4">
            <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Email Mismatch Advisory</span>
              </div>
              <p className="leading-relaxed">
                You are currently signed in as <span className="font-mono font-semibold">{currentEmail}</span>. This invitation was strictly issued to <span className="font-mono font-semibold">{invitation.email}</span>.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={logout}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out to Switch Account</span>
              </button>
              <button
                type="button"
                onClick={handleReturnHome}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* STATE C: User is Unauthenticated — Offer Sign In or Account Creation */}
        {!isAuthenticated && (
          <div className="space-y-4">
            <div className="flex border-b border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAuthMode('signin')}
                className={`flex-1 py-2 border-b-2 text-center transition-colors cursor-pointer ${
                  authMode === 'signin'
                    ? 'border-slate-900 text-slate-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign In to Existing Account
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-2 border-b-2 text-center transition-colors cursor-pointer ${
                  authMode === 'signup'
                    ? 'border-slate-900 text-slate-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Create New Account
              </button>
            </div>

            {authMode === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">Authentication Required</p>
                  <p>
                    Please sign in with your account password to verify ownership of{' '}
                    <span className="font-mono text-slate-900 font-semibold">{invitation.email}</span>.
                  </p>
                </div>

                {signInError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-medium">{signInError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    readOnly
                    disabled
                    value={invitation.email}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-600 select-all cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Account Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter your account password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSigningIn}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-black text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isSigningIn ? 'Signing In...' : 'Sign In to Accept Invitation'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">New User Account Setup</p>
                  <p>
                    Set up your login profile for{' '}
                    <span className="font-mono text-slate-900 font-semibold">{invitation.email}</span>.
                  </p>
                </div>

                {signUpSuccessMessage && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{signUpSuccessMessage}</span>
                  </div>
                )}

                {signUpError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-medium">{signUpError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Professor Sarah Khan"
                    value={signUpFullName}
                    onChange={(e) => setSignUpFullName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    readOnly
                    disabled
                    value={invitation.email}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-600 select-all cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Create Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Minimum 8 characters"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter password"
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSigningUp}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-black text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isSigningUp ? 'Creating Account...' : 'Create Account & Accept'}</span>
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
