import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db.mjs';
import { config } from '../config.mjs';
import { AppError } from '../lib/errors.mjs';
import { ok } from '../lib/http.mjs';
import { passwordHash, safeTokenEquals } from '../lib/security.mjs';
import { authenticate, requireAdmin } from '../middleware/auth.mjs';
import { getLedgerIntegrity } from '../services/ledger.mjs';

const router = Router();

router.post('/bootstrap', async (req, res) => {
  const adminExists = await prisma.userRole.findFirst({ where: { role: { name: 'ADMIN' } }, select: { userId: true } });
  if (adminExists) throw new AppError(409, 'CONFLICT', 'The initial administrator has already been created.');
  if (!config.BOOTSTRAP_ADMIN_EMAIL || !config.BOOTSTRAP_ADMIN_PASSWORD || !config.BOOTSTRAP_ADMIN_TOKEN) {
    throw new AppError(503, 'BOOTSTRAP_NOT_CONFIGURED', 'Administrator bootstrap is not configured on this deployment.');
  }
  const supplied = req.get('x-bootstrap-token');
  if (!safeTokenEquals(supplied, config.BOOTSTRAP_ADMIN_TOKEN)) {
    await prisma.auditLog.create({ data: { action: 'ADMIN_BOOTSTRAP_FAILURE', requestId: req.id, metadata: { reason: 'INVALID_TOKEN' } } });
    throw new AppError(403, 'FORBIDDEN', 'The bootstrap token is invalid.');
  }

  const hashed = await passwordHash(config.BOOTSTRAP_ADMIN_PASSWORD);
  try {
    const result = await prisma.$queryRaw`SELECT public.balancevault_bootstrap_admin(${config.BOOTSTRAP_ADMIN_EMAIL.toLowerCase()}, ${hashed}) AS "userId"`;
    return ok(res, { userId: result[0].userId, bootstrapped: true }, 201);
  } catch (error) {
    const code = error?.meta?.code || error?.code;
    const message = String(error?.message || '');
    if (message.includes('ADMIN_ALREADY_EXISTS')) throw new AppError(409, 'CONFLICT', 'The initial administrator has already been created.');
    if (code === '42501' || message.includes('permission denied')) {
      throw new AppError(503, 'BOOTSTRAP_DATABASE_PERMISSION_MISSING', 'The database runtime role cannot execute the restricted bootstrap function. Apply deployment/grant-app-bootstrap.sql using a database owner.');
    }
    throw error;
  }
});

router.use(authenticate, requireAdmin);

router.get('/summary', async (req, res) => {
  const [totalUsers, pendingOnboarding, recentAudit, integrity] = await Promise.all([
    prisma.user.count(),
    prisma.onboardingApplication.count({ where: { state: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.auditLog.findMany({ take: 8, orderBy: { createdAt: 'desc' }, select: { id: true, action: true, entityType: true, entityId: true, createdAt: true } }),
    getLedgerIntegrity(),
  ]);
  return ok(res, { totalUsers, pendingOnboarding, recentAudit, ledgerIntegrity: integrity });
});

router.get('/users', async (req, res) => {
  const page = z.coerce.number().int().min(1).catch(1).parse(req.query.page);
  const pageSize = z.coerce.number().int().min(1).max(100).catch(25).parse(req.query.pageSize);
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const status = ['ACTIVE', 'SUSPENDED'].includes(req.query.status) ? req.query.status : undefined;
  const where = {
    ...(status ? { status } : {}),
    ...(search ? { email: { contains: search, mode: 'insensitive' } } : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, select: { id: true, email: true, status: true, createdAt: true, roles: { select: { role: { select: { name: true } } } }, accounts: { select: { id: true, accountNumber: true, status: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.user.count({ where }),
  ]);
  return ok(res, { users: users.map(({ roles, ...user }) => ({ ...user, roles: roles.map(({ role }) => role.name) })), page, pageSize, total });
});

router.patch('/users/:id/status', async (req, res) => {
  const parsed = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }).safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Status must be ACTIVE or SUSPENDED.', parsed.error.flatten());
  if (req.params.id === req.user.id && parsed.data.status === 'SUSPENDED') throw new AppError(409, 'CONFLICT', 'You cannot suspend your own administrator account.');
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, include: { roles: { include: { role: true } } } });
  if (!target) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  if (parsed.data.status === 'SUSPENDED' && target.roles.some(({ role }) => role.name === 'ADMIN')) {
    const adminCount = await prisma.userRole.count({ where: { role: { name: 'ADMIN' }, user: { status: 'ACTIVE' } } });
    if (adminCount <= 1) throw new AppError(409, 'CONFLICT', 'The last active administrator cannot be suspended.');
  }
  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: target.id }, data: { status: parsed.data.status }, select: { id: true, email: true, status: true } });
    await tx.auditLog.create({ data: { actorId: req.user.id, action: 'USER_STATUS_CHANGED', entityType: 'User', entityId: target.id, requestId: req.id, metadata: { previousStatus: target.status, status: parsed.data.status } } });
    return user;
  });
  return ok(res, { user: updated });
});

router.patch('/users/:id/roles', async (req, res) => {
  const parsed = z.object({ roles: z.array(z.enum(['USER', 'ADMIN'])).min(1).max(2) }).safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Roles must contain USER and optionally ADMIN.', parsed.error.flatten());
  const desired = [...new Set(parsed.data.roles)];
  if (!desired.includes('USER')) throw new AppError(400, 'VALIDATION_ERROR', 'Every account must retain the USER role.');
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, include: { roles: { include: { role: true } } } });
  if (!target) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  const previous = target.roles.map(({ role }) => role.name);
  if (previous.includes('ADMIN') && !desired.includes('ADMIN')) {
    const adminCount = await prisma.userRole.count({ where: { role: { name: 'ADMIN' }, user: { status: 'ACTIVE' } } });
    if (target.status === 'ACTIVE' && adminCount <= 1) throw new AppError(409, 'CONFLICT', 'The last active administrator cannot be demoted.');
  }
  const user = await prisma.$transaction(async (tx) => {
    const roleRows = await tx.role.findMany({ where: { name: { in: desired } } });
    const desiredIds = roleRows.map((role) => role.id);
    await tx.userRole.deleteMany({ where: { userId: target.id, roleId: { notIn: desiredIds } } });
    for (const role of roleRows) await tx.userRole.upsert({ where: { userId_roleId: { userId: target.id, roleId: role.id } }, create: { userId: target.id, roleId: role.id }, update: {} });
    await tx.auditLog.create({ data: { actorId: req.user.id, action: 'USER_ROLES_CHANGED', entityType: 'User', entityId: target.id, requestId: req.id, metadata: { previous, roles: desired } } });
    return tx.user.findUnique({ where: { id: target.id }, select: { id: true, email: true, roles: { select: { role: { select: { name: true } } } } } });
  });
  return ok(res, { user: { ...user, roles: user.roles.map(({ role }) => role.name) } });
});

router.get('/onboarding', async (req, res) => {
  const page = z.coerce.number().int().min(1).catch(1).parse(req.query.page);
  const pageSize = z.coerce.number().int().min(1).max(100).catch(25).parse(req.query.pageSize);
  const state = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DRAFT'].includes(req.query.state) ? req.query.state : undefined;
  const where = state ? { state } : {};
  const [applications, total] = await Promise.all([
    prisma.onboardingApplication.findMany({ where, include: { user: { select: { id: true, email: true } }, reviewedBy: { select: { id: true, email: true } } }, orderBy: { submittedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.onboardingApplication.count({ where }),
  ]);
  return ok(res, { applications, page, pageSize, total });
});

router.patch('/onboarding/:id', async (req, res) => {
  const parsed = z.object({ status: z.enum(['UNDER_REVIEW', 'APPROVED', 'REJECTED']), reason: z.string().trim().max(500).optional() }).safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Provide a supported review status and optional reason.', parsed.error.flatten());
  if (parsed.data.status === 'REJECTED' && !parsed.data.reason) throw new AppError(400, 'VALIDATION_ERROR', 'A rejection reason is required.');
  const application = await prisma.onboardingApplication.findUnique({ where: { id: req.params.id } });
  if (!application) throw new AppError(404, 'NOT_FOUND', 'Onboarding application not found.');
  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(application.state)) throw new AppError(409, 'CONFLICT', 'This application has already been decided.');

  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.onboardingApplication.updateMany({
      where: { id: application.id, state: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      data: {
        state: parsed.data.status,
        reviewReason: parsed.data.status === 'REJECTED' ? parsed.data.reason : null,
        reviewedById: req.user.id,
        reviewedAt: parsed.data.status === 'UNDER_REVIEW' ? null : new Date(),
      },
    });
    if (changed.count !== 1) throw new AppError(409, 'CONFLICT', 'This application has already been decided.');
    const result = await tx.onboardingApplication.findUnique({ where: { id: application.id } });
    if (parsed.data.status === 'APPROVED') {
      const existingAccount = await tx.account.findFirst({ where: { userId: application.userId, type: 'USER' } });
      if (!existingAccount) {
        await tx.account.create({ data: { userId: application.userId, type: 'USER', status: 'ACTIVE', accountNumber: `BV-${randomUUID().replaceAll('-', '').slice(0, 14).toUpperCase()}` } });
      } else {
        await tx.account.update({ where: { id: existingAccount.id }, data: { status: 'ACTIVE' } });
      }
    }
    await tx.auditLog.create({ data: { actorId: req.user.id, action: parsed.data.status === 'APPROVED' ? 'ONBOARDING_APPROVED' : parsed.data.status === 'REJECTED' ? 'ONBOARDING_REJECTED' : 'ONBOARDING_REVIEW_STARTED', entityType: 'OnboardingApplication', entityId: application.id, requestId: req.id, metadata: { fromState: application.state, toState: parsed.data.status, reason: parsed.data.reason || null } } });
    return result;
  });
  return ok(res, { application: updated });
});

router.get('/audit-logs', async (req, res) => {
  const page = z.coerce.number().int().min(1).catch(1).parse(req.query.page);
  const pageSize = z.coerce.number().int().min(1).max(100).catch(25).parse(req.query.pageSize);
  const action = typeof req.query.action === 'string' ? req.query.action.slice(0, 80) : undefined;
  const entityType = typeof req.query.entityType === 'string' ? req.query.entityType.slice(0, 80) : undefined;
  const where = { ...(action ? { action } : {}), ...(entityType ? { entityType } : {}) };
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { actor: { select: { id: true, email: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.auditLog.count({ where }),
  ]);
  return ok(res, { logs, page, pageSize, total });
});

router.get('/ledger-integrity', async (req, res) => ok(res, await getLedgerIntegrity()));

export default router;
