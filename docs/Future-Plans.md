# Vidyareel: Future Plans

Last updated: 2026-10-29 (prompt 48: nothing new; prompt 46; open: get script writing and rendering working on Vercel; use the `llm call failed` and Inngest run errors to find what is missing)

Fine-grained numbered steps live in [Implementation-Steps.md](Implementation-Steps.md). Phases 0 to 3 are done and signed off; Phases 4 and 5 are built and wait for your sign-off.

Work is organised in phases: see [Phases.md](Phases.md). Current phase: **6 Hardening and launch**; Phase 5's live connect and first real post worked (2026-10-27). **4 Render workflow and Library** waits for your sign-off. **6 Hardening and team launch** is in progress (steps 6.1 to 6.9 done; 6.10 production deploy and 6.11 team test need you).

What is left to implement. Updated on every prompt; finished items move to [Project-Status.md](Project-Status.md). Milestones follow [Prototype-Plan.md](Prototype-Plan.md).

## Next up

- [ ] **6.10 and 6.11 (needs you):** finish the Vercel setup below, open `/api/health` on the live URL (expect `ok: true`), then do a solo run on the live site: make a video, fix a scene, post it now, schedule one, cancel one, and tick the PRD checklist. Phase 6 is signed off when that passes (the project has one user, so there is no team test)
- [ ] **Vercel production setup (needs you):** (1) in Inngest Cloud, Apps, Sync new app, use `https://vidya-reel1.vercel.app/api/inngest`, then check the app lists the four functions; (2) Vercel env vars: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `APP_URL=https://vidya-reel1.vercel.app`, `MONGODB_URI`, `ADMIN_EMAIL`, `R2_*`, `GEMINI_API_KEY`, `ELEVENLABS_*`, `PIXABAY_API_KEY`, `GOOGLE_*`, `META_*`, `IG_TOKEN_KEY`, `RESEND_*`; (3) redeploy after changing them; (4) Mongo Atlas network access must allow Vercel (0.0.0.0/0 on the free tier)
- [ ] Run `npm run remotion:bundle` so new renders use the caption fix (older videos keep the cut-off captions; make a new video or duplicate one to re-render)
- [ ] Phase 5 sign-off: the live connect and a real post already worked (2026-10-27, through ngrok); still to try on the real account: schedule a post a few minutes ahead, reschedule, cancel, retry, reconnect, disconnect. Each real post goes to your real Instagram account
- [ ] Going live for other educators (outside the Meta app's roles) needs Meta app review, a privacy policy URL and business verification; the Terms and Privacy pages are not built yet
- [ ] Run `npm run db:indexes` once against Atlas (new `notifications` collection and its indexes)
- [ ] After the next deploy, sync the Inngest app again so it lists the new weekly `export-backup` and `alert-on-failure` functions (six functions in all); check the first Sunday export appears under `backups/` in R2
- [ ] Optional: a Content-Security-Policy header (left out because Next inline scripts, the Remotion player and Google fonts need a nonce set-up)
- [ ] Settings: the "Sign-In Methods" section (separate Stitch screen)
- [ ] Re-run `npm run check:storyboards` now and then (it uses free Gemini quota; the daily quota resets at 12:30 PM IST until 1 Nov, then 1:30 PM IST)
- [ ] Add Pexels as a second media source if its API keys open again
- [ ] Phase 4 sign-off: try Create, Review, Generate (rendering, ready, download, Fix a scene, Cancel) in the browser with your own account; each real render uses ElevenLabs credits (about 1 credit per narration character)
- [ ] Local render runs need a fresh Vercel token each day (`npx vercel env pull .env.vercel.local`, copy `VERCEL_OIDC_TOKEN` into `.env.local`), `npm run remotion:bundle` after template changes, and `npm run dev` plus `npm run inngest:dev` (with `INNGEST_DEV=1`)
- [ ] Run `npm run check:storyboards` against the real model to confirm the wider template list still gives valid storyboards (10 of 10)
- [ ] Review polish: show the stock clip's first frame in a stock-clip scene preview (needs the clip search to run before render)
- [ ] Monthly voice-credit check at `POST /api/videos` (`VOICE_CREDITS_LOW`, step 6.2)
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
- [ ] Show render percentage from `render_jobs` on Library cards (done for rendering cards; check other lists)
- [ ] Optional: email verification for password signups (Stitch has "Check your email", "Email not verified" and verification states ready to build)


## Later milestones



- [ ] M1 spike: Remotion in Vercel Sandbox, R2 upload, Inngest `renderVideo`, ElevenLabs sync, Instagram test post
- [ ] M6 Harden: daily cap, usage log, notifications, admin usage screens, delete + cleanup, error messages, PRD test checklist
- [ ] Build real UI for the remaining Stitch designs: Settings Sign-In Methods section
- [ ] Deployment: Vercel project, env vars, Spend Management, Inngest cloud
- [ ] First commit and `main` branch setup
