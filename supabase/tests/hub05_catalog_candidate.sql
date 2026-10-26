-- Disposable, synthetic PostgreSQL test. Never run against managed Supabase.
\set ON_ERROR_STOP on
create function pg_temp.expect_failure(statement text, expected_state text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate=expected_state then return; end if;
    raise;
  end;
  raise exception 'Expected SQLSTATE % for %', expected_state, statement;
end $$;

insert into hub_catalog_private.catalog_items(id,sku) values
('10000000-0000-4000-8000-000000000001','DEMO-ALFA'),
('10000000-0000-4000-8000-000000000002','DEMO-BETA');
insert into hub_catalog_private.catalog_versions(id,item_id,revision,name,presentation,segment,document_ref) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',1,'Referencia Alfa ficticia','Embalagem A','Exemplo','DEMO-DOC-001'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',1,'Referencia Beta ficticia','Embalagem B','Exemplo','DEMO-DOC-002');
insert into hub_catalog_private.commercial_versions(id,revision,audience,valid_from,valid_until,terms) values
('30000000-0000-4000-8000-000000000001',1,'Publico ficticio','2026-01-01','2027-01-01','Sem validade comercial'),
('30000000-0000-4000-8000-000000000002',2,'Publico ficticio','2026-10-01','2026-11-01','Sem validade comercial'),
('30000000-0000-4000-8000-000000000003',3,'Publico ficticio','2026-10-01','2026-12-01','Tabela vazia de ensaio');
insert into hub_catalog_private.price_items(commercial_version_id,catalog_version_id,item_id,amount_minor) values
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',12900),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',13900);
insert into hub_catalog_private.campaigns(id,code,name,purpose,channel,starts_on,ends_on,utm_campaign) values
('40000000-0000-4000-8000-000000000001','DEMO-OUTUBRO','Campanha ficticia','Validar referencias fixas','interno','2026-10-01','2026-11-01','demo-outubro');
insert into hub_catalog_private.campaign_references(campaign_id,commercial_version_id,catalog_version_id) values
('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');

do $$ begin
  if hub_catalog_private.current_commercial_version('2026-10-26') is not null then raise exception 'Automatic selection'; end if;
end $$;
insert into hub_catalog_private.selections(commercial_version_id,selected_on,reason) values
('30000000-0000-4000-8000-000000000001','2026-10-26','Primeira escolha exclusivamente sintetica'),
('30000000-0000-4000-8000-000000000002','2026-10-26','Segunda escolha exclusivamente sintetica');
do $$ begin
  if hub_catalog_private.current_commercial_version('2026-10-31') is distinct from '30000000-0000-4000-8000-000000000002'::uuid then raise exception 'Wrong selection'; end if;
  if hub_catalog_private.current_commercial_version('2026-11-01') is not null then raise exception 'Expired table or historic fallback'; end if;
  if hub_catalog_private.current_commercial_version('2026-10-25') is not null then raise exception 'Decision before selection day'; end if;
  if (select p.amount_minor from hub_catalog_private.campaign_references r join hub_catalog_private.price_items p using(commercial_version_id,catalog_version_id)) <> 12900 then raise exception 'Campaign repriced'; end if;
  if (select count(*) from hub_catalog_private.selections) <> 2 then raise exception 'Decision lost'; end if;
end $$;

select pg_temp.expect_failure($q$insert into hub_catalog_private.catalog_items(sku) values('DEMO-ALFA')$q$,'23505');
select pg_temp.expect_failure($q$insert into hub_catalog_private.catalog_versions(item_id,revision,name,presentation,segment,document_ref) values('10000000-0000-4000-8000-000000000009',1,'Nome','A','Exemplo','DEMO-DOC-009')$q$,'23503');
select pg_temp.expect_failure($q$insert into hub_catalog_private.commercial_versions(revision,audience,valid_from,valid_until,terms) values(4,'Exemplo','2026-11-01','2026-10-01','Periodo invalido')$q$,'23514');
select pg_temp.expect_failure($q$insert into hub_catalog_private.commercial_versions(revision,audience,valid_from,valid_until,terms) values(4,'Exemplo','2026-11-01','infinity','Periodo invalido')$q$,'23514');
select pg_temp.expect_failure($q$insert into hub_catalog_private.price_items(commercial_version_id,catalog_version_id,item_id,amount_minor) values('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',-1)$q$,'23514');
select pg_temp.expect_failure($q$insert into hub_catalog_private.price_items(commercial_version_id,catalog_version_id,item_id,amount_minor) values('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',14900)$q$,'23503');
select pg_temp.expect_failure($q$insert into hub_catalog_private.selections(commercial_version_id,selected_on,reason) values('30000000-0000-4000-8000-000000000003','2026-10-26','Tentativa de selecionar tabela vazia')$q$,'23514');
select pg_temp.expect_failure($q$insert into hub_catalog_private.selections(commercial_version_id,selected_on,reason) values('30000000-0000-4000-8000-000000000002','2026-11-01','Tentativa de selecionar tabela vencida')$q$,'23514');
select pg_temp.expect_failure($q$insert into hub_catalog_private.selections(commercial_version_id,selected_on,reason) values('30000000-0000-4000-8000-000000000001','2026-10-25','Tentativa de retroceder a decisao')$q$,'23514');
select pg_temp.expect_failure($q$insert into hub_catalog_private.selections(commercial_version_id,selected_on,reason) values('30000000-0000-4000-8000-000000000001','2026-10-26','curto')$q$,'23514');
select pg_temp.expect_failure($q$insert into hub_catalog_private.price_items(commercial_version_id,catalog_version_id,item_id,amount_minor) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',14900)$q$,'42501');
select pg_temp.expect_failure($q$insert into hub_catalog_private.campaign_references(campaign_id,commercial_version_id,catalog_version_id) values('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002')$q$,'23503');
select pg_temp.expect_failure($q$insert into hub_catalog_private.campaign_references(campaign_id,commercial_version_id,catalog_version_id) values('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001')$q$,'23505');
select pg_temp.expect_failure($q$update hub_catalog_private.catalog_versions set name='Reescrito'$q$,'42501');
select pg_temp.expect_failure($q$update hub_catalog_private.price_items set amount_minor=1$q$,'42501');
select pg_temp.expect_failure($q$delete from hub_catalog_private.selections$q$,'42501');
select pg_temp.expect_failure($q$delete from hub_catalog_private.audit_events$q$,'42501');
select pg_temp.expect_failure($q$truncate hub_catalog_private.audit_events$q$,'42501');

-- A new catalog version preserves price references and original metadata.
insert into hub_catalog_private.catalog_versions(item_id,revision,name,presentation,segment,document_ref)
values('10000000-0000-4000-8000-000000000001',2,'Nova referencia ficticia','Nova embalagem','Exemplo','DEMO-DOC-003');
do $$ begin
  if (select count(*) from hub_catalog_private.catalog_versions where item_id='10000000-0000-4000-8000-000000000001') <> 2 then raise exception 'Version history differs'; end if;
  if (select catalog_version_id from hub_catalog_private.campaign_references limit 1) <> '20000000-0000-4000-8000-000000000001' then raise exception 'Campaign reference moved'; end if;
end $$;

-- Failure in audit must roll back the originating insertion.
create function pg_temp.audit_failure() returns trigger language plpgsql as $$ begin raise exception 'Injected audit failure'; end $$;
create trigger injected_failure before insert on hub_catalog_private.audit_events for each row execute function pg_temp.audit_failure();
select pg_temp.expect_failure($q$insert into hub_catalog_private.catalog_items(sku) values('DEMO-ROLLBACK')$q$,'P0001');
drop trigger injected_failure on hub_catalog_private.audit_events;
do $$ begin
  if exists(select 1 from hub_catalog_private.catalog_items where sku='DEMO-ROLLBACK') then raise exception 'Unlogged insertion survived'; end if;
end $$;

-- 96 actual denied operations: 3 roles x 8 tables x 4 operations.
begin;
do $$ declare r text; t text; statement text; denied integer:=0; begin
  foreach r in array array['anon','authenticated','service_role'] loop
    foreach t in array array['catalog_items','catalog_versions','commercial_versions','price_items','selections','campaigns','campaign_references','audit_events'] loop
      foreach statement in array array[format('select * from hub_catalog_private.%I',t),format('insert into hub_catalog_private.%I default values',t),format('update hub_catalog_private.%I set id=id',t),format('delete from hub_catalog_private.%I',t)] loop
        begin
          execute format('set local role %I',r);
          execute statement;
          raise exception 'Unexpected API access: % / %',r,statement;
        exception when insufficient_privilege then denied:=denied+1;
        end;
        reset role;
      end loop;
    end loop;
  end loop;
  if denied <> 96 then raise exception 'Expected 96 denials, observed %',denied; end if;
  raise notice 'PASS: 96 real DML/SELECT ACL denials including service_role BYPASSRLS';
end $$;
rollback;

-- RLS separately denies reads even when SELECT and schema USAGE are temporarily granted.
begin;
grant usage on schema hub_catalog_private to authenticated;
grant select on all tables in schema hub_catalog_private to authenticated;
set local role authenticated;
do $$ declare t text; n bigint; begin
  foreach t in array array['catalog_items','catalog_versions','commercial_versions','price_items','selections','campaigns','campaign_references','audit_events'] loop
    execute format('select count(*) from hub_catalog_private.%I',t) into n;
    if n <> 0 then raise exception 'RLS disclosed %',t; end if;
  end loop;
end $$;
rollback;
do $$ begin
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='hub_catalog_private' and c.relkind='r' and c.relrowsecurity) <> 8 then raise exception 'RLS inventory mismatch'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='hub_catalog_private' and p.prosecdef) then raise exception 'Unexpected SECURITY DEFINER'; end if;
  if has_schema_privilege('authenticated','hub_catalog_private','USAGE') then raise exception 'Temporary grant leaked'; end if;
  if (select count(*) from hub_catalog_private.audit_events) <> 14 then raise exception 'Atomic audit count mismatch'; end if;
end $$;
\echo 'PASS: immutable versions, explicit validity, fixed campaign references, atomic audit, constraints and independent RLS'
