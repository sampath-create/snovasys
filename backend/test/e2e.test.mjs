import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

process.env.ACCESS_TOKEN_SECRET ||= randomBytes(48).toString('hex');
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL ||= 'postgresql://unused:unused@127.0.0.1:5432/unused';
process.env.WEB_ORIGIN ||= 'http://localhost:5173';

const enabled = process.env.RUN_DB_TESTS === 'true' && Boolean(process.env.TEST_DATABASE_URL);
let app;
let prisma;
let asyncCreateApp;
if (enabled) {
  ({ createApp: asyncCreateApp } = await import('../src/app.mjs'));
  ({ prisma } = await import('../src/db.mjs'));
  app = asyncCreateApp({ redisClient: null });
}

// This suite requires an isolated PostgreSQL test database with migrations applied.
test('HTTP registration, login, refresh, logout, onboarding and admin RBAC', { skip: !enabled }, async () => {
  const request = (await import('supertest')).default;
  const email = `e2e-${randomUUID()}@example.test`;
  const password = `E2E-${randomUUID()}-Password!`;
  const register = await request(app).post('/api/auth/register').send({ email, password }).expect(201);
  const access = register.body.data.accessToken;
  assert.ok(access);
  assert.equal(register.body.success, true);
  const cookieHeader = register.headers['set-cookie']?.[0];
  assert.ok(cookieHeader?.startsWith('bv_refresh='));

  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${access}`).expect(200);
  const login = await request(app).post('/api/auth/login').send({ email, password }).expect(200);
  assert.ok(login.body.data.accessToken);
  const badLogin = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' }).expect(401);
  assert.equal(badLogin.body.error.message, 'Email or password is incorrect.');

  const refresh = await request(app).post('/api/auth/refresh').set('Cookie', cookieHeader.split(';')[0]).expect(200);
  assert.ok(refresh.body.data.accessToken);
  const newCookie = refresh.headers['set-cookie']?.[0]?.split(';')[0];
  await request(app).post('/api/auth/logout').set('Cookie', newCookie).expect(200);
  await request(app).post('/api/auth/refresh').set('Cookie', newCookie).expect(401);

  const onboarding = await request(app).post('/api/onboarding').set('Authorization', `Bearer ${access}`).send({ fullName: 'Synthetic E2E', purpose: 'STUDENT_DEMO', city: 'Test City' }).expect(201);
  assert.equal(onboarding.body.data.application.state, 'SUBMITTED');
  await request(app).post('/api/onboarding').set('Authorization', `Bearer ${access}`).send({ fullName: 'Synthetic E2E', purpose: 'STUDENT_DEMO', city: 'Test City' }).expect(409);

  await request(app).get('/api/admin/users').set('Authorization', `Bearer ${access}`).expect(403);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const adminRole = await prisma.role.upsert({ where: { name: 'ADMIN' }, create: { name: 'ADMIN' }, update: {} });
  const adminUser = await prisma.user.create({ data: { email: `admin-${randomUUID()}@example.test`, passwordHash: 'not-used' } });
  await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });
  const { createAccessToken } = await import('../src/lib/security.mjs');
  const adminToken = createAccessToken({ id: adminUser.id });
  await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminToken}`).expect(200);
  const review = await request(app).patch(`/api/admin/onboarding/${onboarding.body.data.application.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'APPROVED' })
    .expect(200);
  assert.equal(review.body.data.application.state, 'APPROVED');
  const ownAccounts = await request(app).get('/api/accounts/me').set('Authorization', `Bearer ${access}`).expect(200);
  assert.equal(ownAccounts.body.data.accounts.some((account) => account.status === 'ACTIVE'), true);
  assert.ok(user?.id);
});

after(async () => { if (prisma) await prisma.$disconnect(); });
