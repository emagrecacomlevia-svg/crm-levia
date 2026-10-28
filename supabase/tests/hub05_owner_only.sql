-- HUB-05 single-owner lifecycle QA on an ISOLATED PostgreSQL 17 fixture.
-- These synthetic Auth rows and all changes are rolled back; never remote LEVIA.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values
 ('d0000000-0000-4000-8000-000000000011'),
 ('d0000000-0000-4000-8000-000000000022'),
 ('a0000000-0000-4000-8000-000000000003');
insert into auth.sessions(id,user_id) values
 ('a1000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000011'),
 ('a1000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003');
insert into hub_private.admin_accounts(auth_user_id,is_enabled,disabled_at,created_by_auth_user_id)
values('d0000000-0000-4000-8000-000000000011',true,null,'d0000000-0000-4000-8000-000000000022');
with g as(
 insert into hub_private.permission_grants(
 subject_user_id,capability_code,scope_kind,scope_key,granted_by_auth_user_id)
 values
 ('d0000000-0000-4000-8000-000000000011','core.read','module','core','d0000000-0000-4000-8000-000000000022'),
 ('d0000000-0000-4000-8000-000000000011','users.manage','module','core','d0000000-0000-4000-8000-000000000022')
 returning id,subject_user_id,capability_code,granted_by_auth_user_id)
insert into hub_private.permission_audit_events(
 event_type,subject_user_id,grant_id,actor_auth_user_id,context)
select 'grant_created',subject_user_id,id,granted_by_auth_user_id,
 jsonb_build_object('operation','trusted-bootstrap','capability',capability_code)
from g;
create function pg_temp.expect_owner_denied(
 p_owner uuid,p_session uuid,p_action text,p_ref text,p_until timestamptz,p_source text)
returns void language plpgsql as $$
begin
 begin
  perform hub_private.owner_catalog_change(
   p_owner,p_session,p_action,p_ref,
   'Synthetic QA validates deny-by-default owner governance without new privileges',
   p_until,repeat('a',64),p_source);
  raise exception 'Expected owner-only decision rejection';
 exception when insufficient_privilege then null;
 end;
end $$;
do $$
begin
 if has_schema_privilege('anon','hub_private','USAGE')
 or has_schema_privilege('authenticated','hub_private','USAGE')
 or has_function_privilege('authenticated',
   'hub_private.owner_catalog_change(uuid,uuid,text,text,text,timestamptz,text,text)','EXECUTE')
 or has_table_privilege('authenticated','hub_private.owner_catalog_decisions','SELECT')
 or (select relrowsecurity from pg_class where oid='hub_private.owner_catalog_decisions'::regclass) is not true
 then raise exception 'Owner-only governance exposed through public SQL'; end if;
end $$;
select pg_temp.expect_owner_denied(
 'a0000000-0000-4000-8000-000000000003',
 'a1000000-0000-4000-8000-000000000003',
 'initial','LEVIA-OWNER-QASYNTHETICINITIAL1',now()+interval '2 days','owner-chat-authorization');
select pg_temp.expect_owner_denied(
 'd0000000-0000-4000-8000-000000000011',
 'a1000000-0000-4000-8000-000000000003',
 'initial','LEVIA-OWNER-QASYNTHETICINITIAL1',now()+interval '2 days','owner-chat-authorization');
select pg_temp.expect_owner_denied(
 'd0000000-0000-4000-8000-000000000011',
 'a1000000-0000-4000-8000-000000000001',
 'initial','LEVIA-OWNER-QASYNTHETICINITIAL1',now()+interval '8 days','owner-chat-authorization');
select pg_temp.expect_owner_denied(
 'd0000000-0000-4000-8000-000000000011',
 'a1000000-0000-4000-8000-000000000001',
 'initial','LEVIA-OWNER-QASYNTHETICINITIAL1',now()+interval '2 days','verified-auth-request');
do $$
begin
 if (select count(*) from hub_private.permission_grants where capability_code like 'catalog.%')<>0
 or (select count(*) from hub_private.owner_catalog_decisions)<>0
 then raise exception 'Denied action wrote catalog capabilities'; end if;
end $$;
select hub_private.owner_catalog_change(
 'd0000000-0000-4000-8000-000000000011',
 'a1000000-0000-4000-8000-000000000001',
 'initial','LEVIA-OWNER-QASYNTHETICINITIAL1',
 'Synthetic owner evidence for isolated transactional catalog first grant',
 now()+interval '2 days',repeat('a',64),'owner-chat-authorization');
do $$
begin
 if (select count(*) from hub_private.permission_grants where capability_code like 'catalog.%'
     and granted_by_auth_user_id is null and scope_kind='module'
     and scope_key='catalog' and revoked_at is null)<>2
 or (select count(*) from hub_private.owner_catalog_decisions where action='initial')<>1
 or (select count(*) from hub_private.permission_audit_events
     where context->>'operation'='hub05-owner-only-initial'
       and actor_auth_user_id is null
       and context->>'owner_auth_user_id'='d0000000-0000-4000-8000-000000000011'
       and context->>'owner_session_id'='a1000000-0000-4000-8000-000000000001'
       and context->>'governance'='single-natural-owner-no-independent-human-approval')<>2
 or not hub_catalog_private.actor_has_access(
   'd0000000-0000-4000-8000-000000000011',
   'a1000000-0000-4000-8000-000000000001','catalog.read')
 or not hub_catalog_private.actor_has_access(
   'd0000000-0000-4000-8000-000000000011',
   'a1000000-0000-4000-8000-000000000001','catalog.write')
 or hub_catalog_private.actor_has_access(
   'd0000000-0000-4000-8000-000000000022',
   'a1000000-0000-4000-8000-000000000001','catalog.read')
 then raise exception 'Owner-only first grant failed scope, session, actor or audit'; end if;
end $$;
select pg_temp.expect_owner_denied(
 'd0000000-0000-4000-8000-000000000011',
 'a1000000-0000-4000-8000-000000000001',
 'initial','LEVIA-OWNER-QASYNTHETICINITIAL2',now()+interval '2 days','owner-chat-authorization');
select pg_temp.expect_owner_denied(
 'd0000000-0000-4000-8000-000000000011',
 'a1000000-0000-4000-8000-000000000001',
 'renew','LEVIA-OWNER-QASYNTHETICRENEW01',now()+interval '2 days','verified-auth-request');
-- Future natural expiry simulated ONLY inside this rollback fixture.
update hub_private.permission_grants set valid_from=now()-interval '3 days',
 valid_until=now()-interval '1 hour'
where capability_code like 'catalog.%';
do $$
begin
 if hub_catalog_private.actor_has_access(
   'd0000000-0000-4000-8000-000000000011',
   'a1000000-0000-4000-8000-000000000001','catalog.read')
 then raise exception 'Expired owner access incorrectly allowed'; end if;
end $$;
select hub_private.owner_catalog_change(
 'd0000000-0000-4000-8000-000000000011',
 'a1000000-0000-4000-8000-000000000001',
 'renew','LEVIA-OWNER-QASYNTHETICRENEW01',
 'Synthetic explicit renewed owner decision after natural grant expiration',
 now()+interval '2 days',repeat('b',64),'verified-auth-request');
do $$
begin
 if (select count(*) from hub_private.permission_grants where capability_code like 'catalog.%')<>4
 or (select count(*) from hub_private.permission_grants where capability_code like 'catalog.%'
     and revoked_at is null)<>2
 or (select count(*) from hub_private.permission_audit_events
     where context->>'operation'='hub05-owner-only-renewal')<>2
 or (select count(*) from hub_private.permission_audit_events
     where context->>'operation'='hub05-owner-expired-closure')<>2
 then raise exception 'Manual renewal did not preserve historical pair'; end if;
end $$;
select pg_temp.expect_owner_denied(
 'd0000000-0000-4000-8000-000000000011',
 'a1000000-0000-4000-8000-000000000001',
 'renew','LEVIA-OWNER-QASYNTHETICRENEW01',now()+interval '2 days','verified-auth-request');
select hub_private.owner_catalog_change(
 'd0000000-0000-4000-8000-000000000011',
 'a1000000-0000-4000-8000-000000000001',
 'revoke','LEVIA-OWNER-QASYNTHETICREVOKE01',
 'Synthetic explicit owner cancellation and complete denial after revocation',
 null,repeat('c',64),'verified-auth-request');
do $$
begin
 if (select count(*) from hub_private.permission_grants where capability_code like 'catalog.%'
     and revoked_at is null)<>0
 or (select count(*) from hub_private.permission_audit_events
     where context->>'operation'='hub05-owner-explicit-revocation')<>2
 or hub_catalog_private.actor_has_access(
   'd0000000-0000-4000-8000-000000000011',
   'a1000000-0000-4000-8000-000000000001','catalog.read')
 then raise exception 'Owner revocation failed to fail closed'; end if;
end $$;
select pg_temp.expect_owner_denied(
 'd0000000-0000-4000-8000-000000000011',
 'a1000000-0000-4000-8000-000000000001',
 'renew','LEVIA-OWNER-QASYNTHETICRENEW02',now()+interval '2 days','verified-auth-request');
rollback;
do $$
begin
 if (select count(*) from hub_private.owner_catalog_decisions)<>0
 or (select count(*) from hub_private.permission_grants where capability_code like 'catalog.%')<>0
 then raise exception 'Synthetic owner QA escaped rollback'; end if;
end $$;
