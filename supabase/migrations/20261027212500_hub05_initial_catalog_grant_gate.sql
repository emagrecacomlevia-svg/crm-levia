-- HUB-05 / initial CATALOG permission bootstrap gate. Installation NEVER issues grants.
-- Exceptional one-time operation, executable only by trusted postgres after
-- a separate explicit LEVIA authorization and independent review.
-- Preserves the HUB-04 audited writer, first-admin bootstrap and RLS model.
create function hub_private.bootstrap_initial_catalog_grants(
  p_approver uuid,
  p_subject uuid,
  p_approval_ref text,
  p_reason text,
  p_valid_until timestamptz
) returns void
language plpgsql volatile security invoker
set search_path = ''
as $$
declare
  v_cap text;
  v_grant_id uuid;
  v_source_count integer;
begin
  -- Actor UUID is independent-approval provenance, NOT authentication.
  -- The trusted postgres executor must verify approval OUT OF BAND before calling.
  if current_user <> 'postgres'
    or p_approver is null or p_subject is null
    or p_approver = p_subject
    or p_approval_ref is null
    or p_approval_ref !~ '^LEVIA-HUB05-[A-Z0-9]{12,32}$'
    or p_reason is null
    or length(pg_catalog.btrim(p_reason)) not between 30 and 500
    or p_valid_until is null
    or p_valid_until <= transaction_timestamp() + interval '1 hour'
    or p_valid_until > transaction_timestamp() + interval '7 days'
  then
    raise exception 'HUB-05 bootstrap denied' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('levia-hub05-once-catalog-bootstrap'));

  -- Real HUB-04 approved first admin must already exist. No new identity,
  -- administrator, status change or wider role is created by this procedure.
  if (select count(*) from hub_private.admin_accounts) <> 1
    or not exists (
      select 1 from hub_private.admin_accounts a
      where a.auth_user_id = p_subject and a.is_enabled and a.disabled_at is null
    )
    or not exists (
      select 1 from auth.users u
      where u.id = p_approver and u.deleted_at is null
        and u.is_anonymous is not true
        and (u.banned_until is null or u.banned_until <= transaction_timestamp())
    )
  then
    raise exception 'HUB-05 bootstrap denied' using errcode = '42501';
  end if;

  -- The independent approver MUST be the existing independently recorded
  -- operator of the original real HUB-04 first-administrator bootstrap.
  -- Both initial grants must have that exact authenticated provenance.
  select count(distinct g.capability_code)
    into v_source_count
  from hub_private.permission_grants g
  join hub_private.permission_audit_events e
    on e.grant_id = g.id
  where g.subject_user_id = p_subject
    and g.granted_by_auth_user_id = p_approver
    and g.capability_code in ('core.read','users.manage')
    and g.scope_kind = 'module' and g.scope_key = 'core'
    and g.revoked_at is null
    and g.valid_from <= transaction_timestamp()
    and (g.valid_until is null or g.valid_until > transaction_timestamp())
    and e.subject_user_id = p_subject
    and e.event_type = 'grant_created'
    and e.actor_auth_user_id = p_approver
    and e.context->>'actor_snapshot' = p_approver::text
    and e.context->>'operation' = 'trusted-bootstrap'
    and e.context->>'capability' = g.capability_code
    and e.context->>'qa_run' is distinct from 'hub04-20261025';
  if v_source_count <> 2 then
    raise exception 'HUB-05 independent bootstrap provenance denied'
      using errcode = '42501';
  end if;

  -- If any catalog grant has EVER existed (even revoked) or a one-time audit
  -- exists, the emergency gate must never re-open.
  if exists (
    select 1 from hub_private.permission_grants
    where capability_code in ('catalog.read','catalog.write')
  ) or exists (
    select 1 from hub_private.permission_audit_events
    where context->>'operation' = 'hub05-initial-catalog-grant'
  ) then
    raise exception 'HUB-05 bootstrap already consumed' using errcode = '42501';
  end if;

  foreach v_cap in array array['catalog.read','catalog.write'] loop
    insert into hub_private.permission_grants (
      subject_user_id, capability_code, scope_kind, scope_key,
      valid_until, granted_by_auth_user_id
    ) values (
      p_subject, v_cap, 'module', 'catalog',
      p_valid_until, p_approver
    )
    returning id into v_grant_id;
    insert into hub_private.permission_audit_events (
      event_type, subject_user_id, grant_id, actor_auth_user_id, context
    ) values (
      'grant_created', p_subject, v_grant_id, p_approver,
      pg_catalog.jsonb_build_object(
        'operation','hub05-initial-catalog-grant',
        'approval_ref',p_approval_ref,
        'executor_role',current_user,
        'approver_provenance','original-real-hub04-bootstrap',
        'reason',pg_catalog.btrim(p_reason),
        'capability',v_cap,
        'scope_kind','module',
        'scope_key','catalog',
        'valid_until',p_valid_until
      )
    );
  end loop;
end;
$$;

-- No GRANT USAGE on hub_private and no positive policies.
-- No public, browser, authenticated or service_role invocation is possible.
revoke all on function hub_private.bootstrap_initial_catalog_grants(
  uuid,uuid,text,text,timestamptz
) from public,anon,authenticated,service_role;
