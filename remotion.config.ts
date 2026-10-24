import path from 'node:path';
import { Config } from '@remotion/cli/config';

// Let the Remotion bundler resolve the same `@/` alias as tsconfig.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: { ...config.resolve, alias: { ...(config.resolve?.alias ?? {}), '@': path.resolve(process.cwd(), 'src') } },
}));
