# Vidyareel: Implementation Steps

Last updated: 2026-10-24 (prompt 11)

The phases in [Phases.md](Phases.md) broken into small steps. Do them in order; each step is one focused change with a check that proves it works. Step ids (`0.3`) are used in [Project-Status.md](Project-Status.md).

Legend: ✅ done (code exists) · 🟡 code exists, not verified · ⬜ not started · 👤 needs an account or key from you

## Phase 0: Setup and foundation

### 0A. Project base
| Step | Task | Check |
| --- | --- | --- |
| 0.1 ✅ | Create `develop` branch, Next.js + TypeScript scaffold, folder layout | `tsc --noEmit` passes |
| 0.2 ✅ | Run `npm run dev`; fix any boot errors; home page loads | Browser shows the placeholder page |
| 0.3 ✅ | Add ESLint config and `npm run lint` | Lint passes |
| 0.4 ✅ | First commit of docs + scaffold; set up `main` | `git log` shows commits on both branches |

### 0B. MongoDB connection
| Step | Task | Check |
| --- | --- | --- |
| 0.5 ✅ | Create MongoDB Atlas M0 cluster, db user, network access | Atlas shows cluster running |
| 0.6 ✅ | Copy `.env.example` to `.env.local`, set `MONGODB_URI` | App reads the variable |
| 0.7 ✅ | Mongo client singleton (`src/server/db/client.ts`) | Code exists |
| 0.8 ✅ | Hit `GET /api/health` | Returns `{ ok: true }` (proves connection; checked against a local in-memory MongoDB, repeat on Atlas after 0.5) |
| 0.9 ✅ | Add `npm run db:indexes` script that calls `ensureIndexes()` | Indexes visible in Atlas |
| 0.10 ✅ | Add typed collection helpers (`users`, `sessions`, ...) in `src/server/db/collections.ts` | Types used by auth code |

### 0C. Env and config
| Step | Task | Check |
| --- | --- | --- |
| 0.11 ✅ | Zod-validated env loader (`src/server/env.ts`) that fails fast with clear messages | Missing var gives a named error |
| 0.12 ✅ | Set `APP_URL`, `ADMIN_EMAIL` | Loader passes for these |

### 0D. Email and password auth (backend)
| Step | Task | Check |
| --- | --- | --- |
| 0.13 ✅ | Password hashing (`password.ts`) | Unit test: hash/verify, wrong password fails |
| 0.14 ✅ | Token helpers (`tokens.ts`) | Unit test: hash is deterministic, tokens unique |
| 0.15 ✅ | Approved-email gate + first-admin rule (`approved.ts`) | Test: unapproved throws `INVITE_ONLY`; `ADMIN_EMAIL` accepted when list empty |
| 0.16 ✅ | Sessions (create, read, destroy) | Cookie set; session row stored hashed |
| 0.17 ✅ | `POST /api/auth/signup` | curl creates user for approved email, 403 otherwise |
| 0.18 ✅ | `POST /api/auth/login` | Right password 200, wrong 401 same message as unknown email |
| 0.19 ✅ | `POST /api/auth/logout` | Session row deleted, cookie cleared |
| 0.20 ✅ | `requireUser()` / `requireAdmin()` | 401 signed out; 403 removed member |
| 0.21 ✅ | `GET /api/me` (profile, role) | Returns user when signed in |
| 0.22 ✅ | Auth rate limits using `rate_limits` TTL collection | 11th attempt in a minute gets 429 |

### 0E. Forgot and reset password
| Step | Task | Check |
| --- | --- | --- |
| 0.23 ✅ | `EmailProvider` with console fallback | Link printed in server log |
| 0.24 ✅ | `POST /api/auth/forgot-password` (always 200) | Same response for unknown email |
| 0.25 ✅ | `POST /api/auth/reset-password` | New password works; old sessions deleted; token single-use |
| 0.26 ✅ | Resend key set; `EMAIL_FROM=onboarding@resend.dev` (gmail is rejected; needs a verified domain for other recipients) | Real email arrives (confirmed) |

### 0F. Google sign-in
| Step | Task | Check |
| --- | --- | --- |
| 0.27 ✅ | Google Cloud OAuth client; redirect `APP_URL/api/auth/google/callback`; set `GOOGLE_CLIENT_ID/SECRET` | Credentials created |
| 0.28 ✅ | `GET /api/auth/google` (state + PKCE) | Redirects to Google consent |
| 0.29 ✅ | `GET /api/auth/google/callback` | Approved Google account signs in; unapproved gets `?error=INVITE_ONLY` |
| 0.30 ✅ | Link Google to existing password account by email | One `users` row, both methods work |

### 0G. Auth screens
| Step | Task | Check |
| --- | --- | --- |
| 0.31 ✅ | Sign-in, Sign-up, Forgot, Reset pages with forms | Forms submit to the API |
| 0.32 ✅ | Match Stitch visuals (tokens, card, buttons, Google button) | Rebuilt from Stitch HTML incl. all interactive states; screenshot-checked |
| 0.33 ✅ | Map error codes to friendly messages (`INVITE_ONLY`, `WEAK_PASSWORD`, ...) | Each error shows the right text |
| 0.34 ✅ | Show `?error=` from Google callback on `/sign-in` | Message appears |
| 0.35 ✅ | Route protection (middleware/layout): signed-out users go to `/sign-in`; signed-in users skip auth pages | Redirects work |
| 0.36 ✅ | App shell: top bar with user menu and Sign out | Sign out returns to `/sign-in` |
| 0.37 ✅ | Auth tests (Vitest): flows in 0.13–0.25 | `npm test` green |

### 0H. Admin access management
| Step | Task | Check |
| --- | --- | --- |
| 0.38 ✅ | `GET/POST /api/admin/approved-emails` | Admin adds an email |
| 0.39 ✅ | `PATCH/DELETE` (role, daily limit, remove) | Removal sets `removedAt` |
| 0.40 ✅ | Removal deletes that user's sessions | Removed member's next request is 403 |
| 0.41 ✅ | Admin page UI (list, add, remove, role, limit) from Stitch Admin | Works end to end |

### 0I. Storage and shell
| Step | Task | Check |
| --- | --- | --- |
| 0.42 ✅ | Create Cloudflare R2 bucket + API token; set `R2_*` | Credentials created |
| 0.43 ✅ | R2 `StorageProvider` (put, signedGet, delete) | Verified on real R2 (`scripts/r2-smoke.ts`) |
| 0.44 ✅ | Storage key naming helper | Keys follow System-Design §7.6 |
| 0.45 ✅ | Home (dashboard) and empty Library UI from Stitch | Signed-in user sees empty Library |

**Phase 0 gate:** 0.38–0.41 and 0.45 done; approved email signs in by password and Google; unapproved refused everywhere; removed member blocked.

## Phase 1: Pipeline spike

| Step | Task | Check |
| --- | --- | --- |
| 1.1 ✅ | Hard-coded 3-scene props JSON (worked on `develop`, no separate branch) | `src/remotion/fixtures/spike-3-scenes.json` |
| 1.2 🟡 | Remotion Studio runs the composition locally | `npm run remotion:studio`; composition renders via CLI, Studio not opened yet |
| 1.3 ✅ | 3 templates (written fresh; prototype code is not on this machine) | `npm run remotion:render` gives a 16 s MP4 in about 32 s |
| 1.4 🟡 | Vercel project linked, Sandbox works on Hobby | Sandbox ran; Spend Management cap still to confirm |
| 1.5 ✅ | Render in Vercel Sandbox (script `spike:sandbox`; `Renderer` wrapper still to write) | MP4 produced; 20 s render, 77 s cold total |
| 1.6 ✅ | Upload MP4 from Sandbox to R2 | Signed link returns valid `video/mp4` |
| 1.7 🟡 | Inngest keys set | Dev UI check pending |
| 1.8 ⬜ | `renderVideo` as Inngest function: start detached, poll, upload, update Mongo | `generating` → `ready` unattended |
| 1.9 ⬜ | Forced-failure test | Retries then `failed` |
| 1.10 🟡 | ElevenLabs key + 2 voice ids set (comma-separated in `ELEVENLABS_VOICE_IDS`) | API call pending |
| 1.11 ⬜ | `VoiceProvider` ElevenLabs adapter + char→word grouping | Word times for one scene |
| 1.12 ⬜ | Cue-phrase sync (`sync/`) | Elements within 0.3 s of cue word |
| 1.13 ⬜ | Record credits used for a 60 s video | Number in results note |
| 1.14 👤 | Meta developer app (dev mode) + Business test Instagram account | Account added as tester |
| 1.15 ⬜ | Create container from signed R2 URL, publish | Reel visible |
| 1.16 ⬜ | Try Creator account | Result recorded |
| 1.17 ⬜ | Write spike results note | Decision: architecture stands or fallback |

## Phase 2: Storyboard AI and Review

| Step | Task | Check |
| --- | --- | --- |
| 2.1 ⬜ | Video/scene zod schemas finalised + `videos` repository (create, get, update with `version`) | Repo tests |
| 2.2 👤 | Gemini API key | Test call works |
| 2.3 ⬜ | `LlmProvider` Gemini adapter with schema-validated output | Returns typed object |
| 2.4 ⬜ | Idea-suggest prompt + `POST /api/ideas/suggest` | 6 ideas |
| 2.5 ⬜ | Angles prompt + `POST /api/ideas/angles` | 3 angles |
| 2.6 ⬜ | Storyboard prompt (templates, cues, length and scene limits) | Valid JSON on 10 topics |
| 2.7 ⬜ | Validator checks: cue appears in narration, order, limits; retry once | Bad output retried then clean failure |
| 2.8 ⬜ | Safety check for unsafe topics (`UNSAFE_TOPIC`) | Blocked topic rejected |
| 2.9 ⬜ | `POST /api/videos` (creates video, counts toward daily cap) | Storyboard saved, `storyboard_ready` |
| 2.10 ⬜ | Daily-cap guard (`usage/`) + `GET /api/me` videos left | Cap enforced |
| 2.11 ⬜ | `GET /api/videos/:id` with ownership check | Others' ids 404 |
| 2.12 ⬜ | `PATCH /api/videos/:id` with `version` conflict | Stale version 409 |
| 2.13 ⬜ | `PATCH /api/videos/:id/scenes/:sceneId` (edit, reorder, delete) | Length recomputed |
| 2.14 ⬜ | Regenerate one scene / whole storyboard | Works, no extra cap row |
| 2.15 ⬜ | Create Step 1 UI (topic, ideas, length, audience) | Creates a video |
| 2.16 ⬜ | Review Step 2 UI: scene cards | Shows scenes |
| 2.17 ⬜ | Scene editing + debounced autosave + Saved/Conflict state | Refresh keeps edits |
| 2.18 ⬜ | Voice, theme, music, captions settings (voice samples stubbed) | Saved on video |

## Phase 3: Template library and media

| Step | Task | Check |
| --- | --- | --- |
| 3.1 ⬜ | Theme system (colors, fonts) for videos | Two themes render |
| 3.2 ⬜ | Word-by-word captions component | Captions follow word times |
| 3.3 ⬜ | Template: title-hook | Renders from sample props |
| 3.4 ⬜ | Template: bullet-reveal | ✓ |
| 3.5 ⬜ | Template: step-flow | ✓ |
| 3.6 ⬜ | Template: definition-callout | ✓ |
| 3.7 ⬜ | Templates: stat, comparison | ✓ |
| 3.8 ⬜ | Templates: timeline, formula | ✓ |
| 3.9 ⬜ | Templates: diagram (flow, raindrop, orbit), recap | ✓ |
| 3.10 👤 | Pexels and Pixabay keys | Test search works |
| 3.11 ⬜ | `MediaProvider` adapters + licence record in `assets` | Portrait clip found |
| 3.12 ⬜ | Stock-clip template with 9:16 crop | Renders |
| 3.13 ⬜ | Music tracks in R2 + ducking under speech | Volume drops on words |
| 3.14 ⬜ | Voice list + cached 5 s samples (`/api/voices`) | Samples play |
| 3.15 ⬜ | Fix prototype problem: first element cue within first second | Empty-screen case gone |

## Phase 4: Render workflow and Library

| Step | Task | Check |
| --- | --- | --- |
| 4.1 ⬜ | `render_jobs` repository, one active job per video | Duplicate start refused |
| 4.2 ⬜ | `POST /api/videos/:id/render` with `Idempotency-Key` | Same key returns same job |
| 4.3 ⬜ | renderVideo step: voice per scene (hash skip) | Unchanged scenes reuse audio |
| 4.4 ⬜ | Step: sync and scene durations | Timings saved |
| 4.5 ⬜ | Step: fetch stock media to R2 | Files in R2 |
| 4.6 ⬜ | Step: build props, upload to R2 | Props JSON stored |
| 4.7 ⬜ | Step: Sandbox render + poll + upload MP4 | `outputKey` set |
| 4.8 ⬜ | Step: finish (thumbnail, status `ready`, usage log) | Video `ready` |
| 4.9 ⬜ | Failure path: mark `failed`, refund cap, notify | Forced failure refunds |
| 4.10 ⬜ | `GET /render/status` + `POST /render/cancel` | Progress and cancel work |
| 4.11 ⬜ | `GET /api/videos/:id/media` signed URLs | Player/download links |
| 4.12 ⬜ | Generate Step 3 UI: progress bar polling (3 s) | Matches Stitch |
| 4.13 ⬜ | Preview player + download | Plays MP4 |
| 4.14 ⬜ | Fix-a-scene flow | Only changed scene re-voiced |
| 4.15 ⬜ | `GET /api/library` with search/status filter | Cards listed |
| 4.16 ⬜ | Library UI + video detail | Matches Stitch |
| 4.17 ⬜ | Duplicate and soft delete | `deletedAt` set |

## Phase 5: Instagram

| Step | Task | Check |
| --- | --- | --- |
| 5.1 ⬜ | Token encryption helpers (`IG_TOKEN_KEY`) | Round trip test |
| 5.2 ⬜ | `GET /api/instagram/connect` (state) | Redirect to Meta |
| 5.3 ⬜ | `GET /api/instagram/callback` (verify state, exchange, store encrypted) | Connection saved |
| 5.4 ⬜ | Account eligibility check (`IG_NOT_ELIGIBLE`) | Personal account rejected |
| 5.5 ⬜ | `GET/DELETE /api/instagram/connection` | Token never returned; disconnect deletes it |
| 5.6 ⬜ | `SocialPublisher` implementation | Container/status/publish calls |
| 5.7 ⬜ | `POST /api/videos/:id/post` (now or scheduled) | Post row created |
| 5.8 ⬜ | `publishInstagram` workflow (sleep, container, poll, publish, permalink) | Post goes live |
| 5.9 ⬜ | Reschedule and cancel (`PATCH /api/posts/:id`) | Sleep restarts or ends |
| 5.10 ⬜ | Retry failed post | Returns to `publishing` |
| 5.11 ⬜ | `refreshInstagramTokens` daily job | Near-expiry token refreshed |
| 5.12 ⬜ | Post Step 4 UI (connect, caption, schedule) | Matches Stitch |
| 5.13 ⬜ | Settings page: connection status, disconnect, delete my data | Works |

## Phase 6: Hardening and team launch

| Step | Task | Check |
| --- | --- | --- |
| 6.1 ⬜ | Notifications API + bell UI | Unread count |
| 6.2 ⬜ | Usage log writes everywhere + monthly voice credit guard | Admin sees numbers |
| 6.3 ⬜ | Admin usage screen | Per-member per-day |
| 6.4 ⬜ | `cleanupDeletedVideos` job (7-day grace) | No orphan R2 files |
| 6.5 ⬜ | Plain-language error messages for every error code | Checklist reviewed |
| 6.6 ⬜ | Security pass (headers, CSRF origin check on all mutations, ownership tests) | Tests green |
| 6.7 ⬜ | Observability: structured logs, health route, Inngest alerts | Failures visible |
| 6.8 ⬜ | Mongo scheduled export | Backup file exists |
| 6.9 ⬜ | Mobile layout pass (Stitch mobile Home) | Usable at 390 px |
| 6.10 ⬜ | Deploy to Vercel production; set env vars; smoke test | `/api/health` ok |
| 6.11 ⬜ | Team test run with PRD checklist | Each member posts a video |
