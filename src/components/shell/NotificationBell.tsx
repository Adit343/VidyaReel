'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { timeAgo } from '@/lib/time';
import type { Notice } from '@/server/notifications';

/** Bell + dropdown (Stitch shared components, section 02). Items come from the member's own videos. */
export function NotificationBell({ initial }: { initial: { items: Notice[]; unread: number } }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initial.items);
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => n.unread).length;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  async function markAllRead() {
    setItems((all) => all.map((n) => ({ ...n, unread: false })));
    await fetch('/api/notifications', { method: 'POST' }).catch(() => undefined);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label={unread ? `Open notifications, ${unread} unread` : 'Open notifications'} aria-expanded={open} aria-haspopup="true"
        onClick={() => setOpen(!open)}
        className="p-2 rounded-xl text-secondary hover:bg-surface-container-high hover:text-on-surface transition-colors relative flex items-center justify-center active:scale-[0.99]"
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF9F1C] ring-2 ring-white" data-testid="notif-dot" />}
      </button>
      {open && (
        <div className="absolute right-[-48px] sm:right-0 mt-2 w-[calc(100vw-2rem)] max-w-[24rem] sm:w-96 bg-white rounded-2xl border border-[#B9C5B5] overlay-ambient-shadow z-50 p-4" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between pb-3 border-b border-[#D3DBD0]">
            <div className="flex items-center gap-2">
              <span className="font-ui-medium text-ui-medium text-[#0F2A20]">Notifications</span>
              {unread > 0 && <span className="font-code-xs text-code-xs bg-[#145A41] text-white px-2 py-0.5 rounded-full">{unread}</span>}
            </div>
            {items.length > 0 ? (
              <button className="font-code-xs text-code-xs text-[#506359] hover:text-[#0F2A20] transition-colors disabled:opacity-50" onClick={markAllRead} disabled={unread === 0}>
                Mark all read
              </button>
            ) : <span className="font-code-xs text-code-xs text-[#54675D]">0 unread</span>}
          </div>
          {items.length === 0 ? (
            <div className="py-8 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-[#E1E7DF] border border-[#D3DBD0] flex items-center justify-center text-[#54675D] mb-3">
                <span className="material-symbols-outlined text-[24px]">notifications_off</span>
              </div>
              <p className="font-ui-medium text-ui-medium text-[#0F2A20]">You are all caught up.</p>
              <p className="font-body-sm text-body-sm text-[#54675D] mt-1 max-w-[220px]">New render milestones and Instagram posts will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E1E7DF]/70 max-h-[360px] overflow-y-auto">
              {items.map((n) => (
                <Link
                  key={n.id} href={n.href} onClick={() => setOpen(false)}
                  className={`py-3 flex items-start gap-3 -mx-2 px-2 rounded-xl transition-colors hover:bg-[#EEF1EC]/60 ${n.kind === 'error' && n.unread ? 'bg-[#FDF4F3]' : ''}`}
                >
                  <span className={`w-2.5 h-2.5 mt-1.5 rounded-full shrink-0 ${n.kind === 'error' ? 'bg-[#C93A2E]' : 'bg-[#1A8F5A]'} ${n.unread ? '' : 'opacity-40'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-ui-medium text-ui-medium truncate ${n.kind === 'error' ? 'text-[#C93A2E]' : 'text-[#0F2A20]'}`}>{n.title}</p>
                      <span className="font-code-xs text-code-xs text-[#54675D] shrink-0">{timeAgo(n.at)}</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-[#506359] mt-0.5 line-clamp-2">{n.body}</p>
                    {n.retry && <span className="font-code-xs text-code-xs text-[#C93A2E] font-semibold mt-1 inline-block">Try again →</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="pt-3 border-t border-[#D3DBD0] text-center">
            <Link href="/library" onClick={() => setOpen(false)} className="font-ui-medium text-ui-medium text-[#145A41] hover:underline">View all video activity →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
