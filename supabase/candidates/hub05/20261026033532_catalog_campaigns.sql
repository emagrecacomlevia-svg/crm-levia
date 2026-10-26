-- HUB-05 candidate, for disposable PostgreSQL only. NOT deployed or exposed.
-- Generated with Supabase CLI 2.122.0 migration new; original basename preserved.
-- No Auth users, permissions, remote configuration or HUB-04 objects are modified.
begin;
create schema hub_catalog_private;
revoke all on schema hub_catalog_private from public, anon, authenticated, service_role;
alter default privileges in schema hub_catalog_private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema hub_catalog_private revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema hub_catalog_private revoke all on functions from public, anon, authenticated, service_role;

create table hub_catalog_private.catalog_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check (sku ~ '^DEMO-[A-Z0-9-]{1,35}$')
);
create table hub_catalog_private.catalog_versions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references hub_catalog_private.catalog_items(id) on delete restrict,
  revision integer not null check (revision > 0),
  name text not null check (length(btrim(name)) between 1 and 160),
  presentation text not null check (length(btrim(presentation)) between 1 and 160),
  segment text not null check (length(btrim(segment)) between 1 and 160),
  document_ref text not null check (length(btrim(document_ref)) between 1 and 160),
  unique(item_id, revision),
  unique(id, item_id)
);
create table hub_catalog_private.commercial_versions (
  id uuid primary key default gen_random_uuid(),
  revision integer not null unique check (revision > 0),
  audience text not null check (length(btrim(audience)) between 1 and 160),
  currency text not null default 'BRL' check (currency = 'BRL'),
  valid_from date not null,
  valid_until date not null,
  terms text not null check (length(btrim(terms)) between 5 and 500),
  check (isfinite(valid_from) and isfinite(valid_until) and valid_until > valid_from)
);
create table hub_catalog_private.price_items (
  id uuid primary key default gen_random_uuid(),
  commercial_version_id uuid not null references hub_catalog_private.commercial_versions(id) on delete restrict,
  catalog_version_id uuid not null,
  item_id uuid not null,
  amount_minor integer not null check (amount_minor between 1 and 999999999),
  foreign key (catalog_version_id, item_id) references hub_catalog_private.catalog_versions(id, item_id) on delete restrict,
  unique(commercial_version_id, item_id),
  unique(commercial_version_id, catalog_version_id)
);
create index price_items_by_catalog on hub_catalog_private.price_items(catalog_version_id, item_id);
create sequence hub_catalog_private.selection_order;
create table hub_catalog_private.selections (
  id uuid primary key default gen_random_uuid(),
  decision_order bigint not null unique,
  commercial_version_id uuid not null references hub_catalog_private.commercial_versions(id) on delete restrict,
  selected_on date not null check (isfinite(selected_on)),
  reason text not null check (length(btrim(reason)) between 15 and 500)
);
alter sequence hub_catalog_private.selection_order owned by hub_catalog_private.selections.decision_order;
create index selections_by_version on hub_catalog_private.selections(commercial_version_id);
create table hub_catalog_private.campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^DEMO-[A-Z0-9-]{1,35}$'),
  name text not null check (length(btrim(name)) between 1 and 160),
  purpose text not null check (length(btrim(purpose)) between 5 and 500),
  channel text not null check (channel in ('interno','instagram','facebook','tiktok')),
  starts_on date not null,
  ends_on date not null,
  utm_campaign text not null unique check (utm_campaign ~ '^demo-[a-z0-9-]{1,60}$'),
  check (isfinite(starts_on) and isfinite(ends_on) and ends_on > starts_on)
);
create table hub_catalog_private.campaign_references (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references hub_catalog_private.campaigns(id) on delete restrict,
  commercial_version_id uuid not null,
  catalog_version_id uuid not null,
  foreign key (commercial_version_id, catalog_version_id) references hub_catalog_private.price_items(commercial_version_id, catalog_version_id) on delete restrict,
  unique(campaign_id, commercial_version_id, catalog_version_id)
);
create index campaign_references_by_price on hub_catalog_private.campaign_references(commercial_version_id, catalog_version_id);
create table hub_catalog_private.audit_events (
  id uuid primary key default gen_random_uuid(),
  recorded_at timestamptz not null default clock_timestamp(),
  database_actor name not null default current_user,
  entity text not null,
  object_id uuid not null,
  action text not null check (action = 'INSERT')
);
create index catalog_audit_by_object on hub_catalog_private.audit_events(entity, object_id, recorded_at);

-- All writes are append-only. No update/delete path can rewrite a selected snapshot.
create function hub_catalog_private.reject_rewrite() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Historical records are immutable; create a new version' using errcode='42501';
end $$;

create function hub_catalog_private.record_insert() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into hub_catalog_private.audit_events(entity, object_id, action)
  values (tg_table_name, new.id, 'INSERT');
  return new;
end $$;

-- Serialize price construction and sealing using the same parent row lock.
create function hub_catalog_private.guard_price_insert() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from hub_catalog_private.commercial_versions where id=new.commercial_version_id for update;
  if exists(select 1 from hub_catalog_private.selections where commercial_version_id=new.commercial_version_id)
    or exists(select 1 from hub_catalog_private.campaign_references where commercial_version_id=new.commercial_version_id) then
    raise exception 'Selected or referenced tables are sealed' using errcode='42501';
  end if;
  return new;
end $$;
create trigger seal_prices before insert on hub_catalog_private.price_items for each row execute function hub_catalog_private.guard_price_insert();

create function hub_catalog_private.guard_reference() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from hub_catalog_private.commercial_versions where id=new.commercial_version_id for update;
  return new;
end $$;
create trigger lock_reference before insert on hub_catalog_private.campaign_references for each row execute function hub_catalog_private.guard_reference();

create function hub_catalog_private.guard_selection() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v hub_catalog_private.commercial_versions; last_day date;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('hub05-demo-selection'));
  -- Allocate AFTER the serialization lock; callers cannot choose decision order.
  new.decision_order := nextval('hub_catalog_private.selection_order'::regclass);
  select * into v from hub_catalog_private.commercial_versions where id=new.commercial_version_id for update;
  if not found then raise exception 'Missing table version' using errcode='23503'; end if;
  if new.selected_on < v.valid_from or new.selected_on >= v.valid_until then
    raise exception 'Selection outside validity' using errcode='23514';
  end if;
  if not exists(select 1 from hub_catalog_private.price_items where commercial_version_id=v.id) then
    raise exception 'Empty table cannot be selected' using errcode='23514';
  end if;
  select selected_on into last_day from hub_catalog_private.selections order by decision_order desc limit 1;
  if new.selected_on < last_day then raise exception 'Backdated decision denied' using errcode='23514'; end if;
  return new;
end $$;
create trigger validate_selection before insert on hub_catalog_private.selections for each row execute function hub_catalog_private.guard_selection();

-- Select the latest explicit decision FIRST, then evaluate validity. No fallback.
create function hub_catalog_private.current_commercial_version(p_day date) returns uuid
language sql stable security invoker set search_path = '' as $$
  select v.id from
    (select commercial_version_id, selected_on from hub_catalog_private.selections order by decision_order desc limit 1) s
    join hub_catalog_private.commercial_versions v on v.id=s.commercial_version_id
    where isfinite(p_day) and s.selected_on <= p_day and v.valid_from <= p_day and p_day < v.valid_until;
$$;

do $$ declare t text; begin
  foreach t in array array['catalog_items','catalog_versions','commercial_versions','price_items','selections','campaigns','campaign_references','audit_events'] loop
    execute format('alter table hub_catalog_private.%I enable row level security',t);
    execute format('create trigger immutable_record before update or delete on hub_catalog_private.%I for each row execute function hub_catalog_private.reject_rewrite()',t);
    execute format('create trigger no_truncate before truncate on hub_catalog_private.%I for each statement execute function hub_catalog_private.reject_rewrite()',t);
    if t <> 'audit_events' then
      execute format('create trigger atomic_audit after insert on hub_catalog_private.%I for each row execute function hub_catalog_private.record_insert()',t);
    end if;
  end loop;
end $$;
revoke all on all tables in schema hub_catalog_private from public, anon, authenticated, service_role;
revoke all on all sequences in schema hub_catalog_private from public, anon, authenticated, service_role;
revoke all on all functions in schema hub_catalog_private from public, anon, authenticated, service_role;
commit;
