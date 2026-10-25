import type { MediaCandidate, MediaProvider } from '@/server/providers';

const LICENCE = 'Pixabay Content Licence (https://pixabay.com/service/license-summary/)';

type Rendition = { url: string; width: number; height: number; size: number };
type Hit = {
  id: number; pageURL: string; duration: number; user: string;
  videos: Partial<Record<'large' | 'medium' | 'small' | 'tiny', Rendition>>;
};

/** Best rendition for a 1080 wide render: the smallest one that is at least 720 on its short side, else the largest. */
function pickRendition(h: Hit): Rendition | undefined {
  const all = (['large', 'medium', 'small', 'tiny'] as const).map((k) => h.videos[k]).filter((r): r is Rendition => !!r?.url);
  const big = all.filter((r) => Math.min(r.width, r.height) >= 720).sort((a, b) => a.size - b.size)[0];
  return big ?? all.sort((a, b) => b.width - a.width)[0];
}

/**
 * Pixabay video search. The API cannot filter by orientation, so portrait clips are sorted first;
 * landscape clips stay as a fallback because the template crops any clip to 9:16.
 */
export function createPixabayMedia(apiKey: string, fetchFn: typeof fetch = fetch): MediaProvider {
  return {
    async search(query, opts) {
      const url = new URL('https://pixabay.com/api/videos/');
      url.searchParams.set('key', apiKey);
      url.searchParams.set('q', query.slice(0, 100));
      url.searchParams.set('per_page', '20');
      url.searchParams.set('safesearch', 'true');
      const res = await fetchFn(url);
      if (!res.ok) throw new Error(`Pixabay search failed (${res.status})`);
      const body = (await res.json()) as { hits?: Hit[] };
      const found: MediaCandidate[] = [];
      for (const h of body.hits ?? []) {
        const r = pickRendition(h);
        if (!r || h.duration < opts.minSec) continue;
        found.push({
          id: String(h.id), url: r.url, pageUrl: h.pageURL, source: 'pixabay', licence: LICENCE,
          durationSec: h.duration, width: r.width, height: r.height,
        });
      }
      const portrait = (c: MediaCandidate) => c.height > c.width;
      return [...found.filter(portrait), ...found.filter((c) => !portrait(c))];
    },
  };
}
