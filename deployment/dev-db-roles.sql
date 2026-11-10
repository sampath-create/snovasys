-- Development-only bootstrap script mounted into the PostgreSQL container.
-- These passwords are local examples; never reuse them in a hosted environment.
CREATE ROLE balancevault_migrator LOGIN CREATEDB CREATEROLE PASSWORD 'local-migrator-change-me';
CREATE ROLE balancevault_app LOGIN PASSWORD 'local-app-change-me';
CREATE ROLE balancevault_bootstrap_operator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
-- Only the migration operator can temporarily SET ROLE to the function owner.
-- The API runtime role is deliberately not a member.
GRANT balancevault_bootstrap_operator TO balancevault_migrator;
CREATE DATABASE balancevault OWNER balancevault_migrator;
GRANT CONNECT ON DATABASE balancevault TO balancevault_app;
