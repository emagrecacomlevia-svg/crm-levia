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

-- AT-012: 48 effective ACL checks, one per role, table and DML operation.
select pg_temp.assert_ok(
  (select bool_and(not has_table_privilege(r.role_name,c.oid,o.operation))
  from (values ('anon'),('authenticated'),('service_role')) r(role_name)
  cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) o(operation)
  cross join pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='hub_private' and c.relkind='r'),
  '48 individual role/table/DML privileges denied');
select pg_temp.assert_ok(
  (select not rolbypassrls from pg_roles where rolname='service_role'),
  'service_role test stub is NOT managed BYPASSRLS role');

set role anon;
do $$
declare
  tab text;
  pk text;
  verb text;
  statement text;
  denied boolean;
begin
  for tab, pk in select * from (values
    ('admin_accounts','auth_user_id'),('capabilities','code'),
    ('permission_grants','id'),('permission_audit_events','id')
  ) as targets(t,p)
  loop
    foreach verb in array array['SELECT','INSERT','UPDATE','DELETE']
    loop
      statement := case verb
        when 'SELECT' then format('select count(*) from hub_private.%I',tab)
        when 'INSERT' then format('insert into hub_private.%I default values',tab)
        when 'UPDATE' then format('update hub_private.%I set %I=%I where true',tab,pk,pk)
        when 'DELETE' then format('delete from hub_private.%I where true',tab)
      end;
      denied := false;
      begin
        execute statement;
      exception when insufficient_privilege then denied:=true;
      end;
      if not denied then
        raise exception 'FORBIDDEN DML ACCEPTED anon: % hub_private.%',verb,tab;
      end if;
      raise notice '42501 DENIED: anon % hub_private.%',verb,tab;
    end loop;
  end loop;
end;
$$;
reset role;

set role authenticated;
do $$
declare
  tab text;
  pk text;
  verb text;
  statement text;
  denied boolean;
begin
  for tab, pk in select * from (values
    ('admin_accounts','auth_user_id'),('capabilities','code'),
    ('permission_grants','id'),('permission_audit_events','id')
  ) as targets(t,p)
  loop
    foreach verb in array array['SELECT','INSERT','UPDATE','DELETE']
    loop
      statement := case verb
        when 'SELECT' then format('select count(*) from hub_private.%I',tab)
        when 'INSERT' then format('insert into hub_private.%I default values',tab)
        when 'UPDATE' then format('update hub_private.%I set %I=%I where true',tab,pk,pk)
        when 'DELETE' then format('delete from hub_private.%I where true',tab)
      end;
      denied := false;
      begin
        execute statement;
      exception when insufficient_privilege then denied:=true;
      end;
      if not denied then
        raise exception 'FORBIDDEN DML ACCEPTED authenticated: % hub_private.%',verb,tab;
      end if;
      raise notice '42501 DENIED: authenticated % hub_private.%',verb,tab;
    end loop;
  end loop;
end;
$$;
reset role;

set role service_role;
do $$
declare
  tab text;
  pk text;
  verb text;
  statement text;
  denied boolean;
begin
  for tab, pk in select * from (values
    ('admin_accounts','auth_user_id'),('capabilities','code'),
    ('permission_grants','id'),('permission_audit_events','id')
  ) as targets(t,p)
  loop
    foreach verb in array array['SELECT','INSERT','UPDATE','DELETE']
    loop
      statement := case verb
        when 'SELECT' then format('select count(*) from hub_private.%I',tab)
        when 'INSERT' then format('insert into hub_private.%I default values',tab)
        when 'UPDATE' then format('update hub_private.%I set %I=%I where true',tab,pk,pk)
        when 'DELETE' then format('delete from hub_private.%I where true',tab)
      end;
      denied := false;
      begin
        execute statement;
      exception when insufficient_privilege then denied:=true;
      end;
      if not denied then
        raise exception 'FORBIDDEN DML ACCEPTED service_role: % hub_private.%',verb,tab;
      end if;
      raise notice '42501 DENIED: service_role % hub_private.%',verb,tab;
    end loop;
  end loop;
end;
$$;
reset role;

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

-- AT-012 temporal constraints, valid future scheduling and synthetic deletion.
insert into hub_private.permission_grants
(subject_user_id,capability_code,scope_kind,scope_key,granted_at,revoked_at,revoked_by_auth_user_id)
values ('10000000-0000-0000-0000-000000000002','crm.write','module','crm',
 now()-interval '2 days',now()-interval '1 day','10000000-0000-0000-0000-000000000003');
select pg_temp.assert_ok(
 (select count(*)=1 from hub_private.permission_grants
 where capability_code='crm.write' and revoked_at > granted_at
 and revoked_by_auth_user_id is not null), 'valid chronological revocation');
insert into hub_private.permission_grants
(subject_user_id,capability_code,scope_kind,scope_key,granted_at,valid_from,valid_until)
values ('10000000-0000-0000-0000-000000000002','content.review_scientific',
'resource','social:future',now(),now()+interval '7 days',now()+interval '9 days');
select pg_temp.assert_ok(
 (select count(*)=1 from hub_private.permission_grants where
 capability_code='content.review_scientific' and valid_from>now() and revoked_at is null),
 'future scheduled unrevoked grant allowed');
insert into hub_private.permission_grants(subject_user_id,capability_code,scope_kind,scope_key)
values ('10000000-0000-0000-0000-000000000002','content.review_editorial','module','social');
select pg_temp.assert_ok(
 (select count(*)=1 from hub_private.permission_grants where
 capability_code='content.review_editorial' and revoked_at is null),
 'NULL revoked_at allowed');

do $$
declare denied boolean;
begin
  denied:=false;
  begin
    insert into hub_private.permission_grants
    (subject_user_id,capability_code,scope_kind,scope_key,granted_at,revoked_at)
    values ('10000000-0000-0000-0000-000000000002','users.manage','module','core',
    now(),now()-interval '1 second');
  exception when check_violation then denied:=true;
  end;
  if not denied then raise exception 'early revoked_at was accepted'; end if;
  raise notice 'CHECK denied early revocation';

  denied:=false;
  begin
    insert into hub_private.permission_grants
    (subject_user_id,capability_code,scope_kind,scope_key,valid_from,valid_until)
    values ('10000000-0000-0000-0000-000000000002','social.write','module','social',
    now()+interval '1 day',now()+interval '1 day');
  exception when check_violation then denied:=true;
  end;
  if not denied then raise exception 'empty validity window accepted'; end if;
  raise notice 'CHECK denied empty validity window';

  denied:=false;
  begin
    insert into hub_private.permission_grants
    (subject_user_id,capability_code,scope_kind,scope_key,valid_from,valid_until)
    values ('10000000-0000-0000-0000-000000000002','social.write','module','social',
    now()+interval '2 days',now()+interval '1 day');
  exception when check_violation then denied:=true;
  end;
  if not denied then raise exception 'inverted validity window accepted'; end if;
  raise notice 'CHECK denied inverted validity window';

  denied:=false;
  begin
    insert into hub_private.permission_grants
    (subject_user_id,capability_code,scope_kind,scope_key,revoked_by_auth_user_id)
    values ('10000000-0000-0000-0000-000000000002','content.approve_commercial',
    'module','social','10000000-0000-0000-0000-000000000003');
  exception when check_violation then denied:=true;
  end;
  if not denied then raise exception 'revoker without timestamp accepted'; end if;
  raise notice 'CHECK denied revoker without timestamp';
end;
$$;

-- ACL denies 42501; RLS independently denies SELECT with a temporary grant
-- in this rolled-back and network-isolated transaction, never in migration.
grant usage on schema hub_private to anon;
grant select on hub_private.admin_accounts to anon;
set role anon;
select pg_temp.assert_ok(
 (select count(*)=0 from hub_private.admin_accounts),
 'deny-all RLS filters SELECT with temporary TEST grant');
reset role;
revoke select on hub_private.admin_accounts from anon;
revoke usage on schema hub_private from anon;
select pg_temp.assert_ok(
 not has_table_privilege('anon','hub_private.admin_accounts','SELECT')
 and not has_schema_privilege('anon','hub_private','USAGE'),
 'test-only privileges removed');

-- Audit event is explicitly inserted: there is NO automatic audit mechanism.
insert into hub_private.permission_audit_events
(event_type,subject_user_id,grant_id,actor_auth_user_id,context)
select 'grant_revoked',subject_user_id,id,
'10000000-0000-0000-0000-000000000003'::uuid,'{}'::jsonb
from hub_private.permission_grants
where subject_user_id='10000000-0000-0000-0000-000000000002'
and capability_code='crm.write';
select pg_temp.assert_ok(
 (select count(*)=1 from hub_private.permission_audit_events
 where subject_user_id='10000000-0000-0000-0000-000000000002'),
 'synthetic audit event manually created');
delete from auth.users where id='10000000-0000-0000-0000-000000000003';
select pg_temp.assert_ok(
 (select count(*)=1 from hub_private.permission_grants
 where capability_code='crm.write' and revoked_by_auth_user_id is null),
 'grant actor FK SET NULL after deletion');
select pg_temp.assert_ok(
 (select count(*)=1 from hub_private.permission_audit_events
 where subject_user_id='10000000-0000-0000-0000-000000000002'
 and actor_auth_user_id is null),
 'audit actor FK SET NULL, event survives');

select pg_temp.assert_ok(
 (select count(*)>=4 from hub_private.permission_grants
 where subject_user_id='10000000-0000-0000-0000-000000000002'),
 'grants existed before subject deletion');
delete from auth.users where id='10000000-0000-0000-0000-000000000002';
select pg_temp.assert_ok(
 (select count(*)=0 from hub_private.admin_accounts
 where auth_user_id='10000000-0000-0000-0000-000000000002'),
 'account CASCADE deleted');
select pg_temp.assert_ok(
 (select count(*)=0 from hub_private.permission_grants
 where subject_user_id='10000000-0000-0000-0000-000000000002'),
 'all grants CASCADE deleted');
select pg_temp.assert_ok(
 (select count(*)=1 from hub_private.permission_audit_events
 where subject_user_id='10000000-0000-0000-0000-000000000002'
 and grant_id is not null and actor_auth_user_id is null),
 'historical event retained UUIDs but not actor or grant record');
select pg_temp.assert_ok(
 (select count(*)=9 from hub_private.capabilities),
 'catalog preserved after Auth user deletion');
select 'HUB-04B1-C01: 48 ACL attempts and chronology/cascade checks passed' as c01_result;

select 'HUB-04B1 local assertions passed; RLS remains deny-all' as result;
rollback;
