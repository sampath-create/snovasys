import { AppError } from './errors.mjs';

export function parseAmountToCents(value) {
  if (typeof value !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Amount must be supplied as a decimal string.');
  }
  const text = String(value).trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Amount must have up to two decimal places.');
  }
  const [whole, fractional = ''] = text.split('.');
  const cents = BigInt(whole) * 100n + BigInt((fractional + '00').slice(0, 2));
  if (cents <= 0n || cents > 9_000_000_000_000_000n) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Amount is outside the supported range.');
  }
  return cents;
}

export function formatCents(cents, currency = 'INR') {
  const amount = typeof cents === 'bigint' ? cents : BigInt(cents);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const whole = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, '0');
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  return `${negative ? '-' : ''}${symbol}${whole.toString()}.${fraction}`;
}

export function nextBalance(currentBalanceCents, side, amountCents) {
  const current = BigInt(currentBalanceCents);
  const amount = BigInt(amountCents);
  if (amount <= 0n) throw new AppError(400, 'VALIDATION_ERROR', 'Ledger amount must be positive.');
  if (side === 'DEBIT') {
    const next = current - amount;
    if (next < 0n) throw new AppError(422, 'INSUFFICIENT_FUNDS', 'Insufficient funds for this transaction.');
    return next;
  }
  if (side === 'CREDIT') return current + amount;
  throw new AppError(400, 'VALIDATION_ERROR', 'Ledger side must be DEBIT or CREDIT.');
}

export function isBalanced(entries) {
  let debits = 0n;
  let credits = 0n;
  for (const entry of entries) {
    const amount = BigInt(entry.amountCents);
    if (entry.side === 'DEBIT') debits += amount;
    else if (entry.side === 'CREDIT') credits += amount;
    else return false;
  }
  return debits === credits && entries.length >= 2;
}
