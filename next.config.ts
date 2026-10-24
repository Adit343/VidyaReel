import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer', '@remotion/vercel', '@vercel/sandbox'],
};

export default config;
