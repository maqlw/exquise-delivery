-- v019: halaman /cek tanpa login. Pemesan isi No HP lengkap + nama -> kiriman 30 hari terakhir.
-- Salah 5x untuk No HP yang sama -> dikunci 15 menit (cegah tebak-tebakan nama).
create table if not exists public.lookup_attempts (phone text primary key, fails int not null default 0, locked_until timestamptz, updated_at timestamptz not null default now());
alter table public.lookup_attempts enable row level security; -- tanpa policy: hanya fungsi di bawah yang menyentuh

create or replace function public.track_lookup(p_phone text, p_name text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  ph text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  words text[]; a public.lookup_attempts; res jsonb;
begin
  ph := case when ph like '0%' then '62' || substr(ph, 2) when ph like '8%' then '62' || ph else ph end;
  -- kata nama tanpa sapaan; cocok bila salah satu kata sama persis dengan kata di nama pemesan
  select array_agg(w) into words from unnest(regexp_split_to_array(lower(regexp_replace(coalesce(p_name, ''), '[^A-Za-z0-9 ]', ' ', 'g')), '\s+')) w
   where length(w) >= 2 and w not in ('bapak', 'bpk', 'pak', 'ibu', 'bu', 'kak', 'mr', 'mrs', 'ms', 'sdr', 'sdri', 'tn', 'ny', 'nn', 'dr', 'drg', 'mas', 'mbak');
  if length(ph) < 10 or words is null then return jsonb_build_object('error', 'Isi No HP lengkap dan nama pemesan.'); end if;
  select * into a from public.lookup_attempts where phone = ph;
  if a.locked_until > now() then return jsonb_build_object('error', 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.'); end if;

  select jsonb_agg(jsonb_build_object(
      'token', o.token, 'ship_date', o.ship_date, 'sender', o.sender, 'recipient', o.recipient, 'recipient_phone', public.mask_phone(o.recipient_phone),
      'address', o.address, 'item', o.item, 'status', o.status, 'via', o.via, 'receiver_name', case when o.status = 'sampai' then o.receiver_name end,
      'delivered_at', o.delivered_at, 'sent_at', o.sent_at, 'fail_reason', o.fail_reason) order by o.ship_date desc, o.recipient)
    into res
    from public.orders o
   where o.sender_phone = ph and o.via <> 'pickup'
     and o.ship_date >= (now() at time zone 'Asia/Jakarta')::date - 30
     and regexp_split_to_array(lower(regexp_replace(coalesce(o.sender, ''), '[^A-Za-z0-9 ]', ' ', 'g')), '\s+') && words;

  if res is null then
    insert into public.lookup_attempts (phone, fails, updated_at) values (ph, 1, now())
      on conflict (phone) do update set fails = case when lookup_attempts.updated_at < now() - interval '15 minutes' then 1 else lookup_attempts.fails + 1 end, updated_at = now()
      returning * into a;
    if a.fails >= 5 then update public.lookup_attempts set locked_until = now() + interval '15 minutes', fails = 0 where phone = ph; end if;
    return jsonb_build_object('error', 'Data tidak ditemukan. Pastikan No HP dan nama sama seperti saat memesan (kiriman 30 hari terakhir).');
  end if;
  delete from public.lookup_attempts where phone = ph;
  return jsonb_build_object('orders', res);
end $$;
revoke execute on function public.track_lookup(text, text) from public;
grant execute on function public.track_lookup(text, text) to anon, authenticated;
