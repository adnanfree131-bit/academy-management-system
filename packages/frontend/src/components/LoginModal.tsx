import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Mail, 
  ArrowRight, 
  RefreshCw, 
  Building2, 
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

  // Login Form
  const [tenantSlug, setTenantSlug] = useState<string>('apex');
  const [email, setEmail] = useState<string>('admin@apex.edu.pk');
  const [otp, setOtp] = useState<string>('');
  const [devOtp, setDevOtp] = useState<string | undefined>(undefined);

  // Registration Form
  const [regName, setRegName] = useState<string>('');
  const [regSlug, setRegSlug] = useState<string>('');
  const [regCampus, setRegCampus] = useState<string>('Main Campus');
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
      // Check subdomain (e.g. crescent.edu.toolnestr.com)
      const hostParts = window.location.hostname.split('.');
      if (hostParts.length > 2 && !['www', 'edu', 'academy', 'localhost'].includes(hostParts[0])) {
        setTenantSlug(hostParts[0].toLowerCase());
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
        // Fallback gracefully to default branding
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
      if (res.dev_otp) {
        setDevOtp(res.dev_otp);
      }
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

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          slug: regSlug.trim().toLowerCase(),
          campus_name: regCampus.trim() || 'Main Campus',
          admin_name: regAdminName.trim(),
          admin_email: regEmail.trim().toLowerCase(),
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error?.message || 'Failed to register academy.');
      }

      setTenantSlug(body.data.tenant.slug);
      setEmail(body.data.admin.email);
      if (body.data.otp_preview) {
        setDevOtp(body.data.otp_preview);
      }
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

  const currentAcademyName = branding?.name || (tenantSlug === 'apex' ? 'Apex Academy' : `${tenantSlug.toUpperCase()} Academy`);
  const currentCampusName = branding?.campus_name || 'Main Campus';
  const currentSession = branding?.academic_session || 'Session 2026–2027';

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-0 sm:p-6 lg:p-10 font-sans">
      <div className="w-full max-w-6xl bg-white sm:rounded-2xl shadow-xl sm:border sm:border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[660px]">
        
        {/* ================================================================ */}
        {/* LEFT COLUMN: INSTITUTIONAL SHOWCASE & BRANDING (5/12 cols)       */}
        {/* ================================================================ */}
        <div className="hidden lg:flex lg:col-span-5 bg-slate-950 text-white p-10 flex-col justify-between relative overflow-hidden border-r border-slate-900">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30" />
          
          <div className="relative z-10">
            {/* Dynamic Institution Brand Crest */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-white shadow-inner">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight text-white block leading-none">{currentAcademyName}</span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mt-1 block">Campus Management ERP</span>
              </div>
            </div>

            {/* Editorial Statement */}
            <div className="mt-14 space-y-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>{currentSession} • {currentCampusName}</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white leading-tight">
                Enterprise Academic Administration & Student Information System.
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Centralized academic structure, itemized fee invoicing, attendance tracking, and comprehensive examination results engineered for institutions of scale.
              </p>
            </div>

            {/* Verified Capabilities */}
            <div className="mt-8 space-y-3 text-xs text-slate-300">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Multi-Campus Academic Structure & Batches</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Multi-Head Fee Ledgers & Automated Challans</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Daily Class Attendance & Absentee Retention</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Brevo Transactional Verification & Subdomains</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>256-Bit Encrypted Session</span>
            </span>
            <span>Domain: {branding?.domain || 'edu.toolnestr.com'}</span>
          </div>
        </div>

        {/* ================================================================ */}
        {/* RIGHT COLUMN: AUTHENTICATION & ONBOARDING CONSOLE (7/12 cols)     */}
        {/* ================================================================ */}
        <div className="lg:col-span-7 bg-white p-8 sm:p-12 lg:p-12 flex flex-col justify-between min-h-[600px]">
          
          {/* Top Bar: Operational Status & Mode Switcher */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>All Systems Operational</span>
            </div>

            {/* Mode Switcher Tabs */}
            {step === 'form' && (
              <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); setMessage(null); }}
                  className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                    mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(null); setMessage(null); }}
                  className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
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
                  ? 'Two-Factor Verification' 
                  : mode === 'login' 
                    ? `Sign In to ${currentAcademyName}` 
                    : 'Register New Academy'}
              </h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {step === 'otp'
                  ? `Enter the 6-digit verification code dispatched to ${email}`
                  : mode === 'login'
                    ? 'Enter your institutional credentials to access your administrative console.'
                    : 'Create your dedicated academy workspace, custom subdomain, and administrator profile.'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2 animate-in fade-in">
                <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0"></span>
                <span>{error}</span>
              </div>
            )}

            {/* Notification / Dispatch Message */}
            {message && step === 'otp' && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium animate-in fade-in flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {/* STEP 1A: LOGIN FORM */}
            {step === 'form' && mode === 'login' && (
              <form onSubmit={handleRequestOTP} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Campus Identifier / Slug
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      type="text"
                      value={tenantSlug}
                      onChange={(e) => setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="apex"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all font-mono"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Workspace: {tenantSlug ? `${tenantSlug}.toolnestr.com` : 'edu.toolnestr.com'}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Institutional Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@apex.edu.pk"
                      required
                      autoFocus
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
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
                      <span>Dispatching Code via Brevo...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue with Verification Code</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <p className="text-[11px] text-slate-400">
                    Need a new academy?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('register')}
                      className="text-slate-900 font-semibold underline hover:text-indigo-600"
                    >
                      Register your school or college
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* STEP 1B: ACADEMY ONBOARDING REGISTRATION FORM */}
            {step === 'form' && mode === 'register' && (
              <form onSubmit={handleRegisterAcademy} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Academy / College Name
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => {
                      setRegName(e.target.value);
                      if (!regSlug) {
                        setRegSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15));
                      }
                    }}
                    placeholder="e.g. Crescent Collegiate Lahore"
                    required
                    autoFocus
                    className="w-full px-3.5 py-2 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Subdomain Identifier
                    </label>
                    <input
                      type="text"
                      value={regSlug}
                      onChange={(e) => setRegSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="crescent"
                      required
                      className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium font-mono placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Campus City / Branch
                    </label>
                    <input
                      type="text"
                      value={regCampus}
                      onChange={(e) => setRegCampus(e.target.value)}
                      placeholder="Main Campus"
                      required
                      className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                    />
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 block -mt-1 font-mono">
                  Your URL will be: <strong>{regSlug || 'subdomain'}.toolnestr.com</strong>
                </span>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Director / Admin Name
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        value={regAdminName}
                        onChange={(e) => setRegAdminName(e.target.value)}
                        placeholder="Prof. Tariq"
                        required
                        className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Institutional Email
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="director@crescent.edu"
                        required
                        className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !regName || !regSlug || !regEmail}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Provisioning Workspace & Sending Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Register Academy & Send Passcode</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-xs text-slate-500 hover:text-slate-900 font-medium"
                  >
                    Already have an academy? <strong className="text-slate-900 underline">Sign In</strong>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: VERIFY OTP SCREEN (Shared for both Login and Registration) */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      6-Digit Verification Code
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">
                      Sent via <strong>edu@toolnestr.com</strong>
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      required
                      autoFocus
                      className="w-full text-center tracking-[0.5em] text-xl font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg py-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {devOtp && (
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                    <span className="text-[11px]">Passcode preview: <strong className="font-mono">{devOtp}</strong></span>
                    <button
                      type="button"
                      onClick={() => setOtp(devOtp)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold rounded transition-colors"
                    >
                      Auto-fill
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Validating Session...</span>
                    </>
                  ) : (
                    <>
                      <span>Enter Academy ERP</span>
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
                    Back to credentials
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

          {/* Compliance & Help Desk Footer */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>© 2026 {currentAcademyName}</span>
            <div className="flex items-center gap-3">
              <span className="hover:text-slate-600 transition-colors">Privacy Policy</span>
              <span>•</span>
              <span className="hover:text-slate-600 transition-colors">Terms of Service</span>
              <span>•</span>
              <span className="hover:text-slate-600 transition-colors">IT Support: edu@toolnestr.com</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
