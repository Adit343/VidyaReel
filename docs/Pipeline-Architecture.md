# Vidyareel: Pipeline Architecture

Oct 17, 2026 · @adit

## Overview

Next.js on Vercel is the hub: it serves the UI, owns sign-in and data access, and hosts the endpoint Inngest calls to run every long job.

&#91;embedded content: system architecture · 8 components\]

| Component | Job in Vidyareel | Why it is here |
| --- | --- | --- |
| Next.js (App Router, TypeScript) | UI for the 4 steps, API routes, the Inngest handler | One codebase, Node.js runtime |
| Custom auth (`src/server/auth`) | Email and password signup and login, forgot and reset password, Google sign-in; restricted to approved team members | Invite-only allowlist, admin and member roles, no third-party auth service to depend on |
| MongoDB Atlas | Users, videos with embedded scenes, jobs, posts, usage | Scene data is one nested document |
| Cloudflare R2 | Voice, stock media, final MP4s | Private bucket, signed links, public URL only when Instagram fetches |
| Inngest | Render and publish workflows, schedules, retries | No Redis or queue server to run |
| Vercel Sandbox | Runs Remotion to render the MP4 | Rendering fits no normal function limit |
| AI and media services | Script, voice, word timing, stock clips | All have free tiers |
| Meta Graph API | Instagram connect and publish | Development mode, no app review for team members |

## Render pipeline

A topic becomes a ready MP4 in eight stages: stages 1 and 2 run as normal requests, and stages 3 to 8 run inside one Inngest workflow, `renderVideo`.

&#91;embedded content: render pipeline · 8 stages\]

- Stage 5 is what keeps animation in step with the voice: every on-screen element carries a cue phrase, and its start time comes from the word timestamps, not from a guess. Captions use the same clock.
- Each stage saves its output (audio, timings, media) to R2 or MongoDB before the next begins, so a retry resumes at the failed stage instead of starting over.
- Fixing one scene reruns voice, timing and sync for that scene only, then renders again; the other scenes keep their saved audio.

## Inngest workflows

Four functions cover all background work; each Inngest step runs as a short Vercel function call, so a step does one thing and saves its result.

| Function | Trigger | Steps | On failure or cancel |
| --- | --- | --- | --- |
| `renderVideo` | Event when a member clicks Generate | Voice and timing per scene, sync, fetch media, start Sandbox render detached, poll with sleeps, upload MP4 to R2, update MongoDB | Inngest retries each step; after the last retry the video is marked failed and the daily cap is not charged |
| `publishInstagram` | Event when a member posts or schedules | Sleep until the scheduled time, create container, poll until ready, publish, save permalink | Cancel and reschedule events end or restart the sleep; a failed publish notifies the member |
| `refreshInstagramTokens` | Daily schedule | Find tokens close to their 60-day expiry and refresh them | A token that cannot refresh marks the connection as needing reconnect |
| `cleanupDeletedVideos` | Daily schedule | Delete R2 files and records for videos past the 7-day grace period | Retried on the next daily run |

Open item for the phase 1 spike: confirm Inngest free-plan limits on sleep length and concurrency.

## Instagram connect and publish

Each member connects their own professional Instagram account once; posting then runs through `publishInstagram`.

&#91;embedded content: Instagram connect and publish · 2 flows\]

- Personal accounts cannot publish through the API, so testing uses a separate account switched to a professional account.
- The app stays in Meta development mode, so team members with an app role can authorize without app review.
- The reel must be 9:16, 5 to 90 seconds, MP4 or MOV with H.264 and AAC, under 100 MB, and fetched from a publicly reachable URL, so R2 serves a short-lived public link at publish time only.
- The `state` value checked at step 4 blocks forged callbacks.

## Data flow and security boundaries

Secrets and tokens stay on the server, files stay private in R2, and only signed-in approved members reach any route.

| Boundary | Rule |
| --- | --- |
| Sign-in | Signup, login and Google sign-in all check the approved\_emails allowlist; the first admin comes from the ADMIN\_EMAIL variable in Vercel |
| Authorization | Every API route and Inngest event carries the member id; members see only their own videos and Instagram connection, admins see all |
| Instagram tokens | Encrypted before they are saved in MongoDB and never sent to the browser |
| Instagram callback | The `state` value ties the callback to the member who started it, which blocks forged callbacks |
| R2 files | Private bucket; the browser gets short-lived signed links, and Instagram gets a public link only while it fetches the reel |
| API keys | Gemini, Groq, Pexels, Pixabay and R2 keys live in Vercel environment variables, used only in server code and Sandbox runs |
| Daily cap | Checked at Generate: 5 videos per member and 20 for admins, a guard for free quotas and Sandbox usage, not billing |

## Limits, risks and the phase 1 spike

The riskiest link is rendering in Vercel Sandbox and uploading the result to R2, so phase 1 proves that one thread end to end before anything else is built.

| Risk | Why it matters | How the spike settles it |
| --- | --- | --- |
| Remotion in Vercel Sandbox is experimental | The whole render stage depends on it | Render one 3-scene video and time it |
| Output defaults to Vercel Blob | R2 upload is a custom step | Upload the MP4 to R2 from the Sandbox run |
| Sandbox is usage-billed | Free quota could run out | Set Spend Management; keep the daily cap |
| Inngest free-plan limits | Long sleeps and concurrency may be capped | Check sleep length and concurrent runs before scheduling posts |
| Creator accounts may not publish | Only Business is confirmed | Test with a Business account first, then try Creator |
| Free LLM and API quotas | Generation stops when a quota is hit | Swappable provider interface; Gemini first, Groq as backup |
| Tokens expire in about 60 days | Scheduled posts fail silently | Daily refresh function and a reconnect prompt |
