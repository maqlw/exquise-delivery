-- v034: cadangan webhook Lalamove. Tiap 3 menit, kalau ada pesanan Lalamove yang masih aktif (mis. dipesan dari aplikasi lalu
-- dihubungkan lewat Order ID), fungsi lalamove mengecek statusnya: diambil -> Dalam perjalanan + WA, selesai -> Sampai + foto + WA.
select cron.unschedule('lalamove-poll') where exists (select 1 from cron.job where jobname = 'lalamove-poll');
select cron.schedule('lalamove-poll', '*/3 * * * *', $$
  select net.http_post(
    url := 'https://ddevslmrcduopydrcyun.supabase.co/functions/v1/lalamove',
    body := '{"action":"poll"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', (select value from public.app_secrets where key = 'cron_key')),
    timeout_milliseconds := 60000)
  where exists (select 1 from public.orders where llm_order_id is not null and status in ('draft', 'siap', 'jalan')
                  and coalesce(llm_status, '') not in ('CANCELED', 'REJECTED', 'EXPIRED') and ship_date >= current_date - 2)
$$);
