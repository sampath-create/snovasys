import { Router } from 'express';
import { prisma } from '../db.mjs';
import { ok } from '../lib/http.mjs';
import { authenticate } from '../middleware/auth.mjs';

const router = Router();
router.get('/me', authenticate, async (req, res) => {
  const accounts = await prisma.account.findMany({
    where: { userId: req.user.id, type: 'USER' },
    select: { id: true, accountNumber: true, status: true, currentBalanceCents: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return ok(res, { accounts });
});
export default router;
