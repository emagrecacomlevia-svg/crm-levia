-- Synthetic end-to-end QA must leave an audit trail without consuming the
-- first REAL admin bootstrap. Both Auth identities must carry server-controlled
-- QA app_metadata. Real bootstrap events remain a permanent one-time gate.
create or replace function hub_private.audit_snapshot_actor()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.context := (new.context - 'qa_run') || jsonb_build_object('actor_snapshot',new.actor_auth_user_id);
  if exists(select 1 from auth.users where id=new.actor_auth_user_id and raw_app_meta_data->>'purpose'='hub04-qa-synthetic')
    and exists(select 1 from auth.users where id=new.subject_user_id and raw_app_meta_data->>'purpose'='hub04-qa-synthetic') then
    new.context := new.context || jsonb_build_object('qa_run','hub04-20261025');
  end if;
  return new;
end;
$$;
create or replace function hub_private.bootstrap_first_admin(
  p_actor uuid, p_subject uuid, p_reason text
) returns void
language plpgsql volatile security invoker
set search_path = ''
as $$
declare
  v_cap text;
  v_grant uuid;
begin
  if current_user <> 'postgres' or p_actor is null or p_subject is null
    or p_actor = p_subject or p_reason is null
    or length(pg_catalog.btrim(p_reason)) not between 15 and 500 then
    raise exception 'Bootstrap denied' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('levia-hub04-once-bootstrap'));
  if exists (select 1 from hub_private.admin_accounts)
    or exists (select 1 from hub_private.permission_grants)
    or exists (select 1 from hub_private.permission_audit_events where context->>'qa_run' is distinct from 'hub04-20261025')
    or not exists (select 1 from auth.users where id = p_actor)
    or not exists (select 1 from auth.users where id = p_subject) then
    raise exception 'Bootstrap denied' using errcode = '42501';
  end if;

  insert into hub_private.admin_accounts (
    auth_user_id, is_enabled, disabled_at, created_by_auth_user_id
  ) values (p_subject, true, null, p_actor);
  insert into hub_private.permission_audit_events (
    event_type, subject_user_id, actor_auth_user_id, context
  ) values
    ('account_created', p_subject, p_actor,
      pg_catalog.jsonb_build_object('operation','trusted-bootstrap','reason',p_reason)),
    ('account_enabled', p_subject, p_actor,
      pg_catalog.jsonb_build_object('operation','trusted-bootstrap','reason',p_reason));

  -- Minimal initial grants: no CRM, Social, publishing or approval privilege.
  foreach v_cap in array array['core.read','users.manage'] loop
    insert into hub_private.permission_grants (
      subject_user_id, capability_code, scope_kind, scope_key,
      granted_by_auth_user_id
    ) values (p_subject, v_cap, 'module', 'core', p_actor)
    returning id into v_grant;
    insert into hub_private.permission_audit_events (
      event_type, subject_user_id, actor_auth_user_id, grant_id, context
    ) values (
      'grant_created', p_subject, p_actor, v_grant,
      pg_catalog.jsonb_build_object('operation','trusted-bootstrap',
        'reason',p_reason,'capability',v_cap,'scope_kind','module','scope_key','core')
    );
  end loop;
end;
$$;

revoke all on all functions in schema hub_private
  from public, anon, authenticated, service_role;
