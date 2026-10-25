-- Disposable PostgreSQL 17 only; expanded Auth stub, not managed Auth.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_app_meta_data) values
 ('30000000-0000-0000-0000-000000000001','{"purpose":"hub04-qa-synthetic"}'),
 ('30000000-0000-0000-0000-000000000002','{"purpose":"hub04-qa-synthetic"}'),
 ('30000000-0000-0000-0000-000000000003','{"purpose":"hub04-qa-synthetic"}');
insert into auth.sessions(id,user_id,created_at) values
 ('30000000-0000-0000-0000-000000000011','30000000-0000-0000-0000-000000000001',now());
select hub_private.bootstrap_first_admin('30000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001','Synthetic isolated bootstrap QA');
select hub_private.session_bound_write('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000011','create-account','{"subject":"30000000-0000-0000-0000-000000000002"}');
do $$ begin
 if (select count(*) from hub_private.permission_audit_events where context->>'qa_run'='hub04-20261025')<>5 then raise exception 'QA provenance missing'; end if;
 begin
  update hub_private.permission_audit_events set context='{}';
  raise exception 'Audit mutable';
 exception when insufficient_privilege then null; end;
 begin
  perform hub_private.session_bound_write('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000099','set-enabled','{"subject":"30000000-0000-0000-0000-000000000002","enabled":true}');
  raise exception 'Unknown session accepted';
 exception when insufficient_privilege then null; end;
end $$;
update auth.sessions set not_after=now()-interval '1 second';
do $$ begin
 if hub_private.session_is_active('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000011') then raise exception 'Expired session accepted'; end if;
end $$;
update auth.sessions set not_after=null;
update auth.users set banned_until=now()+interval '1 day' where id='30000000-0000-0000-0000-000000000001';
do $$ begin
 if hub_private.session_is_active('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000011') then raise exception 'Banned user accepted'; end if;
end $$;
delete from auth.sessions;
do $$ begin
 if hub_private.session_is_active('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000011') then raise exception 'Logged-out session accepted'; end if;
end $$;
delete from auth.users where id='30000000-0000-0000-0000-000000000003';
do $$ begin
 if exists(select 1 from hub_private.permission_audit_events where actor_auth_user_id='30000000-0000-0000-0000-000000000003') then raise exception 'Auth cascade failed'; end if;
 if (select count(*) from hub_private.permission_audit_events where context->>'actor_snapshot'='30000000-0000-0000-0000-000000000003')<>4 then raise exception 'Actor snapshot lost'; end if;
end $$;
rollback;
select 'PASS: live-session gate, append-only audit, actor retention, expiry, ban, logout' as result;
