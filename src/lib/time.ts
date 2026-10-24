/** "2m ago", "3h ago", "Yesterday", "12 Oct". */
export function timeAgo(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  if (h < 48) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** 125 -> "2:05" */
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export const initialsOf = (name: string) =>
  name.split(/[\s@.]+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';

/** "Today, 10:14 AM", "Yesterday", or "12 Oct" in the member's time zone. */
export function whenLabel(iso: string, timeZone = 'Asia/Kolkata', now = new Date()) {
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const then = new Date(iso);
  if (day(then) === day(now)) {
    return `Today, ${then.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })}`;
  }
  if (day(then) === day(new Date(now.getTime() - 24 * 3600e3))) return 'Yesterday';
  return then.toLocaleDateString('en-GB', { timeZone, day: 'numeric', month: 'short' });
}
