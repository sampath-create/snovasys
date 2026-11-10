import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
dotenv.config({ path: process.env.ENV_FILE || rootEnv });
dotenv.config();
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();
const adminEmail = process.env.DEMO_ADMIN_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL;
const adminPassword = process.env.DEMO_ADMIN_PASSWORD || process.env.BOOTSTRAP_ADMIN_PASSWORD;
const demoUserEmail = process.env.DEMO_USER_EMAIL || 'demo@example.test';
const demoUserPassword = process.env.DEMO_USER_PASSWORD || 'demo-user-password-please-change';
const recipientEmail = process.env.DEMO_RECIPIENT_EMAIL || 'recipient@example.test';
const recipientPassword = process.env.DEMO_RECIPIENT_PASSWORD || 'demo-recipient-password-change-me';

async function ensureDemoUser(email, password, fullName) {
  const role = await prisma.role.upsert({ where: { name: 'USER' }, create: { name: 'USER' }, update: {} });
  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing || await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 12), status: 'ACTIVE' } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, create: { userId: user.id, roleId: role.id }, update: {} });
  const application = await prisma.onboardingApplication.findFirst({ where: { userId: user.id, state: 'APPROVED' } });
  if (!application) {
    await prisma.onboardingApplication.create({ data: { userId: user.id, state: 'APPROVED', data: { fullName, purpose: 'STUDENT_DEMO', city: 'Demo City' }, submittedAt: new Date(), reviewedAt: new Date() } });
  }
  let account = await prisma.account.findFirst({ where: { userId: user.id, type: 'USER' } });
  if (!account) {
    account = await prisma.account.create({ data: { userId: user.id, accountNumber: `BV-${randomUUID().replaceAll('-', '').slice(0, 14).toUpperCase()}`, type: 'USER', status: 'ACTIVE' } });
  } else if (account.status !== 'ACTIVE') {
    account = await prisma.account.update({ where: { id: account.id }, data: { status: 'ACTIVE' } });
  }
  return { user, account };
}

async function ensureSyntheticOpeningCredit(clearing, account, amountCents) {
  const existing = await prisma.ledgerEntry.count({ where: { accountId: account.id } });
  if (existing > 0) return;
  await prisma.$transaction(async (tx) => {
    const [freshClearing, freshAccount] = await Promise.all([
      tx.account.findUnique({ where: { id: clearing.id } }),
      tx.account.findUnique({ where: { id: account.id } }),
    ]);
    const journal = await tx.journalEntry.create({ data: { reference: `SEED-${randomUUID()}`, status: 'PENDING', description: 'Synthetic demo opening credit', metadata: { synthetic: true } } });
    const debitBalance = freshClearing.currentBalanceCents - BigInt(amountCents);
    const creditBalance = freshAccount.currentBalanceCents + BigInt(amountCents);
    const debitSeq = freshClearing.ledgerVersion + 1n;
    const creditSeq = freshAccount.ledgerVersion + 1n;
    await tx.account.update({ where: { id: freshClearing.id }, data: { currentBalanceCents: debitBalance, ledgerVersion: debitSeq } });
    await tx.account.update({ where: { id: freshAccount.id }, data: { currentBalanceCents: creditBalance, ledgerVersion: creditSeq } });
    await tx.ledgerEntry.createMany({ data: [
      { journalEntryId: journal.id, accountId: freshClearing.id, side: 'DEBIT', amountCents: BigInt(amountCents), balanceAfterCents: debitBalance, accountSequence: debitSeq },
      { journalEntryId: journal.id, accountId: freshAccount.id, side: 'CREDIT', amountCents: BigInt(amountCents), balanceAfterCents: creditBalance, accountSequence: creditSeq },
    ] });
    await tx.journalEntry.update({ where: { id: journal.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await tx.auditLog.create({ data: { action: 'DEMO_ACCOUNT_FUNDED', entityType: 'Account', entityId: freshAccount.id, metadata: { synthetic: true, amountCents: String(amountCents) } } });
  });
}

try {
  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error('Set DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD (12+ characters), or corresponding BOOTSTRAP_ADMIN_* values.');
  }
  const adminRole = await prisma.role.upsert({ where: { name: 'ADMIN' }, create: { name: 'ADMIN' }, update: {} });
  const adminExists = await prisma.userRole.findFirst({ where: { roleId: adminRole.id } });
  if (!adminExists) {
    const hash = await bcrypt.hash(adminPassword, 12);
    await prisma.$queryRaw`SELECT public.balancevault_bootstrap_admin(${adminEmail.toLowerCase()}, ${hash})`;
  }

  const demo = await ensureDemoUser(demoUserEmail, demoUserPassword, 'Demo Account Holder');
  const recipient = await ensureDemoUser(recipientEmail, recipientPassword, 'Demo Recipient');
  let clearing = await prisma.account.findFirst({ where: { type: 'SYSTEM', accountNumber: 'BV-DEMO-CLEARING' } });
  if (!clearing) clearing = await prisma.account.create({ data: { type: 'SYSTEM', status: 'ACTIVE', accountNumber: 'BV-DEMO-CLEARING', currentBalanceCents: 0n } });
  await ensureSyntheticOpeningCredit(clearing, demo.account, 100000n);
  await ensureSyntheticOpeningCredit(clearing, recipient.account, 25000n);
  console.log('Synthetic demo seed completed.');
  console.log(`Demo account holder: ${demo.user.email} (${demo.account.accountNumber})`);
  console.log(`Demo recipient: ${recipient.user.email} (${recipient.account.accountNumber})`);
  console.log('Passwords were not printed. Use the values from your environment file.');
} catch (error) {
  console.error(`Seed failed: ${error?.message || 'Unknown error'}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
