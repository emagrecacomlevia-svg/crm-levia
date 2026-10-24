-- HUB-04B2A-C01: assertions ONLY against disposable PostgreSQL 17.
-- Test role setup approximates some managed attributes; not full Supabase parity.
DO $audit$
DECLARE
  t_name text;
  who text;
BEGIN
  IF NOT (SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'service_role must simulate managed BYPASSRLS';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated') AND rolbypassrls) THEN
    RAISE EXCEPTION 'client role unexpectedly bypasses RLS';
  END IF;
  IF (SELECT pg_catalog.pg_get_userbyid(nspowner) FROM pg_catalog.pg_namespace WHERE nspname='hub_private') <> 'hub_migration_executor' THEN
    RAISE EXCEPTION 'migration owner mismatch';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='hub_private' AND c.relkind='r') <> 4 THEN
    RAISE EXCEPTION 'expected four private tables';
  END IF;
  IF (SELECT count(*) FROM hub_private.capabilities) <> 9 THEN
    RAISE EXCEPTION 'expected nine static capability codes';
  END IF;
  IF (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261024130000') <> 1 THEN
    RAISE EXCEPTION 'synthetic history entry absent';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='hub_private' AND c.relkind='r' AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'RLS missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='hub_private') THEN
    RAISE EXCEPTION 'unexpected policy';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_constraint co JOIN pg_catalog.pg_class c ON c.oid=co.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='hub_private' AND co.contype='f') < 5 THEN
    RAISE EXCEPTION 'missing foreign key';
  END IF;
  FOR who IN SELECT unnest(ARRAY['anon','authenticated','service_role']) LOOP
    IF pg_catalog.has_schema_privilege(who,'hub_private','USAGE')
      OR pg_catalog.has_schema_privilege(who,'hub_private','CREATE') THEN
      RAISE EXCEPTION 'client role has private schema access: %',who;
    END IF;
    FOR t_name IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='hub_private' LOOP
      IF pg_catalog.has_table_privilege(who, 'hub_private.' || t_name, 'SELECT')
        OR pg_catalog.has_table_privilege(who,'hub_private.' || t_name,'INSERT')
        OR pg_catalog.has_table_privilege(who,'hub_private.' || t_name,'UPDATE')
        OR pg_catalog.has_table_privilege(who,'hub_private.' || t_name,'DELETE') THEN
        RAISE EXCEPTION 'client role has table rights: % / %',who,t_name;
      END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_default_acl d JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) acl
    LEFT JOIN pg_catalog.pg_roles r ON r.oid=acl.grantee
    WHERE n.nspname='hub_private' AND (acl.grantee=0 OR r.rolname IN ('anon','authenticated','service_role'))
  ) THEN
    RAISE EXCEPTION 'private schema default privileges unexpectedly granted';
  END IF;
  RAISE NOTICE 'PASS: schema, owner, roles, RLS, 9 capabilities, FKs, ACL, default ACL and synthetic history';
END
$audit$;
