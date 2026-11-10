import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.mjs';
import { AppError } from '../lib/errors.mjs';
import { ok } from '../lib/http.mjs';
import { authenticate } from '../middleware/auth.mjs';

const router = Router();
router.get('/me', authenticate, async (req, res) => {
  const page = z.coerce.number().int().min(1).max(100000).catch(1).parse(req.query.page);
  const pageSize = z.coerce.number().int().min(1).max(100).catch(25).parse(req.query.pageSize);
  const accountIds = (await prisma.account.findMany({ where: { userId: req.user.id, type: 'USER' }, select: { id: true } })).map((a) => a.id);
  if (!accountIds.length) return ok(res, { entries: [], page, pageSize, total: 0 });
  const where = { accountId: { in: accountIds }, journalEntry: { status: 'COMPLETED' } };
  const [entries, total] = await Promise.all([
    prisma.ledgerEntry.findMany({ where, include: { account: { select: { accountNumber: true } }, journalEntry: { select: { reference: true, description: true, completedAt: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.ledgerEntry.count({ where }),
  ]);
  return ok(res, { entries, page, pageSize, total });
});
export default router;
