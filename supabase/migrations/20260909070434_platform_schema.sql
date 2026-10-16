-- LOOM Phase 1C — Platform schema: profiles, trackers, tracker_members.
--
-- Scope: cloud persistence + RLS foundation only. No sync engine, no
-- Debt-domain tables, no migration RPC (Phase 1D). See
-- docs/LOOM-PHASE-1C-SUPABASE-AUTH-RLS.md for the full design rationale.
--
-- This file assumes it runs against a real Supabase project, which already
-- provides the `auth` schema (`auth.users`, `auth.uid()`). It does not
-- create or modify anything under `auth`.

-- =============================================================================
-- profiles
-- =============================================================================
-- One row per authenticated user, keyed by the Supabase Auth user id. No
-- password or auth-secret material is ever duplicated here — this table only
-- ever holds display-level profile data.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per authenticated user. Bootstrapped automatically by the handle_new_user trigger on auth.users insert — never created directly by client code.';

-- =============================================================================
-- trackers
-- =============================================================================
-- Cloud counterpart to Phase 1B's local `TrackerRow`. Deliberately has no
-- owner/user_id column: ownership is derived entirely from tracker_members,
-- matching the Phase 0 decision (D-006/D-007) that a tracker's relationship
-- to people is always membership-based, never a single FK.
--
-- `id` is the app-generated ULID (Decision D-002), NOT a Postgres-generated
-- uuid/serial — kept identical in shape to Dexie's `trackers.id` so a future
-- sync/migration phase can treat a local tracker's id and its cloud id as
-- literally the same value, with no ID-rewrite step required.
create table public.trackers (
  id text primary key,
  template_key text not null,
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trackers_id_is_ulid check (id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'),
  constraint trackers_template_key_not_blank check (length(trim(template_key)) > 0),
  constraint trackers_name_not_blank check (length(trim(name)) > 0)
);

comment on table public.trackers is
  'Cloud-backed tracker instances. No owner column by design — see tracker_members. Only ever inserted via the create_tracker() RPC (see below); RLS denies direct client INSERT entirely.';
comment on column public.trackers.id is
  'Client-generated ULID (Decision D-002), same format/value space as the local Dexie tracker id — not a database-generated identity.';
comment on column public.trackers.settings is
  'Opaque per-template JSON blob, mirroring the deliberate Phase 1B decision not to create a separate tracker_settings table until a concrete structured consumer exists.';

create index trackers_template_key_idx on public.trackers (template_key);
create index trackers_archived_at_idx on public.trackers (archived_at);
create index trackers_created_at_idx on public.trackers (created_at);

-- =============================================================================
-- tracker_members
-- =============================================================================
-- Membership is a real relational table, not `tracker.user_id` — a tracker
-- can have multiple members (owner/editor/viewer) once sharing exists.
create table public.tracker_members (
  id text primary key,
  tracker_id text not null references public.trackers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracker_members_id_is_ulid check (id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'),
  constraint tracker_members_role_valid check (role in ('owner', 'editor', 'viewer')),
  constraint tracker_members_unique_per_tracker unique (tracker_id, user_id)
);

comment on table public.tracker_members is
  'Owner/editor/viewer membership of a cloud tracker. Exactly one owner per tracker is enforced by tracker_members_one_owner_idx below, not merely by convention.';

create index tracker_members_tracker_id_idx on public.tracker_members (tracker_id);
create index tracker_members_user_id_idx on public.tracker_members (user_id);

-- Exactly one owner per tracker — enforced at the database, not just by the
-- RPC/application. Any attempt (via any code path) to insert a second owner
-- row for the same tracker fails this constraint.
create unique index tracker_members_one_owner_idx
  on public.tracker_members (tracker_id)
  where (role = 'owner');

-- =============================================================================
-- updated_at is always database-set, never trusted from the client
-- =============================================================================
-- Deliberate client/server split (documented in the Phase 1C report, §Timestamps):
-- created_at/updated_at are database-generated here (DEFAULT now() / this
-- trigger), unlike Phase 1B's Dexie rows where the client is the only clock
-- available. archived_at remains an application-set value (mirroring the
-- existing local archive()/restore() shape) since it is ordinary app state,
-- not audit-sensitive metadata.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trackers_set_updated_at
  before update on public.trackers
  for each row execute function public.set_updated_at();

create trigger tracker_members_set_updated_at
  before update on public.tracker_members
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.trackers enable row level security;
alter table public.tracker_members enable row level security;

-- --- profiles -----------------------------------------------------------
-- No INSERT policy exists at all: rows are created only by the
-- handle_new_user trigger below (SECURITY DEFINER, runs as the trigger
-- owner) — an authenticated user can never insert their own or anyone
-- else's profile row directly. No DELETE policy exists either: profile
-- deletion is not a Phase 1C feature.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- --- helper: the caller's own role on a given tracker, if any ------------
-- A tracker_members policy that queries tracker_members from within its own
-- USING/WITH CHECK clause triggers Postgres to re-apply tracker_members'
-- SELECT policy to evaluate that inner query, which queries tracker_members
-- again, recursing indefinitely ("infinite recursion detected in policy for
-- relation tracker_members" — a real, well-known PostgreSQL/Supabase RLS
-- pitfall, caught here by the tests/db/rls.test.ts suite actually executing
-- against real PostgreSQL, not by policies merely parsing/compiling).
--
-- The fix: route every "what's my role here" check through this SECURITY
-- DEFINER function instead of an inline subquery. Running as the function's
-- (table-owning) definer, its internal SELECT bypasses tracker_members' RLS
-- entirely rather than re-triggering it, breaking the recursion. This is the
-- standard, documented pattern for self-referential RLS checks.
create function public.my_tracker_role(p_tracker_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.tracker_members
  where tracker_id = p_tracker_id
    and user_id = auth.uid()
$$;

-- --- trackers -------------------------------------------------------------
-- No INSERT policy exists: creation only happens through create_tracker()
-- below. Direct `insert into trackers ...` from an authenticated client is
-- denied by RLS with no matching policy.
create policy "trackers_select_member"
  on public.trackers for select
  to authenticated
  using (public.my_tracker_role(trackers.id) is not null);

-- Owner and editor may update — including archived_at (archive/restore).
-- Per the closed Phase 0 decision D-006 ("editors archive/soft-delete; only
-- owners permanently delete"), archiving is NOT owner-exclusive; only the
-- permanent DELETE below is.
create policy "trackers_update_owner_or_editor"
  on public.trackers for update
  to authenticated
  using (public.my_tracker_role(trackers.id) in ('owner', 'editor'))
  with check (public.my_tracker_role(trackers.id) in ('owner', 'editor'));

-- Only the owner may permanently delete.
create policy "trackers_delete_owner"
  on public.trackers for delete
  to authenticated
  using (public.my_tracker_role(trackers.id) = 'owner');

-- --- tracker_members --------------------------------------------------------
-- Any member (owner/editor/viewer) can see the full membership list of a
-- tracker they belong to.
create policy "tracker_members_select_fellow_member"
  on public.tracker_members for select
  to authenticated
  using (public.my_tracker_role(tracker_members.tracker_id) is not null);

-- Only an owner may add new members, and never as another owner — a second
-- owner row is also independently blocked by tracker_members_one_owner_idx.
-- The initial owner row itself is created only by create_tracker() (which
-- runs as SECURITY DEFINER and so bypasses this policy for that one insert).
create policy "tracker_members_insert_owner_adds_non_owner"
  on public.tracker_members for insert
  to authenticated
  with check (
    role in ('editor', 'viewer')
    and public.my_tracker_role(tracker_members.tracker_id) = 'owner'
  );

-- Only an owner may change another member's role, only between
-- editor/viewer, and never touching the owner row itself (USING excludes
-- role = 'owner' rows entirely, so there is no generic "owner can update any
-- membership row" policy that could be used to self-promote or reassign
-- ownership — see §15/§30 of the Phase 1C brief).
create policy "tracker_members_update_owner_reassigns_non_owner"
  on public.tracker_members for update
  to authenticated
  using (
    role <> 'owner'
    and public.my_tracker_role(tracker_members.tracker_id) = 'owner'
  )
  with check (role in ('editor', 'viewer'));

-- Only an owner may remove a member, and never the owner row itself (so a
-- generic delete can never leave a tracker without an owner; ownership
-- transfer is explicitly out of scope for Phase 1C — see the report).
create policy "tracker_members_delete_owner_removes_non_owner"
  on public.tracker_members for delete
  to authenticated
  using (
    role <> 'owner'
    and public.my_tracker_role(tracker_members.tracker_id) = 'owner'
  );

-- =============================================================================
-- Profile bootstrap: runs on auth.users insert, not reachable by client code.
-- =============================================================================
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- create_tracker(): the only way a tracker (and its owner membership) can
-- ever be created. Atomic, derives ownership from auth.uid() only — the
-- caller-supplied ids are pure client-generated ULIDs (Decision D-002), never
-- an owner/user identity.
-- =============================================================================
create function public.create_tracker(
  p_tracker_id text,
  p_member_id text,
  p_template_key text,
  p_name text,
  p_settings jsonb default '{}'::jsonb
)
returns public.trackers
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  created_tracker public.trackers;
begin
  if caller is null then
    raise exception 'must be authenticated to create a tracker' using errcode = '28000';
  end if;

  if p_tracker_id !~ '^[0-9A-HJKMNP-TV-Z]{26}$' then
    raise exception 'p_tracker_id must be a well-formed ULID' using errcode = '22023';
  end if;

  if p_member_id !~ '^[0-9A-HJKMNP-TV-Z]{26}$' then
    raise exception 'p_member_id must be a well-formed ULID' using errcode = '22023';
  end if;

  if length(trim(p_template_key)) = 0 then
    raise exception 'p_template_key must not be blank' using errcode = '22023';
  end if;

  if length(trim(p_name)) = 0 then
    raise exception 'p_name must not be blank' using errcode = '22023';
  end if;

  insert into public.trackers (id, template_key, name, settings)
  values (p_tracker_id, p_template_key, p_name, coalesce(p_settings, '{}'::jsonb))
  returning * into created_tracker;

  -- Ownership is derived from auth.uid() here, never from a client-supplied
  -- owner id — this is the one place a tracker's owner membership is ever
  -- created, so "create this tracker for user X" is not an expressible
  -- request from the client.
  insert into public.tracker_members (id, tracker_id, user_id, role)
  values (p_member_id, p_tracker_id, caller, 'owner');

  return created_tracker;
end;
$$;

revoke all on function public.create_tracker(text, text, text, text, jsonb) from public;
grant execute on function public.create_tracker(text, text, text, text, jsonb) to authenticated;

-- =============================================================================
-- Grants
-- =============================================================================
-- RLS is the real access boundary; these grants only establish that
-- `authenticated`/`anon` may address these tables/functions at all (RLS then
-- filters every row). No sequence grants are needed — no serial/identity
-- columns exist (every primary key is a client-generated ULID or a
-- references-checked uuid).
grant select, update on public.profiles to authenticated;
grant select, update, delete on public.trackers to authenticated;
grant select, insert, update, delete on public.tracker_members to authenticated;
