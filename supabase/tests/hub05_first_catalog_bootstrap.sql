-- HUB-05 bootstrap: synthetic-only, PostgreSQL 17 disposable, ALL rows rollback.
-- No real LEVIA authorization/identity/grants are used.
\set ON_ERROR_STOP on
begin;
do $$
begin
  if (select count(*) from hub_private.permission_grants
      where capability_code in ('catalog.read','catalog.write'))<>0 then
    raise exception 'Bootstrap migration must never grant catalog capabilities';
  end if;
  if has_schema_privilege('anon','hub_private','USAGE')
    or has_schema_privilege('authenticated','hub_private','USAGE')
    or has_schema_privilege('service_role','hub_private','USAGE')
    or has_function_privilege('anon','hub_private.bootstrap_initial_catalog_grants(uuid,uuid,text,text,timestamptz)','EXECUTE')
    or has_function_privilege('authenticated','hub_private.bootstrap_initial_catalog_grants(uuid,uuid,text,text,timestamptz)','EXECUTE')
    or has_function_privilege('service_role','hub_private.bootstrap_initial_catalog_grants(uuid,uuid,text,text,timestamptz)','EXECUTE') then
    raise exception 'Bootstrap function or schema exposed to a client role';
  end if;
end $$;

-- The recorded original HUB-04 approver is independent of the already
-- enabled initial admin, and is an EXISTING synthetic Auth identity.
insert into auth.users(id) values
 ('c0000000-0000-4000-8000-000000000001'),
 ('c0000000-0000-4000-8000-000000000002'),
 ('c0000000-0000-4000-8000-000000000003');
insert into auth.sessions(id,user_id) values
 ('c1000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000002');
insert into hub_private.admin_accounts
 (auth_user_id,is_enabled,disabled_at,created_by_auth_user_id) values
 ('c0000000-0000-4000-8000-000000000002',true,null,
  'c0000000-0000-4000-8000-000000000001');
with original as (
 insert into hub_private.permission_grants
 (subject_user_id,capability_code,scope_kind,scope_key,granted_by_auth_user_id)
 values
 ('c0000000-0000-4000-8000-000000000002','core.read','module','core','c0000000-0000-4000-8000-000000000001'),
 ('c0000000-0000-4000-8000-000000000002','users.manage','module','core','c0000000-0000-4000-8000-000000000001')
 returning id,subject_user_id,capability_code,granted_by_auth_user_id
)
insert into hub_private.permission_audit_events
 (event_type,subject_user_id,grant_id,actor_auth_user_id,context)
select 'grant_created',subject_user_id,id,granted_by_auth_user_id,
 pg_catalog.jsonb_build_object('operation','trusted-bootstrap','capability',capability_code,
   'scope_kind','module','scope_key','core')
from original;

create function pg_temp.expect_catalog_denied(
  p_actor uuid, p_subject uuid, p_ref text, p_reason text, p_until timestamptz
) returns void language plpgsql as $$
begin
  begin
    perform hub_private.bootstrap_initial_catalog_grants(
      p_actor,p_subject,p_ref,p_reason,p_until);
    raise exception 'Forbidden catalog bootstrap unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end $$;
select pg_temp.expect_catalog_denied(
 'c0000000-0000-4000-8000-000000000002',
 'c0000000-0000-4000-8000-000000000002',
 'LEVIA-HUB05-20261027QA001','Invalid self-approval, synthetic negative test',
 now()+interval '2 days');
select pg_temp.expect_catalog_denied(
 'c0000000-0000-4000-8000-000000000003',
 'c0000000-0000-4000-8000-000000000002',
 'LEVIA-HUB05-20261027QA001','Different Auth user but not original independent approver',
 now()+interval '2 days');
select pg_temp.expect_catalog_denied(
 'c0000000-0000-4000-8000-000000000001',
 'c0000000-0000-4000-8000-000000000003',
 'LEVIA-HUB05-20261027QA001','Another Auth user not an existing administrator',
 now()+interval '2 days');
select pg_temp.expect_catalog_denied(
 'c0000000-0000-4000-8000-000000000001',
 'c0000000-0000-4000-8000-000000000002',
 'SYNTHETIC-INVALID-APPROVAL','This unsupported approval reference must not pass',
 now()+interval '2 days');
select pg_temp.expect_catalog_denied(
 'c0000000-0000-4000-8000-000000000001',
 'c0000000-0000-4000-8000-000000000002',
 'LEVIA-HUB05-20261027QA001','too short',
 now()+interval '2 days');
select pg_temp.expect_catalog_denied(
 'c0000000-0000-4000-8000-000000000001',
 'c0000000-0000-4000-8000-000000000002',
 'LEVIA-HUB05-20261027QA001','Invalid long-lived grant expiration; must be denied',
 now()+interval '8 days');
select pg_temp.expect_catalog_denied(
 'c0000000-0000-4000-8000-000000000001',
 'c0000000-0000-4000-8000-000000000002',
 'LEVIA-HUB05-20261027QA001','Invalid short-lived grant expiration; must be denied',
 now()+interval '20 minutes');

do $$
begin
  if (select count(*) from hub_private.permission_grants) <> 2
    or (select count(*) from hub_private.permission_audit_events) <> 2 then
    raise exception 'A denied attempt persisted a grant or an audit event';
  end if;
end $$;

-- A failed audit insert rolls the grant insert back in the SAME transaction.
create function pg_temp.reject_catalog_audit() returns trigger language plpgsql as $$
begin
 if new.context->>'operation'='hub05-initial-catalog-grant' then
   raise exception 'MOCK audit store unavailable' using errcode='23514';
 end if;
 return new;
end $$;
create trigger reject_catalog_audit before insert
on hub_private.permission_audit_events for each row
execute function pg_temp.reject_catalog_audit();
do $$
begin
  begin
    perform hub_private.bootstrap_initial_catalog_grants(
     'c0000000-0000-4000-8000-000000000001',
     'c0000000-0000-4000-8000-000000000002',
     'LEVIA-HUB05-20261027QA001',
     'Independent synthetic QA approval: verify atomic rollback',
     now()+interval '2 days');
    raise exception 'Simulated broken audit unexpectedly committed';
  exception when check_violation then null;
  end;
  if (select count(*) from hub_private.permission_grants) <> 2
     or (select count(*) from hub_private.permission_audit_events) <> 2 then
    raise exception 'Audit failure left an orphaned grant';
  end if;
end $$;
drop trigger reject_catalog_audit on hub_private.permission_audit_events;

-- One controlled MOCK approval for testing only. The enclosing rollback
-- guarantees it never touches the real development project.
select hub_private.bootstrap_initial_catalog_grants(
 'c0000000-0000-4000-8000-000000000001',
 'c0000000-0000-4000-8000-000000000002',
 'LEVIA-HUB05-20261027QA001',
 'Independent synthetic QA approval with exact catalog scopes',
 now()+interval '2 days');

do $$
begin
  if (select count(*) from hub_private.permission_grants) <> 4
    or (select count(*) from hub_private.permission_audit_events) <> 4
    or (select count(distinct capability_code) from hub_private.permission_grants
       where scope_kind='module' and scope_key='catalog'
         and capability_code in ('catalog.read','catalog.write')) <> 2
    or (select count(*) from hub_private.permission_audit_events
       where context->>'operation'='hub05-initial-catalog-grant'
         and context->>'approval_ref'='LEVIA-HUB05-20261027QA001'
         and context->>'actor_snapshot'='c0000000-0000-4000-8000-000000000001'
         and actor_auth_user_id='c0000000-0000-4000-8000-000000000001'
         and context->>'scope_key'='catalog') <> 2 then
    raise exception 'Atomic bootstrap capability, audit or provenance mismatch';
  end if;
  if not hub_catalog_private.actor_has_access(
   'c0000000-0000-4000-8000-000000000002',
   'c1000000-0000-4000-8000-000000000001','catalog.read')
    or not hub_catalog_private.actor_has_access(
   'c0000000-0000-4000-8000-000000000002',
   'c1000000-0000-4000-8000-000000000001','catalog.write') then
    raise exception 'Valid session failed to exercise granted catalog capabilities';
  end if;
  if hub_catalog_private.actor_has_access(
   'c0000000-0000-4000-8000-000000000003',
   'c1000000-0000-4000-8000-000000000001','catalog.read')
    or hub_catalog_private.actor_has_access(
   'c0000000-0000-4000-8000-000000000002',
   'c1000000-0000-4000-8000-000000000001','crm.write') then
    raise exception 'Catalog bootstrap bypassed user or capability boundary';
  end if;
end $$;

-- Repetition is denied even with a different reference.
select pg_temp.expect_catalog_denied(
 'c0000000-0000-4000-8000-000000000001',
 'c0000000-0000-4000-8000-000000000002',
 'LEVIA-HUB05-20261027QA002','Second exceptional bootstrap must never succeed',
 now()+interval '2 days');

-- Simulate future lifecycle in disposable PG only: revocation, invalid session,
-- expiry, and zero fallback for explicit catalog grants.
update hub_private.permission_grants
 set revoked_at=greatest(granted_at,transaction_timestamp()),
     revoked_by_auth_user_id='c0000000-0000-4000-8000-000000000001'
 where capability_code='catalog.write' and scope_key='catalog';
do $$
begin
 if hub_catalog_private.actor_has_access(
   'c0000000-0000-4000-8000-000000000002',
   'c1000000-0000-4000-8000-000000000001','catalog.write')
   or not hub_catalog_private.actor_has_access(
   'c0000000-0000-4000-8000-000000000002',
   'c1000000-0000-4000-8000-000000000001','catalog.read') then
   raise exception 'Revocation or read/write segregation failed';
 end if;
end $$;
-- A revoked historical grant must NOT re-enable the one-time gate.
select pg_temp.expect_catalog_denied(
 'c0000000-0000-4000-8000-000000000001',
 'c0000000-0000-4000-8000-000000000002',
 'LEVIA-HUB05-20261027QA003','Revocation does not reset exceptional bootstrap state',
 now()+interval '2 days');

delete from auth.sessions
 where id='c1000000-0000-4000-8000-000000000001';
do $$
begin
 if hub_catalog_private.actor_has_access(
   'c0000000-0000-4000-8000-000000000002',
   'c1000000-0000-4000-8000-000000000001','catalog.read') then
   raise exception 'Deleted session retained positive catalog authorization';
 end if;
end $$;
update hub_private.permission_grants
 set valid_from=transaction_timestamp()-interval '2 days',
     valid_until=transaction_timestamp()-interval '1 day'
 where capability_code='catalog.read' and scope_key='catalog';
do $$
begin
 if hub_private.actor_has_scope('c0000000-0000-4000-8000-000000000002',
    'catalog.read','module','catalog') then
   raise exception 'Expired catalog grant is still active';
 end if;
end $$;

rollback;
do $$
begin
  if (select count(*) from hub_private.permission_grants
      where capability_code in ('catalog.read','catalog.write'))<>0
    or (select count(*) from hub_private.permission_audit_events
        where context->>'operation'='hub05-initial-catalog-grant')<>0
    or exists(select 1 from hub_private.admin_accounts
        where auth_user_id='c0000000-0000-4000-8000-000000000002') then
    raise exception 'Synthetic rollback leaked provisioned privileges';
  end if;
  raise notice 'PASS: one-use exceptional gate, actor provenance, ACL, short TTL, audit atomicity, replay denial, expiry and revocation';
end $$;
