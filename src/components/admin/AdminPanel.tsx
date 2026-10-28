'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { friendlyError } from '@/lib/error-messages';
import { initialsOf, timeAgo } from '@/lib/time';
import type { UsageSummary } from '@/server/admin/usage';
import { useToast } from '../shell/Toast';
import { Select } from '../ui/Select';

export type Member = {
  id: string; email: string; name: string | null; role: 'member' | 'admin'; dailyLimit: number; addedAt: string;
  hasAccount: boolean; status: 'active' | 'invited' | 'suspended'; isOwner: boolean; joinedAt: string | null;
  lastSignInAt: string | null; methods: { google: boolean; password: boolean };
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, headers: { 'content-type': 'application/json' } });
  if (res.ok) return res.status === 204 ? null : res.json();
  throw new Error(friendlyError((await res.json().catch(() => null))?.error?.code));
}

const GOOGLE_G = (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const first = (m: Member) => (m.name ?? m.email).split(/[\s@]/)[0];

type Props = { initialMembers: Member[]; initialUsage: UsageSummary; selfEmail: string };
type Dialog = { kind: 'suspend' | 'delete-data'; member: Member } | null;

export function AdminPanel({ initialMembers, initialUsage, selfEmail }: Props) {
  const toast = useToast();
  const [members, setMembers] = useState(initialMembers);
  const [usage, setUsage] = useState(initialUsage);
  const [tab, setTab] = useState<'members' | 'usage'>('members');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'suspended'>('all');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [alsoDelete, setAlsoDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(true);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviteLimit, setInviteLimit] = useState(5);
  const menuRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    try { setMembers((await api('/api/admin/approved-emails')).items); } catch (e) { toast('error', (e as Error).message); }
  }, [toast]);
  const reloadUsage = useCallback(async () => {
    try { setUsage(await api('/api/admin/usage')); } catch { /* keep the last numbers */ }
  }, []);

  useEffect(() => {
    if (!menuId) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenuId(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [menuId]);

  const table = members.filter((m) => m.status !== 'invited');
  const invites = members.filter((m) => m.status === 'invited');
  const counts = { all: table.length, active: table.filter((m) => m.status === 'active').length, suspended: table.filter((m) => m.status === 'suspended').length };
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return table.filter((m) => (status === 'all' || m.status === status) && (!needle || m.email.includes(needle) || (m.name ?? '').toLowerCase().includes(needle)));
  }, [table, query, status]);

  async function patch(m: Member, body: object, ok?: string) {
    try { await api(`/api/admin/approved-emails/${m.id}`, { method: 'PATCH', body: JSON.stringify(body) }); if (ok) toast('success', ok); } catch (e) { toast('error', (e as Error).message); }
    await reload();
  }
  const setLimit = (m: Member, v: number) => {
    const next = Math.min(50, Math.max(1, v));
    if (next === m.dailyLimit) return;
    setMembers((all) => all.map((x) => (x.id === m.id ? { ...x, dailyLimit: next } : x)));
    void patch(m, { dailyLimit: next });
  };

  async function confirmDialog() {
    if (!dialog) return;
    setBusy(true);
    try {
      if (dialog.kind === 'suspend') {
        await api(`/api/admin/approved-emails/${dialog.member.id}`, { method: 'DELETE', body: JSON.stringify({ deleteVideos: alsoDelete }) });
        toast('success', `${first(dialog.member)} was suspended and signed out.${alsoDelete ? ' Their videos were removed.' : ''}`);
      } else {
        await api(`/api/admin/approved-emails/${dialog.member.id}`, { method: 'PATCH', body: JSON.stringify({ deleteVideos: true }) });
        toast('success', `${first(dialog.member)}'s videos were removed.`);
      }
      setDialog(null); setAlsoDelete(false);
    } catch (e) { toast('error', (e as Error).message); }
    setBusy(false);
    await Promise.all([reload(), reloadUsage()]);
  }

  async function addInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await api('/api/admin/approved-emails', { method: 'POST', body: JSON.stringify({ email: email.trim(), role: inviteRole, dailyLimit: inviteLimit }) });
      toast('success', `${email.trim().toLowerCase()} can now sign up.`);
      setEmail('');
    } catch (err) { toast('error', (err as Error).message); }
    await reload();
  }
  async function revoke(m: Member) {
    try { await api(`/api/admin/approved-emails/${m.id}`, { method: 'DELETE' }); toast('success', `Invite for ${m.email} was revoked.`); } catch (e) { toast('error', (e as Error).message); }
    await reload();
  }

  return (
    <main className="flex-1 max-w-[1180px] w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#D3DBD0]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-code-xs text-[11px] text-[#54675D] tracking-wider uppercase font-semibold">Workspace</span>
            <span className="text-[#D3DBD0] font-code-xs">/</span>
            <span className="font-code-xs text-[11px] text-[#145A41] tracking-wider uppercase font-semibold">Members &amp; access</span>
          </div>
          <div className="flex flex-wrap items-center gap-3.5">
            <h1 className="font-display text-display-mobile sm:text-display text-[#0F2A20] tracking-tight font-bold">Admin</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-[#D3DBD0] rounded-full font-code-xs text-code-xs text-[#54675D] shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#1A8F5A]" />
              {counts.active} registered member{counts.active === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <div className="flex items-center bg-[#E1E7DF]/80 p-1 rounded-xl border border-[#D3DBD0] self-start md:self-auto" role="tablist">
          <TabButton on={tab === 'members'} onClick={() => setTab('members')} icon="group">
            Members <span className="font-code-xs text-[11px] bg-[#E1E7DF] px-1.5 rounded-full text-[#54675D]">{counts.all}</span>
          </TabButton>
          <TabButton on={tab === 'usage'} onClick={() => { setTab('usage'); void reloadUsage(); }} icon="data_usage">Usage &amp; telemetry</TabButton>
        </div>
      </div>

      {tab === 'members' ? (
        <div className="space-y-6" id="panel-members">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#54675D]">search</span>
                <input
                  value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members by name or email…" aria-label="Search members"
                  className="w-full bg-white border border-[#D3DBD0] rounded-xl pl-10 pr-4 py-2.5 text-sm font-body-md text-[#0F2A20] placeholder:text-[#54675D]/70 focus:outline-none focus:border-[#145A41] focus:ring-2 focus:ring-[#145A41]/10 transition-all shadow-sm"
                />
              </div>
              <div className="flex items-center bg-white p-1 rounded-xl border border-[#D3DBD0] shadow-sm shrink-0" role="group" aria-label="Filter by status">
                {(['all', 'active', 'suspended'] as const).map((k) => (
                  <button key={k} aria-pressed={status === k} onClick={() => setStatus(k)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-ui-medium transition-all flex items-center gap-1.5 capitalize ${status === k ? 'bg-[#145A41] text-white' : 'text-[#54675D] hover:text-[#0F2A20]'}`}>
                    <span>{k}</span>
                    <span className={`font-code-xs text-[10px] px-1 rounded-full ${status === k ? 'bg-white/20' : 'bg-[#E1E7DF] text-[#54675D]'}`}>{counts[k]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-ui-medium shadow-sm bg-[#FF9F1C]/10 text-[#8C5200] border border-[#FF9F1C]/40">
                <span className="w-2 h-2 rounded-full bg-[#FF9F1C]" />
                <span className="font-semibold">Sign-up: Invite only</span>
              </span>
              <div className="relative group cursor-help" tabIndex={0}>
                <div className="w-7 h-7 rounded-full bg-white border border-[#D3DBD0] text-[#54675D] group-hover:text-[#0F2A20] flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-[16px]">help_outline</span>
                </div>
                <div className="absolute right-0 top-full mt-1.5 hidden group-hover:flex group-focus:flex flex-col w-56 p-2.5 bg-[#0F2A20] text-white text-xs rounded-xl overlay-ambient-shadow z-30 pointer-events-none">
                  <span className="font-code-xs text-[10px] text-[#adf1d0] uppercase tracking-wider mb-0.5 font-bold">Policy</span>
                  <span>Only emails on the invite list can create an account or sign in. This is fixed for this workspace.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#D3DBD0] rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D3DBD0] bg-[#E1E7DF]/30">
                    {['Member', 'Sign-in', 'Role', 'Daily limit', 'Status', 'Joined', 'Row menu'].map((h, i) => (
                      <th key={h} scope="col" className={`py-3 ${i === 0 ? 'px-5' : 'px-4'} ${i === 6 ? 'text-right px-5' : ''} font-code-xs text-[11px] tracking-wider text-[#54675D] font-bold uppercase whitespace-nowrap`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D3DBD0] text-sm">
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="py-10 text-center text-[#54675D]">{query ? `No members match “${query}”.` : status === 'suspended' ? 'No suspended members.' : 'No members yet.'}</td></tr>
                  )}
                  {rows.map((m) => {
                    const self = m.email === selfEmail.toLowerCase();
                    const locked = self || m.isOwner;
                    const off = m.status === 'suspended';
                    return (
                      <tr key={m.id} className={`hover:bg-[#E1E7DF]/20 transition-colors ${off ? 'bg-red-50/30' : ''}`}>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-code-xs font-bold text-xs shrink-0 ring-1 ${off ? 'bg-red-50 text-[#C93A2E] ring-red-200' : m.role === 'admin' ? 'bg-[#145A41]/10 text-[#145A41] ring-[#145A41]/20' : 'bg-[#E1E7DF] text-[#0F2A20] ring-[#D3DBD0]'}`}>
                              {initialsOf(m.name ?? m.email)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-ui-medium text-[#0F2A20] font-semibold flex items-center gap-1.5">
                                <span className="truncate">{m.name ?? m.email.split('@')[0]}</span>
                                {self && <span className="font-code-xs text-[10px] text-[#54675D] bg-[#E1E7DF] px-1.5 rounded">YOU</span>}
                                {!self && m.isOwner && <span className="font-code-xs text-[10px] text-[#54675D] bg-[#E1E7DF] px-1.5 rounded">OWNER</span>}
                                {off && <span className="font-code-xs text-[10px] text-[#C93A2E] bg-red-100 px-1.5 rounded">LOCKED</span>}
                              </div>
                              <div className="font-code-xs text-[11px] text-[#54675D] truncate">{m.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className={`flex items-center gap-1.5 ${off ? 'opacity-60' : ''}`}>
                            {m.methods.google && <span className="w-6 h-6 rounded-md bg-[#E1E7DF]/60 border border-[#D3DBD0] flex items-center justify-center" title="Google sign-in linked">{GOOGLE_G}</span>}
                            {m.methods.password && <span className="w-6 h-6 rounded-md bg-[#E1E7DF]/60 border border-[#D3DBD0] flex items-center justify-center" title="Password sign-in"><span className="material-symbols-outlined text-[14px] text-[#54675D]">key</span></span>}
                            {!m.methods.google && !m.methods.password && <span className="text-xs font-code-xs text-[#54675D] italic">None</span>}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Select
                            variant="compact" ariaLabel={`Role for ${m.email}`} value={m.role} disabled={locked || off}
                            options={[{ value: 'admin', label: 'Admin', hint: 'Manages members and sees usage' }, { value: 'member', label: 'Member', hint: 'Creates and posts videos' }]}
                            onChange={(role) => void patch(m, { role }, `${first(m)} is now ${role === 'admin' ? 'an admin' : 'a member'}.`)}
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <Stepper value={off ? 0 : m.dailyLimit} disabled={off} label={`Daily limit for ${m.email}`} onChange={(v) => setLimit(m, v)} />
                        </td>
                        <td className="py-3.5 px-4"><StatusChip status={m.status} /></td>
                        <td className="py-3.5 px-4 font-code-xs text-code-xs text-[#54675D] whitespace-nowrap">{dateLabel(m.joinedAt)}</td>
                        <td className="py-3.5 px-5 text-right relative">
                          <button
                            aria-label={`Manage ${first(m)}`} aria-haspopup="menu" aria-expanded={menuId === m.id} disabled={locked}
                            onClick={() => setMenuId(menuId === m.id ? null : m.id)} title={locked ? 'This account cannot be changed here' : `Manage ${first(m)}`}
                            className="p-1.5 text-[#54675D] hover:text-[#0F2A20] rounded-lg hover:bg-[#E1E7DF] transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                          >
                            <span className="material-symbols-outlined text-[18px]">{locked ? 'more_horiz' : 'more_vert'}</span>
                          </button>
                          {menuId === m.id && (
                            <div ref={menuRef} role="menu" className="absolute right-4 top-10 w-44 bg-white border border-[#D3DBD0] rounded-xl overlay-ambient-shadow py-1 z-30 text-left">
                              {off ? (
                                <button role="menuitem" onClick={() => { setMenuId(null); void patch(m, { reinstate: true }, `${first(m)} was reinstated.`); }} className="w-full px-3.5 py-2 text-xs font-ui-medium text-[#1A8F5A] hover:bg-emerald-50 flex items-center gap-2">
                                  <span className="material-symbols-outlined text-[16px]">check_circle</span>Reinstate member
                                </button>
                              ) : (
                                <button role="menuitem" onClick={() => { setMenuId(null); setAlsoDelete(false); setDialog({ kind: 'suspend', member: m }); }} className="w-full px-3.5 py-2 text-xs font-ui-medium text-[#C93A2E] hover:bg-red-50 flex items-center gap-2">
                                  <span className="material-symbols-outlined text-[16px]">block</span>Suspend {first(m)}
                                </button>
                              )}
                              <button role="menuitem" onClick={() => { setMenuId(null); setDialog({ kind: 'delete-data', member: m }); }} className="w-full px-3.5 py-2 text-xs font-ui-medium text-[#54675D] hover:text-[#C93A2E] hover:bg-red-50 flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">delete_forever</span>Delete data
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 bg-[#E1E7DF]/30 border-t border-[#D3DBD0] flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-[#54675D]">
              <span>New members start with the limit set on their invite (5 videos/day for members, 20 for admins).</span>
              <span className="font-code-xs">Daily quota resets automatically at 00:00 IST</span>
            </div>
          </div>

          <section className="bg-white border border-[#D3DBD0] rounded-2xl overflow-hidden shadow-sm" id="section-invite-list">
            <button onClick={() => setInviteOpen(!inviteOpen)} aria-expanded={inviteOpen} className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 text-left">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#B36B00] border border-amber-200 flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[20px]">mail</span></div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-headline-sm font-bold text-[#0F2A20]">Invite list</h2>
                    <span className="font-code-xs text-[10px] bg-[#FF9F1C]/15 text-[#8C5200] border border-[#FF9F1C]/30 px-2 py-0.5 rounded-full font-semibold">Active in invite-only mode</span>
                  </div>
                  <p className="text-xs text-[#54675D] mt-0.5">Approved educators who may create an account. Everyone else is refused at sign-up and sign-in.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#54675D] font-code-xs">
                <span>{invites.length} pending</span>
                <span className={`material-symbols-outlined transition-transform ${inviteOpen ? 'rotate-180' : ''}`}>expand_more</span>
              </div>
            </button>
            {inviteOpen && (
              <div className="border-t border-[#D3DBD0] p-5 space-y-4" id="invite-content">
                <form onSubmit={addInvite} className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 p-4 bg-[#E1E7DF]/30 border border-[#D3DBD0] rounded-xl">
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@school.edu" aria-label="Email to invite"
                    className="flex-1 bg-white border border-[#D3DBD0] rounded-xl px-4 py-2.5 text-sm font-code-xs text-[#0F2A20] placeholder:text-[#54675D]/60 focus:outline-none focus:border-[#145A41] focus:ring-2 focus:ring-[#145A41]/10"
                  />
                  <Select
                    variant="compact" value={inviteRole} ariaLabel="Role" className="h-full rounded-xl px-3 py-2.5"
                    options={[{ value: 'member', label: 'Role: Member' }, { value: 'admin', label: 'Role: Admin' }]}
                    onChange={(v) => { const r = v as 'member' | 'admin'; setInviteRole(r); setInviteLimit(r === 'admin' ? 20 : 5); }}
                  />
                  <div className="flex items-center justify-between bg-white border border-[#D3DBD0] rounded-xl px-2 py-1 shadow-sm">
                    <span className="text-xs text-[#54675D] mr-2 font-ui-medium pl-1">Limit:</span>
                    <Stepper value={inviteLimit} label="Daily limit for the invite" bare onChange={(v) => setInviteLimit(Math.min(50, Math.max(1, v)))} />
                  </div>
                  <button type="submit" className="bg-[#145A41] hover:bg-[#0F4632] text-white px-4 py-2.5 rounded-xl text-xs font-ui-medium transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0">
                    <span className="material-symbols-outlined text-[16px]">send</span>Add invite
                  </button>
                </form>
                <div className="space-y-2" id="invite-items-container">
                  {invites.length === 0 && <p className="text-xs text-[#54675D] py-2">No pending invites. Add an email above to let someone sign up.</p>}
                  {invites.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 p-3 bg-white border border-[#D3DBD0] rounded-xl text-xs hover:border-[#B9C5B5] transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-50 text-[#B36B00] flex items-center justify-center font-code-xs font-bold text-[11px] border border-amber-200 shrink-0">{initialsOf(m.email)}</div>
                        <div className="min-w-0">
                          <span className="font-code-xs text-xs text-[#0F2A20] font-medium break-all">{m.email}</span>
                          <div className="flex flex-wrap items-center gap-x-2 mt-0.5 text-[#54675D] text-[11px]">
                            <span>Role: {m.role === 'admin' ? 'Admin' : 'Member'}</span><span>•</span>
                            <span>Quota: {m.dailyLimit} videos/day</span><span>•</span>
                            <span className="text-[#B36B00]">Invited {timeAgo(m.addedAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-[#B36B00] rounded-full text-[10px] font-code-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#B36B00]" /> Pending acceptance
                        </span>
                        <button onClick={() => void revoke(m)} title="Revoke invite" aria-label={`Revoke invite for ${m.email}`} className="p-1 text-[#54675D] hover:text-[#C93A2E] rounded-lg hover:bg-red-50 transition-colors">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      ) : (
        <UsagePanel usage={usage} />
      )}

      {dialog && (
        <div className="fixed inset-0 bg-[#0F2A20]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="dialog-title" id="suspend-modal">
          <div className="bg-white rounded-2xl border border-[#D3DBD0] max-w-md w-full p-6 overlay-ambient-shadow relative">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-[#C93A2E] border border-red-200 flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[24px]">warning</span></div>
              <div>
                <h3 id="dialog-title" className="font-display text-headline-sm font-bold text-[#0F2A20]">
                  {dialog.kind === 'suspend' ? `Suspend ${first(dialog.member)}? They will be signed out right away.` : `Delete all of ${first(dialog.member)}'s videos?`}
                </h3>
                <p className="text-xs text-[#54675D] mt-1 leading-relaxed">
                  {dialog.kind === 'suspend'
                    ? 'Their sessions end immediately and they cannot sign in again until you reinstate them.'
                    : 'Their videos disappear from the Library and their files are cleaned up shortly after. This cannot be undone.'}
                </p>
              </div>
            </div>
            {dialog.kind === 'suspend' && (
              <div className="mt-5 p-3.5 bg-[#E1E7DF]/40 rounded-xl border border-[#D3DBD0]">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={alsoDelete} onChange={(e) => setAlsoDelete(e.target.checked)} className="mt-0.5 rounded border-[#B9C5B5] text-[#C93A2E] focus:ring-[#C93A2E] h-4 w-4" />
                  <div className="text-xs">
                    <span className="font-ui-medium text-[#0F2A20] font-semibold block">Also delete their videos</span>
                    <span className="text-[#54675D] text-[11px] leading-tight block mt-0.5">Removes their drafts and finished videos from the Library; stored files are purged by the cleanup job.</span>
                  </div>
                </label>
              </div>
            )}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => { setDialog(null); setAlsoDelete(false); }} disabled={busy} className="px-4 py-2 rounded-xl border border-[#D3DBD0] text-xs font-ui-medium text-[#54675D] hover:text-[#0F2A20] hover:bg-[#E1E7DF] transition-colors">Cancel</button>
              <button onClick={() => void confirmDialog()} disabled={busy} className="px-4 py-2 rounded-xl bg-[#C93A2E] hover:bg-[#93000A] text-white text-xs font-ui-medium transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-70">
                <span className="material-symbols-outlined text-[16px]">{dialog.kind === 'suspend' ? 'block' : 'delete_forever'}</span>
                {busy ? 'Working…' : dialog.kind === 'suspend' ? 'Suspend member' : 'Delete videos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function TabButton({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: string; children: React.ReactNode }) {
  return (
    <button role="tab" aria-selected={on} onClick={onClick}
      className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-sm font-ui-medium transition-all ${on ? 'bg-white text-[#0F2A20] shadow-sm' : 'text-[#54675D] hover:text-[#0F2A20]'}`}>
      <span className="material-symbols-outlined text-[18px]">{icon}</span>{children}
    </button>
  );
}

function StatusChip({ status }: { status: Member['status'] }) {
  const s = status === 'suspended'
    ? { label: 'Suspended', cls: 'bg-red-50 text-[#C93A2E] border-red-200', dot: 'bg-[#C93A2E]' }
    : { label: 'Active', cls: 'bg-emerald-50 text-[#1A8F5A] border-emerald-200', dot: 'bg-[#1A8F5A]' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-ui-medium border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
    </span>
  );
}

function Stepper({ value, onChange, disabled, label, bare }: { value: number; onChange: (v: number) => void; disabled?: boolean; label: string; bare?: boolean }) {
  const btn = 'text-[#54675D] hover:text-[#0F2A20] hover:bg-[#E1E7DF] text-xs font-bold disabled:cursor-not-allowed disabled:hover:bg-transparent';
  return (
    <div role="group" aria-label={label} className={bare ? 'flex items-center' : `inline-flex items-center border border-[#D3DBD0] rounded-lg overflow-hidden shadow-sm ${disabled ? 'bg-[#E1E7DF]/30 opacity-60' : 'bg-white'}`}>
      <button type="button" aria-label="Decrease" disabled={disabled} onClick={() => onChange(value - 1)} className={`${bare ? 'w-6 h-6 text-sm' : 'px-2 py-1'} ${btn}`}>−</button>
      <span className={`${bare ? 'w-7' : 'w-8 py-1'} text-center font-code-sm text-xs text-[#0F2A20]`} aria-live="polite">{value}</span>
      <button type="button" aria-label="Increase" disabled={disabled} onClick={() => onChange(value + 1)} className={`${bare ? 'w-6 h-6 text-sm' : 'px-2 py-1'} ${btn}`}>+</button>
    </div>
  );
}

function UsagePanel({ usage }: { usage: UsageSummary }) {
  const todayPct = Math.min(100, Math.round((usage.today.videos / Math.max(1, usage.today.cap)) * 100));
  const hours = Math.floor(usage.today.resetsInMs / 3600e3);
  const mins = Math.floor((usage.today.resetsInMs % 3600e3) / 60e3);
  const reels = usage.month.posted;
  const mp4s = Math.max(0, usage.month.ready - reels);
  const max = Math.max(1, ...usage.members.flatMap((m) => m.spark));
  return (
    <div className="space-y-6" id="panel-usage">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-headline-md font-bold text-[#0F2A20]">Workspace telemetry &amp; resource allocation</h2>
          <p className="text-sm text-[#54675D]">Daily generation caps and voice credits, counted from your videos.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-[#D3DBD0] rounded-full font-code-xs text-code-xs text-[#54675D] shadow-sm self-start">
          <span className="w-2 h-2 rounded-full bg-[#1A8F5A]" />Billing cycle: {usage.month.label}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <StatCard label="Global videos today" icon="movie_edit" tint="bg-[#E7FFF2] text-[#145A41]">
          <p className="font-display text-[36px] leading-[40px] font-bold text-[#0F2A20] mt-2">{usage.today.videos} <span className="text-[18px] font-normal text-[#54675D]">of {usage.today.cap}</span> <span className="font-code-xs text-xs font-normal text-[#145A41]">{todayPct}% quota used</span></p>
          <Bar pct={todayPct} />
          <Foot left={`Resets in ${hours}h ${String(mins).padStart(2, '0')}m`} right={`${Math.max(0, usage.today.cap - usage.today.videos)} remaining`} />
        </StatCard>
        <StatCard label="Videos this month" icon="calendar_month" tint="bg-[#E1E7DF] text-[#0F2A20]">
          <p className="font-display text-[36px] leading-[40px] font-bold text-[#0F2A20] mt-2">{usage.month.videos}</p>
          <div className="flex gap-2 mt-3">
            <span className="font-code-xs text-[11px] bg-[#E1E7DF] text-[#54675D] px-2 py-0.5 rounded">{reels} Posted</span>
            <span className="font-code-xs text-[11px] bg-[#E1E7DF] text-[#54675D] px-2 py-0.5 rounded">{mp4s} Ready MP4s</span>
          </div>
          <Foot left="Counted when a video is created" right="" />
        </StatCard>
        <StatCard label="Voice synthesis credits" icon="mic" tint="bg-[#FFF3E0] text-[#B36B00]">
          <p className="font-display text-[36px] leading-[40px] font-bold text-[#0F2A20] mt-2">
            {usage.voice.used == null ? '—' : usage.voice.used.toLocaleString()} <span className="text-[18px] font-normal text-[#54675D]">/ {usage.voice.total.toLocaleString()}</span>
          </p>
          <Bar pct={usage.voice.used == null ? 0 : Math.round((usage.voice.used / usage.voice.total) * 100)} />
          <Foot left={'Estimated: about one credit per narration character'} right="" />
        </StatCard>
      </div>

      <div className="bg-white border border-[#D3DBD0] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 sm:px-6 py-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-headline-sm font-bold text-[#0F2A20]">Member generation breakdown</h3>
            <p className="text-xs text-[#54675D] mt-0.5">Videos created over the last 14 days.</p>
          </div>
          <span className="font-code-xs text-[11px] bg-[#E1E7DF] text-[#54675D] px-3 py-1 rounded-full whitespace-nowrap">Live from your videos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-y border-[#D3DBD0] bg-[#E1E7DF]/30">
                {['Member', 'Total videos (this month)', 'Avg runtime', '14-day activity'].map((h) => (
                  <th key={h} scope="col" className="py-3 px-5 sm:px-6 font-code-xs text-[11px] tracking-wider text-[#54675D] font-bold uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D3DBD0]">
              {usage.members.length === 0 && <tr><td colSpan={4} className="py-8 px-6 text-center text-sm text-[#54675D]">No videos have been created yet.</td></tr>}
              {usage.members.map((m) => (
                <tr key={m.email}>
                  <td className="py-4 px-5 sm:px-6"><div className="text-sm text-[#0F2A20]">{m.email}</div><div className="font-code-xs text-[11px] text-[#54675D] capitalize">{m.role}</div></td>
                  <td className="py-4 px-5 sm:px-6 font-code-sm text-xs font-bold text-[#0F2A20]">{m.total}</td>
                  <td className="py-4 px-5 sm:px-6 font-code-xs text-xs text-[#54675D]">{m.avgSec == null ? '—' : `${String(Math.floor(m.avgSec / 60)).padStart(2, '0')}:${String(m.avgSec % 60).padStart(2, '0')} min`}</td>
                  <td className="py-4 px-5 sm:px-6">
                    <div className="flex items-end gap-1 h-8" aria-label={`Videos per day for ${m.email}`}>
                      {m.spark.map((n, i) => (
                        <span key={i} title={`${n}`} className={`w-1.5 rounded-sm ${i === m.spark.length - 1 ? 'bg-[#FF9F1C]' : 'bg-[#145A41]'}`} style={{ height: `${Math.max(12, (n / max) * 100)}%`, opacity: n === 0 ? 0.25 : 1 }} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, icon, tint, children }: { label: string; icon: string; tint: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#D3DBD0] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col">
      <div className="flex items-start justify-between">
        <span className="font-code-xs text-[11px] uppercase tracking-wider text-[#54675D] font-semibold">{label}</span>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${tint}`}><span className="material-symbols-outlined text-[20px]">{icon}</span></span>
      </div>
      {children}
    </div>
  );
}
const Bar = ({ pct }: { pct: number }) => (
  <div className="w-full h-2 bg-[#E1E7DF] rounded-full overflow-hidden mt-4">
    <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 3)}%`, background: 'linear-gradient(90deg, #145A41 0%, #1A8F5A 68%, #FF9F1C 100%)' }} />
  </div>
);
const Foot = ({ left, right }: { left: string; right: string }) => (
  <div className="mt-auto pt-4 flex items-center justify-between font-code-xs text-[11px] text-[#54675D] border-t border-[#EEF1EC] mt-4">
    <span>{left}</span><span className="font-semibold text-[#145A41]">{right}</span>
  </div>
);
