import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { addApproved, listApproved, removeApproved, updateApproved } from '@/server/admin/approved-emails';
import { requireUser } from '@/server/auth';
import { login, signup } from '@/server/auth/service';
import { approvedEmails, sessions, users } from '@/server/db/collections';
import { jar } from './setup';
import { PASSWORD } from './helpers';

const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: AppError) => e.code);
const ADMIN_ID = '64b000000000000000000001';

describe('admin approved emails', () => {
  it('adds with role defaults, lowercases, and rejects duplicates', async () => {
    const a = await addApproved({ email: 'Teach@Example.com' }, ADMIN_ID);
    expect([a.email, a.role, a.dailyLimit]).toEqual(['teach@example.com', 'member', 5]);
    expect((await addApproved({ email: 'boss@example.com', role: 'admin' }, ADMIN_ID)).dailyLimit).toBe(20);
    expect(await code(addApproved({ email: 'teach@example.com' }, ADMIN_ID))).toBe('INVALID_STATE');
    expect((await listApproved()).map((i) => i.email)).toEqual(['teach@example.com', 'boss@example.com']);
  });
  it('updates role and daily limit', async () => {
    const a = await addApproved({ email: 'teach@example.com' }, ADMIN_ID);
    const u = await updateApproved(a.id, { role: 'admin', dailyLimit: 9 }, ADMIN_ID);
    expect([u.role, u.dailyLimit]).toEqual(['admin', 9]);
    expect(await code(updateApproved('nope', { dailyLimit: 3 }, ADMIN_ID))).toBe('NOT_FOUND');
  });
  it('removal sets removedAt, revokes sessions, and blocks the next request', async () => {
    const a = await addApproved({ email: 'teach@example.com' }, ADMIN_ID);
    await signup({ email: 'teach@example.com', name: 'T', password: PASSWORD });
    expect((await requireUser()).email).toBe('teach@example.com');

    await removeApproved(a.id, ADMIN_ID);
    expect((await approvedEmails().findOne({ email: 'teach@example.com' }))?.removedAt).toBeInstanceOf(Date);
    expect(await sessions().countDocuments()).toBe(0);
    expect(await code(requireUser())).toBe('UNAUTHENTICATED');
    expect(await code(login({ email: 'teach@example.com', password: PASSWORD }))).toBe('INVITE_ONLY');
    expect(await listApproved()).toEqual([]);
  });
  it('a removed member signed in elsewhere gets 403 (cookie kept, row removed)', async () => {
    await addApproved({ email: 'teach@example.com' }, ADMIN_ID);
    await signup({ email: 'teach@example.com', name: 'T', password: PASSWORD });
    await approvedEmails().updateOne({ email: 'teach@example.com' }, { $set: { removedAt: new Date() } });
    expect(await code(requireUser())).toBe('NOT_APPROVED');
  });
  it('re-inviting a removed email reactivates it', async () => {
    const a = await addApproved({ email: 'teach@example.com' }, ADMIN_ID);
    await removeApproved(a.id, ADMIN_ID);
    const again = await addApproved({ email: 'teach@example.com', dailyLimit: 7 }, ADMIN_ID);
    expect(again.dailyLimit).toBe(7);
    expect((await approvedEmails().findOne({ email: 'teach@example.com' }))?.removedAt).toBeUndefined();
  });
  it('protects the signed-in admin and the ADMIN_EMAIL owner', async () => {
    await addApproved({ email: 'boss@example.com', role: 'admin' }, ADMIN_ID);
    await signup({ email: 'boss@example.com', name: 'B', password: PASSWORD });
    const boss = (await users().findOne({ email: 'boss@example.com' }))!;
    const row = (await listApproved())[0];
    expect(await code(updateApproved(row.id, { role: 'member' }, String(boss._id)))).toBe('FORBIDDEN');
    expect(await code(removeApproved(row.id, String(boss._id)))).toBe('FORBIDDEN');

    const owner = await addApproved({ email: 'owner@example.com', role: 'admin' }, ADMIN_ID);
    expect(await code(removeApproved(owner.id, ADMIN_ID))).toBe('FORBIDDEN');
    expect(await code(updateApproved(owner.id, { role: 'member' }, ADMIN_ID))).toBe('FORBIDDEN');
    jar.clear();
  });
});
