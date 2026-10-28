import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '@/lib/errors';
import { log } from '@/lib/log';
import { db } from '@/server/db/client';
import { assertApproved, normalizeEmail } from './approved';
import { createSession } from './sessions';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const redirectUri = () => `${process.env.APP_URL?.trim().replace(/\/+$/, '')}/api/auth/google/callback`;

/** Returns the Google URL to redirect to; stores state + PKCE verifier. */
export async function startGoogle(): Promise<string> {
  const state = randomBytes(24).toString('base64url');
  const codeVerifier = randomBytes(32).toString('base64url');
  await db().collection('oauth_states').insertOne({
    state, purpose: 'google', codeVerifier, expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri(), response_type: 'code',
    scope: 'openid email profile', state, prompt: 'select_account',
    code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'), code_challenge_method: 'S256',
  });
  return `${AUTH_URL}?${params}`;
}

export async function finishGoogle(code: string, state: string, userAgent?: string) {
  const saved = await db().collection('oauth_states').findOneAndDelete({ state, purpose: 'google', expiresAt: { $gt: new Date() } });
  if (!saved) throw new AppError('INVALID', 'Sign-in expired. Try again.', 400);

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(), grant_type: 'authorization_code', code_verifier: saved.codeVerifier,
    }),
  });
  if (!tokenRes.ok) {
    // Google's reason (invalid_client, redirect_uri_mismatch, ...) holds no secrets and is the only way to tell a bad secret from a bad redirect.
    const body = (await tokenRes.json().catch(() => ({}))) as { error?: string; error_description?: string };
    log('error', 'google token exchange failed', { status: tokenRes.status, google: body.error, description: body.error_description, redirectUri: redirectUri() });
    throw new AppError('INVALID', 'Google sign-in failed.', 400);
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const info = (await (await fetch(USERINFO_URL, { headers: { authorization: `Bearer ${access_token}` } })).json()) as
    { sub: string; email?: string; email_verified?: boolean; name?: string };
  if (!info.email || !info.email_verified) throw new AppError('INVALID', 'Google email is not verified.', 400);

  const email = normalizeEmail(info.email);
  // Name the refused account so the sign-in screen can say which Google account was used.
  await assertApproved(email).catch((e) => {
    throw e instanceof AppError && e.code === 'INVITE_ONLY' ? new AppError(e.code, e.message, e.status, undefined, { email }) : e;
  });

  const users = db().collection('users');
  const now = new Date();
  // Link to an existing account by email, or create a Google-only account.
  const res = await users.findOneAndUpdate(
    { email },
    {
      $set: { googleId: info.sub, emailVerifiedAt: now, updatedAt: now },
      $setOnInsert: { email, name: info.name ?? email, timeZone: 'Asia/Kolkata', createdAt: now },
    },
    { upsert: true, returnDocument: 'after' },
  );
  await createSession(res!._id, userAgent);
}
