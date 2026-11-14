import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// Tagihan: kirim invoice lewat WhatsApp (gateway) / email (SMTP Hostinger), tes kirim, dan kabari penyedia soal top up.
// Secret email: SMTP_USER, SMTP_PASS (opsional SMTP_HOST, default smtp.hostinger.com; port 465 SSL).
const SITE = "https://delivery.exquisepatisserie.space";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const rp = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const dmy = (d?: string | null) => d ? String(d).slice(0, 10).split("-").reverse().join("/") : "-";
const phones = (s: string) => String(s || "").split(/[,;\s]+/).map(p => p.replace(/\D/g, "").replace(/^0/, "62")).filter(p => p.length >= 10);
const emails = (s: string) => String(s || "").split(/[,;\s]+/).filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const [{ data: isProvider }, { data: isAdmin }] = await Promise.all([asUser.rpc("is_provider"), asUser.rpc("is_admin")]);
  if (!isProvider && !isAdmin) return json({ error: "Tidak punya akses" }, 403);
  const { data: { user } } = await asUser.auth.getUser();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { action, id, event, auto, channel } = await req.json().catch(() => ({}));
  const B = Object.fromEntries(((await db.from("billing").select("*")).data || []).map((r: any) => [r.key, r.value]));
  const plan = B.plan || {}, send = B.send || {};
  const { data: sec } = await db.from("app_secrets").select("value").eq("key", "fonnte_token").maybeSingle();
  const waToken = sec?.value || Deno.env.get("FONNTE_TOKEN") || "";

  async function wa(to: string[], text: string) {
    if (!waToken) return "WhatsApp: token gateway belum diatur";
    let ok = 0;
    for (const t of to) {
      const form = new FormData(); form.append("target", t); form.append("message", text); form.append("countryCode", "62");
      const r = await fetch("https://api.fonnte.com/send", { method: "POST", headers: { Authorization: waToken }, body: form }).then(r => r.text()).catch(e => String(e));
      if (/"status"\s*:\s*true/.test(r)) ok++;
    }
    return `WhatsApp terkirim ${ok}/${to.length}`;
  }
  async function mail(to: string[], subject: string, html: string, text: string) {
    const u = Deno.env.get("SMTP_USER"), p = Deno.env.get("SMTP_PASS");
    if (!u || !p) return "Email: SMTP_USER / SMTP_PASS belum diatur";
    const client = new SMTPClient({ connection: { hostname: Deno.env.get("SMTP_HOST") || "smtp.hostinger.com", port: 465, tls: true, auth: { username: u, password: p } } });
    try { await client.send({ from: `${plan.company || "Tagihan"} <${u}>`, to, subject, content: text, html }); return `Email terkirim ke ${to.length} alamat`; }
    catch (e) { return "Email gagal: " + String((e as Error).message || e).slice(0, 160); }
    finally { await client.close().catch(() => {}); }
  }
  const mailHtml = (title: string, lines: string[], link: string, btn: string, color: string) =>
    `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1b2430"><div style="height:6px;background:#0f1726"></div>
     <h2 style="margin:18px 0 6px">${esc(title)}</h2>${lines.map(l => `<p style="margin:6px 0">${esc(l)}</p>`).join("")}
     <p style="margin:20px 0"><a href="${link}" style="background:${color};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${esc(btn)}</a></p>
     <p style="color:#6b7684;font-size:12px">${esc(plan.company || "")}</p></div>`;

  try {
    if (action === "topup_notify") { // kabari penyedia: pengajuan top up baru / bukti transfer masuk
      const { data: inv } = await db.from("invoices").select("*").eq("id", id).maybeSingle();
      const to = phones(B.topup?.notify_phone);
      if (!inv || !to.length) return json({ sent: false });
      const link = `${SITE}/invoice/${inv.token}`, proof = inv.proof_path ? `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/proofs/${inv.proof_path}` : "";
      const text = event === "dibayar"
        ? `💸 Bukti transfer masuk\nInvoice: #${inv.number}\nTotal: ${rp(inv.total)}\nDari: ${user?.email ?? "-"}\nBukti: ${proof}\n\nCek lalu tandai lunas di ${SITE}/penyedia`
        : `🧾 Pengajuan top up WhatsApp baru\nInvoice: #${inv.number}\n${inv.items?.[0]?.name ?? ""}\nTotal: ${rp(inv.total)}\nDari: ${user?.email ?? "-"}${inv.note ? `\nCatatan: ${inv.note}` : ""}\n${link}`;
      return json({ sent: true, summary: await wa(to, text) });
    }
    if (!isProvider) return json({ error: "Hanya penyedia" }, 403);
    if (action === "test") {
      const r = channel === "email"
        ? await mail(emails(send.email_to), "Tes kirim invoice", mailHtml("Tes kirim invoice", ["Pengaturan email tagihan sudah berfungsi."], `${SITE}/penyedia`, "Buka panel", "#0f1726"), "Pengaturan email tagihan sudah berfungsi.")
        : await wa(phones(send.wa_to), `✅ Tes kirim invoice dari ${plan.company || "penyedia"}: WhatsApp tagihan sudah berfungsi.`);
      return json({ summary: r });
    }
    if (action === "send") {
      const { data: inv } = await db.from("invoices").select("*").eq("id", id).maybeSingle();
      if (!inv) return json({ error: "Invoice tidak ditemukan" }, 404);
      const useWa = !!send.wa, useMail = !!send.email;
      if (!useWa && !useMail) return json(auto ? { summary: "Tidak dikirim (saluran mati)" } : { error: "Aktifkan WhatsApp atau email dulu di bagian Kirim invoice otomatis" }, auto ? 200 : 400);
      const link = `${SITE}/invoice/${inv.token}`, paid = event === "paid" || inv.status === "paid";
      const what = inv.kind === "topup" ? "top up WhatsApp" : "langganan Matrix Delivery";
      const lines = paid
        ? [`Terima kasih, pembayaran invoice #${inv.number} (${what}) sebesar ${rp(inv.total)} sudah LUNAS pada ${dmy(inv.paid_at)}.`]
        : [`Berikut tagihan ${what} #${inv.number} sebesar ${rp(inv.total)}.`, ...(inv.active_until ? [`Batas aktif: ${dmy(inv.active_until)}.`] : []), ...(inv.pay_link ? [`Bayar: ${inv.pay_link}`] : [])];
      const title = paid ? `Invoice #${inv.number} LUNAS` : `Tagihan #${inv.number}`;
      const out: string[] = [];
      if (useWa) out.push(await wa(phones(send.wa_to), `${paid ? "✅" : "🧾"} ${title}\n${lines.join("\n")}\n\nLihat & unduh invoice:\n${link}`));
      if (useMail) out.push(await mail(emails(send.email_to), `${title} · ${plan.company || ""}`, mailHtml(title, lines, link, paid ? "Lihat invoice lunas" : "Lihat & bayar invoice", paid ? "#16a34a" : "#0f1726"), `${lines.join("\n")}\n\n${link}`));
      return json({ summary: out.join(" · ") });
    }
    return json({ error: "action tidak dikenal" }, 400);
  } catch (e) { return json({ error: String((e as Error).message || e) }, 502); }
});
