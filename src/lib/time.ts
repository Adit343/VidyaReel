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

/** How far `timeZone` is ahead of UTC at `at`, in ms (IST is +19,800,000). */
export function zoneOffsetMs(at: Date, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(at).map((x) => [x.type, Number(x.value)]),
  );
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at.getTime() / 1000) * 1000;
}

/** "2026-10-27" + "09:00" read as wall-clock time in `timeZone` -> the UTC instant. */
export function zonedToUtc(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - zoneOffsetMs(new Date(guess), timeZone);
  // Near a daylight-saving change the offset at the first guess can differ; one more pass settles it.
  return new Date(guess - zoneOffsetMs(new Date(first), timeZone));
}

/** The date ("2026-10-27") and time ("09:00") on the wall clock in `timeZone`. */
export function utcToZoned(at: Date, timeZone: string) {
  const local = new Date(at.getTime() + zoneOffsetMs(at, timeZone));
  const iso = local.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** "27 Oct 2026 at 9:00 AM" in `timeZone`. */
export function dateTimeLabel(iso: string, timeZone: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' });
  const t = d.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
  return `${day} at ${t}`;
}

/** "in 18h 24m", "in 5m", "any moment now". */
export function untilLabel(iso: string, now = Date.now()) {
  const m = Math.max(0, Math.round((new Date(iso).getTime() - now) / 60000));
  if (m < 1) return 'any moment now';
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return `in ${d ? `${d}d ` : ''}${d || h ? `${h}h ` : ''}${m % 60}m`;
}

/** "UTC+5:30" for the label of a time-zone choice. */
export function utcLabel(timeZone: string, at = new Date()) {
  const min = Math.round(zoneOffsetMs(at, timeZone) / 60000);
  const sign = min < 0 ? '-' : '+';
  const abs = Math.abs(min);
  return `UTC${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${String(abs % 60).padStart(2, '0')}` : ''}`;
}
