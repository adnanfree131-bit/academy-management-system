import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Mail, ArrowRight, RefreshCw, KeyRound, Building2 } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { requestOTP, verifyOTP } = useAuth();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [tenantSlug, setTenantSlug] = useState<string>('apex');
  const [email, setEmail] = useState<string>('adnan@apexacademy.edu.pk');
  const [otp, setOtp] = useState<string>('');
  const [devOtp, setDevOtp] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  const handleQuickLogin = async (demoEmail: string, slug = 'apex') => {
    setError(null);
    setLoading(true);
    try {
      const res = await requestOTP(demoEmail, slug);
      const code = res.dev_otp || '123456';
      await verifyOTP(demoEmail, code, slug);
    } catch (err: any) {
      setError(err.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900/95 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Institutional Branding Header */}
        <div className="bg-slate-900 p-6 text-white text-center relative">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-mono font-bold text-xl flex items-center justify-center mx-auto mb-3 shadow-md">
            Æ
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">Apex Academy ERP</h1>
          <p className="text-xs text-slate-400 mt-1">Multi-Tenant Institutional Operations Portal</p>
          
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-[11px] font-mono text-slate-300 mt-3 border border-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Passwordless Brevo OTP Security</span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-600"></span>
              {error}
            </div>
          )}

          {message && step === 'otp' && (
            <div className="mb-4 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-800 font-medium">
              {message}
            </div>
          )}

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
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="apex">Apex Academy Lahore (Gulberg III)</option>
                  <option value="crescent">Crescent College Karachi (Clifton)</option>
                </select>
              </div>

              {/* Email Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  Institutional Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="director@apexacademy.edu.pk"
                  required
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 space-y-1.5 border-t border-slate-100">
                <p className="text-[10px] font-mono uppercase font-bold text-slate-400 text-center tracking-wider">
                  ⚡ 1-Click Role Direct Access (Dev Mode)
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleQuickLogin('adnan@apexacademy.edu.pk', 'apex')}
                    className="py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 rounded-lg text-[11px] font-bold text-left truncate transition-colors"
                  >
                    👔 Director Adnan
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleQuickLogin('tariq@apexacademy.edu.pk', 'apex')}
                    className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-lg text-[11px] font-bold text-left truncate transition-colors"
                  >
                    👨‍🏫 Sir Tariq (Teacher)
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleQuickLogin('student@apexacademy.edu.pk', 'apex')}
                    className="py-1.5 px-2 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-900 rounded-lg text-[11px] font-bold text-left truncate transition-colors"
                  >
                    🎓 Student / Parent
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleQuickLogin('superadmin@apexacademyerp.com', 'apex')}
                    className="py-1.5 px-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 rounded-lg text-[11px] font-bold text-left truncate transition-colors"
                  >
                    🛡️ Super Admin
                  </button>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin('admin@crescentcollege.edu.pk', 'crescent')}
                  className="w-full py-1.5 px-2 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-900 rounded-lg text-[11px] font-bold text-center transition-colors"
                >
                  🔒 Locked Academy Demo (Crescent College)
                </button>
              </div>
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
                  className="w-full text-center tracking-[10px] text-2xl font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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
      </div>
    </div>
  );
};
