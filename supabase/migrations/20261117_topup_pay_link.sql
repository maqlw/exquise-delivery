-- v017: invoice top up otomatis membawa link DOKU dari paket yang dipilih (billing.topup.packages[i].pay_link).
create or replace function public.create_topup_invoice(p_index integer, p_note text default null)
returns public.invoices language plpgsql security definer set search_path = '' as $function$
declare pk jsonb; inv public.invoices;
begin
  if not public.is_admin() then raise exception 'Hanya admin'; end if;
  pk := (select value->'packages'->p_index from public.billing where key = 'topup');
  if pk is null or coalesce((pk->>'price')::int, 0) <= 0 then raise exception 'Paket tidak ditemukan'; end if;
  insert into public.invoices (number, kind, items, subtotal, total, note, pay_link)
  values (public.next_invoice_number(), 'topup', jsonb_build_array(jsonb_build_object('name', 'Top up WhatsApp - ' || (pk->>'name'), 'desc', pk->>'desc', 'normal', null, 'price', (pk->>'price')::int)),
          (pk->>'price')::int, (pk->>'price')::int, nullif(trim(p_note), ''), nullif(trim(pk->>'pay_link'), ''))
  returning * into inv;
  return inv;
end $function$;
