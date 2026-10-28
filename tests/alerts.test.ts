import { describe, expect, it } from 'vitest';
import { sendFailureAlert } from '@/server/alerts';

const box = () => {
  const sent: { to: string; subject: string; text: string }[] = [];
  return { sent, mail: { send: async (m: { to: string; subject: string; text: string }) => { sent.push(m); } } };
};

describe('failure alert', () => {
  it('emails the admin the function, run id and error', async () => {
    const { sent, mail } = box();
    const r = await sendFailureAlert({ function_id: 'vidyareel-render-video', run_id: 'RUN1', error: { name: 'Error', message: 'Sandbox timed out' } }, mail, 'admin@example.com');
    expect(r.sent).toBe(true);
    expect(sent[0]).toMatchObject({ to: 'admin@example.com', subject: 'Vidyareel: vidyareel-render-video failed' });
    expect(sent[0].text).toContain('RUN1');
    expect(sent[0].text).toContain('Sandbox timed out');
  });
  it('never alerts about its own failure, and needs an admin address', async () => {
    const { sent, mail } = box();
    expect(await sendFailureAlert({ function_id: 'vidyareel-alert-on-failure' }, mail, 'a@example.com')).toMatchObject({ sent: false });
    expect(await sendFailureAlert({ function_id: 'x' }, mail, '')).toMatchObject({ sent: false });
    expect(sent).toEqual([]);
  });
  it('cuts long error messages', async () => {
    const { sent, mail } = box();
    await sendFailureAlert({ function_id: 'x', error: { message: 'e'.repeat(2000) } }, mail, 'a@example.com');
    expect(sent[0].text.length).toBeLessThan(700);
  });
});
