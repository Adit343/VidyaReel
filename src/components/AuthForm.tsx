'use client';
import { useState } from 'react';

type Field = { name: string; label: string; type?: string };

export function AuthForm({ endpoint, fields, submit, redirectTo, extra }: {
  endpoint: string; fields: Field[]; submit: string; redirectTo?: string; extra?: Record<string, string>;
}) {
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError('');
    const body = { ...Object.fromEntries(new FormData(e.currentTarget)), ...extra };
    const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    if (res.ok) { if (redirectTo) window.location.href = redirectTo; else setDone(true); return; }
    setError((await res.json().catch(() => null))?.error?.message ?? 'Something went wrong.');
  }

  if (done) return <p>If that email is approved, a link is on its way.</p>;
  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
      {fields.map((f) => (
        <label key={f.name} style={{ display: 'grid', gap: 4 }}>
          {f.label}
          <input name={f.name} type={f.type ?? 'text'} required style={{ padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 12 }} />
        </label>
      ))}
      {error && <p role="alert" style={{ color: 'var(--critical)', margin: 0 }}>{error}</p>}
      <button className="btn" disabled={busy}>{submit}</button>
    </form>
  );
}
