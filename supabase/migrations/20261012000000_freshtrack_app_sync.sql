-- FreshTrack: one shared copy of the app's data for every phone and browser.
--
-- Each app record (a pickup, a counted line, a numbered bag, a dispatch...)
-- is one row of ft_rows: its kind, its id, and its fields as JSON. Phones
-- never write rows directly. They send a batch of changes to ft_commit,
-- which applies it as one new revision only if the phone had already seen
-- the latest revision. If another phone got in first, nothing is written:
-- the phone pulls what it missed, redoes its change on top and sends again.
-- That is what stops two phones from handing out the same bag number or
-- overfilling the same bag.
--
-- ft_meta.rev is the current revision. Phones listen to it over Realtime
-- and pull the rows with a higher rev whenever it moves.
--
-- Access: only signed-in Supabase users listed in ft_members can read or
-- change anything. Staff still pick their name and PIN inside the app.

create table if not exists public.ft_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);
alter table public.ft_members enable row level security;
drop policy if exists ft_members_read_self on public.ft_members;
create policy ft_members_read_self on public.ft_members
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.ft_is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ft_members m where m.user_id = (select auth.uid()))
$$;

create table if not exists public.ft_meta (
  id int primary key default 1 check (id = 1),
  rev bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.ft_meta (id, rev) values (1, 0) on conflict (id) do nothing;
alter table public.ft_meta enable row level security;
drop policy if exists ft_meta_read on public.ft_meta;
create policy ft_meta_read on public.ft_meta
  for select to authenticated using ((select public.ft_is_member()));

create table if not exists public.ft_rows (
  kind text not null check (kind in (
    'companies', 'distributors', 'products', 'users', 'collections',
    'countLines', 'sortedBags', 'dispatches', 'records', 'seq'
  )),
  id text not null check (length(id) between 1 and 200),
  data jsonb,
  deleted boolean not null default false,
  rev bigint not null,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (kind, id)
);
create index if not exists ft_rows_rev_idx on public.ft_rows (rev);
alter table public.ft_rows enable row level security;
drop policy if exists ft_rows_read on public.ft_rows;
create policy ft_rows_read on public.ft_rows
  for select to authenticated using ((select public.ft_is_member()));

-- Which changes have been applied, so a change resent after a dropped
-- connection is recognised instead of being applied twice.
create table if not exists public.ft_ops (
  id text primary key,
  rev bigint not null,
  at timestamptz not null default now()
);
create index if not exists ft_ops_at_idx on public.ft_ops (at);
alter table public.ft_ops enable row level security;

revoke all on public.ft_rows, public.ft_meta, public.ft_members, public.ft_ops from anon;
revoke insert, update, delete, truncate on public.ft_rows, public.ft_meta, public.ft_members, public.ft_ops from authenticated;
revoke select on public.ft_ops from authenticated;
grant select on public.ft_rows, public.ft_meta, public.ft_members to authenticated;

-- Everything changed since `since`, in one snapshot, with the revision it is at.
create or replace function public.ft_pull(since bigint default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ft_is_member() then
    raise exception 'not a member of this business' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'rev', (select m.rev from public.ft_meta m where m.id = 1),
      'rows', coalesce((
        select jsonb_agg(
          jsonb_build_object('kind', r.kind, 'id', r.id, 'data', r.data, 'deleted', r.deleted, 'rev', r.rev)
          order by r.rev, r.kind, r.id
        )
        from public.ft_rows r
        where r.rev > since
      ), '[]'::jsonb)
    )
  );
end $$;

-- Applies changes [{kind, id, data, deleted}] as one new revision when
-- base_rev is still the latest. Returns {ok, rev}, plus `applied` when some
-- of op_ids were already committed earlier.
create or replace function public.ft_commit(base_rev bigint, changes jsonb, op_ids text[] default '{}', actor text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  current_rev bigint;
  next_rev bigint;
  done text[];
begin
  if not public.ft_is_member() then
    raise exception 'not a member of this business' using errcode = '42501';
  end if;
  if jsonb_typeof(changes) is distinct from 'array' then
    raise exception 'changes must be an array' using errcode = '22023';
  end if;

  select m.rev into current_rev from public.ft_meta m where m.id = 1 for update;

  select array_agg(o.id) into done from public.ft_ops o where o.id = any(coalesce(op_ids, '{}'));
  if done is not null then
    return jsonb_build_object('ok', false, 'rev', current_rev, 'applied', to_jsonb(done));
  end if;
  if current_rev <> base_rev then
    return jsonb_build_object('ok', false, 'rev', current_rev);
  end if;
  if jsonb_array_length(changes) = 0 then
    return jsonb_build_object('ok', true, 'rev', current_rev);
  end if;

  next_rev := current_rev + 1;
  insert into public.ft_rows as r (kind, id, data, deleted, rev, updated_at, updated_by)
  select c->>'kind',
         c->>'id',
         case when coalesce((c->>'deleted')::boolean, false) then null else c->'data' end,
         coalesce((c->>'deleted')::boolean, false),
         next_rev, now(), left(actor, 80)
  from jsonb_array_elements(changes) as c
  on conflict (kind, id) do update
    set data = excluded.data, deleted = excluded.deleted, rev = excluded.rev,
        updated_at = excluded.updated_at, updated_by = excluded.updated_by;

  insert into public.ft_ops (id, rev)
  select distinct unnest(coalesce(op_ids, '{}')), next_rev
  on conflict (id) do nothing;
  delete from public.ft_ops where at < now() - interval '60 days';

  update public.ft_meta set rev = next_rev, updated_at = now() where id = 1;
  return jsonb_build_object('ok', true, 'rev', next_rev);
end $$;

revoke all on function public.ft_is_member() from public, anon;
revoke all on function public.ft_pull(bigint) from public, anon;
revoke all on function public.ft_commit(bigint, jsonb, text[], text) from public, anon;
grant execute on function public.ft_is_member() to authenticated;
grant execute on function public.ft_pull(bigint) to authenticated;
grant execute on function public.ft_commit(bigint, jsonb, text[], text) to authenticated;

-- Phones listen to the revision and pull when it moves.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ft_meta'
  ) then
    alter publication supabase_realtime add table public.ft_meta;
  end if;
end $$;

notify pgrst, 'reload schema';
