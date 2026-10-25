-- HUB-04: synthetic-only PostgreSQL-17 once-bootstrap QA. DO NOT RUN REMOTELY.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id) values
 ('20000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002'),
 ('20000000-0000-0000-0000-000000000003');

do $$
begin
  begin
    perform hub_private.bootstrap_first_admin(
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'Controlled synthetic QA with separate approver');
    raise exception 'self bootstrap improperly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform hub_private.bootstrap_first_admin(
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002', 'short');
    raise exception 'unjustified bootstrap succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform hub_private.bootstrap_first_admin(
      '20000000-0000-0000-0000-000000000099',
      '20000000-0000-0000-0000-000000000002',
      'Controlled synthetic QA with separate approver');
    raise exception 'unknown actor bootstrap succeeded';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from hub_private.admin_accounts) <> 0 then
    raise exception 'failed bootstrap persisted an admin';
  end if;
end $$;


-- MOCK: force audit-event persistence error and verify atomic rollback.
create function pg_temp.reject_mock_audit() returns trigger
language plpgsql as $$
begin
  raise exception 'synthetic audit storage failure' using errcode = '23514';
end;
$$;
create trigger hub04_reject_mock_audit before insert
on hub_private.permission_audit_events
for each row execute function pg_temp.reject_mock_audit();
do $$
begin
  begin
    perform hub_private.bootstrap_first_admin(
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002',
      'Attempted isolated bootstrap with audit persistence failure');
    raise exception 'audit failure was ignored';
  exception when check_violation then null;
  end;
  if (select count(*) from hub_private.admin_accounts) <> 0
     or (select count(*) from hub_private.permission_grants) <> 0
     or (select count(*) from hub_private.permission_audit_events) <> 0 then
    raise exception 'audit failure left a partially provisioned admin';
  end if;
end;
$$;
drop trigger hub04_reject_mock_audit on hub_private.permission_audit_events;

select hub_private.bootstrap_first_admin(
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  'Controlled QA initial administrator with independent actor');

do $$
begin
  if (select count(*) from hub_private.admin_accounts where is_enabled and disabled_at is null) <> 1
     or (select count(*) from hub_private.permission_grants) <> 2
     or (select count(*) from hub_private.permission_audit_events) <> 4 then
    raise exception 'atomic bootstrap account/grants/audit mismatch';
  end if;
  if exists (select 1 from hub_private.permission_grants
      where capability_code not in ('core.read','users.manage')
        or scope_kind <> 'module' or scope_key <> 'core') then
    raise exception 'bootstrap elevated unexpected capability';
  end if;
  if not hub_private.actor_can_manage('20000000-0000-0000-0000-000000000002') then
    raise exception 'bootstrap management grant missing';
  end if;
  begin
    perform hub_private.bootstrap_first_admin(
      '20000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000001',
      'Attempt to bootstrap again after first administrator');
    raise exception 'repeated bootstrap succeeded';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from hub_private.admin_accounts) <> 1 then
    raise exception 'repeated bootstrap created an account';
  end if;
end $$;

do $$
declare v_oid oid;
begin
  select p.oid into v_oid from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='hub_private' and p.proname='bootstrap_first_admin';
  if v_oid is null
    or has_function_privilege('anon',v_oid,'EXECUTE')
    or has_function_privilege('authenticated',v_oid,'EXECUTE')
    or has_function_privilege('service_role',v_oid,'EXECUTE') then
    raise exception 'private bootstrap function is exposed';
  end if;
end $$;
rollback;
do $$
begin
  if (select count(*) from hub_private.admin_accounts) <> 0
   or (select count(*) from hub_private.permission_grants) <> 0
   or (select count(*) from hub_private.permission_audit_events) <> 0 then
    raise exception 'rollback leaked bootstrap fixture';
  end if;
  raise notice 'PASS: atomic one-time bootstrap, 2 minimal grants, 4 audit events, rollback';
end $$;
