import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import pino from 'pino';
import { config } from './config.mjs';
import { errorHandler } from './lib/errors.mjs';
import { prisma } from './db.mjs';
import authRoutes from './routes/auth.mjs';
import onboardingRoutes from './routes/onboarding.mjs';
import accountRoutes from './routes/accounts.mjs';
import ledgerRoutes from './routes/ledger.mjs';
import transferRoutes from './routes/transfers.mjs';
import adminRoutes from './routes/admin.mjs';
import { createOpsRouter } from './routes/ops.mjs';

const logger = pino({ level: process.env.LOG_LEVEL || (config.NODE_ENV === 'development' ? 'debug' : 'info') });

export function createApp({ redisClient = null } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Prisma BigInt values (minor currency units) are serialized as decimal strings.
  app.set('json replacer', (_key, value) => typeof value === 'bigint' ? value.toString() : value);
  app.set('trust proxy', config.NODE_ENV === 'production' ? 1 : false);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.WEB_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PATCH', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'X-Bootstrap-Token', 'X-Request-Id'] }));
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    const supplied = req.get('x-request-id');
    req.id = supplied && /^[a-zA-Z0-9._-]{8,100}$/.test(supplied) ? supplied : crypto.randomUUID();
    req.log = logger;
    res.setHeader('x-request-id', req.id);
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      logger.info({ requestId: req.id, method: req.method, path: req.path, statusCode: res.statusCode, durationMs: Math.round(durationMs * 100) / 100 }, 'http request');
    });
    next();
  });

  const createStore = (name) => redisClient ? new RedisStore({ prefix: `bv_rl:${name}:`, sendCommand: (...args) => redisClient.sendCommand(args) }) : undefined;
  const commonLimiter = {
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    passOnStoreError: true,
    handler: (req, res) => res.status(429).json({ success: false, data: null, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please retry later.', details: null } }),
  };
  const makeLimiter = (name, limit) => {
    const store = createStore(name);
    return rateLimit({ ...commonLimiter, limit, ...(store ? { store } : {}) });
  };
  app.use('/api', makeLimiter('api', 120));
  app.use('/api/auth/login', makeLimiter('login', 8));
  app.use('/api/auth/register', makeLimiter('register', 5));
  app.use('/api/auth/refresh', makeLimiter('refresh', 20));
  app.use('/api/admin/bootstrap', makeLimiter('bootstrap', 5));

  app.use(createOpsRouter(redisClient));
  app.use('/api/auth', authRoutes);
  app.use('/api/onboarding', onboardingRoutes);
  app.use('/api/accounts', accountRoutes);
  app.use('/api/ledger', ledgerRoutes);
  app.use('/api/transfers', transferRoutes);
  app.use('/api/admin', adminRoutes);
  app.use((req, res) => res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Route not found.', details: null } }));
  app.use(errorHandler);
  return app;
}

export { logger };
