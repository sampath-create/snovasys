import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

process.env.ACCESS_TOKEN_SECRET ||= randomBytes(48).toString('hex');
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:5432/unused';
process.env.WEB_ORIGIN ||= 'http://localhost:5173';
process.env.BOOTSTRAP_ADMIN_EMAIL ||= 'bootstrap-test-admin@example.test';
process.env.BOOTSTRAP_ADMIN_PASSWORD ||= 'bootstrap-test-password-123';
process.env.BOOTSTRAP_ADMIN_TOKEN ||= randomBytes(48).toString('hex');

const enabled = process.env.RUN_DB_TESTS === 'true' && Boolean(process.env.TEST_DATABASE_URL);
let serverApp;
let prisma;
if (enabled) {
  const { createApp } = await import('../src/app.mjs');
  ({ prisma } = await import('../src/db.mjs'));
  serverApp = createApp({ redisClient: null });
}

test('first-admin bootstrap rejects bad token, succeeds once, and supports admin login', { skip: !enabled }, async (t) => {
  const request = (await import('supertest')).default;
  const existingAdmin = await prisma.userRole.findFirst({ where: { role: { name: 'ADMIN' } }, select: { userId: true } });
  if (existingAdmin) {
    t.skip('Use a fresh, isolated database with no administrator for the bootstrap test.');
    return;
  }

  const invalid = await request(serverApp)
    .post('/api/admin/bootstrap')
    .set('X-Bootstrap-Token', 'invalid-token')
    .send({})
    .expect(403);
  assert.equal(invalid.body.error.code, 'FORBIDDEN');

  const first = await request(serverApp)
    .post('/api/admin/bootstrap')
    .set('X-Bootstrap-Token', process.env.BOOTSTRAP_ADMIN_TOKEN)
    .send({})
    .expect(201);
  assert.equal(first.body.success, true);
  assert.equal(first.body.data.bootstrapped, true);
  assert.equal(Object.hasOwn(first.body.data, 'token'), false);

  const second = await request(serverApp)
    .post('/api/admin/bootstrap')
    .set('X-Bootstrap-Token', process.env.BOOTSTRAP_ADMIN_TOKEN)
    .send({})
    .expect(409);
  assert.equal(second.body.error.code, 'CONFLICT');

  const login = await request(serverApp)
    .post('/api/auth/login')
    .send({ email: process.env.BOOTSTRAP_ADMIN_EMAIL, password: process.env.BOOTSTRAP_ADMIN_PASSWORD })
    .expect(200);
  const accessToken = login.body.data.accessToken;
  assert.ok(accessToken);
  await request(serverApp)
    .get('/api/admin/summary')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
});

after(async () => { if (prisma) await prisma.$disconnect(); });
