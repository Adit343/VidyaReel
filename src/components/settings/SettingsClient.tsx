'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TIME_ZONES } from '@/config/timezones';
import { api } from '@/lib/client-api';
import { utcLabel } from '@/lib/time';
import type { ConnectionView } from '@/server/instagram/connection';
import { useToast } from '../shell/Toast';

const SECTION = 'bg-white rounded-3xl border border-[#D3DBD0] p-6 md:p-8 shadow-[0_4px_16px_-2px_rgba(15,42,32,0.03)] flex flex-col gap-6';
const SECONDARY = 'px-4 py-2 rounded-xl text-sm font-ui-medium bg-white text-[#0F2A20] border border-[#D3DBD0] hover:bg-[#E1E7DF] transition-all active:scale-[0.99]';
const DANGER_OUTLINE = 'px-4 py-2 rounded-xl text-sm font-ui-medium text-[#C93A2E] border border-[#C93A2E] hover:bg-[#FFDAD6] transition-all active:scale-[0.99]';
const FIELD = 'w-full bg-white text-[#0F2A20] text-[15px] rounded-xl border border-[#D3DBD0] px-4 py-3 focus:border-[#145A41] focus:ring-2 focus:ring-[#145A41]/20 outline-none transition-all';
const LABEL = 'text-[11px] font-code-sm font-medium tracking-wider text-[#54675D] uppercase';
const RETURN_TO = encodeURIComponent('/settings');

type IgView = 'connected' | 'reconnect' | 'disconnecting' | 'unconnected';

/** Settings (Stitch "Settings"): the Instagram card in its four states, the profile form, and Delete my data. */
export function SettingsClient({ name, email, timeZone, connection, scheduledCount, flag }: {
  name: string; email: string; timeZone: string; connection: ConnectionView | null; scheduledCount: number; flag: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [conn, setConn] = useState(connection);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const igView: IgView = !conn ? 'unconnected' : ask ? 'disconnecting' : conn.status === 'needs_reconnect' ? 'reconnect' : 'connected';

  // Back from Instagram: say what happened once, then tidy the address.
  useEffect(() => {
    if (!flag) return;
    if (flag === 'connected') toast('success', connection ? `Instagram connected as @${connection.username}.` : 'Instagram connected.');
    if (flag === 'cancelled') setNote('You cancelled. No changes were made.');
    if (flag === 'error') setNote('Instagram did not finish connecting. Please try again.');
    if (flag === 'not_eligible') setNote('That account cannot post reels yet. In the Instagram app, go to Settings, then Account type and tools, and switch to a professional (Creator or Business) account. Then try again.');
    router.replace('/settings');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function disconnect() {
    setBusy(true);
    const res = await api<{ cancelledPosts: number }>('/api/instagram/connection', { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) { toast('error', res.error.message); return; }
    setConn(null); setAsk(false);
    toast('success', res.data.cancelledPosts ? `Instagram disconnected. ${res.data.cancelledPosts} scheduled ${res.data.cancelledPosts === 1 ? 'post was' : 'posts were'} cancelled.` : 'Instagram disconnected.');
    router.refresh();
  }

  return (
    <main className="w-full max-w-[1120px] mx-auto px-4 md:px-10 py-10">
      <div className="max-w-[720px] mx-auto flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-headline-lg text-4xl text-[#0F2A20] tracking-tight font-bold">Settings</h1>
          <p className="text-[15px] text-[#506359] leading-relaxed">Manage your Instagram connection, your profile and your data.</p>
        </header>

        <section aria-labelledby="section-instagram" className={SECTION}>
          <div className="border-b border-[#D3DBD0] pb-5">
            <h2 id="section-instagram" className="font-headline-md text-2xl text-[#0F2A20] tracking-tight font-bold">Instagram</h2>
            <p className="text-[15px] text-[#506359] mt-1.5">Reels made in Vidyareel are published to the Instagram account you connect here.</p>
          </div>

          {note && (
            <div role="status" className="p-3 rounded-xl bg-[#FFF9EE] border border-[#F5DCB7] text-[13px] text-[#0F2A20] flex items-start justify-between gap-3">
              <span>{note}</span>
              <button type="button" aria-label="Dismiss" onClick={() => setNote(null)} className="text-[#54675D] hover:text-[#0F2A20]"><span className="material-symbols-outlined text-[16px]">close</span></button>
            </div>
          )}

          {igView === 'connected' && conn && (
            <div className="bg-[#F6F8F5] rounded-2xl border border-[#D3DBD0] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-[#CBEADA] border border-[#D3DBD0] flex items-center justify-center relative shrink-0 text-[#0F2A20] font-semibold text-sm">
                  {conn.username.slice(0, 2).toUpperCase()}
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#1A8F5A] rounded-full ring-2 ring-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-bold text-[#0F2A20] truncate">@{conn.username}</h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E5F5EC] text-[#1A8F5A] text-[11px] font-code-sm font-medium"><span className="w-1.5 h-1.5 rounded-full bg-[#1A8F5A]" />Connected</span>
                  </div>
                  <p className="text-[11px] font-code-sm text-[#506359] mt-1">{conn.accountType === 'CREATOR' ? 'Creator' : 'Business'} account · connected {new Date(conn.connectedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 self-end sm:self-center">
                <a href={`/api/instagram/connect?returnTo=${RETURN_TO}`} className={SECONDARY}>Reconnect</a>
                <button type="button" onClick={() => setAsk(true)} className={DANGER_OUTLINE}>Disconnect</button>
              </div>
            </div>
          )}

          {igView === 'reconnect' && conn && (
            <div className="bg-[#FFF9F0] rounded-2xl border border-[#F3CCA1] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-[#FFE4C4] border border-[#F3CCA1] flex items-center justify-center shrink-0 text-[#B36B00]"><span className="material-symbols-outlined text-2xl">sync_problem</span></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-bold text-[#0F2A20] truncate">@{conn.username}</h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFEAD1] text-[#B36B00] text-[11px] font-code-sm font-medium"><span className="w-1.5 h-1.5 rounded-full bg-[#B36B00]" />Needs reconnect</span>
                  </div>
                  <p className="text-[13px] text-[#506359] mt-1">Instagram needs you to sign in again. Scheduled posts wait until you do.</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 self-end sm:self-center">
                <a href={`/api/instagram/connect?returnTo=${RETURN_TO}`} className="px-4 py-2 rounded-xl text-sm font-ui-medium bg-[#B36B00] text-white hover:bg-[#8F5500] transition-all">Reconnect →</a>
                <button type="button" onClick={() => setAsk(true)} className={DANGER_OUTLINE}>Disconnect</button>
              </div>
            </div>
          )}

          {igView === 'disconnecting' && (
            <div role="alertdialog" aria-label="Disconnect Instagram?" className="bg-[#FDF2F0] border border-[#F5C2BC] rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[#C93A2E] text-xl mt-0.5">warning</span>
                <div>
                  <p className="text-[15px] font-bold text-[#0F2A20]">Disconnect Instagram?</p>
                  <p className="text-[13px] text-[#506359] mt-0.5">
                    Vidyareel will forget your Instagram sign-in.{scheduledCount > 0 ? ` Your ${scheduledCount} scheduled ${scheduledCount === 1 ? 'post' : 'posts'} will be cancelled.` : ''} You can connect again any time.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setAsk(false)} className={SECONDARY}>Keep connected</button>
                <button type="button" onClick={disconnect} disabled={busy} className="px-4 py-2 rounded-xl text-sm font-ui-medium bg-[#C93A2E] text-white hover:bg-[#A82B21] transition-all disabled:opacity-60">{busy ? 'Disconnecting…' : 'Disconnect now'}</button>
              </div>
            </div>
          )}

          {igView === 'unconnected' && (
            <div className="bg-[#F6F8F5] rounded-2xl border border-dashed border-[#D3DBD0] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="max-w-md">
                <div className="flex items-center gap-2 mb-2"><span className="inline-block w-2 h-2 rounded-full bg-[#506359]" /><span className="text-[11px] font-code-sm text-[#506359] uppercase">No account linked</span></div>
                <h3 className="text-lg font-bold text-[#0F2A20]">Connect your Instagram account</h3>
                <p className="text-[13px] text-[#506359] mt-1">Connect a Creator or Business account to post your lesson reels straight from Vidyareel.</p>
                <p className="text-[11px] font-code-sm text-[#506359] mt-3">Personal accounts cannot publish. Use a professional account.</p>
              </div>
              <a href={`/api/instagram/connect?returnTo=${RETURN_TO}`} className="btn-lift px-5 py-2.5 rounded-xl text-sm font-ui-medium bg-[#145A41] text-white hover:bg-[#0F4632] transition-all flex items-center gap-2 shadow-sm whitespace-nowrap self-start sm:self-center">
                <span>Connect Instagram</span><span className="material-symbols-outlined text-base">arrow_forward</span>
              </a>
            </div>
          )}
        </section>

        <ProfileSection name={name} email={email} timeZone={timeZone} />
        <DataSection />
      </div>
    </main>
  );
}

function ProfileSection({ name, email, timeZone }: { name: string; email: string; timeZone: string }) {
  const router = useRouter();
  const toast = useToast();
  const [fullName, setFullName] = useState(name);
  const [zone, setZone] = useState(timeZone);
  const [busy, setBusy] = useState(false);
  const zones: string[] = (TIME_ZONES as readonly string[]).includes(timeZone) ? [...TIME_ZONES] : [timeZone, ...TIME_ZONES];
  const changed = fullName.trim() !== name || zone !== timeZone;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await api('/api/me', { method: 'PATCH', body: { name: fullName.trim(), timeZone: zone } });
    setBusy(false);
    if (!res.ok) { toast('error', res.error.message); return; }
    toast('success', 'Preferences saved.');
    router.refresh();
  }

  return (
    <section aria-labelledby="section-profile" className={SECTION}>
      <div className="border-b border-[#D3DBD0] pb-5">
        <h2 id="section-profile" className="font-headline-md text-2xl text-[#0F2A20] tracking-tight font-bold">Your profile</h2>
        <p className="text-[15px] text-[#506359] mt-1.5">Your name and the time zone used for scheduled posts and the daily video limit.</p>
      </div>
      <form onSubmit={save} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="full-name" className={LABEL}>Full name</label>
          <input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} required className={FIELD} />
          <p className="text-[13px] text-[#506359]">Signed in as {email}</p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="timezone" className={LABEL}>Time zone (for scheduled reels)</label>
          <div className="relative">
            <select id="timezone" value={zone} onChange={(e) => setZone(e.target.value)} className={`${FIELD} appearance-none pr-10 cursor-pointer`}>
              {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')} ({utcLabel(z)})</option>)}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#506359]">expand_more</span>
          </div>
          <p className="text-[11px] font-code-sm text-[#506359]">Used to work out when a scheduled reel goes out, and when your day starts.</p>
        </div>
        <div className="flex items-center justify-end pt-4 border-t border-[#D3DBD0]">
          <button type="submit" disabled={busy || !changed || !fullName.trim()} className="btn-lift px-6 py-2.5 rounded-xl text-sm font-ui-medium bg-[#145A41] text-white hover:bg-[#0F4632] shadow-sm transition-all flex items-center gap-2 disabled:opacity-60">
            <span>{busy ? 'Saving…' : 'Save changes'}</span><span className="material-symbols-outlined text-sm">done</span>
          </button>
        </div>
      </form>
    </section>
  );
}

function DataSection() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function purge() {
    setBusy(true);
    const res = await api('/api/me', { method: 'DELETE', body: { confirm: 'DELETE' } });
    setBusy(false);
    if (!res.ok) { toast('error', res.error.message); return; }
    router.push('/sign-in');
  }

  return (
    <section aria-labelledby="section-data" className={SECTION}>
      <div className="border-b border-[#D3DBD0] pb-5">
        <h2 id="section-data" className="font-headline-md text-2xl text-[#0F2A20] tracking-tight font-bold">Your data</h2>
        <p className="text-[15px] text-[#506359] mt-1.5">You decide what Vidyareel keeps.</p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="max-w-md">
            <h3 className="text-[15px] font-semibold text-[#C93A2E] flex items-center gap-1.5"><span className="material-symbols-outlined text-base">delete_sweep</span>Delete my data</h3>
            <p className="text-[13px] text-[#506359] mt-1 leading-relaxed">
              Removes your videos (their files are cleared after 7 days), forgets your Instagram sign-in, cancels scheduled posts and signs you out. Reels already on Instagram stay there. This cannot be undone.
            </p>
          </div>
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={`${DANGER_OUTLINE} whitespace-nowrap self-start`}>Delete my data</button>
        </div>
        {open && (
          <div className="bg-[#FCF3F2] border border-[#F5C2BC] rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-[#C93A2E]"><span className="material-symbols-outlined text-xl">gpp_maybe</span><p className="text-[15px] font-bold text-[#0F2A20]">Confirm deletion</p></div>
            <p className="text-[13px] text-[#506359]">Type <strong className="font-code-sm text-[#0F2A20] px-1 bg-white rounded border border-[#F5C2BC]">DELETE</strong> to confirm:</p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type DELETE" aria-label="Type DELETE to confirm" className="bg-white font-code-sm text-[15px] px-3.5 py-2.5 rounded-xl border border-[#D3DBD0] text-[#0F2A20] focus:outline-none focus:border-[#C93A2E] tracking-wider" />
              <button type="button" onClick={purge} disabled={busy || text.trim() !== 'DELETE'} className="px-4 py-2.5 rounded-xl text-sm font-ui-medium bg-[#C93A2E] text-white hover:bg-[#A82B21] transition-all disabled:opacity-40 disabled:cursor-not-allowed">{busy ? 'Deleting…' : 'Delete everything'}</button>
              <button type="button" onClick={() => { setOpen(false); setText(''); }} className="px-3 py-2 text-[13px] text-[#506359] hover:text-[#0F2A20]">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
