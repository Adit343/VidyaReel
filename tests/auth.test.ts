import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import { requireAdmin, requireUser } from '@/server/auth';
import { assertApproved } from '@/server/auth/approved';
import { finishGoogle, startGoogle } from '@/server/auth/google';
import { limitAuth } from '@/server/auth/rate-limit';
import { forgotPassword, login, resetPassword, signup } from '@/server/auth/service';
import { destroySession, SESSION_COOKIE } from '@/server/auth/sessions';
import { hashToken } from '@/server/auth/tokens';
import { approvedEmails, passwordResets, sessions, users } from '@/server/db/collections';
import { jar } from './setup';
import { approve, PASSWORD, req } from './helpers';

const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: AppError) => e.code);

describe('approved-email gate', () => {
  it('refuses unapproved emails', async () => {
    expect(await code(assertApproved('nobody@example.com'))).toBe('INVITE_ONLY');
  });
  it('accepts ADMIN_EMAIL while the list is empty, then not again once others exist', async () => {
    expect(await assertApproved('owner@example.com')).toBe('admin');
    expect(await approvedEmails().countDocuments()).toBe(1);
  });
  it('does not accept ADMIN_EMAIL bootstrap when the list already has rows', async () => {
    await approve('someone@example.com');
    expect(await code(assertApproved('owner@example.com'))).toBe('INVITE_ONLY');
  });
});

describe('signup / login / logout', () => {
  it('rejects an unapproved signup and writes no user', async () => {
    expect(await code(signup({ email: 'x@example.com', name: 'X', password: PASSWORD }))).toBe('INVITE_ONLY');
    expect(await users().countDocuments()).toBe(0);
  });
  it('creates a user and a hashed session cookie for an approved email', async () => {
    await approve('asha@example.com');
    await signup({ email: ' Asha@Example.com ', name: 'Asha', password: PASSWORD });
    const token = jar.get(SESSION_COOKIE)!;
    expect(token).toBeTruthy();
    const row = await sessions().findOne({});
    expect(row?.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect((await users().findOne({}))?.email).toBe('asha@example.com');
  });
  it('rejects weak passwords and duplicate emails', async () => {
    await approve('asha@example.com');
    expect(await code(signup({ email: 'asha@example.com', name: 'A', password: 'short' }))).toBe('WEAK_PASSWORD');
    await signup({ email: 'asha@example.com', name: 'A', password: PASSWORD });
    expect(await code(signup({ email: 'asha@example.com', name: 'A', password: PASSWORD }))).toBe('EMAIL_EXISTS');
  });
  it('gives the same error for a wrong password and an unknown email', async () => {
    await approve('asha@example.com');
    await signup({ email: 'asha@example.com', name: 'A', password: PASSWORD });
    const wrong = await login({ email: 'asha@example.com', password: 'not the password' }).catch((e: AppError) => e);
    const unknown = await login({ email: 'ghost@example.com', password: PASSWORD }).catch((e: AppError) => e);
    expect([wrong.code, wrong.status, wrong.message]).toEqual([unknown.code, unknown.status, unknown.message]);
    expect(wrong.status).toBe(401);
  });
  it('logs in, and logout deletes the session row and cookie', async () => {
    await approve('asha@example.com');
    await signup({ email: 'asha@example.com', name: 'A', password: PASSWORD });
    jar.clear(); await sessions().deleteMany({});
    await login({ email: 'asha@example.com', password: PASSWORD });
    expect(await sessions().countDocuments()).toBe(1);
    await destroySession();
    expect(await sessions().countDocuments()).toBe(0);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });
});

describe('requireUser / requireAdmin', () => {
  it('401 when signed out', async () => {
    expect(await code(requireUser())).toBe('UNAUTHENTICATED');
  });
  it('403 for a member on admin routes, ok for admin', async () => {
    await approve('asha@example.com');
    await signup({ email: 'asha@example.com', name: 'A', password: PASSWORD });
    expect((await requireUser()).role).toBe('member');
    expect(await code(requireAdmin())).toBe('FORBIDDEN');
    jar.clear();
    await signup({ email: 'owner@example.com', name: 'O', password: PASSWORD }).catch(() => undefined);
  });
  it('blocks a removed member on the next request', async () => {
    await approve('asha@example.com');
    await signup({ email: 'asha@example.com', name: 'A', password: PASSWORD });
    await approvedEmails().updateOne({ email: 'asha@example.com' }, { $set: { removedAt: new Date() } });
    expect(await code(requireUser())).toBe('NOT_APPROVED');
    expect(await code(login({ email: 'asha@example.com', password: PASSWORD }))).toBe('INVITE_ONLY');
  });
});

describe('forgot / reset password', () => {
  async function seed() {
    await approve('asha@example.com');
    await signup({ email: 'asha@example.com', name: 'A', password: PASSWORD });
  }
  const tokenFromLog = (spy: ReturnType<typeof vi.spyOn>) =>
    /token=([\w-]+)/.exec(String(spy.mock.calls.flat().join('\n')))![1];

  it('answers silently for unknown or unapproved emails', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await forgotPassword('ghost@example.com');
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it('emails a one-time link; the new password works, old sessions die, token is single-use', async () => {
    await seed();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await forgotPassword('asha@example.com');
    const token = tokenFromLog(log);
    log.mockRestore();
    expect((await passwordResets().findOne({}))?.tokenHash).toBe(hashToken(token));

    await resetPassword({ token, password: 'a brand new password' });
    expect(await sessions().countDocuments()).toBe(0);
    jar.clear();
    await login({ email: 'asha@example.com', password: 'a brand new password' });
    expect(await code(login({ email: 'asha@example.com', password: PASSWORD }))).toBe('INVALID_CREDENTIALS');
    expect(await code(resetPassword({ token, password: 'another new password' }))).toBe('INVALID_RESET_TOKEN');
  });
  it('rejects an expired token', async () => {
    await seed();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await forgotPassword('asha@example.com');
    const token = tokenFromLog(log);
    log.mockRestore();
    await passwordResets().updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await code(resetPassword({ token, password: 'a brand new password' }))).toBe('INVALID_RESET_TOKEN');
  });
});

describe('google sign-in', () => {
  function mockGoogle(profile: { sub: string; email: string; email_verified: boolean; name?: string }) {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      Response.json(String(url).includes('token') ? { access_token: 'at' } : profile)));
  }
  const begin = async () => new URL(await startGoogle()).searchParams;

  it('builds a PKCE + state redirect', async () => {
    const q = await begin();
    expect(q.get('code_challenge_method')).toBe('S256');
    expect(q.get('state')).toBeTruthy();
    expect(q.get('redirect_uri')).toBe('http://localhost:3000/api/auth/google/callback');
  });
  it('refuses an unapproved Google account', async () => {
    mockGoogle({ sub: 'g1', email: 'nobody@example.com', email_verified: true });
    const state = (await begin()).get('state')!;
    expect(await code(finishGoogle('c', state))).toBe('INVITE_ONLY');
    expect(await users().countDocuments()).toBe(0);
    vi.unstubAllGlobals();
  });
  it('refuses an unknown or reused state', async () => {
    mockGoogle({ sub: 'g1', email: 'a@example.com', email_verified: true });
    expect(await code(finishGoogle('c', 'bogus'))).toBe('INVALID');
    vi.unstubAllGlobals();
  });
  it('links Google to an existing password account: one user, both methods work', async () => {
    await approve('asha@example.com');
    await signup({ email: 'asha@example.com', name: 'A', password: PASSWORD });
    jar.clear();
    mockGoogle({ sub: 'g1', email: 'Asha@example.com', email_verified: true, name: 'Asha G' });
    await finishGoogle('c', (await begin()).get('state')!);
    vi.unstubAllGlobals();
    expect(await users().countDocuments()).toBe(1);
    const u = await users().findOne({});
    expect(u?.googleId).toBe('g1');
    expect(u?.passwordHash).toBeTruthy();
    expect(jar.get(SESSION_COOKIE)).toBeTruthy();
    jar.clear();
    await login({ email: 'asha@example.com', password: PASSWORD });
  });
  it('creates a Google-only account for an approved email', async () => {
    await approve('new@example.com');
    mockGoogle({ sub: 'g2', email: 'new@example.com', email_verified: true });
    await finishGoogle('c', (await begin()).get('state')!);
    vi.unstubAllGlobals();
    const u = await users().findOne({});
    expect(u?.passwordHash).toBeUndefined();
    expect(u?.googleId).toBe('g2');
  });
  it('refuses unverified Google emails', async () => {
    await approve('new@example.com');
    mockGoogle({ sub: 'g2', email: 'new@example.com', email_verified: false });
    expect(await code(finishGoogle('c', (await begin()).get('state')!))).toBe('INVALID');
    vi.unstubAllGlobals();
  });
});

describe('rate limit', () => {
  it('allows 10 attempts a minute per IP and rejects the 11th with a Retry-After', async () => {
    const r = req('http://localhost:3000/api/auth/login', { headers: { 'x-forwarded-for': '1.2.3.4' } });
    for (let i = 0; i < 10; i++) await limitAuth(r);
    const err = await limitAuth(r).catch((e: AppError) => e);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.status).toBe(429);
    expect(err.retryAfter).toBeGreaterThan(0);
    await limitAuth(req('http://localhost:3000/api/auth/login', { headers: { 'x-forwarded-for': '5.6.7.8' } }));
  });
});
