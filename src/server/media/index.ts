import { env } from '@/server/env';
import type { MediaProvider } from '@/server/providers';
import { createPixabayMedia } from './pixabay';

export { createPixabayMedia } from './pixabay';

/** Sources tried in order; the first one with a result wins. Pexels is not listed: it has paused new API keys. */
export function createMedia(): MediaProvider {
  const sources: MediaProvider[] = [];
  const key = env().PIXABAY_API_KEY;
  if (key) sources.push(createPixabayMedia(key));
  return {
    async search(query, opts) {
      for (const s of sources) {
        const found = await s.search(query, opts).catch(() => []);
        if (found.length) return found;
      }
      return [];
    },
  };
}
