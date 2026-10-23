import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/server/auth/password';
import { hashToken, newToken } from '@/server/auth/tokens';
import { parseEnv } from '@/server/env';
import { storageKey } from '@/server/storage/keys';

describe('password', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const h = await hashPassword('correct horse battery');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse battery', h)).toBe(true);
    expect(await verifyPassword('wrong password!!', h)).toBe(false);
  });
  it('salts every hash', async () => {
    expect(await hashPassword('same same same')).not.toBe(await hashPassword('same same same'));
  });
});

describe('tokens', () => {
  it('hashes deterministically and issues unique tokens', () => {
    const t = newToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
    expect(newToken()).not.toBe(t);
  });
});

describe('env', () => {
  it('names every missing variable', () => {
    expect(() => parseEnv({})).toThrow(/MONGODB_URI.*APP_URL.*ADMIN_EMAIL/);
  });
  it('accepts the required set', () => {
    expect(parseEnv({ MONGODB_URI: 'mongodb://x', APP_URL: 'http://localhost:3000', ADMIN_EMAIL: 'a@b.co' }).APP_URL).toBe('http://localhost:3000');
  });
});

describe('storage keys', () => {
  it('follows System-Design 7.6', () => {
    expect(storageKey.audio('v1', 's1', 'abc')).toBe('videos/v1/audio/s1-abc.mp3');
    expect(storageKey.props('v1', 'j1')).toBe('videos/v1/props-j1.json');
    expect(storageKey.output('v1', 'j1')).toBe('videos/v1/out/j1.mp4');
    expect(storageKey.thumb('v1', 'j1')).toBe('videos/v1/thumb-j1.jpg');
    expect(storageKey.media('pexels', '9')).toBe('media/pexels/9.mp4');
    expect(storageKey.music('t1')).toBe('music/t1.mp3');
    expect(storageKey.voiceSample('rachel')).toBe('voices/rachel-sample.mp3');
  });
});
