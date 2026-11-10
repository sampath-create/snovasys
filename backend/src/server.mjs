import { createClient } from 'redis';
import { config } from './config.mjs';
import { prisma } from './db.mjs';
import { createApp, logger } from './app.mjs';

let redisClient = null;
if (config.REDIS_URL) {
  redisClient = createClient({ url: config.REDIS_URL });
  redisClient.on('error', (error) => logger.warn({ errorName: error?.name }, 'redis connection error; rate limiting may use the in-memory fallback'));
  try {
    await redisClient.connect();
    logger.info('redis connected');
  } catch (error) {
    logger.warn({ errorName: error?.name }, 'redis unavailable at startup; using in-memory rate limiting');
    redisClient = null;
  }
}

const app = createApp({ redisClient });
const server = app.listen(config.PORT, '0.0.0.0', () => logger.info({ port: config.PORT, environment: config.NODE_ENV }, 'BalanceVault API listening'));

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'graceful shutdown started');
  server.close(async () => {
    try { await prisma.$disconnect(); } catch (error) { logger.error({ errorName: error?.name }, 'database disconnect failed'); }
    try { if (redisClient?.isOpen) await redisClient.quit(); } catch (error) { logger.error({ errorName: error?.name }, 'redis disconnect failed'); }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
