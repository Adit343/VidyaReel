# Vidyareel: Phase 1 Spike Plan

Oct 17, 2026 · @adit

The spike proves the riskiest chain first: a Remotion video rendered in Vercel Sandbox and uploaded to R2, then a Reel posted from it. Five experiments run in order, and each must pass before the next starts.

## Experiments

| # | Experiment | Pass criteria | If it fails |
| --- | --- | --- | --- |
| 1 | Render a hardcoded 3-scene Remotion video in Vercel Sandbox with `@remotion/vercel` | MP4 produced; render time recorded; Sandbox usage visible in the Vercel dashboard | Fall back to rendering on a small always-on server and revisit the architecture |
| 2 | Upload that MP4 from the Sandbox run to a private R2 bucket | File in R2; signed link plays in the browser | Upload from the Next.js step after the render instead |
| 3 | Run experiments 1 and 2 as an Inngest `renderVideo` function: start detached, poll with sleeps, upload, update MongoDB | Video record goes from generating to ready with no manual step; a forced failure retries and ends as failed | Shorten steps; check Inngest sleep and concurrency limits on the free plan |
| 4 | Voice and sync: ElevenLabs free-plan clips with your two voices for 3 scenes, word times grouped from the character timestamps, cue phrases placed on those times | Each on-screen element appears within about 0.3s of its spoken word; the free key works through the API with both voice ids, and one 60 second video's credit use is recorded | Try other voices on the free plan; if none work through the API, use a paid plan for testing |
| 5 | Instagram: connect a Business test account, create a container from a signed public R2 URL, publish, then try a Creator account | Reel visible on the test account with a saved permalink; Creator result recorded either way | Keep Business-only for V1 and document it |

## Setup the spike needs

- Phase 0 checklist finished: Vercel, Atlas, R2, Inngest, Meta app and test Instagram account.
- Spend Management set in Vercel before experiment 1.
- A throwaway Next.js repo `vidyareel` with no UI; each experiment is one API route or Inngest function.

## Output

A short results note listing, per experiment, pass or fail, measured render time, and any limit found. That note decides whether the architecture stands or needs the fallback in the table.
