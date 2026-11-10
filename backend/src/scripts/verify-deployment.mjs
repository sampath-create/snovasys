import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
dotenv.config({ path: process.env.ENV_FILE || rootEnv });
dotenv.config();
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const apiBase = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
const results = [];
const record = (name, passed, detail = '') => {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function request(path, { token, cookie, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  let payload = null;
  try { payload = await response.json(); } catch { /* no JSON response */ }
  return { response, payload, cookie: response.headers.getSetCookie?.()?.[0]?.split(';')[0] || null };
}

async function login(email, password) {
  const { response, payload, cookie } = await request('/api/auth/login', { method: 'POST', body: { email, password } });
  if (!response.ok || !payload?.success) throw new Error(`Login failed (${response.status}).`);
  return { token: payload.data.accessToken, cookie };
}

try {
  const ui = await fetch(frontend, { redirect: 'follow' });
  record('frontend reachable', ui.ok, `HTTP ${ui.status}`);
} catch (error) { record('frontend reachable', false, error?.name || 'network error'); }

for (const [path, label] of [['/healthz', 'backend health endpoint'], ['/readyz', 'backend readiness endpoint']]) {
  try {
    const { response, payload } = await request(path);
    const pass = response.ok && payload?.success === true;
    record(label, pass, `HTTP ${response.status}`);
  } catch (error) { record(label, false, error?.name || 'network error'); }
}

const migration = spawnSync('npx', ['prisma', 'migrate', 'status'], { cwd: process.cwd(), encoding: 'utf8', timeout: 30000 });
record('database migration status', migration.status === 0, (migration.stdout || migration.stderr || 'not available').trim().split('\n').slice(-2).join(' ').slice(0, 180));

if (process.env.BOOTSTRAP_ADMIN_TOKEN) {
  try {
    const { response, payload } = await request('/api/admin/bootstrap', { method: 'POST', headers: { 'x-bootstrap-token': process.env.BOOTSTRAP_ADMIN_TOKEN }, body: {} });
    record('first-admin bootstrap endpoint', response.status === 201 || response.status === 409, response.status === 201 ? 'created' : response.status === 409 ? 'already bootstrapped' : payload?.error?.code || `HTTP ${response.status}`);
  } catch (error) { record('first-admin bootstrap endpoint', false, error?.name || 'network error'); }
} else {
  record('first-admin bootstrap endpoint', false, 'skipped: BOOTSTRAP_ADMIN_TOKEN is not set');
}

let admin;
try {
  const email = process.env.VERIFY_DEMO_ADMIN_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.VERIFY_DEMO_ADMIN_PASSWORD || process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set VERIFY_DEMO_ADMIN_EMAIL and VERIFY_DEMO_ADMIN_PASSWORD.');
  admin = await login(email, password);
  const adminCheck = await request('/api/admin/summary', { token: admin.token });
  record('deployed admin login and RBAC', adminCheck.response.ok && adminCheck.payload?.success, adminCheck.response.ok ? 'admin summary accessible' : `HTTP ${adminCheck.response.status}`);
} catch (error) { record('deployed admin login and RBAC', false, error?.message || 'login failed'); }

if (admin?.token) {
  try {
    const email = `verify-${randomUUID()}@example.test`;
    const password = `Synthetic-${randomUUID()}-Pass!`;
    const registration = await request('/api/auth/register', { method: 'POST', body: { email, password } });
    const token = registration.payload?.data?.accessToken;
    let cookie = registration.cookie;
    record('registration flow', registration.response.status === 201 && Boolean(token), `HTTP ${registration.response.status}`);
    if (!token) throw new Error('Registration did not return an access token.');

    const onboarding = await request('/api/onboarding', { method: 'POST', token, body: { fullName: 'Synthetic Demo User', purpose: 'STUDENT_DEMO', city: 'Demo City' } });
    record('onboarding submission', onboarding.response.status === 201, `HTTP ${onboarding.response.status}`);
    const applicationId = onboarding.payload?.data?.application?.id;
    if (applicationId) {
      const decision = await request(`/api/admin/onboarding/${applicationId}`, { method: 'PATCH', token: admin.token, body: { status: 'APPROVED' } });
      record('admin onboarding approval', decision.response.ok, `HTTP ${decision.response.status}`);
    } else record('admin onboarding approval', false, 'submission did not return an application id');

    const accounts = await request('/api/accounts/me', { token });
    record('account activation and ownership view', accounts.response.ok && accounts.payload?.data?.accounts?.some((account) => account.status === 'ACTIVE'), `HTTP ${accounts.response.status}`);

    if (cookie) {
      const rotated = await request('/api/auth/refresh', { method: 'POST', cookie });
      record('refresh-token rotation', rotated.response.ok && Boolean(rotated.payload?.data?.accessToken), `HTTP ${rotated.response.status}`);
      cookie = rotated.cookie || cookie;
      const loggedOut = await request('/api/auth/logout', { method: 'POST', cookie });
      record('logout invalidates refresh token', loggedOut.response.ok, `HTTP ${loggedOut.response.status}`);
    } else record('refresh-token rotation', false, 'registration response did not set the refresh cookie');
  } catch (error) {
    record('registration/onboarding verification sequence', false, error?.message || 'flow failed');
  }
}

try {
  const sourceEmail = process.env.DEMO_USER_EMAIL;
  const sourcePassword = process.env.DEMO_USER_PASSWORD;
  const targetEmail = process.env.DEMO_RECIPIENT_EMAIL;
  const targetPassword = process.env.DEMO_RECIPIENT_PASSWORD;
  if (!sourceEmail || !sourcePassword || !targetEmail || !targetPassword) throw new Error('Set demo source and recipient credentials, then run db:seed.');
  const source = await login(sourceEmail, sourcePassword);
  const target = await login(targetEmail, targetPassword);
  const sourceAccounts = await request('/api/accounts/me', { token: source.token });
  const targetAccounts = await request('/api/accounts/me', { token: target.token });
  const from = sourceAccounts.payload?.data?.accounts?.find((account) => account.status === 'ACTIVE');
  const to = targetAccounts.payload?.data?.accounts?.find((account) => account.status === 'ACTIVE');
  if (!from || !to) throw new Error('Seeded demo accounts are missing or inactive.');
  const transfer = await request('/api/transfers', { method: 'POST', token: source.token, body: {
    fromAccountId: from.id,
    recipientAccountNumber: to.accountNumber,
    amount: '0.01',
    idempotencyKey: `verify-${randomUUID()}`,
  } });
  const transferId = transfer.payload?.data?.transfer?.id;
  record('internal transfer', transfer.response.status === 201 && transfer.payload?.data?.transfer?.status === 'COMPLETED', `HTTP ${transfer.response.status}`);
  if (transferId) {
    const ledger = await request('/api/ledger/me', { token: source.token });
    record('ledger entries visible to owner', ledger.response.ok && ledger.payload?.data?.entries?.some((entry) => entry.journalEntryId), `HTTP ${ledger.response.status}`);
    const integrity = await request('/api/admin/ledger-integrity', { token: admin?.token });
    record('ledger integrity check', integrity.response.ok && integrity.payload?.data?.ok === true, integrity.payload?.data?.ok ? 'balanced' : `HTTP ${integrity.response.status}`);
    const audit = await request('/api/admin/audit-logs?action=TRANSFER_CREATED', { token: admin?.token });
    record('transfer audit-log creation', audit.response.ok && audit.payload?.data?.logs?.some((log) => log.entityId === transferId), `HTTP ${audit.response.status}`);
  }
} catch (error) {
  record('transfer/ledger/audit verification sequence', false, error?.message || 'flow failed');
}

const failed = results.filter((result) => !result.passed);
console.log(`\nDeployment verification: ${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exitCode = 1;
