import { log } from '@/lib/log';
import { emailProvider, type EmailProvider } from '@/server/email';

export const ALERT_FUNCTION_ID = 'alert-on-failure';

export type FailedEventData = { function_id?: string; run_id?: string; error?: { name?: string; message?: string } };

/**
 * Emails the admin when an Inngest function ends in failure (after its retries). Inngest Cloud has no built-in email
 * alert, so a function listens for `inngest/function.failed` and calls this. Only ids and the error message are sent,
 * never the event payload, which can hold a member's topic or caption.
 */
export async function sendFailureAlert(data: FailedEventData, mail: EmailProvider = emailProvider, to = process.env.ADMIN_EMAIL) {
  const fn = data.function_id ?? 'unknown function';
  // A failing alert must not trigger another alert.
  if (fn.endsWith(ALERT_FUNCTION_ID)) return { sent: false as const, reason: 'self' };
  if (!to) return { sent: false as const, reason: 'no admin email' };
  const message = (data.error?.message ?? 'No message').slice(0, 300);
  await mail.send({
    to,
    subject: `Vidyareel: ${fn} failed`,
    text: [
      `A background job failed after all retries.`, '',
      `Function: ${fn}`, `Run id: ${data.run_id ?? 'unknown'}`, `Error: ${data.error?.name ?? 'Error'}: ${message}`, '',
      `Open the run in Inngest Cloud (Runs, search the run id) or the Vercel logs (search "level":"error").`,
    ].join('\n'),
  });
  log('info', 'failure alert sent', { function: fn, runId: data.run_id });
  return { sent: true as const };
}
