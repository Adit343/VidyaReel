import { describe, expect, it } from 'vitest';
import allTemplates from '@/remotion/fixtures/all-templates.json';
import { captionPage } from '@/remotion/captionPage';
import { ENABLED_TEMPLATES, llmSceneSchema, sceneSchema } from '@/lib/schemas/storyboard';
import { toScene } from '@/server/ai/storyboard';

const words = ['Why', 'is', 'the', 'sky', 'blue', 'today'].map((word, i) => ({ word, startMs: i * 500, endMs: i * 500 + 400 }));

describe('template library', () => {
  it('has a sample scene for every enabled template and every diagram kind', () => {
    const scenes = sceneSchema.array().parse(allTemplates.scenes);
    for (const t of ENABLED_TEMPLATES) expect(scenes.some((s) => s.template === t), t).toBe(true);
    for (const d of ['flow', 'cycle', 'radial', 'layers', 'bars', 'raindrop', 'orbit']) expect(scenes.some((s) => s.diagram === d), d).toBe(true);
  });

  it('accepts the new templates from the model and treats an empty diagram as absent', () => {
    const base = { narration: 'Water evaporates then falls.', elements: [{ type: 'node', text: 'Evaporation', cue: 'Water evaporates' }] };
    expect(llmSceneSchema.parse({ ...base, template: 'timeline', diagram: '' }).diagram).toBeUndefined();
    expect(llmSceneSchema.parse({ ...base, template: 'diagram', diagram: 'orbit' }).diagram).toBe('orbit');
    expect(llmSceneSchema.safeParse({ ...base, template: 'sparkles' }).success).toBe(false);
  });

  it('keeps the diagram kind on a diagram scene and defaults it to flow', () => {
    const base = llmSceneSchema.parse({ template: 'diagram', narration: 'Water cycles.', elements: [{ type: 'node', text: 'Cycle', cue: 'Water cycles' }] });
    expect(toScene(base, 0).diagram).toBe('flow');
    expect(toScene({ ...base, template: 'stat' }, 0).diagram).toBeUndefined();
  });
});

describe('diagram icons', () => {
  it('keeps an element icon from the model, drops an empty one, and lists every drawn icon', async () => {
    const { ICON_NAMES } = await import('@/remotion/templates/iconNames');
    const { readFileSync } = await import('node:fs');
    // icons.tsx has JSX, which the test runner does not parse, so compare its drawn names as text.
    const drawn = [...readFileSync('src/remotion/templates/icons.tsx', 'utf8').matchAll(/^  (\w+): </gm)].map((m) => m[1]);
    expect([...drawn].sort()).toEqual([...ICON_NAMES].sort());
    const els = [{ type: 'node', text: 'Sun', cue: 'Sun', icon: 'sun' }, { type: 'node', text: 'Rain', cue: 'Rain', icon: '' }];
    const scene = toScene(llmSceneSchema.parse({ template: 'diagram', diagram: 'cycle', narration: 'Sun then rain.', elements: els }), 0);
    expect(scene.diagram).toBe('cycle');
    expect(scene.elements.map((e) => e.icon)).toEqual(['sun', undefined]);
    expect(ICON_NAMES.length).toBeGreaterThan(30);
  });
});

describe('stock-clip scenes', () => {
  it('keep the search words on the scene, falling back to the title', () => {
    const base = { template: 'stock-clip', title: 'Leaves', narration: 'Leaves work.', elements: [{ type: 'caption', text: 'Leaves', cue: 'Leaves work' }] };
    expect(toScene(llmSceneSchema.parse({ ...base, mediaQuery: ' green leaves ' }), 0).media).toEqual({ query: 'green leaves' });
    expect(toScene(llmSceneSchema.parse({ ...base, mediaQuery: '' }), 0).media).toEqual({ query: 'Leaves' });
    expect(toScene(llmSceneSchema.parse({ ...base, template: 'recap' }), 0).media).toBeUndefined();
  });
});

describe('caption pages', () => {
  it('shows four words at a time and marks the spoken one', () => {
    expect(captionPage(words, 0)).toMatchObject({ active: 0, page: [{ word: 'Why' }, { word: 'is' }, { word: 'the' }, { word: 'sky' }] });
    expect(captionPage(words, 1600).active).toBe(3);
    const next = captionPage(words, 2100);
    expect(next.page.map((w) => w.word)).toEqual(['blue', 'today']);
    expect(next.active).toBe(0);
  });

  it('keeps the previous word highlighted in a gap and the last page after the end', () => {
    expect(captionPage(words, 450).active).toBe(0);
    expect(captionPage(words, 99999).page.at(-1)?.word).toBe('today');
    expect(captionPage([], 100)).toEqual({ page: [], active: -1 });
  });
});
