# Vidyareel: Future Plans

Last updated: 2026-10-23 (prompt 6)

Fine-grained numbered steps live in [Implementation-Steps.md](Implementation-Steps.md). Phase 0 code is done; its gate is waiting on the account steps below (marked 👤 there), then Phase 1 (pipeline spike).

Work is organised in phases: see [Phases.md](Phases.md). Current phase: **0 Setup and foundation**.

What is left to implement. Updated on every prompt; finished items move to [Project-Status.md](Project-Status.md). Milestones follow [Prototype-Plan.md](Prototype-Plan.md).

## Next up: finish Phase 0 (needs you)

- [ ] 0.5 Create a MongoDB Atlas M0 cluster, copy `.env.example` to `.env.local`, set `MONGODB_URI`, `ADMIN_EMAIL`, `APP_URL`; then run `npm run db:indexes` and open `/api/health`
- [ ] 0.27 Google Cloud OAuth client (redirect `APP_URL/api/auth/google/callback`), set `GOOGLE_CLIENT_ID/SECRET`; test Google sign-in and unapproved refusal
- [ ] 0.26 Resend account + sender (`RESEND_API_KEY`, `EMAIL_FROM`); test a real reset email
- [ ] 0.42 Cloudflare R2 bucket + API token (`R2_*`); upload a test file and open its signed link
- [ ] Side-by-side visual check of Home, Library and Admin against Stitch (auth screens done)
- [ ] Stitch screens not yet built: Settings (Sign-In Methods), Terms/Privacy pages, mobile Home
- [ ] Optional: email verification for password signups (Stitch has "Check your email", "Email not verified" and verification states ready to build)

## Then Phase 1 (pipeline spike)

See Implementation-Steps §Phase 1.

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
