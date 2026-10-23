# How the Vidyareel prototype works (engineer's walkthrough)

Code: `vidyareel/prototype/code/`. Outputs: `vidyareel/prototype/videos/`.

## 1. The idea in one line
A video is a pure function of data: `render(storyboard + audio + word timings) -> mp4`. Nothing is edited by hand. The "animation" is React components whose appearance depends only on the current frame number.

## 2. Stack
| Layer | Tool | Role |
| --- | --- | --- |
| Script + storyboard | Gemini API (`gemini-flash-latest`, JSON mode) | One-line idea -> structured storyboard (scenes, template, on-screen text, cue phrases) |
| Voice | ElevenLabs `text-to-speech/{voice}/with-timestamps` (model `eleven_multilingual_v2`) | One call returns mp3 (base64) AND per-character start/end times |
| Sync | Plain Node (`pipeline/build.mjs`) | Groups characters into words, finds each cue phrase, converts seconds -> frames |
| Animation | Remotion 4 (React + TypeScript) | Renders a React tree to frames, one per frame number |
| Graphics | HTML/CSS + inline SVG | Cards, captions, diagrams (lines drawn with progress values) |
| Encode | Remotion renderer -> headless Chromium screenshots -> ffmpeg (bundled) | H.264 + AAC, 1080x1920, 30 fps |
| Runtime | Node, headless Chromium (Playwright's copy), no GPU | Local render |

## 3. Pipeline, step by step
1. **Storyboard** (`pipeline/storyboard_gemini.mjs`): prompt asks for strict JSON: scenes, each with `template`, `narration`, and `elements[]` with `text` and `cue`. A cue is 1-3 words copied exactly from that scene's narration: the moment the element should appear.
2. **Voice per scene** (`pipeline/voice_elevenlabs.mjs`): each scene's narration is sent separately. The API returns `alignment.characters[]` with `character_start_times_seconds[]` / `character_end_times_seconds[]`. I group non-space runs into words `{word, start, end}`. Per-scene calls keep timing local and let one scene be re-rendered cheaply later.
3. **Sync** (`build.mjs`, `findCue`): normalise text (lowercase, strip punctuation), slide the cue over the word list, take the start time of the first matching word. `startFrame = leadIn + round(t * 30) - 3` (visuals land 3 frames before the word). Scene length = lead-in + audio duration + tail.
4. **Validation**: elements must be listed in spoken order or the build fails; the first element of each scene is clamped to appear within ~4 frames (fixes the early "empty screen").
5. **Props file**: everything above is written to `out/<slug>.props.json`: scenes, durations, element start frames, word times, audio paths.
6. **Render** (`renderMedia`): Remotion bundles `src/` with webpack, opens it in headless Chromium, and for each frame sets the frame number, screenshots, and pipes frames plus the mp3s (placed with `<Audio>` in a `<Sequence>`) into ffmpeg. 3 browser tabs in parallel; about 40-90 s for a 25-47 s video.

## 4. How the motion works
- `useCurrentFrame()` returns the frame number; every component derives its look from it. No timers, no CSS transitions, so renders are deterministic and frame-accurate.
- `spring()` / `interpolate()` / `Easing` turn "frame minus startFrame" into 0 -> 1 progress. Cards slide and scale on a spring; step connectors grow when the *next* step is spoken.
- Templates (`src/templates/`): `TitleHook`, `BulletReveal`, `StepFlow`, `DefinitionCallout`, `Diagram`. The AI picks a template and fills fields; it never writes animation code (keeps output reliable).
- `Captions` finds the word whose `start <= t` and shows a 4-word chunk with the active word highlighted: same clock as the elements, so captions and visuals can't drift.
- **Diagrams** (`Diagram.tsx`): inline SVG. A line "draws in" by interpolating its end point from start to end by progress. Raindrop: geometry from points on a circle (entry, back wall, exit); the exit fan is 7 lines in rainbow colours with `drop-shadow` glow. Orbit: ellipse, glowing sun, two Earths with the same 23 degree axis (leans toward the sun on one side, away on the other). Flow: nodes on an ellipse, edges draw in when the next node is spoken, then a dot loops around.
- Scene polish: slow 1.0 -> 1.04 push-in, 6-frame fades, animated gradient background.

## 5. What I did vs what the AI did (honest split)
- Gemini wrote the storyboard for the first video (rainbow). The three diagram videos (rainbow2, seasons2, watercycle) used storyboards I wrote by hand, because the diagram template isn't in the Gemini prompt yet.
- Diagram code, templates, sync logic and the pipeline are hand-written TypeScript/Node.
- Voice is a stock ElevenLabs voice (Alice), not Viraj/Monica (blocked on the free plan).
- I checked frames visually (contact sheets via ffmpeg + PIL) and the sync report (`*.sync.json`); I have not listened to the audio.

## 6. Debugging loop I used
`pipeline/still.mjs` renders single frames from a saved props file with no voice credits, so layout can be iterated cheaply before a full render.

## 7. Gotchas hit
- Gemini 2.5 models return 404 for new keys -> use a `*-latest` alias, keep the model configurable.
- ElevenLabs free plan: library voices return 402 `paid_plan_required`; the key was also scoped (no `user_read`), so quota can't be read via API.
- Container ffmpeg lacked filters (`fps`, `select`); I extracted frames with `-ss` and tiled them in Python.
- Remotion needs a browser: points at Playwright's headless shell via `CHROME_PATH`.

## 8. Path to the real app
Same pipeline, wrapped: Next.js UI -> Inngest steps (storyboard -> per-scene voice -> sync -> render) -> Remotion in Vercel Sandbox -> mp4 to Cloudflare R2 -> Instagram publish; MongoDB for projects/jobs. Next prototype steps: auto-choose diagram templates in the Gemini prompt, add stock clips and icons, more templates (comparison, timeline, formula, stat).
