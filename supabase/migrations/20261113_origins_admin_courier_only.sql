-- Lokasi outlet (termasuk No HP outlet) hanya untuk admin & kurir, bukan semua akun yang login.
drop policy "baca lokasi asal" on public.origins;
create policy "admin & kurir baca lokasi asal" on public.origins for select to authenticated
  using ((select public.is_admin()) or (select public.my_courier_id()) is not null);
