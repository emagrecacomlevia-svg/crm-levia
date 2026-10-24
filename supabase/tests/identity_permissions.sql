-- Local disposable PostgreSQL only. Requires postgres owner, anon/authenticated/service_role
-- and a minimal auth.users(id uuid primary key) TEST STUB. NEVER target remote Supabase.
\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_ok(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition is distinct from true then
    raise exception 'HUB-04B1 failed: %', description;
  end if;
end;
$$;

select pg_temp.assert_ok(
  (select count(*) = 4 from information_schema.tables
   where table_schema = 'hub_private' and table_type = 'BASE TABLE'),
  'four authorization tables');
select pg_temp.assert_ok(
  (select count(*) = 9 from hub_private.capabilities),
  'nine distinct capabilities');
select pg_temp.assert_ok(
  (select count(*) = 4 from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'hub_private' and c.relkind = 'r' and c.relrowsecurity),
  'RLS on all four tables');
select pg_temp.assert_ok(
  (select count(*) = 0 from pg_policies where schemaname = 'hub_private'),
  'no positive row policies in the private schema');
select pg_temp.assert_ok(
  (select count(*) = 2 from pg_indexes where schemaname = 'hub_private'
   and indexname in ('permission_grant_one_unrevoked_scope', 'permission_audit_by_subject_date')),
  'reviewed secondary indexes');
select pg_temp.assert_ok(
  (select count(*) = 4 from pg_constraint k join pg_namespace n on n.oid = k.connamespace
   where n.nspname = 'hub_private' and k.contype = 'p'),
  'primary keys exist');
select pg_temp.assert_ok(
  (select count(*) >= 6 from pg_constraint k join pg_namespace n on n.oid = k.connamespace
   where n.nspname = 'hub_private' and k.contype = 'f'),
  'Auth/account/catalog foreign keys exist');

select pg_temp.assert_ok(
  not has_schema_privilege('anon', 'hub_private', 'USAGE')
  and not has_schema_privilege('authenticated', 'hub_private', 'USAGE')
  and not has_schema_privilege('service_role', 'hub_private', 'USAGE'),
  'API roles cannot use private schema');
select pg_temp.assert_ok(
  (select bool_and(
    not has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
    and not has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
    and not has_table_privilege('service_role', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
   ) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='hub_private' and c.relkind='r'),
  'zero API DML grants');

-- Exercise real PostgreSQL permission failures as API roles in this isolated database.
set role anon;
do $$
begin
  begin
    perform 1 from hub_private.admin_accounts;
    raise exception 'anon unexpectedly read accounts';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
set role authenticated;
do $$
begin
  begin
    perform 1 from hub_private.permission_grants;
    raise exception 'authenticated unexpectedly read grants';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into hub_private.capabilities (code, description) values ('crm.manage', 'unauthorized');
    raise exception 'authenticated unexpectedly inserted catalog row';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- The following fixtures exist in a transaction rolled back after local CI.
insert into auth.users(id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003');
insert into hub_private.admin_accounts(auth_user_id) values
  ('10000000-0000-0000-0000-000000000001');
insert into hub_private.admin_accounts(auth_user_id, is_enabled, disabled_at) values
  ('10000000-0000-0000-0000-000000000002', true, null);
select pg_temp.assert_ok(
  (select not is_enabled and disabled_at is not null from hub_private.admin_accounts
   where auth_user_id='10000000-0000-0000-0000-000000000001'),
  'new account is disabled by default');

insert into hub_private.permission_grants (
  subject_user_id, capability_code, scope_kind, scope_key, granted_by_auth_user_id, valid_until
) values (
  '10000000-0000-0000-0000-000000000002', 'crm.read', 'module', 'crm',
  '10000000-0000-0000-0000-000000000003', now()+interval '1 day'
);

do $$
begin
  begin
    insert into hub_private.permission_grants(subject_user_id,capability_code,scope_kind,scope_key)
    values ('10000000-0000-0000-0000-000000000002','crm.read','module','crm');
    raise exception 'duplicate unrevoked grant accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into hub_private.permission_grants(subject_user_id,capability_code,scope_kind,scope_key)
    values ('10000000-0000-0000-0000-000000000002','crm.write','module','social');
    raise exception 'cross-domain scope accepted';
  exception when check_violation then null;
  end;
  begin
    insert into hub_private.permission_grants(subject_user_id,capability_code,scope_kind,scope_key,valid_until)
    values ('10000000-0000-0000-0000-000000000002','social.read','module','social',now()-interval '1 day');
    raise exception 'inverted validity accepted';
  exception when check_violation then null;
  end;
  begin
    insert into hub_private.permission_grants(subject_user_id,capability_code,scope_kind,scope_key,granted_by_auth_user_id)
    values ('10000000-0000-0000-0000-000000000002','social.write','module','social',
    '10000000-0000-0000-0000-000000000002');
    raise exception 'self assignment accepted';
  exception when check_violation then null;
  end;
  begin
    insert into hub_private.admin_accounts(auth_user_id)
    values ('10000000-0000-0000-0000-000000000099');
    raise exception 'unknown Auth user accepted';
  exception when foreign_key_violation then null;
  end;
end;
$$;

-- Revocation/expiration and disabled-account checks are diagnostic, NOT positive RLS tests:
-- no API caller has grants or a positive policy at this phase.
insert into hub_private.permission_grants
(subject_user_id,capability_code,scope_kind,scope_key,valid_from,valid_until)
values
('10000000-0000-0000-0000-000000000001','core.read','module','core',now()-interval '2 days',now()-interval '1 day'),
('10000000-0000-0000-0000-000000000002','social.read','module','social',now()-interval '2 days',null);
update hub_private.permission_grants set revoked_at=now()
where capability_code='social.read';
select pg_temp.assert_ok(
  (select count(*) = 1 from hub_private.permission_grants g
   join hub_private.admin_accounts a on a.auth_user_id=g.subject_user_id
   where a.is_enabled and g.revoked_at is null
     and g.valid_from <= now() and (g.valid_until is null or g.valid_until>now())),
  'only an active, unrevoked grant of an enabled account qualifies for FUTURE authorization');

select 'HUB-04B1 local assertions passed; RLS remains deny-all' as result;
rollback;
