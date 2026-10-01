import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

/** Capture callback feedback before the auth client removes the URL fragment. */
export function AuthCallbackNotice({ successOnly = false }: { successOnly?: boolean }) {
  const { authenticatedIdentity, authError } = useAuth();
  const [callback] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const error = params.get('error_code') || params.get('error');
    return {
      error,
      signup: !error && (params.get('type') === 'signup' || window.location.hash === '#onboarding-confirmed'),
    };
  });
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const callbackMessage = callback.error
    ? callback.error === 'otp_expired'
      ? 'This email confirmation link has expired or has already been used. If you already confirmed your email, sign in. Otherwise, request a new link below.'
      : 'We could not confirm your email from this link. Please request a new confirmation link.'
    : callback.signup && authenticatedIdentity
      ? 'Your email is confirmed. You can now continue setting up your academy.'
      : null;
  const message = successOnly ? (!callback.error && callbackMessage) : (authError || callbackMessage);
  if (!message || (dismissed && (!authError || successOnly))) return null;
  const isError = !successOnly && Boolean(authError || callback.error);

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setResendMessage('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/#onboarding-confirmed` },
      });
      if (error) throw error;
      setResendError(false);
      setResendMessage('If this account needs confirmation, a new link has been sent. Check your inbox and use the newest email.');
    } catch {
      setResendError(true);
      setResendMessage('Unable to send a confirmation email right now. Please wait a moment and try again.');
    } finally {
      setSending(false);
    }
  };
  return (
    <section className={`${successOnly ? 'fixed right-4 top-4 z-50 max-w-sm shadow-lg' : 'mb-5'} rounded-xl border ${isError ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'} p-4`} aria-label="Email confirmation status">
      <div className="flex items-start gap-3">
        {isError ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
        <div className="min-w-0 flex-1">
          <h3 className={`text-sm font-semibold ${isError ? 'text-rose-900' : 'text-emerald-900'}`}>{authError && !successOnly ? 'Sign-in needs attention' : callback.error ? 'Confirmation link unavailable' : 'Email confirmed'}</h3>
          <p className={`mt-1 text-xs leading-relaxed ${isError ? 'text-rose-800' : 'text-emerald-800'}`} role={isError ? 'alert' : 'status'}>{message}</p>
          {callback.error && !successOnly && <form onSubmit={resend} className="mt-3 space-y-2">
            <label htmlFor="confirmation-email" className="block text-xs font-semibold text-slate-700">Email address</label>
            <input id="confirmation-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
            <button type="submit" disabled={sending} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{sending ? 'Sending…' : 'Send new confirmation link'}</button>
          </form>}
          {resendMessage && <p className="mt-2 text-xs leading-relaxed text-slate-700" role={resendError ? 'alert' : 'status'}>{resendMessage}</p>}
          {(!authError || successOnly) && <button type="button" className="mt-2 text-xs font-medium text-slate-600 underline" onClick={() => setDismissed(true)}>Dismiss</button>}
        </div>
      </div>
    </section>
  );
}
