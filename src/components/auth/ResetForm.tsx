'use client';
import Link from 'next/link';
import { useState } from 'react';
import { checkPassword } from '@/lib/password-rules';
import { friendlyError } from '@/lib/error-messages';
import { Icon, PasswordInput, postJson, StrengthMeter, strengthState, SubmitButton, useCountdown } from './primitives';

const ICON_WRAP = 'mb-6 flex h-12 w-12 items-center justify-center rounded-full';
const H1 = 'mb-2 font-headline-lg text-[32px] font-bold leading-[36px] tracking-tight text-solstice-charcoal';
const P = 'mb-6 font-body-md text-[15px] leading-[22px] text-solstice-slate';
const PRIMARY = 'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-solstice-forest font-ui-medium text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-solstice-forestHover active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-solstice-forest focus:ring-offset-2';

export function ResetForm({ token }: { token: string }) {
  const [view, setView] = useState<'form' | 'success' | 'expired'>(token ? 'form' : 'expired');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState<number | null>(null);
  const rate = useCountdown(limit);

  const check = checkPassword(password);
  const mismatch = confirm.length > 0 && confirm !== password;
  const blocked = check.status !== 'ok' || confirm !== password || (limit !== null && rate.left > 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (blocked) return;
    setBusy(true); setError('');
    const res = await postJson('/api/auth/reset-password', { token, password });
    setBusy(false);
    if (res.ok) { setView('success'); return; }
    if (res.code === 'INVALID_RESET_TOKEN') setView('expired');
    else if (res.code === 'RATE_LIMITED') setLimit(res.retryAfter ?? 60);
    else setError(friendlyError(res.code));
  }

  if (view === 'success') {
    return (
      <div className="text-left">
        <div className={`${ICON_WRAP} bg-solstice-success/10 text-solstice-success`}><Icon name="check_circle" className="text-[26px]" /></div>
        <h2 className={H1}>Password updated</h2>
        <p className={`${P} mb-7`}>You have been signed out everywhere. Log in with your new password.</p>
        <Link href="/sign-in?reset=1" className={PRIMARY}>Go to log in →</Link>
      </div>
    );
  }
  if (view === 'expired') {
    return (
      <div className="text-left">
        <div className={`${ICON_WRAP} border border-[#FFDCBC] bg-[#FFF5E6] text-solstice-warning`}><Icon name="history_toggle_off" className="text-[24px]" /></div>
        <h2 className={H1}>This link has expired</h2>
        <p className={`${P} mb-7`}>Reset links work once and last an hour.</p>
        <div className="space-y-3">
          <Link href="/forgot-password" className={PRIMARY}>Send a new link →</Link>
          <Link href="/sign-in" className="block w-full py-2.5 text-center font-ui-regular text-[14px] text-solstice-slate hover:text-solstice-charcoal">Back to log in</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={`${ICON_WRAP} bg-solstice-forest/10 text-solstice-forest`}><Icon name="vpn_key" className="text-[24px]" /></div>
      <h1 className={H1}>Set a new password</h1>
      <p className={P}>Choose something you have not used here before.</p>
      {limit !== null && rate.left > 0 && (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-[#FFDCBC] bg-[#FFF5E6] p-3.5">
          <Icon name="timer" className="mt-0.5 shrink-0 text-[20px] text-solstice-warning" />
          <div className="text-[13px] leading-[18px] text-solstice-charcoal"><span className="font-semibold text-[#804200]">Too many attempts.</span> Try again in
            <span className="ml-1 rounded border border-[#FFDCBC] bg-white/60 px-1.5 py-0.5 font-code-sm text-[12px] font-bold text-[#804200]">{rate.label}</span></div>
        </div>
      )}
      {error && <p role="alert" className="mb-4 rounded-xl border border-solstice-critical/30 bg-[#FDF2F1] p-3 text-[13px] font-semibold text-solstice-critical">{error}</p>}
      <form className="space-y-5" onSubmit={onSubmit}>
        <div onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
          <PasswordInput id="new-password" name="password" label="New password" value={password} onChange={setPassword} autoComplete="new-password"
            placeholder="Enter strong password" state={strengthState(password)}
            right={<span className="font-code-xs text-[11px] text-solstice-slate">Min 10 chars</span>}
            below={<StrengthMeter password={password} focused={focused} hint="At least 10 characters. Avoid common passwords." />} />
        </div>
        <div>
          <PasswordInput id="confirm-password" name="confirm" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password"
            placeholder="Re-enter password" state={mismatch ? 'error' : 'idle'} />
          {mismatch && <div role="alert" className="mt-2 flex items-center gap-1.5 text-solstice-critical"><Icon name="error" className="text-[16px]" /><span className="font-body-sm text-[13px] font-medium">The two passwords don&apos;t match.</span></div>}
        </div>
        <div className="pt-2"><SubmitButton busy={busy} busyLabel="Saving..." disabled={blocked}>Save new password →</SubmitButton></div>
        <p className="pt-1 text-center font-code-xs text-[11px] leading-relaxed text-solstice-slate">This link works once and expires an hour after it was sent.</p>
      </form>
    </div>
  );
}
