-- HUB-04 PROVISORIA: synthetic PostgreSQL-17 transactional tests.
-- Never run this fixture on an existing / remote Supabase database.
\set ON_ERROR_STOP on
begin;

insert into auth.users(id) values
('10000000-0000-0000-0000-000000000011'),
('10000000-0000-0000-0000-000000000012'),
('10000000-0000-0000-0000-000000000013');

-- Trusted bootstrap fixture ONLY in disposable PostgreSQL.
insert into hub_private.admin_accounts (auth_user_id,is_enabled,disabled_at) values
('10000000-0000-0000-0000-000000000011',true,null),
('10000000-0000-0000-0000-000000000012',false,transaction_timestamp());
insert into hub_private.permission_grants
(subject_user_id,capability_code,scope_kind,scope_key,granted_by_auth_user_id)
values
('10000000-0000-0000-0000-000000000011','users.manage','module','core',
 '10000000-0000-0000-0000-000000000013'),
('10000000-0000-0000-0000-000000000011','crm.read','module','crm',
 '10000000-0000-0000-0000-000000000013');

-- Confirm a synthetic managed account does NOT receive permissions by default.
do $$
begin
  if hub_private.actor_can_manage('10000000-0000-0000-0000-000000000012') then
    raise exception 'disabled actor was authorized';
  end if;
end $$;

-- Actor can create a disabled account and must audit it.
select hub_private.create_admin_account(
 '10000000-0000-0000-0000-000000000011',
 '10000000-0000-0000-0000-000000000013');
do $$
begin
 if (select is_enabled from hub_private.admin_accounts
     where auth_user_id='10000000-0000-0000-0000-000000000013') then
   raise exception 'admin account automatically enabled';
 end if;
 if (select count(*) from hub_private.permission_audit_events
     where event_type='account_created')<>1 then
   raise exception 'account creation audit missing';
 end if;
end $$;

-- Status transitions are written and audited atomically.
select hub_private.set_admin_enabled(
 '10000000-0000-0000-0000-000000000011',
 '10000000-0000-0000-0000-000000000013',true);

-- No self-assignment or granting capabilities actor does not hold.
do $$
begin
 begin
  perform hub_private.issue_capability_grant(
   '10000000-0000-0000-0000-000000000011',
   '10000000-0000-0000-0000-000000000011','crm.read','module','crm');
  raise exception 'self grant accepted';
 exception when insufficient_privilege then null;
 end;
 begin
  perform hub_private.issue_capability_grant(
   '10000000-0000-0000-0000-000000000011',
   '10000000-0000-0000-0000-000000000013','crm.write','module','crm');
  raise exception 'privilege escalation accepted';
 exception when insufficient_privilege then null;
 end;
 begin
  perform hub_private.issue_capability_grant(
   '10000000-0000-0000-0000-000000000012',
   '10000000-0000-0000-0000-000000000013','crm.read','module','crm');
  raise exception 'disabled actor grant accepted';
 exception when insufficient_privilege then null;
 end;
end $$;

select hub_private.issue_capability_grant(
 '10000000-0000-0000-0000-000000000011',
 '10000000-0000-0000-0000-000000000013','crm.read','module','crm');

do $$
declare g uuid;
begin
 select id into g from hub_private.permission_grants
 where subject_user_id = '10000000-0000-0000-0000-000000000013'
 and capability_code='crm.read';
 if g is null then raise exception 'grant missing'; end if;
 if (select count(*) from hub_private.permission_audit_events
 where event_type='grant_created' and grant_id=g) <> 1 then
  raise exception 'grant creation audit missing';
 end if;

 -- Beneficiary cannot revoke its own grant.
 begin
  perform hub_private.revoke_capability_grant(
   '10000000-0000-0000-0000-000000000013',g);
  raise exception 'self-revocation accepted';
 exception when insufficient_privilege then null;
 end;
 perform hub_private.revoke_capability_grant(
  '10000000-0000-0000-0000-000000000011',g);
 if (select count(*) from hub_private.permission_audit_events
 where event_type='grant_revoked' and grant_id=g) <> 1 then
  raise exception 'revocation audit missing';
 end if;
 if (select revoked_at is null from hub_private.permission_grants where id=g) then
  raise exception 'grant not revoked';
 end if;
end $$;

-- API roles still cannot call the private writers, nor access private tables.
do $$
declare fn record;
begin
 for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='hub_private' loop
  if has_function_privilege('anon',fn.oid,'EXECUTE')
  or has_function_privilege('authenticated',fn.oid,'EXECUTE')
  or has_function_privilege('service_role',fn.oid,'EXECUTE') then
    raise exception 'unexpected execute grant';
  end if;
 end loop;
 if (select count(*) from pg_policies where schemaname='hub_private')<>0 then
  raise exception 'unexpected RLS policy';
 end if;
 if (select count(*) from hub_private.permission_audit_events)<>4 then
  raise exception 'unexpected audit event count';
 end if;
 raise notice 'PASS: audited writer transactions, denial and object ACLs';
end $$;
rollback;
