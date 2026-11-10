CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_status_idx" ON "User"("status");

CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

CREATE TABLE "UserRole" (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId", "roleId")
);
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

CREATE TABLE "Account" (
  "id" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "userId" TEXT,
  "type" TEXT NOT NULL DEFAULT 'USER',
  "status" TEXT NOT NULL DEFAULT 'INACTIVE',
  "currentBalanceCents" BIGINT NOT NULL DEFAULT 0,
  "ledgerVersion" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Account_accountNumber_key" ON "Account"("accountNumber");
CREATE INDEX "Account_userId_status_idx" ON "Account"("userId", "status");

CREATE TABLE "JournalEntry" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "JournalEntry_reference_key" ON "JournalEntry"("reference");
CREATE INDEX "JournalEntry_status_createdAt_idx" ON "JournalEntry"("status", "createdAt");

CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "side" TEXT NOT NULL,
  "amountCents" BIGINT NOT NULL,
  "balanceAfterCents" BIGINT NOT NULL,
  "accountSequence" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LedgerEntry_positive_amount" CHECK ("amountCents" > 0),
  CONSTRAINT "LedgerEntry_valid_side" CHECK ("side" IN ('DEBIT', 'CREDIT'))
);
CREATE INDEX "LedgerEntry_accountId_createdAt_idx" ON "LedgerEntry"("accountId", "createdAt");
CREATE INDEX "LedgerEntry_journalEntryId_idx" ON "LedgerEntry"("journalEntryId");
CREATE UNIQUE INDEX "LedgerEntry_accountId_accountSequence_key" ON "LedgerEntry"("accountId", "accountSequence");

CREATE TABLE "Transfer" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fromAccountId" TEXT NOT NULL,
  "toAccountId" TEXT NOT NULL,
  "amountCents" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "journalEntryId" TEXT,
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Transfer_positive_amount" CHECK ("amountCents" > 0),
  CONSTRAINT "Transfer_distinct_accounts" CHECK ("fromAccountId" <> "toAccountId")
);
CREATE UNIQUE INDEX "Transfer_userId_idempotencyKey_key" ON "Transfer"("userId", "idempotencyKey");
CREATE UNIQUE INDEX "Transfer_journalEntryId_key" ON "Transfer"("journalEntryId");
CREATE INDEX "Transfer_userId_createdAt_idx" ON "Transfer"("userId", "createdAt");
CREATE INDEX "Transfer_fromAccountId_createdAt_idx" ON "Transfer"("fromAccountId", "createdAt");

CREATE TABLE "RefreshToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "replacedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "requestId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

CREATE TABLE "OnboardingApplication" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'DRAFT',
  "data" JSONB NOT NULL,
  "reviewReason" TEXT,
  "reviewedById" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnboardingApplication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OnboardingApplication_userId_createdAt_idx" ON "OnboardingApplication"("userId", "createdAt");
CREATE INDEX "OnboardingApplication_state_createdAt_idx" ON "OnboardingApplication"("state", "createdAt");

ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnboardingApplication" ADD CONSTRAINT "OnboardingApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnboardingApplication" ADD CONSTRAINT "OnboardingApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A completed journal is immutable. The state transition validates the debit/credit totals.
CREATE OR REPLACE FUNCTION balancevault_guard_journal() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE debit_total BIGINT; credit_total BIGINT; line_count BIGINT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'PENDING' THEN RAISE EXCEPTION 'journal entries must begin in PENDING state' USING ERRCODE = '55000'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'COMPLETED' THEN RAISE EXCEPTION 'completed journal entries are immutable' USING ERRCODE = '55000'; END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" = 'COMPLETED' THEN RAISE EXCEPTION 'completed journal entries are immutable' USING ERRCODE = '55000'; END IF;
  IF OLD."status" <> 'PENDING' OR NEW."status" NOT IN ('COMPLETED', 'FAILED') THEN
    RAISE EXCEPTION 'invalid journal state transition' USING ERRCODE = '55000';
  END IF;
  IF NEW."status" = 'COMPLETED' THEN
    SELECT COALESCE(SUM("amountCents") FILTER (WHERE "side" = 'DEBIT'), 0),
           COALESCE(SUM("amountCents") FILTER (WHERE "side" = 'CREDIT'), 0), COUNT(*)
      INTO debit_total, credit_total, line_count
      FROM "LedgerEntry" WHERE "journalEntryId" = OLD."id";
    IF line_count < 2 OR debit_total <> credit_total THEN
      RAISE EXCEPTION 'journal entry is not balanced' USING ERRCODE = '23514';
    END IF;
    NEW."completedAt" := COALESCE(NEW."completedAt", CURRENT_TIMESTAMP);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "JournalEntry_immutable_completed" BEFORE INSERT OR UPDATE OR DELETE ON "JournalEntry"
FOR EACH ROW EXECUTE FUNCTION balancevault_guard_journal();

CREATE OR REPLACE FUNCTION balancevault_guard_ledger_entry() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE parent_status TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT "status" INTO parent_status FROM "JournalEntry" WHERE "id" = OLD."journalEntryId";
    IF parent_status = 'COMPLETED' THEN RAISE EXCEPTION 'completed ledger entries are immutable' USING ERRCODE = '55000'; END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  SELECT "status" INTO parent_status FROM "JournalEntry" WHERE "id" = NEW."journalEntryId";
  IF parent_status IS DISTINCT FROM 'PENDING' THEN
    RAISE EXCEPTION 'ledger entries can only be added to pending journals' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "LedgerEntry_append_only" BEFORE INSERT OR UPDATE OR DELETE ON "LedgerEntry"
FOR EACH ROW EXECUTE FUNCTION balancevault_guard_ledger_entry();

CREATE OR REPLACE FUNCTION balancevault_guard_audit_log() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN RAISE EXCEPTION 'audit logs are append-only' USING ERRCODE = '55000'; END $$;
CREATE TRIGGER "AuditLog_append_only" BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION balancevault_guard_audit_log();
