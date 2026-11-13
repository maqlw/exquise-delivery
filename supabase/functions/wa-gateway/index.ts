import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// WhatsApp Gateway (admin saja): status perangkat, ganti token (dites dulu), QR / kode untuk menyambung ulang.
// Token disimpan di tabel app_secrets (tidak bisa dibaca dari browser); kalau kosong pakai secret FONNTE_TOKEN (penyedia: Fonnte).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const mask = (p: string) => p && p.length >= 8 ? "0" + p.replace(/^62/, "").slice(0, 2) + "xxx" + p.slice(-4) : p;
async function fonnte(path: string, token: string, fields: Record<string, string> = {}) {
  const form = new FormData(); for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const r = await fetch("https://api.fonnte.com/" + path, { method: "POST", headers: { Authorization: token }, body: form });
  const t = await r.text(); try { return JSON.parse(t); } catch { return { status: false, reason: t.slice(0, 200) }; }
}
const profile = (d: any, token: string, source: string) => ({
  ok: d.status === true || d.status === "true", reason: d.reason ?? null, token_hint: "••••" + token.slice(-4), source,
  device: mask(String(d.device ?? "")), connected: d.device_status === "connect", device_status: d.device_status ?? null,
  expired: d.expired ?? null, quota: d.quota ?? null, name: d.name ?? null,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: isAdmin } = await asUser.rpc("is_admin");
  if (!isAdmin) return json({ error: "Hanya admin" }, 403);
  const { data: { user } } = await asUser.auth.getUser();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { action, token: newToken, type, whatsapp, id, event } = await req.json().catch(() => ({}));
  const { data: sec } = await db.from("app_secrets").select("value").eq("key", "fonnte_token").maybeSingle();
  const token = sec?.value || Deno.env.get("FONNTE_TOKEN") || "", source = sec?.value ? "pengaturan" : "server";
  try {
    if (action === "save") {
      const t = String(newToken ?? "").trim();
      if (t.length < 10 || /\s/.test(t)) return json({ error: "Token tidak valid" }, 400);
      const d = await fonnte("device", t);
      if (!(d.status === true || d.status === "true")) return json({ error: `Token ditolak: ${d.reason || "tidak dikenal"}. Token lama tetap dipakai.` }, 400);
      await db.from("app_secrets").upsert({ key: "fonnte_token", value: t, updated_at: new Date().toISOString(), updated_by: user?.id });
      return json(profile(d, t, "pengaturan"));
    }
    if (!token) return json({ ok: false, reason: "Token WhatsApp Gateway belum diatur", source: "kosong" });
    if (action === "topup_notify") { // kabari penyedia jasa: pengajuan baru / bukti transfer masuk
      const { data: t } = await db.from("topup_requests").select("*").eq("id", id).maybeSingle();
      const { data: st } = await db.from("settings").select("value").eq("key", "topup").maybeSingle();
      const to = String(st?.value?.notify_phone ?? "").replace(/\D/g, "").replace(/^0/, "62");
      if (!t || to.length < 10) return json({ sent: false, reason: !t ? "Pengajuan tidak ditemukan" : "No HP penerima notifikasi belum diatur" });
      const rp = "Rp " + Number(t.amount).toLocaleString("id-ID");
      const proof = t.proof_path ? `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/proofs/${t.proof_path}` : "";
      const text = event === "dibayar"
        ? `💸 Bukti transfer top up masuk\nPaket: ${t.package_name}\nTotal: ${rp}\nDari: ${user?.email ?? "-"}\nBukti: ${proof}\n\nProses top up lalu tandai Selesai di Pengaturan → Top up WhatsApp.`
        : `🧾 Pengajuan top up WhatsApp baru\nPaket: ${t.package_name}\nTotal: ${rp}\nDari: ${user?.email ?? "-"}${t.note ? `\nCatatan: ${t.note}` : ""}`;
      const d = await fonnte("send", token, { target: to, message: text, countryCode: "62" });
      return json({ sent: d.status === true || d.status === "true" });
    }
    if (action === "status") return json(profile(await fonnte("device", token), token, source));
    if (action === "qr") { // type: "qr" (gambar) atau "code" (kode sambung, perlu nomor WhatsApp)
      const fields: Record<string, string> = { type: type === "code" ? "code" : "qr" };
      if (type === "code") { const w = String(whatsapp ?? "").replace(/\D/g, "").replace(/^0/, "62"); if (w.length < 10) return json({ error: "Isi nomor WhatsApp yang mau disambungkan" }, 400); fields.whatsapp = w; }
      const d = await fonnte("qr", token, fields);
      return json({ ok: d.status === true || d.status === "true", image: typeof d.url === "string" && d.url.length > 100 ? d.url : null, code: d.code ?? (typeof d.url === "string" && d.url.length <= 100 ? d.url : null), reason: d.reason ?? null });
    }
    return json({ error: "action tidak dikenal" }, 400);
  } catch (e) { return json({ error: String((e as Error).message || e) }, 502); }
});
