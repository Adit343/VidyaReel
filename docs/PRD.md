# V1 PRD: Vidyareel (internal build)

*Owner: adit · Draft 3 · 18 Oct 2026 · Status: for review. Changes from draft 2: findings from the working local prototype (section 16): ElevenLabs free plan cannot use library voices through the API, animated diagram templates are built, Gemini storyboard writer works, and sync is proven. Earlier changes (draft 2): invite-only access with Better Auth, MongoDB Atlas, Inngest, Remotion on Vercel Sandbox, four-step Instagram connect, no billing.*

## 1. Summary

A web app where an approved team member types a topic and, in four simple steps, gets a voiced, animated 30 to 90 second vertical explainer video and posts it to a connected Instagram account. The animations are timed to the voiceover so each visual appears on the word being spoken.

**One-line pitch:** from idea to a posted Instagram explainer in four clicks.

**Why this exists:** existing tools are either avatar-heavy, template-heavy, or editors that need skill. Educators want to explain a concept clearly and post it regularly, without learning video editing.

**Project context:** adit is building this solo as a passion project for **internal testing only**. There are no customers, no billing, no pricing and no public sign-up. Only approved team members can use it. Tools are chosen to stay on free or low-cost tiers.

## 2. Goals and non-goals

### Goals (V1)

1. An approved team member can go from sign-in to a finished video in under 10 minutes of their own time.
2. The whole flow is 4 steps with one primary button per step.
3. Motion graphics stay in sync with the voiceover (section 7).
4. English voiceovers with Indian-accent voices.
5. Connect an Instagram professional account in a simple four-step flow, then post or schedule.
6. Only approved team members can sign in.
7. Stay on free or low-cost tiers, and protect free API quotas with a simple daily video limit.

### Non-goals (V1)

- Billing, plans, credits, free trial, watermarks, pricing page, payment providers
- Public sign-up, marketing site, onboarding for outside customers
- Timeline or manual video editor
- AI avatars, voice cloning, fully AI-generated video clips
- Platforms other than Instagram
- Teams, workspaces or roles beyond admin and member
- Videos longer than 90 seconds
- Native mobile app (the web app should still work on a phone browser)
- Meta app review and public launch (internal testers use Meta's development mode)

## 3. Target users

**V1 users:** adit and the team members adit approves. They use the product the way its intended audience would, so the design stays educator-first.

**Design persona: the educator creator.** A teacher, tutor, course creator or student-teacher who explains concepts (science, maths, history, finance basics, language, exam prep) and wants a regular stream of short explainers. Comfortable with Instagram, not with video software. Expects English narration in an Indian accent, which sounds natural to their students.

**What they care about:** speed, accuracy of the content, looking clean and professional, not wasting time on settings.

## 4. The four-step user flow

| Step | Screen | What the user does | Primary button |
| --- | --- | --- | --- |
| 1 | **Idea** | Types a topic or taps suggestions; picks length | Create script and storyboard |
| 2 | **Review** | Reads the scene list; optionally edits or regenerates scenes | Looks good, generate video |
| 3 | **Generate** | Watches progress; previews the finished video; optionally regenerates one scene | Continue to post |
| 4 | **Post** | Connects Instagram (first time only), edits caption, posts now or schedules | Post now / Schedule |

Rules for the flow:

- Steps show as a simple progress bar at the top. The user can go back one step.
- The dashboard home has only two things: a large **Create video** button and the **Library** of past videos.
- Each step saves automatically, so a refresh or closed tab loses nothing.
- No settings are required. Every option has a sensible default.

## 5. Functional requirements

Priority: **P0** must ship in V1, **P1** should ship, **P2** nice to have.

### 5.1 Access and team accounts (P0)

| ID | Requirement |
| --- | --- |
| A1 | Authentication is **custom**: email and password signup and login, **forgot and reset password** by emailed link, and **Google sign-in**. All three paths obey the approved-email rule (A2). |
| A2 | **Invite-only.** Only emails on the approved list can create an account or sign in. Anyone else sees "This app is invite-only" and no account is created. The check runs on the server, not only in the interface. |
| A3 | Two roles: **admin** and **member**. The first admin is set from an environment variable (adit's email). |
| A4 | An **Admin page**, visible only to admins, to add or remove approved emails, set the role, and change a member's daily video limit. |
| A5 | Removing a member blocks new sign-ins at once and ends their active sessions. Their videos are kept unless the admin chooses to delete them. |
| A6 | Secure sessions with sign-out. Every API route and page checks that the signed-in user is still on the approved list. |
| A7 | **Daily video limit** per member (default 5 per day for members and 20 for admins; an admin can change either) to protect free API quotas. The Idea screen shows "videos left today". Fixing a single scene does not count. This is a usage guard, not billing. |
| A8 | Profile: name. Delete my data is P1. |
| A9 | Email verification is left out of V1, since only approved emails can join. |

Acceptance: an unapproved email cannot sign in or sign up, even by calling the API directly. A removed member loses access on their next request. An approved member reaches Step 1 in under two minutes.

### 5.2 Step 1: Idea (P0)

| ID | Requirement |
| --- | --- |
| I1 | One text box: "What do you want to explain?" Accepts a topic or a sentence, up to 500 characters. |
| I2 | **Suggest ideas** button: AI returns 6 topic ideas based on an optional subject the user types (for example "class 10 physics"). Tapping one fills the box. Regenerate for a fresh set. |
| I3 | **Plan with AI** (optional): AI offers 3 angles for the topic (for example "everyday example", "step by step", "common mistakes") and a suggested hook. User picks one or skips. |
| I4 | Length selector: 30, 60 or 90 seconds. Default 60. |
| I5 | Language: English only in V1, so no language selector is shown. The language is still stored with each video so more languages can be added later. |
| I6 | Audience, optional with default General public. Choices: Class 5, 7 and 9; College students; Exam aspirants; Working professionals; Managers and leaders; New hires; General public. Controls vocabulary, depth, examples and the idea chips shown. |
| I7 | Primary button creates the script and storyboard in one action. |
| I8 | Input is checked for unsafe or disallowed topics (see 8.4) and rejected with a plain message. |

Acceptance: with only a topic typed, the user can press the primary button and get a result using defaults.

### 5.3 Step 2: Script and storyboard, together (P0)

The user never sees a separate "script stage". One generation produces a single scene list where each scene has narration and visuals.

| ID | Requirement |
| --- | --- |
| S1 | AI generates a storyboard of 4 to 12 scenes depending on length. Each scene has: narration text, on-screen text, visual plan (see 5.5), and approximate duration. |
| S2 | Total narration length must fit the chosen length: about 2.3 words per second for English. The system checks the estimate and retries generation if it is more than 10% over or under. |
| S3 | Structure of the script: hook (first scene, grabs attention within 3 seconds), explanation scenes, one example, a short recap, and an optional call to action. |
| S4 | The review screen shows scenes as cards: a thumbnail-style preview of the visual plan, the narration text, and the duration. |
| S5 | Per scene the user can: edit narration text, edit on-screen text, regenerate that scene, delete it, or move it up or down. Each scene card has one small menu for these actions. |
| S6 | **Regenerate all** returns a fresh storyboard for the same inputs. |
| S7 | Editing narration updates the estimated total length live and warns if it exceeds the chosen length by over 10%. |
| S8 | Content accuracy aid: the AI marks any scene containing a number, date, or factual claim with a small "check this" marker so the educator verifies it before publishing. |
| S9 | Primary button: **Looks good, generate video**. |

Acceptance: storyboard appears in under 30 seconds for typical input. A user can approve without touching anything.

### 5.4 Voiceover (P0)

| ID | Requirement |
| --- | --- |
| V1 | English narration with Indian-accent voices (en-IN), plus one neutral-accent option. |
| V2 | 3 to 4 voices (mix of male and female), Indian-accent where the plan allows. A default is preselected. **Prototype finding:** on the ElevenLabs free plan the API only allows ElevenLabs' own stock (premade) voices; library voices, including the Indian-accent voices adit picked, return "paid plan required". Indian-accent voices therefore need a paid plan or another provider (section 16). |
| V3 | Voice picker on the Review screen, with a short 5-second sample per voice. |
| V4 | Speed control: slow, normal, fast (default normal). |
| V5 | Per-scene audio preview on the Review screen is P1. |
| V6 | Each narration produces an audio file plus **word-level timestamps** (start and end time of every word). If the voice provider does not return timestamps, the system derives them with a speech-recognition alignment pass. |
| V7 | Voice generation sits behind a single internal interface (text, language, voice, speed in; audio and word timings out), so providers can be swapped without changing the rest of the app. |
| V8 | Indian names, places and subject terms (for example Hindi-origin words inside English sentences) must be pronounced acceptably; test cases are part of QA. |

Acceptance: audio and timings are produced for every scene; total audio length is within 5% of the storyboard estimate or the app corrects scene timings to match the real audio.

### 5.5 Motion graphics engine (P0)

The visuals are built from a fixed library of animated scene templates, filled with content from the storyboard. The AI chooses a template and fills its fields. It does not invent free-form animation.

**Template library for V1:**

| Template | Use | Animation |
| --- | --- | --- |
| Title / hook card | Opening line, topic name | Text reveal with background motion |
| Bullet reveal | Lists of points | Each point appears on its spoken word |
| Step flow | Processes, sequences | Boxes and arrows draw in one by one |
| Concept diagram | Parts of a whole, cycle, hierarchy | Nodes and labels appear in order. **Built in the prototype:** a generic loop/flow diagram plus two topic-specific animated diagrams (light through a raindrop, Earth's tilt around the sun) |
| Comparison | A versus B | Two columns animate in |
| Definition callout | Key term and meaning | Term highlights, definition slides in |
| Stat / number | Key figures | Counter animation and label |
| Timeline | Dates, history | Line grows with events appearing |
| Formula / equation | Maths and science | Formula builds term by term |
| Stock clip with overlay | Real-world illustration | Clip plays, with text overlay |
| Recap card | End of video | Key points listed with checkmarks |

Requirements:

| ID | Requirement |
| --- | --- |
| M1 | Output is vertical 9:16, 1080x1920 at 30 fps. |
| M2 | A consistent visual theme: one of 4 preset colour themes, chosen automatically by default and changeable on the Review screen. |
| M3 | Fonts: a clean sans font (Latin script only in V1). Text must never overflow or sit outside the safe area for Instagram's interface. |
| M4 | Each animated element has a **cue**: a phrase in the narration it should appear on (see section 7). |
| M5 | Icons and simple illustrations come from free licensed libraries. |
| M6 | Transitions between scenes are short (under 0.5 seconds) and consistent. |
| M7 | If a template cannot fit the content (too much text), the system splits the scene or shortens the text and logs it. |

### 5.6 Stock media (P0)

| ID | Requirement |
| --- | --- |
| T1 | For "stock clip" scenes, the AI writes a short search query; the system fetches clips or images from free stock APIs (Pexels, Pixabay). |
| T2 | Pick a clip that fits the scene duration, preferring vertical clips; crop or pan to fit 9:16. |
| T3 | Fallback if nothing suitable is found: switch the scene to a text or diagram template. |
| T4 | Store source and licence info for every asset used. Show attribution where the licence needs it (in the caption or the end of the video). |
| T5 | The user can swap a clip: **Try another** button picks the next result. (P1) |

### 5.7 Captions and music (P0)

| ID | Requirement |
| --- | --- |
| C1 | Burned-in captions driven by the word timestamps, shown in short chunks (about 3 to 6 words), with the active word highlighted. On by default, can be turned off. |
| C2 | Captions spell Indian names and subject terms correctly. |
| C3 | Background music: choose from 5 to 8 royalty-free tracks or none. Default is a soft track at low volume. |
| C4 | Music is automatically lowered under the voice (ducking) so narration stays clear. |
| C5 | Subtitle text file (SRT) is available for download. (P1) |

### 5.8 Step 3: Video generation, preview and scene fix (P0)

| ID | Requirement |
| --- | --- |
| R1 | Pressing **Looks good, generate video** locks the storyboard and starts a render workflow. |
| R2 | A progress screen shows plain stages: Writing voice, Building scenes, Rendering video, Finishing. With a percentage and an estimated wait. |
| R3 | The user can leave the page; the workflow continues. They see the status in the Library, and get an in-app notice when it is ready. |
| R4 | When done, an in-page player shows the video with play, pause and a seek bar. |
| R5 | **Fix a scene:** the user can select a scene and regenerate its visuals or edit its text, then re-render only that scene and re-assemble. It does not count against the daily limit. |
| R6 | Download button for the MP4. |
| R7 | Failed steps retry automatically. If the render still fails, the user sees a clear message with a Try again button, and the failed attempt does not count against the daily limit. |
| R8 | Render time target: under 5 minutes for a 60-second video. |
| R9 | Cancel button while queued or rendering. |

Acceptance: a 60-second English video renders end to end with audio in sync, captions, and no frame errors. Manual spot check of audio-visual sync on at least 10 sample videos before release.

### 5.9 Step 4: Instagram connection, posting and scheduling (P0)

#### The connect flow (four steps)

| Step | What happens |
| --- | --- |
| 1 | The team member clicks the **Connect Instagram** button (on the Post step, and in Settings under Connections). |
| 2 | The app sends them to **Meta's own authorization screen**. The app never sees their Instagram password. |
| 3 | They **authorize an eligible Instagram professional account** and approve the publishing permission. |
| 4 | They return to the app, which **stores the connection securely** and **shows the destination account**: profile picture, @username, account type, connected date and connection status. |

Requirements for the connection:

| ID | Requirement |
| --- | --- |
| P1 | The Connect Instagram button is available only to signed-in approved members. |
| P2 | The connect request carries a one-time `state` value that is checked on return, to block forged callbacks. |
| P3 | The access token is exchanged on the server, encrypted before it is saved, and never sent to the browser or written to logs. |
| P4 | After connecting, the Post step shows "Posting to @username" with a small Change account link. |
| P5 | If the member cancels on Meta's screen, they return to the app with a plain message and nothing is saved. |
| P6 | If the chosen account is not eligible (for example a personal account), show a short guide on switching to a professional account and a Try again button. |
| P7 | Connection status shown in Settings: Connected, Needs reconnect (token expired or revoked). **Disconnect** deletes the stored token. |
| P8 | Tokens are refreshed automatically before they expire; if refresh fails, status changes to Needs reconnect and the member is notified. |

#### Posting and scheduling

| ID | Requirement |
| --- | --- |
| Q1 | The caption editor on Step 4 is prefilled by AI: a 2 to 3 line caption, a call to action, and 5 to 10 relevant hashtags. Fully editable. Caption limit respects Instagram's maximum length. |
| Q2 | **Post now** publishes the video as a Reel to the connected account. |
| Q3 | **Schedule:** pick a date and time (shown in the member's time zone). The app stores the job and publishes at that time. |
| Q4 | Posting states: scheduled, publishing, posted, failed. Each is visible in the Library. |
| Q5 | On success, store the Instagram post link and show it. |
| Q6 | On failure (expired token, rate limit, rejected video), show a plain reason and a **Retry** or **Reconnect** button. Transient failures retry automatically up to 3 times. |
| Q7 | The member can cancel or reschedule a scheduled post before it publishes. |
| Q8 | If Instagram is not connected, the member can always download the video and caption and post manually. |

**Technical notes (verify against Meta's current docs when building):**

- Because this is internal testing, the Meta app stays in **development mode**. Accounts that hold a role on the Meta app (admin, developer or tester) can authorize it without Meta's app review. Every team member who will connect an account must be added to the app, and their Instagram account must be set up as a tester where Meta requires it. A privacy policy page and basic app details are still likely needed in the Meta app settings.
- Publishing uses a two-part flow: create a media container from a **publicly reachable video URL** (an R2 link), wait until the container is ready, then publish it.
- Reel needs: MP4 or MOV, 9:16, 5 to 90 seconds, H.264 video with AAC audio, file under 100 MB.
- "Eligible account" means an Instagram professional account. Business accounts are confirmed for publishing; whether Creator accounts are allowed with the current Instagram login flow must be checked before building.
- Access tokens are long-lived but expire (about 60 days) and must be refreshed.
- The account is limited to about 100 API posts per 24 hours, far above V1 use.
- Scheduling is done by this app's own workflow engine (Inngest), not by Instagram.

### 5.10 Library (P0)

| ID | Requirement |
| --- | --- |
| L1 | List of all the member's videos as cards: thumbnail, title, length, language, date, status. |
| L2 | Status values: Draft, Storyboard ready, Rendering, Ready, Scheduled, Posted, Failed. |
| L3 | Open any item to resume from its last step. |
| L4 | Actions: duplicate (starts a new video with the same idea), delete, download. |
| L5 | Basic search by title and filter by status. (P1) |
| L6 | Deleting a video removes its files after a 7-day grace period. |

### 5.11 Usage tracking (internal, P1)

- Log each AI, voice and render call per video (what was used and how much), so adit can see where free quotas go. No money amounts are shown or charged.
- The Admin page shows videos made per member per day and the daily limits.

### 5.12 Notifications (P1)

- In-app notice when a render finishes, a post succeeds, a post fails, or an Instagram connection needs reconnecting.
- Email for the same events is P2.

## 6. Screens (list for design)

1. Sign-in (invite-only message for others)
2. Dashboard home: Create video button, Library
3. Step 1: Idea
4. Step 2: Review (scene cards, voice picker, theme, music)
5. Step 3: Generate (progress, then player)
6. Step 4: Post (connect Instagram, destination account, caption, schedule)
7. Library and video detail
8. Settings (Instagram connections)
9. Admin: approved team members, roles, daily limits, usage

Design principle: one main action per screen, large buttons, minimal text, works on phone width.

## 7. Sync design: how visuals match the voice

This is the core technical idea of V1.

1. The storyboard gives each scene a narration line and a list of **visual elements**. Each element has a `cue`, a short phrase from the narration (for example "three states of matter").
2. The voice step returns audio plus **word timestamps** for the scene.
3. The sync step finds the cue phrase in the word list and sets the element's start time to that word's start time. Matching is fuzzy so small wording differences still work. If no match is found, it falls back to evenly spacing elements across the scene.
4. Scene duration equals the real audio length plus a short pause (about 0.3 seconds), not the estimate.
5. The rendering engine (Remotion) takes the final timed scene list and draws each frame from it. Animations are defined in frames, so there is no drift.
6. Captions use the same word timestamps, so captions, voice and visuals share one clock.

**Scene data shape (simplified):**

```
video: { id, language, voice, theme, aspect: "9:16", fps: 30 }
scene: {
  id, order, template: "step_flow",
  narration: "First, water heats up...",
  onScreenText: [...],
  elements: [ { type: "node", text: "Heat", cue: "water heats up", startMs, endMs } ],
  audio: { url, durationMs, words: [ { word, startMs, endMs } ] },
  media: { source, url, licence }
}
```

**Quality checks run automatically before delivery:** no element starts before the voice begins, none outlasts the scene, text fits its box, and audio length matches video length within one frame.

## 8. Non-functional requirements

### 8.1 Performance

- Storyboard generation: under 30 seconds.
- Render: under 5 minutes for a 60-second video (one job at a time, in a Vercel Sandbox).
- Pages load in under 3 seconds on a normal connection.

### 8.2 Reliability

- Workflows are durable: each step is saved by Inngest, so a failure retries from the failed step, not from the start.
- Each step is safe to run twice: re-running does not duplicate a render or a post.
- A scheduled post survives deploys and restarts, because the schedule lives in Inngest, not in server memory.
- A post that misses its time because of an outage runs when service returns and is flagged late.

### 8.3 Security and privacy

- Access control: server-side sessions, plus a server-side approved-email check on every request. No public sign-up.
- Instagram tokens encrypted at rest with a key kept in Vercel environment variables, never shown to the client.
- Secrets (database, R2, Inngest, Meta, AI keys) live only in environment variables.
- R2 bucket is private. Files are served with short-lived signed links; the video link given to Instagram only needs to stay valid long enough for Instagram to fetch it.
- Members can only access their own videos; admins manage the approved list.
- A short privacy policy page, since Meta app settings are likely to ask for one.
- Data deletion: removing a member's data deletes files and tokens.

### 8.4 Content safety and licensing

- Block requests for hate, sexual content, self-harm instructions, or other harmful topics, using the model's safety settings plus a simple keyword check.
- Only use licensed stock media and music; record the source of each asset.
- No voice cloning and no real people's likenesses in V1.
- Add a note that educators are responsible for the accuracy of what they publish.

### 8.5 Accessibility

- Captions on by default; sufficient colour contrast; keyboard-usable web app.

### 8.6 Localisation

- App interface and video content are in English for V1, with Indian-accent voices.

## 9. Technical approach

| Layer | Choice |
| --- | --- |
| Web and backend | Next.js (App Router) with TypeScript, API routes on the Node.js runtime |
| Authentication | Custom auth on MongoDB (scrypt passwords, session cookies, Google OAuth, Resend for reset mail), restricted to approved emails |
| Database | MongoDB Atlas (free M0 tier), with Mongoose for app data |
| Files (video, audio, assets) | Cloudflare R2 |
| Hosting | Vercel |
| Background workflows and scheduling | Inngest |
| Animation and rendering | Remotion, rendered in Vercel Sandbox with the `@remotion/vercel` package (experimental) |
| Storyboard AI | A free-tier LLM behind a swappable interface (Gemini free tier first, Groq as alternative), with JSON output checked against a schema |
| Voice | ElevenLabs text-to-speech API with timestamps, behind the voice interface (V7). Free plan: stock voices only (tested: works with timestamps). Indian-accent library voices need a paid plan (tested: refused on free) |
| Word timing fallback | Word times come from ElevenLabs' character-level timestamps, grouped into words, so no separate timing service is needed |
| Stock media | Pexels and Pixabay APIs |
| Instagram | Meta's Instagram API with Instagram Login, professional accounts |

Notes: The ElevenLabs free plan gives about 10,000 credits a month and appears to exclude commercial use, which is fine for internal testing; confirm the current terms. A monthly voice-credit guard blocks Generate when the credits run out. Remotion's licence is free for individuals and small teams; confirm current terms. Free-tier AI limits are rate-limited, so requests are queued and retried.

### Pipeline

1. **Plan:** idea, length, language, audience go to the AI and come back as a validated storyboard.
2. **Voice:** for each scene, create audio and word timings.
3. **Sync:** map cues to timings; compute final scene durations.
4. **Media:** fetch stock clips and images.
5. **Render:** Remotion renders in Vercel Sandbox; the MP4 is uploaded to R2.
6. **Publish:** on schedule, post the R2 video to Instagram.

Scene-level caching means "fix a scene" only repeats steps 2 to 5 for that scene.

### Inngest workflows

The Next.js app serves an Inngest endpoint (`/api/inngest`) and sends events; Inngest runs the functions below as durable steps.

| Function | Trigger | What it does |
| --- | --- | --- |
| `renderVideo` | Event: video render requested | One step per scene for voice and timing; sync; fetch media; start the Sandbox render in detached mode; poll progress in short steps with sleeps in between; upload the MP4 to R2; update the video and `render_jobs`. Retries per step. Cancels on a cancel event. |
| `publishInstagram` | Event: post requested | Sleep until the scheduled time (or run now); create the Instagram media container; poll until ready; publish; save the permalink. Retries transient errors. Cancels on a cancel or reschedule event. |
| `refreshInstagramTokens` | Daily schedule | Refresh tokens that are close to expiry; mark failures as Needs reconnect. |
| `cleanupDeletedVideos` | Daily schedule | Remove files for videos deleted more than 7 days ago. |

Each Inngest step runs inside a Vercel function call, so each step must finish within Vercel's function time limit. Long work lives in the Sandbox, and the workflow only starts it and checks on it. Use Inngest's local dev server while building. Free-plan limits (for example how long a function can sleep, which affects how far ahead a post can be scheduled, and how many run at once) must be checked before relying on them.

### Rendering and storage (Vercel Sandbox and R2)

A workflow step starts the render in Vercel Sandbox, a temporary Linux machine with Chrome and FFmpeg, so it takes a few seconds to start and renders on a single machine. Remotion's docs list 45 minutes per render and 10 simultaneous renders on Vercel's Hobby plan. The package's default output goes to Vercel Blob, so sending the finished MP4 to Cloudflare R2 is a custom step (read the file in the Sandbox, upload to R2's S3-compatible API). Test that in the phase 1 spike. Sandbox is billed by usage, so set Vercel Spend Management and check current pricing.

### Data model (MongoDB)

| Collection | Key fields |
| --- | --- |
| users, sessions, password_resets | Owned by the app |
| approved_emails | email (unique), role, daily_limit, added_by, added_at |
| videos | user_id, topic, length_sec, language, audience, voice, theme, music, status, caption, scenes (embedded list), created_at, deleted_at |
| render_jobs | video_id, user_id, status, stage, progress, inngest_run_id, sandbox_id, error, output_key, started_at, finished_at |
| instagram_connections | user_id, ig_user_id, username, account_type, profile_picture_url, encrypted_token, token_expires_at, status, connected_at |
| posts | video_id, connection_id, caption, scheduled_at, status, ig_media_id, permalink, error, inngest_run_id |
| assets | video_id, source, source_url, licence, attribution |
| usage_log | user_id, video_id, type, units, created_at |

Each scene (narration, elements, audio word timings, media choice) is stored inside its video document, so the Review and player screens load with one read; a video stays far below MongoDB's 16 MB document limit. Indexes: videos by user and date, posts by status and scheduled time, approved_emails by email.

### Main API endpoints (internal)

- Auth routes under `/api/auth/*` (signup, login, logout, forgot-password, reset-password, google); Inngest endpoint `/api/inngest`
- `GET/POST/DELETE /api/admin/approved-emails`
- `POST /api/ideas/suggest`, `POST /api/ideas/angles`
- `POST /api/videos` (create from idea, returns storyboard)
- `PATCH /api/videos/:id/scenes/:sceneId`, `POST /api/videos/:id/scenes/:sceneId/regenerate`
- `POST /api/videos/:id/render`, `GET /api/videos/:id/render/status`
- `GET /api/instagram/connect` (starts step 1 and 2), `GET /api/instagram/callback` (steps 3 and 4), `DELETE /api/instagram/connection`
- `POST /api/videos/:id/post` (now or scheduled), `PATCH /api/posts/:id`
- `GET /api/library`

## 10. Edge cases and error states

| Situation | Behaviour |
| --- | --- |
| Unapproved email tries to sign in or sign up | Blocked on the server with an invite-only message; no account created. |
| Member removed while signed in | Next request fails and the session ends. |
| Daily limit reached | Idea step shows the limit and when it resets; the admin can raise it. |
| AI returns invalid or incomplete storyboard | Retry up to 2 times with the validation error; then show a friendly retry message. |
| Narration too long or too short for chosen length | Auto-adjust; if still off, warn the user on Review. |
| Word timings missing | Fall back to speech-recognition alignment; if that fails, evenly space elements. |
| No stock clip found | Switch scene to a text or diagram template. |
| Sandbox render fails or times out | Retry the step; if it still fails, mark failed with a Try again button. |
| User leaves during render | Workflow continues; shown in Library. |
| Member cancels on Meta's authorization screen | Return to the app with a plain message; nothing saved. |
| Account is not an eligible professional account | Show the switch-account guide and Try again. |
| Instagram token expired or revoked | Connection shows Needs reconnect; scheduled posts pause and the member is notified. |
| Instagram rejects the video | Show Meta's reason in plain words; offer re-export or manual download. |
| Scheduled time is in the past | Block with a message, or offer Post now. |
| Same video posted twice by accident | Warn before posting a video that was already posted. |
| Unsafe topic | Reject with a short, non-judgemental message. |

## 11. Internal test goals

Since this is an internal passion project, success is working software:

- **Access:** an unapproved email can never sign in, checked through the interface and by calling the API directly.
- **Completion:** a teammate finishes all 4 steps without help, at least 8 times out of 10.
- **Time to first video:** under 10 minutes from sign-in.
- **Sync quality:** on a 10-video test set, no visible mis-timed animation in at least 9.
- **Render success rate:** 95% or more without manual retry.
- **Posting success:** 95% or more of posts succeed to a connected test account.
- **Connect flow:** a teammate completes the four-step Instagram connection on the first try.

## 12. Build plan (solo, suggested order)

| Phase | Outcome |
| --- | --- |
| 0. Setup | Next.js and TypeScript on Vercel; MongoDB Atlas; custom auth (signup, login, reset, Google) with the approved-email check and first admin; R2 bucket; Inngest dev server; Meta developer app in development mode with a test Instagram professional account. |
| 1. Pipeline spike | One hard-coded script to voice with timings, to 3 templates, rendered in Vercel Sandbox, uploaded to R2. Prove the sync and the R2 upload. |
| 2. Storyboard AI | Idea step and storyboard generation with schema validation. Review screen with edit and regenerate. |
| 3. Full template library | Remaining templates, themes, stock media, music, English (Indian accent) QA. |
| 4. Render workflow | Inngest `renderVideo`, progress screen, player, fix-a-scene, library, daily limit. |
| 5. Instagram | Four-step connect flow, post now, scheduling with Inngest, token refresh. |
| 6. Hardening | Admin page, error states, safety checks, usage log, test set, polish. |

The pipeline spike in phase 1 is the biggest risk reducer; do it before building screens.

## 13. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Free AI tier limits or quality | Swappable AI interface; test the Indian-accent voices early; queue and retry; daily limit per member. |
| ElevenLabs free credits (about 10,000 a month) cover only about 10 to 20 videos a month; library (Indian-accent) voices are blocked on the free plan | Voice interface (V7); use stock voices for now, upgrade the plan or switch provider for Indian-accent voices. A 24 second video used only about 400 credits in testing, so the real limit may be nearer 25 videos a month. |
| Remotion on Vercel Sandbox is experimental; output goes to Vercel Blob by default | Prove the render and the R2 upload in the phase 1 spike; keep the render step isolated so it can move to another host. |
| Sandbox usage costs or Hobby plan limits | Vercel Spend Management; one render at a time; check current limits and terms. |
| Inngest free-plan limits on sleep time, concurrency or steps | Check limits in phase 0; keep steps short; schedule posts within allowed range. |
| Meta development mode only works for accounts with a role on the app | Add each tester to the Meta app early; keep the download-and-post-manually fallback. |
| Creator accounts may not be eligible for publishing | Verify in Meta's docs in phase 0; test with a Business account first. |
| Sync looks off on long lines or with unusual names | Word times grouped from ElevenLabs character timestamps; manual test set; keep elements tied to short cues. |
| Licence issues (Remotion, stock media, music, Lottie) | Record licence per asset; read each licence before wider use. |
| Content accuracy errors in educational videos | "Check this" markers; edit before render; accuracy disclaimer. |
| Scope creep for a solo builder | Hold to the non-goals; anything new goes to the V2 list. |

## 14. Assumptions and open questions

**Assumptions made in this draft (tell me if wrong):**

1. "Ingest" means **Inngest** and "Dreamotion" means **Remotion**.
2. Sign-in is email and password plus Google; both follow the approved-email rule.
3. Each team member connects their own Instagram account.
4. Default daily limit is 5 videos per member and 20 for admins, editable on the Admin page.
5. App interface is English only.
6. Four colour themes and 8 or fewer music tracks are enough for V1.

**Open questions:**

1. Decided: the first admin comes from an ADMIN_EMAIL environment variable in Vercel, so no email lives in the code.
2. Decided: each member connects their own Instagram account (the same test account can be connected from more than one login while testing).
3. Decided: test with a separate free Instagram account switched to Business, not a personal account, because personal accounts cannot publish through the API.
4. Decided: the daily limit is 5 videos per member and 20 for admins.
5. Decided: no email verification in V1, because only approved emails can join.

## 15. Later versions (not in V1)

**If this opens beyond the team:** billing, credits and plans, a free trial, public sign-up, Meta app review for public access, a licensed voice provider, rate limiting and abuse checks.

**V2:** brand kit (colours, logo, fonts), series planner, content calendar, YouTube Shorts and TikTok posting, Instagram analytics, more templates and subjects, Hindi and other languages (voice and captions), 16:9 and 1:1 exports, quiz and worksheet add-ons.

**Later:** AI avatar presenters, voice cloning with consent, performance-based hook suggestions, repurposing from PDFs and blogs, team workspaces, API and white label.

## 16. Prototype findings (local prototype, 18 Oct 2026)

A local prototype (Remotion plus a Node pipeline) turns a storyboard into a finished vertical mp4. Files are in `vidyareel/prototype/` (code, storyboards, videos, frame sheets).

**What was proven**
1. **Sync works.** ElevenLabs character timestamps grouped into words place every on-screen element on its spoken cue, with word-by-word captions on the same clock. Every cue in 7 test videos synced.
2. **Gemini writes usable storyboards** from a one-line idea (JSON with scenes, element text and cue phrases). Gemini 2.5 models are no longer available to new keys, so the code uses the `gemini-flash-latest` alias; the model id must be configurable.
3. **Animated diagrams are feasible** as SVG templates driven by cues: light through a raindrop, Earth's tilt and orbit, and a generic loop diagram.
4. **Render speed:** about 40 to 90 seconds for a 24 to 47 second video on this machine, which is a useful baseline for the Vercel Sandbox spike.

**Problems found and fixed**
- Empty screen at scene start when the first cue is late: the first element of each scene now appears immediately.
- Storyboard rule enforced by the build: elements must be listed in the order they are spoken.

**Open issues**
- **Voices:** ElevenLabs free plan cannot use library voices (Viraj, Tara) through the API. Decision needed: paid plan, stock voices, or another provider.
- **Visual quality:** still text cards and diagrams on a gradient. Next: let Gemini choose diagram templates automatically, add icons and stock clips (sections 5.5, 5.6).
- The generic flow diagram has no arrowheads.
- Diagram templates beyond the three built need to be added per topic type (comparison, timeline, formula, stat).
- Audio quality and pronunciation of Indian names (V8) not yet judged by ear.

**Security note:** API keys were pasted in chat during testing and must be rotated.
