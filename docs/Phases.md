# Vidyareel: Delivery Phases

Last updated: 2026-10-23 (prompt 3)

Work moves one phase at a time; the step-by-step breakdown is in [Implementation-Steps.md](Implementation-Steps.md). A phase starts only when the previous gate is passed. Based on PRD §12 and [Prototype-Plan.md](Prototype-Plan.md) milestones; progress is tracked in [Project-Status.md](Project-Status.md) and the checklist in [Future-Plans.md](Future-Plans.md).

| Phase | Name | Milestone | State |
| --- | --- | --- | --- |
| 0 | Setup and foundation | M2 | Done (signed off 2026-10-24) |
| 1 | Pipeline spike | M0 + M1 | Done (architecture stands) |
| 2 | Storyboard AI and Review | M3 | Done (signed off 2026-10-25) |
| 3 | Template library and media | M4 (part) | Not started |
| 4 | Render workflow and Library | M4 | Not started |
| 5 | Instagram | M5 | Not started |
| 6 | Hardening and launch to team | M6 | Not started |

## Phase 0: Setup and foundation

**Goal:** a signed-in approved user sees an empty Library; every service account exists.

- Scaffold, docs and custom auth code (done, untested)
- Accounts and keys: MongoDB Atlas, Google OAuth client, Resend, Cloudflare R2, Inngest, Vercel, Meta developer app + test Instagram professional account
- Run the app; test signup, login, logout, forgot/reset, Google
- `ensureIndexes()`, auth rate limits, `/api/me`, route protection, sign-out
- Admin approved-emails CRUD; R2 `StorageProvider`; Library shell
- Real Sign-in, Sign-up, Home UI from the Stitch designs

**Gate:** approved email signs in (password and Google); unapproved email refused on every path; removed member blocked; env vars documented.

## Phase 1: Pipeline spike (biggest risk, before building screens)

**Goal:** prove the render chain works on free tiers.

1. Hard-coded 3-scene Remotion video rendered in Vercel Sandbox
2. MP4 uploaded to private R2, signed link plays
3. Same chain driven by Inngest `renderVideo`, status written to MongoDB
4. ElevenLabs voice + word timings + cue sync within about 0.3 s
5. Instagram test post from a signed R2 URL (Business, then Creator)

**Gate:** results note per experiment (pass/fail, render time, limits); architecture confirmed or fallback chosen (always-on render server).

## Phase 2: Storyboard AI and Review

**Goal:** topic in, valid editable storyboard out.

- `LlmProvider` (Gemini), prompts, storyboard zod validation, one retry
- `/api/ideas/*`, `POST /api/videos`, video/scene PATCH with `version` autosave, regenerate
- Create Step 1 and Review Step 2 screens

**Gate:** 10 topics give valid storyboards; bad output retries once then fails cleanly; edits autosave and survive refresh.

## Phase 3: Template library and media

**Goal:** videos look engaging, not just text slides.

- Templates: title-hook, bullet-reveal, step-flow, definition-callout, then stat, comparison, timeline, formula, diagram, stock-clip, recap
- Themes, captions, Pexels/Pixabay `MediaProvider`, music with ducking
- Voice list and samples

**Gate:** every template renders from sample props; stock clips crop to 9:16 with licence recorded.

## Phase 4: Render workflow and Library

**Goal:** click Generate, get a finished video.

- Full `renderVideo` (voice, sync, media, props, Sandbox render, R2 upload)
- Progress polling, preview player, fix-a-scene, cancel, daily cap and refund on failure
- Generate Step 3 and Library screens, download

**Gate:** 30–90 s video with synced captions in about 5 minutes; forced failure ends `failed` and refunds the cap.

## Phase 5: Instagram

**Goal:** post or schedule from the app.

- Instagram connect (OAuth + state), token encryption and daily refresh
- `publishInstagram`: post now, schedule, reschedule, cancel, retry
- Post Step 4 and Settings screens

**Gate:** scheduled post publishes on time with permalink saved; cancel and reschedule work.

## Phase 6: Hardening and team launch

**Goal:** safe for the whole team to use.

- Admin usage screens, usage log, notifications, error messages
- Delete and cleanup (7-day grace), no orphaned R2 files
- Security checks, backups/export, observability, PRD test checklist
- Mobile layout pass, deployment to Vercel production

**Gate:** each team member makes and posts a video; failures show clear messages; checklist done.

## Rules for moving between phases

1. Finish the gate checks before starting the next phase; record the result in Project-Status.
2. Each phase is built on its own branch from `develop` (`phase/0-setup`, ...) and merged back when its gate passes.
3. Scope changes go into Future-Plans, not into the running phase.
