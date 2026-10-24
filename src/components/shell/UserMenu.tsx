'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { initialsOf } from '@/lib/time';

/** Avatar pill and its menu (Stitch shared components, nav variant B). */
export function UserMenu({ user }: { user: { name: string; email: string; role: string } }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  async function signOut() {
    setBusy(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.href = '/sign-in';
  }

  return (
    <div className="relative" ref={ref}>
      <button
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} title={`Account: ${user.name}`}
        className="flex items-center gap-2 pl-1 group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#145A41] focus-visible:ring-offset-2"
      >
        <span className="relative">
          <span className="w-8 h-8 rounded-full bg-[#145A41] text-white font-ui-medium text-xs flex items-center justify-center font-bold tracking-tight ring-2 ring-white">
            {initialsOf(user.name)}
          </span>
          {isAdmin && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#1A8F5A] rounded-full ring-2 ring-white" title="Active" />}
        </span>
        <span className="hidden lg:flex flex-col text-left">
          <span className="font-ui-medium text-ui-medium text-[#0F2A20] leading-tight">{user.name}</span>
          {isAdmin && <span className="font-code-xs text-[10px] text-[#54675D] uppercase">Admin role</span>}
        </span>
        <span className={`hidden lg:block material-symbols-outlined text-[#54675D] text-[16px] transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-[#B9C5B5] overlay-ambient-shadow z-50 py-2">
          <div className="px-4 pt-2 pb-3 border-b border-[#D3DBD0]">
            <p className="font-ui-medium text-ui-medium text-[#0F2A20] truncate">{user.name}</p>
            <p className="font-code-xs text-code-xs text-[#54675D] truncate">{user.email}</p>
          </div>
          <div className="py-1">
            <MenuLink href="/settings" icon="settings" onClick={() => setOpen(false)}>Settings</MenuLink>
            {isAdmin && <MenuLink href="/admin" icon="admin_panel_settings" onClick={() => setOpen(false)}>Admin</MenuLink>}
          </div>
          <div className="border-t border-[#D3DBD0] pt-1">
            <button role="menuitem" onClick={signOut} disabled={busy} className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[14px] text-[#C93A2E] hover:bg-[#FDF4F3] disabled:opacity-60">
              <span className="material-symbols-outlined text-[18px]">logout</span>
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, icon, children, onClick }: { href: string; icon: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link role="menuitem" href={href} onClick={onClick} className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#0F2A20] hover:bg-[#EEF1EC]">
      <span className="material-symbols-outlined text-[18px] text-[#54675D]">{icon}</span>
      {children}
    </Link>
  );
}
