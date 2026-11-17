-- v016: foto bukti > 30 hari (atau yang tertua bila bucket > 800 MB) dipindah ke Google Drive tiap 15 menit.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.proofs_to_archive(p_limit int default 25, p_days int default 30)
returns table(id uuid, code text, recipient text, proof_path text, delivered_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with used as (select coalesce(sum((metadata->>'size')::bigint), 0) b from storage.objects where bucket_id = 'proofs')
  select o.id, o.code, o.recipient, o.proof_path, o.delivered_at
  from public.orders o, used
  where o.proof_path is not null and o.proof_path not like 'drive:%'
    and (o.delivered_at < now() - make_interval(days => p_days) or used.b > 800 * 1024 * 1024)
  order by o.delivered_at nulls first, o.id
  limit p_limit
$$;
revoke execute on function public.proofs_to_archive(int, int) from public, anon, authenticated;

-- kunci acak untuk jadwal -> edge function (hanya bisa dibaca service role)
insert into public.app_secrets (key, value) values ('cron_key', encode(extensions.gen_random_bytes(24), 'hex')) on conflict (key) do nothing;

select cron.schedule('arsip-foto-drive', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://ddevslmrcduopydrcyun.supabase.co/functions/v1/proof-archive',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', (select value from public.app_secrets where key = 'cron_key')),
    timeout_milliseconds := 120000)
$$);
