-- HUB-05 additive exceptional RENEWAL. Does not alter the installed first-use gate.
-- No automatic grants, no public RPC, no SECURITY DEFINER and no extra admin.
-- Approval creation needs live Auth verification at the trusted Edge boundary.
create table hub_private.catalog_renewal_approvals (
  request_ref text primary key,
  subject_user_id uuid not null references hub_private.admin_accounts(auth_user_id),
  approver_auth_user_id uuid not null references auth.users(id) on delete restrict,
  approver_session_id uuid not null,
  proposed_valid_until timestamptz not null,
  approved_at timestamptz not null default transaction_timestamp(),
  consume_before timestamptz not null default (transaction_timestamp() + interval '15 minutes'),
  constraint catalog_renewal_ref_format check (
    request_ref ~ '^LEVIA-HUB05R-[A-Z0-9]{12,32}$'
  ),
  constraint catalog_renewal_distinct check (approver_auth_user_id <> subject_user_id),
  constraint catalog_renewal_window check (
    proposed_valid_until > approved_at + interval '1 hour'
    and proposed_valid_until <= approved_at + interval '7 days'
    and consume_before > approved_at
    and consume_before <= approved_at + interval '15 minutes'
  )
);
alter table hub_private.catalog_renewal_approvals enable row level security;
revoke all on hub_private.catalog_renewal_approvals
  from public,anon,authenticated,service_role;
-- Permanent consume marker: immutable HUB-04 audit prevents request_ref reuse.
create unique index hub05_renewal_consumed_once
on hub_private.permission_audit_events ((context->>'request_ref'))
where context->>'operation'='hub05-renewal-consumed';

-- The original first-admin approver is an EXISTING independent Auth identity.
-- This function is not a permission grant or an endorsement by the owner.
create function hub_private.catalog_original_independent_approver(
  p_approver uuid,p_subject uuid
) returns boolean language sql stable security invoker set search_path='' as $$
select p_approver is not null and p_subject is not null
  and p_approver <> p_subject
  and (select count(*) from hub_private.admin_accounts)=1
  and exists(select 1 from hub_private.admin_accounts
    where auth_user_id=p_subject and is_enabled and disabled_at is null)
  and exists(select 1 from auth.users
    where id=p_approver and deleted_at is null and is_anonymous is not true
    and (banned_until is null or banned_until<=transaction_timestamp()))
  and (select count(distinct g.capability_code)
       from hub_private.permission_grants g
       join hub_private.permission_audit_events e on e.grant_id=g.id
       where g.subject_user_id=p_subject
         and g.granted_by_auth_user_id=p_approver
         and g.capability_code in ('core.read','users.manage')
         and g.scope_kind='module' and g.scope_key='core'
         and g.revoked_at is null and g.valid_from<=transaction_timestamp()
         and (g.valid_until is null or g.valid_until>transaction_timestamp())
         and e.event_type='grant_created'
         and e.subject_user_id=p_subject and e.actor_auth_user_id=p_approver
         and e.context->>'actor_snapshot'=p_approver::text
         and e.context->>'operation'='trusted-bootstrap'
         and e.context->>'capability'=g.capability_code
         and e.context->>'qa_run' is distinct from 'hub04-20261025'
      )=2
$$;

-- Independent approver authenticates to Auth, Edge revalidates JWT, and
-- the DB independently verifies its current Auth session (not user_metadata).
-- No approval alone can write any catalog grant.
create function hub_private.approve_catalog_renewal(
  p_approver uuid,p_session uuid,p_subject uuid,
  p_request_ref text,p_valid_until timestamptz
) returns void language plpgsql volatile security invoker set search_path='' as $$
begin
  if current_user<>'postgres'
    or p_request_ref is null
    or p_request_ref !~ '^LEVIA-HUB05R-[A-Z0-9]{12,32}$'
    or p_session is null
    or p_valid_until is null
    or p_valid_until<=transaction_timestamp()+interval '1 hour'
    or p_valid_until>transaction_timestamp()+interval '7 days'
    or not hub_private.catalog_original_independent_approver(p_approver,p_subject)
  then raise exception 'Renewal approval denied' using errcode='42501';
  end if;

  -- A renewal request is allowed only after a genuine initial outorga
  -- was issued for this same subject/independent approver.
  if (select count(distinct e.context->>'capability')
      from hub_private.permission_audit_events e
      where e.event_type='grant_created'
        and e.subject_user_id=p_subject
        and e.actor_auth_user_id=p_approver
        and e.context->>'operation'='hub05-initial-catalog-grant'
        and e.context->>'capability' in ('catalog.read','catalog.write'))<>2
    or not hub_private.session_is_active(p_approver,p_session)
  then raise exception 'Renewal approval denied' using errcode='42501';
  end if;

  perform 1 from auth.sessions
   where id=p_session and user_id=p_approver for share;
  if not found or not hub_private.session_is_active(p_approver,p_session) then
    raise exception 'Renewal approver session denied' using errcode='42501';
  end if;

  insert into hub_private.catalog_renewal_approvals (
    request_ref,subject_user_id,approver_auth_user_id,
    approver_session_id,proposed_valid_until
  ) values (
    p_request_ref,p_subject,p_approver,p_session,p_valid_until
  );
  insert into hub_private.permission_audit_events (
    event_type,subject_user_id,actor_auth_user_id,context
  ) values (
    'grant_updated',p_subject,p_approver,
    pg_catalog.jsonb_build_object(
      'operation','hub05-renewal-independent-approval',
      'request_ref',p_request_ref,
      'approval_session',p_session,
      'proposed_valid_until',p_valid_until,
      'verified_via','supabase-auth-and-live-session'
    )
  );
end $$;

-- Second, separate channel: trusted postgres executor explicitly checks the
-- owner's NEW, signed/recorded external authorization before calling. The
-- digest anchors the evidence; it is NOT a signature validated by PostgreSQL.
create function hub_private.renew_catalog_grants(
  p_request_ref text,p_owner_ref text,p_owner_evidence_sha256 text,p_reason text
) returns void language plpgsql volatile security invoker set search_path='' as $$
declare
  v_approval hub_private.catalog_renewal_approvals%rowtype;
  v_cap text;
  v_old hub_private.permission_grants%rowtype;
  v_grant uuid;
  v_count integer;
begin
  if current_user<>'postgres'
    or p_request_ref is null
    or p_request_ref !~ '^LEVIA-HUB05R-[A-Z0-9]{12,32}$'
    or p_owner_ref is null
    or p_owner_ref !~ '^LEVIA-OWNER-[A-Z0-9]{12,32}$'
    or p_owner_evidence_sha256 is null
    or p_owner_evidence_sha256 !~ '^[0-9a-f]{64}$'
    or p_reason is null
    or length(pg_catalog.btrim(p_reason)) not between 30 and 500
  then raise exception 'Renewal denied' using errcode='42501';
  end if;

  -- Share one serial lock with original initial outorga.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('levia-hub05-once-catalog-bootstrap'));
  select * into v_approval
    from hub_private.catalog_renewal_approvals
    where request_ref=p_request_ref for update;
  if not found or v_approval.consume_before<=transaction_timestamp()
    or v_approval.approved_at>transaction_timestamp()
    or v_approval.proposed_valid_until<=transaction_timestamp()+interval '1 hour'
    or v_approval.proposed_valid_until>transaction_timestamp()+interval '7 days'
    or not hub_private.catalog_original_independent_approver(
      v_approval.approver_auth_user_id,v_approval.subject_user_id)
    or not hub_private.session_is_active(
      v_approval.approver_auth_user_id,v_approval.approver_session_id)
    or exists (select 1 from hub_private.permission_audit_events
      where context->>'operation'='hub05-renewal-consumed'
      and context->>'request_ref'=p_request_ref)
    or exists (select 1 from hub_private.permission_audit_events
      where context->>'operation' in ('hub05-initial-catalog-grant',
                                    'hub05-exceptional-renewal')
        and context->>'owner_ref'=p_owner_ref)
  then raise exception 'Renewal approval missing or consumed' using errcode='42501';
  end if;

  -- Strictly an EXPIRED, non-revoked pair, never an active pair, partially
  -- missing pair or incident-revoked pair. Revocation is not automatically
  -- undone. Note: expired rows remain unrevoked due to unique index.
  select count(*) into v_count
  from hub_private.permission_grants g
  where g.subject_user_id=v_approval.subject_user_id
    and g.capability_code in ('catalog.read','catalog.write')
    and g.scope_kind='module' and g.scope_key='catalog'
    and g.revoked_at is null and g.valid_until is not null
    and g.valid_until<=transaction_timestamp();
  if v_count<>2 or exists (
    select 1 from hub_private.permission_grants g
    where g.subject_user_id=v_approval.subject_user_id
      and g.capability_code in ('catalog.read','catalog.write')
      and g.revoked_at is null
      and (g.valid_until is null or g.valid_until>transaction_timestamp()
        or g.scope_kind<>'module' or g.scope_key<>'catalog')
  ) then raise exception 'Catalog pair must first expire normally' using errcode='42501';
  end if;

  foreach v_cap in array array['catalog.read','catalog.write'] loop
    select * into strict v_old
    from hub_private.permission_grants
    where subject_user_id=v_approval.subject_user_id and capability_code=v_cap
      and scope_kind='module' and scope_key='catalog'
      and revoked_at is null and valid_until<=transaction_timestamp()
    for update;
    update hub_private.permission_grants
      set revoked_at=greatest(granted_at,transaction_timestamp()),
          revoked_by_auth_user_id=v_approval.approver_auth_user_id
      where id=v_old.id and revoked_at is null;
    if not found then
      raise exception 'Concurrent catalog renewal conflict' using errcode='40001';
    end if;
    insert into hub_private.permission_audit_events(
      event_type,subject_user_id,grant_id,actor_auth_user_id,context
    ) values(
      'grant_revoked',v_approval.subject_user_id,v_old.id,
      v_approval.approver_auth_user_id,
      pg_catalog.jsonb_build_object(
        'operation','hub05-expired-scope-closure',
        'request_ref',p_request_ref,'capability',v_cap,
        'expired_at',v_old.valid_until)
    );
    insert into hub_private.permission_grants(
      subject_user_id,capability_code,scope_kind,scope_key,
      valid_until,granted_by_auth_user_id
    ) values(
      v_approval.subject_user_id,v_cap,'module','catalog',
      v_approval.proposed_valid_until,v_approval.approver_auth_user_id
    ) returning id into v_grant;
    insert into hub_private.permission_audit_events(
      event_type,subject_user_id,grant_id,actor_auth_user_id,context
    ) values(
      'grant_created',v_approval.subject_user_id,v_grant,
      v_approval.approver_auth_user_id,
      pg_catalog.jsonb_build_object(
        'operation','hub05-exceptional-renewal',
        'request_ref',p_request_ref,'owner_ref',p_owner_ref,
        'owner_evidence_sha256',p_owner_evidence_sha256,
        'reason',pg_catalog.btrim(p_reason),
        'prior_grant_id',v_old.id,
        'approval_session',v_approval.approver_session_id,
        'capability',v_cap,'scope_kind','module','scope_key','catalog',
        'valid_until',v_approval.proposed_valid_until,
        'executor_role',current_user)
    );
  end loop;
  -- Separate immutable consumption receipt: this specific Auth-verified
  -- independent approval can NEVER be reused by a later operator.
  insert into hub_private.permission_audit_events(
    event_type,subject_user_id,actor_auth_user_id,context
  ) values(
    'grant_updated',v_approval.subject_user_id,v_approval.approver_auth_user_id,
    pg_catalog.jsonb_build_object(
      'operation','hub05-renewal-consumed','request_ref',p_request_ref,
      'owner_ref',p_owner_ref,'owner_evidence_sha256',p_owner_evidence_sha256,
      'approval_session',v_approval.approver_session_id,
      'valid_until',v_approval.proposed_valid_until,
      'executor_role',current_user)
  );
end $$;
revoke all on all functions in schema hub_private
from public,anon,authenticated,service_role;
revoke all on all tables in schema hub_private
from public,anon,authenticated,service_role;
