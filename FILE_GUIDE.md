# File guide

## Root

| File | Purpose |
|---|---|
| `package.json` | npm workspace and common developer/test scripts |
| `.env.example` | Environment variables and local-only examples |
| `.gitignore` | Excludes secrets, dependencies, build output, and logs |
| `docker-compose.yml` | Local PostgreSQL 16 and Redis 7 services |
| `README.md` | Product, architecture, setup, security, bootstrap, tests, and deployment guide |
| `IMPLEMENTATION_STATUS.md` | Exact implementation and verification status |
| `FILE_GUIDE.md` | This map of the package |

## Backend (API and database)

| File | Purpose |
|---|---|
| `backend/package.json` | API dependencies and scripts |
| `backend/prisma/schema.prisma` | Prisma data model and relationships |
| `backend/prisma/migrations/20261109000000_init/migration.sql` | Initial tables, indexes, foreign keys, and ledger/audit immutability triggers |
| `backend/prisma/migrations/20261109010000_bootstrap_function/migration.sql` | Restricted bootstrap role and one-time admin function |
| `backend/src/config.mjs` | Validates environment configuration |
| `backend/src/db.mjs` | Prisma client |
| `backend/src/app.mjs` | Express middleware, request IDs, rate limits, routes, and JSON-safe BigInt output |
| `backend/src/server.mjs` | Redis connection, listener, and graceful shutdown |
| `backend/src/lib/errors.mjs` | Standard API error envelope and error handler |
| `backend/src/lib/http.mjs` | Standard success response and BigInt-safe JSON conversion |
| `backend/src/lib/money.mjs` | Decimal-string parsing, integer-cent formatting, balance arithmetic, and journal balancing |
| `backend/src/lib/security.mjs` | bcrypt, access JWT, refresh token hashes, and constant-time secret comparison |
| `backend/src/lib/authz.mjs` | Role and account-ownership helpers |
| `backend/src/middleware/auth.mjs` | Access-token authentication and admin middleware |
| `backend/src/services/auth.mjs` | Refresh-cookie settings, session creation, and refresh-token rotation |
| `backend/src/services/audit.mjs` | Audit event helper |
| `backend/src/services/ledger.mjs` | Row-locked idempotent transfer posting and ledger integrity checks |
| `backend/src/routes/auth.mjs` | Register, login, refresh, logout, and current user endpoints |
| `backend/src/routes/onboarding.mjs` | User onboarding submission and status |
| `backend/src/routes/accounts.mjs` | Owner-scoped account view |
| `backend/src/routes/ledger.mjs` | Owner-scoped ledger view |
| `backend/src/routes/transfers.mjs` | Owner transfer creation and transfer lookup |
| `backend/src/routes/admin.mjs` | First-admin bootstrap, admin dashboard, users, roles, status, onboarding review, audit logs, integrity |
| `backend/src/routes/ops.mjs` | Health and readiness endpoints |
| `backend/src/scripts/prisma.mjs` | Loads environment and runs Prisma CLI |
| `backend/src/scripts/admin-bootstrap.mjs` | Calls the one-time bootstrap endpoint without printing secrets |
| `backend/src/scripts/seed.mjs` | Creates synthetic admin/user accounts and paired opening ledger entries |
| `backend/src/scripts/verify-deployment.mjs` | Checks frontend/API reachability and the end-to-end demo story |
| `backend/test/auth.test.mjs` | Auth, token comparison, role, and ownership unit tests |
| `backend/test/ledger.test.mjs` | Money/ledger unit tests and opt-in PostgreSQL ledger integration tests |
| `backend/test/e2e.test.mjs` | Opt-in HTTP integration tests |
| `backend/test/bootstrap.test.mjs` | One-time bootstrap integration test; requires a fresh database |

## Deployment SQL

| File | Purpose |
|---|---|
| `deployment/dev-db-roles.sql` | Local-only migrator/runtime/bootstrap database roles and passwords |
| `deployment/bootstrap-role-setup.sql` | DBA pre-migration setup for the restricted function-owner role |
| `deployment/runtime-privileges.sql` | Baseline grants for the restricted API runtime role |
| `deployment/grant-app-bootstrap.sql` | Narrow grant to execute the bootstrap function |

## Frontend (React)

| File | Purpose |
|---|---|
| `frontend/package.json` | React/Vite dependencies and scripts |
| `frontend/index.html` | Frontend HTML entry point |
| `frontend/vite.config.js` | Development API proxy and React plugin |
| `frontend/src/main.jsx` | React entry point |
| `frontend/src/api.js` | Authenticated API client with cookie credentials |
| `frontend/src/App.jsx` | Login/register, dashboard, onboarding, ledger, transfer, and admin pages |
| `frontend/src/styles.css` | Responsive financial-product UI styling |
