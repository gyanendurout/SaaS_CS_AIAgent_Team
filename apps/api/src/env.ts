/**
 * Validated, typed environment loader.
 *
 * Throws on startup if any required variable is missing or malformed —
 * fail fast so we never half-boot a server that can't talk to Supabase / Vapi.
 *
 * Read from `process.env` once at import time. Treat `env` as immutable.
 */

import { z } from 'zod';

const EnvSchema = z.object({
  // Runtime
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase (service role)
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z
    .string()
    .min(1, 'SUPABASE_SECRET_KEY is required')
    .refine(
      (k) => k.startsWith('sb_secret_') || k.startsWith('eyJ'),
      'SUPABASE_SECRET_KEY must be a Supabase service-role key (sb_secret_* or legacy JWT eyJ…)',
    ),

  // Vapi
  VAPI_API_KEY: z.string().min(1, 'VAPI_API_KEY is required'),
  VAPI_WEBHOOK_SECRET: z.string().min(1, 'VAPI_WEBHOOK_SECRET is required'),

  // Python AI agents
  PYTHON_AI_URL: z.string().url().default('http://localhost:8000'),

  // Optional public URL for the API (ngrok in dev)
  PUBLIC_BACKEND_URL: z.string().url().optional(),

  // Policy version pinned for audit rows
  POLICY_VERSION: z.string().default('1.0.0'),

  // Comma-separated CORS origin allowlist
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3002'),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    // Print to stderr and exit hard. Fastify hasn't booted yet.
    // eslint-disable-next-line no-console
    console.error(`[env] Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env: Env = loadEnv();

/** Parsed CORS allowlist — split, trim, drop empties. */
export const corsOrigins: string[] = env.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
