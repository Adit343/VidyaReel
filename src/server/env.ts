import { z } from 'zod';

const optional = z.string().optional().transform((v) => (v ? v : undefined));

const schema = z.object({
  MONGODB_URI: z.string().min(1),
  APP_URL: z.string().url(),
  ADMIN_EMAIL: z.string().email(),
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,
  R2_ACCOUNT_ID: optional,
  R2_ACCESS_KEY_ID: optional,
  R2_SECRET_ACCESS_KEY: optional,
  R2_BUCKET: optional,
  PIXABAY_API_KEY: optional,
});

export type Env = z.infer<typeof schema>;

/** Validates the variables the app cannot run without; names every missing or invalid one. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const bad = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid environment: ${bad}. See .env.example.`);
  }
  return parsed.data;
}

let cached: Env | undefined;
export function env(): Env {
  return (cached ??= parseEnv(process.env));
}
