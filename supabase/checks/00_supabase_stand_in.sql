-- Stand-ins for what a Supabase project already provides (the auth schema,
-- auth.uid() and the API roles), so the migration can be tested on plain
-- Postgres in CI. Never run this against a real Supabase project.

do $$ begin
  -- Roles are cluster-wide, so only create them the first time.
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon, authenticated;
create schema auth; grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
-- Supabase's default: API roles get table privileges, RLS decides rows.
alter default privileges in schema public grant all on tables to anon, authenticated;
