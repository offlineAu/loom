-- Phase 1C.5 finding: Supabase cloud projects auto-grant anon/authenticated
-- full privileges on every new public-schema object via project-level
-- ALTER DEFAULT PRIVILEGES entries (the `auto_expose_new_tables` default).
-- The Phase 1C migration's `revoke all ... from public` statements do not
-- touch these, because default ACLs grant directly to the named roles
-- (anon, authenticated), not through the PUBLIC pseudo-role. The local
-- embedded-Postgres test harness (tests/db/auth-stub.sql) creates anon and
-- authenticated by hand with zero privileges, so it never reproduced this
-- and the gap was invisible to the 40/40 local RLS suite.
--
-- RLS itself was unaffected by this — with no anon-role policy on any
-- table, anon's PostgREST reads already return zero rows and writes already
-- fail with 42501. This migration removes the redundant table/function
-- grants so the deployed access boundary matches the schema's documented
-- authenticated-only contract instead of relying solely on RLS as the only
-- backstop.

revoke all on public.profiles from anon;
revoke all on public.trackers from anon;
revoke all on public.tracker_members from anon;

revoke execute on function public.my_tracker_role(text) from anon, public;
revoke execute on function public.create_tracker(text, text, text, text, jsonb) from anon, public;
revoke execute on function public.handle_new_user() from anon, public;
revoke execute on function public.set_updated_at() from anon, public;

grant execute on function public.my_tracker_role(text) to authenticated;
