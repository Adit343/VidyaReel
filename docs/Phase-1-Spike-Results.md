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

## Experiment 4: ElevenLabs voice and sync

Not run yet.

## Experiment 5: Instagram

Not run yet (Meta app and test account not created).
