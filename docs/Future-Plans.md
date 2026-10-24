# Vidyareel: Future Plans

Last updated: 2026-10-24 (prompt 8)

Fine-grained numbered steps live in [Implementation-Steps.md](Implementation-Steps.md). Phase 0 code is done; its gate is waiting on the account steps below (marked 👤 there), then Phase 1 (pipeline spike).

Work is organised in phases: see [Phases.md](Phases.md). Current phase: **0 Setup and foundation**.

What is left to implement. Updated on every prompt; finished items move to [Project-Status.md](Project-Status.md). Milestones follow [Prototype-Plan.md](Prototype-Plan.md).

## Next up: finish Phase 0 (needs you)

- [ ] 0.28/0.29 Complete Google sign-in in a browser (consent screen needs a human); test unapproved Google account refusal
- [ ] Add `http://localhost:3000/api/auth/google/callback` to the Google OAuth client's redirect URIs (error `redirect_uri_mismatch`), then retest Google
- [ ] Clean up leftovers Vidyareel created in the other project's `test` database (needs owner approval)
- [ ] 0.26 Set `EMAIL_FROM` to `onboarding@resend.dev` or a verified-domain address (gmail is rejected); test a real reset email; make forgot-password log send failures
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
