-- v015: tagihan langganan, panel penyedia, invoice, kunci layanan nonaktif
-- ===== Penyedia jasa (Kreasi Digital Nusantara): peran terpisah dari admin Exquise =====
create table public.providers (email text primary key, created_at timestamptz not null default now());
alter table public.providers enable row level security; -- tanpa policy: hanya lewat fungsi
insert into public.providers (email) values ('kaisar2310@gmail.com');

create or replace function public.is_provider() returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.providers p where p.email = lower(auth.jwt()->>'email')) and coalesce((auth.jwt()->>'email_verified')::boolean, (select u.email_confirmed_at is not null from auth.users u where u.id = auth.uid()), false)
$$;
-- Boleh daftar akun penyedia hanya untuk email yang terdaftar (dipakai halaman /penyedia).
create or replace function public.provider_allowed(p_email text) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.providers where email = lower(trim(p_email)))
$$;
revoke execute on function public.is_provider(), public.provider_allowed(text) from public;
grant execute on function public.is_provider() to authenticated;
grant execute on function public.provider_allowed(text) to anon, authenticated;

-- ===== Pengaturan tagihan (hanya penyedia yang mengubah; admin Exquise boleh membaca) =====
create table public.billing (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
alter table public.billing enable row level security;
create policy "penyedia kelola tagihan" on public.billing for all to authenticated using ((select public.is_provider())) with check ((select public.is_provider()));
create policy "admin baca tagihan" on public.billing for select to authenticated using ((select public.is_admin()));
insert into public.billing (key, value) values
 ('plan', '{"company":"Kreasi Digital Nusantara","customer":"PT EXQUISE BOGA MULIA","name":"Paket 1 Bulan","desc":"Layanan aktif untuk periode 1 bulan.","normal":null,"price":850000,"prefix":"KDN","pay_link":"","note":""}'),
 ('cycle', '{"active_until":"2026-11-20","grace_workdays":7}'),
 ('topup', jsonb_build_object('packages', '[]'::jsonb, 'payment', '', 'notify_phone', '6287790006465')),
 ('send', '{"wa":false,"email":false,"wa_to":"6287790006465","email_to":"kaisar2310@gmail.com"}');
delete from public.settings where key = 'topup';
drop table public.topup_requests;

-- ===== Invoice (langganan & top up WhatsApp) =====
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  kind text not null default 'langganan' check (kind in ('langganan','topup')),
  token text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  issued_on date not null default current_date,
  active_until date,
  items jsonb not null default '[]'::jsonb, -- [{name, desc, normal, price}]
  subtotal integer not null check (subtotal >= 0),
  credit integer not null default 0 check (credit >= 0),
  total integer not null check (total >= 0),
  status text not null default 'unpaid' check (status in ('unpaid','review','paid','void')),
  pay_link text,
  proof_path text,
  paid_at timestamptz, paid_method text, paid_ref text,
  note text,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index invoices_created_by_idx on public.invoices (created_by);
alter table public.invoices enable row level security;
create policy "penyedia kelola invoice" on public.invoices for all to authenticated using ((select public.is_provider())) with check ((select public.is_provider()));
create policy "admin lihat invoice" on public.invoices for select to authenticated using ((select public.is_admin()));
insert into public.invoices (number, kind, issued_on, active_until, items, subtotal, total, status)
values ('KDN-20261114-01', 'langganan', '2026-10-15', '2026-11-20', '[{"name":"Subscription Matrix Delivery - 1 Bulan","desc":"Layanan aktif untuk periode 1 bulan.","normal":null,"price":850000}]', 850000, 850000, 'unpaid');

-- Nomor invoice: PREFIX-YYYYMMDD-NN
create or replace function public.next_invoice_number() returns text language sql volatile security definer set search_path to '' as $$
  select coalesce((select value->>'prefix' from public.billing where key = 'plan'), 'INV') || '-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-' ||
    lpad((count(*) + 1)::text, 2, '0') from public.invoices where number like '%-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-%'
$$;

-- ===== Status langganan: Aktif -> Masa tenggang (N hari kerja) -> Nonaktif =====
create or replace function public.service_status() returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare c jsonb := (select value from public.billing where key = 'cycle'); a date := (c->>'active_until')::date; g date := a; n int := coalesce((c->>'grace_workdays')::int, 7); today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if a is null then return jsonb_build_object('status', 'aktif'); end if;
  while n > 0 loop g := g + 1; if extract(isodow from g) < 6 then n := n - 1; end if; end loop;
  return jsonb_build_object('active_until', a, 'grace_until', g, 'days_left', a - today,
    'status', case when today <= a then 'aktif' when today <= g then 'tenggang' else 'nonaktif' end);
end $$;
revoke execute on function public.service_status(), public.next_invoice_number() from public, anon;
grant execute on function public.service_status() to authenticated;
grant execute on function public.next_invoice_number() to authenticated;

-- Nonaktif: tidak bisa tambah pesanan / kirim rute baru (lihat & lacak tetap jalan).
create policy "langganan aktif untuk pesanan baru" on public.orders as restrictive for insert to authenticated with check (((select public.service_status())->>'status') <> 'nonaktif');
create policy "langganan aktif untuk rute baru" on public.routes as restrictive for insert to authenticated with check (((select public.service_status())->>'status') <> 'nonaktif');

-- Admin Exquise mengajukan top up: harga diambil dari paket yang diatur penyedia (admin tidak bisa mengubah harga).
create or replace function public.create_topup_invoice(p_index int, p_note text default null) returns public.invoices language plpgsql security definer set search_path to '' as $$
declare pk jsonb; inv public.invoices;
begin
  if not public.is_admin() then raise exception 'Hanya admin'; end if;
  pk := (select value->'packages'->p_index from public.billing where key = 'topup');
  if pk is null or coalesce((pk->>'price')::int, 0) <= 0 then raise exception 'Paket tidak ditemukan'; end if;
  insert into public.invoices (number, kind, items, subtotal, total, note)
  values (public.next_invoice_number(), 'topup', jsonb_build_array(jsonb_build_object('name', 'Top up WhatsApp - ' || (pk->>'name'), 'desc', pk->>'desc', 'normal', null, 'price', (pk->>'price')::int)),
          (pk->>'price')::int, (pk->>'price')::int, nullif(trim(p_note), ''))
  returning * into inv;
  return inv;
end $$;
-- Admin mengunggah bukti transfer -> status "review" (penyedia yang menandai lunas).
create or replace function public.submit_invoice_proof(p_invoice uuid, p_path text) returns public.invoices language plpgsql security definer set search_path to '' as $$
declare inv public.invoices;
begin
  if not public.is_admin() then raise exception 'Hanya admin'; end if;
  update public.invoices set proof_path = p_path, status = 'review' where id = p_invoice and status in ('unpaid','review') returning * into inv;
  if not found then raise exception 'Invoice tidak bisa diubah'; end if;
  return inv;
end $$;
-- Penyedia menandai lunas; invoice langganan memajukan batas aktif ke tanggal 20 bulan berikutnya.
create or replace function public.mark_invoice_paid(p_invoice uuid, p_method text, p_ref text default null, p_paid_at timestamptz default now()) returns public.invoices language plpgsql security definer set search_path to '' as $$
declare inv public.invoices; a date;
begin
  if not public.is_provider() then raise exception 'Hanya penyedia'; end if;
  update public.invoices set status = 'paid', paid_at = coalesce(p_paid_at, now()), paid_method = nullif(trim(p_method), ''), paid_ref = nullif(trim(p_ref), '')
   where id = p_invoice and status <> 'paid' returning * into inv;
  if not found then raise exception 'Invoice sudah lunas atau tidak ada'; end if;
  if inv.kind = 'langganan' then
    a := greatest(coalesce(inv.active_until, (select (value->>'active_until')::date from public.billing where key = 'cycle')), (select (value->>'active_until')::date from public.billing where key = 'cycle'));
    update public.billing set value = jsonb_set(value, '{active_until}', to_jsonb(make_date(extract(year from a + interval '1 month')::int, extract(month from a + interval '1 month')::int, 20)::text)), updated_at = now() where key = 'cycle';
  end if;
  return inv;
end $$;
-- Halaman invoice publik (link khusus, tanpa login).
create or replace function public.invoice_public(p_token text) returns jsonb language sql stable security definer set search_path to '' as $$
  select case when i.id is null then null else to_jsonb(i) - 'id' - 'created_by' - 'token' || jsonb_build_object(
    'company', (select value->>'company' from public.billing where key = 'plan'), 'customer', (select value->>'customer' from public.billing where key = 'plan'),
    'payment', (select value->>'payment' from public.billing where key = 'topup')) end
  from (select 1) x left join public.invoices i on i.token = p_token and length(p_token) >= 12
$$;
revoke execute on function public.create_topup_invoice(int, text), public.submit_invoice_proof(uuid, text), public.mark_invoice_paid(uuid, text, text, timestamptz), public.invoice_public(text) from public;
grant execute on function public.create_topup_invoice(int, text), public.submit_invoice_proof(uuid, text), public.mark_invoice_paid(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.invoice_public(text) to anon, authenticated;
-- Penyedia boleh unggah file (mis. logo/bukti) ke bucket proofs seperti admin.
create policy "penyedia upload bukti" on storage.objects for insert to authenticated with check (bucket_id = 'proofs' and (select public.is_provider()));
