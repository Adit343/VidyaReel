# Vidyareel: Future Plans

Last updated: 2026-10-24 (prompt 13)

Fine-grained numbered steps live in [Implementation-Steps.md](Implementation-Steps.md). Phase 0 is done and signed off; Phase 1 (pipeline spike) is in progress.

Work is organised in phases: see [Phases.md](Phases.md). Current phase: **1 Pipeline spike**.

What is left to implement. Updated on every prompt; finished items move to [Project-Status.md](Project-Status.md). Milestones follow [Prototype-Plan.md](Prototype-Plan.md).

## Next up: Phase 1 (pipeline spike)

- [ ] Check Sandbox usage in the Vercel dashboard (Spend Management is paid-only; Hobby cannot be billed); try a snapshot to cut the 45 s cold start
- [ ] Work out how long renders fit in a Hobby function (maxDuration) or split renders by frame range (deploy time)
- [ ] Clean up sandboxes left by failed attempts
- [ ] Pick the two free stock voices to ship (tried Alice and Daniel; listen to `out/voice/*.mp3`) and set `ELEVENLABS_VOICE_IDS`
- [ ] Wire voice and sync into the render steps and templates (audio in the video, captions): Phase 3/4
- [ ] Monthly voice-credit guard (about 10 videos of 60 s per month on the free plan): step 6.2
- [ ] 1.14 👤 Meta developer app + Business test Instagram account, then 1.15 to 1.17

## Phase 0 leftovers (not blocking)

- [ ] Test that an unapproved Google account is refused (needs a second Google account)
- [ ] Clean up leftovers Vidyareel created in the other project's `test` database (needs owner approval)
- [ ] 0.26 Make forgot-password log send failures; verify a sending domain before inviting other members
- [ ] Side-by-side visual check of Home, Library and Admin against Stitch (auth screens done)
- [ ] Stitch screens not yet built: Settings (Sign-In Methods), Terms/Privacy pages, mobile Home
- [ ] Optional: email verification for password signups (Stitch has "Check your email", "Email not verified" and verification states ready to build)


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
