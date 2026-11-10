import { verifyAccessToken } from '../lib/security.mjs';
import { AppError } from '../lib/errors.mjs';
import { hasRole } from '../lib/authz.mjs';
import { prisma } from '../db.mjs';

export async function authenticate(req, res, next) {
  try {
    const [scheme, token] = (req.get('authorization') || '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    let claims;
    try { claims = verifyAccessToken(token); } catch { throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'); }
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, email: true, status: true, roles: { select: { role: { select: { name: true } } } } },
    });
    if (!user || user.status !== 'ACTIVE') throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    req.user = { id: user.id, email: user.email, status: user.status, roles: user.roles.map(({ role }) => role.name) };
    next();
  } catch (error) { next(error); }
}

export function requireAdmin(req, res, next) {
  if (!hasRole(req.user, 'ADMIN')) return next(new AppError(403, 'FORBIDDEN', 'Administrator access is required.'));
  return next();
}

export function requireAccountOwner(userIdField = 'userId') {
  return (req, res, next) => {
    if (req.user?.id !== req.params[userIdField]) return next(new AppError(404, 'NOT_FOUND', 'Resource not found.'));
    next();
  };
}
