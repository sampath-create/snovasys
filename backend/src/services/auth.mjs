import { config } from '../config.mjs';
import { prisma } from '../db.mjs';
import { AppError } from '../lib/errors.mjs';
import { createAccessToken, hashRefreshToken, newRefreshToken } from '../lib/security.mjs';

export const REFRESH_COOKIE = 'bv_refresh';

export function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE,
    path: '/api/auth',
    maxAge: config.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE,
    path: '/api/auth',
  });
}

export async function createSession(tx, user) {
  const rawToken = newRefreshToken();
  const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await tx.refreshToken.create({ data: { userId: user.id, tokenHash: hashRefreshToken(rawToken), expiresAt } });
  return { accessToken: createAccessToken(user), refreshToken: rawToken, expiresAt };
}

export async function rotateRefreshToken(rawToken, requestId) {
  const current = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(rawToken) } });
  if (!current) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  if (current.revokedAt) {
    await prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({ where: { userId: current.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: current.userId, action: 'REFRESH_REUSE_DETECTED', requestId, metadata: { refreshTokenId: current.id } } });
    });
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  }
  if (current.expiresAt <= new Date()) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');

  const rawNext = newRefreshToken();
  const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  const outcome = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: current.userId }, include: { roles: { include: { role: true } } } });
    if (!user || user.status !== 'ACTIVE') throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    const next = await tx.refreshToken.create({ data: { userId: user.id, tokenHash: hashRefreshToken(rawNext), expiresAt } });
    const revoked = await tx.refreshToken.updateMany({ where: { id: current.id, revokedAt: null }, data: { revokedAt: new Date(), replacedById: next.id } });
    if (revoked.count !== 1) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    await tx.auditLog.create({ data: { actorId: user.id, action: 'REFRESH_TOKEN_ROTATED', entityType: 'RefreshToken', entityId: next.id, requestId } });
    return { user, next };
  }, { isolationLevel: 'Serializable' });
  return {
    accessToken: createAccessToken(outcome.user),
    refreshToken: rawNext,
    user: { id: outcome.user.id, email: outcome.user.email, roles: outcome.user.roles.map(({ role }) => role.name) },
  };
}
