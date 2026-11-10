import { Router } from 'express';
import { prisma } from '../db.mjs';

export function createOpsRouter(redisClient) {
  const router = Router();
  router.get('/healthz', (req, res) => res.status(200).json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() }, error: null }));
  router.get('/readyz', async (req, res) => {
    const checks = { database: false, migrations: false, redis: false };
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
      const unfinished = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL`;
      checks.migrations = unfinished[0].count === 0;
    } catch (error) {
      req.log?.warn({ requestId: req.id, component: 'database', errorName: error?.name }, 'readiness check failed');
    }
    try {
      if (redisClient?.isReady) checks.redis = (await redisClient.ping()) === 'PONG';
    } catch (error) {
      req.log?.warn({ requestId: req.id, component: 'redis', errorName: error?.name }, 'readiness check failed');
    }
    const ready = Object.values(checks).every(Boolean);
    return res.status(ready ? 200 : 503).json({ success: ready, data: { status: ready ? 'ready' : 'not_ready', checks }, error: ready ? null : { code: 'NOT_READY', message: 'One or more dependencies are unavailable.', details: checks } });
  });
  return router;
}
