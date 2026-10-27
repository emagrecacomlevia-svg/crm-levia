-- HUB-05 renewal - only disposable PostgreSQL 17, all fixture changes rollback.
\set ON_ERROR_STOP on
do $$
begin
 if (select count(*) from hub_private.catalog_renewal_approvals)<>0
 or (select count(*) from hub_private.permission_grants
     where capability_code in ('catalog.read','catalog.write'))<>0 then
   raise exception 'Migration created an approval or granted capabilities';
 end if;
 if not (select relrowsecurity from pg_class
    where oid='hub_private.catalog_renewal_approvals'::regclass) then
   raise exception 'Renewal approvals lack RLS';
 end if;
 if has_schema_privilege('anon','hub_private','USAGE')
   or has_table_privilege('authenticated','hub_private.catalog_renewal_approvals','SELECT')
   or has_function_privilege('anon','hub_private.approve_catalog_renewal(uuid,uuid,uuid,text,timestamptz)','EXECUTE')
   or has_function_privilege('authenticated','hub_private.renew_catalog_grants(text,text,text,text)','EXECUTE')
   or has_function_privilege('service_role','hub_private.renew_catalog_grants(text,text,text,text)','EXECUTE') then
    raise exception 'Exceptional catalog renewal exposed to client roles';
 end if;
end $$;
begin;
insert into auth.users(id) values
 ('d0000000-0000-4000-8000-000000000001'),
 ('d0000000-0000-4000-8000-000000000002'),
 ('d0000000-0000-4000-8000-000000000003');
insert into auth.sessions(id,user_id) values
 ('d1000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001'),
 ('d1000000-0000-4000-8000-000000000002',
  'd0000000-0000-4000-8000-000000000002'),
 ('d1000000-0000-4000-8000-000000000003',
  'd0000000-0000-4000-8000-000000000003');
insert into hub_private.admin_accounts (
 auth_user_id,is_enabled,disabled_at,created_by_auth_user_id)
 values ('d0000000-0000-4000-8000-000000000002',true,null,
 'd0000000-0000-4000-8000-000000000001');
with initial_core as (
 insert into hub_private.permission_grants (
  subject_user_id,capability_code,scope_kind,scope_key,granted_by_auth_user_id)
 values
 ('d0000000-0000-4000-8000-000000000002','core.read','module','core',
  'd0000000-0000-4000-8000-000000000001'),
 ('d0000000-0000-4000-8000-000000000002','users.manage','module','core',
  'd0000000-0000-4000-8000-000000000001')
 returning id,subject_user_id,capability_code,granted_by_auth_user_id
)
insert into hub_private.permission_audit_events(
 event_type,subject_user_id,grant_id,actor_auth_user_id,context)
select 'grant_created',subject_user_id,id,granted_by_auth_user_id,
 jsonb_build_object('operation','trusted-bootstrap','capability',capability_code,
 'scope_kind','module','scope_key','core')
from initial_core;

create function pg_temp.expect_renewal_denied(p_request text,p_owner text,
p_digest text,p_reason text)
returns void language plpgsql as $$
begin
 begin
  perform hub_private.renew_catalog_grants(p_request,p_owner,p_digest,p_reason);
  raise exception 'Unexpectedly allowed exceptional renewal';
 exception when insufficient_privilege then null;
 end;
end $$;
create function pg_temp.expect_approval_denied(p_actor uuid,p_session uuid,
p_subject uuid,p_request text,p_valid_until timestamptz)
returns void language plpgsql as $$
begin
 begin
  perform hub_private.approve_catalog_renewal(
   p_actor,p_session,p_subject,p_request,p_valid_until);
  raise exception 'Unexpectedly allowed independent approval';
 exception when insufficient_privilege or unique_violation then null;
 end;
end $$;

-- Without a genuine initial catalog grant, even the original Auth approver
-- may not initialize renewal pre-approval.
select pg_temp.expect_approval_denied(
 'd0000000-0000-4000-8000-000000000001',
 'd1000000-0000-4000-8000-000000000001',
 'd0000000-0000-4000-8000-000000000002',
 'LEVIA-HUB05R-QA20261027ROUND01',now()+interval '2 days');
do $$
begin
 if (select count(*) from hub_private.catalog_renewal_approvals)<>0
 then raise exception 'Renewal approval before initial grant'; end if;
end $$;

-- Simulate a LEGITIMATE initially granted pair; never call initial
-- bootstrap here, and all synthetic rows are rolled back.
with initial_catalog as (
 insert into hub_private.permission_grants (
  subject_user_id,capability_code,scope_kind,scope_key,
  valid_from,valid_until,granted_by_auth_user_id)
 values
 ('d0000000-0000-4000-8000-000000000002','catalog.read',
  'module','catalog',now(),now()+interval '1 day',
  'd0000000-0000-4000-8000-000000000001'),
 ('d0000000-0000-4000-8000-000000000002','catalog.write',
  'module','catalog',now(),now()+interval '1 day',
  'd0000000-0000-4000-8000-000000000001')
 returning id,subject_user_id,capability_code,granted_by_auth_user_id,valid_until
)
insert into hub_private.permission_audit_events(
 event_type,subject_user_id,grant_id,actor_auth_user_id,context)
select 'grant_created',subject_user_id,id,granted_by_auth_user_id,
 jsonb_build_object('operation','hub05-initial-catalog-grant',
 'capability',capability_code,'scope_kind','module','scope_key','catalog',
 'valid_until',valid_until)
from initial_catalog;

-- User cannot approve own renewal; unrelated user cannot impersonate
-- the independent bootstrap approver; session must belong to approver.
select pg_temp.expect_approval_denied(
 'd0000000-0000-4000-8000-000000000002',
 'd1000000-0000-4000-8000-000000000002',
 'd0000000-0000-4000-8000-000000000002',
 'LEVIA-HUB05R-QA20261027ROUND01',now()+interval '2 days');
select pg_temp.expect_approval_denied(
 'd0000000-0000-4000-8000-000000000003',
 'd1000000-0000-4000-8000-000000000003',
 'd0000000-0000-4000-8000-000000000002',
 'LEVIA-HUB05R-QA20261027ROUND01',now()+interval '2 days');
select pg_temp.expect_approval_denied(
 'd0000000-0000-4000-8000-000000000001',
 'd1000000-0000-4000-8000-000000000002',
 'd0000000-0000-4000-8000-000000000002',
 'LEVIA-HUB05R-QA20261027ROUND01',now()+interval '2 days');
select pg_temp.expect_approval_denied(
 'd0000000-0000-4000-8000-000000000001',
 'd1000000-0000-4000-8000-000000000001',
 'd0000000-0000-4000-8000-000000000002',
 'LEVIA-HUB05R-QA20261027ROUND01',now()+interval '8 days');
select pg_temp.expect_approval_denied(
 'd0000000-0000-4000-8000-000000000001',
 'd1000000-0000-4000-8000-000000000001',
 'd0000000-0000-4000-8000-000000000002',
 'UNSUPPORTED-REFERENCE',now()+interval '2 days');

-- Independent Auth session issues one REQUEST, without granting anything.
select hub_private.approve_catalog_renewal(
 'd0000000-0000-4000-8000-000000000001',
 'd1000000-0000-4000-8000-000000000001',
 'd0000000-0000-4000-8000-000000000002',
 'LEVIA-HUB05R-QA20261027ROUND01',now()+interval '2 days');
do $$
begin
 if (select count(*) from hub_private.catalog_renewal_approvals)<>1
 or (select count(*) from hub_private.permission_grants where capability_code like 'catalog.%')<>2
 or (select count(*) from hub_private.permission_audit_events
 where context->>'operation'='hub05-renewal-independent-approval')<>1 then
  raise exception 'Approval mutated grants or omitted audit';
 end if;
end $$;
select pg_temp.expect_approval_denied(
 'd0000000-0000-4000-8000-000000000001',
 'd1000000-0000-4000-8000-000000000001',
 'd0000000-0000-4000-8000-000000000002',
 'LEVIA-HUB05R-QA20261027ROUND01',now()+interval '2 days');

-- Valid independent approval cannot bypass the owner's NEW authorization
-- syntax, evidence digest or expiry of previous grants.
select pg_temp.expect_renewal_denied(
 'LEVIA-HUB05R-QA20261027ROUND01','INVALID-OWNER',
 repeat('a',64),'Synthetic owner document was not approved');
select pg_temp.expect_renewal_denied(
 'LEVIA-HUB05R-QA20261027ROUND01','LEVIA-OWNER-QA20261027ONE',
 repeat('z',64),'Owner document digest must be strict lowercase SHA-256');
select pg_temp.expect_renewal_denied(
 'LEVIA-HUB05R-QA20261027ROUND01','LEVIA-OWNER-QA20261027ONE',
 repeat('a',64),'Prior grant is still active and cannot be renewed');

-- Expire both grants ONLY inside synthetic QA fixture. In production time
-- expiry occurs naturally. Old grant rows remain intact in real DB.
update hub_private.permission_grants
set valid_from=now()-interval '2 days',valid_until=now()-interval '1 hour'
where capability_code in ('catalog.read','catalog.write') and scope_key='catalog';
do $$
begin
 if hub_catalog_private.actor_has_access(
 'd0000000-0000-4000-8000-000000000002',
 'd1000000-0000-4000-8000-000000000002','catalog.read') then
   raise exception 'Expired grant retained positive read authorization';
 end if;
end $$;
-- A revoked incident grant must not be renewed via this exceptional path.
savepoint incident_revocation;
update hub_private.permission_grants
set revoked_at=greatest(granted_at,now()),
revoked_by_auth_user_id='d0000000-0000-4000-8000-000000000001'
where capability_code='catalog.write' and scope_key='catalog' and revoked_at is null;
select pg_temp.expect_renewal_denied(
 'LEVIA-HUB05R-QA20261027ROUND01','LEVIA-OWNER-QA20261027ONE',
 repeat('a',64),'Incident-revoked grant cannot silently be resurrected');
rollback to savepoint incident_revocation;

-- Fail audit persistence and prove old grant pair stays unchanged; no new
-- grants or consume receipt survive the exception.
create function pg_temp.reject_renewal_audit() returns trigger language plpgsql as $$
begin
 if new.context->>'operation'='hub05-exceptional-renewal' then
  raise exception 'MOCK audit unavailable' using errcode='23514';
 end if;
 return new;
end $$;
create trigger reject_renewal_audit before insert
on hub_private.permission_audit_events for each row
execute function pg_temp.reject_renewal_audit();
do $$
begin
 begin
 perform hub_private.renew_catalog_grants(
  'LEVIA-HUB05R-QA20261027ROUND01','LEVIA-OWNER-QA20261027ONE',
  repeat('a',64),'Synthetic owner approval for atomic rollback verification');
 raise exception 'Audit failure was ignored';
 exception when check_violation then null;
 end;
 if (select count(*) from hub_private.permission_grants where capability_code like 'catalog.%')<>2
 or (select count(*) from hub_private.permission_grants where capability_code like 'catalog.%'
   and revoked_at is not null)<>0
 or (select count(*) from hub_private.permission_audit_events
   where context->>'operation'='hub05-renewal-consumed')<>0 then
   raise exception 'Audit failure left partial renewal';
 end if;
end $$;
drop trigger reject_renewal_audit on hub_private.permission_audit_events;

-- Legitimate renewal; independent session approval and independently
-- checked owner evidence are separate channels.
select hub_private.renew_catalog_grants(
 'LEVIA-HUB05R-QA20261027ROUND01','LEVIA-OWNER-QA20261027ONE',
 repeat('a',64),'Separate independent approval and simulated owner evidence for QA');
do $$
begin
 if (select count(*) from hub_private.permission_grants where capability_code like 'catalog.%')<>4
 or (select count(*) from hub_private.permission_grants where capability_code like 'catalog.%'
   and revoked_at is null)<>2
 or (select count(*) from hub_private.permission_audit_events
   where context->>'operation'='hub05-expired-scope-closure')<>2
 or (select count(*) from hub_private.permission_audit_events
   where context->>'operation'='hub05-exceptional-renewal'
   and context->>'owner_ref'='LEVIA-OWNER-QA20261027ONE'
   and context->>'owner_evidence_sha256'=repeat('a',64)
   and context->>'actor_snapshot'='d0000000-0000-4000-8000-000000000001')<>2
 or (select count(*) from hub_private.permission_audit_events
   where context->>'operation'='hub05-renewal-consumed')<>1 then
   raise exception 'Legitimate renewal left malformed historical grants or audit';
 end if;
 if not hub_catalog_private.actor_has_access(
 'd0000000-0000-4000-8000-000000000002',
 'd1000000-0000-4000-8000-000000000002','catalog.read')
 or not hub_catalog_private.actor_has_access(
 'd0000000-0000-4000-8000-000000000002',
 'd1000000-0000-4000-8000-000000000002','catalog.write')
 or hub_catalog_private.actor_has_access(
 'd0000000-0000-4000-8000-000000000001',
 'd1000000-0000-4000-8000-000000000001','catalog.read') then
   raise exception 'Renewal authorization broke positive or denied cases';
 end if;
end $$;
-- Replay of consumed independent request cannot produce a third grant pair.
select pg_temp.expect_renewal_denied(
 'LEVIA-HUB05R-QA20261027ROUND01','LEVIA-OWNER-QA20261027TWO',
 repeat('b',64),'Approval replay must never allow additional catalog grants');

-- A SECOND future cycle requires a NEW independent Auth request and
-- NEW owner reference; no implicit permanent ownership after first renewal.
select hub_private.approve_catalog_renewal(
 'd0000000-0000-4000-8000-000000000001',
 'd1000000-0000-4000-8000-000000000001',
 'd0000000-0000-4000-8000-000000000002',
 'LEVIA-HUB05R-QA20261027ROUND02',now()+interval '3 days');
select pg_temp.expect_renewal_denied(
 'LEVIA-HUB05R-QA20261027ROUND02','LEVIA-OWNER-QA20261027TWO',
 repeat('b',64),'Still-active renewed grants cannot be further renewed');
-- Simulate another natural expiry.
update hub_private.permission_grants set
 valid_from=now()-interval '2 days',
 valid_until=now()-interval '1 hour'
where capability_code in ('catalog.read','catalog.write')
 and scope_key='catalog' and revoked_at is null;
-- Owner authorization reference must be NEW (old ref cannot be recycled).
select pg_temp.expect_renewal_denied(
 'LEVIA-HUB05R-QA20261027ROUND02','LEVIA-OWNER-QA20261027ONE',
 repeat('b',64),'Owner authorization reference reuse must be denied');
select hub_private.renew_catalog_grants(
 'LEVIA-HUB05R-QA20261027ROUND02','LEVIA-OWNER-QA20261027TWO',
 repeat('b',64),'Second independent renewal uses fresh owner authorization');
do $$
begin
 if (select count(*) from hub_private.permission_grants
   where capability_code in ('catalog.read','catalog.write'))<>6
 or (select count(*) from hub_private.permission_grants
   where capability_code in ('catalog.read','catalog.write') and revoked_at is null)<>2
 or (select count(*) from hub_private.permission_audit_events
   where context->>'operation'='hub05-renewal-consumed')<>2 then
   raise exception 'Second controlled renewal did not preserve all history';
 end if;
end $$;
rollback;
do $$
begin
 if exists (select 1 from hub_private.catalog_renewal_approvals)
 or exists (select 1 from hub_private.permission_grants
   where capability_code in ('catalog.read','catalog.write'))
 or exists (select 1 from hub_private.permission_audit_events
   where context->>'operation' in ('hub05-exceptional-renewal','hub05-renewal-consumed')) then
   raise exception 'Synthetic QA leaked renewal history after rollback';
 end if;
 raise notice 'PASS: separate Auth approval, owner authorization, expiry, two renewals, self-denial, audit rollback and replay protection';
end $$;
