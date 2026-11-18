-- v023: akun staf dengan 3 level. pemilik = semua; admin = semua kecuali token WhatsApp Gateway; cs = lihat & lacak saja.
alter table public.admins
  add column if not exists role text not null default 'admin' check (role in ('pemilik', 'admin', 'cs')),
  add column if not exists name text,
  add column if not exists active boolean not null default true,
  add column if not exists must_change_pw boolean not null default false;
update public.admins set role = 'pemilik' where user_id = (select id from auth.users where lower(email) = 'fahmi@exquiseindonesia.com');

-- is_admin() = boleh mengubah data (pemilik + admin aktif); semua policy lama tetap memakai ini.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and active and role in ('pemilik', 'admin')) $$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and active) $$;
create or replace function public.is_owner() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and active and role = 'pemilik') $$;
create or replace function public.my_staff() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('role', role, 'name', name, 'active', active, 'must_change_pw', must_change_pw) from public.admins where user_id = auth.uid() $$;
create or replace function public.clear_must_change_pw() returns void language sql volatile security definer set search_path = '' as $$
  update public.admins set must_change_pw = false where user_id = auth.uid() $$;
revoke execute on function public.is_staff(), public.is_owner(), public.my_staff(), public.clear_must_change_pw() from public, anon;
grant execute on function public.is_staff(), public.is_owner(), public.my_staff(), public.clear_must_change_pw() to authenticated;

-- CS: hanya baca data yang dipakai Dashboard & Lacak.
do $$ declare t text; begin
  foreach t in array array['orders', 'routes', 'route_stops', 'courier_positions', 'origins', 'couriers', 'order_groups', 'order_address_history', 'settings', 'uploads'] loop
    execute format('drop policy if exists "staf boleh baca" on public.%I', t);
    execute format('create policy "staf boleh baca" on public.%I for select to authenticated using ((select public.is_staff()))', t);
  end loop;
end $$;
