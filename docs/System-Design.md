# Vidyareel V1: System Design

Oct 18, 2026 · @adit

## 1. Overview and design targets

Vidyareel V1 is one Next.js app on Vercel, durable Inngest workflows for everything slow, and a Remotion render inside Vercel Sandbox. It turns a topic into a voiced, animated 9:16 video and posts it to a team member's Instagram account. This document is the build-level design for PRD draft 3; it reuses the pipeline proven in the local prototype (`vidyareel/prototype/code`).

**Design principle:** a video is a pure function of data. `render(storyboard + audio + word timings) -> mp4` has no manual editing step, so every stage can be retried, cached per scene and tested in isolation.

### Targets this design must meet

| Target | Value | Source |
| --- | --- | --- |
| Storyboard generation | under 30 s | PRD 5.3 |
| Render, 60 s video | under 5 min | PRD 5.8 |
| Page load | under 3 s | PRD 8.1 |
| Render success without manual retry | 95% or more | PRD 11 |
| Post success to a connected test account | 95% or more | PRD 11 |
| Visible mis-timed animation | none in 9 of 10 test videos | PRD 11 |
| Unapproved email can never sign in, UI or direct API | 100% | PRD 5.1 |

### Scale and capacity assumptions

- Users: adit plus a handful of approved teammates. Hard daily caps: 5 videos per member, 20 per admin, so under about 50 videos a day even in the worst case.
- Renders run one at a time (global concurrency 1). A queue is fine at this volume.
- The binding limit is not compute but the monthly ElevenLabs credits: about 10,000 on the free plan. The prototype used roughly 400 to 700 credits for a 24 to 47 second video, so expect about 15 to 25 videos a month. The design therefore includes a monthly voice-credit guard (section 7) in addition to the daily cap.
- Everything must run on free or low-cost tiers: Vercel Hobby, MongoDB Atlas M0, Cloudflare R2 free tier, Inngest free plan, Gemini free tier.

### Non-goals for this document

Billing, public sign-up, multi-tenant workspaces, platforms other than Instagram, a timeline editor and languages other than English (PRD section 2). Where a later version would change a decision, the section says so in one line.

## 2. Architecture

The system is a modular monolith: one deployable Next.js app that owns the UI, the API and the Inngest function endpoint, with all heavy work pushed to Inngest steps and one external render environment. There are no long-lived servers to run.

&#91;embedded content: system architecture · 3 layers: app, services, storage\]

The browser only talks to the Next.js app. The app sends events to Inngest, and Inngest calls back into `/api/inngest` to run each step, which in turn calls the AI, voice, stock and Instagram services, reads and writes MongoDB and R2, and starts the Sandbox render.

### Components

| Component | Runs on | Responsibility |
| --- | --- | --- |
| Web UI | Vercel (Next.js App Router, React) | Four-step flow, Library, Settings, Admin |
| API | Vercel Functions, Node.js runtime | Auth-checked REST routes, validation, writes events to Inngest |
| Auth | Custom auth in `src/server/auth`, MongoDB | Email and password signup/login, forgot and reset password (email via `EmailProvider`), Google sign-in, sessions, approved-email gate, roles |
| Workflow engine | Inngest (cloud), calling `/api/inngest` | Durable steps, retries, sleeps, schedules, cancellation |
| Storyboard AI | Gemini API (behind `LlmProvider`) | Idea suggestions, angles, storyboard JSON, captions |
| Voice | ElevenLabs API (behind `VoiceProvider`) | Audio plus character timestamps per scene |
| Media | Pexels and Pixabay APIs (behind `MediaProvider`) | Stock clips and images with licence data |
| Renderer | Vercel Sandbox running Remotion and FFmpeg | Draws frames, mixes audio, encodes the MP4 |
| Database | MongoDB Atlas M0 | Users, videos with embedded scenes, jobs, posts, usage |
| Object storage | Cloudflare R2 (private bucket) | Audio, stock media, MP4s, thumbnails |
| Publisher | Instagram API with Instagram Login (behind `SocialPublisher`) | Create container, poll, publish |

### Technology choices and why

| Choice | Why | Swap point |
| --- | --- | --- |
| Next.js and TypeScript, Node runtime | One language end to end; Remotion templates and the app share types | Route handlers are thin; logic lives in `src/server` |
| Custom auth (scrypt passwords, opaque session tokens, Google OAuth code flow with PKCE) | Full control of the signup, reset and Google flows and the approved-email gate; few moving parts for a small team | Auth sits behind `requireUser()`; `EmailProvider` (Resend) sends reset mail |
| MongoDB Atlas | A video and its scenes are read together, so one document per video fits; flexible scene shapes while templates evolve | Repository functions per collection |
| Cloudflare R2 | S3-compatible, no egress fees; Instagram needs a fetchable URL | `StorageProvider` (put, signed get, delete) |
| Inngest | Durable multi-step workflows, native sleep until a timestamp, no Redis to run | Workflow logic in plain functions; Inngest only orchestrates |
| Remotion | React components render to video; frame-based animation means no drift; proven in the prototype | `Renderer` interface; can move off Sandbox |
| Vercel Sandbox | Temporary Linux machine with Chrome and FFmpeg that Remotion needs; avoids owning a render server | `Renderer` interface (a container host would be the fallback) |

### Provider interfaces

Every external service sits behind a small interface so free-tier limits or terms never force a rewrite:

```ts
interface LlmProvider { generate<T>(prompt: Prompt, schema: ZodType<T>): Promise<T> }
interface VoiceProvider { synthesize(text: string, opts: { voiceId: string; speed: number }): Promise<{ audio: Buffer; durationMs: number; words: Word[]; credits: number }> }
interface MediaProvider { search(query: string, opts: { orientation: 'portrait'; minSec: number }): Promise<MediaCandidate[]> }
interface StorageProvider { put(key: string, body: Buffer, type: string): Promise<void>; signedGet(key: string, ttlSec: number): Promise<string>; delete(key: string): Promise<void> }
interface Renderer { render(props: VideoProps, opts: { sceneIds?: string[] }): Promise<{ outputKey: string; durationMs: number }> }
interface SocialPublisher { createContainer(conn: Connection, videoUrl: string, caption: string): Promise<string>; status(conn: Connection, containerId: string): Promise<'IN_PROGRESS' | 'FINISHED' | 'ERROR'>; publish(conn: Connection, containerId: string): Promise<{ mediaId: string; permalink: string }> }
```

### Repository layout

```
/app                 Next.js routes: (app) pages, api/* handlers, api/inngest
/src/server
  auth/              password hashing, sessions, signup/login/reset services, Google OAuth, requireUser(), requireAdmin()
  email/             EmailProvider, Resend adapter, reset-password template
  db/                Mongo client, repositories, indexes
  ai/                LlmProvider, prompts, storyboard schema + validator
  voice/             VoiceProvider, ElevenLabs adapter, char-to-word grouping
  sync/              cue matching, scene timing, quality checks
  media/             MediaProvider adapters, asset licence records
  storage/           R2 adapter, key naming
  instagram/         OAuth, token crypto, publisher
  usage/             quota guards (daily cap, monthly voice credits)
/src/workflows       Inngest functions: renderVideo, publishInstagram, schedules
/src/remotion        Root, Video, templates, theme (shared with the prototype)
/src/lib/schemas     zod schemas shared by API, workflows and Remotion props
```

The prototype's `build.mjs`, `voice_elevenlabs.mjs` and templates move into `sync/`, `voice/` and `/src/remotion` with the logic unchanged.

## 3. Core flows

Four flows carry the product. Each lists who does what and where state changes, so the API, workflow and data sections can be read against it.

### 3.1 Sign-in with the approved-email gate

1. **Email and password:** the browser posts to `/api/auth/signup` or `/api/auth/login`. Signup looks the email up in `approved_emails` first; not found: `INVITE_ONLY`, no user row is written. The password is hashed with scrypt; login compares in constant time and returns the same error for an unknown email and a wrong password.
2. **Google:** `GET /api/auth/google` stores `state` and a PKCE verifier in `oauth_states` and redirects to Google. The callback verifies `state`, exchanges the code, requires a verified Google email, applies the same approved-email check, then creates or links the `users` row.
3. **Session:** both paths create a `sessions` row and set an HttpOnly cookie holding a random token (only its hash is stored). `requireUser()` loads the session, then re-checks the email is still approved and not removed.
3a. **Forgot password:** `POST /api/auth/forgot-password` always answers 200 (no account enumeration). If the email is approved and has a user, a 60 minute one-time token is stored hashed and mailed as a link to `/reset-password?token=...`. `POST /api/auth/reset-password` verifies the token, sets the new hash, marks the token used and deletes all of the user's sessions.
4. Every page and every API route calls `requireUser()` first. A removed member fails on their next request, and removal also deletes their sessions.
5. The first admin is created when the email equals the `ADMIN_EMAIL` environment variable and `approved_emails` is empty.

### 3.2 Idea to storyboard (synchronous, under 30 s)

1. Step 1 posts the idea, length and audience to `POST /api/videos`.
2. The API checks the daily cap and monthly voice credits, runs the safety check, then creates the `videos` document with status `draft`.
3. `LlmProvider.generate` returns storyboard JSON; zod validates it. On failure the error text is fed back for up to 2 retries.
4. Word-count check against the length target (about 2.3 words per second, 10% tolerance); one corrective retry if outside.
5. Scenes are saved, status becomes `storyboard_ready`, and the Review screen loads the video in one read. Edits autosave through `PATCH` calls.

### 3.3 Generate: voice, sync, render (asynchronous)

1. **Looks good** calls `POST /api/videos/:id/render`. The API locks the storyboard (`status: rendering`), creates a `render_jobs` row and sends the Inngest event `video/render.requested`.
2. `renderVideo` runs one step per scene for voice and word timings, then sync, then stock media, then the Sandbox render, then the R2 upload (detail in section 6).
3. The UI polls `GET /api/videos/:id/render/status` every 3 seconds for stage and percentage; the user may leave and return from the Library.
4. On success: `status: ready`, a signed player URL is issued on demand, and an in-app notice is created.

### 3.4 Post or schedule

1. Step 4 shows the connected account (or the Connect flow, section 8) and the AI-prefilled caption.
2. **Post now** or **Schedule** calls `POST /api/videos/:id/post`, which creates a `posts` row and sends `post/requested` with the run time.
3. `publishInstagram` sleeps until the time, creates the media container from a short-lived signed R2 URL, polls until ready, publishes, and stores the permalink.
4. The post moves `scheduled -> publishing -> posted` or `failed`; the Library shows it. Cancel and reschedule send events that cancel the sleeping run.

## 4. Data design

MongoDB holds one document per video with its scenes embedded, so the Review screen and the player load with a single read. A video stays far below the 16 MB document limit (a 90 second video is about 12 scenes). Files never live in the database; documents store R2 keys.

### Collections

| Collection | Key fields | Notes |
| --- | --- | --- |
| `users`, `sessions`, `password_resets` | Auth data (section 3.1) | Hashes only; no raw passwords or tokens |
| `approved_emails` | `email` (unique, lowercased), `role`, `dailyLimit`, `addedBy`, `addedAt` | The access gate; checked on sign-up and every request |
| `videos` | `userId`, `topic`, `lengthSec`, `language`, `audience`, `voiceId`, `speed`, `theme`, `musicId`, `captionsOn`, `status`, `caption`, `scenes[]`, `outputKey`, `thumbKey`, `version`, `createdAt`, `updatedAt`, `deletedAt` | `version` is an integer for optimistic concurrency on autosave |
| `render_jobs` | `videoId`, `userId`, `status`, `stage`, `progress`, `inngestRunId`, `sandboxId`, `error`, `outputKey`, `attempt`, `startedAt`, `finishedAt` | One active job per video |
| `instagram_connections` | `userId`, `igUserId`, `username`, `accountType`, `profilePictureUrl`, `tokenEnc`, `tokenIv`, `tokenTag`, `tokenExpiresAt`, `status`, `connectedAt` | Token encrypted; never returned by any API |
| `posts` | `videoId`, `connectionId`, `caption`, `scheduledAt`, `status`, `containerId`, `igMediaId`, `permalink`, `error`, `inngestRunId`, `lateByMs` | `containerId` saved before publish for safe retry |
| `assets` | `videoId`, `sceneId`, `source`, `sourceUrl`, `licence`, `attribution`, `storageKey` | Licence record per stock asset |
| `usage_log` | `userId`, `videoId`, `type`, `units`, `createdAt` | Types: `llm`, `voice_credits`, `render_sec`, `video_created` |
| `oauth_states` | `state`, `userId`, `expiresAt` | TTL index, 10 minutes |
| `notifications` | `userId`, `kind`, `refId`, `readAt`, `createdAt` | In-app notices |

### Scene shape (embedded in `videos.scenes`)

```ts
type Scene = {
  id: string; order: number;
  template: 'title-hook' | 'bullet-reveal' | 'step-flow' | 'diagram' | 'definition-callout' | 'stat' | 'comparison' | 'timeline' | 'formula' | 'stock-clip' | 'recap';
  diagram?: 'flow' | 'raindrop' | 'orbit';         // for template 'diagram'
  title?: string;
  narration: string;
  needsCheck: boolean;                              // factual-claim marker (S8)
  elements: { id: string; type: string; text: string; cue: string; startMs?: number }[];
  media?: { assetId: string; query: string };
  audio?: { key: string; hash: string; durationMs: number; words: { word: string; startMs: number; endMs: number }[] };
  durationMs?: number;                              // lead-in + audio + tail, set by sync
}
```

`audio.hash` is a hash of narration, voice id and speed. If it is unchanged, voice is not generated again, which is how "fix a scene" avoids re-spending credits on untouched scenes.

### Status state machines

| Entity | States and transitions |
| --- | --- |
| `videos.status` | `draft -> storyboard_ready -> rendering -> ready`; `rendering -> failed` (retry returns to `rendering`); `ready -> scheduled -> posted`; `posted` is terminal. Editing a `ready` video reopens `storyboard_ready` and clears `outputKey` only after the new render succeeds |
| `render_jobs.status` | `queued -> running -> succeeded` or `failed` or `cancelled` |
| `posts.status` | `scheduled -> publishing -> posted` or `failed`; `scheduled -> cancelled`. A failed post can retry, going back to `publishing` |
| `instagram_connections.status` | `connected -> needs_reconnect -> connected`; `disconnected` deletes the token |

### Indexes

- `approved_emails`: unique on `email`.
- `videos`: `{ userId: 1, createdAt: -1 }`, and `{ userId: 1, status: 1 }` for the Library filter.
- `render_jobs`: `{ videoId: 1, startedAt: -1 }`.
- `posts`: `{ status: 1, scheduledAt: 1 }` and `{ videoId: 1 }`.
- `usage_log`: `{ userId: 1, type: 1, createdAt: -1 }` for the daily and monthly guards.
- `oauth_states`: TTL on `expiresAt`.

### Consistency rules

- **Optimistic concurrency:** autosave sends `version`; the update filter includes it and increments it. A mismatch returns 409 and the UI reloads.
- **Idempotency:** workflow steps write with upserts keyed by (`videoId`, `sceneId`, `audio.hash`) or (`postId`). Running a step twice never duplicates a render or a post.
- **Quota counting:** a video counts toward the daily cap at creation (`video_created` row), and a failed render refunds it by writing a compensating row. Scene fixes write no `video_created` row.
- **Retention:** deleting a video sets `deletedAt`; `cleanupDeletedVideos` removes R2 files after 7 days and then the document.

## 5. API design

All endpoints are internal JSON routes in Next.js route handlers on the Node.js runtime. Every handler follows the same shape: `requireUser()` (or `requireAdmin()`), parse the body with a zod schema, call a service function in `src/server`, return JSON. Handlers contain no business logic.

### Conventions

- **Auth:** session cookie (HttpOnly, Secure, SameSite=Lax). `requireUser()` also re-checks the approved list. 401 when signed out, 403 when not approved or not an admin.
- **Ownership:** every `videoId`, `postId` or connection in a path is loaded with `userId` in the filter. A member asking for someone else's id gets 404, not 403.
- **Validation:** request and response bodies use shared zod schemas from `src/lib/schemas`. Unknown fields are rejected.
- **Errors:** `{ error: { code, message } }` with a stable `code` the UI maps to plain text (`DAILY_LIMIT`, `VOICE_CREDITS_LOW`, `UNSAFE_TOPIC`, `VERSION_CONFLICT`, `IG_NOT_ELIGIBLE`, ...).
- **Progress:** status is polled every 3 seconds. Server-sent events are avoided because serverless functions have time limits; polling is simpler and sufficient for a handful of users.
- **Mutations** that start work (`render`, `post`) accept an `Idempotency-Key` header and return the existing job if the key was already used.

### Endpoints

| Method and path | Who | Purpose | Notes |
| --- | --- | --- | --- |
| `POST /api/auth/signup`, `login`, `logout`, `forgot-password`, `reset-password`; `GET /api/auth/google`, `/api/auth/google/callback` | Public (logout: member) | Signup, login, reset and Google sign-in | Signup and Google blocked by the approved-email check; per-IP limits |
| `ALL /api/inngest` | Inngest | Serve workflow functions | Verified with the Inngest signing key |
| `GET /api/me` | Member | Profile, role, videos left today, voice credits left | Drives the Idea screen counter |
| `GET, POST, PATCH, DELETE /api/admin/approved-emails` | Admin | Manage access, role, daily limit | Delete also revokes sessions (A5) |
| `GET /api/admin/usage` | Admin | Videos per member per day, monthly voice credits | Reads `usage_log` |
| `POST /api/ideas/suggest` | Member | 6 topic ideas for an optional subject | LLM call, not counted toward the daily cap |
| `POST /api/ideas/angles` | Member | 3 angles and a hook for a topic | Optional step |
| `POST /api/videos` | Member | Create from idea; returns the storyboard | Counts toward the daily cap; 30 s budget |
| `GET /api/videos/:id` | Member | Full video with scenes | One read |
| `PATCH /api/videos/:id` | Member | Update settings: voice, speed, theme, music, captions, caption text | Needs `version` |
| `PATCH /api/videos/:id/scenes/:sceneId` | Member | Edit narration or on-screen text, reorder, delete | Needs `version`; recomputes estimated length |
| `POST /api/videos/:id/scenes/:sceneId/regenerate` | Member | Regenerate one scene | LLM call |
| `POST /api/videos/:id/regenerate` | Member | Regenerate the whole storyboard | Does not add a second `video_created` row |
| `POST /api/videos/:id/render` | Member | Lock storyboard and start `renderVideo` | `{ sceneIds? }` renders only those scenes (fix a scene) |
| `GET /api/videos/:id/render/status` | Member | Stage, progress, error | Polled |
| `POST /api/videos/:id/render/cancel` | Member | Cancel queued or running render | Sends `video/render.cancel` |
| `GET /api/videos/:id/media` | Member | Signed URLs for the player, thumbnail and download | URLs live 1 hour |
| `GET /api/voices` and `GET /api/voices/:id/sample` | Member | Voice list and 5 second samples | Samples are pre-generated once and cached in R2 |
| `GET /api/instagram/connect` | Member | Start OAuth: create state, redirect to Meta | Section 8 |
| `GET /api/instagram/callback` | Member | Finish OAuth: verify state, exchange token, store | Section 8 |
| `GET /api/instagram/connection` | Member | Connected account summary and status | Never includes the token |
| `DELETE /api/instagram/connection` | Member | Disconnect and delete the token |  |
| `POST /api/videos/:id/post` | Member | Post now or schedule | `{ caption, scheduledAt? }`; warns if already posted |
| `PATCH /api/posts/:id` | Member | Reschedule or cancel | Sends update or cancel event |
| `POST /api/posts/:id/retry` | Member | Retry a failed post |  |
| `GET /api/library` | Member | Cards with status; `?q=` and `?status=` filters | `deletedAt` excluded |
| `POST /api/videos/:id/duplicate`, `DELETE /api/videos/:id` | Member | Duplicate idea; soft delete | 7 day grace |
| `GET /api/notifications`, `POST /api/notifications/:id/read` | Member | In-app notices |  |

### Rate and quota guards

- **Daily cap** (A7) is enforced in the service layer when `POST /api/videos` runs, using `usage_log` counts for the member's local day (stored time zone, default Asia/Kolkata).
- **Monthly voice credits:** before a render starts, estimated credits (narration characters) are compared with the remaining monthly budget; the call fails with `VOICE_CREDITS_LOW` if it would exceed it.
- **Auth endpoints** get a simple per-IP limit (for example 10 attempts a minute) kept in Mongo with a TTL index, since no Redis is used.
- **Concurrent work:** one active render per video; creating a second returns the existing job.

## 6. Workflow design (Inngest)

The Next.js app serves Inngest at `/api/inngest` and sends events; Inngest calls back to run each `step.run` as its own HTTP request and stores its result. A failure retries from the failed step, not from the start. Each step must finish inside the Vercel function limit for the plan (set `maxDuration` explicitly and check the current Hobby limit before relying on it), so long work lives in the Sandbox and the workflow only starts it and checks on it.

### Functions

| Function | Trigger | Concurrency and retries | What it does |
| --- | --- | --- | --- |
| `renderVideo` | `video/render.requested` | Global concurrency 1 (Sandbox cost and limits), 3 retries per step with backoff, `cancelOn` `video/render.cancel` matched by `videoId` | Voice per scene, sync, media, Sandbox render, upload, finalise |
| `publishInstagram` | `post/requested`, `post/updated`, `post/cancel` | Concurrency 1 per connection, 3 retries on transient errors, `cancelOn` cancel and update events | Sleep until time, create container, poll, publish |
| `refreshInstagramTokens` | Cron, daily | Single run | Refresh tokens expiring within 10 days; mark failures `needs_reconnect` and notify |
| `cleanupDeletedVideos` | Cron, daily | Single run | Delete R2 files and documents for videos soft-deleted over 7 days ago |
| `sampleVoices` | Manual event | Single run | Pre-generate the 5 second voice samples into R2 once per voice |

### renderVideo, step by step

| Step | Work | Writes |
| --- | --- | --- |
| `load` | Read video, check not already rendering; set job `running` | `render_jobs.stage = voice` |
| `voice:<sceneId>` (parallel, one `step.run` per scene) | Skip if `audio.hash` matches; else call `VoiceProvider`, upload mp3 to R2, store word times | `scenes[].audio`, `usage_log` credits |
| `sync` | Match cues to word times, compute scene durations, run quality checks | `scenes[].elements.startMs`, `durationMs` |
| `media:<sceneId>` | Fetch stock clips, upload, record licence; fall back to a text or diagram template on no result | `assets`, scene `media` |
| `props` | Build Remotion props JSON, upload to R2 | `render_jobs.stage = render` |
| `render:start` | Create the Sandbox, install the bundled project, start Remotion in detached mode | `sandboxId` |
| `render:poll` (loop) | `step.sleep` 10 seconds, read progress from the Sandbox, update job; stop on done, failure or a 15 minute ceiling | `progress` |
| `upload` | Read the MP4 in the Sandbox, upload to R2, also render one thumbnail frame | `outputKey`, `thumbKey` |
| `finalise` | Stop the Sandbox, set video `ready`, create notification | `videos.status = ready` |
| `onFailure` | Stop the Sandbox, mark job and video `failed` with a plain reason, refund the daily count | compensating `usage_log` row |

Fix-a-scene follows the same function with `sceneIds`: voice is skipped for unchanged scenes by hash, and only changed scenes are re-synced, but the final render still assembles the whole timeline, since Remotion renders one composition. Scene-level render caching is a later optimisation.

### publishInstagram, step by step

1. `step.sleepUntil(scheduledAt)` (or skip for post now). If the plan limits sleep length, the app stores the target time and re-enters in shorter hops.
2. `step.run('container')`: if `posts.containerId` exists, reuse it; else create the container from a 1 hour signed R2 URL and save the id.
3. `step.run('poll')` in a loop with `step.sleep` until status is `FINISHED` (give up after about 10 minutes).
4. `step.run('publish')`: publish, read the permalink, save `igMediaId` and `permalink`, set `posted`.
5. A late run (service was down at the scheduled time) still publishes and sets `lateByMs`.

### Rules that keep workflows safe

- **Deterministic step ids** and per-step idempotency, so replays never duplicate a render, container or post.
- **No secrets in step output.** Step results are stored by Inngest; return ids and keys only, never tokens or signed URLs.
- **Progress writes** go to `render_jobs` from inside steps; the UI never talks to Inngest.
- **Cancellation** stops the run at the next step boundary; the `onFailure` handler also runs for cancels to stop the Sandbox.
- **Local development** uses the Inngest dev server; free-plan limits (sleep length, concurrency, step counts) are verified in phase 0.

## 7. Media pipeline: AI, voice, sync, render

This is the part proven in the prototype. Only the wrapping (queues, storage, database) is new.

### 7.1 Storyboard generation

- **Provider:** Gemini through `LlmProvider`, JSON response mode. The model id comes from the `GEMINI_MODEL` environment variable, defaulting to the `gemini-flash-latest` alias, because the 2.5 model ids returned 404 for new keys during the prototype.
- **Prompt contract:** the idea, length, audience and the allowed template list go in; out comes `{ title, accent, scenes: [{ template, diagram?, title?, narration, needsCheck, elements: [{ type, text, cue }] }] }`. Rules stated in the prompt: 4 to 12 scenes by length, a hook in scene 1, one example, a recap; narration uses plain words and numbers as words; element text is short (max 6 words, 9 for a definition); a `cue` is 1 to 3 consecutive words copied exactly from that scene's narration; elements are listed in spoken order; the first element's cue is within the first three words.
- **Validation (zod plus rules):** schema check; every `cue` must occur in its scene's narration; element order matches cue order (the build rule from the prototype); word count within 10% of the target; template and diagram values in the allowed set. On failure the error text is returned to the model, up to 2 retries.
- **Safety:** a keyword pre-check on the idea plus the model's safety settings; blocked topics return `UNSAFE_TOPIC`. Model output is data only: it is never rendered as HTML, and text is escaped in React.
- **Free-tier limits:** calls are queued through Inngest where asynchronous; the synchronous storyboard call retries once on 429 with a short delay, then returns a friendly retry message.

### 7.2 Voice and word timings

- **Call:** ElevenLabs `text-to-speech/{voice}/with-timestamps` (model `eleven_multilingual_v2`, `mp3_44100_128`). The response contains base64 audio and per-character start and end times.
- **Word grouping:** a word is a run of non-space characters; start is its first character's start, end is its last character's end. Duration is the last end plus 0.05 s.
- **One call per scene**, so timing stays scene-local and a changed scene re-synthesises alone. Cost is about one credit per character; `usage_log` records it.
- **Plans:** on the free plan only ElevenLabs' stock voices work through the API; library voices (the Indian-accent ones adit chose) return `paid_plan_required`. `GET /api/voices` therefore returns only voices that passed a one-time probe, stored in config. Speed (slow, normal, fast) maps to the provider's speed setting where available, or is applied by the renderer's playback rate for audio and clock together if not (to be confirmed in phase 1).
- **Monthly guard:** remaining credits are tracked from `usage_log` for the calendar month. Generate is blocked with `VOICE_CREDITS_LOW` when the estimate for the video exceeds what is left. The ElevenLabs key used in testing was scoped without `user_read`, so the app does not depend on reading quota from the API.
- **Fallback:** if timestamps are missing, an alignment pass would derive them; V1 ships without it and spaces elements evenly (PRD section 10).

### 7.3 Sync

Inputs per scene: narration, elements with cues, word list. Output: frame numbers, in `src/sync`.

1. Normalise text: lowercase, keep letters, digits and apostrophes, split on whitespace.
2. Find the cue as a consecutive token run. Exact match first; if none, allow one-token edit distance per word (Indian names and number words); if still none, space the unmatched elements evenly across the scene and log a warning.
3. `startFrame = leadIn + round(t * fps) - 3`, so the visual lands three frames before the word. `leadIn` is 0.15 s and a tail of 0.15 s follows the audio (the 0.3 s from the PRD).
4. The first element of each scene is clamped to appear within the first second of the scene (changed from 4 frames after the phase 1 spike: the voice does not start until about 0.7 to 1.1 s, so 4 frames put the first element up to 1 s early). Templates show their label from frame 0 so a scene is never empty.
5. If element start times are out of order, the elements are sorted by start time and a warning is stored, instead of failing the render as the prototype did.
6. Scene duration is `leadIn + ceil(audioSeconds * fps) + tail` frames; captions use the same word times shifted by `leadIn`, so voice, captions and visuals share one clock.

**Automatic quality checks before render:** no element starts before the voice begins, none outlasts the scene, text fits its template box (character limits per template), and the sum of scene frames equals the audio length within one frame. A failed check marks the scene `needsAttention` and, if fixable (shorten text, switch template), fixes it and logs the change.

### 7.4 Stock media and music

- The storyboard gives a short search query per stock-clip scene. `MediaProvider` queries Pexels first, then Pixabay, preferring portrait clips of at least the scene length; the clip is cropped to 9:16 in Remotion.
- Each used asset gets an `assets` row with source, URL and licence; attribution text is appended to the caption where a licence requires it.
- No result: the scene switches to a text or diagram template and the change is logged.
- Music: 5 to 8 licensed tracks stored in R2, chosen by id. Remotion lowers the volume under speech (ducking) using the word times: volume is reduced in frames where any word is active.

### 7.5 Rendering

- **Composition:** one Remotion composition `Video`, 1080x1920, 30 fps, `calculateMetadata` sums scene durations. Props are the validated JSON built by the `props` step; the same shape the prototype writes to `out/<slug>.props.json`.
- **Templates:** title hook, bullet reveal, step flow, definition callout and diagrams exist today; the rest of the PRD library (stat, comparison, timeline, formula, stock clip, recap) is built in phase 3. All animation is a function of the frame number (`useCurrentFrame`, `spring`, `interpolate`), so output is deterministic.
- **Sandbox run:** the Sandbox receives the Remotion project and props, bundles with `@remotion/bundler`, and renders with `renderMedia` (H.264 plus AAC, `concurrency` set to the machine's cores). The prototype rendered 24 to 47 second videos in 40 to 90 seconds on a modest machine; phase 1 re-measures this in Sandbox against the 5 minute target.
- **Safe area:** templates keep text inside the Instagram safe area (captions sit above the bottom UI zone).
- **Thumbnail:** one `renderStill` of the hook frame.

### 7.6 Storage layout (R2)

| Key | Content |
| --- | --- |
| `videos/<videoId>/audio/<sceneId>-<hash>.mp3` | Scene audio |
| `videos/<videoId>/props-<jobId>.json` | Render props, for debugging and re-render |
| `videos/<videoId>/out/<jobId>.mp4` | Final video |
| `videos/<videoId>/thumb-<jobId>.jpg` | Thumbnail |
| `media/<source>/<assetId>.mp4` | Cached stock clip |
| `music/<trackId>.mp3` | Licensed tracks |
| `voices/<voiceId>-sample.mp3` | 5 second samples |

The bucket is private. The browser and Instagram receive time-limited signed URLs only.

## 8. Instagram integration

Endpoint names, scopes and limits below follow the PRD and must be re-checked against Meta's current docs in phase 0; they change.

### 8.1 Connect flow (PRD four steps)

| Step | Server behaviour |
| --- | --- |
| 1. Click **Connect Instagram** | `GET /api/instagram/connect` requires a signed-in approved member, writes `oauth_states { state, userId, expiresAt: +10 min }` with a random 32 byte state |
| 2. Meta authorization screen | 302 to Meta's Instagram Login authorize URL with the app id, redirect URI, publishing scope and `state`. The app never sees the Instagram password |
| 3. Authorize an eligible professional account | Meta redirects to `/api/instagram/callback?code&state` |
| 4. Store and show | Callback loads and deletes the state (single use) and checks it belongs to the signed-in user; exchanges the code for a short-lived token, then for a long-lived token, server side; reads the profile; encrypts and saves the token; redirects to Post with the account card (picture, @username, type, date, status) |

Failure paths: user cancels on Meta (error parameter) returns to the app with a plain message and nothing saved; ineligible account (personal) shows the switch-to-professional guide and Try again; bad or expired state returns a generic error and logs it.

### 8.2 Token handling

- Encrypted with AES-256-GCM using a 32 byte key in `IG_TOKEN_KEY` (Vercel environment variable); random IV per token; IV and auth tag stored beside the ciphertext. Decryption happens only inside the publish and refresh steps.
- Never sent to the browser, never logged, never in Inngest step output.
- Long-lived tokens last about 60 days. `refreshInstagramTokens` runs daily and refreshes tokens within 10 days of expiry (Meta requires the token to be at least a day old). A failed refresh sets `needs_reconnect`, pauses that member's scheduled posts and creates a notification.
- Disconnect deletes the ciphertext and sets `disconnected`.
- Key rotation: store a `keyVersion` with each token; a script re-encrypts on rotation.

### 8.3 Publishing

1. Create a Reels media container with `video_url` (a 1 hour signed R2 URL) and the caption.
2. Poll the container status until `FINISHED`; `ERROR` maps to a plain reason.
3. Publish the container; read the permalink; save `igMediaId` and `permalink`.
4. The container id is stored before step 3, so a retry after a crash publishes the same container instead of creating a second one.

**Video requirements** (checked by the renderer settings and a pre-post check): MP4 or MOV, 9:16, 5 to 90 seconds, H.264 with AAC, under 100 MB. The upload step verifies size and duration before enabling Post.

### 8.4 Errors and what the member sees

| Condition | Handling |
| --- | --- |
| Token expired or revoked | `needs_reconnect`, Reconnect button, scheduled posts pause |
| Rate limit (about 100 API posts per 24 hours per account) | Retry later; far above V1 volume |
| Container error or video rejected | Show Meta's reason in plain words; offer re-export or manual download |
| Network or 5xx | Automatic retry up to 3 times with backoff |
| Post time in the past | Block, or offer Post now |
| Video already posted | Warn before posting again |

### 8.5 Development-mode constraints

- The Meta app stays in development mode. Each member who connects needs a role on the app (admin, developer or tester), and their Instagram account must be a professional account. A privacy policy URL and basic app details are likely required in the Meta app settings.
- Open item: whether Creator accounts can publish through the current Instagram Login flow. Test with a Business account first.
- Fallback always available: download the MP4 and caption and post manually (Q8).

## 9. Security and privacy

The threat that matters most for an invite-only internal tool is a stranger getting in or a teammate reaching another teammate's data or Instagram token. Controls are layered so no single check is the only defence.

### Controls

| Area | Control |
| --- | --- |
| Access | Approved-email check in the signup service and Google callback, and again in `requireUser()` on every page and API call. No public sign-up. Role (`admin` or `member`) read from `approved_emails`, not from the client |
| Sessions | HttpOnly, Secure, SameSite=Lax cookies; removal of a member deletes their sessions; sign-out invalidates server side |
| CSRF | SameSite cookies plus an origin check on state-changing routes; OAuth `state` is single use, 10 minute TTL and bound to the user |
| Authorisation | Every query filters by `userId`; other members' ids return 404. Admin routes use `requireAdmin()` |
| Secrets | Database, R2, Inngest, Meta, Gemini, ElevenLabs and `IG_TOKEN_KEY` only in Vercel environment variables; none in the repo, logs, Mongo or chat. A `.env.local` file is git-ignored |
| Instagram tokens | AES-256-GCM at rest, decrypted only in workflow steps, never returned or logged (section 8.2) |
| Storage | Private R2 bucket; signed URLs of 1 hour for browser and Instagram; no public listing |
| Input | zod validation on every body; unknown fields rejected; storyboard output validated and escaped; length caps (idea 500 characters, caption to Instagram's limit) |
| Prompt injection | The idea is user text in a data slot of the prompt; model output is parsed as JSON and never executed or rendered as HTML; cues must match narration so a poisoned field cannot reference other data |
| Content safety | Keyword pre-check plus model safety settings; no voice cloning, no real people's likenesses (PRD 8.4) |
| Abuse | Daily cap, monthly voice guard, auth rate limit, one render at a time |
| Logging | Structured logs with ids only; tokens, signed URLs and emails are redacted |
| Privacy | A short privacy policy page (Meta likely needs one); deleting a member's data deletes files, documents and tokens |
| Licences | Every stock asset and music track has a licence record; attribution surfaces when required |

### Secret handling rule for this project

Keys shared in chat during the prototype are treated as exposed. Before the real app is deployed, rotate the Gemini and ElevenLabs keys and store the new ones only in Vercel environment variables.

### Threats considered

| Threat | Mitigation |
| --- | --- |
| Unapproved person signs up through the API | Signup service rejects before any row is written; test calls the API directly (PRD 11) |
| Member removed but still has a tab open | Next request fails the approved check; sessions deleted |
| Forged Instagram callback | `state` single use, user-bound, short TTL |
| Token theft from the database | Ciphertext only; key outside the database |
| Leaked video URL | URLs expire in 1 hour; objects not public |
| Runaway free-tier use | Quota guards, concurrency 1, Vercel Spend Management on Sandbox |
| Malicious topic or injected instructions | Safety checks, schema validation, output never executed |

## 10. Frontend, environments and operations

### 10.1 Frontend

| Route | Screen (PRD section 6) | Notes |
| --- | --- | --- |
| `/sign-in` | Sign-in | Shows the invite-only message for others |
| `/` | Dashboard home | One large **Create video** button, Library below |
| `/create` | Step 1: Idea | Suggest ideas, angles, length, audience; videos left today |
| `/videos/[id]/review` | Step 2: Review | Scene cards, voice picker with samples, theme, music, captions |
| `/videos/[id]/generate` | Step 3: Generate | Progress, then player; fix a scene; download |
| `/videos/[id]/post` | Step 4: Post | Connect Instagram, caption, post now or schedule |
| `/library` | Library and detail | Cards, search, status filter |
| `/settings` | Settings | Instagram connection status, disconnect |
| `/admin` | Admin | Approved emails, roles, limits, usage (admin only) |

- **Rendering model:** server components load data; client components handle editing. Status polling uses SWR with a 3 second interval that stops on a terminal status.
- **Autosave:** debounced `PATCH` (about 800 ms) with the `version` field; the UI shows Saved or Conflict and reloads on 409. A refresh or closed tab loses nothing (PRD 4).
- **Preview:** Remotion's `@remotion/player` can preview a scene from the same props in the browser; the real MP4 is only produced by the render workflow. This is optional for V1 and is deferred if it slows the build.
- **Responsive and accessible:** works at phone width, one main action per screen, keyboard usable, captions on by default, contrast checked.
- **Errors:** every API error code maps to one plain sentence and one action button (Try again, Reconnect, Download instead).

### 10.2 Environments

| Environment | Purpose | Notes |
| --- | --- | --- |
| Local | Development | `next dev`, Inngest dev server, separate Atlas database or a local MongoDB, a test R2 bucket; `.env.local` git-ignored |
| Preview | Pull request checks | Vercel preview with the dev database and a dev Inngest environment |
| Production | adit and approved team | Vercel production, Atlas production database, production Inngest environment, Meta app in development mode |

### 10.3 Configuration (names only)

`MONGODB_URI`, `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_IDS`, `ELEVENLABS_MONTHLY_CREDITS`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`, `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `IG_TOKEN_KEY`, plus Vercel Sandbox credentials as the Remotion Vercel integration requires.

### 10.4 Build and deployment

- Source in one Git repository; GitHub Actions run type check, lint, unit tests and the sync golden tests on every pull request.
- Vercel deploys previews per pull request and production from `main`. Inngest syncs functions automatically on each deploy.
- Database changes are additive (new fields optional); indexes are created by an idempotent `ensureIndexes()` on startup of a migration script, not at request time.
- The Remotion project is bundled once per deploy and cached; the Sandbox pulls the bundle instead of rebuilding for every render, to protect the 5 minute target.

### 10.5 Observability

- **Logs:** structured JSON with `videoId`, `jobId`, `userId` and step name; secrets redacted.
- **Workflow view:** the Inngest dashboard shows each run, step and retry. `render_jobs.stage` and `progress` give the in-app view.
- **Usage:** `usage_log` feeds the Admin page (videos per member per day, monthly voice credits, render seconds) so adit can see where free quotas go.
- **Alerts:** failures create in-app notices; for adit, an email or chat alert on `renderVideo` failure rate is a P2 add-on.
- **Health:** a `/api/health` route checks Mongo connectivity and returns build version; used for smoke checks after deploy.

### 10.6 Cost and quota guards

| Resource | Limit to watch | Guard |
| --- | --- | --- |
| ElevenLabs credits | About 10,000 a month on free | Monthly voice-credit guard before render |
| Gemini free tier | Request rate limits | Queue and retry; fall back to the Groq adapter behind `LlmProvider` if needed |
| Vercel Sandbox | Usage-billed | Concurrency 1, 15 minute ceiling, Spend Management cap |
| Vercel functions | Execution limit per step | Short steps, long work in Sandbox |
| MongoDB Atlas M0 | 512 MB storage, no automatic backups | Keep media out of Mongo; scheduled export before relying on data |
| R2 free tier | Storage and operations | 7 day deletion grace, cleanup job, no public egress |
| Inngest free plan | Sleep length, concurrency, steps | Verified in phase 0; shorter sleep hops if needed |

## 11. Failure handling, testing, risks and open decisions

### 11.1 Failure modes

| Failure | Detection | Response |
| --- | --- | --- |
| Gemini returns invalid JSON or off-length script | zod and rule validation | Retry twice with the error text; then friendly retry message |
| Gemini 429 or outage | HTTP status | One short retry, then retry message; `LlmProvider` allows a Groq adapter |
| ElevenLabs refuses a voice (402) or runs out of credits | Status code, monthly guard | Block Generate with a plain reason; offer a stock voice |
| Cue not found in word list | Sync step | Fuzzy match, then even spacing with a logged warning |
| No stock clip | Empty search result | Switch scene to text or diagram template |
| Sandbox fails to start or render times out | Step error, 15 minute ceiling | Retry the step; then `failed` with Try again; Sandbox stopped in `onFailure` |
| R2 upload fails | Step error | Step retry; the MP4 stays in the Sandbox until upload succeeds |
| Instagram token expired or revoked | 190-type error or refresh failure | `needs_reconnect`, posts paused, member notified |
| Instagram rejects the video | Container `ERROR` | Plain reason; re-export or manual download |
| Deploy during a run | Inngest replays | Steps resume; idempotency keys prevent duplicates |
| Missed schedule because of an outage | Late run | Publish when back and set `lateByMs` |

### 11.2 Testing strategy

| Layer | What is tested | How |
| --- | --- | --- |
| Unit | Character-to-word grouping, cue matching (exact, fuzzy, missing), duration maths, quota guards, token encryption round trip | Vitest with recorded ElevenLabs responses |
| Contract | Storyboard zod schema, API request and response schemas, provider interface mocks | Vitest; schema fixtures from the prototype storyboards |
| Sync golden tests | 10 sample storyboards with recorded timings: assert every element start frame stays within 3 frames of its word | Vitest, no network |
| Render | One short composition rendered in CI; sampled frames compared to reference images; audio and video lengths equal within one frame | Remotion, headless Chromium |
| Auth | Unapproved email cannot sign up or sign in through UI or direct API; removed member loses access on next call; cross-user id returns 404 | Integration tests against a test database |
| Workflow | `renderVideo` and `publishInstagram` with fake providers: retries, cancel, idempotent replay | Inngest test engine or dev server |
| End to end | Idea to posted Reel on a test Business account | Playwright, run manually before release |
| Manual | Sync spot check on at least 10 videos, pronunciation of Indian names (V8), phone-width layout | Checklist |

### 11.3 Risks that shape the design

| Risk | Design response |
| --- | --- |
| Remotion on Vercel Sandbox is experimental and defaults to Vercel Blob output | `Renderer` interface; custom R2 upload step; phase 1 spike proves it before any screen is built |
| Sandbox start and render time may miss 5 minutes | Cached bundle, parallel voice, concurrency tuning; measured in the spike; fallback host behind the same interface |
| ElevenLabs free plan blocks Indian-accent library voices | Voice interface; probe list of usable voices; paid plan or other provider if Indian accent is required |
| Inngest free-plan sleep and concurrency limits | Checked in phase 0; short sleep hops; concurrency 1 by design |
| Meta development mode and Creator account eligibility | Roles added early; Business account test first; manual-post fallback |
| Atlas M0 has no automatic backups | Scheduled export job, and media kept out of Mongo |
| Solo build, scope creep | Hold to the PRD non-goals |

### 11.4 Decisions I made that you should confirm

1. **Whole-timeline render for scene fixes.** The PRD says to re-render only the changed scene. Remotion renders one composition, so the design re-uses cached voice and re-renders the full timeline (about a minute). Per-scene clip rendering and concatenation is a later optimisation. Confirm this is acceptable.
2. **Polling instead of server-sent events** for progress, to stay within serverless limits.
3. **Unordered cues are sorted, not rejected,** at sync time (the prototype failed the build instead).
4. **Stock voices only until a voice decision is made.** Indian-accent voices (Viraj and the voice adit picked as Monica, which the account lists as Tara) need a paid plan or another provider.
5. **Daily limit counts at creation and is refunded on failed render.**
6. **Time zone** for the daily limit defaults to Asia/Kolkata and is stored per member.

### 11.5 Open items to resolve before or during the phase 1 spike

- Sandbox: cold start, render time for a 60 second video, and the R2 upload path.
- Inngest free plan: maximum sleep, so how far ahead a post can be scheduled.
- Meta: Creator account eligibility, exact scopes and current endpoint names, privacy policy URL requirement.
- ElevenLabs: speed parameter availability and the final voice and plan choice.
- Domain and trademark availability for Vidyareel (not verified).

### 11.6 Build map

| Phase (PRD 12) | Design sections it implements |
| --- | --- |
| 0. Setup | 2 repository and providers, 9 access gate, 10.2 to 10.4 environments |
| 1. Pipeline spike | 7.2 to 7.6 and 6 `renderVideo` with a hard-coded script; proves Sandbox, R2 upload and sync |
| 2. Storyboard AI | 3.2, 5 idea and video routes, 7.1 |
| 3. Template library | 7.4 and 7.5, remaining templates and themes |
| 4. Render workflow | 6 `renderVideo`, status polling, player, fix-a-scene, Library, daily cap |
| 5. Instagram | 8 and 6 `publishInstagram`, token refresh |
| 6. Hardening | 9 and 10.5, Admin page, usage log, failure modes, test set |
