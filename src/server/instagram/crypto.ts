import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Version of `IG_TOKEN_KEY` written beside every token, so a key rotation script knows what to re-encrypt. */
export const KEY_VERSION = 1;

export type EncryptedToken = { tokenEnc: string; tokenIv: string; tokenTag: string; keyVersion: number };

/** `IG_TOKEN_KEY` is 32 random bytes written as 64 hex characters or as base64 (docs/System-Design.md 8.2). */
function key(raw = process.env.IG_TOKEN_KEY): Buffer {
  if (!raw) throw new Error('IG_TOKEN_KEY is not set. Make one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('IG_TOKEN_KEY must be 32 bytes (64 hex characters or base64).');
  return buf;
}

/** AES-256-GCM with a fresh random IV for every token. */
export function encryptToken(token: string, rawKey?: string): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(rawKey), iv);
  const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return { tokenEnc: enc.toString('base64'), tokenIv: iv.toString('base64'), tokenTag: cipher.getAuthTag().toString('base64'), keyVersion: KEY_VERSION };
}

/** Throws if the key is wrong or the stored value was changed. Only workflow steps and the publisher call this. */
export function decryptToken(t: Pick<EncryptedToken, 'tokenEnc' | 'tokenIv' | 'tokenTag'>, rawKey?: string): string {
  const decipher = createDecipheriv('aes-256-gcm', key(rawKey), Buffer.from(t.tokenIv, 'base64'));
  decipher.setAuthTag(Buffer.from(t.tokenTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(t.tokenEnc, 'base64')), decipher.final()]).toString('utf8');
}
