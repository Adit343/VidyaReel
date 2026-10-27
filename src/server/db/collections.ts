import type { ObjectId } from 'mongodb';
import type { Scene } from '@/lib/schemas/storyboard';
import type { VideoStatus } from '@/lib/schemas/video';
import type { Role } from '@/server/auth/approved';
import { db } from './client';

export type UserDoc = {
  _id: ObjectId; email: string; name: string; passwordHash?: string; googleId?: string;
  emailVerifiedAt?: Date; notificationsReadAt?: Date; timeZone: string; createdAt: Date; updatedAt: Date;
};
export type SessionDoc = { _id: ObjectId; userId: ObjectId; tokenHash: string; expiresAt: Date; userAgent?: string; createdAt: Date };
export type PasswordResetDoc = { _id: ObjectId; userId: ObjectId; tokenHash: string; expiresAt: Date; usedAt?: Date };
export type ApprovedEmailDoc = {
  _id: ObjectId; email: string; role: Role; dailyLimit: number; addedBy?: ObjectId; addedAt: Date; removedAt?: Date;
};
export type OauthStateDoc = { _id: ObjectId; state: string; purpose: 'google' | 'instagram'; codeVerifier?: string; userId?: ObjectId; returnTo?: string; expiresAt: Date };
export type RateLimitDoc = { _id: string; count: number; expiresAt: Date };

// The central document (docs/Database-Design.md section 4.3). Render fields are written by the render workflow.
export type VideoDoc = {
  _id: ObjectId; userId: ObjectId; title: string; status: VideoStatus; failureReason?: string;
  topic?: string; angle?: string; lengthSec?: number; language?: string; audience?: string;
  voiceId?: string; speed?: number; theme?: string; accent?: string; musicId?: string | null; musicVolume?: number; captionsOn?: boolean;
  caption?: string; hashtags?: string[]; estimatedSec?: number; safety?: { checkedAt: Date; result: 'ok' };
  scenes: Scene[]; outputKey?: string; thumbKey?: string; output?: { sizeBytes: number; validatedAt: Date; durationMs?: number };
  currentJobId?: ObjectId;
  version: number; createdAt: Date; updatedAt: Date; deletedAt?: Date;
};

export type RenderStage = 'load' | 'voice' | 'sync' | 'media' | 'props' | 'render' | 'upload' | 'finalise';

/** One render attempt (docs/Database-Design.md section 4.4). `active` is true only while queued or running. */
export type RenderJobDoc = {
  _id: ObjectId; videoId: ObjectId; userId: ObjectId; kind: 'full' | 'fix'; sceneIds?: string[];
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'; stage: RenderStage; progress: number; attempt: number;
  active?: true; idempotencyKey?: string; sandboxId?: string;
  error?: { code: string; message: string; step?: string; detail?: string }; warnings?: string[];
  outputKey?: string; thumbKey?: string; voiceCredits?: number; renderSec?: number;
  queuedAt: Date; startedAt?: Date; finishedAt?: Date;
};

/** Counts voice credits (and later other costs) per member; the monthly voice budget is the sum of these. */
export type UsageDoc = { _id: ObjectId; userId: ObjectId; videoId?: ObjectId; type: 'voice_credits'; amount: number; createdAt: Date };

/** Licence record for every stock clip, image or music track used (docs/Database-Design.md section 4.7). */
export type AssetDoc = {
  _id: ObjectId; videoId?: ObjectId; sceneId?: string;
  kind: 'clip' | 'image' | 'music' | 'icon'; source: 'pexels' | 'pixabay' | 'bundled';
  sourceId: string; sourceUrl: string; licence: string; attribution?: string; storageKey: string; createdAt: Date;
};

/** A member's connected Instagram account (docs/Database-Design.md section 4.5). The token is only ever stored encrypted. */
export type InstagramConnectionDoc = {
  _id: ObjectId; userId: ObjectId; igUserId: string; username: string; accountType: 'BUSINESS' | 'CREATOR'; profilePictureUrl?: string;
  tokenEnc: string; tokenIv: string; tokenTag: string; keyVersion: number; tokenExpiresAt: Date; scopes: string[];
  status: 'connected' | 'needs_reconnect'; lastRefreshAt?: Date; connectedAt: Date;
};

/** One post now or scheduled (docs/Database-Design.md section 4.6). `rev` changes on every reschedule or cancel so an older workflow run stops. */
export type PostDoc = {
  _id: ObjectId; videoId: ObjectId; userId: ObjectId; connectionId: ObjectId; caption: string; mode: 'now' | 'scheduled'; scheduledAt?: Date;
  status: 'scheduled' | 'publishing' | 'posted' | 'failed' | 'cancelled'; containerId?: string; igMediaId?: string; permalink?: string;
  lateByMs?: number; error?: { code: string; message: string }; retryCount: number; paused?: boolean; live?: true; rev: number;
  idempotencyKey?: string; createdAt: Date; updatedAt: Date;
};

export const assets = () => db().collection<AssetDoc>('assets');
export const users = () => db().collection<UserDoc>('users');
export const videos = () => db().collection<VideoDoc>('videos');
export const renderJobs = () => db().collection<RenderJobDoc>('render_jobs');
export const instagramConnections = () => db().collection<InstagramConnectionDoc>('instagram_connections');
export const posts = () => db().collection<PostDoc>('posts');
export const usageLog = () => db().collection<UsageDoc>('usage_log');
export const sessions = () => db().collection<SessionDoc>('sessions');
export const passwordResets = () => db().collection<PasswordResetDoc>('password_resets');
export const approvedEmails = () => db().collection<ApprovedEmailDoc>('approved_emails');
export const oauthStates = () => db().collection<OauthStateDoc>('oauth_states');
export const rateLimits = () => db().collection<RateLimitDoc>('rate_limits');
