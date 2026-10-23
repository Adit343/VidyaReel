# Vidyareel: Prototype Plan

Oct 17, 2026 · @adit

The prototype is built in six milestones; an M0 added on 2026-10-18 proves the animation look and narration sync locally, and M1 then proves the Sandbox-to-R2 render chain. Each milestone ends with a demo and a gate you check before starting the next. Durations are left for you to set once M1 shows real render times.

&#91;embedded content: prototype roadmap · 6 milestones\]

| Milestone | Scope | Demo that proves it | Exit gate |
| --- | --- | --- | --- |
| M1 Prove the chain | The five [spike](https://claude.ai/code/artifact/5c78ed30-53bb-4b36-88ef-528bc83a7caa) experiments in a throwaway repo | A hardcoded video rendered in Sandbox, in R2, driven by Inngest, and a test Reel posted | Spike results note says the architecture stands, or the fallback is chosen |
| M2 Foundation | Next.js app, custom auth (email and password signup/login, forgot and reset password, Google sign-in) with `approved_emails`, MongoDB collections and indexes, R2 helpers, Inngest handler, Library page shell | An approved email signs in and sees an empty Library; an unapproved email is refused | Allowlist and ownership checks pass; env vars documented |
| M3 Script and review | Idea suggestions, storyboard from the LLM with schema validation, Review screen with scene editing | Type a topic, get a valid storyboard, edit a scene and save | 10 topics give a valid storyboard; bad output retries once and then fails cleanly |
| M4 Generate | Voice, word timing, sync, the Remotion templates, full `renderVideo`, preview player, fix-scene | Click Generate on a reviewed storyboard and watch a 30 to 90 second video with synced captions | Elements land within about 0.3s of their cue words; a forced failure ends as `failed` and the cap is refunded |
| M5 Post | Instagram connect, post now, schedule, reschedule and cancel, daily token refresh | Connect a test account, schedule a post, see it publish with a permalink | Scheduled post publishes at its time; cancel and reschedule both work |
| M6 Harden | Daily cap, usage log, notifications, admin screens, delete and cleanup, error messages | Team test run: each member makes and posts a video | Failures show a clear message; no orphaned R2 files after cleanup; test checklist from the PRD done |

## M0: local look and sync prototype (built 2026-10-18)

M0 comes before M1 because the biggest risk is whether animation looks good and stays in step with the voice. The code runs on a laptop with no hosting: storyboard JSON, voice, word times, cue-phrase sync, then a Remotion render to a 9:16 MP4.

| Check | Result |
| --- | --- |
| Built | 4 templates (title-hook, bullet-reveal, step-flow, definition-callout), word-by-word captions, 3 storyboards of 25 to 33 seconds; each rendered to 1080 by 1920, 30 fps, H.264 with AAC |
| Sync mechanics | Pass: all 31 cues across the 3 storyboards resolved to frames from word times, and elements, captions and audio share one clock. I checked this from frames; I did not listen to the audio |
| Voice used | An offline placeholder voice (British English, robotic), because ElevenLabs is blocked in the cloud sandbox. ElevenLabs timing accuracy is untested until your key is used |
| Visual quality | Clean and readable, but plain: text-only slides with motion, no illustrations or stock clips yet. It reads as a tidy deck, not yet an engaging explainer |
| Problem found | If a scene's cue word is spoken late, the screen is nearly empty until then (about 3 seconds in the vaccines key-idea scene). Fix: the first element's cue must fall in the first second, or the template shows its label from the start |
| Rule added | Elements must be listed in the order they are spoken; the build fails otherwise |
| Speed | 44 to 56 seconds to render a 25 to 33 second video locally on 4 cores; Vercel Sandbox timing is still M1 |

**Next for M0:** run the same build with your ElevenLabs key and two voice ids, then add illustrations or stock clips to lift the visuals. Files: `/mnt/project-files/vidyareel/prototype/`.
