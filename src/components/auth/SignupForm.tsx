'use client';
import { useState } from 'react';
import { checkPassword } from '@/lib/password-rules';
import { friendlyError } from '@/lib/error-messages';
import { Banner, Icon, inputClass, PasswordInput, postJson, strengthState, StrengthMeter, SubmitButton, useCountdown } from './primitives';

export function SignupForm({ initialError }: { initialError?: string }) {
  const [code, setCode] = useState<string | null>(initialError ?? null);
  const [retryAfter, setRetryAfter] = useState<number | undefined>();
  const [dismissed, setDismissed] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const countdown = useCountdown(code === 'RATE_LIMITED' ? retryAfter ?? 60 : null);

  const weak = (() => { const c = checkPassword(password, email); return c.status === 'short' || c.status === 'common' || c.status === 'email'; })();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (weak) return;
    setBusy(true); setCode(null); setDismissed(false);
    const res = await postJson('/api/auth/signup', { name, email, password });
    if (res.ok) { window.location.href = '/'; return; }
    setCode(res.code ?? 'INVALID'); setRetryAfter(res.retryAfter); setBusy(false);
  }

  const closed = code === 'INVITE_ONLY';
  const limited = code === 'RATE_LIMITED' && !dismissed;
  return (
    <>
      {limited && (
        <div role="alert" className="mb-5 flex items-center justify-between rounded-xl border border-[#ba1a1a]/30 bg-[#ffdad6] px-4 py-3 text-[#93000a]">
          <div className="flex items-center gap-3"><Icon name="timer" className="text-xl text-[#ba1a1a]" />
            <p className="font-body-md text-[15px] font-medium">Too many attempts. Try again in <span className="rounded bg-[#ba1a1a]/10 px-1.5 py-0.5 font-code-sm text-[12px] font-bold tracking-tight">{countdown.label}</span>.</p></div>
          <button type="button" onClick={() => setDismissed(true)} className="font-code-xs text-xs font-bold uppercase text-[#ba1a1a] hover:underline">Dismiss</button>
        </div>
      )}
      {closed && (
        <div role="alert" className="mb-5 flex items-center gap-3 rounded-xl border border-[#744400]/20 bg-[#ffdcbc] px-4 py-3 text-[#543000]">
          <Icon name="lock" className="text-xl text-[#744400]" />
          <p className="font-body-md text-[15px] font-medium">Sign-up is invite-only right now. Ask an admin to approve your email, then try again.</p>
        </div>
      )}
      {code && !closed && code !== 'RATE_LIMITED' && <div className="mb-5"><Banner tone="error" icon="error">{friendlyError(code)}</Banner></div>}
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label htmlFor="fullname" className="mb-1.5 block font-ui-medium text-[13px] text-solstice-charcoal">Full name</label>
          <input id="fullname" name="name" required autoComplete="name" placeholder="Prof. Aditi Deshmukh" value={name} onChange={(e) => setName(e.target.value)} className={inputClass()} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block font-ui-medium text-[13px] text-solstice-charcoal">Email address</label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="aditi.deshmukh@lincoln.k12.edu" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass()} />
        </div>
        <div onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
          <PasswordInput id="password" name="password" label="Create password" value={password} onChange={setPassword} autoComplete="new-password"
            state={strengthState(password, email)}
            right={focused && <span className="rounded-full bg-solstice-chipBg px-2 py-0.5 font-code-xs text-[11px] text-solstice-slate">editing</span>}
            below={<StrengthMeter password={password} email={email} focused={focused} hint="At least 10 characters. Avoid common combinations." />} />
        </div>
        <SubmitButton busy={busy} busyLabel="Creating your account..." disabled={weak}>Create account <span>→</span></SubmitButton>
        <p className="pt-1 text-center font-body-sm text-[12px] leading-relaxed text-solstice-slate">
          By continuing you agree to the <a className="text-solstice-forest underline underline-offset-2 hover:text-solstice-forestHover" href="#terms">Terms</a> and <a className="text-solstice-forest underline underline-offset-2 hover:text-solstice-forestHover" href="#privacy">Privacy Policy</a>.
        </p>
      </form>
    </>
  );
}
