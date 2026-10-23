'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Logo } from './Logo';

const NAV = [{ href: '/', label: 'Create' }, { href: '/library', label: 'Library' }];

export function AppShell({ user, children }: { user: { name: string; email: string; role: string }; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const initials = (user.name || user.email).split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const current = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  async function signOut() {
    setBusy(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.href = '/sign-in';
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Logo />
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => <Link key={n.href} href={n.href} aria-current={current(n.href) ? 'page' : undefined}>{n.label}</Link>)}
            {user.role === 'admin' && <Link href="/admin" aria-current={current('/admin') ? 'page' : undefined}>Admin</Link>}
          </nav>
          <div className="menu">
            <button className="btn btn-ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} style={{ padding: 4, gap: 10 }}>
              <span className="avatar">{initials}</span>
              <span className="muted" style={{ fontWeight: 600 }}>{user.name}</span>
            </button>
            {open && (
              <div className="menu-panel" role="menu">
                <span className="eyebrow" style={{ padding: '6px 10px' }}>{user.email}</span>
                <Link href="/settings" role="menuitem" onClick={() => setOpen(false)}>Settings</Link>
                <button role="menuitem" onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>
              </div>
            )}
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
