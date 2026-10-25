import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import { assets } from '@/server/db/collections';
import { attachClip } from '@/server/media/assets';
import { createPixabayMedia } from '@/server/media/pixabay';
import type { MediaProvider, StorageProvider } from '@/server/providers';

const rendition = (w: number, h: number, size: number) => ({ url: `https://cdn.example/${w}x${h}.mp4`, width: w, height: h, size });
const hit = (id: number, duration: number, landscape: boolean) => ({
  id, pageURL: `https://pixabay.com/videos/id-${id}/`, duration, user: 'someone',
  videos: landscape
    ? { large: rendition(1920, 1080, 9e6), medium: rendition(1280, 720, 4e6), tiny: rendition(640, 360, 1e6) }
    : { large: rendition(1080, 1920, 9e6), medium: rendition(720, 1280, 4e6), tiny: rendition(360, 640, 1e6) },
});
const fakeFetch = (hits: unknown[], status = 200) =>
  (async () => new Response(JSON.stringify({ hits }), { status })) as unknown as typeof fetch;

describe('Pixabay media provider', () => {
  it('puts portrait clips first, drops short ones and picks a rendition that is big enough', async () => {
    const media = createPixabayMedia('k', fakeFetch([hit(1, 10, true), hit(2, 2, false), hit(3, 8, false)]));
    const found = await media.search('leaves', { orientation: 'portrait', minSec: 4 });
    expect(found.map((c) => c.id)).toEqual(['3', '1']);
    expect(found[0]).toMatchObject({ source: 'pixabay', width: 720, height: 1280, durationSec: 8, pageUrl: 'https://pixabay.com/videos/id-3/' });
    expect(found[0].licence).toContain('Pixabay Content Licence');
    expect(found[1].width).toBe(1280);
  });

  it('sends the key, query and safe search, and reports a failed request', async () => {
    let seen = '';
    const f = (async (u: URL) => { seen = String(u); return new Response('{}', { status: 429 }); }) as unknown as typeof fetch;
    await expect(createPixabayMedia('secret', f).search('a b', { orientation: 'portrait', minSec: 1 })).rejects.toThrow('429');
    expect(seen).toContain('key=secret');
    expect(seen).toContain('q=a+b');
    expect(seen).toContain('safesearch=true');
  });
});

describe('attachClip', () => {
  const stored: Record<string, number> = {};
  const storage = { put: async (k: string, b: Buffer) => { stored[k] = b.length; } } as unknown as StorageProvider;
  const query = { videoId: new ObjectId(), sceneId: 'sc_1', query: 'leaves', minSec: 4 };

  it('copies the clip to our storage and records its licence', async () => {
    const media = createPixabayMedia('k', fakeFetch([hit(7, 9, false)]));
    const got = await attachClip({ media, storage, fetchFn: (async () => new Response(Buffer.from('mp4bytes'))) as unknown as typeof fetch }, query);
    expect(got?.candidate.id).toBe('7');
    expect(stored['media/pixabay/7.mp4']).toBe(8);
    const doc = await assets().findOne({ _id: new ObjectId(got!.assetId) });
    expect(doc).toMatchObject({ kind: 'clip', source: 'pixabay', sourceId: '7', sourceUrl: 'https://pixabay.com/videos/id-7/', storageKey: 'media/pixabay/7.mp4', sceneId: 'sc_1' });
    expect(doc?.licence).toContain('Pixabay Content Licence');
  });

  it('returns null and records nothing when no clip fits', async () => {
    const none: MediaProvider = { search: async () => [] };
    expect(await attachClip({ media: none, storage }, query)).toBeNull();
    expect(await assets().countDocuments()).toBe(0);
  });
});
