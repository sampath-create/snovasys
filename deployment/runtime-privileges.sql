-- Run as a database owner. This is a baseline privilege grant for a restricted
-- API LOGIN role. Use the exact role name from DATABASE_URL.
GRANT CONNECT ON DATABASE balancevault TO balancevault_app;
GRANT USAGE ON SCHEMA public TO balancevault_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "User" TO balancevault_app;
GRANT SELECT, INSERT, UPDATE ON TABLE "Role", "UserRole", "Account", "JournalEntry", "Transfer", "RefreshToken", "OnboardingApplication" TO balancevault_app;
GRANT DELETE ON TABLE "UserRole" TO balancevault_app;
GRANT SELECT, INSERT ON TABLE "LedgerEntry", "AuditLog" TO balancevault_app;
GRANT SELECT ON TABLE "_prisma_migrations" TO balancevault_app;
-- EXECUTE is granted by the bootstrap migration before function ownership is transferred.

-- Important: do NOT grant UPDATE/DELETE on LedgerEntry or AuditLog. The runtime
-- role does not own the tables. The DB triggers additionally reject mutation
-- of completed journals/ledger entries and audit logs.
REVOKE UPDATE, DELETE ON TABLE "LedgerEntry", "AuditLog" FROM balancevault_app;
