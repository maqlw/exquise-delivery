-- v018: link lacak pendek /l/<8 karakter>. Token lama (16 karakter) tetap berlaku.
-- Alfabet tanpa huruf mirip (0 O 1 l I) supaya tidak salah baca/ketik. 55^8 ≈ 8×10^13 kombinasi.
create or replace function public.short_token(n int default 8) returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ', (get_byte(b, i) % 55) + 1, 1), '' order by i)
  from extensions.gen_random_bytes(n) b, generate_series(0, n - 1) i
$$;
-- shortcut: bentrok token (sangat kecil peluangnya) ditolak unique index -> insert gagal sekali; tambahkan retry bila volume > jutaan pesanan.
alter table public.orders alter column token set default public.short_token(8);
alter table public.order_groups alter column token set default public.short_token(8);

-- batas minimal panjang token di fungsi publik: 12 -> 8
do $$ begin
  execute replace(pg_get_functiondef('public.track'::regproc), 'length(p_token) < 12', 'length(p_token) < 8');
  execute replace(pg_get_functiondef('public.track_group'::regproc), 'length(p_token) >= 12', 'length(p_token) >= 8');
end $$;
