# Vidyareel: Project Status

Last updated: 2026-10-23 (prompt 5)

Current phase: **0 Setup and foundation** (see [Phases.md](Phases.md)). All code for Phase 0 is written and tested locally; what remains needs your accounts and keys (MongoDB Atlas, Google, Resend, R2).

Current progress, done so far. Updated on every prompt. Remaining work is in [Future-Plans.md](Future-Plans.md).

## Summary

Phase 0 is built end to end: custom auth (password + Google), forgot/reset, invite-only gate, rate limits, admin access management, protected app shell, Stitch-styled auth/Home/Library/Admin screens, R2 storage provider. Verified against an in-memory MongoDB with 33 Vitest tests and a scripted run of the real dev server; `tsc`, `lint` and `next build` pass. Nothing has run against real Atlas, Google, Resend or R2 yet.

## Done

| Area | State |
| --- | --- |
| Design docs (`docs/`) | PRD, System, Technical, API, Database, Pipeline, Prototype, Spike plans, Phases, Implementation-Steps. |
| UI designs | Stitch project "Vidyareel Educator Video Generator" ("Solstice Studio" tokens in `app/globals.css`). |
| Repo | `main` (scaffold commit) and `develop` pushed to origin; work continues on `develop`. |
| Tooling | ESLint (`npm run lint`), Vitest + `mongodb-memory-server` (`npm test`), `npm run db:indexes`, `npm run typecheck`. |
| Config | `src/server/env.ts` Zod loader: missing `MONGODB_URI` / `APP_URL` / `ADMIN_EMAIL` fails with named variables. |
| DB | Mongo client, typed collection helpers (`src/server/db/collections.ts`), indexes incl. `rate_limits` TTL. |
| Auth (verified locally) | scrypt hashing, hashed session cookie, signup/login/logout, forgot/reset (one-time, 30 min, ends sessions), invite-only gate with `ADMIN_EMAIL` bootstrap, `requireUser`/`requireAdmin` (removed member gets 403/401), Google OAuth (state + PKCE, links to existing account by email; tested with mocked Google), per-IP rate limit (11th attempt in a minute gets 429 + `Retry-After`), `GET /api/me`. |
| Admin | `GET/POST /api/admin/approved-emails`, `PATCH/DELETE .../:id`: roles, daily limit, soft remove that deletes sessions, re-invite reactivates, cannot remove/demote self or the `ADMIN_EMAIL` owner. Admin page UI. |
| UI | Route groups: `(auth)` pages (sign-in, sign-up, forgot, reset; signed-in users redirect to `/`; friendly error text; Google `?error=` shown) and `(app)` pages (signed-out go to `/sign-in`): top bar with user menu and Sign out, Home dashboard, empty Library, Admin (admins only). |
| Storage | `createR2Storage()` (S3-compatible put / signedGet / delete) and `storageKey` helpers following System-Design §7.6. Key helper unit-tested; R2 calls not run against a real bucket. |
| Workflows / Remotion | Inngest function stubs, Remotion composition skeleton, provider interfaces (unchanged). |
| API | Auth, `/api/me`, admin approved-emails, health done; the rest return 501. |

## Not yet verified (needs your accounts)

- Real MongoDB Atlas (step 0.5, then rerun `/api/health` and `npm run db:indexes`).
- Real Google sign-in (0.27, then 0.28/0.29 end to end).
- Real reset emails through Resend (0.26); links print to the server log until then.
- Real R2 upload and signed link (0.42, then 0.43).
- Screens were built from the Stitch screenshots but not compared side by side in a browser.
- Videos-used-today on Home and `/api/me` is a placeholder 0 until the usage log (step 2.10).
