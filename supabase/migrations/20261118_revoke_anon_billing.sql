-- v023: fungsi tagihan tidak bisa dipanggil tanpa login (pengecekan peran di dalamnya tetap ada).
revoke execute on function public.create_topup_invoice(integer, text) from anon, public;
revoke execute on function public.mark_invoice_paid(uuid, text, text, timestamptz) from anon, public;
revoke execute on function public.submit_invoice_proof(uuid, text) from anon, public;
grant execute on function public.create_topup_invoice(integer, text), public.mark_invoice_paid(uuid, text, text, timestamptz), public.submit_invoice_proof(uuid, text) to authenticated;
