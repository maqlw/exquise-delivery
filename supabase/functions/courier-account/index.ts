import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const normPhone = (v: string) => { const d = String(v ?? "").replace(/\D/g, ""); const p = d.startsWith("62") ? d : d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("8") ? "62" + d : ""; return p.length >= 10 && p.length <= 15 ? p : null; };

// Admin membuat / mengubah login kurir (No HP + PIN 6 digit).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Metode tidak didukung" }, 405);
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: isAdmin } = await asUser.rpc("is_admin");
  if (!isAdmin) return json({ error: "Hanya admin" }, 403);

  const { courier_id, phone, pin } = await req.json().catch(() => ({}));
  const p = normPhone(phone);
  if (!courier_id || !p) return json({ error: "Kurir dan No HP valid wajib diisi" }, 400);
  if (!/^\d{6}$/.test(String(pin ?? ""))) return json({ error: "PIN harus 6 angka" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: c } = await admin.from("couriers").select("id, user_id").eq("id", courier_id).maybeSingle();
  if (!c) return json({ error: "Kurir tidak ditemukan" }, 404);
  const email = `${p}@kurir.exquise.app`;
  let userId = c.user_id;
  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, { email, password: String(pin), email_confirm: true });
    if (error) return json({ error: error.message }, 400);
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password: String(pin), email_confirm: true, user_metadata: { role: "kurir" } });
    if (error) return json({ error: error.message.includes("already") ? "No HP ini sudah dipakai kurir lain" : error.message }, 400);
    userId = data.user.id;
  }
  const { error: upErr } = await admin.from("couriers").update({ phone: p, user_id: userId }).eq("id", courier_id);
  if (upErr) return json({ error: upErr.message.includes("duplicate") ? "No HP ini sudah dipakai kurir lain" : upErr.message }, 400);
  return json({ ok: true, phone: p });
});
