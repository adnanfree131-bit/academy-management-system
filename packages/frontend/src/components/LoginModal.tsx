import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Mail, 
  ArrowRight, 
  RefreshCw, 
  ShieldCheck, 
  ArrowLeft,
  CheckCircle2,
  Lock,
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
  const currentCampusName = branding?.campus_name || 'Main Campus';
  const currentSession = branding?.academic_session || '2026–2027';

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-0 sm:p-6 lg:p-10 font-sans">
      <div className="w-full max-w-6xl bg-white sm:rounded-2xl shadow-xl sm:border sm:border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[660px]">
        
        {/* ================================================================ */}
        {/* LEFT COLUMN: INSTITUTIONAL SHOWCASE (5/12 cols)                  */}
        {/* ================================================================ */}
        <div className="hidden lg:flex lg:col-span-5 bg-slate-950 text-white p-10 flex-col justify-between relative overflow-hidden border-r border-slate-900">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30" />
          
          <div className="relative z-10">
            {/* Academy Crest & Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-white shadow-inner">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight text-white block leading-none">{currentAcademyName}</span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mt-1 block">Academy Management System</span>
              </div>
            </div>

            {/* Academic Information */}
            <div className="mt-14 space-y-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Session {currentSession} • {currentCampusName}</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white leading-tight">
                Academic Administration & Student Records
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Institutional portal for managing student admissions, academic batches, itemized fee challans, class attendance registers, and official examination results.
              </p>
            </div>

            {/* Core Modules List */}
            <div className="mt-8 space-y-3 text-xs text-slate-300">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Student Admissions & Student Profiles</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Classes, Batches & Academic Timetables</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Fee Ledger & 3-Part Bank Challans</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Daily Class Attendance & Examination Marksheets</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Institutional Portal</span>
            </span>
            <span>{branding?.domain || 'edu.toolnestr.com'}</span>
          </div>
        </div>

        {/* ================================================================ */}
        {/* RIGHT COLUMN: LOGIN & ONBOARDING FORM (7/12 cols)                */}
        {/* ================================================================ */}
        <div className="lg:col-span-7 bg-white p-8 sm:p-12 lg:p-12 flex flex-col justify-between min-h-[600px]">
          
          {/* Top Bar: Campus Badge & Mode Switcher */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="text-xs font-semibold text-slate-700">
              <span>{currentAcademyName}</span>
              <span className="text-slate-400 font-normal"> • {currentCampusName}</span>
            </div>

            {/* Mode Switcher */}
            {step === 'form' && (
              <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); setMessage(null); }}
                  className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(null); setMessage(null); }}
                  className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Register Academy</span>
                </button>
              </div>
            )}
          </div>

          {/* Form Content Area */}
          <div className="max-w-md w-full mx-auto my-auto py-4">
            
            {/* Form Headline */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {step === 'otp' 
                  ? 'Verification Code' 
                  : mode === 'login' 
                    ? 'Sign In' 
                    : 'Register Academy'}
              </h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {step === 'otp'
                  ? `Enter the 6-digit verification code dispatched to ${email}`
                  : mode === 'login'
                    ? 'Enter your institutional email to access your academy account.'
                    : 'Enter your academy details to create a new academy profile and administrator account.'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0"></span>
                <span>{error}</span>
              </div>
            )}

            {/* Notification / Dispatch Message */}
            {message && step === 'otp' && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {/* STEP 1A: SIGN IN FORM */}
            {step === 'form' && mode === 'login' && (
              <form onSubmit={handleRequestOTP} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-1 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Verification Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Request Verification Code</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <p className="text-[11px] text-slate-400">
                    New institution?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('register')}
                      className="text-slate-900 font-semibold underline hover:text-indigo-600 cursor-pointer"
                    >
                      Register your academy
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* STEP 1B: REGISTER ACADEMY FORM */}
            {step === 'form' && mode === 'register' && (
              <form onSubmit={handleRegisterAcademy} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Academy Name
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                    autoFocus
                    className="w-full px-3.5 py-2 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
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
                      required
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
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
                      required
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !regName.trim() || !regEmail.trim()}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Academy Profile...</span>
                    </>
                  ) : (
                    <>
                      <span>Register Academy & Send Code</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-xs text-slate-500 hover:text-slate-900 font-medium cursor-pointer"
                  >
                    Already registered? <strong className="text-slate-900 underline">Sign In</strong>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: VERIFICATION CODE SCREEN */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 text-center">
                    6-Digit Verification Code
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      required
                      autoFocus
                      className="w-full text-center tracking-[0.5em] text-xl font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg py-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying Passcode...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Sign In</span>
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
                    Back to email
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

          {/* Clean Institutional Footer */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>© 2026 {currentAcademyName}</span>
            <div className="flex items-center gap-3">
              <span>Academic Session {currentSession}</span>
              <span>•</span>
              <span>Support: edu@toolnestr.com</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
