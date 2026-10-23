# Vidyareel: Project Status

Last updated: 2026-10-23 (prompt 4)

Current phase: **0 Setup and foundation** (see [Phases.md](Phases.md)).

Current progress, done so far. Updated on every prompt. Remaining work is in [Future-Plans.md](Future-Plans.md).

## Summary

Docs written; Next.js scaffold on branch `develop` with custom auth implemented in code. No external service is connected yet, and nothing has been run against a real database.

## Done

| Area | State |
| --- | --- |
| Design docs (`docs/`) | PRD, System, Technical, API, Database, Pipeline, Prototype and Spike plans exist. Auth sections updated from Better Auth to custom auth (email + password, forgot/reset password, Google). |
| UI designs | Stitch project "Vidyareel Educator Video Generator" (9 desktop screens, mobile Home, "Solstice Studio" design system). Tokens copied to `app/globals.css`. |
| Step plan | `docs/Implementation-Steps.md` breaks phases 0–6 into numbered small steps with checks (Phase 0: 45 steps). Code for steps 0.1, 0.7, 0.13–0.20, 0.23–0.25, 0.28–0.29, 0.31 exists but is unverified. |
| Phase plan | `docs/Phases.md` divides the work into phases 0–6, each with a goal and gate. |
| Repo | Branch `develop` created. Nothing committed yet (`main` has no commits). |
| Scaffold | Next.js App Router + TypeScript, folder layout from System-Design §2, `.env.example`, README. `npm install` and `tsc --noEmit` pass. |
| Pages | Placeholder pages for home, create, review, generate, post, library, settings, admin. |
| Auth (implemented, untested) | scrypt password hashing, hashed session tokens + HttpOnly cookie, signup, login, logout, forgot/reset password with emailed one-time link (Resend adapter, logs to console without a key), Google sign-in (OAuth code + PKCE + state), approved-email gate on all three paths, `requireUser()`/`requireAdmin()`. Pages: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`. |
| DB | Mongo client and index definitions for users, sessions, password_resets, approved_emails, videos, render_jobs, posts, usage_log, oauth_states. |
| Workflows / Remotion | Inngest function stubs (`renderVideo`, `publishInstagram`, 2 daily schedules); Remotion root + composition skeleton; provider interfaces. |
| API | `/api/inngest`, `/api/health`, auth routes done; all other routes return 501. |

## Not yet verified

- Auth flows have not run against MongoDB or Google; `next dev`/`next build` not run.
- Index creation (`ensureIndexes`) is not called from anywhere yet.
- No rate limiting on auth routes yet (specified in API-Design §5.1).
