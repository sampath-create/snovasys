import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

process.env.ACCESS_TOKEN_SECRET ||= randomBytes(48).toString('hex');
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:5432/unused';
process.env.WEB_ORIGIN ||= 'http://localhost:5173';

const { safeTokenEquals, createAccessToken, verifyAccessToken, passwordHash, passwordMatches } = await import('../src/lib/security.mjs');
const { hasRole, assertAccountOwner } = await import('../src/lib/authz.mjs');

test('bootstrap token comparison handles equal and unequal inputs', () => {
  assert.equal(safeTokenEquals('a'.repeat(48), 'a'.repeat(48)), true);
  assert.equal(safeTokenEquals('a'.repeat(48), 'b'.repeat(48)), false);
  assert.equal(safeTokenEquals('short', 'longer'), false);
  assert.equal(safeTokenEquals(undefined, 'secret'), false);
});

test('passwords are hashed and compared without storing plaintext', async () => {
  const password = 'synthetic-demo-password-123';
  const digest = await passwordHash(password);
  assert.notEqual(digest, password);
  assert.equal(await passwordMatches(password, digest), true);
  assert.equal(await passwordMatches('wrong-password', digest), false);
});

test('access token carries a user subject and verifies with configured issuer', () => {
  const token = createAccessToken({ id: 'user-123' });
  const claims = verifyAccessToken(token);
  assert.equal(claims.sub, 'user-123');
  assert.equal(claims.iss, 'balancevault');
});

test('role guard distinguishes USER from ADMIN', () => {
  assert.equal(hasRole({ roles: ['USER'] }, 'ADMIN'), false);
  assert.equal(hasRole({ roles: ['USER', 'ADMIN'] }, 'ADMIN'), true);
  assert.equal(hasRole(null, 'ADMIN'), false);
});

test('ownership guard does not let an admin bypass ordinary account ownership', async () => {
  const account = { id: 'acct-1', userId: 'owner-1' };
  assert.equal(assertAccountOwner('owner-1', account), account);
  assert.throws(() => assertAccountOwner('other-user', account), { status: 404, code: 'NOT_FOUND' });
});
