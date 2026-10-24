# Vidyareel: Project Status

Last updated: 2026-10-24 (prompt 7)

Current phase: **0 Setup and foundation** (see [Phases.md](Phases.md)). All code for Phase 0 is written and tested locally; what remains needs your accounts and keys (MongoDB Atlas, Google, Resend, R2).

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
| Workflows / Remotion | Inngest function stubs, Remotion composition skeleton, provider interfaces (unchanged). |
| API | Auth, `/api/me`, admin approved-emails, health done; the rest return 501. |

## Verified against real services (2026-10-24)

- Atlas: `npm run db:indexes` ok, `/api/health` returns ok, unapproved signup refused with 403 `INVITE_ONLY`, wrong login 401, forgot-password 200.
- R2: `scripts/r2-smoke.ts` uploaded a file, signed link returned the content (200), unsigned URL refused (400), deleted object gives 404.
- Google: `/api/auth/google` redirects to Google consent with the right redirect URI, state and PKCE. The consent screen itself still needs a human in a browser.

## Not yet verified

- Resend: `EMAIL_FROM` is a gmail.com address, which Resend rejects (403 "domain not verified"). Use `onboarding@resend.dev` (delivers only to the Resend account owner) or a verified domain.
- Browser walk-through with the existing admin account: password sign-in, Google sign-in, admin add/remove from the UI. The admin account already existed in Atlas, so scripted signup/login with a fresh password could not be repeated.
- `forgot-password` returns 200 even when the email send fails, with nothing in the log (to be checked).
- Screens were built from the Stitch screenshots but not compared side by side in a browser.
- Videos-used-today on Home and `/api/me` is a placeholder 0 until the usage log (step 2.10).
