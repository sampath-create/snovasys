import dotenv from 'dotenv';
import { spawnSync } from 'node:child_process';

dotenv.config({ path: process.env.ENV_FILE || '../.env' });
dotenv.config();
const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node src/scripts/prisma.mjs <prisma arguments>');
  process.exit(2);
}
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['prisma', ...args], { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
