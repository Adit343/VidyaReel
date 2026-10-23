# Vidyareel: Technical Design

Oct 17, 2026 · @adit

This is the proposed contract for Vidyareel V1: the data shapes, routes and events the build follows. Everything here is a design choice to confirm, not something already built.

## Storyboard JSON contract

The LLM returns one storyboard per video; the server validates it against a schema before saving, and rejects or retries on a mismatch. Scenes are embedded in the video document.

```json
{
  "title": "How photosynthesis works",
  "language": "en-IN",
  "scenes": [
    {
      "id": "s1",
      "template": "title-hook",
      "narration": "Plants make their own food using sunlight.",
      "elements": [
        { "id": "e1", "type": "headline", "text": "Plants make food", "cue": "make their own food" },
        { "id": "e2", "type": "stock-clip", "query": "green leaves sunlight", "cue": "sunlight" }
      ]
    }
  ]
}
```

- `template` is one of the Remotion templates: title-hook, bullet-reveal, step-flow, concept-diagram, comparison, definition-callout, stat, timeline, formula, stock-clip-overlay, recap.
- `cue` is a phrase copied from that scene's `narration`; sync fails the scene if the phrase is not found.
- After generation, the server adds `audio` (R2 key, duration), `words` (word and start/end times) and `startFrame` for each element. The LLM never writes these.
- Limits to enforce: 30 to 90 seconds total, at most 12 scenes, narration text only in the selected language.

## Video status

| Status | Meaning | Next |
| --- | --- | --- |
| `draft` | Idea saved, no storyboard yet | `planned` when the storyboard validates |
| `planned` | Storyboard ready for the member to review | `generating` on Generate |
| `generating` | `renderVideo` is running | `ready` or `failed` |
| `ready` | MP4 in R2, preview available | `scheduled` or `posted`; editing a scene returns to `generating` |
| `failed` | A step exhausted its retries; error stored | Member retries Generate |
| `deleted` | Soft-deleted, removed after the 7-day grace | R2 files and record removed |
| `scheduled` / `posted` | Publishing state, held on the `posts` record rather than the video | none |

## MongoDB collections

Auth collections (`users`, `sessions`, `password_resets`) are described in Database-Design 4.1; the collections below are the product's. Ids are ObjectIds, and every document has `createdAt` and `updatedAt`.

| Collection | Key fields | Indexes |
| --- | --- | --- |
| `approved_emails` | `email`, `role` (admin or member), `addedBy` | unique `email` |
| `videos` | `ownerId`, `topic`, `title`, `language`, `status`, `scenes[]` (storyboard plus audio, words, startFrame), `outputKey`, `durationSec`, `error`, `deletedAt` | `ownerId` + `createdAt`; `status`; `deletedAt` |
| `render_jobs` | `videoId`, `ownerId`, `inngestRunId`, `stage`, `attempt`, `startedAt`, `finishedAt`, `error`, `countedToCap` | `videoId`; `ownerId` + `startedAt` |
| `instagram_connections` | `ownerId`, `igUserId`, `username`, `accountType`, `encryptedToken`, `tokenExpiresAt`, `status` (active or needs-reconnect) | unique `ownerId`; `tokenExpiresAt` |
| `posts` | `videoId`, `ownerId`, `caption`, `mode` (now or scheduled), `scheduledFor`, `status`, `igContainerId`, `permalink`, `error` | `ownerId` + `scheduledFor`; `status` |
| `assets` | `videoId`, `kind` (audio, stock, output), `r2Key`, `source`, `credit`, `bytes` | `videoId` |
| `usage_log` | `ownerId`, `day` (YYYY-MM-DD), `videosStarted`, voiceCredits | unique `ownerId` + `day` |

- The daily cap reads `usage_log` and increments it atomically with `findOneAndUpdate` at Generate; a failed render decrements it, so failures are not charged.
- Scenes stay embedded because a video is always read and edited as one document; if a video reaches the 16 MB document limit, move scenes to their own collection.

## API routes

Every route except sign-in and the Inngest endpoint requires a session cookie and checks that the record belongs to the caller; admins pass the ownership check.

| Route | Purpose |
| --- | --- |
| `/api/auth/signup`, `login`, `logout`, `forgot-password`, `reset-password`, `google`, `google/callback` | Custom auth; signup and Google reject emails not in `approved_emails` |
| `POST /api/ideas` | Step 1: turn a rough topic into a few angle suggestions |
| `POST /api/videos` | Create a video from a chosen idea and generate the storyboard; returns the validated storyboard |
| `GET /api/videos`, `GET /api/videos/:id` | Library list and one video with scenes |
| `PATCH /api/videos/:id/scenes/:sceneId` | Edit narration or elements in Review; re-validates the scene |
| `POST /api/videos/:id/generate` | Step 3: check the daily cap, set `generating`, send `video/generate.requested` |
| `POST /api/videos/:id/scenes/:sceneId/regenerate` | Rerun one scene's voice and sync, then render |
| `GET /api/videos/:id/status` | Polled by the UI for stage and progress |
| `GET /api/videos/:id/preview-url` | Short-lived signed R2 link for the MP4 |
| `DELETE /api/videos/:id` | Soft delete; sends `video/deleted` to cancel any run |
| `GET /api/instagram/connect` | Create `state`, redirect to Meta's authorization screen |
| `GET /api/instagram/callback` | Check `state`, exchange the code, store the encrypted token |
| `DELETE /api/instagram/connection` | Disconnect and delete the stored token |
| `POST /api/posts` | Post now or schedule: `videoId`, `caption`, optional `scheduledFor` |
| `PATCH /api/posts/:id`, `DELETE /api/posts/:id` | Reschedule or cancel a scheduled post |
| `GET/POST/DELETE /api/admin/approved-emails` | Admin only: manage the allowlist |
| `GET /api/admin/usage` | Admin only: videos started per member per day |
| `/api/inngest` | Inngest handler; verified with the Inngest signing key |

Error responses use one shape, `{ error: { code, message } }`, with codes such as `not_approved`, `daily_cap_reached`, `invalid_storyboard`, `ig_not_connected` and `not_ready`, voice\_budget\_reached.

## Inngest events and functions

Routes send events and return at once; functions do the slow work. Event names and retry counts below are proposed starting values to tune in the spike.

| Event | Payload | Sent by |
| --- | --- | --- |
| `video/generate.requested` | `videoId`, `ownerId`, optional `sceneId` | Generate and regenerate routes |
| `video/deleted` | `videoId` | Delete route |
| `post/publish.requested` | `postId`, `ownerId`, `scheduledFor` | `POST /api/posts` |
| `post/cancelled` | `postId` | Cancel route; reschedule sends this, then a new publish request |

| Function | Settings | Step outline |
| --- | --- | --- |
| `renderVideo` | Trigger `video/generate.requested`; cancel on `video/deleted` with the same `videoId`; one run per video, concurrency 1 per member; 3 retries per step | `voice:<sceneId>` `per scene, audio and word times in one call` (skipped if saved), `sync`, `media`, `start-render` (detached), `poll-render` loop with `step.sleep`, `upload-r2`, `finish` (status `ready`, store `outputKey`) |
| `publishInstagram` | Trigger `post/publish.requested`; cancel on `post/cancelled` with the same `postId`; 3 retries per step | `sleep-until` `scheduledFor`, `create-container`, `poll-container` loop, `publish`, `save-permalink` |
| `refreshInstagramTokens` | Daily cron | `find-expiring`, then one `refresh:<connectionId>` step each |
| `cleanupDeletedVideos` | Daily cron | `find-expired` (deleted over 7 days ago), then `delete-r2` and `delete-records` |

- Each step returns small JSON only (ids, R2 keys, durations); audio, media and video go to R2, never through step state.
- On the final failed retry, `renderVideo` runs a failure handler: set `failed`, store the error, decrement the daily cap, notify the member.
- `start-render` stores the Sandbox id in `render_jobs`, so `poll-render` and a retry reuse the same render instead of starting a second one.

## Provider interfaces and Remotion templates

Each outside service sits behind a small interface so a free tier can be swapped without touching the workflows.

```ts
interface LlmProvider {
  planVideo(input: { topic: string; language: string }): Promise<Storyboard>;
  suggestIdeas(input: { seed: string }): Promise<string[]>;
}
interface VoiceProvider {
  // ElevenLabs /with-timestamps: audio plus character times, grouped into words
  synthesize(input: { text: string; voiceId: string }): Promise<{ audio: Buffer; words: Word[]; credits: number }>;
}
interface StockProvider {
  search(input: { query: string }): Promise<{ url: string; credit: string }[]>; // Pexels, Pixabay
}
type Word = { word: string; start: number; end: number }; // seconds
```

- `VoiceProvider` returns `words` `built from ElevenLabs character timestamps, plus the credits used, so there is no separate timing step`.
- `LlmProvider` output goes through the storyboard schema; on failure it retries once with the validation error in the prompt, then fails the request with `invalid_storyboard`.
- First implementations: Gemini for `LlmProvider`, ElevenLabs on the free plan with two chosen voice ids for `VoiceProvider`, Pexels then Pixabay for `StockProvider`.

### Template contract

Each template is a Remotion composition with the same props, so the render step treats all scenes alike.

```ts
type SceneProps = {
  durationInFrames: number;   // audio length + 0.3s, at 30 fps
  audioSrc: string;           // signed R2 URL
  elements: { id: string; type: string; text?: string; mediaSrc?: string; startFrame: number }[];
  captions: Word[];           // same clock as startFrame
};
```

- Output is 1080 by 1920, 30 fps, H.264 with AAC, which meets the Instagram Reel spec.
- A root composition chains the scenes in order with their durations; total length must stay under 90 seconds.

## Environment variables, errors and open questions

| Variable | Used for |
| --- | --- |
| `ADMIN_EMAIL` | First admin created on first sign-in |
| `APP_URL` | Base URL for cookies, Google redirect and reset links |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `RESEND_API_KEY`, `EMAIL_FROM` | Password-reset email |
| `MONGODB_URI` | Atlas connection |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | R2 uploads and signed links |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Sending events and verifying the handler |
| `GEMINI_API_KEY`, `ELEVENLABS_API_KEY, ELEVENLABS_VOICE_IDS, MONTHLY_VOICE_CREDITS`, `PEXELS_API_KEY`, `PIXABAY_API_KEY` | Script, voice (with word times) and stock providers; the monthly credit budget defaults to 10,000 |
| `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` | Instagram connect |
| `TOKEN_ENCRYPTION_KEY` | Encrypting Instagram tokens at rest |
| `DAILY_CAP_MEMBER`, `DAILY_CAP_ADMIN` | 5 and 20 by default |

**Error handling rules**

- Validation errors return 4xx with a code; provider and Sandbox errors are retried by Inngest and surface as `failed` only after the last retry.
- A stage that already saved its output is skipped on retry, so retries cost no extra quota.
- Every failure writes `error.stage` and `error.message` on the video or post so the UI can say what failed.

## Open questions, decided

These four were open; each now has a decision, based on the vendor docs I could open. The last column is what the spike still has to confirm.

| Question | Decision | What the docs say | Spike check |
| --- | --- | --- | --- |
| 1. Can the Sandbox upload to R2 directly? | Yes, by our own step: the Next.js step creates a presigned R2 upload URL, and the Sandbox uploads the MP4 to it after rendering. R2 keys never enter the Sandbox. If egress from the Sandbox is blocked, the step reads the file out of the Sandbox and uploads it itself. | [Remotion's renderMediaOnVercel](https://www.remotion.dev/docs/vercel/render-media-on-vercel) leaves the file inside the Sandbox (default `/tmp/video.mp4`) and only documents an upload to Vercel Blob. | Experiment 2: does the Sandbox reach R2, and how long does a 30 to 90 second MP4 take to upload? |
| 2. Which Inngest free-plan limits apply? | No design change. Keep one render per member at a time and poll about every 15 to 20 seconds. | [Inngest usage limits](https://www.inngest.com/docs/usage-limits/inngest.md) for the Free plan: 5 concurrent steps, 1,000 steps per function, 256 KiB per event, 50,000 executions a month, and sleeps up to 30 days. A run with five steps counts as six executions. | Experiment 3: count executions for one real render. My estimate is about 30 per video, so roughly 1,600 videos a month; this is my arithmetic, not a vendor figure. |
| 3. Which voice service, and where do word times come from? | ElevenLabs only, on the free plan, with two voices chosen by id; edge-tts and Groq are removed. Word times come from the same call's character timestamps, grouped into words, so no separate timing service is needed. A monthly voice-credit guard blocks Generate when credits run low. | The [timestamps endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps.md) returns `alignment` with characters and start and end times in seconds. The [pricing page](https://elevenlabs.io/pricing) lists 10k credits a month on Free and no commercial licence for it. Whether the free plan allows API use and which voices it can use is not stated there. | Experiment 4: with a free key and your two voice ids, confirm the API call works, the grouped word times sync, and see how many credits one 60 second video uses. |
| 4. Can Creator accounts publish? | Support Business and Creator accounts for Reels, with a clear error if a Creator publish fails. Stories are out of scope. | [Meta's content publishing page](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing) says only "professional accounts" and does not list Creator. A [secondary guide](https://www.getphyllo.com/post/instagram-api-guide) says all professional accounts can publish except Stories. | Experiment 5: publish once from a Creator account and record the result. |
