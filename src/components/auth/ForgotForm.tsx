'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon, postJson, Spinner, useCountdown } from './primitives';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_AFTER = 45;

export function ForgotForm() {
  const [view, setView] = useState<'input' | 'sent'>('input');
  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState<number | null>(null);
  const [resendIn, setResendIn] = useState<number | null>(null);
  const rate = useCountdown(limit);
  const resend = useCountdown(resendIn);
  useEffect(() => { if (limit !== null && rate.left === 0) setLimit(null); }, [limit, rate.left]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!EMAIL_RE.test(email)) { setInvalid(true); return; }
    setInvalid(false); setBusy(true);
    const res = await postJson('/api/auth/forgot-password', { email });
    setBusy(false);
    if (res.ok) { setView('sent'); setResendIn(RESEND_AFTER); return; }
    if (res.code === 'RATE_LIMITED') setLimit(res.retryAfter ?? 60);
  }

  const throttled = limit !== null && rate.left > 0;
  if (view === 'sent') {
    return (
      <div className="flex flex-col">
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-full border border-atelier-border-soft bg-[#E7FFF2] text-atelier-green shadow-sm"><Icon name="mark_email_read" className="text-[20px]" /></div>
        <h1 className="mb-2.5 font-display text-[30px] font-bold leading-[1.15] tracking-tight text-atelier-dark sm:text-[32px]">Check your email</h1>
        <p className="mb-4 font-body-md text-[15px] font-normal leading-relaxed text-atelier-muted">If an account exists for that email, we sent a link. It works for one hour.</p>
        <div className="mb-6 flex w-fit max-w-full items-center gap-2 rounded-lg border border-atelier-border bg-atelier-sand px-3 py-2">
          <Icon name="outgoing_mail" className="shrink-0 text-[16px] text-atelier-green" />
          <span className="truncate font-martian text-xs font-medium text-atelier-dark">{email}</span>
        </div>
        <div className="space-y-4 pt-2">
          <button type="button" disabled={resend.left > 0 || busy} onClick={() => void send()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-atelier-border bg-white font-ui-medium text-[15px] font-semibold text-atelier-green transition-all hover:bg-atelier-sand disabled:cursor-not-allowed disabled:text-[#8B9A92]">
            <span>Resend link</span>
            {resend.left > 0 && <span className="rounded bg-surface-container px-1.5 py-0.5 font-martian text-xs text-atelier-muted">{resend.label}</span>}
          </button>
          <div className="pt-2 text-center">
            <button type="button" onClick={() => { setView('input'); setResendIn(null); }} className="inline-flex items-center gap-1 font-ui-medium text-sm text-atelier-green hover:underline">Use a different email</button>
          </div>
        </div>
        <div className="mt-8 flex items-center justify-center gap-2 border-t border-atelier-border/60 pt-4 text-xs text-secondary">
          <Icon name="verified_user" className="text-[14px] text-secondary" /><span>Zero account disclosure policy active</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-full border border-atelier-border-soft bg-[#E7FFF2] text-atelier-green shadow-sm"><Icon name="vpn_key" className="text-[20px]" /></div>
      <h1 className="mb-2.5 font-display text-[30px] font-bold leading-[1.15] tracking-tight text-atelier-dark sm:text-[32px]">Forgot your password?</h1>
      <p className="mb-6 font-body-md text-[15px] font-normal leading-relaxed text-atelier-muted">Enter the email you signed up with and we will send you a link to set a new one.</p>
      {throttled && (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-atelier-amber-border bg-atelier-amber-bg p-3.5 text-left">
          <Icon name="hourglass_top" className="mt-0.5 shrink-0 text-[20px] text-atelier-amber-banner" />
          <div className="flex-1">
            <p className="font-body-sm text-[13.5px] font-medium leading-snug text-atelier-amber-banner">Too many requests. Try again in <span className="ml-1 font-martian text-xs font-semibold tracking-wide">{rate.label}</span></p>
            <p className="mt-0.5 text-xs font-normal text-secondary">For security, outbound password links are temporarily throttled.</p>
          </div>
        </div>
      )}
      <form className="space-y-5" onSubmit={send} noValidate>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="email-field" className="block font-ui-medium text-xs font-semibold uppercase tracking-wider text-atelier-dark">Email address</label>
            <span className="font-code-xs text-xs text-secondary">Institution or School ID</span>
          </div>
          <div className="relative">
            <input id="email-field" type="email" autoComplete="email" value={email} disabled={busy} placeholder="aditi.deshmukh@lincoln.k12.edu"
              onChange={(e) => { setEmail(e.target.value); setInvalid(false); }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              className={`h-12 w-full rounded-xl border bg-white px-4 font-body-md text-[15px] text-atelier-dark transition duration-150 placeholder:text-[#99A69E] focus:outline-none ${
                invalid ? 'border-atelier-crimson ring-2 ring-atelier-crimson/20' : focused ? 'border-atelier-green ring-2 ring-atelier-green/20' : 'border-atelier-border'}`} />
            <Icon name="school" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[20px] text-secondary/60" />
          </div>
          {invalid && <div role="alert" className="mt-2 flex items-center gap-1.5 text-atelier-crimson"><Icon name="error" className="text-[17px]" /><span className="font-body-sm text-xs font-medium">Enter a valid email address.</span></div>}
        </div>
        <button type="submit" disabled={busy || throttled}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-atelier-green font-ui-medium text-[15px] font-semibold text-white transition-all duration-150 hover:bg-atelier-hover focus:outline-none focus:ring-2 focus:ring-atelier-green focus:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? <><Spinner /><span>Sending...</span></> : <span className="flex items-center gap-2">Send reset link<Icon name="arrow_forward" className="text-[18px]" /></span>}
        </button>
      </form>
      <div className="mt-8 border-t border-atelier-border/60 pt-5 text-center">
        <Link href="/sign-in" className="inline-flex items-center gap-1.5 rounded font-ui-medium text-sm text-atelier-green hover:underline"><Icon name="arrow_back" className="text-[16px]" />Back to log in</Link>
      </div>
    </div>
  );
}
