import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Mail, 
  Lock,
  Eye,
  EyeOff,
  ArrowRight, 
  RefreshCw, 
  ShieldCheck, 
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  User,
  PlusCircle,
  LogIn,
  MapPin,
  Phone,
  UploadCloud,
  X,
  AlertCircle,
  Check
} from 'lucide-react';
import { AcademyBranding } from '@apex/shared-types';

export const LoginModal: React.FC = () => {
  const { 
    loginWithPassword, 
    registerAcademy, 
    verifyRegistrationOTP, 
    forgotPassword, 
    resetPassword 
  } = useAuth();

  // Mode & Steps
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<'form' | 'otp' | 'forgot_password_request' | 'forgot_password_reset'>('form');

  // Daily Login Form (zero prefilled data, zero placeholders)
  const [tenantSlug, setTenantSlug] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Registration Form
  const [regName, setRegName] = useState<string>('');
  const [regSlug, setRegSlug] = useState<string>('');
  const [slugAvailability, setSlugAvailability] = useState<{
    status: 'idle' | 'checking' | 'available' | 'unavailable';
    domain: string;
    message?: string;
  }>({ status: 'idle', domain: '' });
  const [regCity, setRegCity] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regLogoUrl, setRegLogoUrl] = useState<string | null>(null);
  const [regAdminName, setRegAdminName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);

  // Verification & Reset State
  const [otp, setOtp] = useState<string>('');
  const [resetNewPassword, setResetNewPassword] = useState<string>('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState<string>('');
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);

  // Feedback State
  const [branding, setBranding] = useState<AcademyBranding | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getBaseDomain = () => {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes('kampus.pk')) return 'kampus.pk';
    if (hostname.includes('toolnestr.com')) return 'toolnestr.com';
    return 'kampus.pk';
  };

  const baseDomain = getBaseDomain();

  // Initialize tenant slug from URL query or subdomain
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const campusParam = params.get('campus');
    if (campusParam) {
      setTenantSlug(campusParam.toLowerCase().trim());
    } else {
      const hostname = window.location.hostname.toLowerCase();
      if (hostname.endsWith('.kampus.pk')) {
        const sub = hostname.replace('.kampus.pk', '');
        if (sub && sub !== 'www' && sub !== 'edu' && sub !== 'app') {
          setTenantSlug(sub);
        }
      } else if (hostname.endsWith('.toolnestr.com') && !hostname.startsWith('www.')) {
        const sub = hostname.replace('.toolnestr.com', '');
        if (sub && sub !== 'edu' && sub !== 'www' && sub !== 'app') {
          setTenantSlug(sub);
        }
      }
    }
  }, []);

  // Fetch dynamic branding whenever tenantSlug changes
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
        // Retain default branding
      }
    };
    const timer = setTimeout(fetchBranding, 300);
    return () => clearTimeout(timer);
  }, [tenantSlug]);

  // Real-time Subdomain Availability Checker
  useEffect(() => {
    if (!regSlug.trim()) {
      setSlugAvailability({ status: 'idle', domain: '' });
      return;
    }

    const clean = regSlug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    const domain = `${clean}.${baseDomain}`;

    setSlugAvailability({ status: 'checking', domain });

    const checkTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/auth/check-domain?slug=${encodeURIComponent(clean)}`);
        const body = await res.json();
        if (body.success && body.data) {
          setSlugAvailability({
            status: body.data.available ? 'available' : 'unavailable',
            domain: body.data.domain,
            message: body.data.message,
          });
        } else {
          setSlugAvailability({
            status: 'unavailable',
            domain,
            message: body.error?.message || 'Unavailable',
          });
        }
      } catch {
        setSlugAvailability({
          status: 'available',
          domain,
        });
      }
    }, 400);

    return () => clearTimeout(checkTimer);
  }, [regSlug]);

  // Handle Logo Upload (Optional)
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, SVG).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image file size must be less than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setRegLogoUrl(reader.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // ---------------------------------------------------------------------------
  // 1. Handle Daily Password Login
  // ---------------------------------------------------------------------------
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    setLoading(true);

    try {
      await loginWithPassword(email.trim(), password, tenantSlug.trim() || undefined);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. Handle Academy Registration
  // ---------------------------------------------------------------------------
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (slugAvailability.status === 'unavailable') {
      setError('Please choose an available subdomain identifier.');
      return;
    }

    setLoading(true);

    try {
      const cleanSlug = regSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      const res = await registerAcademy({
        name: regName.trim(),
        slug: cleanSlug,
        city: regCity.trim() || undefined,
        phone: regPhone.trim() || undefined,
        logo_url: regLogoUrl || undefined,
        admin_name: regAdminName.trim(),
        admin_email: regEmail.trim().toLowerCase(),
        password: regPassword,
      });

      setTenantSlug(cleanSlug);
      setEmail(regEmail.trim().toLowerCase());
      setMessage(res.message);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to register academy.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. Handle Registration OTP Verification
  // ---------------------------------------------------------------------------
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setError(null);
    setLoading(true);

    try {
      await verifyRegistrationOTP(email.trim(), otp.trim(), tenantSlug.trim());
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check your 6-digit code.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 4. Handle Forgot Password Request
  // ---------------------------------------------------------------------------
  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const res = await forgotPassword(email.trim(), tenantSlug.trim() || undefined);
      setMessage(res.message);
      setStep('forgot_password_reset');
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset code.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. Handle Reset Password Confirmation
  // ---------------------------------------------------------------------------
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (resetNewPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await resetPassword(
        email.trim(), 
        otp.trim(), 
        resetNewPassword, 
        tenantSlug.trim() || undefined
      );
      setMessage(res.message);
      setStep('form');
      setMode('login');
      setPassword('');
      setOtp('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  const activeAcademyName = mode === 'register'
    ? (regName.trim() || 'Academy Name')
    : (branding?.name || (tenantSlug ? tenantSlug.toUpperCase() : 'Academy Portal'));

  const activeAcademyLogo = mode === 'register'
    ? regLogoUrl
    : (branding?.logo_url || null);

  const activeDomain = mode === 'register'
    ? (regSlug.trim() ? `${regSlug.trim().toLowerCase()}.${baseDomain}` : `subdomain.${baseDomain}`)
    : (typeof window !== 'undefined' && window.location.hostname.toLowerCase() === 'edu.kampus.pk'
        ? 'edu.kampus.pk'
        : (branding?.domain || (tenantSlug ? `${tenantSlug}.${baseDomain}` : baseDomain)));

  const currentSession = branding?.academic_session || '2026–2027';

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-0 sm:p-6 lg:p-10 font-sans">
      <div className="w-full max-w-6xl bg-white sm:rounded-2xl shadow-xl sm:border sm:border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[680px]">
        
        {/* ================================================================ */}
        {/* LEFT COLUMN: INSTITUTIONAL SHOWCASE (5/12 cols)                  */}
        {/* ================================================================ */}
        <div className="hidden lg:flex lg:col-span-5 bg-slate-950 text-white p-8 lg:p-10 flex-col justify-between relative overflow-hidden border-r border-slate-900">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30" />
          
          {/* Top Bar: Clean Brand Logo */}
          <div className="relative z-10 flex items-center justify-between pb-4 border-b border-slate-900">
            <img src="/kampus-logo-dark.png" alt="Kampus" className="h-6 w-auto object-contain" />
          </div>

          {/* Middle Live Showcase: Upper-Middle Logo & Middle Name */}
          <div className="relative z-10 my-auto py-8 flex flex-col items-center text-center">
            
            {/* UPPER MIDDLE: Academy Logo Box (Enlarged) */}
            <div className="mb-5">
              {activeAcademyLogo ? (
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-white p-3 border border-slate-700 shadow-2xl flex items-center justify-center overflow-hidden transition-all">
                  <img 
                    src={activeAcademyLogo} 
                    alt={activeAcademyName} 
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div 
                  onClick={() => {
                    if (mode === 'register') fileInputRef.current?.click();
                  }}
                  className={`w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-xl transition-all ${
                    mode === 'register' ? 'cursor-pointer hover:border-slate-700 hover:text-slate-300' : ''
                  }`}
                  title={mode === 'register' ? 'Click to upload academy logo' : undefined}
                >
                  <GraduationCap className="w-14 h-14 text-slate-400" />
                </div>
              )}
            </div>

            {/* MIDDLE: Academy Name (Clean, refined size) */}
            <div className="w-full px-4 max-w-sm">
              <h1 className={`text-lg sm:text-xl font-bold tracking-tight font-brand transition-all duration-150 break-words leading-snug ${
                mode === 'register' && !regName.trim()
                  ? 'text-slate-500 font-normal'
                  : 'text-white'
              }`}>
                {activeAcademyName}
              </h1>

              {/* Subdomain Pill */}
              <div className="mt-2.5 flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
                  <Lock className="w-3 h-3 text-slate-500" />
                  <span>{activeDomain}</span>
                  {mode === 'register' && regCity.trim() && (
                    <span className="text-slate-500">• {regCity.trim()}</span>
                  )}
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* ================================================================ */}
        {/* RIGHT COLUMN: PORTAL FORMS (7/12 cols)                            */}
        {/* ================================================================ */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-10 lg:p-12 flex flex-col justify-between min-h-[600px] overflow-y-auto">
          
          {/* Top Bar: Mode Switcher */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              {/* Mobile-only brand logo (since left column is hidden on mobile screens) */}
              <img src="/kampus-logo.png" alt="Kampus" className="h-5 w-auto object-contain lg:hidden" />
              {tenantSlug && branding?.name && (
                <span className="text-xs font-semibold text-slate-700 truncate max-w-[180px]">
                  {branding.name}
                </span>
              )}
            </div>

            {/* Mode Switcher (Visible only in form step) */}
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

          {/* Main Form Content */}
          <div className="max-w-md w-full mx-auto my-auto py-4">
            
            {/* Mobile Live Identity Bar (Visible only on smaller screens in register mode) */}
            {mode === 'register' && step === 'form' && (
              <div className="lg:hidden mb-5 p-3 rounded-xl bg-slate-950 text-white border border-slate-800 flex items-center gap-3 shadow-md">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-12 h-12 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 overflow-hidden border border-slate-700 cursor-pointer"
                  title="Click to upload logo"
                >
                  {regLogoUrl ? (
                    <img src={regLogoUrl} alt="Logo preview" className="w-full h-full object-contain" />
                  ) : (
                    <GraduationCap className="w-6 h-6 text-indigo-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold font-brand text-white truncate leading-tight">
                    {regName.trim() || 'Academy Name'}
                  </h4>
                  <p className="text-[10px] font-mono text-indigo-300 truncate mt-0.5">
                    {regSlug.trim() ? `${regSlug.trim().toLowerCase()}.${baseDomain}` : `subdomain.${baseDomain}`}
                  </p>
                </div>
              </div>
            )}

            {/* Headings */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {step === 'otp' && 'Verify Academy Email'}
                {step === 'forgot_password_request' && 'Reset Password'}
                {step === 'forgot_password_reset' && 'Set New Password'}
                {step === 'form' && (mode === 'login' ? 'Sign In' : 'Register Academy')}
              </h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {step === 'otp' && `Enter the 6-digit verification code dispatched to ${email}`}
                {step === 'forgot_password_request' && 'Enter your institutional email to receive a password reset code.'}
                {step === 'forgot_password_reset' && `Enter the 6-digit code dispatched to ${email} and choose your new password.`}
                {step === 'form' && (mode === 'login' 
                  ? 'Enter your institutional email and password to access your academy account.' 
                  : 'Create your academy profile, choose your subdomain, and set up your director account.')}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Info Message */}
            {message && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 1. DAILY SIGN IN FORM: EMAIL + PASSWORD                       */}
            {/* ------------------------------------------------------------- */}
            {step === 'form' && mode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
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

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => { setStep('forgot_password_request'); setError(null); setMessage(null); }}
                      className="text-[11px] text-slate-500 hover:text-slate-900 font-medium cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim() || !password}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
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

            {/* ------------------------------------------------------------- */}
            {/* 2. REGISTER ACADEMY FORM                                      */}
            {/* ------------------------------------------------------------- */}
            {step === 'form' && mode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                {/* Academy Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Academy Name
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRegName(val);
                      if (!regSlug || regSlug === regName.toLowerCase().replace(/[^a-z0-9]/g, '')) {
                        setRegSlug(val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20));
                      }
                    }}
                    required
                    autoFocus
                    className="w-full px-3.5 py-2 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                  />
                </div>

                {/* Subdomain Identifier with Real-time Availability Check */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Subdomain Identifier
                    </label>
                    {slugAvailability.status === 'checking' && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Verifying...
                      </span>
                    )}
                    {slugAvailability.status === 'available' && (
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 font-mono">
                        <Check className="w-3 h-3" />
                        Available
                      </span>
                    )}
                    {slugAvailability.status === 'unavailable' && (
                      <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 font-mono">
                        <X className="w-3 h-3" />
                        Taken
                      </span>
                    )}
                  </div>
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-slate-50/50 focus-within:ring-1 focus-within:ring-slate-900 focus-within:border-slate-900 focus-within:bg-white transition-all">
                    <input
                      type="text"
                      value={regSlug}
                      onChange={(e) => setRegSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      required
                      className="w-full pl-3 pr-1 py-2 text-xs text-slate-900 font-mono font-medium focus:outline-none bg-transparent"
                    />
                    <span className="px-3 py-2 text-xs font-mono text-slate-400 bg-slate-100/80 border-l border-slate-200 select-none shrink-0">
                      .{baseDomain}
                    </span>
                  </div>
                </div>

                {/* City & Phone (Two Column) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      City
                    </label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        value={regCity}
                        onChange={(e) => setRegCity(e.target.value)}
                        required
                        className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contact Phone
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        required
                        className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Optional Logo Upload with Live Preview */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Academy Logo <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <span className="text-[10px] text-slate-400">Previews live on page</span>
                  </div>
                  
                  {regLogoUrl ? (
                    <div className="flex items-center justify-between p-2.5 border border-slate-200 rounded-lg bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg border border-slate-300 bg-white p-1 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                          <img src={regLogoUrl} alt="Logo preview" className="w-full h-full object-contain" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Logo Attached</p>
                          <p className="text-[10px] text-emerald-600 font-medium">Live on left preview & portal</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          onChange={handleLogoSelect}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 cursor-pointer"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRegLogoUrl(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-[11px] text-rose-600 hover:text-rose-700 font-medium px-2 py-1 rounded hover:bg-rose-50 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        onChange={handleLogoSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-slate-400 rounded-lg text-xs text-slate-600 hover:text-slate-900 flex items-center justify-center gap-2 bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer"
                      >
                        <UploadCloud className="w-4 h-4 text-slate-400" />
                        <span>Upload Logo (PNG, JPG, SVG, WebP)</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Administrator Name & Email */}
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

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                        className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        required
                        className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !regName.trim() || !regSlug.trim() || !regEmail.trim() || !regPassword || slugAvailability.status === 'unavailable'}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Provisioning Domain & Dispatching Code...</span>
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

            {/* ------------------------------------------------------------- */}
            {/* 3. REGISTRATION OTP VERIFICATION SCREEN                      */}
            {/* ------------------------------------------------------------- */}
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
                      <span>Verify & Activate Academy</span>
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
                    Back to registration
                  </button>
                </div>
              </form>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 4. FORGOT PASSWORD: REQUEST CODE                             */}
            {/* ------------------------------------------------------------- */}
            {step === 'forgot_password_request' && (
              <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
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
                      required
                      autoFocus
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Reset Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Password Reset Code</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => { setStep('form'); setError(null); setMessage(null); }}
                    className="text-[11px] text-slate-500 hover:text-slate-900 font-medium flex items-center justify-center gap-1 mx-auto cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Return to Sign In
                  </button>
                </div>
              </form>
            )}

            {/* ------------------------------------------------------------- */}
            {/* 5. FORGOT PASSWORD: ENTER CODE & SET NEW PASSWORD            */}
            {/* ------------------------------------------------------------- */}
            {step === 'forgot_password_reset' && (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    className="w-full text-center tracking-[0.5em] text-xl font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      required
                      className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      required
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6 || !resetNewPassword}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <span>Update Password & Sign In</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => { setStep('form'); setError(null); setMessage(null); }}
                    className="text-[11px] text-slate-500 hover:text-slate-900 font-medium flex items-center justify-center gap-1 mx-auto cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Return to Sign In
                  </button>
                </div>
              </form>
            )}

          </div>

          {/* Clean Institutional Footer */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>© 2026 {activeAcademyName}</span>
            <div className="flex items-center gap-3">
              <span>Academic Session {currentSession}</span>
              <span>•</span>
              <span>Support: info@kampus.pk</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
