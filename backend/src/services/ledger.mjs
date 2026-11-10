import { randomUUID } from 'node:crypto';
import { prisma } from '../db.mjs';
import { AppError } from '../lib/errors.mjs';
import { isBalanced, nextBalance } from '../lib/money.mjs';

function transferFailure(transfer) {
  if (transfer.status === 'FAILED') throw new AppError(422, transfer.failureCode || 'TRANSFER_FAILED', 'The transfer could not be completed.', { transferId: transfer.id });
  if (transfer.status === 'PENDING') throw new AppError(409, 'TRANSFER_PENDING', 'A transfer with this idempotency key is still being processed.', { transferId: transfer.id });
  return transfer;
}

export async function createTransfer({ userId, fromAccountId, recipientAccountNumber, amountCents, idempotencyKey, requestId }) {
  if (typeof amountCents !== 'bigint') throw new AppError(400, 'VALIDATION_ERROR', 'Amount must be integer minor units.');
  const amount = amountCents;
  if (amount <= 0n) throw new AppError(400, 'VALIDATION_ERROR', 'Amount must be greater than zero.');
  if (!idempotencyKey || idempotencyKey.length < 12 || idempotencyKey.length > 128) throw new AppError(400, 'VALIDATION_ERROR', 'A valid idempotency key is required.');
  if (!recipientAccountNumber || recipientAccountNumber.length > 40) throw new AppError(400, 'VALIDATION_ERROR', 'A valid recipient account number is required.');

  const uniqueWhere = { userId_idempotencyKey: { userId, idempotencyKey } };
  const existing = await prisma.transfer.findUnique({ where: uniqueWhere });
  if (existing) return transferFailure(existing);

  let transfer;
  try {
    transfer = await prisma.$transaction(async (tx) => {
      const raced = await tx.transfer.findUnique({ where: uniqueWhere });
      if (raced) return raced;

      const sourceBeforeLock = await tx.account.findFirst({ where: { id: fromAccountId, userId, type: 'USER', status: 'ACTIVE' } });
      const destinationBeforeLock = await tx.account.findFirst({ where: { accountNumber: recipientAccountNumber, type: 'USER', status: 'ACTIVE', user: { status: 'ACTIVE' } } });
      if (!sourceBeforeLock) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Source account not found.');
      if (!destinationBeforeLock?.userId) throw new AppError(404, 'RECIPIENT_NOT_FOUND', 'Recipient account not found.');
      if (sourceBeforeLock.id === destinationBeforeLock.id) throw new AppError(400, 'VALIDATION_ERROR', 'Source and recipient accounts must be different.');

      // Explicit row locks in deterministic order prevent concurrent overspending and deadlocks.
      await tx.$queryRawUnsafe(
        'SELECT "id" FROM "Account" WHERE "id" = $1 OR "id" = $2 ORDER BY "id" FOR UPDATE',
        sourceBeforeLock.id,
        destinationBeforeLock.id,
      );
      // Lock owners as well so a concurrent suspension cannot race the transfer authorization check.
      await tx.$queryRawUnsafe(
        'SELECT "id" FROM "User" WHERE "id" = $1 OR "id" = $2 ORDER BY "id" FOR SHARE',
        userId,
        destinationBeforeLock.userId,
      );
      const [source, destination, sender, recipient] = await Promise.all([
        tx.account.findUnique({ where: { id: sourceBeforeLock.id } }),
        tx.account.findUnique({ where: { id: destinationBeforeLock.id }, include: { user: { select: { status: true } } } }),
        tx.user.findUnique({ where: { id: userId }, select: { status: true } }),
        tx.user.findUnique({ where: { id: destinationBeforeLock.userId }, select: { status: true } }),
      ]);
      if (!sender || sender.status !== 'ACTIVE') throw new AppError(403, 'ACCOUNT_INACTIVE', 'The source account owner is not active.');
      if (!source || source.userId !== userId || source.type !== 'USER' || source.status !== 'ACTIVE') throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Source account not found.');
      if (!destination || destination.status !== 'ACTIVE' || destination.type !== 'USER' || destination.user?.status !== 'ACTIVE' || recipient?.status !== 'ACTIVE') throw new AppError(404, 'RECIPIENT_NOT_FOUND', 'Recipient account not found.');

      if (source.currentBalanceCents < amount) {
        const failed = await tx.transfer.create({ data: {
          userId, fromAccountId: source.id, toAccountId: destination.id, amountCents: amount,
          idempotencyKey, status: 'FAILED', failureCode: 'INSUFFICIENT_FUNDS',
        } });
        await tx.auditLog.create({ data: { actorId: userId, action: 'TRANSFER_FAILED', entityType: 'Transfer', entityId: failed.id, requestId, metadata: { code: 'INSUFFICIENT_FUNDS' } } });
        return failed;
      }

      const pending = await tx.transfer.create({ data: {
        userId, fromAccountId: source.id, toAccountId: destination.id,
        amountCents: amount, idempotencyKey, status: 'PENDING',
      } });
      const sourceAfter = nextBalance(source.currentBalanceCents, 'DEBIT', amount);
      const destinationAfter = nextBalance(destination.currentBalanceCents, 'CREDIT', amount);
      const sourceSequence = source.ledgerVersion + 1n;
      const destinationSequence = destination.ledgerVersion + 1n;

      await tx.account.update({ where: { id: source.id }, data: { currentBalanceCents: sourceAfter, ledgerVersion: sourceSequence } });
      await tx.account.update({ where: { id: destination.id }, data: { currentBalanceCents: destinationAfter, ledgerVersion: destinationSequence } });

      const journal = await tx.journalEntry.create({ data: {
        reference: `TRF-${randomUUID()}`,
        status: 'PENDING',
        description: 'Internal synthetic account transfer',
        metadata: { transferId: pending.id, requestId },
      } });
      const ledgerLines = [
        { journalEntryId: journal.id, accountId: source.id, side: 'DEBIT', amountCents: amount, balanceAfterCents: sourceAfter, accountSequence: sourceSequence },
        { journalEntryId: journal.id, accountId: destination.id, side: 'CREDIT', amountCents: amount, balanceAfterCents: destinationAfter, accountSequence: destinationSequence },
      ];
      if (!isBalanced(ledgerLines)) throw new Error('Internal ledger balance invariant failed.');
      await tx.ledgerEntry.createMany({ data: ledgerLines });
      await tx.journalEntry.update({ where: { id: journal.id }, data: { status: 'COMPLETED', completedAt: new Date() } });

      const completed = await tx.transfer.update({ where: { id: pending.id }, data: {
        status: 'COMPLETED', journalEntryId: journal.id, completedAt: new Date(),
      } });
      await tx.auditLog.create({ data: {
        actorId: userId, action: 'TRANSFER_CREATED', entityType: 'Transfer', entityId: completed.id, requestId,
        metadata: { fromAccountId: source.id, toAccountId: destination.id, amountCents: amount.toString(), journalEntryId: journal.id },
      } });
      return completed;
    }, { isolationLevel: 'Serializable', maxWait: 5000, timeout: 15000 });
  } catch (error) {
    // Unique constraint race: the original request already created the result.
    if (error?.code === 'P2002' || error?.code === 'P2034') {
      const prior = await prisma.transfer.findUnique({ where: uniqueWhere });
      if (prior) return transferFailure(prior);
    }
    throw error;
  }
  return transferFailure(transfer);
}

export async function getLedgerIntegrity() {
  const [journals, accounts] = await Promise.all([
    prisma.journalEntry.findMany({ where: { status: 'COMPLETED' }, include: { entries: true } }),
    prisma.account.findMany({ include: { ledgerEntries: { orderBy: { accountSequence: 'asc' } } } }),
  ]);
  const journalFailures = [];
  for (const journal of journals) {
    if (!isBalanced(journal.entries)) journalFailures.push({ journalEntryId: journal.id, reason: 'UNBALANCED_OR_INCOMPLETE' });
  }

  const accountFailures = [];
  for (const account of accounts) {
    let balance = 0n;
    let expectedSequence = 1n;
    for (const entry of account.ledgerEntries) {
      if (BigInt(entry.accountSequence) !== expectedSequence) {
        accountFailures.push({ accountId: account.id, reason: 'SEQUENCE_GAP' });
        expectedSequence = BigInt(entry.accountSequence);
      }
      expectedSequence += 1n;
      balance = nextBalance(balance, entry.side, entry.amountCents);
      if (balance !== entry.balanceAfterCents) accountFailures.push({ accountId: account.id, ledgerEntryId: entry.id, reason: 'BALANCE_AFTER_MISMATCH' });
    }
    if (balance !== account.currentBalanceCents) {
      accountFailures.push({ accountId: account.id, reason: 'CACHED_BALANCE_MISMATCH', ledgerBalance: balance.toString(), cachedBalance: account.currentBalanceCents.toString() });
    }
    if (account.ledgerVersion !== BigInt(account.ledgerEntries.length)) {
      accountFailures.push({ accountId: account.id, reason: 'LEDGER_VERSION_MISMATCH' });
    }
  }
  return {
    ok: journalFailures.length === 0 && accountFailures.length === 0,
    checkedJournals: journals.length,
    checkedAccounts: accounts.length,
    journalFailures,
    accountFailures,
    checkedAt: new Date().toISOString(),
  };
}
