-- Run as a PostgreSQL superuser/DBA BEFORE applying Prisma migrations.
-- The API runtime login must not be granted membership in this role.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'balancevault_bootstrap_operator') THEN
    CREATE ROLE balancevault_bootstrap_operator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;
GRANT balancevault_bootstrap_operator TO balancevault_migrator;
