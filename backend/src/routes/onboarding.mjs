import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.mjs';
import { AppError } from '../lib/errors.mjs';
import { ok } from '../lib/http.mjs';
import { authenticate } from '../middleware/auth.mjs';

const router = Router();
const onboardingSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  purpose: z.enum(['PERSONAL_DEMO', 'STUDENT_DEMO', 'OTHER']),
  city: z.string().trim().min(2).max(80),
}).strict();

router.post('/', authenticate, async (req, res) => {
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Provide the requested demo onboarding details.', parsed.error.flatten());
  const application = await prisma.$transaction(async (tx) => {
    // Serialize submissions per user to prevent duplicate applications from concurrent requests.
    await tx.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id" = $1 FOR UPDATE', req.user.id);
    const latest = await tx.onboardingApplication.findFirst({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
    if (latest && latest.state !== 'REJECTED') throw new AppError(409, 'CONFLICT', 'An onboarding application is already in progress or approved.');
    const created = await tx.onboardingApplication.create({ data: { userId: req.user.id, state: 'SUBMITTED', data: parsed.data, submittedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: req.user.id, action: 'ONBOARDING_SUBMITTED', entityType: 'OnboardingApplication', entityId: created.id, requestId: req.id, metadata: { state: created.state } } });
    return created;
  });
  return ok(res, { application }, 201);
});

router.get('/status', authenticate, async (req, res) => {
  const application = await prisma.onboardingApplication.findFirst({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
  const account = await prisma.account.findFirst({ where: { userId: req.user.id, type: 'USER' } });
  return ok(res, { application, accountActive: account?.status === 'ACTIVE' });
});

export default router;
