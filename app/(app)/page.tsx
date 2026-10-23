import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/current-user';
import { approvedEmails } from '@/server/db/collections';

export default async function Page() {
  // Layouts and pages render in parallel, so the page checks the session itself.
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  const row = await approvedEmails().findOne({ email: user.email, removedAt: { $exists: false } });
  const limit = row?.dailyLimit ?? 5;
  const used = 0; // wired to usage_log in phase 2 (step 2.10)

  return (
    <main className="page" style={{ display: 'grid', gap: 24 }}>
      <section className="card hero">
        <span className="eyebrow">Create · 1080×1920 vertical</span>
        <h1 style={{ margin: '12px 0' }}>Turn today&apos;s lesson idea into a 60-second reel.</h1>
        <p className="muted" style={{ maxWidth: 560 }}>
          Describe a topic and Vidyareel will draft the script and storyboard for you to review. Video generation opens up in a later release.
        </p>
        <div className="row" style={{ marginTop: 16 }}>
          <Link href="/create" className="btn">Create video →</Link>
          <Link href="/library" className="btn btn-secondary">Open library</Link>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <span className="eyebrow">Daily production quota</span>
          <p className="font-display" style={{ fontSize: 32, fontWeight: 700, margin: '8px 0' }}>
            {used} <span className="muted" style={{ fontSize: 18 }}>/ {limit} today</span>
          </p>
          <div className="progress"><i style={{ width: `${(used / limit) * 100}%` }} /></div>
          <p className="eyebrow" style={{ marginTop: 12 }}>{limit - used} videos left today</p>
        </section>
        <section className="card">
          <span className="eyebrow">Connected delivery channel</span>
          <p style={{ margin: '8px 0' }}><strong>Instagram not connected</strong></p>
          <p className="muted">Connect your account in Settings when posting becomes available.</p>
        </section>
      </div>

      <section>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 24 }}>Recent videos</h2>
          <Link href="/library">View all in Library →</Link>
        </div>
        <div className="card empty">
          <strong>No videos yet</strong>
          <span className="muted">Your finished reels will show up here.</span>
        </div>
      </section>
    </main>
  );
}
