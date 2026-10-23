# Vidyareel: Future Plans

Last updated: 2026-10-23 (prompt 4)

Fine-grained numbered steps live in [Implementation-Steps.md](Implementation-Steps.md); the next step to do is **0.2** (run the app), then the MongoDB connection steps 0.5–0.10.

Work is organised in phases: see [Phases.md](Phases.md). Current phase: **0 Setup and foundation**.

What is left to implement. Updated on every prompt; finished items move to [Project-Status.md](Project-Status.md). Milestones follow [Prototype-Plan.md](Prototype-Plan.md).

## Next up (M2 Foundation, finish)

- [ ] Provision MongoDB Atlas, set `.env.local`, run the app, and test signup/login/logout/reset/Google end to end
- [ ] Call `ensureIndexes()` (startup script or health route)
- [ ] Per-IP rate limits on auth routes (`rate_limits` collection with TTL)
- [ ] Google Cloud OAuth client (redirect `APP_URL/api/auth/google/callback`)
- [ ] Resend account / sender for reset emails
- [ ] `GET /api/me`, route protection (redirect signed-out users to `/sign-in`), sign-out button
- [ ] Admin: approved-emails CRUD (`/api/admin/approved-emails`), removal revokes sessions
- [ ] R2 `StorageProvider`, Library page shell
- [ ] Auth tests: unapproved signup rejected, reset token single-use, removed member blocked
- [ ] Optional: email verification for password signups

## Later milestones

- [ ] M1 spike: Remotion in Vercel Sandbox, R2 upload, Inngest `renderVideo`, ElevenLabs sync, Instagram test post
- [ ] M3 Script and review: idea suggestions, Gemini storyboard with schema validation, Review screen
- [ ] M4 Generate: voice, word timing, cue sync, Remotion templates (title-hook, bullet-reveal, step-flow, definition-callout first), real `renderVideo`, player, fix-scene
- [ ] M5 Post: Instagram connect, post now, schedule, reschedule, cancel, token refresh
- [ ] M6 Harden: daily cap, usage log, notifications, admin usage screens, delete + cleanup, error messages, PRD test checklist
- [ ] Build real UI for all screens from the Stitch designs (Sign-in, Dashboard, Create 1–4, Library, Settings, Admin, mobile Home)
- [ ] Remaining Remotion templates (stat, comparison, timeline, formula, stock-clip, recap, diagram)
- [ ] Deployment: Vercel project, env vars, Spend Management, Inngest cloud
- [ ] First commit and `main` branch setup
