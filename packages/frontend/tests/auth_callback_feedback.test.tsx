/** @vitest-environment happy-dom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthCallbackNotice } from '../src/components/AuthCallbackNotice';
const mocks = vi.hoisted(() => ({ auth: { authenticatedIdentity: null as any, authError: null as string | null }, resend: vi.fn() }));
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../src/lib/supabase', () => ({ supabase: { auth: { resend: mocks.resend } } }));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
describe('Email callback feedback', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    mocks.auth.authenticatedIdentity = null;
    mocks.auth.authError = null;
    mocks.resend.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  it('shows an expired-link error and resends with the current platform redirect', async () => {
    window.location.hash = '#error=access_denied&error_code=otp_expired';
    mocks.resend.mockResolvedValue({ error: null });
    await act(async () => root.render(<AuthCallbackNotice />));
    expect(container.querySelector('[role=alert]')?.textContent).toContain('expired or has already been used');
    const input = container.querySelector('input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, 'user@example.test');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(mocks.resend).toHaveBeenCalledWith({ type: 'signup', email: 'user@example.test', options: { emailRedirectTo: `${window.location.origin}/#onboarding-confirmed` } });
    expect(container.textContent).toContain('Check your inbox');
  });
  it('shows an email service failure instead of claiming a link was sent', async () => {
    window.location.hash = '#error_code=otp_expired';
    mocks.resend.mockResolvedValue({ error: new Error('rate limited') });
    await act(async () => root.render(<AuthCallbackNotice />));
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(container.textContent).toContain('Unable to send a confirmation email');
    expect(container.textContent).not.toContain('a new link has been sent');
  });
  it('does not claim confirmation success without an authenticated identity', async () => {
    window.location.hash = '#onboarding-confirmed';
    await act(async () => root.render(<AuthCallbackNotice />));
    expect(container.textContent).toBe('');
    mocks.auth.authenticatedIdentity = { email: 'user@example.test' };
    await act(async () => root.render(<AuthCallbackNotice />));
    expect(container.querySelector('[role=status]')?.textContent).toContain('Your email is confirmed');
  });
  it('displays backend session failure even without a callback', async () => {
    mocks.auth.authError = 'Unable to load your account. Please try signing in again.';
    await act(async () => root.render(<AuthCallbackNotice />));
    expect(container.querySelector('[role=alert]')?.textContent).toContain('Unable to load your account');
  });
  it('does not expose arbitrary text from an untrusted callback', async () => {
    window.location.hash = '#error=access_denied&error_description=SECRET_UNTRUSTED_TEXT';
    await act(async () => root.render(<AuthCallbackNotice />));
    expect(container.textContent).toContain('could not confirm');
    expect(container.textContent).not.toContain('SECRET_UNTRUSTED_TEXT');
  });
});
