-- v026: (1) pesanan yang dipindah dari kurir internal ke jasa lain otomatis keluar dari rute kurir;
--       (2) admin bisa memindahkan pesanan yang rutenya sudah dikirim ke kurir lain (kurir berhalangan di jalan).
create or replace function public.orders_leave_route() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.via = 'internal' and new.via <> 'internal' then
    delete from public.route_stops where order_id = new.id;
    if new.status = 'siap' then new.status := 'draft'; end if; -- belum dibawa kurir: kembali menunggu dikirim lewat jasa baru
    new.assigned_courier := null;
  end if;
  return new;
end $$;
drop trigger if exists orders_leave_route on public.orders;
create trigger orders_leave_route before update of via on public.orders for each row execute function public.orders_leave_route();

create or replace function public.reassign_orders(p_orders uuid[], p_courier uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare o record; tgt uuid; nxt int; n int := 0; c public.couriers;
begin
  if not public.is_admin() then raise exception 'Hanya admin'; end if;
  select * into c from public.couriers where id = p_courier and active;
  if not found then raise exception 'Kurir tujuan tidak ditemukan atau nonaktif'; end if;
  for o in select ord.id, ord.status, r.id route_id, r.ship_date, r.batch, r.origin_id, r.courier_id
             from public.route_stops rs join public.routes r on r.id = rs.route_id join public.orders ord on ord.id = rs.order_id
            where rs.order_id = any(p_orders) loop
    continue when o.courier_id = p_courier or o.status in ('sampai', 'gagal');
    tgt := null;
    select id into tgt from public.routes where ship_date = o.ship_date and batch = o.batch and courier_id = p_courier;
    if tgt is null then
      insert into public.routes (ship_date, origin_id, batch, courier_id, km) values (o.ship_date, o.origin_id, o.batch, p_courier, 0) returning id into tgt;
    else -- rute kurir tujuan dibuka lagi kalau sudah selesai
      update public.routes set finished_at = null, stops_done_at = null, return_status = null, returned_at = null where id = tgt;
    end if;
    select coalesce(max(seq), 0) + 1 into nxt from public.route_stops where route_id = tgt;
    update public.route_stops set route_id = tgt, seq = nxt where order_id = o.id;
    update public.orders set assigned_courier = p_courier where id = o.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.reassign_orders(uuid[], uuid) from public, anon;
grant execute on function public.reassign_orders(uuid[], uuid) to authenticated;

-- Pembersihan Ms. Vivian (GD202611180036) dilakukan dengan set via ke internal lalu kembali ke lalamove, sehingga trigger di atas yang mencabutnya.
