-- Disposable PostgreSQL 17 ONLY: Auth stub and synthetic identities.
\set ON_ERROR_STOP on
do $$
begin
 if (select count(*) from hub_private.capabilities where code in('catalog.read','catalog.write'))<>2
 or (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='hub_catalog_private' and c.relkind='r' and c.relrowsecurity)<>8 then
   raise exception 'Missing HUB-05 role/RLS invariants';
 end if;
 if has_schema_privilege('anon','hub_catalog_private','USAGE')
 or has_schema_privilege('authenticated','hub_catalog_private','USAGE')
 or has_schema_privilege('service_role','hub_catalog_private','USAGE') then
   raise exception 'Private catalog schema exposed';
 end if;
end $$;
begin;
insert into auth.users(id) values
('f0000000-0000-4000-8000-000000000001'),
('f0000000-0000-4000-8000-000000000002');
insert into auth.sessions(id,user_id) values
('f1000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001');
insert into hub_private.admin_accounts(auth_user_id,is_enabled,disabled_at) values
('f0000000-0000-4000-8000-000000000001',true,null),
('f0000000-0000-4000-8000-000000000002',false,transaction_timestamp());
insert into hub_private.permission_grants(subject_user_id,capability_code,scope_kind,scope_key,granted_by_auth_user_id)
values('f0000000-0000-4000-8000-000000000001','catalog.read','module','catalog','f0000000-0000-4000-8000-000000000002');
do $$
begin
 if not hub_catalog_private.actor_has_access('f0000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','catalog.read')
 or hub_catalog_private.actor_has_access('f0000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','catalog.write')
 or hub_catalog_private.actor_has_access('f0000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001','catalog.read') then
   raise exception 'Grant/session/scope decision is wrong';
 end if;
end $$;
select set_config('levia.hub05_actor','f0000000-0000-4000-8000-000000000001',true);
select set_config('levia.hub05_session','f1000000-0000-4000-8000-000000000001',true);
insert into hub_catalog_private.catalog_items(sku) values ('DEMO-INTEGRATION-ATOMIC');
do $$
begin
 if (select count(*) from hub_catalog_private.audit_events
 where actor_snapshot='f0000000-0000-4000-8000-000000000001'
 and auth_session_id='f1000000-0000-4000-8000-000000000001')<>1 then
   raise exception 'Verified Auth actor/session absent from atomic audit';
 end if;
end $$;
rollback;
do $$
begin
 if exists(select 1 from hub_catalog_private.catalog_items where sku='DEMO-INTEGRATION-ATOMIC')
 then raise exception 'Rolled back synthetic item persisted'; end if;
 raise notice 'PASS: catalog Auth scope, RLS/ACL, actor+session audit, rollback';
end $$;
