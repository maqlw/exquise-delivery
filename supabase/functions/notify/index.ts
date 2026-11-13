import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SITE = "https://delivery.exquisepatisserie.space";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
// Dipakai kalau template di Pengaturan kosong.
const DEFAULT: Record<string, string> = {
  kirim_pemesan: "Hai {pemesan},\nOrderanmu sedang dikirim, kamu bisa mengecek secara berkala untuk orderannya di link berikut:\n{link}\n\nTerima kasih",
  kirim_penerima: "Halo {penerima},\nKamu mendapatkan kiriman dari {pemesan} dan sedang dalam perjalanan, mohon menunggu.",
  sampai_pemesan: "Orderan kamu sudah diterima oleh {diterima_oleh}.\nTerima kasih\n{link}",
  gagal_pemesan: "Hai {pemesan},\nMaaf, orderanmu untuk {penerima} belum berhasil diantar ({alasan}). Tim Exquise akan segera menghubungi kamu.\n{link}",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Metode tidak didukung" }, 405);
  const { order_id, kind } = await req.json().catch(() => ({}));
  if (!order_id || !["kirim", "sampai", "gagal"].includes(kind)) return json({ error: "order_id dan kind (kirim/sampai/gagal) wajib" }, 400);

  // Baca pesanan dengan hak akses pemanggil (RLS): hanya admin atau kurir pemilik rute.
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: o, error } = await asUser.from("orders").select("id, code, item, address, token, sender, sender_phone, recipient, recipient_phone, receiver_name, fail_reason, status").eq("id", order_id).maybeSingle();
  if (error || !o) return json({ error: "Pesanan tidak ditemukan atau tidak boleh diakses" }, 403);
  if (kind === "kirim" && o.status !== "jalan") return json({ error: "Pesanan belum berstatus Dalam perjalanan" }, 409);
  if (kind === "sampai" && o.status !== "sampai") return json({ error: "Pesanan belum berstatus Sampai" }, 409);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: st } = await admin.from("settings").select("value").eq("key", "wa_templates").maybeSingle();
  const tpl = (k: string) => (st?.value?.[k] || DEFAULT[k]).trim();
  const vars: Record<string, string> = {
    pemesan: o.sender || "-", penerima: o.recipient || "-", diterima_oleh: o.receiver_name ?? o.recipient ?? "-",
    alasan: o.fail_reason ?? "-", item: o.item || "", kode: o.code || "", alamat: o.address || "-", link: `${SITE}/lacak/${o.token}`,
  };
  const fill = (k: string) => tpl(k).replace(/\{(\w+)\}/g, (m, v) => vars[v] ?? m);
  const msgs: { role: string; phone: string | null; text: string }[] = kind === "kirim"
    ? [{ role: "pemesan", phone: o.sender_phone, text: fill("kirim_pemesan") }, { role: "penerima", phone: o.recipient_phone, text: fill("kirim_penerima") }]
    : [{ role: "pemesan", phone: o.sender_phone, text: fill(kind === "sampai" ? "sampai_pemesan" : "gagal_pemesan") }];

  const token = Deno.env.get("FONNTE_TOKEN");
  const results = [];
  for (const m of msgs) {
    if (!m.phone) { results.push({ role: m.role, sent: false, reason: "tanpa No HP" }); continue; }
    let ok = false, response = "";
    if (!token) response = "FONNTE_TOKEN belum diatur";
    else {
      try {
        const form = new FormData();
        form.append("target", m.phone);
        form.append("message", m.text);
        form.append("countryCode", "62");
        const r = await fetch("https://api.fonnte.com/send", { method: "POST", headers: { Authorization: token }, body: form });
        response = (await r.text()).slice(0, 500);
        ok = r.ok && /"status"\s*:\s*true/.test(response);
      } catch (e) { response = String(e).slice(0, 500); }
    }
    await admin.from("wa_logs").insert({ order_id: o.id, to_phone: m.phone, kind, role: m.role, message: m.text, ok, response });
    results.push({ role: m.role, sent: ok, reason: ok ? null : response });
  }
  return json({ results });
});
