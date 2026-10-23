import { Logo } from './Logo';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="auth">
      <div className="auth-form">
        <Logo />
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="muted" style={{ margin: '8px 0 0' }}>{subtitle}</p>}
        </div>
        {children}
      </div>
      <aside className="auth-art" aria-hidden>
        <span className="eyebrow" style={{ color: '#8dcfaf' }}>Educator video studio</span>
        <h2>Turn a lesson idea into a 60-second reel.</h2>
        <span className="eyebrow" style={{ color: '#8dcfaf' }}>Invite-only workspace</span>
      </aside>
    </main>
  );
}
