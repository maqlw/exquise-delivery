-- v025: jasa kirim pihak ketiga bisa ditambah dari Pengaturan (settings.ext_couriers); kolom via tidak lagi dibatasi 5 nilai.
alter table public.orders drop constraint if exists orders_via_check;
alter table public.orders add constraint orders_via_check check (via ~ '^[a-z][a-z0-9_]{1,29}$');
