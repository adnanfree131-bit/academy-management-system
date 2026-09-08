import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Mail, 
  ArrowRight, 
  RefreshCw, 
  ShieldCheck, 
  ArrowLeft,
  GraduationCap,
  User,
  PlusCircle,
  LogIn
} from 'lucide-react';

interface AcademyBranding {
  name: string;
  slug: string;
  campus_name: string;
  academic_session: string;
  domain: string;
}

export const LoginModal: React.FC = () => {
  const { requestOTP, verifyOTP } = useAuth();

  // Mode & Steps
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<'form' | 'otp'>('form');

  // Login Form (empty, zero prefilled text)
  const [tenantSlug, setTenantSlug] = useState<string>('apex');
  const [email, setEmail] = useState<string>('');
  const [otp, setOtp] = useState<string>('');

  // Registration Form (empty, zero prefilled text)
  const [regName, setRegName] = useState<string>('');
  const [regAdminName, setRegAdminName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');

  // Branding & Feedback State
  const [branding, setBranding] = useState<AcademyBranding | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Initialize slug from URL params or subdomain
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const campusParam = params.get('campus');
    if (campusParam) {
      setTenantSlug(campusParam.toLowerCase().trim());
    } else {
      const hostname = window.location.hostname.toLowerCase();
      if (hostname.endsWith('.toolnestr.com') && !hostname.startsWith('edu.') && !hostname.startsWith('www.')) {
        const sub = hostname.replace('.toolnestr.com', '');
        if (sub && sub !== 'edu' && sub !== 'www') {
          setTenantSlug(sub);
        }
      }
    }
  }, []);

  // Fetch dynamic branding whenever tenantSlug changes in login mode
  useEffect(() => {
    if (!tenantSlug.trim()) return;
    const fetchBranding = async () => {
      try {
        const res = await fetch(`/api/v1/auth/branding?slug=${encodeURIComponent(tenantSlug.trim())}`);
        if (res.ok) {
          const body = await res.json();
          if (body.data) {
            setBranding(body.data);
          }
        }
      } catch {
        // Retain default branding on error
      }
    };
    const timer = setTimeout(fetchBranding, 300);
    return () => clearTimeout(timer);
  }, [tenantSlug]);

  // Handle Login OTP Request
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const res = await requestOTP(email.trim(), tenantSlug.trim() || 'apex');
      setMessage(res.message);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Academy Registration
  const handleRegisterAcademy = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const derivedSlug = regName.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'academy';

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          slug: derivedSlug,
          campus_name: 'Main Campus',
          admin_name: regAdminName.trim() || 'Administrator',
          admin_email: regEmail.trim().toLowerCase(),
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error?.message || 'Failed to register academy.');
      }

      setTenantSlug(body.data.tenant.slug);
      setEmail(body.data.admin.email);
      setMessage(body.data.message || `Verification code sent to ${body.data.admin.email}`);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to register academy.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setError(null);
    setLoading(true);

    try {
      await verifyOTP(email.trim(), otp.trim(), tenantSlug.trim() || 'apex');
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check your passcode.');
    } finally {
      setLoading(false);
    }
  };

  const currentAcademyName = branding?.name || 'Apex Academy';
  const currentSession = branding?.academic_session || '2026–2027';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        
        {/* Institutional Header */}
        <div className="p-6 pb-4 border-b border-slate-100 text-center bg-slate-50/50">
          <div className="w-11 h-11 mx-auto mb-3 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
            <GraduationCap className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            {currentAcademyName}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Academy Management System
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-[11px] font-mono text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Session {currentSession}</span>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        {step === 'form' && (
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setMessage(null); }}
              className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'border-slate-900 text-slate-900 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); setMessage(null); }}
              className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'border-slate-900 text-slate-900 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Register Academy</span>
            </button>
          </div>
        )}

        {/* Card Body */}
        <div className="p-6">
          {/* Error Notice */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0"></span>
              <span>{error}</span>
            </div>
          )}

          {/* Success / Status Notice */}
          {message && step === 'otp' && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
              <span>{message}</span>
            </div>
          )}

          {/* STEP 1A: SIGN IN */}
          {step === 'form' && mode === 'login' && (
            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Request Verification Code</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 1B: REGISTER ACADEMY */}
          {step === 'form' && mode === 'register' && (
            <form onSubmit={handleRegisterAcademy} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Academy Name
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Enter academy name"
                  required
                  autoFocus
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrator Name
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={regAdminName}
                    onChange={(e) => setRegAdminName(e.target.value)}
                    placeholder="Enter administrator name"
                    required
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrator Email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="Enter administrator email"
                    required
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !regName.trim() || !regEmail.trim()}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer mt-1"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating Academy...</span>
                  </>
                ) : (
                  <>
                    <span>Register Academy</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: VERIFICATION CODE */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 text-center">
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="------"
                  required
                  autoFocus
                  className="w-full text-center tracking-[0.5em] text-2xl font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg py-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                />
                <p className="text-[11px] text-slate-400 text-center mt-1.5">
                  Code dispatched to <span className="font-medium text-slate-700">{email}</span>
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs pt-1 text-slate-500">
                <button
                  type="button"
                  onClick={() => { setStep('form'); setOtp(''); }}
                  className="text-slate-600 hover:text-slate-900 text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleRequestOTP}
                  disabled={loading}
                  className="text-slate-900 font-semibold hover:underline text-[11px] cursor-pointer"
                >
                  Resend Code
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Institutional Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-400">
          <span>Institutional Portal • edu.toolnestr.com</span>
        </div>

      </div>
    </div>
  );
};
