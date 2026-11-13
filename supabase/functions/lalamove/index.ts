import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// Lalamove API v3 + webhook status otomatis (verify_jwt mati: webhook tanpa login, aksi admin dicek is_admin). Secret: LALAMOVE_API_KEY, LALAMOVE_API_SECRET, LALAMOVE_ENV ("production" atau kosong = sandbox).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
const e164 = (p: string | null) => p ? "+" + p.replace(/\D/g, "").replace(/^0/, "62") : null;

async function llm(method: string, path: string, data?: unknown) {
  const key = Deno.env.get("LALAMOVE_API_KEY"), secret = Deno.env.get("LALAMOVE_API_SECRET");
  if (!key || !secret) throw new Error("LALAMOVE_API_KEY / LALAMOVE_API_SECRET belum diatur di Supabase secrets");
  const host = Deno.env.get("LALAMOVE_ENV") === "production" ? "https://rest.lalamove.com" : "https://rest.sandbox.lalamove.com";
  const body = data === undefined ? "" : JSON.stringify({ data }), ts = Date.now().toString();
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${ts}\r\n${method}\r\n${path}\r\n\r\n${body}`)));
  const r = await fetch(host + path, {
    method, body: body || undefined,
    headers: { Authorization: `hmac ${key}:${ts}:${sig}`, Market: "ID", "Request-ID": crypto.randomUUID(), "Content-Type": "application/json", Accept: "application/json" },
  });
  const text = await r.text(); let j: any = {}; try { j = text ? JSON.parse(text) : {}; } catch { j = { raw: text }; }
  if (!r.ok) throw new Error(`Lalamove ${r.status}: ${(j.errors || []).map((e: any) => `${e.id || ""} ${e.message || ""} ${e.detail || ""}`.trim()).join("; ") || text.slice(0, 300)}`);
  return j.data ?? j;
}

const URL_ = Deno.env.get("SUPABASE_URL")!, SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// WhatsApp lewat fungsi notify yang sama (template dari Pengaturan), dipanggil sebagai server.
const notify = (order_id: string, kind: string) => fetch(`${URL_}/functions/v1/notify`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ order_id, kind }) }).then(r => r.json()).catch(e => ({ error: String(e) }));

// Status order diambil ulang dari API Lalamove (bukan dari isi webhook), lalu diterapkan ke pesanan.
async function sync(db: any, o: any) {
  const r = await llm("GET", `/v3/orders/${o.llm_order_id}`);
  await db.from("orders").update({ llm_status: r.status, ext_link: r.shareLink || o.ext_link }).eq("id", o.id);
  const wa: any = {};
  if (["PICKED_UP", "COMPLETED"].includes(r.status)) {
    const { data } = await db.from("orders").update({ status: "jalan", sent_at: new Date().toISOString(), fail_reason: null }).eq("id", o.id).in("status", ["draft", "siap"]).select("id");
    if (data?.length && r.status === "PICKED_UP") wa.kirim = await notify(o.id, "kirim");
  }
  if (r.status === "COMPLETED") {
    const pod = (r.stops || []).at(-1)?.POD || {}; let proof = null;
    if (pod.image) try {
      const img = await fetch(pod.image), b = await img.arrayBuffer(), type = img.headers.get("content-type") || "image/jpeg";
      if (img.ok && b.byteLength < 5e6 && /image\/(jpeg|png|webp)/.test(type)) {
        const path = `${o.token}/lalamove-${o.llm_order_id}.${type.split("/")[1].replace("jpeg", "jpg")}`;
        if (!(await db.storage.from("proofs").upload(path, b, { contentType: type, upsert: true })).error) proof = path;
      }
    } catch { /* foto bukti tidak bisa diambil, status tetap sampai */ }
    const { data } = await db.from("orders").update({ status: "sampai", delivered_at: pod.deliveredAt || new Date().toISOString(), receiver_name: o.receiver_name || o.recipient, proof_path: proof || o.proof_path }).eq("id", o.id).eq("status", "jalan").select("id");
    if (data?.length) wa.sampai = await notify(o.id, "sampai");
  }
  return { r, wa };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const payload = await req.json().catch(() => ({}));
  const db = createClient(URL_, SERVICE);
  // Webhook dari Lalamove: tanpa login. Isinya hanya dipakai untuk tahu order mana, statusnya dicek ulang ke API.
  if (!payload.action) { // termasuk tes URL saat Lalamove mendaftarkan webhook
    const id = payload.data?.order?.orderId ?? payload.data?.orderId;
    if (id) {
      const { data: o } = await db.from("orders").select("*").eq("llm_order_id", String(id)).maybeSingle();
      if (o) { try { await sync(db, o); } catch (e) { console.error("sync gagal", id, e); } }
    }
    return json({ ok: true });
  }
  const asUser = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: isAdmin } = await asUser.rpc("is_admin");
  if (!isAdmin) return json({ error: "Hanya admin" }, 403);
  const { action, order_id, service, quotation_id, sender_stop, recipient_stop } = payload;
  try {
    if (action === "register_webhook") return json(await llm("PATCH", "/v3/webhook", { url: `${URL_}/functions/v1/lalamove` }));
    if (action === "notify_check") return json(await notify("00000000-0000-0000-0000-000000000000", "kirim"));
    if (action === "services") {
      const cities = await llm("GET", "/v3/cities");
      const jkt = (cities || []).find((c: any) => /jakarta/i.test(c.name || c.locode || "")) || cities?.[0];
      return json({ city: jkt?.name, services: (jkt?.services || []).map((s: any) => ({ key: s.key, description: s.description })) });
    }
    const { data: o } = await db.from("orders").select("*, origins(*)").eq("id", order_id).maybeSingle();
    if (!o) return json({ error: "Pesanan tidak ditemukan" }, 404);
    if (action === "quote") {
      if (o.lat == null) return json({ error: "Alamat belum punya titik peta. Pilih kelurahannya dulu di Data pengiriman." }, 400);
      const q = await llm("POST", "/v3/quotations", {
        serviceType: service || "MOTORCYCLE", language: "id_ID",
        stops: [{ coordinates: { lat: String(o.origins.lat), lng: String(o.origins.lng) }, address: o.origins.name },
                { coordinates: { lat: String(o.lat), lng: String(o.lng) }, address: o.address }],
      });
      return json({ quotation_id: q.quotationId, price: q.priceBreakdown?.total, currency: q.priceBreakdown?.currency, expires_at: q.expiresAt, sender_stop: q.stops?.[0]?.stopId, recipient_stop: q.stops?.[1]?.stopId, distance: q.distance });
    }
    if (action === "book") {
      if (o.llm_order_id && !["CANCELED", "REJECTED", "EXPIRED"].includes(o.llm_status)) return json({ error: "Pesanan ini sudah punya order Lalamove aktif" }, 409);
      const senderPhone = e164(o.origins.phone), toPhone = e164(o.recipient_phone || o.sender_phone);
      if (!senderPhone) return json({ error: `No HP ${o.origins.short} belum diisi di Pengaturan → Lokasi asal` }, 400);
      if (!toPhone) return json({ error: "Penerima dan pemesan tidak punya No HP. Lalamove wajib No HP penerima." }, 400);
      const r = await llm("POST", "/v3/orders", {
        quotationId: quotation_id, isPODEnabled: true,
        sender: { stopId: sender_stop, name: `Exquise ${o.origins.short}`, phone: senderPhone },
        recipients: [{ stopId: recipient_stop, name: o.recipient_phone ? o.recipient : `${o.recipient} (via ${o.sender})`, phone: toPhone, remarks: [o.code, o.item, o.notes].filter(Boolean).join(" · ").slice(0, 500) }],
        metadata: { code: o.code },
      });
      await db.from("orders").update({ via: "lalamove", llm_order_id: r.orderId, llm_status: r.status, llm_price: r.priceBreakdown?.total ?? null, llm_service: service || null, ext_link: r.shareLink || o.ext_link }).eq("id", o.id);
      return json({ order_id: r.orderId, status: r.status, share_link: r.shareLink, price: r.priceBreakdown?.total });
    }
    if (!o.llm_order_id) return json({ error: "Pesanan ini belum dipesan ke Lalamove" }, 400);
    if (action === "status") {
      const { r, wa } = await sync(db, o);
      let driver = null;
      if (r.driverId) { try { const d = await llm("GET", `/v3/orders/${o.llm_order_id}/drivers/${r.driverId}`); driver = { name: d.name, phone: d.phone, plate: d.plateNumber }; } catch { /* driver belum tersedia */ } }
      return json({ status: r.status, share_link: r.shareLink, driver, wa });
    }
    if (action === "cancel") {
      await llm("DELETE", `/v3/orders/${o.llm_order_id}`);
      await db.from("orders").update({ llm_status: "CANCELED" }).eq("id", o.id);
      return json({ status: "CANCELED" });
    }
    return json({ error: "action tidak dikenal" }, 400);
  } catch (e) { return json({ error: String((e as Error).message || e) }, 502); }
});
