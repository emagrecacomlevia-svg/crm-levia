-- HUB-05 additive privacy mitigation. Preserve prior migration and audit history.
-- Existing original owner+operator resolved using private HUB-04 provenance.
-- No data mutations, no new grant; UUIDs are identifiers, not credentials.
CREATE OR REPLACE FUNCTION hub_private.owner_catalog_change(p_owner uuid, p_session uuid, p_action text, p_owner_ref text, p_reason text, p_valid_until timestamp with time zone, p_evidence_sha256 text, p_evidence_source text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_cap text; v_grant_id uuid; v_prior hub_private.permission_grants%rowtype;
 v_initial_count integer; v_count integer;
begin
 if current_user <> 'postgres'
 or p_owner is null or p_session is null
 or p_action not in ('initial','renew','revoke') or p_action is null
 or p_owner_ref is null or p_owner_ref !~ '^LEVIA-OWNER-[A-Z0-9]{12,32}$'
 or p_reason is null or length(pg_catalog.btrim(p_reason)) not between 30 and 500
 or p_evidence_sha256 is null or p_evidence_sha256 !~ '^[0-9a-f]{64}$'
 or p_evidence_source not in ('owner-chat-authorization','verified-auth-request')
 or p_evidence_source is null
 or (p_action='initial' and p_evidence_source<>'owner-chat-authorization')
 or (p_action<>'initial' and p_evidence_source<>'verified-auth-request')
 or (p_action='revoke' and p_valid_until is not null)
 or (p_action<>'revoke' and (p_valid_until is null
   or p_valid_until<=transaction_timestamp()+interval '1 hour'
   or p_valid_until>transaction_timestamp()+interval '7 days'))
 then raise exception 'Owner-only catalog decision denied' using errcode='42501';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('levia-hub05-once-catalog-bootstrap'));
 -- Real original principal only: no new admin, no alternate actor, no loose metadata claims.
 if (select count(*) from hub_private.admin_accounts)<>1
 or not exists (select 1 from hub_private.admin_accounts a
   join auth.users original_operator on original_operator.id=a.created_by_auth_user_id
   where a.auth_user_id=p_owner and a.is_enabled and a.disabled_at is null
     and a.created_by_auth_user_id is not null
     and a.created_by_auth_user_id<>a.auth_user_id
     and original_operator.deleted_at is null
     and original_operator.is_anonymous is not true
     and (original_operator.banned_until is null or
          original_operator.banned_until<=transaction_timestamp()))
 or not exists (select 1 from auth.users u where u.id=p_owner
    and u.deleted_at is null and u.is_anonymous is not true
    and (u.banned_until is null or u.banned_until<=transaction_timestamp()))
 or not hub_private.session_is_active(p_owner,p_session)
 then raise exception 'Owner principal or live session invalid' using errcode='42501';
 end if;
 perform 1 from auth.sessions where id=p_session and user_id=p_owner for share;
 if not found or not hub_private.session_is_active(p_owner,p_session) then
   raise exception 'Owner session invalidated' using errcode='42501';
 end if;
 -- Verify historical provenance, but NEVER claim the historical operator was a second human.
 select count(distinct g.capability_code) into v_count
 from hub_private.permission_grants g
 join hub_private.permission_audit_events e on e.grant_id=g.id
 where g.subject_user_id=p_owner and g.granted_by_auth_user_id=
     (select a.created_by_auth_user_id from hub_private.admin_accounts a
      where a.auth_user_id=p_owner)
   and g.capability_code in ('core.read','users.manage')
   and g.scope_kind='module' and g.scope_key='core'
   and g.revoked_at is null and g.valid_from<=transaction_timestamp()
   and (g.valid_until is null or g.valid_until>transaction_timestamp())
   and e.event_type='grant_created' and e.subject_user_id=p_owner
   and e.actor_auth_user_id=g.granted_by_auth_user_id
   and e.context->>'actor_snapshot'=g.granted_by_auth_user_id::text
   and e.context->>'operation'='trusted-bootstrap'
   and e.context->>'capability'=g.capability_code
   and e.context->>'qa_run' is distinct from 'hub04-20261025';
 if v_count<>2 then raise exception 'Original owner provenance denied' using errcode='42501'; end if;
 if exists(select 1 from hub_private.owner_catalog_decisions where owner_ref=p_owner_ref)
 or exists(select 1 from hub_private.permission_audit_events
           where context->>'owner_ref'=p_owner_ref)
 then raise exception 'Owner request replay denied' using errcode='42501'; end if;
 select count(*) into v_initial_count from hub_private.permission_audit_events
 where subject_user_id=p_owner and event_type='grant_created'
   and context->>'operation'='hub05-owner-only-initial'
   and context->>'capability' in ('catalog.read','catalog.write');
 if p_action='initial' then
   if v_initial_count<>0
     or exists (select 1 from hub_private.permission_grants
         where capability_code in ('catalog.read','catalog.write'))
     or exists (select 1 from hub_private.permission_audit_events
         where context->>'operation' in ('hub05-initial-catalog-grant','hub05-owner-only-initial'))
   then raise exception 'Initial catalog decision already consumed' using errcode='42501'; end if;
 else
   if v_initial_count<>2 then raise exception 'Initial owner grant provenance absent' using errcode='42501'; end if;
   select count(*) into v_count from hub_private.permission_grants
    where subject_user_id=p_owner
      and capability_code in ('catalog.read','catalog.write')
      and scope_kind='module' and scope_key='catalog' and revoked_at is null
      and valid_until is not null
      and ((p_action='renew' and valid_until<=transaction_timestamp())
      or (p_action='revoke' and valid_until>transaction_timestamp()));
   if v_count<>2 or exists (select 1 from hub_private.permission_grants
      where capability_code in ('catalog.read','catalog.write')
        and revoked_at is null and (subject_user_id<>p_owner
          or scope_kind<>'module' or scope_key<>'catalog'
          or valid_until is null
          or (p_action='renew' and valid_until>transaction_timestamp())
          or (p_action='revoke' and valid_until<=transaction_timestamp())))
   then raise exception 'Catalog pair not in safe owner transition state' using errcode='42501'; end if;
 end if;

 insert into hub_private.owner_catalog_decisions (
   owner_ref,owner_auth_user_id,owner_session_id,action,valid_until,
   reason,evidence_sha256,evidence_source)
 values (p_owner_ref,p_owner,p_session,p_action,p_valid_until,
   pg_catalog.btrim(p_reason),p_evidence_sha256,p_evidence_source);

 foreach v_cap in array array['catalog.read','catalog.write'] loop
   if p_action in ('renew','revoke') then
     select * into strict v_prior from hub_private.permission_grants
     where subject_user_id=p_owner and capability_code=v_cap
       and scope_kind='module' and scope_key='catalog'
       and revoked_at is null for update;
     update hub_private.permission_grants set
       revoked_at=greatest(granted_at,transaction_timestamp()),
       revoked_by_auth_user_id=null
     where id=v_prior.id and revoked_at is null;
     if not found then raise exception 'Concurrent owner decision conflict' using errcode='40001'; end if;
     insert into hub_private.permission_audit_events
       (event_type,subject_user_id,grant_id,actor_auth_user_id,context)
     values ('grant_revoked',p_owner,v_prior.id,null,
       pg_catalog.jsonb_build_object(
         'operation',case when p_action='renew' then 'hub05-owner-expired-closure'
                          else 'hub05-owner-explicit-revocation' end,
         'owner_ref',p_owner_ref,'owner_auth_user_id',p_owner,
         'owner_session_id',p_session,'executor_role',current_user,
         'governance','single-natural-owner-no-independent-human-approval',
         'capability',v_cap,'scope_kind','module','scope_key','catalog',
         'prior_valid_until',v_prior.valid_until));
   end if;
   if p_action in ('initial','renew') then
     -- NULL granter is deliberate: postgres executes, owner governs.
     -- Never forge a second-human grant actor or relax the self-grant CHECK.
     insert into hub_private.permission_grants (
       subject_user_id,capability_code,scope_kind,scope_key,
       valid_until,granted_by_auth_user_id)
     values(p_owner,v_cap,'module','catalog',p_valid_until,null)
     returning id into v_grant_id;
     insert into hub_private.permission_audit_events
       (event_type,subject_user_id,grant_id,actor_auth_user_id,context)
     values('grant_created',p_owner,v_grant_id,null,
       pg_catalog.jsonb_build_object(
         'operation',case when p_action='initial' then 'hub05-owner-only-initial'
                          else 'hub05-owner-only-renewal' end,
         'owner_ref',p_owner_ref,'owner_auth_user_id',p_owner,
         'owner_session_id',p_session,
         'evidence_sha256',p_evidence_sha256,
         'evidence_source',p_evidence_source,
         'governance','single-natural-owner-no-independent-human-approval',
         'executor_role',current_user,'reason',pg_catalog.btrim(p_reason),
         'capability',v_cap,'scope_kind','module','scope_key','catalog',
         'valid_until',p_valid_until,
         'prior_grant_id',case when p_action='renew' then v_prior.id else null end));
   end if;
 end loop;
end $function$

;

revoke all on function hub_private.owner_catalog_change(
 uuid,uuid,text,text,text,timestamptz,text,text)
 from public,anon,authenticated,service_role;
