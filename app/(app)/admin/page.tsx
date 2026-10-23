import { AdminMembers } from '@/components/AdminMembers';

export default function Page() {
  return (
    <main className="page" style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <span className="eyebrow">Members &amp; access</span>
        <h1 style={{ fontSize: 36 }}>Admin</h1>
        <p className="muted">Only approved emails can sign up or sign in. Removing a member signs them out immediately.</p>
      </div>
      <AdminMembers />
    </main>
  );
}
