import { Inngest } from 'inngest';

// While developing, events go to the local Inngest dev server (`npm run inngest:dev`), because Inngest Cloud cannot
// reach localhost; the event and signing keys in .env.local are only used in production.
export const inngest = new Inngest({ id: 'vidyareel', isDev: process.env.NODE_ENV !== 'production' });
