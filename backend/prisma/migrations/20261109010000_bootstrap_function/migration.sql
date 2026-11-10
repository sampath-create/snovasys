-- The database operator pre-creates the NOLOGIN function-owner role and grants
-- temporary membership to the migration role. The app runtime is never a member.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'balancevault_bootstrap_operator') THEN
    CREATE ROLE balancevault_bootstrap_operator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'balancevault_app') THEN
    CREATE ROLE balancevault_app;
  END IF;
END $$;
GRANT balancevault_bootstrap_operator TO CURRENT_USER;
GRANT USAGE, CREATE ON SCHEMA public TO balancevault_bootstrap_operator;
GRANT SELECT ON TABLE "User", "Role", "UserRole" TO balancevault_bootstrap_operator;
GRANT INSERT, UPDATE ON TABLE "User" TO balancevault_bootstrap_operator;
GRANT INSERT ON TABLE "Role", "UserRole", "AuditLog" TO balancevault_bootstrap_operator;

CREATE OR REPLACE FUNCTION public.balancevault_bootstrap_admin(p_email TEXT, p_password_hash TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user_id TEXT;
  v_user_role_id TEXT;
  v_admin_role_id TEXT;
BEGIN
  -- Serialize bootstrap attempts so concurrent first-admin requests cannot both win.
  PERFORM pg_advisory_xact_lock(782341902);

  IF EXISTS (
    SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r."id" = ur."roleId"
    WHERE r."name" = 'ADMIN'
  ) THEN
    RAISE EXCEPTION 'ADMIN_ALREADY_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO "Role" ("id", "name") VALUES (gen_random_uuid()::text, 'USER')
    ON CONFLICT ("name") DO NOTHING;
  INSERT INTO "Role" ("id", "name") VALUES (gen_random_uuid()::text, 'ADMIN')
    ON CONFLICT ("name") DO NOTHING;
  SELECT "id" INTO v_user_role_id FROM "Role" WHERE "name" = 'USER';
  SELECT "id" INTO v_admin_role_id FROM "Role" WHERE "name" = 'ADMIN';

  INSERT INTO "User" ("id", "email", "passwordHash", "status", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, lower(trim(p_email)), p_password_hash, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("email") DO UPDATE SET
      "passwordHash" = EXCLUDED."passwordHash", "status" = 'ACTIVE', "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "id" INTO v_user_id;

  INSERT INTO "UserRole" ("userId", "roleId") VALUES (v_user_id, v_user_role_id)
    ON CONFLICT ("userId", "roleId") DO NOTHING;
  INSERT INTO "UserRole" ("userId", "roleId") VALUES (v_user_id, v_admin_role_id)
    ON CONFLICT ("userId", "roleId") DO NOTHING;
  INSERT INTO "AuditLog" ("id", "actorId", "action", "entityType", "entityId", "metadata", "createdAt")
    VALUES (gen_random_uuid()::text, v_user_id, 'ADMIN_BOOTSTRAP', 'User', v_user_id,
            jsonb_build_object('method', 'one_time_bootstrap'), CURRENT_TIMESTAMP);

  RETURN v_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.balancevault_bootstrap_admin(TEXT, TEXT) FROM PUBLIC;
-- The restricted API LOGIN role must exist before this migration is applied.
-- Grant EXECUTE while the migration owner still owns the function.
GRANT EXECUTE ON FUNCTION public.balancevault_bootstrap_admin(TEXT, TEXT) TO balancevault_app;
ALTER FUNCTION public.balancevault_bootstrap_admin(TEXT, TEXT) OWNER TO balancevault_bootstrap_operator;
REVOKE CREATE ON SCHEMA public FROM balancevault_bootstrap_operator;
