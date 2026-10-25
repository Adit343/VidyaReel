# Vidyareel: Future Plans

Last updated: 2026-10-25 (prompt 25)

Fine-grained numbered steps live in [Implementation-Steps.md](Implementation-Steps.md). Phases 0, 1 and 2 are done and signed off.

Work is organised in phases: see [Phases.md](Phases.md). Current phase: **3 Template library and media** (all steps done, waiting for owner sign-off).

What is left to implement. Updated on every prompt; finished items move to [Project-Status.md](Project-Status.md). Milestones follow [Prototype-Plan.md](Prototype-Plan.md).

## Next up

- [ ] Phase 3 sign-off by the owner (everything is built; try the Review screen voice samples and music in the browser). Optional before Phase 4: run `npm run check:storyboards` after the Gemini daily quota resets (12:30 PM IST until 1 Nov, then 1:30 PM IST)
- [ ] Phase 4: call `attachClip` for stock-clip scenes in `renderVideo` and put a signed `media.url` in the render props; fall back to another template when no clip is found; add an index for `assets`
- [ ] Add Pexels as a second media source if its API keys open again
- [ ] Phase 4: put the narration audio and the music `url` (signed link) in the render props; `Video` already plays the music and ducks it
- [ ] Run `npm run check:storyboards` against the real model to confirm the wider template list still gives valid storyboards (10 of 10)
- [ ] Review polish: a real frame preview per scene
- [ ] Monthly voice-credit check at `POST /api/videos` (`VOICE_CREDITS_LOW`, step 6.2)
- [ ] `POST /api/videos/:id/duplicate` (Phase 4, step 4.17)
- [ ] Library "Try again" on a failed card with no scenes should open Review (today it goes to the Generate placeholder)

Phase 1 leftovers to schedule later:

- [ ] Check Sandbox usage in the Vercel dashboard (Spend Management is paid-only; Hobby cannot be billed); try a snapshot to cut the 45 s cold start
- [ ] Work out how long renders fit in a Hobby function (maxDuration) or split renders by frame range (deploy time)
- [ ] Clean up sandboxes left by failed attempts
- [ ] Pick the two free stock voices to ship (tried Alice and Daniel; listen to `out/voice/*.mp3`) and set `ELEVENLABS_VOICE_IDS`
- [ ] Wire voice and sync into the render steps and templates (audio in the video, captions): Phase 3/4
- [ ] Monthly voice-credit guard (about 10 videos of 60 s per month on the free plan): step 6.2

## Phase 0 leftovers (not blocking)

- [ ] Test that an unapproved Google account is refused (needs a second Google account)
- [ ] Clean up leftovers Vidyareel created in the other project's `test` database (needs owner approval)
- [ ] 0.26 Make forgot-password log send failures; verify a sending domain before inviting other members
- [ ] Stitch screens not yet built: Settings (Sign-In Methods), Terms/Privacy pages (Home on mobile is now done)
- [ ] Turn derived notifications into a stored collection with real events (step 6.1) and show render percentage from `render_jobs` on Library cards
- [ ] Optional: email verification for password signups (Stitch has "Check your email", "Email not verified" and verification states ready to build)


## Later milestones



- [ ] M1 spike: Remotion in Vercel Sandbox, R2 upload, Inngest `renderVideo`, ElevenLabs sync, Instagram test post
- [ ] M4 Generate: voice, word timing, cue sync, Remotion templates (title-hook, bullet-reveal, step-flow, definition-callout first), real `renderVideo`, player, fix-scene
- [ ] M5 Post: Instagram connect, post now, schedule, reschedule, cancel, token refresh
- [ ] M6 Harden: daily cap, usage log, notifications, admin usage screens, delete + cleanup, error messages, PRD test checklist
- [ ] Build real UI for the remaining Stitch designs: Create 3 (Generate) and 4 (Post), Settings
- [ ] Remaining Remotion template: stock-clip
- [ ] Deployment: Vercel project, env vars, Spend Management, Inngest cloud
- [ ] First commit and `main` branch setup
