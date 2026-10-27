import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer', '@remotion/vercel', '@vercel/sandbox'],
  // The render step uploads the pre-built Remotion bundle (`npm run build` makes it) to the Sandbox, so the files
  // must travel with the function that Inngest calls.
  outputFileTracingIncludes: { '/api/inngest': ['./build/remotion-bundle/**/*'] },
};

export default config;
