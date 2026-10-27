import { randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { instagramConnections, oauthStates, type InstagramConnectionDoc } from '@/server/db/collections';
import { cancelScheduledPosts, pauseScheduledPosts, resumePausedPosts, type PostDeps } from '@/server/posts/service';
import {
  authorizeUrl, exchangeCode, getProfile, InstagramError, normalizeAccountType, refreshToken, type Fetch,
} from './api';
import { decryptToken, encryptToken, KEY_VERSION } from './crypto';

const STATE_TTL_MS = 10 * 60_000;
const DEFAULT_RETURN = '/settings';
/** A token that expires within this window is renewed by the daily job (System Design 8.2). */
export const REFRESH_WINDOW_MS = 10 * 24 * 3600e3;

/** Account types allowed to post. Creator accounts passed the Phase 1 test (docs/Phase-1-Spike-Results.md). */
export const allowedTypes = () => (process.env.IG_ALLOWED_ACCOUNT_TYPES || 'BUSINESS,CREATOR').split(',').map((t) => t.trim().toUpperCase());

/** Only a path inside this app can be a return target; anything else becomes the Settings page. */
export function safeReturnTo(raw: string | null | undefined) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') && !/[\r\n]/.test(raw) ? raw : DEFAULT_RETURN;
}

const withFlag = (path: string, flag: string) => `${path}${path.includes('?') ? '&' : '?'}ig=${flag}`;

/** Steps 1 and 2 of the connect flow: a one-time state, then the Meta page to send the browser to (API-Design 10.1). */
export async function startConnect(userId: ObjectId, returnTo?: string | null) {
  const state = randomBytes(32).toString('base64url');
  await oauthStates().insertOne({
    _id: new ObjectId(), state, purpose: 'instagram', userId, returnTo: safeReturnTo(returnTo), expiresAt: new Date(Date.now() + STATE_TTL_MS),
  });
  return authorizeUrl(state);
}

export type ConnectDeps = PostDeps & { fetch?: Fetch };

/**
 * Steps 3 and 4 (API-Design 10.2). Always ends in a redirect target; the token never leaves the server. The state is
 * deleted as it is read, so a replayed or forged callback finds nothing.
 */
export async function finishConnect(
  userId: ObjectId, q: { code?: string | null; state?: string | null; error?: string | null }, deps: ConnectDeps,
): Promise<string> {
  const saved = q.state
    ? await oauthStates().findOneAndDelete({ state: q.state, purpose: 'instagram', userId, expiresAt: { $gt: new Date() } })
    : null;
  if (!saved) return withFlag(DEFAULT_RETURN, 'error');
  const back = safeReturnTo(saved.returnTo);
  if (q.error || !q.code) return withFlag(back, q.error === 'access_denied' || !q.error ? 'cancelled' : 'error');

  try {
    const token = await exchangeCode(q.code, deps.fetch);
    const profile = await getProfile(token.accessToken, deps.fetch);
    const accountType = normalizeAccountType(profile.accountType);
    if (!allowedTypes().includes(accountType)) return withFlag(back, 'not_eligible');

    const now = new Date();
    const doc: Omit<InstagramConnectionDoc, '_id'> = {
      userId, igUserId: profile.igUserId || token.igUserId, username: profile.username, accountType: accountType as 'BUSINESS' | 'CREATOR',
      ...(profile.profilePictureUrl ? { profilePictureUrl: profile.profilePictureUrl } : {}), ...encryptToken(token.accessToken),
      tokenExpiresAt: token.expiresAt, scopes: token.scopes, status: 'connected', lastRefreshAt: now, connectedAt: now,
    };
    await instagramConnections().replaceOne({ userId }, doc, { upsert: true });
    await resumePausedPosts(userId, deps);
    return withFlag(back, 'connected');
  } catch {
    return withFlag(back, 'error');
  }
}

/** The account card of API-Design 10.3. The token fields are never part of it. */
export type ConnectionView = {
  username: string; accountType: 'BUSINESS' | 'CREATOR'; profilePictureUrl: string | null; status: InstagramConnectionDoc['status'];
  connectedAt: string; tokenExpiresAt: string;
};

export async function getConnection(userId: ObjectId): Promise<{ connected: boolean; connection: ConnectionView | null }> {
  const c = await instagramConnections().findOne({ userId });
  if (!c) return { connected: false, connection: null };
  return {
    connected: true,
    connection: {
      username: c.username, accountType: c.accountType, profilePictureUrl: c.profilePictureUrl ?? null, status: c.status,
      connectedAt: c.connectedAt.toISOString(), tokenExpiresAt: c.tokenExpiresAt.toISOString(),
    },
  };
}

/** Disconnect: the connection and its encrypted token are deleted, and scheduled posts are cancelled (API-Design 10.4). */
export async function disconnect(userId: ObjectId, deps: PostDeps) {
  const cancelledPosts = await cancelScheduledPosts(userId, deps);
  await instagramConnections().deleteOne({ userId });
  return { cancelledPosts };
}

export type RefreshResult = { refreshed: number; failed: number; needsReconnect: number };

/**
 * Daily job: renew tokens that expire within 10 days and are at least a day old (Meta refuses younger ones). A dead
 * token moves the connection to `needs_reconnect` and pauses its scheduled posts; a network error is tried again tomorrow.
 */
export async function refreshDueTokens(f: Fetch = fetch, now = new Date()): Promise<RefreshResult> {
  const out: RefreshResult = { refreshed: 0, failed: 0, needsReconnect: 0 };
  const due = await instagramConnections().find({
    status: 'connected', tokenExpiresAt: { $lte: new Date(now.getTime() + REFRESH_WINDOW_MS) },
  }).toArray();
  for (const c of due) {
    const issued = c.lastRefreshAt ?? c.connectedAt;
    if (now.getTime() - issued.getTime() < 24 * 3600e3) continue;
    try {
      const fresh = await refreshToken(decryptToken(c), f, now);
      const profile = await getProfile(fresh.accessToken, f).catch(() => null);
      await instagramConnections().updateOne({ _id: c._id }, {
        $set: {
          ...encryptToken(fresh.accessToken), keyVersion: KEY_VERSION, tokenExpiresAt: fresh.expiresAt, lastRefreshAt: now,
          ...(profile?.profilePictureUrl ? { profilePictureUrl: profile.profilePictureUrl } : {}),
        },
      });
      out.refreshed += 1;
    } catch (e) {
      out.failed += 1;
      if (e instanceof InstagramError && e.kind === 'auth') {
        await instagramConnections().updateOne({ _id: c._id }, { $set: { status: 'needs_reconnect' } });
        await pauseScheduledPosts(c.userId);
        out.needsReconnect += 1;
      }
    }
  }
  // A token already past its expiry cannot be refreshed any more.
  const dead = await instagramConnections().find({ status: 'connected', tokenExpiresAt: { $lte: now } }).toArray();
  for (const c of dead) {
    await instagramConnections().updateOne({ _id: c._id }, { $set: { status: 'needs_reconnect' } });
    await pauseScheduledPosts(c.userId);
    out.needsReconnect += 1;
  }
  return out;
}
