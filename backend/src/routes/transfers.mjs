import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.mjs';
import { AppError } from '../lib/errors.mjs';
import { ok } from '../lib/http.mjs';
import { parseAmountToCents } from '../lib/money.mjs';
import { authenticate } from '../middleware/auth.mjs';
import { createTransfer } from '../services/ledger.mjs';

const router = Router();
const transferSchema = z.object({
  fromAccountId: z.string().min(1),
  recipientAccountNumber: z.string().trim().min(4).max(40),
  amount: z.string().min(1).max(20),
  idempotencyKey: z.string().min(12).max(128),
}).strict();

router.post('/', authenticate, async (req, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Provide a source account, recipient account number, amount and idempotency key.', parsed.error.flatten());
  const amountCents = parseAmountToCents(parsed.data.amount);
  const transfer = await createTransfer({ ...parsed.data, userId: req.user.id, amountCents, requestId: req.id });
  return ok(res, { transfer }, 201);
});

router.get('/:id', authenticate, async (req, res) => {
  const transfer = await prisma.transfer.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { journalEntry: { include: { entries: true } } } });
  if (!transfer) throw new AppError(404, 'NOT_FOUND', 'Transfer not found.');
  return ok(res, { transfer });
});
export default router;
