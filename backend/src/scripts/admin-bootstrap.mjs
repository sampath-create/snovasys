import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
dotenv.config({ path: process.env.ENV_FILE || rootEnv });
dotenv.config();
import { z } from 'zod';

const env = z.object({
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12),
  BOOTSTRAP_ADMIN_TOKEN: z.string().min(32),
}).safeParse(process.env);

if (!env.success) {
  console.error('Bootstrap configuration is incomplete. Set API_BASE_URL and all BOOTSTRAP_ADMIN_* variables.');
  process.exit(1);
}

try {
  const response = await fetch(`${env.data.API_BASE_URL.replace(/\/$/, '')}/api/admin/bootstrap`, {
    method: 'POST',
    headers: { 'x-bootstrap-token': env.data.BOOTSTRAP_ADMIN_TOKEN, 'content-type': 'application/json' },
    body: '{}',
  });
  const payload = await response.json().catch(() => null);
  if (response.status === 201 && payload?.success) {
    console.log('Initial administrator created successfully.');
    process.exit(0);
  }
  if (response.status === 409) {
    console.log('Bootstrap already completed; no duplicate administrator was created.');
    process.exit(0);
  }
  console.error(`Bootstrap failed (${response.status}): ${payload?.error?.message || 'Unexpected response.'}`);
  process.exit(1);
} catch (error) {
  console.error(`Bootstrap request failed: ${error?.name || 'NetworkError'}. Check API_BASE_URL and server availability.`);
  process.exit(1);
}
