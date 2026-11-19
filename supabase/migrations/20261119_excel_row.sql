-- v031: urutan baris di Excel, dipakai sebagai urutan antar kurir saat Pembagian otomatis OFF.
alter table public.orders add column if not exists row_no int;
