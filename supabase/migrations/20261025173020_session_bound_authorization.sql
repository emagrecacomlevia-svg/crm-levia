-- Live-session verification closes the JWT-after-logout window.
-- Private invoker functions, callable only by the trusted Edge database executor.
create function hub_private.session_is_active(p_user uuid, p_session uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=p_session and s.user_id=p_user
      and (s.not_after is null or s.not_after > transaction_timestamp())
      and s.created_at > transaction_timestamp() - interval '7 days'
      and (u.banned_until is null or u.banned_until <= transaction_timestamp())
      and u.deleted_at is null and u.is_anonymous is not true
  );
$$;

create function hub_private.session_bound_write(
  p_actor uuid, p_session uuid, p_action text, p_payload jsonb
) returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare v_grant uuid;
begin
  -- Lock the session/account/grants until the audited write commits. A concurrent
  -- logout, disable, or revocation must serialize with this transaction.
  perform 1 from auth.sessions where id=p_session and user_id=p_actor for share;
  if not hub_private.session_is_active(p_actor,p_session) then
    raise exception 'Session denied' using errcode='42501';
  end if;
  perform 1 from hub_private.admin_accounts where auth_user_id=p_actor for share;
  perform 1 from hub_private.permission_grants where subject_user_id=p_actor for share;
  case p_action
    when 'create-account' then
      perform hub_private.create_admin_account(p_actor,(p_payload->>'subject')::uuid);
    when 'set-enabled' then
      perform hub_private.set_admin_enabled(p_actor,(p_payload->>'subject')::uuid,(p_payload->>'enabled')::boolean);
    when 'issue-grant' then
      -- Delegation may not extend beyond either source authorization's lifetime.
      if exists (
        select 1 from hub_private.permission_grants g where g.subject_user_id=p_actor
          and g.revoked_at is null and g.valid_from <= transaction_timestamp()
          and g.valid_until is not null and (g.valid_until > transaction_timestamp())
          and ((g.capability_code='users.manage' and g.scope_kind='module' and g.scope_key='core')
            or (g.capability_code=p_payload->>'capability' and g.scope_kind=p_payload->>'scopeKind'
              and g.scope_key=p_payload->>'scopeKey'))
          and ((p_payload->>'validUntil') is null or (p_payload->>'validUntil')::timestamptz > g.valid_until)
      ) then raise exception 'Delegation expiry denied' using errcode='42501'; end if;
      v_grant := hub_private.issue_capability_grant(p_actor,(p_payload->>'subject')::uuid,
        p_payload->>'capability',p_payload->>'scopeKind',p_payload->>'scopeKey',
        (p_payload->>'validUntil')::timestamptz);
      return jsonb_build_object('grantId',v_grant);
    when 'revoke-grant' then
      perform hub_private.revoke_capability_grant(p_actor,(p_payload->>'grantId')::uuid);
    else raise exception 'Action denied' using errcode='42501';
  end case;
  return '{}'::jsonb;
end;
$$;

-- Preserve the actor snapshot when Auth legitimately applies ON DELETE SET NULL.
create function hub_private.audit_snapshot_actor()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.context := new.context || jsonb_build_object('actor_snapshot',new.actor_auth_user_id);
  return new;
end;
$$;
create trigger audit_snapshot_actor before insert on hub_private.permission_audit_events
for each row execute function hub_private.audit_snapshot_actor();

create function hub_private.audit_immutable()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op='UPDATE' and new.actor_auth_user_id is null
    and old.actor_auth_user_id is not null
    and (to_jsonb(new)-'actor_auth_user_id')=(to_jsonb(old)-'actor_auth_user_id')
    and not exists(select 1 from auth.users where id=old.actor_auth_user_id) then
    return new;
  end if;
  raise exception 'Audit is append only' using errcode='42501';
end;
$$;
create trigger audit_immutable before update or delete on hub_private.permission_audit_events
for each row execute function hub_private.audit_immutable();

-- Index FK lookups and managed-user cascades without weakening private ACL/RLS.
create index admin_accounts_creator on hub_private.admin_accounts(created_by_auth_user_id);
create index permission_grants_capability on hub_private.permission_grants(capability_code);
create index permission_grants_granter on hub_private.permission_grants(granted_by_auth_user_id);
create index permission_grants_revoker on hub_private.permission_grants(revoked_by_auth_user_id);
create index audit_actor on hub_private.permission_audit_events(actor_auth_user_id);
revoke all on all functions in schema hub_private from public,anon,authenticated,service_role;
