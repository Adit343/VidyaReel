# Vidyareel V1: API Design

*Owner: adit · Draft 2 (checked line by line against the System Design doc) · 21 Oct 2026 · Based on PRD draft 3, System Design (sections 5, 6, 8, 10.1) and the Database Design doc. The API is internal: Next.js route handlers on the Node.js runtime, called only by the Vidyareel web app. Part C is a UI-facing summary for building the screens with Stitch AI.*

## 0. Assumptions

1. **System Design section 11.4 decisions stand.** Whole-timeline re-render for scene fixes, polling every 3 seconds (no server-sent events), daily limit counted at creation and refunded on a failed render, time zone defaults to Asia/Kolkata, stock voices until the voice decision.
2. The API is JSON over HTTPS, same origin as the web app. No public API, no API keys, no CORS (the browser app is served from the same origin). Cookies carry the session.
3. The Stitch-built UI will call these endpoints directly with `fetch` (or a thin client). Request and response shapes below are the contract; the UI should not depend on anything not listed here.
4. Ids are 24-character hex strings. Times are ISO 8601 UTC strings (`2026-10-21T10:30:00.000Z`). Durations are in milliseconds (`...Ms`) or seconds (`...Sec`).
5. Response bodies are never wrapped in an envelope on success. Errors always use the error shape in 2.4.
6. Limits, error codes and message wording are defaults; any can change during build.
7. English only, so no `Accept-Language` handling. `language: "en"` is accepted and stored.

---

# Part A. Conventions

## 1. Authentication and authorization

| Rule | Detail |
| --- | --- |
| Mechanism | Session cookie (random token, hash stored in `sessions`) (`HttpOnly`, `Secure`, `SameSite=Lax`). The UI never handles tokens. |
| Guards | `requireUser()`: signed in **and** still on the approved list (re-checked on every request). `requireAdmin()`: `requireUser()` plus role `admin`. |
| Signed out | `401 UNAUTHENTICATED` |
| Removed or not approved | `403 NOT_APPROVED` and the session is ended |
| Not an admin | `403 FORBIDDEN` |
| Ownership | Ids in paths are loaded with the caller's `userId`. Someone else's video, post or connection returns `404 NOT_FOUND`, never 403. |
| Sign-up | Only approved emails. Anyone else gets `403 INVITE_ONLY` and no account is created (also when calling the auth routes directly, and for Google sign-in). |
| CSRF | `SameSite=Lax` cookie, plus all mutating routes require `Content-Type: application/json` and a same-origin `Origin` header check. The only GET with side effects is the Instagram callback, protected by the one-time `state`. |
| Inngest | `/api/inngest` accepts only requests signed with the Inngest signing key. |

## 2. Request and response conventions

### 2.1 Basics

- Base path: `/api`. No version prefix in V1 (internal; the UI ships with the server).
- Body validation with shared zod schemas. **Unknown fields are rejected** with `400 VALIDATION`.
- `PATCH` updates only the fields sent.
- Lists use `?limit=` (default 20, max 50) and `?cursor=` (opaque string from the last response's `nextCursor`).

### 2.2 Concurrency: `version`

Editable videos carry an integer `version`. Autosave `PATCH` calls include the last `version` they saw. On success the response contains the new `version`. On mismatch: `409 VERSION_CONFLICT` and the UI reloads the video (`GET /api/videos/:id`).

### 2.3 Idempotency

`POST /api/videos/:id/render` and `POST /api/videos/:id/post` accept an `Idempotency-Key` header (any string up to 80 characters, e.g. a UUID the UI makes when the button is pressed). A repeat with the same key and route within 24 hours returns the original response with `200` and header `Idempotent-Replay: true`. Without a key, the server still protects against double work (one active render per video, one live post per video).

### 2.4 Error shape

```json
{ "error": { "code": "DAILY_LIMIT", "message": "You've made 5 videos today. Your limit resets at midnight.", "details": { "limit": 5, "resetsAt": "2026-10-21T18:30:00.000Z" } } }
```

`message` is a plain sentence safe to show to the member. `details` is optional and machine-readable. The UI maps `code` to its own wording and button; fall back to `message`.

### 2.5 Status codes

| Code | Use |
| --- | --- |
| 200 | OK (also idempotent replay) |
| 201 | Created |
| 202 | Accepted, work started in the background (render, post) |
| 204 | Deleted, no body |
| 302 | Redirect (Instagram connect and callback only) |
| 400 | Validation error or bad input |
| 401 / 403 / 404 | Auth, permission, not found |
| 409 | Conflict (version, wrong state) |
| 422 | Input understood but rejected (unsafe topic, storyboard could not be generated) |
| 429 | Rate or daily limit |
| 502 / 503 | A provider (LLM, voice, Instagram, R2) is down; safe to retry |

### 2.6 Error codes

| Code | HTTP | Meaning and UI action |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | Go to sign-in |
| `INVITE_ONLY` | 403 | "This app is invite-only." No retry. |
| `NOT_APPROVED` | 403 | Account removed; show invite-only page |
| `FORBIDDEN` | 403 | Hide the admin page |
| `NOT_FOUND` | 404 | Video, post or connection not found |
| `VALIDATION` | 400 | `details.fields` lists problems per field |
| `UNSAFE_TOPIC` | 422 | Non-judgemental message; edit the topic |
| `DAILY_LIMIT` | 429 | Show limit and reset time (`details.resetsAt`) |
| `VOICE_CREDITS_LOW` | 429 | Monthly voice budget would be exceeded; contact admin |
| `RATE_LIMITED` | 429 | `Retry-After` header in seconds |
| `STORYBOARD_FAILED` | 422 | AI gave an unusable result twice; Try again |
| `NARRATION_TOO_LONG` | 409 | Soft warning in the PATCH response, not an error (see 6.4) |
| `VERSION_CONFLICT` | 409 | Reload the video |
| `VIDEO_LOCKED` | 409 | Storyboard is locked while rendering |
| `INVALID_STATE` | 409 | Action not allowed in this status (e.g. render before storyboard is ready) |
| `RENDER_FAILED` | (in status body) | Try again button |
| `VIDEO_NOT_POSTABLE` | 409 | Rendered file failed the Instagram checks (size, duration, format); offer re-render or download |
| `ALREADY_POSTED` | 409 | Video was already posted; resend with `confirmRepost: true` to override |
| `IG_NOT_CONNECTED` | 409 | Show Connect Instagram, or Download instead |
| `IG_NEEDS_RECONNECT` | 409 | Show Reconnect |
| `IG_NOT_ELIGIBLE` | 409 | Show switch-to-professional guide and Try again |
| `IG_REJECTED` | (in post body) | Instagram refused the video; plain reason and download option |
| `SCHEDULE_IN_PAST` | 400 | Offer Post now |
| `PROVIDER_UNAVAILABLE` | 503 | Try again shortly |
| `INTERNAL` | 500 | Generic apology and Try again |

## 3. Rate and daily limits

| Limit | Value | Where enforced | Error |
| --- | --- | --- | --- |
| Videos per day | 5 per member, 20 per admin (admin can change per member). Day = member's local day (`timeZone`, default Asia/Kolkata). Counted when `POST /api/videos` succeeds. Failed render refunds. Fix a scene, regenerate-all and storyboard edits do not count. | `POST /api/videos` | `429 DAILY_LIMIT` |
| Monthly voice credits | Budget from `ELEVENLABS_MONTHLY_CREDITS` (about 10,000 on the free plan), calendar month. Checked twice, as in System Design 3.2 and 7.2: at `POST /api/videos` using a length-based estimate (about 15 credits per second of target length, from prototype measurements), and again before a render starts using the real narration characters not already covered by cached audio. | `POST /api/videos`, `POST /api/videos/:id/render` | `429 VOICE_CREDITS_LOW` |
| Auth attempts | 10 per minute per IP (Mongo `rate_limits`, TTL) | `/api/auth/*` | `429 RATE_LIMITED` |
| LLM-backed calls (`ideas/*`, regenerate) | 20 per member per hour (addition to System Design; protects the Gemini free tier). The storyboard call itself retries once on a provider 429 (System Design 7.1). | service layer | `429 RATE_LIMITED` |
| Concurrent renders | 1 active per video; global concurrency 1 across the app (Sandbox cost). Others queue (`status: queued`). | Inngest | n/a |
| Posts | 1 live (scheduled or publishing) post per video; Instagram allows about 100 API posts/24 h per account | `POST /api/videos/:id/post` | `409 INVALID_STATE` |
| Idea text | 500 characters | validation | `400 VALIDATION` |
| Caption | 2,200 characters, up to 30 hashtags (Instagram limits) | validation | `400 VALIDATION` |

`GET /api/me` returns the counters so the UI can show "videos left today" and warn about voice credits.

## 4. Polling

Progress is polled, not pushed. The UI polls `GET /api/videos/:id/render/status` every 3 seconds while `status` is `queued` or `running` and stops on a terminal status. The Library and the notification badge may poll `GET /api/library` / `GET /api/notifications?unread=1` every 15 seconds while visible.

---

# Part B. Endpoints

Legend: **M** = signed-in approved member, **A** = admin.

## 5. Auth and profile

### 5.1 `/api/auth/*` (custom)

Implemented in `src/server/auth`. All are public except logout. Per-IP rate limits apply (10 attempts a minute, kept in `rate_limits`).

| Action | Route |
| --- | --- |
| Sign up (approved emails only) | `POST /api/auth/signup` `{ email, password, name }` → `201`, sets session cookie |
| Sign in | `POST /api/auth/login` `{ email, password }` → `200`, sets session cookie |
| Sign out | `POST /api/auth/logout` → `204`, deletes the session |
| Forgot password | `POST /api/auth/forgot-password` `{ email }` → always `200` |
| Reset password | `POST /api/auth/reset-password` `{ token, password }` → `200`; ends all sessions |
| Start Google sign-in | `GET /api/auth/google` → `302` to Google |
| Google callback | `GET /api/auth/google/callback?code&state` → `302` to `/` or `/sign-in?error=...` |
| Current user | `GET /api/me` (section 5.2) |

Errors: `403 INVITE_ONLY` (email not approved, for signup and Google), `401 INVALID_CREDENTIALS` (same message for unknown email and wrong password), `400 WEAK_PASSWORD` (minimum 10 characters), `409 EMAIL_EXISTS`, `400 INVALID_RESET_TOKEN` (expired, used or unknown).

### 5.2 `GET /api/me` (M)

Profile, role and counters. Drives the header and the Idea screen counter.

Response `200`:
```json
{
  "id": "6521...",
  "email": "teacher@example.com",
  "name": "Asha",
  "role": "member",
  "timeZone": "Asia/Kolkata",
  "daily": { "limit": 5, "used": 2, "left": 3, "resetsAt": "2026-10-21T18:30:00.000Z" },
  "voiceCredits": { "monthlyBudget": 10000, "used": 1840, "left": 8160 },
  "instagram": { "connected": true, "username": "asha.explains", "status": "connected" },
  "unreadNotifications": 1
}
```

### 5.3 `PATCH /api/me` (M)

Request: `{ "name"?: string, "timeZone"?: IANA string }` → `200` the same body as `GET /api/me`.

### 5.4 `DELETE /api/me` (M, P1)

Delete my data. Requires `{ "confirm": "DELETE" }`. Soft-deletes videos (7-day grace), deletes the Instagram token, ends sessions → `202`.

## 6. Ideas and videos

### 6.1 `POST /api/ideas/suggest` (M)

Six topic ideas. Not counted toward the daily cap.

Request: `{ "subject"?: string (max 100) }`  
Response `200`: `{ "ideas": [ { "topic": "Why is the sky blue?", "hint": "Light scattering" } ] }` (6 items)  
Errors: `UNSAFE_TOPIC`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`.

### 6.2 `POST /api/ideas/angles` (M)

Three angles and a suggested hook (optional step).

Request: `{ "topic": string (1..500) }`  
Response `200`: `{ "angles": [ { "id": "everyday", "label": "Everyday example", "hook": "Ever wondered why..." } ] }` (3 items)

### 6.3 `POST /api/videos` (M)

Create a video from the idea and generate the storyboard in one call. **Counts toward the daily cap.** Budget: under 30 seconds (the handler sets `maxDuration` accordingly).

Request:
```json
{
  "topic": "How does a rainbow form?",
  "lengthSec": 60,
  "audience": "school",
  "angle": "everyday",
  "language": "en"
}
```
Only `topic` is required. Defaults: `lengthSec 60`, `audience "general"`, `language "en"`.

Response `201`: the full video object (6.4).  
Order of checks (System Design 3.2): daily cap and monthly voice credits, then the safety check, then the video is created as `draft`, then the storyboard is generated and validated (up to 2 retries with the error text, one corrective length retry). The AI-written Instagram caption and hashtags are produced in the same call and prefill `caption` and `hashtags`.

Errors: `DAILY_LIMIT` (429), `VOICE_CREDITS_LOW` (429), `UNSAFE_TOPIC` (422), `STORYBOARD_FAILED` (422, the daily count is refunded and `details.videoId` is the draft; the UI offers Try again via `POST /api/videos/:id/regenerate`), `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`.

### 6.4 The Video object

Returned by `GET /api/videos/:id`, `POST /api/videos`, `PATCH` calls.

```json
{
  "id": "6522...",
  "version": 4,
  "title": "How a rainbow forms",
  "topic": "How does a rainbow form?",
  "lengthSec": 60,
  "language": "en",
  "audience": "school",
  "status": "storyboard_ready",
  "failureReason": null,
  "voiceId": "alice",
  "speed": "normal",
  "theme": "ocean",
  "accent": "#38bdf8",
  "musicId": "soft-1",
  "captionsOn": true,
  "caption": "Ever wondered why...",
  "hashtags": ["#science", "#explained"],
  "estimatedSec": 58,
  "actualSec": null,
  "warnings": [],
  "scenes": [
    {
      "id": "sc_a1b2c3d4",
      "order": 0,
      "template": "title-hook",
      "diagram": null,
      "title": "Rainbows",
      "narration": "Ever wondered how a rainbow forms?",
      "onScreenText": ["How does a rainbow form?"],
      "needsCheck": false,
      "elements": [ { "id": "el_1", "type": "title", "text": "Rainbows", "cue": "rainbow forms" } ],
      "durationMs": null,
      "hasAudio": false
    }
  ],
  "currentJob": null,
  "media": null,
  "createdAt": "2026-10-21T10:30:00.000Z",
  "updatedAt": "2026-10-21T10:30:20.000Z"
}
```

Notes: word timings, R2 keys and sync warnings are **not** sent to the browser. `warnings` contains plain strings such as `"Narration is 14% longer than 60 seconds"` (the soft `NARRATION_TOO_LONG`). `output` is `null` until a render finishes, then `{ "sizeBytes", "durationSec", "postable": true }` from the upload-step check (System Design 8.3); posting is enabled only when `postable` is true. `media` is `null` until a render finishes, then `{ "videoUrl", "thumbUrl", "expiresAt" }` (signed URLs, valid 1 hour; refresh with `GET /api/videos/:id/media`). `currentJob` is the latest render job summary (6.9) while one exists.

### 6.5 `GET /api/videos/:id` (M)

Returns the Video object. `404` if not the caller's.

### 6.6 `PATCH /api/videos/:id` (M)

Update settings, caption and title. Debounced autosave from the UI (about 800 ms).

Request (all optional except `version`):
```json
{ "version": 4, "title": "...", "voiceId": "alice", "speed": "fast", "theme": "forest",
  "musicId": null, "captionsOn": true, "caption": "...", "hashtags": ["#science"] }
```
Response `200`: Video object (new `version`). Errors: `VERSION_CONFLICT`, `VIDEO_LOCKED` (for voice, speed, theme, music, captions while rendering), `VALIDATION`.

Changing `voiceId` or `speed` changes every scene's `audio.hash`, so the next render regenerates all voice (the UI should show a hint: "Changing the voice will regenerate audio"). Changing `theme` or `musicId` does not need new audio.

### 6.7 `PATCH /api/videos/:id/scenes/:sceneId` (M)

Edit one scene.

Request:
```json
{ "version": 4, "narration"?: "...", "onScreenText"?: ["..."], "title"?: "...", "moveTo"?: 2 }
```
`moveTo` is the new 0-based position (reorder). Narration edits recompute `estimatedSec`, flag changed audio as stale, and may add a warning to `warnings` (more than 10% over `lengthSec`); this is a warning, not an error. Response `200`: Video object.

### 6.8 `DELETE /api/videos/:id/scenes/:sceneId` (M)

Body: `{ "version": 4 }` (sent as a query string `?version=4` for clients that do not send DELETE bodies). Removes a scene and renumbers. Cannot delete the last scene (`VALIDATION`). Response `200`: Video object.

### 6.9 `POST /api/videos/:id/scenes/:sceneId/regenerate` (M)

Regenerates one scene with the LLM, keeping its position. Request: `{ "version": 4, "instruction"?: "make it simpler" }`. Response `200`: Video object. Does not count toward the daily cap. LLM rate limit applies.

### 6.10 `POST /api/videos/:id/regenerate` (M)

Regenerate the whole storyboard for the same inputs. Request `{ "version": 4 }`. Response `200`: Video object with new scenes. Does not add a second `video_created` row. LLM rate limit applies.

### 6.11 `POST /api/videos/:id/duplicate` (M)

Creates a new video with the same topic and settings and generates a fresh storyboard. **Counts toward the daily cap** (it makes a new video). Response `201`: Video object.

### 6.12 `DELETE /api/videos/:id` (M)

Soft delete (7-day grace, then files removed). Cancels any scheduled post for it. Response `204`.

## 7. Voices and music

### 7.1 `GET /api/voices` (M)

```json
{ "voices": [ { "id": "alice", "name": "Alice", "gender": "female", "accent": "neutral", "sampleUrl": "https://...signed..." } ],
  "speeds": ["slow", "normal", "fast"] }
```
In V1 only stock voices are listed (see decision 4 in System Design 11.4). Indian-accent voices appear when the voice decision is made. Sample URLs are 5 second mp3s in R2, signed for 1 hour. `GET /api/voices/:id/sample` returns a `302` to a fresh signed URL (for a plain `<audio src>`).

### 7.2 `GET /api/music` (M)

```json
{ "tracks": [ { "id": "soft-1", "name": "Soft morning", "previewUrl": "https://...signed..." } ] }
```

### 7.3 `GET /api/themes` (M, optional)

Static list for the picker: `{ "themes": [ { "id": "ocean", "name": "Ocean", "accent": "#38bdf8", "bg": ["#0f172a", "#1e3a8a"] } ] }`. May be bundled in the UI instead.

## 8. Render and preview

### 8.1 `POST /api/videos/:id/render` (M)

Locks the storyboard and starts the `renderVideo` workflow. Accepts `Idempotency-Key`.

Request: `{ "version": 4, "sceneIds"?: ["sc_a1b2c3d4"] }`. `sceneIds` = "fix a scene": voice is regenerated only for those whose narration or voice settings changed, but the whole timeline is re-rendered (decision 1 in System Design 11.4). Fix a scene is not counted toward the daily cap.

Response `202`:
```json
{ "job": { "id": "6523...", "status": "queued", "stage": "voice", "progress": 0, "kind": "full" } }
```
If a job is already active for this video the existing job is returned with `200`.  
Errors: `INVALID_STATE` (no storyboard yet, or the video was deleted), `VOICE_CREDITS_LOW`, `VERSION_CONFLICT`, `VALIDATION`.

### 8.2 `GET /api/videos/:id/render/status` (M)

Polled. Response `200`:
```json
{
  "videoStatus": "rendering",
  "job": {
    "id": "6523...",
    "status": "running",
    "stage": "render",
    "stageLabel": "Rendering video",
    "progress": 62,
    "etaSec": 70,
    "kind": "full",
    "error": null,
    "startedAt": "2026-10-21T10:31:00.000Z"
  },
  "media": null
}
```
`stageLabel` is one of "Writing voice", "Building scenes", "Rendering video", "Finishing". When `job.status = succeeded`, `media` has the signed `videoUrl` and `thumbUrl`. When `failed`: `job.error = { "code": "RENDER_FAILED", "message": "We couldn't finish the video. Please try again." }`. When there has never been a job: `job` is `null`.

### 8.3 `POST /api/videos/:id/render/cancel` (M)

Cancels a queued or running job (sends `video/render.cancel`). Response `200`: status body as in 8.2 with `job.status = cancelled`; the daily count is refunded and the storyboard is unlocked (`status` returns to `storyboard_ready`). `INVALID_STATE` if no active job.

### 8.4 Try again after a failure

There is no separate retry endpoint (System Design has none). "Try again" calls `POST /api/videos/:id/render` again; it is accepted when the video `status` is `failed` or `storyboard_ready`, creates a new job with `attempt + 1`, and does not count toward the daily cap again (the failed attempt was refunded).

### 8.5 `GET /api/videos/:id/media` (M)

```json
{ "videoUrl": "https://...", "thumbUrl": "https://...", "downloadUrl": "https://...?response-content-disposition=attachment", "expiresAt": "2026-10-21T11:35:00.000Z" }
```
Signed R2 URLs, valid 1 hour. `404` / `INVALID_STATE` if no render has succeeded. `downloadUrl` serves the MP4 as a download (R6). The captions file `.srt` (P1) is `GET /api/videos/:id/captions.srt`.

## 9. Library

### 9.1 `GET /api/library` (M)

Query: `?q=` (search title), `?status=` (one of `draft, storyboard_ready, rendering, ready, scheduled, posted, failed`; comma-separated allowed), `?limit=`, `?cursor=`. Excludes soft-deleted videos. Sorted newest first.

Response `200`:
```json
{
  "items": [
    {
      "id": "6522...", "title": "How a rainbow forms", "status": "scheduled",
      "lengthSec": 58, "language": "en", "thumbUrl": "https://...signed...",
      "createdAt": "2026-10-21T10:30:00.000Z",
      "resumeStep": "post",
      "post": { "id": "6524...", "status": "scheduled", "scheduledAt": "2026-10-22T09:00:00.000Z", "permalink": null }
    }
  ],
  "nextCursor": null
}
```
`resumeStep` is one of `idea`, `review`, `generate`, `post`, and tells the UI which screen to open (L3): `draft`/`storyboard_ready` → `review`; `rendering`/`failed` → `generate`; `ready`/`scheduled`/`posted` → `post`.

## 10. Instagram connection

### 10.1 `GET /api/instagram/connect` (M)

Starts steps 1 and 2 of the connect flow. Query: `?returnTo=/videos/6522.../post` (relative path only). Creates a one-time `state` (10 minutes), then responds `302` to Meta's authorization URL. The UI navigates the browser here (a normal link, not `fetch`).

### 10.2 `GET /api/instagram/callback` (M)

Steps 3 and 4. Meta redirects the browser here with `code` and `state` (or `error`). The server:

1. checks the signed-in user and the one-time `state` (deleted after use),
2. exchanges the code for a long-lived token on the server,
3. checks the account is an eligible professional account,
4. encrypts and saves the token, and creates/updates the connection,
5. redirects (`302`) to `returnTo` with a query flag.

Redirect targets (the UI reads these query params and shows the matching message):

| Outcome | Redirect |
| --- | --- |
| Success | `returnTo?ig=connected` (also clears `paused` on the member's scheduled posts and resumes them) |
| Member cancelled on Meta | `returnTo?ig=cancelled` (nothing saved; "You cancelled. No changes made.") |
| Not an eligible account | `returnTo?ig=not_eligible` (show the switch-to-professional guide and Try again) |
| Bad or expired state | `returnTo?ig=error` |

The token is never in a URL and never returned to the browser.

### 10.3 `GET /api/instagram/connection` (M)

```json
{ "connected": true, "connection": {
    "username": "asha.explains", "accountType": "BUSINESS",
    "profilePictureUrl": "https://...", "status": "connected",
    "connectedAt": "2026-10-20T08:00:00.000Z", "tokenExpiresAt": "2026-12-19T08:00:00.000Z" } }
```
When not connected: `{ "connected": false, "connection": null }`. `status` is `connected` or `needs_reconnect`.

### 10.4 `DELETE /api/instagram/connection` (M)

Disconnect: deletes the connection document and token. Scheduled posts for this connection cannot run without a token, so they are cancelled (addition to System Design); the response says how many: `200 { "cancelledPosts": 1 }`. The UI should confirm before calling it.

## 11. Posting

### 11.1 `POST /api/videos/:id/post` (M)

Post now or schedule. Accepts `Idempotency-Key`.

Request:
```json
{ "caption": "Ever wondered...\n#science #explained", "scheduledAt": "2026-10-22T09:00:00.000Z", "confirmRepost": false }
```
Omit `scheduledAt` to post now. `scheduledAt` must be in the future (`SCHEDULE_IN_PAST`).

Response `202`: `{ "post": { "id": "6524...", "status": "scheduled", "scheduledAt": "...", "mode": "scheduled" } }`  
Errors: `VIDEO_NOT_POSTABLE`, `IG_NOT_CONNECTED`, `IG_NEEDS_RECONNECT`, `ALREADY_POSTED` (resend with `confirmRepost: true`), `INVALID_STATE` (video not `ready`, or a live post already exists), `SCHEDULE_IN_PAST`, `VALIDATION` (caption too long).

### 11.2 `GET /api/posts/:id` (M)

Poll for post state.
```json
{ "id": "6524...", "videoId": "6522...", "status": "posted", "mode": "now", "scheduledAt": null,
  "permalink": "https://www.instagram.com/reel/...", "error": null, "lateByMs": null, "retryCount": 0 }
```
When `failed`: `error = { "code": "IG_REJECTED" | "IG_NEEDS_RECONNECT" | "PROVIDER_UNAVAILABLE", "message": "..." }` and the UI shows Retry or Reconnect accordingly. Statuses: `scheduled`, `publishing`, `posted`, `failed`, `cancelled`. `paused: true` appears on a `scheduled` post while the connection is `needs_reconnect` (System Design 8.2); the UI shows "Paused: reconnect Instagram" with a Reconnect button.

### 11.3 `PATCH /api/posts/:id` (M)

Reschedule or cancel a **scheduled** post (Q7).  
Request: `{ "scheduledAt": "..." }` or `{ "cancel": true }`. Response `200`: post object. `INVALID_STATE` once the post is `publishing` or later.

### 11.4 `POST /api/posts/:id/retry` (M)

Retry a failed post. Response `202`: post object (status `publishing`).

## 12. Notifications

### 12.1 `GET /api/notifications` (M)

Query: `?unread=1`, `?limit=`. Response `200`:
```json
{ "items": [ { "id": "6525...", "kind": "render_ready", "refId": "6522...", "message": "Your video 'How a rainbow forms' is ready.", "read": false, "createdAt": "..." } ],
  "unreadCount": 1 }
```
Kinds: `render_ready`, `render_failed`, `post_posted`, `post_failed`, `ig_needs_reconnect`. `refId` is the video id (or connection for `ig_needs_reconnect`); the UI links to the matching screen.

### 12.2 `POST /api/notifications/:id/read` (M) and `POST /api/notifications/read-all` (M)

Response `204`.

## 13. Admin

All require `A`.

### 13.1 `GET /api/admin/approved-emails`

`200 { "items": [ { "id", "email", "role", "dailyLimit", "addedAt", "hasAccount": true, "lastSignInAt": "..." } ] }`

### 13.2 `POST /api/admin/approved-emails`

Request `{ "email": string, "role"?: "member" | "admin", "dailyLimit"?: int (1..100) }` → `201` the item. Defaults: `member`, 5 (20 for admin). Duplicate email → `409 INVALID_STATE`.

### 13.3 `PATCH /api/admin/approved-emails/:id`

Request `{ "role"?, "dailyLimit"? }` → `200`. An admin cannot demote or remove themselves, and the env-var admin cannot be removed.

### 13.4 `DELETE /api/admin/approved-emails/:id`

Query `?deleteData=1` optionally also deletes the member's data. Blocks new sign-ins at once and ends sessions. → `204`.

### 13.5 `GET /api/admin/usage`

Query `?from=2026-10-01&to=2026-10-21`.
```json
{
  "perMemberPerDay": [ { "userId": "...", "email": "...", "date": "2026-10-21", "videos": 2, "limit": 5 } ],
  "voiceCredits": { "monthlyBudget": 10000, "usedThisMonth": 1840 },
  "llmCalls": 63,
  "renderSeconds": 910
}
```
No money amounts.

## 14. System endpoints

| Route | Purpose |
| --- | --- |
| `ALL /api/inngest` | Inngest function endpoint (signed) |
| `GET /api/health` | Public. `{ "ok": true, "version": "<build>" }`; checks MongoDB connectivity (System Design 10.5). No secrets. |
| `GET /privacy` | Page, not API: short privacy policy URL for the Meta app |

## 15. Events (internal, Inngest)

The UI never calls these. Listed here so the API and workflow docs stay linked.

| Event | Sent by | Data |
| --- | --- | --- |
| `video/render.requested` | `POST /render` | `{ videoId, jobId, userId, sceneIds? }` |
| `video/render.cancel` | `POST /render/cancel` | `{ videoId }` |
| `post/requested` | `POST /post`, `/retry`, `PATCH /posts/:id` (reschedule), reconnect (resumes paused posts) | `{ postId, userId, rev }`; a newer `rev` retires any older run of the same post (built this way instead of cancelling with `post/updated`) |
| `post/cancel` | `PATCH /posts/:id`, `DELETE /instagram/connection`, `DELETE /videos/:id` | `{ postId }` |
| Cron | Inngest | `refreshInstagramTokens`, `cleanupDeletedVideos` (daily) |

---

# Part C. UI-facing summary (for Stitch AI)

Design rules from the PRD: one main action per screen, large buttons, minimal text, works at phone width, progress bar for the four steps, auto-save on every step, captions on by default. Everything below is the whole API surface the UI needs.

## 16. Screens and the endpoints each needs

| # | Screen | Route | Endpoints | Main button and states |
| --- | --- | --- | --- | --- |
| 1 | **Sign-in** | `/sign-in` | `POST /api/auth/login`, `GET /api/auth/google`, `GET /api/me` | **Sign in** and **Continue with Google**. Links to Sign-up and Forgot password. Error `INVITE_ONLY`: "This app is invite-only." Wrong password inline. |
| 1a | **Sign-up** | `/sign-up` | `POST /api/auth/signup`, `GET /api/auth/google` | **Create account** and **Continue with Google**. Error `INVITE_ONLY`, `EMAIL_EXISTS`, `WEAK_PASSWORD`. |
| 1b | **Forgot password** | `/forgot-password` | `POST /api/auth/forgot-password` | **Send reset link**; always shows "If that email is approved, a link is on its way." |
| 1c | **Reset password** | `/reset-password?token=` | `POST /api/auth/reset-password` | **Set new password**; `INVALID_RESET_TOKEN` offers a new link. |
| 2 | **Dashboard home** | `/` | `GET /api/me`, `GET /api/library?limit=6`, `GET /api/notifications?unread=1` | Large **Create video** button (disabled with reset time if `daily.left = 0`). Library grid below; bell with unread count. |
| 3 | **Step 1: Idea** | `/create` | `GET /api/me` (videos left), `POST /api/ideas/suggest`, `POST /api/ideas/angles`, `POST /api/videos` | **Create script and storyboard** (loading state up to 30 s). Topic box (500), 6 idea chips, optional angles, length 30/60/90, audience. Errors: `UNSAFE_TOPIC`, `DAILY_LIMIT`, `STORYBOARD_FAILED`. |
| 4 | **Step 2: Review** | `/videos/[id]/review` | `GET /api/videos/:id`, `PATCH /api/videos/:id` (autosave), `PATCH` / `DELETE /api/videos/:id/scenes/:sceneId`, `POST .../scenes/:sceneId/regenerate`, `POST /api/videos/:id/regenerate`, `GET /api/voices`, `GET /api/music`, `POST /api/videos/:id/render` | **Looks good, generate video**. Scene cards (preview, narration, duration, menu: edit / regenerate / delete / move). Voice picker with 5 s samples, speed, theme, music, captions toggle. Live estimated length and warning banner. "Check this" markers. Saved / Conflict indicator. |
| 5 | **Step 3: Generate** | `/videos/[id]/generate` | `GET /api/videos/:id/render/status` (every 3 s), `POST .../render/cancel`, `POST /api/videos/:id/render` (Try again), `GET /api/videos/:id/media`, `POST /api/videos/:id/render` with `sceneIds` (fix a scene) | **Continue to post** (after ready). Progress bar with stage labels and ETA, **Cancel**, **Try again** on failure, video player (play, pause, seek), **Download MP4**, **Fix a scene** (pick scene, edit text, re-render). The user can leave; status shows in Library. |
| 6 | **Step 4: Post** | `/videos/[id]/post` | `GET /api/instagram/connection`, `GET /api/instagram/connect` (link), `GET /api/videos/:id`, `PATCH /api/videos/:id` (caption), `POST /api/videos/:id/post`, `GET /api/posts/:id`, `PATCH /api/posts/:id`, `POST /api/posts/:id/retry`, `GET /api/videos/:id/media` | **Post now** / **Schedule**. Not connected: **Connect Instagram** card (4 steps). Connected: "Posting to @username" + avatar + Change account. Caption editor with hashtags and character count, date/time picker (member's time zone). Post states: scheduled, publishing, posted (link), failed (reason, Retry / Reconnect). Warn on `ALREADY_POSTED`. **Download instead** always available. |
| 7 | **Library and video detail** | `/library` | `GET /api/library?q=&status=&cursor=`, `POST /api/videos/:id/duplicate`, `DELETE /api/videos/:id`, `GET /api/videos/:id/media` | Cards (thumbnail, title, length, language, date, status badge). Search and status filter. Open card → `resumeStep` screen. Menu: Duplicate, Delete, Download. |
| 8 | **Settings** | `/settings` | `GET /api/me`, `PATCH /api/me`, `GET /api/instagram/connection`, `GET /api/instagram/connect`, `DELETE /api/instagram/connection` | Instagram card: avatar, @username, account type, connected date, status (Connected / Needs reconnect), **Reconnect**, **Disconnect**. Name and time zone. (P1: Delete my data.) |
| 9 | **Admin** (admins only) | `/admin` | `GET/POST/PATCH/DELETE /api/admin/approved-emails`, `GET /api/admin/usage` | **Add member** (email, role, daily limit). Table of approved emails with role and limit editing, remove. Usage table: videos per member per day, voice credits used this month. |
| 10 | **Shared** | all signed-in pages | `GET /api/me`, `GET /api/notifications`, `POST /api/notifications/:id/read` | Header with logo, notification bell, user menu (Settings, Admin if admin, Sign out). Four-step progress bar on steps 3 to 6. |

## 17. Status badge values (for the Library and cards)

| `status` | Label | Suggested colour role |
| --- | --- | --- |
| `draft` | Draft | neutral |
| `storyboard_ready` | Storyboard ready | info |
| `rendering` | Rendering | in progress |
| `ready` | Ready | success |
| `scheduled` | Scheduled | info |
| `posted` | Posted | success |
| `failed` | Failed | danger |

Render stage labels: `voice` = "Writing voice", `sync`/`media`/`props` = "Building scenes", `render` = "Rendering video", `upload`/`finalise` = "Finishing".

## 18. Notes for the Stitch prompts

1. Give Stitch the screen table above, one screen per prompt, plus the **video object** (6.4) and the **status badge** table as sample data. Ask for mobile-first (phone width), large primary button, and empty/loading/error states for each screen.
2. States to request for every screen: loading, empty, error (with the mapped sentence and action), and, for screens 4 to 6, the "saving / saved / conflict" indicator.
3. Keep Stitch output free of its own mock data fetches; wire to the endpoints above after export. All requests are same-origin `fetch` with `credentials: "include"`; errors follow section 2.4, so one shared `apiFetch` helper that throws `{ code, message, details }` is enough.
4. The API does not depend on any UI library; the web app is Next.js, so exported components should be dropped in as React components.

## 19. Decisions on the earlier open items

| Open item | Decision |
| --- | --- |
| Reset email delivery | Resend free tier via `EmailProvider`; confirm sender domain or use Resend's test sender in development. |
| 429 tuning on Gemini | Defaults as in section 3. `Retry-After` is always sent; tune after real use. |
| Meta scopes, endpoints, Creator accounts | These sit behind `SocialPublisher` and do not change the API shape. Default: only `BUSINESS` accounts count as eligible (`IG_ALLOWED_ACCOUNT_TYPES`, add `CREATOR` after a Phase 0 test). Anything Meta rejects at connect time maps to `?ig=not_eligible`. |
| Voice decision | Only the content of `GET /api/voices` changes (probed, usable voices). Nothing in the API depends on stock vs Indian-accent. |
| In-browser scene preview | Optional in System Design 10.1. **Not in V1**; if added, it needs a new `GET /api/videos/:id/preview-props`. |

## 20. Differences from the System Design doc

Everything not listed follows System Design section 5 (endpoints, auth, ownership, errors, idempotency, polling, quota guards).

| Item | System Design | This doc | Why |
| --- | --- | --- | --- |
| Scene delete | `PATCH .../scenes/:sceneId` covers edit, reorder and delete | Edit and reorder use `PATCH`; delete is `DELETE .../scenes/:sceneId` | Clearer for the UI; same behaviour |
| Render retry | no endpoint | none; `POST /render` is reused (8.4) | Keeps the SD surface |
| Post-by-id and Instagram | `PATCH /api/posts/:id`, `POST .../retry` | adds `GET /api/posts/:id` for polling | The UI needs post state |
| Notifications | read one | adds `POST /api/notifications/read-all` | Bell menu |
| `GET /api/themes`, `GET /api/music` | not listed | added (themes optional) | Pickers on Review |
| `DELETE /api/me` | not listed | added, P1 | PRD A8 |
| `PATCH /api/me`, time zone | "stored per member" | `PATCH /api/me` sets it | Needs a way to set it |
| Duplicate | starts a new video | counts toward the daily cap | It creates a video |
| Disconnect | deletes token | also cancels that connection's scheduled posts | Cannot publish without a token |
| LLM rate limit | not specified | 20 per member per hour | Protects Gemini free tier |
| `GET /api/health` | build version | same | n/a |

## Phase 2 as built (2026-10-25)

Where the built endpoints differ from the sections above:

- **Added `POST /api/videos/:id/scenes`** (`{ version, afterSceneId? }`, `201`, Video object): adds a blank scene for the "+ Add new scene beat" and "+ Blank scene" buttons in the Stitch Review screen.
- `POST /api/videos` takes `angle` as `everyday | step | mistake`, `audience` as free text up to 40 characters (the Stitch values `Class 5`, `Class 7`, `Class 9`, `General`), `voiceId` (one of `src/config/voices.ts`) and defaults `language` to `en`.
- The storyboard is checked once more on its own: at most one retry (two model calls) with the problems listed. Cues that are headings instead of spoken words are repaired and elements are put in spoken order before the check. Narration under 60% or over 125% of the target length is rejected; 10% to 25% over only adds the soft `warnings` line.
- `STORYBOARD_FAILED` and `PROVIDER_UNAVAILABLE` carry `details: { videoId, version }`. A brand new draft is marked `failed` (so the quota rule refunds it); regenerating a failed video checks the cap again. A video that already has a storyboard keeps it when a regenerate fails.
- `speed` is a number from 0.8 to 1.2 (the Review slider uses 0.9 to 1.1); `theme` is `forest | saffron | sage`; Stitch has no `sunrise/ocean/slate` themes.
- `onScreenText` edits replace the element texts in order; `checkNote` (why a scene is marked "Check this") is stored on the scene and returned.
- `POST .../scenes/:sceneId/regenerate` stops without saving if the browser disconnected (the Review "Cancel" button).
- Not built yet: `VOICE_CREDITS_LOW` (step 6.2), `GET /api/voices` and `GET /api/music` (Phase 3), `POST /api/videos/:id/duplicate` (Phase 4). `GET /api/me` now reports the real videos used.
