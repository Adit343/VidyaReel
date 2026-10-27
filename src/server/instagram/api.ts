import type { Connection, SocialPublisher } from '@/server/providers';

// Instagram API with Instagram Login (the route proved in docs/Phase-1-Spike-Results.md, experiment 5).
const ROOT = 'https://graph.instagram.com';
const GRAPH = `${ROOT}/v23.0`;
const AUTHORIZE = 'https://www.instagram.com/oauth/authorize';
const TOKEN = 'https://api.instagram.com/oauth/access_token';
export const SCOPES = ['instagram_business_basic', 'instagram_business_content_publish'] as const;

export type Fetch = typeof fetch;

/**
 * `auth`: the token is expired or revoked (the member must reconnect). `rejected`: Instagram refused the request
 * for a reason retrying will not change. `transient`: network, 5xx or a rate limit (safe to retry).
 */
export class InstagramError extends Error {
  constructor(public kind: 'auth' | 'rejected' | 'transient', message: string, public status = 0, public code?: number) {
    super(message);
  }
}

type GraphBody = { error?: { message?: string; type?: string; code?: number; error_subcode?: number; error_user_msg?: string } };

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & GraphBody;
  if (res.ok && !body.error) return body;
  const e = body.error;
  const text = e?.error_user_msg ?? e?.message ?? `Instagram answered ${res.status}`;
  if (e?.code === 190 || (e?.type === 'OAuthException' && (e?.code === 102 || res.status === 401))) throw new InstagramError('auth', text, res.status, e?.code);
  // 4, 17, 32 and 613 are Meta's rate-limit codes.
  if (res.status >= 500 || res.status === 429 || (e?.code !== undefined && [1, 2, 4, 17, 32, 613].includes(e.code))) throw new InstagramError('transient', text, res.status, e?.code);
  throw new InstagramError('rejected', text, res.status, e?.code);
}

async function send<T>(f: Fetch, url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try { res = await f(url, init); } catch { throw new InstagramError('transient', 'Could not reach Instagram.'); }
  return parse<T>(res);
}

const form = (params: Record<string, string>) => ({
  method: 'POST', body: new URLSearchParams(params), headers: { 'content-type': 'application/x-www-form-urlencoded' },
});

export const redirectUri = () => process.env.META_REDIRECT_URI || `${process.env.APP_URL}/api/instagram/callback`;

export function authorizeUrl(state: string) {
  const appId = process.env.META_APP_ID;
  if (!appId) throw new Error('META_APP_ID is not set.');
  return `${AUTHORIZE}?${new URLSearchParams({
    client_id: appId, redirect_uri: redirectUri(), response_type: 'code', scope: SCOPES.join(','), state,
  })}`;
}

export type Profile = { igUserId: string; username: string; accountType: string; profilePictureUrl?: string };
export type LongLivedToken = { accessToken: string; expiresAt: Date; igUserId: string; scopes: string[] };

/** Code -> short-lived token -> long-lived token (about 60 days), all on the server with the app secret. */
export async function exchangeCode(code: string, f: Fetch = fetch, now = new Date()): Promise<LongLivedToken> {
  const { META_APP_ID: appId, META_APP_SECRET: secret } = process.env;
  if (!appId || !secret) throw new Error('META_APP_ID and META_APP_SECRET must be set.');
  type Short = { access_token?: string; user_id?: string | number; permissions?: string | string[]; data?: Short[] };
  const raw = await send<Short>(f, TOKEN, form({
    client_id: appId, client_secret: secret, grant_type: 'authorization_code', redirect_uri: redirectUri(), code: code.replace(/#_$/, ''),
  }));
  const short = raw.data?.[0] ?? raw;
  if (!short.access_token || short.user_id === undefined) throw new InstagramError('rejected', 'Instagram did not return a token.');
  const long = await send<{ access_token: string; expires_in: number }>(f, `${ROOT}/access_token?${new URLSearchParams({
    grant_type: 'ig_exchange_token', client_secret: secret, access_token: short.access_token,
  })}`);
  const perms = Array.isArray(short.permissions) ? short.permissions : (short.permissions ?? '').split(',').filter(Boolean);
  return { accessToken: long.access_token, expiresAt: new Date(now.getTime() + long.expires_in * 1000), igUserId: String(short.user_id), scopes: perms };
}

/** Long-lived tokens refresh into a new 60 day token once they are at least a day old. */
export async function refreshToken(token: string, f: Fetch = fetch, now = new Date()) {
  const r = await send<{ access_token: string; expires_in: number }>(f, `${ROOT}/refresh_access_token?${new URLSearchParams({
    grant_type: 'ig_refresh_token', access_token: token,
  })}`);
  return { accessToken: r.access_token, expiresAt: new Date(now.getTime() + r.expires_in * 1000) };
}

export async function getProfile(token: string, f: Fetch = fetch): Promise<Profile> {
  const r = await send<{ user_id?: string; id?: string; username?: string; account_type?: string; profile_picture_url?: string }>(
    f, `${GRAPH}/me?${new URLSearchParams({ fields: 'user_id,username,account_type,profile_picture_url', access_token: token })}`,
  );
  return { igUserId: String(r.user_id ?? r.id ?? ''), username: r.username ?? '', accountType: r.account_type ?? '', profilePictureUrl: r.profile_picture_url };
}

/** Meta calls a Creator account `MEDIA_CREATOR`; the app uses `BUSINESS` or `CREATOR`. Personal accounts come back as something else. */
export const normalizeAccountType = (t: string) => (t === 'MEDIA_CREATOR' ? 'CREATOR' : t);

// Meta's own words are in English but cryptic; the common ones in plain language.
const CONTAINER_REASONS: Record<string, string> = {
  '2207026': 'Instagram does not support this video format.',
  '2207003': 'Instagram could not download the video in time.',
  '2207032': 'Instagram could not create the reel from this video.',
  '2207057': 'The video is too long or too short for a reel.',
};
function containerReason(status?: string) {
  const code = status?.match(/\b(22070\d\d)\b/)?.[1];
  return (code && CONTAINER_REASONS[code]) || `Instagram did not accept this video${status ? ` (${status.slice(0, 120)})` : ''}.`;
}

export function createInstagramPublisher(f: Fetch = fetch): SocialPublisher {
  const get = <T>(c: Connection, path: string, fields: string) =>
    send<T>(f, `${GRAPH}/${path}?${new URLSearchParams({ fields, access_token: c.accessToken })}`);
  return {
    async createContainer(c, videoUrl, caption) {
      const r = await send<{ id: string }>(f, `${GRAPH}/${c.igUserId}/media`, form({
        media_type: 'REELS', video_url: videoUrl, caption, access_token: c.accessToken,
      }));
      return r.id;
    },
    async status(c, containerId) {
      const r = await get<{ status_code?: string }>(c, containerId, 'status_code');
      if (r.status_code === 'FINISHED' || r.status_code === 'IN_PROGRESS') return r.status_code;
      if (r.status_code === 'ERROR' || r.status_code === 'EXPIRED') return 'ERROR';
      return 'IN_PROGRESS';
    },
    async statusMessage(c, containerId) {
      const r = await get<{ status?: string }>(c, containerId, 'status');
      return containerReason(r.status);
    },
    async publish(c, containerId) {
      const r = await send<{ id: string }>(f, `${GRAPH}/${c.igUserId}/media_publish`, form({ creation_id: containerId, access_token: c.accessToken }));
      const info = await get<{ permalink?: string }>({ ...c }, r.id, 'permalink').catch(() => ({ permalink: undefined }));
      return { mediaId: r.id, permalink: info.permalink ?? '' };
    },
  };
}
