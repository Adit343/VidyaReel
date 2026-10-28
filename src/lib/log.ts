type Level = 'info' | 'warn' | 'error';

/** One JSON line per event, so Vercel's log search can filter on `level`, `msg` or any field. Never pass tokens or personal data. */
export function log(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, msg, ...fields, at: new Date().toISOString() });
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

/** The part of an unknown error that is safe and useful to log. */
export const errorFields = (e: unknown) => (e instanceof Error ? { error: e.message.slice(0, 300), stack: e.stack?.split('\n').slice(1, 4).join(' | ') } : { error: String(e).slice(0, 300) });
