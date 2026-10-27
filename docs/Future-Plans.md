# Vidyareel: Future Plans

Last updated: 2026-10-27 (prompt 36)

Fine-grained numbered steps live in [Implementation-Steps.md](Implementation-Steps.md). Phases 0 to 3 are done and signed off; Phases 4 and 5 are built and wait for your sign-off.

Work is organised in phases: see [Phases.md](Phases.md). Current phase: **5 Instagram**, built and checked with a fake Instagram; the live connect and a real post wait for the Meta settings below. **4 Render workflow and Library** waits for your sign-off. **6 Hardening and team launch** is next.

What is left to implement. Updated on every prompt; finished items move to [Project-Status.md](Project-Status.md). Milestones follow [Prototype-Plan.md](Prototype-Plan.md).

## Next up

- [ ] **Phase 5 live check (needs you):** in the Meta developer dashboard, open the Instagram product, "API setup with Instagram login", and add the redirect URI (local: `http://localhost:3000/api/instagram/callback`; production: your Vercel URL plus `/api/instagram/callback`). Instagram may insist on https; if so use a free tunnel (cloudflared quick tunnel) and set `APP_URL` and `META_REDIRECT_URI` to it. `META_APP_ID` and `META_APP_SECRET` must be the **Instagram** app id and secret shown on that page (not the main Meta app id). Add each teammate's Instagram account as an Instagram Tester and have them accept. Put `IG_TOKEN_KEY` in Vercel (a key is already in your `.env.local`). Then connect, post once now, schedule one five minutes ahead, and reschedule and cancel another
- [ ] Run `npm run remotion:bundle` so new renders use the caption fix (older videos keep the cut-off captions; make a new video or duplicate one to re-render)
- [ ] Phase 5 sign-off: try Settings (connect, reconnect, disconnect, profile) and Post (now, scheduled, edit, cancel, retry) in the browser; each real post goes to your real Instagram account
- [ ] Going live for other educators (outside the Meta app's roles) needs Meta app review, a privacy policy URL and business verification; the Terms and Privacy pages are not built yet
- [ ] Notifications for post results and "reconnect Instagram" (the bell still derives its items from video status; the stored collection is step 6.1)
- [ ] Settings: the "Sign-In Methods" section (separate Stitch screen)
- [ ] Re-run `npm run check:storyboards` now and then (it uses free Gemini quota; the daily quota resets at 12:30 PM IST until 1 Nov, then 1:30 PM IST)
- [ ] Add Pexels as a second media source if its API keys open again
- [ ] Phase 4 sign-off: try Create, Review, Generate (rendering, ready, download, Fix a scene, Cancel) in the browser with your own account; each real render uses ElevenLabs credits (about 1 credit per narration character)
- [ ] Local render runs need a fresh Vercel token each day (`npx vercel env pull .env.vercel.local`, copy `VERCEL_OIDC_TOKEN` into `.env.local`), `npm run remotion:bundle` after template changes, and `npm run dev` plus `npm run inngest:dev` (with `INNGEST_DEV=1`)
- [ ] Run `npm run check:storyboards` against the real model to confirm the wider template list still gives valid storyboards (10 of 10)
- [ ] Review polish: show the stock clip's first frame in a stock-clip scene preview (needs the clip search to run before render)
- [ ] Monthly voice-credit check at `POST /api/videos` (`VOICE_CREDITS_LOW`, step 6.2)
- [ ] Daily cleanup job for soft-deleted videos (R2 files, jobs, assets) and for `render_jobs` older than 90 days (`cleanupDeletedVideos` is still a stub)
- [ ] Optional: SRT captions file (`GET /api/videos/:id/captions.srt`) and a time estimate from past jobs

Phase 1 leftovers to schedule later:

- [ ] Check Sandbox usage in the Vercel dashboard (Spend Management is paid-only; Hobby cannot be billed); try a snapshot to cut the 45 s cold start
- [ ] Work out how long renders fit in a Hobby function (maxDuration) or split renders by frame range (deploy time); the render is one step and took about 70 s for a 24 s video, so split it into start and poll steps before deploying
- [ ] Clean up sandboxes left by failed attempts
- [ ] Pick the two free stock voices to ship (tried Alice and Daniel; listen to `out/voice/*.mp3`) and set `ELEVENLABS_VOICE_IDS`
- [ ] Monthly voice-credit guard at `POST /api/videos` (the render start already checks the month's usage against `ELEVENLABS_MONTHLY_CREDITS`, default 10000): step 6.2

## Phase 0 leftovers (not blocking)

- [ ] Test that an unapproved Google account is refused (needs a second Google account)
- [ ] Clean up leftovers Vidyareel created in the other project's `test` database (needs owner approval)
- [ ] 0.26 Make forgot-password log send failures; verify a sending domain before inviting other members
- [ ] Stitch screens not yet built: Settings Sign-In Methods section, Terms/Privacy pages (Home on mobile is now done)
- [ ] Turn derived notifications into a stored collection with real events (step 6.1) and show render percentage from `render_jobs` on Library cards
- [ ] Optional: email verification for password signups (Stitch has "Check your email", "Email not verified" and verification states ready to build)


## Later milestones



- [ ] M1 spike: Remotion in Vercel Sandbox, R2 upload, Inngest `renderVideo`, ElevenLabs sync, Instagram test post
- [ ] M6 Harden: daily cap, usage log, notifications, admin usage screens, delete + cleanup, error messages, PRD test checklist
- [ ] Build real UI for the remaining Stitch designs: Settings Sign-In Methods section
- [ ] Deployment: Vercel project, env vars, Spend Management, Inngest cloud
- [ ] First commit and `main` branch setup
