-- FreshTrack initial schema.
--
-- Mirrors src/types/index.ts, and implements the rules in
-- src/lib/operations.ts as Postgres functions, so the database enforces them
-- no matter which client calls it:
--
--   * Pipeline tables (collections, counts, bags, dispatches) are READ-ONLY to
--     clients. Every change goes through one of the functions at the bottom,
--     which check the caller's role and run as a single transaction.
--   * Numbers come from number_counters, which only ever moves forward, so a
--     deleted bag number is never issued again.
--   * Packing takes a lock, so two people pressing "Generate" at the same
--     moment cannot pack the same pieces twice.
--   * Dates are taken in India time (business_today), never UTC.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('admin', 'manager', 'data_entry', 'viewer');
create type public.collection_status as enum ('uncounted', 'counted', 'packed');
create type public.sorted_bag_status as enum ('ready', 'dispatched');
create type public.dispatch_status as enum ('sent', 'under_review', 'partially_settled', 'settled', 'rejected');
create type public.source_type as enum ('own_inventory', 'distributor');
create type public.reason_category as enum (
  'damaged_in_transit', 'expired', 'quality_defect', 'water_damage',
  'packaging_damage', 'returned_by_distributor', 'other'
);
create type public.resolution_status as enum (
  'pending_review', 'under_investigation', 'written_off',
  'returned_to_supplier', 'disposed', 'resolved'
);

-- ---------------------------------------------------------------------------
-- Constants
-- ---------------------------------------------------------------------------

-- Pieces per sorted bag. Must match BAG_CAPACITY in src/lib/bag-packing.ts.
create function public.bag_capacity() returns integer
language sql immutable as $$ select 700 $$;

-- Today's date where the business runs. now()::date would be UTC, which is
-- yesterday in India between midnight and 5:30 AM.
create function public.business_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  role public.user_role not null default 'viewer',
  is_active boolean not null default true,
  last_active timestamptz
);

-- Every new sign-up gets a profile as a viewer. An admin promotes them.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The caller's role, or null for anyone without an active profile.
create function public.current_app_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create function public.require_role(allowed public.user_role[]) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.current_app_role() is null or not (public.current_app_role() = any (allowed)) then
    raise exception 'Your role is not allowed to do this' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Master data
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Prefixes every number, e.g. CAD-M10-2026-0008.
  code text not null unique check (code ~ '^[A-Z0-9]{2,6}$'),
  claim_contact text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.distributors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text not null default '',
  phone text not null default '',
  region text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  sku text not null,
  name text not null,
  category text not null default '',
  unit text not null default 'piece',
  mrp numeric(10, 2) not null check (mrp > 0),
  cost_price numeric(10, 2) not null default 0 check (cost_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, sku)
);

-- ---------------------------------------------------------------------------
-- The pipeline: collect -> count -> pack -> dispatch
-- ---------------------------------------------------------------------------

-- Last number issued per company, kind and year. Only ever moves forward.
create table public.number_counters (
  company_id uuid not null references public.companies (id),
  kind text not null check (kind in ('COL', 'BAG', 'DSP')),
  year integer not null,
  last_value integer not null default 0 check (last_value >= 0),
  primary key (company_id, kind, year)
);

create table public.collection_bags (
  id uuid primary key default gen_random_uuid(),
  bag_number text not null unique,
  company_id uuid not null references public.companies (id),
  distributor_id uuid not null references public.distributors (id),
  collected_date date not null,
  status public.collection_status not null default 'uncounted',
  counted_date date,
  estimated_pieces integer check (estimated_pieces >= 0),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.count_lines (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collection_bags (id) on delete cascade,
  -- Copied from the collection so packing can group without a join.
  company_id uuid not null references public.companies (id),
  product_id uuid not null references public.products (id),
  -- Snapshotted at count time so a later MRP change cannot rewrite history.
  mrp numeric(10, 2) not null check (mrp > 0),
  quantity integer not null check (quantity > 0),
  packed_quantity integer not null default 0,
  -- Order the SKUs were counted in; packing pours lines in this order.
  sort_order integer not null default 0,
  check (packed_quantity between 0 and quantity),
  unique (collection_id, product_id)
);

create index count_lines_pending_idx on public.count_lines (company_id, mrp) where packed_quantity < quantity;

create table public.dispatches (
  id uuid primary key default gen_random_uuid(),
  dispatch_number text not null unique,
  company_id uuid not null references public.companies (id),
  sent_date date not null,
  bag_count integer not null check (bag_count >= 0),
  piece_count integer not null check (piece_count >= 0),
  claimed_value numeric(14, 2) not null check (claimed_value >= 0),
  received_value numeric(14, 2) check (received_value >= 0),
  status public.dispatch_status not null default 'sent',
  settled_date date,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table public.sorted_bags (
  id uuid primary key default gen_random_uuid(),
  bag_number text not null unique,
  company_id uuid not null references public.companies (id),
  mrp numeric(10, 2) not null check (mrp > 0),
  piece_count integer not null check (piece_count between 1 and 700),
  is_full boolean not null,
  created_date date not null,
  status public.sorted_bag_status not null default 'ready',
  dispatch_id uuid references public.dispatches (id),
  created_at timestamptz not null default now(),
  check ((status = 'dispatched') = (dispatch_id is not null)),
  check (is_full = (piece_count = 700))
);

create index sorted_bags_dispatch_idx on public.sorted_bags (dispatch_id);

-- Exactly which pieces are in each sorted bag. Rows for a bag sum to its
-- piece_count. A count line cannot be deleted while a bag still holds it.
create table public.bag_contents (
  sorted_bag_id uuid not null references public.sorted_bags (id) on delete cascade,
  count_line_id uuid not null references public.count_lines (id) on delete restrict,
  collection_id uuid not null references public.collection_bags (id) on delete restrict,
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),
  primary key (sorted_bag_id, count_line_id)
);

create index bag_contents_line_idx on public.bag_contents (count_line_id);
create index bag_contents_collection_idx on public.bag_contents (collection_id);

-- ---------------------------------------------------------------------------
-- Own-inventory damage records
-- ---------------------------------------------------------------------------

create table public.damage_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  date date not null,
  source public.source_type not null,
  distributor_id uuid references public.distributors (id),
  product_id uuid not null references public.products (id),
  batch_number text not null default '',
  quantity integer not null check (quantity > 0),
  unit text not null default '',
  reason public.reason_category not null,
  cost_value numeric(14, 2) not null default 0 check (cost_value >= 0),
  status public.resolution_status not null default 'pending_review',
  responsible_party text not null default '',
  photo_path text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (source = 'own_inventory' or distributor_id is not null)
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.distributors enable row level security;
alter table public.products enable row level security;
alter table public.number_counters enable row level security;
alter table public.collection_bags enable row level security;
alter table public.count_lines enable row level security;
alter table public.dispatches enable row level security;
alter table public.sorted_bags enable row level security;
alter table public.bag_contents enable row level security;
alter table public.damage_records enable row level security;

-- Anyone with an active profile can read. number_counters has no policy, so
-- no client can read or change it at all.
create policy "members read" on public.profiles for select to authenticated using ((select public.current_app_role()) is not null);
create policy "members read" on public.companies for select to authenticated using ((select public.current_app_role()) is not null);
create policy "members read" on public.distributors for select to authenticated using ((select public.current_app_role()) is not null);
create policy "members read" on public.products for select to authenticated using ((select public.current_app_role()) is not null);
create policy "members read" on public.collection_bags for select to authenticated using ((select public.current_app_role()) is not null);
create policy "members read" on public.count_lines for select to authenticated using ((select public.current_app_role()) is not null);
create policy "members read" on public.dispatches for select to authenticated using ((select public.current_app_role()) is not null);
create policy "members read" on public.sorted_bags for select to authenticated using ((select public.current_app_role()) is not null);
create policy "members read" on public.bag_contents for select to authenticated using ((select public.current_app_role()) is not null);
create policy "members read" on public.damage_records for select to authenticated using ((select public.current_app_role()) is not null);

-- Admins manage people.
create policy "admins update" on public.profiles for update to authenticated
  using ((select public.current_app_role()) = 'admin') with check ((select public.current_app_role()) = 'admin');

-- Admins and managers manage master data. Data entry can add products,
-- because New entry lets them add a missing SKU on the spot.
create policy "managers write" on public.companies for all to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager')) with check ((select public.current_app_role()) in ('admin', 'manager'));
create policy "managers write" on public.distributors for all to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager')) with check ((select public.current_app_role()) in ('admin', 'manager'));
create policy "managers update" on public.products for update to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager')) with check ((select public.current_app_role()) in ('admin', 'manager'));
create policy "staff add" on public.products for insert to authenticated
  with check ((select public.current_app_role()) in ('admin', 'manager', 'data_entry'));

-- Damage records: staff log and edit; only managers delete.
create policy "staff add" on public.damage_records for insert to authenticated
  with check ((select public.current_app_role()) in ('admin', 'manager', 'data_entry'));
create policy "staff update" on public.damage_records for update to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager', 'data_entry'))
  with check ((select public.current_app_role()) in ('admin', 'manager', 'data_entry'));
create policy "managers delete" on public.damage_records for delete to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager'));

-- ---------------------------------------------------------------------------
-- Internal helpers (not callable by clients)
-- ---------------------------------------------------------------------------

-- Reserves `how_many` consecutive numbers. The upsert holds a row lock until
-- the transaction ends, so concurrent callers queue instead of colliding.
create function public.next_numbers(p_company_id uuid, p_kind text, p_year integer, p_how_many integer)
returns integer[]
language plpgsql security definer set search_path = '' as $$
declare
  v_last integer;
begin
  insert into public.number_counters as nc (company_id, kind, year, last_value)
  values (p_company_id, p_kind, p_year, p_how_many)
  on conflict (company_id, kind, year) do update set last_value = nc.last_value + p_how_many
  returning last_value into v_last;
  return array(select generate_series(v_last - p_how_many + 1, v_last));
end $$;

-- A collection's status is worked out from its lines, never set by hand.
create function public.refresh_collection_status(p_ids uuid[]) returns void
language sql security definer set search_path = '' as $$
  update public.collection_bags cb
     set status = case
       when not exists (select 1 from public.count_lines cl where cl.collection_id = cb.id) then 'uncounted'::public.collection_status
       when exists (select 1 from public.count_lines cl where cl.collection_id = cb.id and cl.packed_quantity < cl.quantity) then 'counted'::public.collection_status
       else 'packed'::public.collection_status
     end
   where cb.id = any (p_ids)
$$;

-- Anything that changes packed_quantity takes this lock first, so packing,
-- unpacking and re-counting can never interleave.
create function public.lock_packing() returns void
language sql as $$ select pg_advisory_xact_lock(hashtext('freshtrack.packing')) $$;

-- ---------------------------------------------------------------------------
-- 1. Collect
-- ---------------------------------------------------------------------------

create function public.create_collections(
  p_company_id uuid,
  p_distributor_id uuid,
  p_collected_date date,
  p_bag_count integer default 1,
  p_estimated_pieces integer default null,
  p_notes text default null
) returns setof public.collection_bags
language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
  v_seqs integer[];
begin
  perform public.require_role(array['admin', 'manager', 'data_entry']::public.user_role[]);
  if p_bag_count < 1 then
    raise exception 'Bag count must be at least 1';
  end if;
  select code into strict v_code from public.companies where id = p_company_id;
  v_seqs := public.next_numbers(p_company_id, 'COL', extract(year from p_collected_date)::integer, p_bag_count);

  return query
  insert into public.collection_bags (bag_number, company_id, distributor_id, collected_date, estimated_pieces, notes)
  select format('%s-COL-%s-%s', v_code, extract(year from p_collected_date)::integer, lpad(seq::text, 4, '0')),
         p_company_id, p_distributor_id, p_collected_date, p_estimated_pieces, p_notes
    from unnest(v_seqs) as seq
  returning *;
end $$;

-- Collection bags whose pieces are in a sorted bag are kept and reported.
create function public.delete_collections(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_blocked text[];
  v_deleted integer;
begin
  perform public.require_role(array['admin', 'manager']::public.user_role[]);
  perform public.lock_packing();

  select coalesce(array_agg(cb.bag_number order by cb.bag_number), '{}') into v_blocked
    from public.collection_bags cb
   where cb.id = any (p_ids)
     and exists (select 1 from public.bag_contents bc where bc.collection_id = cb.id);

  delete from public.collection_bags cb
   where cb.id = any (p_ids)
     and not exists (select 1 from public.bag_contents bc where bc.collection_id = cb.id);
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('deleted', v_deleted, 'blocked', to_jsonb(v_blocked));
end $$;

-- ---------------------------------------------------------------------------
-- 2. Count
-- ---------------------------------------------------------------------------

-- The same SKU twice becomes one line, empty lines are dropped, and
-- sort_order keeps the order the SKUs were first counted in.
create function public.parse_count_lines(p_lines jsonb)
returns table (product_id uuid, quantity integer, sort_order integer)
language sql immutable as $$
  select (l ->> 'product_id')::uuid, sum((l ->> 'quantity')::integer)::integer, min(ord)::integer
    from jsonb_array_elements(p_lines) with ordinality as t (l, ord)
   where (l ->> 'quantity')::integer > 0
   group by 1
$$;

-- p_lines: [{"product_id": "...", "quantity": 120}, ...]. MRP is read from
-- the product here, not trusted from the client.
create function public.save_count(p_collection_id uuid, p_lines jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_company_id uuid;
begin
  perform public.require_role(array['admin', 'manager', 'data_entry']::public.user_role[]);
  perform public.lock_packing();

  select company_id into v_company_id from public.collection_bags where id = p_collection_id for update;
  if v_company_id is null then
    raise exception 'That collection bag no longer exists';
  end if;
  if exists (select 1 from public.count_lines where collection_id = p_collection_id and packed_quantity > 0) then
    raise exception 'Some of these pieces are already in sorted bags. Delete those bags first to change the count.';
  end if;

  if not exists (select 1 from public.parse_count_lines(p_lines)) then
    raise exception 'Add at least one counted line';
  end if;
  if exists (
    select 1 from public.parse_count_lines(p_lines) i left join public.products p on p.id = i.product_id
     where p.id is null or p.company_id <> v_company_id
  ) then
    raise exception 'Only this company''s products can be counted into this bag';
  end if;

  delete from public.count_lines where collection_id = p_collection_id;
  insert into public.count_lines (collection_id, company_id, product_id, mrp, quantity, sort_order)
  select p_collection_id, v_company_id, i.product_id, p.mrp, i.quantity, i.sort_order
    from public.parse_count_lines(p_lines) i join public.products p on p.id = i.product_id;

  update public.collection_bags
     set status = 'counted', counted_date = public.business_today()
   where id = p_collection_id;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Pack  (same algorithm as planPacking in src/lib/bag-packing.ts)
-- ---------------------------------------------------------------------------
--
--   1. Take every count line with pending pieces (quantity - packed_quantity).
--   2. Group by company + MRP. Nothing crosses either boundary.
--   3. Inside a group, oldest first: collected date, collection bag number,
--      then the order the SKUs were counted in.
--   4. Bags needed: ceil(pieces / 700), or floor(...) for full bags only.
--   5. Reserve that many bag numbers in one go.
--   6. Pour lines into bags in order, 700 to a bag, splitting a line across
--      two bags where it does not fit, and record every pour in bag_contents.

create function public.pack_pending(p_company_id uuid default null, p_full_bags_only boolean default false)
returns table (bag_count integer, piece_count integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_cap constant integer := public.bag_capacity();
  v_today constant date := public.business_today();
  v_year constant integer := extract(year from public.business_today())::integer;
  g record;
  l record;
  v_code text;
  v_bags integer;
  v_to_pack integer;
  v_seqs integer[];
  v_next integer;
  v_bag_id uuid;
  v_target integer;
  v_filled integer;
  v_left integer;
  v_pour integer;
  v_total_bags integer := 0;
  v_total_pieces integer := 0;
  v_touched uuid[] := '{}';
begin
  perform public.require_role(array['admin', 'manager', 'data_entry']::public.user_role[]);
  perform public.lock_packing();

  for g in
    select cl.company_id, cl.mrp, sum(cl.quantity - cl.packed_quantity)::integer as pieces
      from public.count_lines cl
     where cl.packed_quantity < cl.quantity
       and (p_company_id is null or cl.company_id = p_company_id)
     group by cl.company_id, cl.mrp
     order by cl.company_id, cl.mrp
  loop
    v_bags := case when p_full_bags_only then g.pieces / v_cap else ceil(g.pieces::numeric / v_cap)::integer end;
    continue when v_bags = 0;

    v_to_pack := case when p_full_bags_only then v_bags * v_cap else g.pieces end;
    v_seqs := public.next_numbers(g.company_id, 'BAG', v_year, v_bags);
    select code into strict v_code from public.companies where id = g.company_id;
    v_next := 1;
    v_bag_id := null;

    for l in
      select cl.id, cl.collection_id, cl.product_id, cl.quantity - cl.packed_quantity as pending
        from public.count_lines cl
        join public.collection_bags cb on cb.id = cl.collection_id
       where cl.company_id = g.company_id
         and cl.mrp = g.mrp
         and cl.packed_quantity < cl.quantity
       order by cb.collected_date, cb.bag_number, cl.sort_order, cl.id
    loop
      exit when v_to_pack = 0;
      v_left := l.pending;

      while v_left > 0 and v_to_pack > 0 loop
        if v_bag_id is null then
          v_target := least(v_cap, v_to_pack);
          insert into public.sorted_bags (bag_number, company_id, mrp, piece_count, is_full, created_date)
          values (
            format('%s-M%s-%s-%s', v_code, trim_scale(g.mrp), v_year, lpad(v_seqs[v_next]::text, 4, '0')),
            g.company_id, g.mrp, v_target, v_target = v_cap, v_today
          )
          returning id into v_bag_id;
          v_next := v_next + 1;
          v_filled := 0;
          v_total_bags := v_total_bags + 1;
          v_total_pieces := v_total_pieces + v_target;
        end if;

        v_pour := least(v_left, v_target - v_filled);
        insert into public.bag_contents (sorted_bag_id, count_line_id, collection_id, product_id, quantity)
        values (v_bag_id, l.id, l.collection_id, l.product_id, v_pour);
        update public.count_lines set packed_quantity = packed_quantity + v_pour where id = l.id;

        v_left := v_left - v_pour;
        v_filled := v_filled + v_pour;
        v_to_pack := v_to_pack - v_pour;
        v_touched := v_touched || l.collection_id;
        if v_filled = v_target then
          v_bag_id := null;
        end if;
      end loop;
    end loop;
  end loop;

  perform public.refresh_collection_status(v_touched);
  return query select v_total_bags, v_total_pieces;
end $$;

-- Deletes READY bags only, and returns their pieces to the packing queue.
create function public.delete_sorted_bags(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_touched uuid[];
  v_deleted integer;
  v_returned integer;
  v_skipped integer;
begin
  perform public.require_role(array['admin', 'manager', 'data_entry']::public.user_role[]);
  perform public.lock_packing();

  select count(*) into v_skipped from public.sorted_bags where id = any (p_ids) and status = 'dispatched';

  select coalesce(sum(bc.quantity), 0), coalesce(array_agg(distinct bc.collection_id), '{}')
    into v_returned, v_touched
    from public.bag_contents bc
    join public.sorted_bags sb on sb.id = bc.sorted_bag_id
   where sb.id = any (p_ids) and sb.status = 'ready';

  update public.count_lines cl
     set packed_quantity = cl.packed_quantity - r.quantity
    from (
      select bc.count_line_id, sum(bc.quantity)::integer as quantity
        from public.bag_contents bc
        join public.sorted_bags sb on sb.id = bc.sorted_bag_id
       where sb.id = any (p_ids) and sb.status = 'ready'
       group by bc.count_line_id
    ) r
   where cl.id = r.count_line_id;

  delete from public.sorted_bags where id = any (p_ids) and status = 'ready';
  get diagnostics v_deleted = row_count;

  perform public.refresh_collection_status(v_touched);
  return jsonb_build_object('deleted', v_deleted, 'skipped_dispatched', v_skipped, 'pieces_returned', v_returned);
end $$;

-- ---------------------------------------------------------------------------
-- 4. Dispatch and settle
-- ---------------------------------------------------------------------------

create function public.create_dispatch(p_bag_ids uuid[]) returns public.dispatches
language plpgsql security definer set search_path = '' as $$
declare
  v_company_id uuid;
  v_companies integer;
  v_code text;
  v_today constant date := public.business_today();
  v_dispatch public.dispatches;
begin
  perform public.require_role(array['admin', 'manager', 'data_entry']::public.user_role[]);

  perform 1 from public.sorted_bags where id = any (p_bag_ids) and status = 'ready' order by id for update;
  select count(distinct company_id), min(company_id::text)::uuid into v_companies, v_company_id
    from public.sorted_bags where id = any (p_bag_ids) and status = 'ready';

  if v_companies = 0 then
    raise exception 'Select at least one bag that is ready to send';
  end if;
  if v_companies > 1 then
    raise exception 'A dispatch can only hold one company''s bags';
  end if;

  select code into strict v_code from public.companies where id = v_company_id;

  insert into public.dispatches (dispatch_number, company_id, sent_date, bag_count, piece_count, claimed_value)
  select format('%s-DSP-%s-%s', v_code, extract(year from v_today)::integer,
                lpad((public.next_numbers(v_company_id, 'DSP', extract(year from v_today)::integer, 1))[1]::text, 4, '0')),
         v_company_id, v_today, count(*), sum(piece_count), sum(piece_count * mrp)
    from public.sorted_bags where id = any (p_bag_ids) and status = 'ready'
  returning * into v_dispatch;

  update public.sorted_bags set status = 'dispatched', dispatch_id = v_dispatch.id
   where id = any (p_bag_ids) and status = 'ready';

  return v_dispatch;
end $$;

-- A short payment stays "partially settled". Only open dispatches settle.
create function public.record_settlement(p_dispatch_id uuid, p_received_value numeric) returns public.dispatches
language plpgsql security definer set search_path = '' as $$
declare
  v_dispatch public.dispatches;
begin
  perform public.require_role(array['admin', 'manager']::public.user_role[]);
  if p_received_value is null or p_received_value < 0 then
    raise exception 'Received value must be zero or more';
  end if;

  update public.dispatches
     set received_value = p_received_value,
         status = case when p_received_value < claimed_value then 'partially_settled'::public.dispatch_status
                       else 'settled'::public.dispatch_status end,
         settled_date = public.business_today()
   where id = p_dispatch_id and status in ('sent', 'under_review')
  returning * into v_dispatch;

  if v_dispatch.id is null then
    raise exception 'Only a sent or under-review dispatch can be settled';
  end if;
  return v_dispatch;
end $$;

create function public.mark_dispatch(p_dispatch_id uuid, p_status public.dispatch_status) returns public.dispatches
language plpgsql security definer set search_path = '' as $$
declare
  v_dispatch public.dispatches;
begin
  perform public.require_role(array['admin', 'manager']::public.user_role[]);

  if p_status = 'under_review' then
    update public.dispatches set status = 'under_review'
     where id = p_dispatch_id and status = 'sent'
    returning * into v_dispatch;
  elsif p_status = 'rejected' then
    update public.dispatches set status = 'rejected', received_value = 0, settled_date = public.business_today()
     where id = p_dispatch_id and status in ('sent', 'under_review')
    returning * into v_dispatch;
  else
    raise exception 'Use record_settlement to settle a dispatch';
  end if;

  if v_dispatch.id is null then
    raise exception 'That change is not allowed from the dispatch''s current status';
  end if;
  return v_dispatch;
end $$;

-- Open dispatches are CANCELLED (bags back to ready). Finished ones are
-- CLEARED together with their bags.
create function public.delete_dispatches(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_open uuid[];
  v_closed uuid[];
  v_returned integer;
  v_removed integer;
begin
  perform public.require_role(array['admin', 'manager']::public.user_role[]);
  perform public.lock_packing();

  select coalesce(array_agg(id) filter (where status in ('sent', 'under_review')), '{}'),
         coalesce(array_agg(id) filter (where status not in ('sent', 'under_review')), '{}')
    into v_open, v_closed
    from public.dispatches where id = any (p_ids);

  update public.sorted_bags set status = 'ready', dispatch_id = null where dispatch_id = any (v_open);
  get diagnostics v_returned = row_count;

  delete from public.sorted_bags where dispatch_id = any (v_closed);
  get diagnostics v_removed = row_count;

  delete from public.dispatches where id = any (v_open) or id = any (v_closed);

  return jsonb_build_object(
    'cancelled', cardinality(v_open), 'cleared', cardinality(v_closed),
    'bags_returned', v_returned, 'bags_removed', v_removed
  );
end $$;

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------

-- Postgres lets everyone execute new functions by default. Take that away,
-- then give signed-in users only the actions; the helpers stay internal.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.bag_capacity(),
  public.business_today(),
  public.current_app_role(),
  public.create_collections(uuid, uuid, date, integer, integer, text),
  public.delete_collections(uuid[]),
  public.save_count(uuid, jsonb),
  public.pack_pending(uuid, boolean),
  public.delete_sorted_bags(uuid[]),
  public.create_dispatch(uuid[]),
  public.record_settlement(uuid, numeric),
  public.mark_dispatch(uuid, public.dispatch_status),
  public.delete_dispatches(uuid[])
to authenticated;
