import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Mail, 
  ArrowRight, 
  RefreshCw, 
  KeyRound, 
  Building2, 
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  BookOpen,
  GraduationCap,
  Settings,
  Lock,
  UserCheck
} from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { requestOTP, verifyOTP } = useAuth();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [tenantSlug, setTenantSlug] = useState<string>('apex');
  const [email, setEmail] = useState<string>('adnan@apexacademy.edu.pk');
  const [otp, setOtp] = useState<string>('');
  const [devOtp, setDevOtp] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeRoleLoading, setActiveRoleLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showCustomLogin, setShowCustomLogin] = useState<boolean>(false);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await requestOTP(email, tenantSlug);
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
    setError(null);
    setLoading(true);

    try {
      await verifyOTP(email, otp, tenantSlug);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check code.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string, slug = 'apex', roleKey: string) => {
    setError(null);
    setActiveRoleLoading(roleKey);
    try {
      const res = await requestOTP(demoEmail, slug);
      const code = res.dev_otp || '123456';
      await verifyOTP(demoEmail, code, slug);
    } catch (err: any) {
      setError(err.message || 'Quick login failed.');
    } finally {
      setActiveRoleLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900/95 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        {/* Institutional Branding Header */}
        <div className="bg-slate-900 p-6 sm:p-8 text-white text-center relative border-b border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-600/30">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Apex Academy Management System</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl mx-auto">
            Campus Administration & Academic Portal
          </p>
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 text-xs font-mono text-slate-300 mt-3 border border-slate-700">
            <UserCheck className="w-4 h-4 text-indigo-400" />
            <span>Select an account to explore or sign in with your email</span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2.5 animate-in fade-in">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 flex-shrink-0"></span>
              <span>{error}</span>
            </div>
          )}

          {message && step === 'otp' && (
            <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-800 font-medium animate-in fade-in">
              {message}
            </div>
          )}

          {/* ============================================================
              DEMO ACCOUNTS (PRIMARY TESTBED)
              ============================================================ */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <span>Demo Accounts</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select any account to test role permissions and features:
                </p>
              </div>
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-md bg-slate-100 text-[10px] font-mono font-bold text-slate-600">
                Instant Access
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              
              {/* Card 1: Administrator */}
              <div className="p-4 rounded-2xl border-2 border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50/80 transition-all flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                      <ShieldCheck className="w-4 h-4" />
                    </span>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-mono text-[10px] font-bold">
                      ADMINISTRATOR
                    </span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">Adnan Rafiq</h3>
                    <p className="text-[10px] text-indigo-600 font-semibold">Campus Director</p>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Student admissions, faculty timetables, attendance tracking, fee billing, and staff payroll.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={activeRoleLoading !== null || loading}
                  onClick={() => handleQuickLogin('adnan@apexacademy.edu.pk', 'apex', 'admin')}
                  className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {activeRoleLoading === 'admin' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Logging in...</span>
                    </>
                  ) : (
                    <>
                      <span>Login as Administrator</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Card 2: Faculty */}
              <div className="p-4 rounded-2xl border-2 border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50/80 transition-all flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                      <BookOpen className="w-4 h-4" />
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[10px] font-bold">
                      FACULTY
                    </span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">Sir Tariq</h3>
                    <p className="text-[10px] text-emerald-600 font-semibold">Senior Physics Faculty</p>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Daily lecture schedule, batch attendance roll call, homework assignments, and exam grading.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={activeRoleLoading !== null || loading}
                  onClick={() => handleQuickLogin('tariq@apexacademy.edu.pk', 'apex', 'teacher')}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {activeRoleLoading === 'teacher' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Logging in...</span>
                    </>
                  ) : (
                    <>
                      <span>Login as Teacher</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Card 3: Student & Parent */}
              <div className="p-4 rounded-2xl border-2 border-sky-100 bg-sky-50/40 hover:bg-sky-50/80 transition-all flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
                      <GraduationCap className="w-4 h-4" />
                    </span>
                    <span className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded font-mono text-[10px] font-bold">
                      STUDENT & PARENT
                    </span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">Muhammad Ali Raza</h3>
                    <p className="text-[10px] text-sky-600 font-semibold">MDCAT Morning - Batch A</p>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Class timetable, fee invoices with online payment details, homework diary, and report cards.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={activeRoleLoading !== null || loading}
                  onClick={() => handleQuickLogin('student@apexacademy.edu.pk', 'apex', 'student')}
                  className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {activeRoleLoading === 'student' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Logging in...</span>
                    </>
                  ) : (
                    <>
                      <span>Login as Student</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

            </div>

            {/* Row 2: Super Admin & License Expiration Demo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 truncate">
                  <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700 shrink-0">
                    <Settings className="w-4 h-4" />
                  </span>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-900 leading-tight">Platform Super-Admin</p>
                    <p className="text-[10px] text-slate-500 truncate">Multi-campus directory, subscription licenses & settings</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={activeRoleLoading !== null || loading}
                  onClick={() => handleQuickLogin('superadmin@apexacademyerp.com', 'apex', 'superadmin')}
                  className="py-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shrink-0 transition-colors"
                >
                  {activeRoleLoading === 'superadmin' ? '...' : 'Super-Admin'}
                </button>
              </div>

              <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 truncate">
                  <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700 shrink-0">
                    <Lock className="w-4 h-4" />
                  </span>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-900 leading-tight">Crescent College (Expired License)</p>
                    <p className="text-[10px] text-slate-500 truncate">Trial expired lockout screen with receipt upload</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={activeRoleLoading !== null || loading}
                  onClick={() => handleQuickLogin('admin@crescentcollege.edu.pk', 'crescent', 'crescent')}
                  className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shrink-0 transition-colors"
                >
                  {activeRoleLoading === 'crescent' ? '...' : 'Preview Lockout'}
                </button>
              </div>
            </div>
          </div>

          {/* ============================================================
              COLLAPSIBLE CUSTOM EMAIL / BREVO OTP AUTHENTICATION
              ============================================================ */}
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowCustomLogin(!showCustomLogin)}
              className="w-full flex items-center justify-between py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              <span className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-slate-400" />
                <span>Sign in with email and verification code</span>
              </span>
              {showCustomLogin ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showCustomLogin && (
              <div className="mt-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 animate-in fade-in">
                {step === 'email' ? (
                  <form onSubmit={handleRequestOTP} className="space-y-4">
                    {/* Academy Tenant Selector */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        Select Academy Campus
                      </label>
                      <select
                        value={tenantSlug}
                        onChange={(e) => setTenantSlug(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="apex">Apex Academy Lahore (Gulberg III)</option>
                        <option value="crescent">Crescent College Karachi (Clifton)</option>
                      </select>
                    </div>

                    {/* Email Input */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        Institutional Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="director@apexacademy.edu.pk"
                        required
                        className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Dispatching OTP...</span>
                        </>
                      ) : (
                        <>
                          <span>Send 6-Digit OTP Code</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOTP} className="space-y-4">
                    {/* Dev Mode Static Code Helper */}
                    {devOtp && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                        <div>
                          <span className="font-bold">Dev Code: </span>
                          <span className="font-mono text-sm tracking-widest font-extrabold">{devOtp}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOtp(devOtp)}
                          className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700"
                        >
                          Auto-Fill
                        </button>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                        6-Digit Verification Passcode
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        required
                        autoFocus
                        className="w-full text-center tracking-[10px] text-2xl font-mono font-bold bg-white border border-slate-200 rounded-xl py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Verifying Session...</span>
                        </>
                      ) : (
                        <>
                          <span>Verify & Enter Academy ERP</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-xs pt-2">
                      <button
                        type="button"
                        onClick={() => setStep('email')}
                        className="text-slate-500 hover:text-slate-800 text-[11px]"
                      >
                        ← Change email
                      </button>
                      <button
                        type="button"
                        onClick={handleRequestOTP}
                        disabled={loading}
                        className="text-indigo-600 font-semibold hover:underline text-[11px]"
                      >
                        Resend Code
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
