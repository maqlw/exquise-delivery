-- v029: batch/outlet/tanggal pesanan diubah (Data Pengiriman atau Dispatch) -> pesanan ikut pindah.
-- (1) Pilihan batch terbaru di Data Pengiriman menang atas pindahan lama di Dispatch (batch_forced).
-- (2) Pesanan yang belum dibawa kurir keluar dari rute lama, lalu muncul di batch barunya sebagai alamat tambahan.
create or replace function public.orders_follow_batch() returns trigger language plpgsql security definer set search_path = '' as $$
declare b int;
begin
  if new.batch_req is distinct from old.batch_req and new.batch_forced is not distinct from old.batch_forced then
    new.batch_forced := null;
  end if;
  b := coalesce(new.batch_forced, new.batch_req);
  if new.status in ('draft', 'siap') and exists (
      select 1 from public.route_stops s join public.routes r on r.id = s.route_id
       where s.order_id = new.id and (r.ship_date <> new.ship_date or r.origin_id <> new.origin_id or (b is not null and r.batch <> b))) then
    delete from public.route_stops where order_id = new.id;
    new.status := 'draft';
  end if;
  return new;
end $$;
drop trigger if exists orders_follow_batch on public.orders;
create trigger orders_follow_batch before update of batch_req, batch_forced, origin_id, ship_date on public.orders
  for each row execute function public.orders_follow_batch();

-- Pesanan yang sudah telanjur nyangkut di rute batch lama dibereskan sekali.
update public.orders o set batch_req = o.batch_req
 where o.status in ('draft', 'siap') and exists (
   select 1 from public.route_stops s join public.routes r on r.id = s.route_id
    where s.order_id = o.id and (r.ship_date <> o.ship_date or r.origin_id <> o.origin_id or r.batch <> coalesce(o.batch_forced, o.batch_req, r.batch)));
