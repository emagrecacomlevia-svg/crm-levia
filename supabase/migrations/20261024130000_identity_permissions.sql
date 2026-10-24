-- HUB-04B1 candidate. Reviewed in Git only; NEVER applied to the remote Supabase project.
-- Creation expects the Supabase-managed auth.users table to exist; does not alter it.
-- Authenticated identities receive no business permission by the existence of an account.

create schema hub_private;
revoke all on schema hub_private from public, anon, authenticated, service_role;

create table hub_private.admin_accounts (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz default now(),
  created_by_auth_user_id uuid references auth.users (id) on delete set null,
  constraint admin_account_status_consistency check (
    (is_enabled and disabled_at is null)
    or (not is_enabled and disabled_at is not null)
  ),
  constraint admin_account_timestamp_order check (updated_at >= created_at),
  constraint admin_account_no_self_creation check (
    created_by_auth_user_id is distinct from auth_user_id
  )
);

-- Static vocabulary, not a grant. Approval types are purposefully separate.
create table hub_private.capabilities (
  code text primary key,
  description text not null,
  constraint capability_code_shape check (
    code ~ '^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$'
  ),
  constraint capability_description_nonempty check (length(btrim(description)) > 0)
);

insert into hub_private.capabilities (code, description)
values
  ('core.read', 'Read expressly delegated core information'),
  ('users.manage', 'Manage identities subject to independent approval'),
  ('crm.read', 'Read an explicitly delegated CRM scope'),
  ('crm.write', 'Write within an explicitly delegated CRM scope'),
  ('social.read', 'Read an explicitly delegated editorial scope'),
  ('social.write', 'Prepare content in an explicitly delegated editorial scope'),
  ('content.review_editorial', 'Perform delegated editorial review'),
  ('content.review_scientific', 'Perform delegated scientific review'),
  ('content.approve_commercial', 'Perform delegated commercial/document approval');

create table hub_private.permission_grants (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references hub_private.admin_accounts (auth_user_id)
    on delete cascade,
  capability_code text not null references hub_private.capabilities (code),
  scope_kind text not null,
  scope_key text not null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  revoked_at timestamptz,
  granted_at timestamptz not null default now(),
  granted_by_auth_user_id uuid references auth.users (id) on delete set null,
  revoked_by_auth_user_id uuid references auth.users (id) on delete set null,
  constraint grant_valid_window check (valid_until is null or valid_until > valid_from),
  constraint grant_scope_nonempty check (
    scope_key ~ '^[a-z][a-z0-9:_-]{0,127}$'
    and scope_key not in ('all', 'global')
  ),
  constraint grant_scope_domain check (
    (capability_code in ('core.read', 'users.manage') and (
      (scope_kind = 'module' and scope_key = 'core')
      or (scope_kind = 'resource' and scope_key ~ '^core:[a-z0-9_-]+$')
    ))
    or (capability_code in ('crm.read', 'crm.write') and (
      (scope_kind = 'module' and scope_key = 'crm')
      or (scope_kind = 'resource' and scope_key ~ '^crm:[a-z0-9_-]+$')
    ))
    or (capability_code in (
      'social.read', 'social.write', 'content.review_editorial',
      'content.review_scientific', 'content.approve_commercial'
    ) and (
      (scope_kind = 'module' and scope_key = 'social')
      or (scope_kind = 'resource' and scope_key ~ '^social:[a-z0-9_-]+$')
    ))
  ),
  constraint grant_no_self_assignment check (
    granted_by_auth_user_id is distinct from subject_user_id
  ),
  constraint grant_no_self_revocation check (
    revoked_by_auth_user_id is distinct from subject_user_id
  ),
  constraint grant_revocation_consistency check (
    revoked_at is not null or revoked_by_auth_user_id is null
  )
);

-- At most one non-revoked grant per exact subject/capability/scope.
-- Renewals require revocation of the preceding row, preserving history.
create unique index permission_grant_one_unrevoked_scope
  on hub_private.permission_grants (
    subject_user_id, capability_code, scope_kind, scope_key
  ) where revoked_at is null;

-- Event storage only. Future privileged, reviewed transactional writers must emit events;
-- this phase deliberately creates no SECURITY DEFINER function, trigger or API.
create table hub_private.permission_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  subject_user_id uuid not null,
  grant_id uuid,
  actor_auth_user_id uuid references auth.users (id) on delete set null,
  occurred_at timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb,
  constraint audit_event_type_known check (
    event_type in (
      'account_created', 'account_enabled', 'account_disabled',
      'grant_created', 'grant_updated', 'grant_revoked'
    )
  ),
  constraint audit_context_is_object check (jsonb_typeof(context) = 'object'),
  constraint audit_event_subject check (subject_user_id <> actor_auth_user_id)
);

create index permission_audit_by_subject_date
  on hub_private.permission_audit_events (subject_user_id, occurred_at desc);

-- Defense in depth: RLS enabled, zero positive policies, no client schema/table privileges.
-- The owner/privileged migrations executor can administer in a later authorized phase.
alter table hub_private.admin_accounts enable row level security;
alter table hub_private.capabilities enable row level security;
alter table hub_private.permission_grants enable row level security;
alter table hub_private.permission_audit_events enable row level security;

revoke all on all tables in schema hub_private
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema hub_private
  from public, anon, authenticated, service_role;
revoke all on all functions in schema hub_private
  from public, anon, authenticated, service_role;

-- Defaults are per object owner. Additional migration roles will need their own review.
alter default privileges in schema hub_private revoke all on tables
  from public, anon, authenticated, service_role;
alter default privileges in schema hub_private revoke all on sequences
  from public, anon, authenticated, service_role;
alter default privileges in schema hub_private revoke all on functions
  from public, anon, authenticated, service_role;
