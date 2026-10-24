# Vidyareel: Phase 1 Spike Results

Last updated: 2026-10-24

Results per experiment in [Phase-1-Spike-Plan.md](Phase-1-Spike-Plan.md). Run with the scripts named below.

## Experiments 1 and 2: render in Vercel Sandbox, upload to R2 (PASS)

Run: `npm run spike:sandbox` (`scripts/spike-sandbox-render.mts`), Vercel Hobby plan, 2026-10-24. Input: the 3-scene fixture, 16 s, 1080x1920, 30 fps, H.264.

| Step | Time |
| --- | --- |
| Bundle the Remotion project locally | not timed separately (part of the 77 s total) |
| Create sandbox (installs Chrome and dependencies on a cold start) | 44.8 s |
| Upload bundle to sandbox | 3.6 s |
| Render 480 frames in the sandbox | 19.8 s |
| Read MP4 out of the sandbox | 0.9 s |
| Upload to R2 | 1.4 s |
| **Total, cold** | **77.0 s** |

- Output: 351 kB MP4. A signed R2 link returned 200, `video/mp4`, valid `ftyp` header.
- Render speed in the sandbox (19.8 s) beat the laptop (about 32 s for the same video).
- Upload path used: read the file out of the sandbox, then `put` to R2 from our own server code. The package's detached mode uploads only to Vercel Blob, so for the Inngest version (experiment 3) the file must be read from the sandbox and uploaded to R2 in a later step. This is the "upload from the Next.js step after the render" fallback in the plan, and it works.
- The sandbox is stopped in a `finally` block after every run.

Not yet measured: usage shown in the Vercel dashboard (Sandbox CPU/memory), a warm start with a snapshot (the 44.8 s cold start is the main cost to reduce), and a 60 s video. Spend Management cap was not confirmed by the owner before this run; Hobby has hard free-tier limits.

## Experiment 3: Inngest `renderVideo` (PASS)

Run: `npm run spike:inngest` (needs `npm run dev`, `npm run inngest:dev` and `npm run remotion:bundle`). The script inserts a `videos` row, sends the `video/render.requested` event and polls MongoDB.

| Case | Result |
| --- | --- |
| Normal | `storyboard_ready` -> `rendering` (2 s) -> `ready` (69 s), no manual step. MP4 (351 kB) at `videos/<id>/final.mp4` in R2, size recorded on the video row. |
| Forced failure (`--fail`) | The render step failed, Inngest retried it twice, then the video ended as `failed` with the plain-language reason (130 s including retry back-off). |

Steps (each one is a separate Inngest step, so none outlives a platform time limit): load video, start sandbox (about 45 s), upload bundle, render, read file and upload to R2 (also sets `ready`), stop sandbox. Step results are saved by Inngest, so a retry of the render does not create a second sandbox.

Findings and limits:
- Vercel's detached render mode uploads only to Vercel Blob, so the render step runs normally (about 20 s for 16 s of video) and the file is copied to R2 in the next step. A 90 s video would make the render step about 2 minutes, which is more than a single Hobby function invocation allows by default. Before deploying, either set the route's `maxDuration` as high as Hobby permits, or split the render into frame ranges. To be checked at deploy time (Phase 6).
- The `start-sandbox` step (about 45 s) is close to a 60 s limit; a snapshot would cut it.
- A failed attempt leaves its sandbox running until the 15 minute timeout set at creation; nothing else cleans it up. Acceptable on the free plan only because runs are rare; revisit with the cleanup job.
- The Remotion bundle is built ahead of time (`npm run remotion:bundle`, output in git-ignored `build/`), not at request time.
- Spend Management is a paid Vercel feature; the Hobby plan cannot be billed, and it pauses at its free limits instead.

## Experiment 4: ElevenLabs voice and sync (PASS, with free stock voices)

Run: `npm run spike:voice` (`scripts/spike-voice-sync.mts`): one `with-timestamps` call per scene of the 3-scene fixture, characters grouped into words, cues matched and placed by `syncScene`. MP3s go to git-ignored `out/voice/`.

| Check | Result |
| --- | --- |
| Library voices (Tara, Viraj: the two Indian-accent voices first chosen) | **Fail on the free plan**: HTTP 402 `paid_plan_required` ("Free users cannot use library voices via the API"). As System-Design 7.2 predicted. |
| Free stock ("premade") voices | Work through the API. Tried Alice (`Xb7hH8MSUJpSbSDYk0k2`, British, educational) and Daniel (`onwK4e9ZLuTAKqWW03F9`, British, broadcaster). |
| Word times | Grouped from character times; 11, 21 and 14 words for the three scenes. |
| Cue sync | All 7 cues found. Every element lands 100 ms before its spoken cue word (the 3-frame lead), except one first element at 207 ms because of the first-second clamp. **Worst offset 207 ms, target 300 ms.** |
| Speed setting | `voice_settings.speed` is accepted by the API (tested with 1.0 only). |

First run showed first elements 0.5 to 1 s early. Cause: design rule "first element within 4 frames of the scene start" (System-Design 7.3 step 4) fights the 0.3 s goal, because the voice only starts speaking about 0.7 to 1.1 s in (150 ms lead-in plus the voice's own lead silence). Changed the rule to "within the first second" (`FIRST_ELEMENT_MAX_MS`) and keep templates showing their label from frame 0 (Phase 3 step 3.15).

Credit use: 281 characters of narration (18.3 s of audio) cost 281 credits, about 15 credits per audio second. A 60 s video is therefore about 920 credits, so the 10,000 monthly free credits give **about 10 videos of 60 s** (about 20 at 30 s). This is the real monthly limit, not the daily cap. The monthly voice-credit guard (step 6.2) is needed.

## Experiment 5: Instagram (Business and Creator accounts: PASS)

Run: `npm run spike:instagram` (`scripts/spike-instagram.mts`), with `-- --publish` to post. Instagram API with Instagram Login, Graph version v23.0, token from the app's "Generate token" button (app in Development mode, account added as Instagram Tester). Permissions used: `instagram_business_basic`, `instagram_business_content_publish`.

| Step | Result |
| --- | --- |
| Account type reported | BUSINESS |
| Create REELS container from a signed R2 URL (private bucket, 1 h link) | Accepted; Instagram fetched the video itself |
| Container status | `IN_PROGRESS` then `FINISHED` in 24 to 29 s |
| Publish | PASSED, 31 s from container creation; permalink returned (`https://www.instagram.com/reel/De4psPxj0VT/`) |

Findings:
- A signed R2 URL is enough; no public bucket or custom domain is needed.
- Development mode needs no Meta app review for accounts with a role on the app. Letting other educators connect their own accounts needs the app live, which needs review, a privacy policy URL and business verification (Phase 5/6). All free.
- The Meta developer registration was blocked on the laptop browser ("device you don't usually use") and passed from the phone browser after a day.
- The Meta dashboard's "required" permissions list only messaging permissions; `instagram_business_content_publish` is added separately under Permissions and features.
- **Creator accounts work.** After switching the same account to Creator (reported as `MEDIA_CREATOR`) and generating a new token, the same script published a second Reel (`https://www.instagram.com/reel/De4qdNZDrcJ/`). The container took 83 s to finish this time (24 to 29 s before), so allow for several minutes of polling. V1 can accept both Business and Creator accounts; this closes the System-Design open item.
- Switching the account type needed a freshly generated token.

## Decision (step 1.17): the architecture stands

All five experiments passed on free tiers (Vercel Hobby, R2, Inngest, ElevenLabs free, Instagram in Development mode). No fallback server is needed.

| Experiment | Result |
| --- | --- |
| 1 Render in Vercel Sandbox | Pass: 20 s render of a 16 s video, 77 s cold total |
| 2 Upload to R2, signed link | Pass |
| 3 Inngest `renderVideo` | Pass: `ready` unattended in 69 s; forced failure retries then `failed` |
| 4 Voice and cue sync | Pass with free stock voices: worst offset 207 ms (target 300 ms) |
| 5 Instagram | Pass on Business and Creator accounts |

Changes to the design that came out of the spike:
1. **Voices:** the Indian-accent library voices need a paid ElevenLabs plan through the API, so V1 ships with free stock voices (a voice probe stays in the design).
2. **First-element sync rule:** within the first second, not 4 frames (System-Design 7.3 updated).
3. **Voice credits are the binding limit:** about 15 credits per audio second, so about 10 videos of 60 s a month on the free 10,000 credits. The monthly guard (step 6.2) is essential, and 30 s videos should be the default suggestion.
4. **Render step length:** a long video makes the render step longer than one Hobby function call may allow; plan a `maxDuration` setting or frame-range splitting when deploying, and use a Sandbox snapshot to cut the 45 s cold start.
5. **Upload path:** the file is read out of the Sandbox and written to R2 by our code (the detached mode only supports Vercel Blob).
6. **Instagram:** a signed R2 URL works as the video source. Instagram API with Instagram Login, Development mode for the team; going live for other accounts needs Meta app review (free).
