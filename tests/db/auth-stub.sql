-- Test-only stand-in for the parts of a real Supabase project's `auth`
-- schema that our RLS policies depend on: the `auth.users` table,
-- `auth.uid()`, and the `anon`/`authenticated` Postgres roles.
--
-- This file is NOT a migration and is NEVER applied to a real Supabase
-- project (Supabase already provides all of this) — it exists only so the
-- real migration SQL under supabase/migrations/ can be exercised, unmodified,
-- against a disposable embedded PostgreSQL instance in tests/db/rls.test.ts.
--
-- auth.uid() is reproduced verbatim from Supabase's own auth schema
-- (public, documented behavior: reads the "sub" claim that PostgREST sets
-- via `request.jwt.claims` for the current request/session) so the RLS
-- policies under test see identical semantics to the real thing.

create schema auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create function auth.uid()
returns uuid
language sql
stable
as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$;

-- Real Supabase projects grant these to the `authenticator` role that
-- PostgREST connects as, which then does `SET LOCAL ROLE` per request based
-- on the caller's JWT. Our tests connect as the bootstrap superuser and do
-- the same `SET ROLE` directly, so it only needs to be a member of both.
create role anon nologin;
create role authenticated nologin;
grant anon to current_user;
grant authenticated to current_user;
