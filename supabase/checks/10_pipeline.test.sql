-- Behaviour tests for the migration. Mirrors src/lib/operations.test.ts.
-- Run on a scratch database after 00_supabase_stand_in.sql and the migration.

\set ON_ERROR_STOP 1
\set QUIET 1
\pset footer off
-- ---------- fixtures (as superuser) ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'admin@x'),
  ('00000000-0000-0000-0000-000000000002', 'viewer@x');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000001';
insert into public.companies (id, name, code) values
  ('11111111-0000-0000-0000-000000000001', 'Cadbury', 'CAD'),
  ('11111111-0000-0000-0000-000000000002', 'Haldirams', 'HLD');
insert into public.distributors (id, name) values
  ('22222222-0000-0000-0000-000000000001', 'Ganga Traders'),
  ('22222222-0000-0000-0000-000000000002', 'Purvanchal');
insert into public.products (id, company_id, sku, name, mrp) values
  ('33333333-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000001', 'A10', 'A', 10),
  ('33333333-0000-0000-0000-000000000020', '11111111-0000-0000-0000-000000000001', 'A20', 'B', 20),
  ('33333333-0000-0000-0000-000000000099', '11111111-0000-0000-0000-000000000002', 'H10', 'C', 10);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false) \g /dev/null

create or replace view pg_temp.bag_view as
  select sb.bag_number, sb.piece_count, sb.is_full, sb.status,
         string_agg(d.name || ':' || bc.quantity, ', ' order by cb.collected_date, bc.quantity desc) as contents
    from public.sorted_bags sb
    join public.bag_contents bc on bc.sorted_bag_id = sb.id
    join public.collection_bags cb on cb.id = bc.collection_id
    join public.distributors d on d.id = cb.distributor_id
   group by sb.id order by sb.bag_number;

\echo '== T1: README example, 900 (Ganga, older) + 750 (Purvanchal) at MRP 10 =='
select id as a from public.create_collections('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', '2026-03-01') \gset
select id as b from public.create_collections('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', '2026-03-05') \gset
select public.save_count(:'a', '[{"product_id":"33333333-0000-0000-0000-000000000010","quantity":900}]') \g /dev/null
select public.save_count(:'b', '[{"product_id":"33333333-0000-0000-0000-000000000010","quantity":750}]') \g /dev/null
select * from public.pack_pending();
select * from pg_temp.bag_view;
do $$ begin
  assert (select string_agg(contents, ' | ' order by bag_number) from pg_temp.bag_view)
       = 'Ganga Traders:700 | Ganga Traders:200, Purvanchal:500 | Purvanchal:250', 'T1 contents wrong';
  assert (select array_agg(status::text order by bag_number) from public.collection_bags) = '{packed,packed}', 'T1 status';
end $$;

\echo '== T2: count is locked once packed; collection with pieces in bags cannot be deleted =='
do $$ begin
  begin
    perform public.save_count((select id from public.collection_bags limit 1), '[{"product_id":"33333333-0000-0000-0000-000000000010","quantity":5}]');
    raise exception 'T2 recount should have failed';
  exception when raise_exception then
    if sqlerrm not like 'Some of these pieces%' then raise; end if;
  end;
end $$;
select public.delete_collections(array(select id from public.collection_bags)) as delete_collections;

\echo '== T3: delete a READY bag -> pieces return, number is never reused =='
select public.delete_sorted_bags(array(select id from public.sorted_bags where bag_number like '%-0003')) as delete_bags;
select * from public.pack_pending();
select bag_number, piece_count from public.sorted_bags order by bag_number;
do $$ begin
  assert not exists (select 1 from public.sorted_bags where bag_number like '%-0003'), 'T3 number 0003 reused';
  assert exists (select 1 from public.sorted_bags where bag_number = 'CAD-M10-2026-0004' and piece_count = 250), 'T3 repack';
end $$;

\echo '== T4: dispatch rules: one company only; cancel vs clear =='
select id as h from public.create_collections('11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', '2026-03-02') \gset
select public.save_count(:'h', '[{"product_id":"33333333-0000-0000-0000-000000000099","quantity":100}]') \g /dev/null
select * from public.pack_pending('11111111-0000-0000-0000-000000000002');
do $$ begin
  begin
    perform public.create_dispatch(array(select id from public.sorted_bags));
    raise exception 'T4 mixed dispatch should fail';
  exception when raise_exception then
    if sqlerrm not like 'A dispatch can only hold%' then raise; end if;
  end;
end $$;
select dispatch_number, bag_count, piece_count, claimed_value from public.create_dispatch(array(select id from public.sorted_bags where bag_number in ('CAD-M10-2026-0001','CAD-M10-2026-0002')));
select id as d1 from public.dispatches where dispatch_number = 'CAD-DSP-2026-0001' \gset
select dispatch_number, id as d2 from public.create_dispatch(array(select id from public.sorted_bags where bag_number = 'CAD-M10-2026-0004')) \gset
select status, received_value from public.record_settlement(:'d2', 2000);
do $$ begin
  begin
    perform public.delete_sorted_bags(array(select id from public.sorted_bags where status = 'dispatched'));
  end;
  assert (select count(*) from public.sorted_bags where status = 'dispatched') = 3, 'T4 dispatched bag got deleted';
end $$;
select public.delete_dispatches(array[:'d1', :'d2']::uuid[]) as delete_dispatches;
select bag_number, status from public.sorted_bags order by bag_number;
do $$ begin
  assert (select count(*) from public.dispatches) = 0, 'T4 dispatches remain';
  assert (select array_agg(bag_number order by bag_number) from public.sorted_bags where status = 'ready')
       = '{CAD-M10-2026-0001,CAD-M10-2026-0002,HLD-M10-2026-0001}', 'T4 cancel should return bags';
end $$;

\echo '== T5: full bags only keeps the remainder, then tops it up oldest-first =='
reset role;
truncate public.bag_contents, public.sorted_bags, public.dispatches, public.count_lines, public.collection_bags cascade;
set role authenticated;
select id as a from public.create_collections('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', '2026-04-01') \gset
select id as b from public.create_collections('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', '2026-04-05') \gset
select public.save_count(:'a', '[{"product_id":"33333333-0000-0000-0000-000000000010","quantity":900}]') \g /dev/null
select public.save_count(:'b', '[{"product_id":"33333333-0000-0000-0000-000000000010","quantity":750}]') \g /dev/null
select * from public.pack_pending(null, true);
select id as c from public.create_collections('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', '2026-04-20') \gset
select public.save_count(:'c', '[{"product_id":"33333333-0000-0000-0000-000000000010","quantity":450}]') \g /dev/null
select * from public.pack_pending(null, true);
select * from pg_temp.bag_view;
do $$ begin
  assert (select contents from pg_temp.bag_view order by bag_number desc limit 1) = 'Purvanchal:250, Ganga Traders:450', 'T5 top-up';
end $$;

\echo '== T6: permissions =='
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false) \g /dev/null
do $$ begin
  begin
    perform public.pack_pending();
    raise exception 'T6 viewer was allowed to pack';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.sorted_bags (bag_number, company_id, mrp, piece_count, is_full, created_date)
    values ('FAKE', '11111111-0000-0000-0000-000000000001', 10, 700, true, current_date);
    raise exception 'T6 direct insert into sorted_bags was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false) \g /dev/null
update public.count_lines set packed_quantity = 0;
do $$ begin
  assert (select sum(packed_quantity) from public.count_lines) = 2100, 'T6 client changed packed_quantity directly';
end $$;
reset role;
set role anon;
do $$ begin
  assert (select count(*) from public.sorted_bags) = 0, 'T6 anonymous users can read data';
end $$;
reset role;
\echo 'ALL SQL TESTS PASSED'
