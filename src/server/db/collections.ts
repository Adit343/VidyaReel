import type { ObjectId } from 'mongodb';
import type { Role } from '@/server/auth/approved';
import { db } from './client';

export type UserDoc = {
  _id: ObjectId; email: string; name: string; passwordHash?: string; googleId?: string;
  emailVerifiedAt?: Date; timeZone: string; createdAt: Date; updatedAt: Date;
};
export type SessionDoc = { _id: ObjectId; userId: ObjectId; tokenHash: string; expiresAt: Date; userAgent?: string; createdAt: Date };
export type PasswordResetDoc = { _id: ObjectId; userId: ObjectId; tokenHash: string; expiresAt: Date; usedAt?: Date };
export type ApprovedEmailDoc = {
  _id: ObjectId; email: string; role: Role; dailyLimit: number; addedBy?: ObjectId; addedAt: Date; removedAt?: Date;
};
export type OauthStateDoc = { _id: ObjectId; state: string; purpose: 'google' | 'instagram'; codeVerifier?: string; userId?: ObjectId; expiresAt: Date };
export type RateLimitDoc = { _id: string; count: number; expiresAt: Date };

export const users = () => db().collection<UserDoc>('users');
export const sessions = () => db().collection<SessionDoc>('sessions');
export const passwordResets = () => db().collection<PasswordResetDoc>('password_resets');
export const approvedEmails = () => db().collection<ApprovedEmailDoc>('approved_emails');
export const oauthStates = () => db().collection<OauthStateDoc>('oauth_states');
export const rateLimits = () => db().collection<RateLimitDoc>('rate_limits');
