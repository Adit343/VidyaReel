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

## Experiment 3: Inngest `renderVideo`

Not run yet.

## Experiment 4: ElevenLabs voice and sync

Not run yet.

## Experiment 5: Instagram

Not run yet (Meta app and test account not created).
