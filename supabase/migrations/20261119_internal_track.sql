-- v036: link pantau internal tanpa login (/pantau/<token>). Token acak 128-bit di app_secrets, dibuat/diganti/dimatikan
-- oleh pemilik/admin. Isi hanya-lihat untuk 1 tanggal; No HP pelanggan disamarkan; data kurir tanpa No HP & akun.
create or replace function public.internal_link(p_action text default 'get') returns text
language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  if not public.is_admin() then raise exception 'Hanya pemilik atau admin'; end if;
  if p_action = 'new' then
    insert into public.app_secrets (key, value, updated_at, updated_by) values ('internal_track', encode(extensions.gen_random_bytes(16), 'hex'), now(), auth.uid())
      on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  elsif p_action = 'off' then
    delete from public.app_secrets where key = 'internal_track';
  end if;
  select value into t from public.app_secrets where key = 'internal_track';
  return t;
end $$;
revoke execute on function public.internal_link(text) from public, anon;
grant execute on function public.internal_link(text) to authenticated;

create or replace function public.internal_day(p_token text, p_date date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t text; today date := (now() at time zone 'Asia/Jakarta')::date; d date;
begin
  select value into t from public.app_secrets where key = 'internal_track';
  if t is null or p_token is null or p_token <> t then raise exception 'Link tidak berlaku'; end if;
  d := coalesce(p_date, today);
  return jsonb_build_object(
    'date', d,
    'dates', (select coalesce(jsonb_agg(x order by x desc), '[]') from (select distinct ship_date x from public.orders where ship_date between today - 30 and today + 30) s),
    'orders', (select coalesce(jsonb_agg(to_jsonb(o) - 'sender_phone' - 'recipient_phone'
                 || jsonb_build_object('sender_phone', public.mask_phone(o.sender_phone), 'recipient_phone', public.mask_phone(o.recipient_phone)) order by o.created_at desc), '[]')
               from public.orders o where o.ship_date = d),
    'routes', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'origin_id', r.origin_id, 'batch', r.batch, 'courier_id', r.courier_id, 'started_at', r.started_at,
                 'finished_at', r.finished_at, 'stops_done_at', r.stops_done_at, 'return_status', r.return_status,
                 'route_stops', (select coalesce(jsonb_agg(jsonb_build_object('order_id', s.order_id, 'seq', s.seq, 'eta_min', s.eta_min)), '[]') from public.route_stops s where s.route_id = r.id))), '[]')
               from public.routes r where r.ship_date = d),
    'couriers', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'origin_id', c.origin_id, 'active', c.active, 'color', c.color)), '[]') from public.couriers c),
    'origins', (select coalesce(jsonb_agg(to_jsonb(g)), '[]') from public.origins g),
    'positions', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.courier_positions p where p.courier_id in (select courier_id from public.routes where ship_date = d)),
    'settings', (select coalesce(jsonb_object_agg(key, value), '{}') from public.settings where key in ('tuning', 'auto_dispatch', 'ext_couriers'))
  );
end $$;
revoke execute on function public.internal_day(text, date) from public;
grant execute on function public.internal_day(text, date) to anon, authenticated;
