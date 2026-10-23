import Link from 'next/link';

const FILTERS = ['All', 'Drafts', 'Ready', 'Posted'];

export default function Page() {
  return (
    <main className="page" style={{ display: 'grid', gap: 24 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <span className="eyebrow">Your reels</span>
          <h1 style={{ fontSize: 36 }}>Library</h1>
        </div>
        <Link href="/create" className="btn">Create video</Link>
      </div>
      <div className="row">
        <input className="input" style={{ maxWidth: 360 }} placeholder="Search videos" aria-label="Search videos" disabled />
        {FILTERS.map((f, i) => <span key={f} className={`chip${i === 0 ? ' on' : ''}`}>{f}</span>)}
      </div>
      <div className="card empty">
        <h2 style={{ fontSize: 22 }}>Your library is empty</h2>
        <span className="muted">Videos you create will appear here with their status.</span>
        <Link href="/create" className="btn">Create your first video</Link>
      </div>
    </main>
  );
}
