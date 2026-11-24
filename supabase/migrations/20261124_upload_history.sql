-- v042: riwayat upload 7 hari: siapa yang upload, sheet yang terbaca, dan isi file aslinya (bisa dibuka ulang).
alter table public.uploads
  add column if not exists uploader text,
  add column if not exists matrix boolean,
  add column if not exists drivers int,
  add column if not exists sheets text[],
  add column if not exists file_b64 text;
alter table public.uploads add column if not exists has_file boolean generated always as (file_b64 is not null) stored;

-- Nama pengunggah diisi server dari akun yang login (tidak bisa diisi/dipalsukan dari aplikasi).
create or replace function public.uploads_who() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.created_by := auth.uid();
  select coalesce(nullif(trim(a.name), ''), u.email) into new.uploader
    from public.admins a join auth.users u on u.id = a.user_id where a.user_id = auth.uid();
  return new;
end $$;
drop trigger if exists uploads_who on public.uploads;
create trigger uploads_who before insert on public.uploads for each row execute function public.uploads_who();

-- Simpan 7 hari saja (berisi data pelanggan). Tiap hari 02.17 WIB. Pesanan tetap ada, hanya kaitannya ke upload dilepas.
select cron.unschedule('hapus-riwayat-upload') where exists (select 1 from cron.job where jobname = 'hapus-riwayat-upload');
select cron.schedule('hapus-riwayat-upload', '17 19 * * *', $$delete from public.uploads where created_at < now() - interval '7 days'$$);
