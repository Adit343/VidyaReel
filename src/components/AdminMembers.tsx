'use client';
import { useCallback, useEffect, useState } from 'react';
import { friendlyError } from '@/lib/error-messages';

type Item = { id: string; email: string; role: 'member' | 'admin'; dailyLimit: number; hasAccount: boolean; lastSignInAt: string | null };

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, headers: { 'content-type': 'application/json' } });
  if (res.ok) return res.status === 204 ? null : res.json();
  throw new Error(friendlyError((await res.json().catch(() => null))?.error?.code));
}

export function AdminMembers() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [limit, setLimit] = useState(5);

  const load = useCallback(async () => {
    try { setItems((await api('/api/admin/approved-emails')).items); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); } catch (e) { setError((e as Error).message); }
    await load();
  };
  const patch = (id: string, body: object) => run(() => api(`/api/admin/approved-emails/${id}`, { method: 'PATCH', body: JSON.stringify(body) }));
  const add = () => run(async () => {
    await api('/api/admin/approved-emails', { method: 'POST', body: JSON.stringify({ email, role, dailyLimit: limit }) });
    setEmail('');
  });

  return (
    <>
      {error && <p role="alert" className="alert">{error}</p>}

      <form className="card row" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <input className="input" style={{ flex: '1 1 240px', width: 'auto' }} type="email" required placeholder="colleague@school.edu" aria-label="Email to invite" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className="input" style={{ width: 'auto' }} aria-label="Role" value={role} onChange={(e) => { const r = e.target.value as 'member' | 'admin'; setRole(r); setLimit(r === 'admin' ? 20 : 5); }}>
          <option value="member">Member</option><option value="admin">Admin</option>
        </select>
        <input className="input" style={{ width: 90 }} type="number" min={1} max={100} aria-label="Daily limit" value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
        <button className="btn">Add invite</button>
      </form>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Member</th><th>Role</th><th>Daily limit</th><th>Status</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {items === null && <tr><td colSpan={5} className="muted">Loading…</td></tr>}
            {items?.length === 0 && <tr><td colSpan={5} className="muted">No approved emails yet.</td></tr>}
            {items?.map((m) => (
              <tr key={m.id}>
                <td><strong>{m.email}</strong></td>
                <td>
                  <select className="input" style={{ width: 'auto', padding: '6px 10px' }} aria-label={`Role for ${m.email}`} value={m.role} onChange={(e) => void patch(m.id, { role: e.target.value })}>
                    <option value="member">Member</option><option value="admin">Admin</option>
                  </select>
                </td>
                <td>
                  <input className="input" style={{ width: 80, padding: '6px 10px' }} type="number" min={1} max={100} aria-label={`Daily limit for ${m.email}`}
                    defaultValue={m.dailyLimit} onBlur={(e) => { const v = Number(e.target.value); if (v !== m.dailyLimit && v >= 1 && v <= 100) void patch(m.id, { dailyLimit: v }); }} />
                </td>
                <td>{m.hasAccount ? <span className="badge badge-success">Active</span> : <span className="badge badge-warning">Invited</span>}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm(`Remove ${m.email}? They will be signed out immediately.`)) void run(() => api(`/api/admin/approved-emails/${m.id}`, { method: 'DELETE' })); }}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
