'use client';
import { useState } from 'react';
import { friendlyError } from '@/lib/error-messages';

type Field = { name: string; label: string; type?: string; autoComplete?: string };

export function AuthForm({ endpoint, fields, submit, redirectTo, extra, doneMessage, initialError }: {
  endpoint: string; fields: Field[]; submit: string; redirectTo?: string; extra?: Record<string, string>;
  doneMessage?: string; initialError?: string;
}) {
  const [error, setError] = useState(initialError ? friendlyError(initialError) : '');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError('');
    const body = { ...Object.fromEntries(new FormData(e.currentTarget)), ...extra };
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { if (redirectTo) window.location.href = redirectTo; else setDone(true); return; }
      setError(friendlyError((await res.json().catch(() => null))?.error?.code));
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally { setBusy(false); }
  }

  if (done) return <p role="status" className="badge badge-success" style={{ padding: '12px 16px', borderRadius: 12 }}>{doneMessage ?? 'Done.'}</p>;
  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
      {fields.map((f) => (
        <label key={f.name} className="label">
          {f.label}
          <input className="input" name={f.name} type={f.type ?? 'text'} autoComplete={f.autoComplete} required />
        </label>
      ))}
      {error && <p role="alert" className="alert">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Please wait…' : submit}</button>
    </form>
  );
}
