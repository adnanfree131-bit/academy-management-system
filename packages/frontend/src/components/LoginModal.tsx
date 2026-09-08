import React, { useState } from 'react';
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
  GraduationCap
} from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { requestOTP, verifyOTP } = useAuth();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [tenantSlug, setTenantSlug] = useState<string>('apex');
  const [email, setEmail] = useState<string>('admin@apex.edu.pk');
  const [otp, setOtp] = useState<string>('');
  const [devOtp, setDevOtp] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-0 sm:p-6 lg:p-10 font-sans">
      <div className="w-full max-w-6xl bg-white sm:rounded-2xl shadow-xl sm:border sm:border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        
        {/* ================================================================ */}
        {/* LEFT COLUMN: INSTITUTIONAL SHOWCASE & CREDENTIALS (5/12 cols)     */}
        {/* ================================================================ */}
        <div className="hidden lg:flex lg:col-span-5 bg-slate-950 text-white p-10 flex-col justify-between relative overflow-hidden border-r border-slate-900">
          {/* Subtle architectural background texture */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30" />
          
          <div className="relative z-10">
            {/* Institution Brand Monogram */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-white shadow-inner">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight text-white block leading-none">Apex Academy</span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mt-1 block">Campus Management ERP</span>
              </div>
            </div>

            {/* Editorial Value Statement */}
            <div className="mt-16 space-y-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Session 2026–2027 • Main Campus</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white leading-tight">
                Enterprise Academic Administration & Student Information System.
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Centralized academic structure, itemized fee invoicing, attendance tracking, and comprehensive examination results engineered for institutions of scale.
              </p>
            </div>

            {/* Institutional Features Checklist */}
            <div className="mt-10 space-y-3 text-xs text-slate-300">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Dual-Campus Academic Structure & Batch Timetables</span>
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
                <span>End-to-End Role-Based Access Control</span>
              </div>
            </div>
          </div>

          {/* Left Footer: Compliance & Security */}
          <div className="relative z-10 pt-8 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>256-Bit Encrypted Portal</span>
            </span>
            <span>v1.0.0 Production</span>
          </div>
        </div>

        {/* ================================================================ */}
        {/* RIGHT COLUMN: REFINED AUTHENTICATION CONSOLE (7/12 cols)          */}
        {/* ================================================================ */}
        <div className="lg:col-span-7 bg-white p-8 sm:p-12 lg:p-14 flex flex-col justify-between min-h-[580px]">
          
          {/* Top Bar: Operational Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>All Systems Operational</span>
            </div>
            <div className="text-[11px] text-slate-400">
              <span>Apex Academy Lahore</span>
            </div>
          </div>

          {/* Center Form Area */}
          <div className="max-w-md w-full mx-auto my-auto py-6">
            
            {/* Form Header */}
            <div className="mb-7">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {step === 'email' ? 'Sign in to Portal' : 'Two-Factor Verification'}
              </h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {step === 'email' 
                  ? 'Enter your institutional email address to access the administration workspace.' 
                  : `Enter the 6-digit verification code dispatched to ${email}`}
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2.5 animate-in fade-in">
                <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0"></span>
                <span>{error}</span>
              </div>
            )}

            {/* Success Message Banner */}
            {message && step === 'otp' && (
              <div className="mb-5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium animate-in fade-in">
                {message}
              </div>
            )}

            {step === 'email' ? (
              <form onSubmit={handleRequestOTP} className="space-y-4">
                
                {/* Campus Slug */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Campus Identifier
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      type="text"
                      value={tenantSlug}
                      onChange={(e) => setTenantSlug(e.target.value)}
                      placeholder="apex"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Institutional Email
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

                {/* Primary Action Button */}
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-1 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Authenticating...</span>
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
                    Master administrator access available with default passcode.
                  </p>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                
                {/* 6-Digit Code */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      6-Digit Verification Code
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">
                      Code: <strong className="text-slate-800 font-bold">{devOtp || '123456'}</strong>
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

                {/* Auto-fill Helper */}
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                  <span className="text-[11px]">Quick master access code available</span>
                  <button
                    type="button"
                    onClick={() => setOtp(devOtp || '123456')}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold rounded transition-colors"
                  >
                    Insert 123456
                  </button>
                </div>

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
                    onClick={() => { setStep('email'); setOtp(''); }}
                    className="text-slate-600 hover:text-slate-900 text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Change email
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

          {/* Bottom Compliance & Help Desk Footer */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>© 2026 Apex Academy Management System</span>
            <div className="flex items-center gap-3">
              <span className="hover:text-slate-600 transition-colors">Privacy Policy</span>
              <span>•</span>
              <span className="hover:text-slate-600 transition-colors">Terms of Service</span>
              <span>•</span>
              <span className="hover:text-slate-600 transition-colors">IT Support Desk</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
