-- v020: Lalamove 1 driver banyak alamat. Tiap pesanan simpan stop-nya; order gabungan berbagi llm_order_id.
alter table public.orders add column if not exists llm_stop_id text;
create index if not exists orders_llm_order_id_idx on public.orders (llm_order_id) where llm_order_id is not null;
-- Link tracking Lalamove order gabungan bisa menampilkan alamat penerima lain -> tidak dibuka di halaman lacak publik.
do $$ begin
  execute replace(pg_get_functiondef('public.track'::regproc), '''ext_link'', o.ext_link,', '''ext_link'', case when o.llm_stop_id is null then o.ext_link end,');
end $$;
