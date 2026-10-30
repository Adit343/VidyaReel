'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { checkPassword } from '@/lib/password-rules';

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden>{name}</span>;
}

export function AuthLogo({ href = '/sign-in', size = 'md' }: { href?: string; size?: 'md' | 'lg' }) {
  return (
    <Link href={href} className="flex items-center gap-3.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-solstice-forest">
      <div className={`relative ${size === 'lg' ? 'h-10 w-10 rounded-xl' : 'h-9 w-9 rounded-[10px]'} bg-solstice-forest flex items-center justify-center shadow-sm`}>
        <svg className="ml-0.5 h-4 w-4 fill-current text-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-solstice-sage bg-solstice-saffron" />
      </div>
      <div className="flex flex-col">
        <span className="font-display text-[22px] font-bold leading-none tracking-tight text-solstice-forest">vidyareel</span>
        <span className="mt-1 font-martian text-[9px] font-semibold uppercase tracking-widest text-solstice-slate">Explainer Studio</span>
      </div>
    </Link>
  );
}

type Tone = 'error' | 'warning' | 'success' | 'info' | 'neutral';
const TONES: Record<Tone, string> = {
  error: 'border-solstice-critical/30 bg-[#FDF2F1] text-solstice-critical',
  warning: 'border-solstice-warning/30 bg-[#FFF9F0] text-solstice-warning',
  success: 'border-solstice-success/30 bg-[#F0FAF4] text-solstice-success',
  info: 'border-solstice-border bg-white text-solstice-charcoal',
  neutral: 'border-solstice-charcoal/20 bg-white text-solstice-charcoal shadow-sm',
};

export function Banner({ tone, icon, children, action }: { tone: Tone; icon: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 ${TONES[tone]}`}>
      <div className="flex items-start gap-3">
        <Icon name={icon} className={`mt-0.5 flex-shrink-0 text-[20px] ${tone === 'neutral' ? 'text-solstice-critical' : ''}`} />
        <div className="font-ui-medium text-[13px] font-semibold leading-tight">{children}</div>
      </div>
      {action}
    </div>
  );
}

/** Counts down from `seconds`, formatted m:ss. */
export function useCountdown(seconds: number | null) {
  const [left, setLeft] = useState(seconds ?? 0);
  useEffect(() => {
    setLeft(seconds ?? 0);
    if (!seconds) return;
    const t = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds]);
  return { left, label: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` };
}

export function Spinner() {
  return (
    <svg className="animate-spin-slow h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
    </svg>
  );
}

export function SubmitButton({ busy, busyLabel, disabled, children }: { busy: boolean; busyLabel: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={busy || disabled}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-solstice-forest font-ui-medium text-[15px] font-semibold text-white transition-all duration-150 hover:bg-solstice-forestHover focus:outline-none focus:ring-2 focus:ring-solstice-forest focus:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
      {busy ? <><Spinner />{busyLabel}</> : children}
    </button>
  );
}

export function GoogleButton({ label }: { label: string }) {
  return (
    <a href="/api/auth/google" className="group flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-solstice-borderHover bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 hover:bg-solstice-chipBg active:scale-[0.99]">
      <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
      </svg>
      <span className="font-ui-medium text-[14px] font-semibold text-solstice-charcoal group-hover:text-solstice-forestHover">{label}</span>
    </a>
  );
}

export function OrDivider() {
  return (
    <div className="relative my-6 flex items-center justify-center">
      <div className="w-full border-t border-solstice-border" />
      <span className="absolute bg-solstice-sage px-3 font-martian text-[12px] text-solstice-slate">or</span>
    </div>
  );
}

export const inputClass = (state: 'idle' | 'error' | 'ok' = 'idle') =>
  `h-12 w-full rounded-xl border bg-white px-4 font-body-md text-[15px] text-solstice-charcoal placeholder:text-solstice-slate/50 transition-all duration-150 focus:outline-none focus:ring-2 ${
    state === 'error' ? 'border-solstice-critical focus:border-solstice-critical focus:ring-solstice-critical/20'
    : state === 'ok' ? 'border-solstice-success focus:border-solstice-success focus:ring-solstice-success/20'
    : 'border-solstice-border focus:border-solstice-forest focus:ring-solstice-forest/20'}`;

export function PasswordInput({ id, name, label, value, onChange, state, autoComplete, placeholder, right, below }: {
  id: string; name: string; label: string; value: string; onChange: (v: string) => void; state?: 'idle' | 'error' | 'ok';
  autoComplete?: string; placeholder?: string; right?: React.ReactNode; below?: React.ReactNode;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="block font-ui-medium text-[14px] font-medium text-solstice-charcoal">{label}</label>
        {right}
      </div>
      <div className="relative">
        <input id={id} name={name} type={shown ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} required
          autoComplete={autoComplete} placeholder={placeholder ?? '••••••••••••'} className={`${inputClass(state)} pr-11`} />
        <button type="button" aria-label={shown ? 'Hide password' : 'Show password'} onClick={() => setShown(!shown)}
          className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-solstice-slate hover:text-solstice-charcoal focus:outline-none">
          <Icon name={shown ? 'visibility_off' : 'visibility'} className="text-[19px]" />
        </button>
      </div>
      {below}
    </div>
  );
}

/** 4-segment meter + one line of feedback (Stitch Sign-Up / Reset states: weak, common, contains email, strong). */
export function StrengthMeter({ password, email, hint, focused }: { password: string; email?: string; hint: string; focused?: boolean }) {
  const check = checkPassword(password, email);
  const level = check.status === 'empty' ? 0 : check.level;
  const color = check.status === 'empty' ? '' : check.status === 'ok' ? 'bg-solstice-success' : check.status === 'common' ? 'bg-solstice-warning' : 'bg-solstice-critical';
  const text = check.status === 'empty' ? (focused ? 'text-solstice-forest font-medium' : 'text-solstice-slate')
    : check.status === 'ok' ? 'text-solstice-success font-semibold' : check.status === 'common' ? 'text-solstice-warning font-medium' : 'text-solstice-critical font-medium';
  const icon = check.status === 'empty' ? (focused ? 'edit' : 'info') : check.status === 'ok' ? 'check_circle' : check.status === 'common' ? 'warning' : check.status === 'email' ? 'error' : 'cancel';
  return (
    <div className="mt-2.5" aria-live="polite">
      <div className="grid h-1.5 w-full grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((i) => <div key={i} className={`h-full rounded-full transition-colors duration-200 ${i <= level ? color : 'bg-solstice-border'}`} />)}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Icon name={icon} className={`text-[14px] ${text.split(' ')[0]}`} />
        <p className={`font-body-sm text-[12px] ${text}`}>{check.status === 'empty' ? (focused ? 'Use 10+ characters with mixed words or numbers.' : hint) : check.message}</p>
      </div>
    </div>
  );
}

export const strengthState = (password: string, email?: string): 'idle' | 'error' | 'ok' => {
  const c = checkPassword(password, email);
  return c.status === 'empty' ? 'idle' : c.status === 'ok' ? 'ok' : c.status === 'common' ? 'idle' : 'error';
};

export type ApiResult = { ok: boolean; code?: string; retryAfter?: number; status: number };

export async function postJson(url: string, body: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) return { ok: true, status: res.status };
    const data = await res.json().catch(() => null);
    return { ok: false, status: res.status, code: data?.error?.code, retryAfter: Number(res.headers.get('retry-after')) || undefined };
  } catch {
    return { ok: false, status: 0, code: 'NETWORK' };
  }
}

export function AuthFooter() {
  return (
    <footer className="mt-auto w-full border-t border-solstice-border bg-white px-4 py-5 md:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 font-ui-regular text-[13px] text-solstice-slate md:flex-row">
        <div>© 2025 Vidyareel Studio. Crafted for natural instruction. All rights reserved.</div>
        <div className="flex flex-wrap items-center gap-6 font-ui-medium text-[13px]">
          <a className="transition-colors duration-150 hover:text-solstice-forest" href="#terms">Terms of Service</a>
          <a className="transition-colors duration-150 hover:text-solstice-forest" href="#privacy">Privacy Policy</a>
          <a className="flex items-center gap-1.5 transition-colors duration-150 hover:text-solstice-forest" href="#status">
            <span className="h-2 w-2 rounded-full bg-solstice-success" />System Status
          </a>
        </div>
      </div>
    </footer>
  );
}
