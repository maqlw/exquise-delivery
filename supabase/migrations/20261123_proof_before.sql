-- v038: foto bukti jadi 2 saat sampai: sebelum diserahkan (proof_before_path) dan sesudah diterima (proof_path, seperti sebelumnya).
alter table public.orders add column if not exists proof_before_path text;

drop function if exists public.courier_mark(uuid, text, text, text, text, text);
create function public.courier_mark(p_order uuid, p_status text, p_reason text default null, p_proof text default null,
  p_receiver_name text default null, p_receiver_relation text default null, p_proof_before text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_courier uuid := public.my_courier_id(); v_route uuid;
begin
  if p_status not in ('jalan', 'sampai', 'gagal') then raise exception 'Status tidak valid'; end if;
  if p_status = 'gagal' and coalesce(trim(p_reason), '') = '' then raise exception 'Alasan gagal wajib diisi'; end if;
  if p_status = 'sampai' and (coalesce(trim(p_receiver_name), '') = '' or p_receiver_relation is null) then
    raise exception 'Nama dan status penerima barang wajib diisi';
  end if;
  select rs.route_id into v_route from public.route_stops rs join public.routes r on r.id = rs.route_id
   where rs.order_id = p_order and r.courier_id = v_courier;
  if v_route is null then raise exception 'Pesanan bukan milik kurir ini'; end if;
  if p_status = 'jalan' then
    if not exists (select 1 from public.routes where id = v_route and started_at is not null) then raise exception 'Tekan Mulai jalan dulu'; end if;
    update public.orders set status = 'jalan', sent_at = now(), fail_reason = null where id = p_order and status = 'siap';
    if not found then raise exception 'Pesanan ini sudah dikirim atau selesai'; end if;
    return;
  end if;
  update public.orders
     set status = p_status,
         fail_reason = case when p_status = 'gagal' then trim(p_reason) end,
         proof_path = coalesce(p_proof, proof_path),
         proof_before_path = coalesce(p_proof_before, proof_before_path),
         receiver_name = case when p_status = 'sampai' then trim(p_receiver_name) end,
         receiver_relation = case when p_status = 'sampai' then p_receiver_relation end,
         delivered_at = case when p_status = 'sampai' then now() end
   where id = p_order and (status = 'jalan' or (p_status = 'gagal' and status = 'siap'));
  if not found then raise exception 'Pesanan tidak sedang dalam perjalanan'; end if;
  -- Semua alamat beres: rute belum selesai, kurir masih harus kembali ke outlet (atau minta izin pulang).
  if not exists (select 1 from public.route_stops rs join public.orders o on o.id = rs.order_id
                  where rs.route_id = v_route and o.status in ('siap', 'jalan')) then
    update public.routes set stops_done_at = now() where id = v_route;
  end if;
end $$;
revoke execute on function public.courier_mark(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.courier_mark(uuid, text, text, text, text, text, text) to authenticated;

-- Halaman lacak customer: ikut tampilkan foto sebelum diserahkan.
do $$
declare d text := pg_get_functiondef('public.track(text)'::regprocedure);
  a text := $a$'proof_path', case when o.status = 'sampai' then o.proof_path end,$a$;
begin
  if position(a in d) = 0 then raise exception 'track(): pola proof_path tidak ditemukan'; end if;
  execute replace(d, a, a || $b$ 'proof_before', case when o.status = 'sampai' then o.proof_before_path end,$b$);
end $$;

-- Arsip ke Google Drive (> 30 hari): kedua foto ikut dipindah; col = kolom asal fotonya.
drop function if exists public.proofs_to_archive(int, int);
create function public.proofs_to_archive(p_limit int default 25, p_days int default 30)
returns table(id uuid, code text, recipient text, proof_path text, delivered_at timestamptz, col text)
language sql stable security definer set search_path = '' as $$
  with used as (select coalesce(sum((metadata->>'size')::bigint), 0) b from storage.objects where bucket_id = 'proofs'),
  p as (select o.id, o.code, o.recipient, o.proof_path path, o.delivered_at, 'proof_path' col from public.orders o
        union all
        select o.id, o.code, o.recipient, o.proof_before_path, o.delivered_at, 'proof_before_path' from public.orders o)
  select p.id, p.code, p.recipient, p.path, p.delivered_at, p.col
  from p, used
  where p.path is not null and p.path not like 'drive:%'
    and (p.delivered_at < now() - make_interval(days => p_days) or used.b > 800 * 1024 * 1024)
  order by p.delivered_at nulls first, p.id, p.col
  limit p_limit
$$;
revoke execute on function public.proofs_to_archive(int, int) from public, anon, authenticated;
