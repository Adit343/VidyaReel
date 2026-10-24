// Phase 1 experiment 4: ElevenLabs voice + word times + cue sync for the 3-scene fixture, per voice id.
// Writes mp3s to out/voice/ and prints, per element, how far its start is from its spoken cue word.
import { mkdirSync, writeFileSync } from 'node:fs';
import nextEnv from '@next/env';
import { storyboardSchema } from '../src/lib/schemas/storyboard';
import spike from '../src/remotion/fixtures/spike-3-scenes.json';
import { syncScene } from '../src/server/sync';
import { createElevenLabsVoice, voiceIds, VoiceError } from '../src/server/voice';

nextEnv.loadEnvConfig(process.cwd());

const scenes = storyboardSchema.shape.scenes.parse(spike.scenes);
const voice = createElevenLabsVoice();
mkdirSync('out/voice', { recursive: true });

let totalCredits = 0;
let worst = 0;
for (const [v, voiceId] of voiceIds().entries()) {
  console.log(`\n=== voice ${v + 1} (${voiceId.slice(0, 6)}...) ===`);
  for (const scene of scenes) {
    try {
      const r = await voice.synthesize(scene.narration, { voiceId, speed: 1 });
      totalCredits += r.credits;
      writeFileSync(`out/voice/voice${v + 1}-${scene.id}.mp3`, r.audio);
      const sync = syncScene(scene, r.words, r.durationMs);
      console.log(`${scene.id}: audio ${(r.durationMs / 1000).toFixed(2)}s, ${r.words.length} words, ${r.credits} credits, scene ${(sync.durationMs / 1000).toFixed(2)}s`);
      sync.elements.forEach((el) => {
        const idx = scene.elements.findIndex((e) => e.id === el.id);
        const cue = sync.cueWordMs[idx];
        const delta = cue == null ? null : el.startMs - cue;
        if (delta != null) worst = Math.max(worst, Math.abs(delta));
        console.log(`   "${el.cue}": cue word at ${cue ?? 'NOT FOUND'} ms, element at ${el.startMs} ms, offset ${delta ?? 'n/a'} ms`);
      });
      sync.warnings.forEach((w) => console.log(`   warning: ${w}`));
    } catch (e) {
      console.log(`${scene.id}: FAILED ${e instanceof VoiceError ? `${e.status} ${e.detail}` : e}`);
      break;
    }
  }
}
console.log(`\ncredits used this run: ${totalCredits}; worst element-to-cue offset: ${worst} ms (target within 300 ms)`);
