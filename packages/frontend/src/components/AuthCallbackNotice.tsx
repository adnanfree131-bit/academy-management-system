import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

/** Capture callback feedback before the auth client removes the URL fragment. */
export function AuthCallbackNotice() {
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
  const message = authError || callbackMessage;
  if (!message || (dismissed && !authError)) return null;

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
    <section className="relative z-50 border-b border-slate-300 bg-white p-4 text-slate-900" aria-label="Email confirmation status">
      <div className="mx-auto max-w-3xl">
        <p role={authError || callback.error ? 'alert' : 'status'}>{message}</p>
        {callback.error && <form onSubmit={resend} className="mt-3 flex flex-wrap gap-2">
          <label htmlFor="confirmation-email" className="self-center">Email address</label>
          <input id="confirmation-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="rounded border border-slate-300 px-3 py-2" />
          <button type="submit" disabled={sending} className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50">{sending ? 'Sending…' : 'Send new confirmation link'}</button>
        </form>}
        {resendMessage && <p className="mt-2" role={resendError ? 'alert' : 'status'}>{resendMessage}</p>}
        {!authError && <button type="button" className="mt-2 text-sm underline" onClick={() => setDismissed(true)}>Dismiss</button>}
      </div>
    </section>
  );
}
