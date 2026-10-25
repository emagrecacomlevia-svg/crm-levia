-- HUB-04 PROVISORIA: transactionally audited writers for a TRUSTED server ONLY.
-- STAGED DRAFT, NOT A MIGRATION and NOT executed on remote Supabase.
-- Provision as a new CLI-generated migration after the immutable first migration.
-- Trusted edge must independently verify caller JWT against Supabase Auth and
-- pass the resolved actor UUID; p_actor IS NOT proof of identity by itself.
-- Never GRANT EXECUTE or schema USAGE to client roles.

create function hub_private.actor_can_manage(p_actor uuid)
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select p_actor is not null and exists (
    select 1 from hub_private.admin_accounts a
    join hub_private.permission_grants g on g.subject_user_id = a.auth_user_id
    where a.auth_user_id = p_actor and a.is_enabled and a.disabled_at is null
      and g.capability_code = 'users.manage'
      and g.scope_kind = 'module' and g.scope_key = 'core'
      and g.revoked_at is null and g.valid_from <= transaction_timestamp()
      and (g.valid_until is null or g.valid_until > transaction_timestamp())
  );
$$;

create function hub_private.actor_has_scope(
  p_actor uuid, p_capability text, p_scope_kind text, p_scope_key text
) returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select p_actor is not null and exists (
    select 1 from hub_private.admin_accounts a
    join hub_private.permission_grants g on g.subject_user_id = a.auth_user_id
    where a.auth_user_id = p_actor and a.is_enabled and a.disabled_at is null
      and g.capability_code = p_capability
      and g.scope_kind = p_scope_kind and g.scope_key = p_scope_key
      and g.revoked_at is null and g.valid_from <= transaction_timestamp()
      and (g.valid_until is null or g.valid_until > transaction_timestamp())
  );
$$;

create function hub_private.create_admin_account(
  p_actor uuid, p_subject uuid
) returns void
language plpgsql volatile security invoker
set search_path = ''
as $$
begin
  if p_actor is null or p_subject is null or p_actor = p_subject
    or not hub_private.actor_can_manage(p_actor) then
    raise exception 'Administrative write denied' using errcode = '42501';
  end if;
  insert into hub_private.admin_accounts
    (auth_user_id, created_by_auth_user_id)
    values (p_subject, p_actor);
  insert into hub_private.permission_audit_events
    (event_type, subject_user_id, actor_auth_user_id)
    values ('account_created', p_subject, p_actor);
end;
$$;

create function hub_private.set_admin_enabled(
  p_actor uuid, p_subject uuid, p_enabled boolean
) returns void
language plpgsql volatile security invoker
set search_path = ''
as $$
begin
  if p_actor is null or p_subject is null or p_actor = p_subject
    or p_enabled is null or not hub_private.actor_can_manage(p_actor) then
    raise exception 'Administrative write denied' using errcode = '42501';
  end if;
  update hub_private.admin_accounts
     set is_enabled = p_enabled,
         disabled_at = case when p_enabled then null else transaction_timestamp() end,
         updated_at = greatest(created_at, transaction_timestamp())
   where auth_user_id = p_subject and is_enabled is distinct from p_enabled;
  if not found then
    raise exception 'Account missing or unchanged' using errcode = 'P0002';
  end if;
  insert into hub_private.permission_audit_events
    (event_type, subject_user_id, actor_auth_user_id)
    values (case when p_enabled then 'account_enabled'
                 else 'account_disabled' end, p_subject, p_actor);
end;
$$;

create function hub_private.issue_capability_grant(
  p_actor uuid,
  p_subject uuid,
  p_capability text,
  p_scope_kind text,
  p_scope_key text,
  p_valid_until timestamptz default null
) returns uuid
language plpgsql volatile security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_actor is null or p_subject is null or p_actor = p_subject
    or not hub_private.actor_can_manage(p_actor)
    or not hub_private.actor_has_scope(p_actor,p_capability,p_scope_kind,p_scope_key)
    or (p_valid_until is not null and p_valid_until <= transaction_timestamp()) then
    raise exception 'Grant denied' using errcode = '42501';
  end if;
  insert into hub_private.permission_grants
    (subject_user_id, capability_code, scope_kind, scope_key,
     granted_by_auth_user_id, valid_until)
  values
    (p_subject, p_capability, p_scope_kind, p_scope_key,
     p_actor, p_valid_until)
  returning id into v_id;
  insert into hub_private.permission_audit_events
    (event_type, subject_user_id, grant_id, actor_auth_user_id, context)
  values
    ('grant_created', p_subject, v_id, p_actor,
     jsonb_build_object('capability',p_capability,'scope_kind',p_scope_kind,'scope_key',p_scope_key));
  return v_id;
end;
$$;

create function hub_private.revoke_capability_grant(
  p_actor uuid, p_grant uuid
) returns void
language plpgsql volatile security invoker
set search_path = ''
as $$
declare
  v_grant hub_private.permission_grants%rowtype;
begin
  select * into v_grant from hub_private.permission_grants
   where id=p_grant and revoked_at is null for update;
  if not found or p_actor is null or p_actor = v_grant.subject_user_id
    or not hub_private.actor_can_manage(p_actor)
    or not hub_private.actor_has_scope(p_actor,
      v_grant.capability_code,v_grant.scope_kind,v_grant.scope_key) then
    raise exception 'Revocation denied' using errcode = '42501';
  end if;
  update hub_private.permission_grants
     set revoked_at = greatest(granted_at,transaction_timestamp()),
         revoked_by_auth_user_id = p_actor
   where id = p_grant and revoked_at is null;
  if not found then
    raise exception 'Revocation conflict' using errcode = '40001';
  end if;
  insert into hub_private.permission_audit_events
    (event_type, subject_user_id, grant_id, actor_auth_user_id, context)
  values
    ('grant_revoked', v_grant.subject_user_id, v_grant.id, p_actor,
     jsonb_build_object('capability',v_grant.capability_code,
                        'scope_kind',v_grant.scope_kind,'scope_key',v_grant.scope_key));
end;
$$;

-- Explicitly revoke default PUBLIC function privileges even though hub_private
-- remains an unexposed schema. Owner's privileged execution is intentional.
revoke all on all functions in schema hub_private
from public, anon, authenticated, service_role;
