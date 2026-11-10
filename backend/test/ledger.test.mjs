import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

process.env.ACCESS_TOKEN_SECRET ||= randomBytes(48).toString('hex');
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:5432/unused';
process.env.WEB_ORIGIN ||= 'http://localhost:5173';

const { parseAmountToCents, formatCents, nextBalance, isBalanced } = await import('../src/lib/money.mjs');
const { jsonSafe } = await import('../src/lib/http.mjs');

test('money parser uses integer cents and rejects floating-point formats', () => {
  assert.equal(parseAmountToCents('12.34'), 1234n);
  assert.equal(parseAmountToCents('7'), 700n);
  assert.throws(() => parseAmountToCents('2.999'), { code: 'VALIDATION_ERROR' });
  assert.throws(() => parseAmountToCents('-1.00'), { code: 'VALIDATION_ERROR' });
  assert.throws(() => parseAmountToCents('1e3'), { code: 'VALIDATION_ERROR' });
  assert.throws(() => parseAmountToCents(12.34), { code: 'VALIDATION_ERROR' });
});

test('money formatter and balance arithmetic never use float calculations', () => {
  assert.equal(formatCents(12345n), 'USD 123.45');
  assert.equal(nextBalance(10000n, 'DEBIT', 1250n), 8750n);
  assert.equal(nextBalance(10000n, 'CREDIT', 1250n), 11250n);
  assert.equal(nextBalance(100n, 'DEBIT', 101n), -1n);
});

test('API JSON conversion safely serializes BigInt minor-unit values as strings', () => {
  assert.deepEqual(jsonSafe({ balanceCents: 12345n, entries: [{ amountCents: 50n }] }), { balanceCents: '12345', entries: [{ amountCents: '50' }] });
});

test('journal is balanced only when debit and credit totals match', () => {
  assert.equal(isBalanced([{ side: 'DEBIT', amountCents: 100n }, { side: 'CREDIT', amountCents: 100n }]), true);
  assert.equal(isBalanced([{ side: 'DEBIT', amountCents: 100n }, { side: 'CREDIT', amountCents: 99n }]), false);
  assert.equal(isBalanced([{ side: 'DEBIT', amountCents: 100n }]), false);
});

const databaseTestsEnabled = process.env.RUN_DB_TESTS === 'true' && Boolean(process.env.TEST_DATABASE_URL);
let prisma;
let createTransfer;
let getLedgerIntegrity;
if (databaseTestsEnabled) {
  ({ prisma } = await import('../src/db.mjs'));
  ({ createTransfer, getLedgerIntegrity } = await import('../src/services/ledger.mjs'));
}

test('PostgreSQL transfer posts balanced entries and replays idempotently', { skip: !databaseTestsEnabled }, async () => {
  const suffix = randomUUID();
  const user = await prisma.user.create({ data: { email: `${suffix}@example.test`, passwordHash: 'test-hash', status: 'ACTIVE' } });
  const source = await prisma.account.create({ data: { userId: user.id, accountNumber: `S-${suffix}`, status: 'ACTIVE', currentBalanceCents: 5000n, ledgerVersion: 1n } });
  const destUser = await prisma.user.create({ data: { email: `dest-${suffix}@example.test`, passwordHash: 'test-hash', status: 'ACTIVE' } });
  const destination = await prisma.account.create({ data: { userId: destUser.id, accountNumber: `D-${suffix}`, status: 'ACTIVE', currentBalanceCents: 0n } });
  const clearing = await prisma.account.create({ data: { type: 'SYSTEM', accountNumber: `C-${suffix}`, status: 'ACTIVE', currentBalanceCents: -5000n, ledgerVersion: 1n } });
  const opening = await prisma.journalEntry.create({ data: { reference: `OPEN-${suffix}`, status: 'PENDING', description: 'Test opening credit' } });
  await prisma.ledgerEntry.createMany({ data: [
    { journalEntryId: opening.id, accountId: clearing.id, side: 'DEBIT', amountCents: 5000n, balanceAfterCents: -5000n, accountSequence: 1n },
    { journalEntryId: opening.id, accountId: source.id, side: 'CREDIT', amountCents: 5000n, balanceAfterCents: 5000n, accountSequence: 1n },
  ] });
  await prisma.journalEntry.update({ where: { id: opening.id }, data: { status: 'COMPLETED' } });

  const args = { userId: user.id, fromAccountId: source.id, recipientAccountNumber: destination.accountNumber, amountCents: 1000n, idempotencyKey: `test-key-${suffix}`, requestId: `test-${suffix}` };
  const first = await createTransfer(args);
  const second = await createTransfer(args);
  assert.equal(first.status, 'COMPLETED');
  assert.equal(second.id, first.id);
  const lines = await prisma.ledgerEntry.findMany({ where: { journalEntryId: first.journalEntryId } });
  assert.equal(lines.length, 2);
  assert.equal(lines.find((line) => line.side === 'DEBIT').amountCents, lines.find((line) => line.side === 'CREDIT').amountCents);
  const [sourceAfter, destAfter] = await Promise.all([
    prisma.account.findUnique({ where: { id: source.id } }),
    prisma.account.findUnique({ where: { id: destination.id } }),
  ]);
  assert.equal(sourceAfter.currentBalanceCents, 4000n);
  assert.equal(destAfter.currentBalanceCents, 1000n);
});

test('PostgreSQL insufficient balance stores FAILED transfer without ledger movement', { skip: !databaseTestsEnabled }, async () => {
  const suffix = randomUUID();
  const user = await prisma.user.create({ data: { email: `${suffix}@example.test`, passwordHash: 'test-hash' } });
  const source = await prisma.account.create({ data: { userId: user.id, accountNumber: `S-${suffix}`, status: 'ACTIVE' } });
  const recipient = await prisma.account.create({ data: { userId: user.id, accountNumber: `D-${suffix}`, status: 'ACTIVE' } });
  await assert.rejects(createTransfer({ userId: user.id, fromAccountId: source.id, recipientAccountNumber: recipient.accountNumber, amountCents: 10n, idempotencyKey: `fail-key-${suffix}` }), { code: 'INSUFFICIENT_FUNDS' });
  const stored = await prisma.transfer.findUnique({ where: { userId_idempotencyKey: { userId: user.id, idempotencyKey: `fail-key-${suffix}` } } });
  assert.equal(stored.status, 'FAILED');
  assert.equal(await prisma.ledgerEntry.count({ where: { accountId: source.id } }), 0);
});

test('PostgreSQL integrity check detects a tampered cached balance; trigger blocks ledger edits', { skip: !databaseTestsEnabled }, async () => {
  const account = await prisma.account.findFirst({ where: { type: 'USER', currentBalanceCents: { gt: 0n } } });
  if (!account) return;
  const previous = account.currentBalanceCents;
  await prisma.account.update({ where: { id: account.id }, data: { currentBalanceCents: previous + 1n } });
  const integrity = await getLedgerIntegrity();
  assert.equal(integrity.ok, false);
  await prisma.account.update({ where: { id: account.id }, data: { currentBalanceCents: previous } });
  const line = await prisma.ledgerEntry.findFirst({ where: { accountId: account.id, journalEntry: { status: 'COMPLETED' } } });
  if (line) await assert.rejects(prisma.ledgerEntry.update({ where: { id: line.id }, data: { amountCents: line.amountCents + 1n } }));
});

after(async () => { if (prisma) await prisma.$disconnect(); });
