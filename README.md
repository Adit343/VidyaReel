# Vidyareel

Educator video generator: topic → storyboard → voiced, animated 9:16 video → Instagram.
Design docs live in [docs/](docs/); UI designs are in the Stitch project "Vidyareel Educator Video Generator".

## Stack
Next.js (App Router, TS) · Custom auth (email+password, Google) · MongoDB Atlas · Cloudflare R2 · Inngest · Remotion on Vercel Sandbox.

## Getting started
```
cp .env.example .env.local
npm install
npm run dev            # app
npm run inngest:dev    # workflow dev server
npm run remotion:studio
```

## Layout
See docs/System-Design.md §2. Routes in `app/`, server logic in `src/server`, Inngest functions in `src/workflows`, Remotion in `src/remotion`, shared zod schemas in `src/lib/schemas`.
