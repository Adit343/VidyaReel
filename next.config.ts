import type { NextConfig } from 'next';

// Headers every response carries. A full Content-Security-Policy is left out on purpose: Next's inline scripts, the
// Remotion player and the Google font and icon sheets would need a nonce set-up that is not worth breaking the app for.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const config: NextConfig = {
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer', '@remotion/vercel', '@vercel/sandbox'],
  // The render step uploads the pre-built Remotion bundle (`npm run build` makes it) to the Sandbox, so the files
  // must travel with the function that Inngest calls.
  outputFileTracingIncludes: { '/api/inngest': ['./build/remotion-bundle/**/*'] },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;
