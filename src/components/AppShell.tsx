'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Notice } from '@/server/notifications';
import { NotificationBell } from './shell/NotificationBell';
import { ToastProvider } from './shell/Toast';
import { UserMenu } from './shell/UserMenu';

const NAV = [
  { href: '/', label: 'Create', icon: 'movie_edit', match: (p: string) => p === '/' || p.startsWith('/create') || p.startsWith('/videos') },
  { href: '/library', label: 'Library', icon: 'folder_open', match: (p: string) => p.startsWith('/library') },
  { href: '/posts', label: 'Posts', icon: 'video_library', match: (p: string) => p.startsWith('/posts') },
];
const MOBILE_NAV = [
  { ...NAV[0], label: 'Studio' }, NAV[1], NAV[2],
  { href: '/settings', label: 'Settings', icon: 'tune', match: (p: string) => p.startsWith('/settings') },
];

type Props = {
  user: { name: string; email: string; role: string };
  quota: { used: number; limit: number };
  notices: { items: Notice[]; unread: number };
  children: React.ReactNode;
};

export function BrandMark() {
  return (
    <span className="flex items-center gap-2.5 group">
      <span className="w-8 h-8 rounded-xl bg-[#145A41] flex items-center justify-center relative shadow-sm transition-transform group-hover:scale-105">
        <span className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-white ml-0.5" />
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#FF9F1C]" />
      </span>
      <span className="font-headline-sm text-headline-sm tracking-tight text-[#0F2A20]">vidyareel</span>
    </span>
  );
}

export function AppShell({ user, quota, notices, children }: Props) {
  const path = usePathname();
  const full = quota.used >= quota.limit;
  const pct = Math.min(100, Math.round((quota.used / Math.max(1, quota.limit)) * 100));

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-[#EEF1EC] text-[#0F2A20] antialiased pb-20 md:pb-0">
        <header className="w-full bg-white border-b border-outline-variant sticky top-0 z-40">
          <div className="w-full max-w-[1120px] px-4 sm:px-6 md:px-0 mx-auto flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/" aria-label="Vidyareel home"><BrandMark /></Link>
              <nav aria-label="Main" className="hidden md:flex items-center gap-6">
                {NAV.map((n) => {
                  const on = n.match(path);
                  return (
                    <Link
                      key={n.href} href={n.href} aria-current={on ? 'page' : undefined}
                      className={on
                        ? 'text-primary-container font-ui-medium border-b-2 border-primary-container pb-1 text-ui-medium'
                        : 'text-secondary font-ui-medium hover:text-on-surface transition-colors text-ui-medium'}
                    >
                      {n.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2 bg-[#E1E7DF] text-[#0F2A20] px-2.5 sm:px-3 py-1 rounded-full border border-[#D3DBD0]" id="nav-quota-pill">
                <span className={`w-1.5 h-1.5 rounded-full ${full ? 'bg-[#FF9F1C]' : 'bg-[#145A41]'}`} />
                <span className="font-code-xs text-code-xs font-medium tracking-tight">
                  <span className="sm:hidden">{quota.used}/{quota.limit} today</span>
                  <span className="hidden sm:inline">{quota.used} of {quota.limit} videos today</span>
                </span>
                <span className="w-10 h-1.5 bg-[#D3DBD0] rounded-full overflow-hidden hidden sm:block">
                  <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: full ? '#FF9F1C' : '#145A41' }} />
                </span>
              </div>
              <NotificationBell initial={notices} />
              <div className="pl-1 sm:border-l border-[#D3DBD0]"><UserMenu user={user} /></div>
            </div>
          </div>
        </header>

        {children}

        <footer className="hidden md:block mt-16 border-t border-[#D3DBD0] bg-white py-6 text-xs">
          <div className="max-w-[1120px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-md bg-[#145A41] flex items-center justify-center">
                <span className="w-0 h-0 border-y-[3px] border-y-transparent border-l-[5px] border-l-white ml-0.5" />
              </span>
              <p className="text-[#54675D] font-body-sm">
                <strong className="text-[#0F2A20]">Vidyareel Atelier</strong> · Designed for approved educators.
              </p>
            </div>
            <div className="flex items-center gap-6 font-code-xs text-[#54675D]">
              <span className="flex items-center gap-1 text-[#1A8F5A]"><span className="w-1.5 h-1.5 rounded-full bg-[#1A8F5A]" />Invite-only workspace</span>
              <span className="text-[#D3DBD0]">|</span>
              <span className="text-[#8D9C93]">Solstice build</span>
            </div>
          </div>
        </footer>

        <nav aria-label="Mobile" className="md:hidden fixed bottom-0 left-0 w-full z-40 flex items-center justify-around px-2 py-1 bg-white border-t border-outline-variant/40">
          {MOBILE_NAV.map((n) => {
            const on = n.match(path);
            return (
              <Link
                key={n.href} href={n.href} aria-current={on ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1 transition-colors active:scale-[0.97] ${on ? 'text-primary bg-surface-container font-ui-medium' : 'text-secondary font-ui-regular hover:text-primary'}`}
              >
                <span className="material-symbols-outlined text-[20px]">{n.icon}</span>
                <span className="font-code-xs text-[11px] leading-tight">{n.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </ToastProvider>
  );
}
