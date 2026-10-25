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
export type OauthStateDoc = { _id: ObjectId; state: string; purpose: 'google' | 'instagram'; codeVerifier?: string; userId?: ObjectId; expiresAt: Date };
export type RateLimitDoc = { _id: string; count: number; expiresAt: Date };

// The central document (docs/Database-Design.md section 4.3). Render fields are written by the render workflow.
export type VideoDoc = {
  _id: ObjectId; userId: ObjectId; title: string; status: VideoStatus; failureReason?: string;
  topic?: string; angle?: string; lengthSec?: number; language?: string; audience?: string;
  voiceId?: string; speed?: number; theme?: string; accent?: string; musicId?: string | null; captionsOn?: boolean;
  caption?: string; hashtags?: string[]; estimatedSec?: number; safety?: { checkedAt: Date; result: 'ok' };
  scenes: Scene[]; outputKey?: string; output?: { sizeBytes: number; validatedAt: Date };
  version: number; createdAt: Date; updatedAt: Date; deletedAt?: Date;
};

/** Licence record for every stock clip, image or music track used (docs/Database-Design.md section 4.7). */
export type AssetDoc = {
  _id: ObjectId; videoId?: ObjectId; sceneId?: string;
  kind: 'clip' | 'image' | 'music' | 'icon'; source: 'pexels' | 'pixabay' | 'bundled';
  sourceId: string; sourceUrl: string; licence: string; attribution?: string; storageKey: string; createdAt: Date;
};

export const assets = () => db().collection<AssetDoc>('assets');
export const users = () => db().collection<UserDoc>('users');
export const videos = () => db().collection<VideoDoc>('videos');
export const sessions = () => db().collection<SessionDoc>('sessions');
export const passwordResets = () => db().collection<PasswordResetDoc>('password_resets');
export const approvedEmails = () => db().collection<ApprovedEmailDoc>('approved_emails');
export const oauthStates = () => db().collection<OauthStateDoc>('oauth_states');
export const rateLimits = () => db().collection<RateLimitDoc>('rate_limits');
