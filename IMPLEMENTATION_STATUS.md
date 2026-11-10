# BalanceVault implementation status

**Delivery type:** standalone reference implementation ZIP. This is not a change set applied to `Satwiksharan/balance-vault`.

## Repository access

The GitHub connector returned HTTP `404` for `Satwiksharan/balance-vault`, and the repository was not available in the connected GitHub account. A network clone was also unavailable in the execution environment. As a result, the existing repository tree, deployed variables, existing bootstrap implementation, and current application behavior could not be inspected. No claim is made that existing project code was preserved or that a commit was pushed.

## Implemented in this package

- Express API and React/Vite demo UI.
- Prisma models and initial PostgreSQL migrations for users, roles, accounts, journal entries, ledger entries, transfers, refresh tokens, audit logs, and onboarding applications.
- Integer-cent currency parsing and formatting; API BigInt values are returned as decimal strings and UI formatting uses BigInt arithmetic.
- Serializable, row-locked internal transfers with ownership rechecks, idempotency, equal debit/credit entries, balance snapshots, and audit events.
- Ledger integrity checks for completed journal balance, account cached balance, sequence continuity, and stored balance snapshots.
- Database triggers for completed journal/ledger immutability and append-only audit rows.
- One-time admin bootstrap using a token header, constant-time token comparison, bcrypt password hashing, a restricted PostgreSQL `SECURITY DEFINER` function, and audit logging.
- Registration, login, short-lived access JWTs, hashed/rotated refresh tokens, logout invalidation, role checks, and rate limiting with a Redis/in-memory fallback.
- Onboarding submission and admin review, admin user/status/role management, audit log filtering/pagination, `/healthz`, and `/readyz`.
- Seed and bootstrap scripts, environment example, deployment SQL, tests, and setup documentation.

## Checks executed in this environment

| Check | Result |
|---|---|
| `node --check` on all API `.mjs` files | Passed |
| TypeScript parser check of React JSX/JS files | Passed |
| `node --test api/test/ledger.test.mjs` | 4 passed, 3 database tests skipped |

The four passing ledger tests cover decimal-to-cent parsing, integer arithmetic/formatting, BigInt-safe JSON serialization, and debit/credit balancing.

## Not verified

- npm dependency installation and full workspace build.
- Authentication tests: they require installed packages such as `bcryptjs` and `jsonwebtoken`, which were not present in the environment.
- Prisma schema validation/client generation and migration execution.
- PostgreSQL function/trigger creation, SQL grants, row-lock behavior, and seed execution.
- Database-backed transfer, bootstrap, onboarding, authentication, and authorization tests.
- Redis connectivity/rate limiting and readiness behavior against running services.
- React browser flows and deployed frontend/backend verification.
- First-admin bootstrap and admin login on the actual deployment.

No PostgreSQL client or Docker executable was available for running the SQL migrations or local services. The included verification scripts are provided for a configured environment but were not run against the deployment.

## Known security and product limitations

- This is synthetic-data hackathon demo code, not a financial service. It must not handle real funds.
- There are no bank integrations, payment rails, KYC vendors, custody features, password reset, or email verification.
- The reference app has not undergone an independent security review or production threat-model assessment.
- The application runtime database role has narrow table grants and no `UPDATE`/`DELETE` grants on ledger or audit rows. Account balance updates are only exposed through the transfer service in the API; operational database credentials must remain restricted.
- Configure HTTPS, CORS origins, cookie policy, secrets, database grants, backups, and monitoring for the target hosting platform before a public demo.
