import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url));
dotenv.config({ path: process.env.ENV_FILE || rootEnv });
dotenv.config();
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('10m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().max(30).default(7),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).optional(),
  BOOTSTRAP_ADMIN_TOKEN: z.string().min(32).optional(),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  COOKIE_SECURE: z.string().default('false'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  REDIS_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const safeIssues = parsed.error.issues.map(({ path, message }) => `${path.join('.')}: ${message}`);
  throw new Error(`Invalid environment configuration: ${safeIssues.join('; ')}`);
}

export const config = {
  ...parsed.data,
  WEB_ORIGIN: parsed.data.WEB_ORIGIN.replace(/\/+$/, ''),
  COOKIE_SECURE: parsed.data.COOKIE_SECURE === 'true' || parsed.data.NODE_ENV === 'production' || parsed.data.COOKIE_SAME_SITE === 'none',
};
