'use client';
import Link from 'next/link';
import { useState } from 'react';
import { friendlyError } from '@/lib/error-messages';
import { Banner, GoogleButton, inputClass, OrDivider, PasswordInput, postJson, SubmitButton, useCountdown } from './primitives';

type Notice = { code: string; retryAfter?: number } | null;

function Notices({ notice, resetDone }: { notice: Notice; resetDone: boolean }) {
  const countdown = useCountdown(notice?.code === 'RATE_LIMITED' ? notice.retryAfter ?? 60 : null);
  if (notice) {
    switch (notice.code) {
      case 'INVALID_CREDENTIALS': return <Banner tone="error" icon="error">That email and password don&apos;t match.</Banner>;
      case 'NOT_APPROVED': case 'INVITE_ONLY': return <Banner tone="neutral" icon="block">This account is suspended or not invited. Contact the admin.</Banner>;
      case 'RATE_LIMITED':
        return (
          <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-solstice-border bg-white p-3.5 text-solstice-charcoal shadow-sm">
            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[19px] text-solstice-slate">hourglass_top</span><span className="font-ui-medium text-[13px] font-semibold">Too many attempts.</span></div>
            <span className="rounded bg-solstice-sage px-2 py-0.5 font-martian text-[12px] font-semibold text-solstice-forest">Try again in {countdown.label}</span>
          </div>
        );
      case 'access_denied': return <Banner tone="info" icon="info">Google sign-in was cancelled. You can try again.</Banner>;
      default: return <Banner tone="error" icon="error">{friendlyError(notice.code)}</Banner>;
    }
  }
  if (resetDone) return <Banner tone="success" icon="check_circle">Password updated. Log in with your new password.</Banner>;
  return null;
}

export function LoginForm({ initialError, resetDone }: { initialError?: string; resetDone?: boolean }) {
  const [notice, setNotice] = useState<Notice>(initialError ? { code: initialError } : null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true); setNotice(null);
    const res = await postJson('/api/auth/login', { email: form.get('email'), password, remember: form.get('remember') === 'on' });
    if (res.ok) { window.location.href = '/'; return; }
    setNotice({ code: res.code ?? 'INVALID', retryAfter: res.retryAfter });
    setBusy(false);
  }

  const limited = notice?.code === 'RATE_LIMITED';
  return (
    <>
      <div className="mb-5 space-y-3"><Notices notice={notice} resetDone={!!resetDone} /></div>
      <GoogleButton label="Log in with Google" />
      <OrDivider />
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label htmlFor="email-input" className="mb-1.5 block font-ui-medium text-[14px] font-medium text-solstice-charcoal">Email</label>
          <input id="email-input" name="email" type="email" required autoComplete="email" placeholder="aditi.deshmukh@lincoln.k12.edu" className={inputClass()} />
        </div>
        <PasswordInput id="password-input" name="password" label="Password" value={password} onChange={setPassword} autoComplete="current-password"
          right={<Link href="/forgot-password" className="font-ui-medium text-[13px] font-semibold text-solstice-forest hover:underline">Forgot password?</Link>} />
        <div className="flex items-center pt-0.5">
          <input id="keep-signed-in" name="remember" type="checkbox" className="h-[18px] w-[18px] cursor-pointer rounded border-solstice-slate/60 accent-solstice-forest" />
          <label htmlFor="keep-signed-in" className="ml-2.5 block cursor-pointer select-none font-ui-regular text-[13px] text-solstice-charcoal">Keep me signed in on this device</label>
        </div>
        <SubmitButton busy={busy} busyLabel="Logging in..." disabled={limited}>Log in <span>→</span></SubmitButton>
      </form>
    </>
  );
}
