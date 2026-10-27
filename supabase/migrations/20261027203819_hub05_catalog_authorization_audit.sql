-- HUB-05 additive and private authorization, never grants automatic admin rights.
insert into hub_private.capabilities(code,description) values
 ('catalog.read','Read an expressly delegated catalog scope'),
 ('catalog.write','Append versions, prices and campaign history in delegated scope');

alter table hub_private.permission_grants drop constraint grant_scope_domain;
alter table hub_private.permission_grants add constraint grant_scope_domain check (
 (capability_code in ('core.read','users.manage') and
  ((scope_kind='module' and scope_key='core') or (scope_kind='resource' and scope_key ~ '^core:[a-z0-9_-]+$')))
 or (capability_code in ('crm.read','crm.write') and
  ((scope_kind='module' and scope_key='crm') or (scope_kind='resource' and scope_key ~ '^crm:[a-z0-9_-]+$')))
 or (capability_code in ('social.read','social.write','content.review_editorial',
   'content.review_scientific','content.approve_commercial') and
  ((scope_kind='module' and scope_key='social') or (scope_kind='resource' and scope_key ~ '^social:[a-z0-9_-]+$')))
 or (capability_code in ('catalog.read','catalog.write') and
  ((scope_kind='module' and scope_key='catalog') or (scope_kind='resource' and scope_key ~ '^catalog:[a-z0-9_-]+$')))
);

alter table hub_catalog_private.audit_events
 add column actor_auth_user_id uuid references auth.users(id) on delete set null,
 add column actor_snapshot uuid,
 add column auth_session_id uuid;
create index hub05_audit_by_actor on hub_catalog_private.audit_events(actor_snapshot,recorded_at desc);

create or replace function hub_catalog_private.record_insert()
returns trigger language plpgsql volatile security invoker set search_path = '' as $$
declare v_actor uuid; v_session uuid;
begin
 v_actor := nullif(pg_catalog.current_setting('levia.hub05_actor',true),'')::uuid;
 v_session := nullif(pg_catalog.current_setting('levia.hub05_session',true),'')::uuid;
 insert into hub_catalog_private.audit_events(entity,object_id,action,actor_auth_user_id,actor_snapshot,auth_session_id)
 values(tg_table_name,new.id,'INSERT',v_actor,v_actor,v_session);
 return new;
end $$;

create function hub_catalog_private.actor_has_access(p_actor uuid,p_session uuid,p_capability text)
returns boolean language sql stable security invoker set search_path='' as $$
 select p_actor is not null and p_session is not null
 and p_capability in ('catalog.read','catalog.write')
 and hub_private.session_is_active(p_actor,p_session)
 and exists(select 1 from hub_private.admin_accounts a
   join hub_private.permission_grants g on g.subject_user_id=a.auth_user_id
   where a.auth_user_id=p_actor and a.is_enabled and a.disabled_at is null
   and g.capability_code=p_capability and g.scope_kind='module' and g.scope_key='catalog'
   and g.valid_from<=transaction_timestamp()
   and (g.valid_until is null or g.valid_until>transaction_timestamp())
   and g.revoked_at is null);
$$;
revoke all on all functions in schema hub_catalog_private
 from public,anon,authenticated,service_role;
