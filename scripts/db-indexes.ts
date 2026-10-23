import { loadEnvConfig } from '@next/env';
import { getClient } from '../src/server/db/client';
import { ensureIndexes } from '../src/server/db/indexes';

loadEnvConfig(process.cwd());
ensureIndexes()
  .then(() => console.log('Indexes ensured.'))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => getClient().close());
