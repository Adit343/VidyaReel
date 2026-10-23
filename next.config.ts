import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer'],
};

export default config;
