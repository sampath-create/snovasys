import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db.mjs';
import { AppError } from '../lib/errors.mjs';
import { ok } from '../lib/http.mjs';
import { passwordHash, passwordMatches, hashRefreshToken } from '../lib/security.mjs';
import { authenticate } from '../middleware/auth.mjs';
import { createSession, clearRefreshCookie, setRefreshCookie, REFRESH_COOKIE, rotateRefreshToken } from '../services/auth.mjs';

const router = Router();
const registerSchema = z.object({ email: z.string().email().max(254), password: z.string().min(12).max(128) });
const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) });

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Provide a valid email and a password of at least 12 characters.', parsed.error.flatten());
  const email = parsed.data.email.trim().toLowerCase();
  const hashed = await passwordHash(parsed.data.password);
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const role = await tx.role.upsert({ where: { name: 'USER' }, create: { name: 'USER' }, update: {} });
      const user = await tx.user.create({ data: { email, passwordHash: hashed, status: 'ACTIVE', roles: { create: { roleId: role.id } } } });
      const session = await createSession(tx, user);
      await tx.auditLog.create({ data: { actorId: user.id, action: 'USER_REGISTERED', entityType: 'User', entityId: user.id, requestId: req.id } });
      return { user, session };
    });
  } catch (error) {
    if (error?.code === 'P2002') throw new AppError(409, 'CONFLICT', 'An account could not be created with those details.');
    throw error;
  }
  setRefreshCookie(res, result.session.refreshToken);
  return ok(res, { accessToken: result.session.accessToken, user: { id: result.user.id, email: result.user.email, roles: ['USER'] } }, 201);
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Provide a valid email and password.', parsed.error.flatten());
  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email }, include: { roles: { include: { role: true } } } });
  const valid = user ? await passwordMatches(parsed.data.password, user.passwordHash) : false;
  if (!valid || user.status !== 'ACTIVE') {
    await prisma.auditLog.create({ data: { actorId: user?.id ?? null, action: 'LOGIN_FAILURE', requestId: req.id, metadata: { emailFingerprint: createHash('sha256').update(email).digest('hex') } } });
    throw new AppError(401, 'AUTHENTICATION_FAILED', 'Email or password is incorrect.');
  }
  const session = await prisma.$transaction(async (tx) => {
    const issued = await createSession(tx, user);
    await tx.auditLog.create({ data: { actorId: user.id, action: 'LOGIN_SUCCESS', requestId: req.id } });
    return issued;
  });
  setRefreshCookie(res, session.refreshToken);
  return ok(res, { accessToken: session.accessToken, user: { id: user.id, email: user.email, roles: user.roles.map(({ role }) => role.name) } });
});

router.post('/refresh', async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE];
  if (!rawToken) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  const session = await rotateRefreshToken(rawToken, req.id);
  setRefreshCookie(res, session.refreshToken);
  return ok(res, { accessToken: session.accessToken, user: session.user });
});

router.post('/logout', async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE];
  if (rawToken) {
    const tokenHash = hashRefreshToken(rawToken);
    const token = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (token && !token.revokedAt) {
      await prisma.$transaction(async (tx) => {
        await tx.refreshToken.updateMany({ where: { id: token.id, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.auditLog.create({ data: { actorId: token.userId, action: 'LOGOUT', entityType: 'RefreshToken', entityId: token.id, requestId: req.id } });
      });
    }
  }
  clearRefreshCookie(res);
  return ok(res, { loggedOut: true });
});

router.get('/me', authenticate, async (req, res) => {
  return ok(res, { user: { id: req.user.id, email: req.user.email, roles: req.user.roles, status: req.user.status } });
});

export default router;
