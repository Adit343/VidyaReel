# Vidyareel: Project Status

Last updated: 2026-10-24 (prompt 11)

Current phase: **1 Pipeline spike** (see [Phases.md](Phases.md) and [Phase-1-Spike-Plan.md](Phase-1-Spike-Plan.md)). Phase 0 is complete and verified against real Atlas, Google, Resend and R2; Phase 1 has started: local Remotion work (1.1 to 1.3) and the Vercel Sandbox render to R2 (1.4 to 1.6) are done; see [Phase-1-Spike-Results.md](Phase-1-Spike-Results.md).

Current progress, done so far. Updated on every prompt. Remaining work is in [Future-Plans.md](Future-Plans.md).

## Summary

Phase 0 is built end to end: custom auth (password + Google), forgot/reset, invite-only gate, rate limits, admin access management, protected app shell, Stitch-styled auth/Home/Library/Admin screens, R2 storage provider. Verified against an in-memory MongoDB with 35 Vitest tests and a scripted run of the real dev server; `tsc`, `lint` and `next build` pass. Now also verified against real Atlas and R2; Google redirect confirmed; Resend blocked by the sender address (see below).

## Done

| Area | State |
| --- | --- |
| Design docs (`docs/`) | PRD, System, Technical, API, Database, Pipeline, Prototype, Spike plans, Phases, Implementation-Steps. |
| UI designs | Stitch project "Vidyareel Educator Video Generator" ("Solstice Studio" tokens in `app/globals.css`). |
| Repo | `main` (scaffold commit) and `develop` pushed to origin; work continues on `develop`. |
| Tooling | ESLint (`npm run lint`), Vitest + `mongodb-memory-server` (`npm test`), `npm run db:indexes`, `npm run typecheck`. |
| Config | `src/server/env.ts` Zod loader: missing `MONGODB_URI` / `APP_URL` / `ADMIN_EMAIL` fails with named variables. |
| DB | Mongo client, typed collection helpers (`src/server/db/collections.ts`), indexes incl. `rate_limits` TTL. |
| Auth (verified locally) | scrypt hashing, hashed session cookie, signup/login/logout, forgot/reset (one-time, 60 min, ends sessions), invite-only gate with `ADMIN_EMAIL` bootstrap, `requireUser`/`requireAdmin` (removed member gets 403/401), Google OAuth (state + PKCE, links to existing account by email; tested with mocked Google), per-IP rate limit (11th attempt in a minute gets 429 + `Retry-After`), `GET /api/me`. |
| Admin | `GET/POST /api/admin/approved-emails`, `PATCH/DELETE .../:id`: roles, daily limit, soft remove that deletes sessions, re-invite reactivates, cannot remove/demote self or the `ADMIN_EMAIL` owner. Admin page UI. |
| Auth screens (match Stitch) | Rebuilt from the Stitch HTML of Log In, Sign-Up, Forgot Password and Reset Password with Tailwind (tokens in `tailwind.config.ts`) and the exact art panels; every interactive state is implemented and was screenshot-checked in headless Chrome: Log In (default, focus, loading, wrong credentials, suspended, rate limited with countdown, returning from reset, Google cancelled); Sign-Up (focus "editing" tag, weak, common, contains-email, strong meter, loading, rate-limit banner with Dismiss, closed/invite-only banner); Forgot (default, focus, loading, invalid email, "Check your email" with resend countdown, rate limited); Reset (default, focus, weak, common, contains email, mismatch, loading, success, expired/used, rate limited). Password rules (min 10, common, contains email) shared by UI and server (`src/lib/password-rules.ts`). Reset links now last one hour (as in the design); "Keep me signed in" sets a persistent cookie. Not implemented: "Email not verified" / "Check your email" verification screens (no email verification yet) and compliance badges from the mock (FERPA/SOC 2) which we cannot claim. |
| UI | Route groups: `(auth)` pages (sign-in, sign-up, forgot, reset; signed-in users redirect to `/`; friendly error text; Google `?error=` shown) and `(app)` pages (signed-out go to `/sign-in`): top bar with user menu and Sign out, Home dashboard, empty Library, Admin (admins only). |
| Storage | `createR2Storage()` (S3-compatible put / signedGet / delete) and `storageKey` helpers following System-Design §7.6. Key helper unit-tested; R2 calls not run against a real bucket. |
| Workflows | Inngest function stubs, provider interfaces (unchanged). |
| Sandbox render (Phase 1, steps 1.4 to 1.6) | `npm run spike:sandbox` bundles the project, renders the fixture in a Vercel Sandbox with `@remotion/vercel`, reads the MP4 out and uploads it to R2: PASS, 77 s cold total (sandbox create 45 s, render 20 s), 351 kB, signed link serves `video/mp4`. Vercel linked to project `portfolio-82d6/vidyareel`; the short-lived OIDC token lives in git-ignored `.env.vercel.local` (and `.env.local`). Script is ESM (`.mts`) because `@remotion/vercel` is ESM-only. Keys now set: Gemini, ElevenLabs (+ voice ids), Inngest. |
| Remotion (Phase 1, steps 1.1 to 1.3) | Hard-coded 3-scene fixture `src/remotion/fixtures/spike-3-scenes.json` (validated by the storyboard zod schema). Templates `title-hook`, `bullet-reveal`, `definition-callout` in `src/remotion/templates/`; elements spring in at their `startMs` cue time (falling back to an even spread), and the bullet scene shows its title from frame 0 so it is never empty. Design fonts (Bricolage Grotesque, Hanken Grotesk) load via `@remotion/google-fonts`. `remotion.config.ts` maps `@/` for the bundler. Local render works: `npm run remotion:render` makes a 16 s, 1080x1920, 30 fps MP4 (553 kB) in about 32 s on this laptop (output in git-ignored `out/`); Studio via `npm run remotion:studio`. Stills of each scene checked by eye. Remotion CLI pinned to 4.0.538, matching `remotion`. Narration audio and captions are not in these templates yet (Phase 1 experiment 4, Phase 3). |
| API | Auth, `/api/me`, admin approved-emails, health done; the rest return 501. |

## Verified against real services (2026-10-24)

- Atlas: `npm run db:indexes` ok, `/api/health` returns ok, unapproved signup refused with 403 `INVITE_ONLY`, wrong login 401, forgot-password 200.
- R2: `scripts/r2-smoke.ts` uploaded a file, signed link returned the content (200), unsigned URL refused (400), deleted object gives 404.
- Google: `/api/auth/google` redirects to Google consent with the right redirect URI, state and PKCE. The consent screen itself still needs a human in a browser.

- Database isolation: the first `MONGODB_URI` had no database name, so the driver used `test`, which holds another project's data on the same cluster. Vidyareel now uses its own `vidyareel` database (name in the URI, and `db()` falls back to `vidyareel`, never `test`). Re-verified there: signup, login, `/api/me`, admin add, member signup, removal (member's session ends, relogin 403).
- Leftovers from the first run in `test` (not Vidyareel's database): empty collections `approved_emails`, `videos`, `render_jobs`, `posts`, `usage_log`, `rate_limits`, `oauth_states`, `password_resets` (a few rows) and indexes `email_1`, `googleId_1` on `users`. No existing documents were changed. Cleanup awaits the owner's go-ahead.
- Google sign-in shows `redirect_uri_mismatch`: `http://localhost:3000/api/auth/google/callback` must be added to Authorized redirect URIs of the OAuth client in Google Cloud.

## Phase 0 sign-off (2026-10-24)

You confirmed the real reset email arrives and the link works, and Google sign-in as `shahadit68@gmail.com` lands on Home as admin. Together with the checks above this meets the Phase 0 gate.

## Not yet verified

- Resend: `EMAIL_FROM` is now `onboarding@resend.dev`; Resend accepted a direct send and a forgot-password request (200). Waiting for you to confirm the reset email arrived and the link works end to end. It delivers only to the Resend account owner's address, so other members' resets need a verified domain.
- Browser walk-through with the existing admin account: password sign-in, Google sign-in, admin add/remove from the UI. The admin account already existed in Atlas, so scripted signup/login with a fresh password could not be repeated.
- `forgot-password` returns 200 even when the email send fails, with nothing in the log (to be checked).
- Screens were built from the Stitch screenshots but not compared side by side in a browser.
- Videos-used-today on Home and `/api/me` is a placeholder 0 until the usage log (step 2.10).
