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

const PROD = (Deno.env.get("LALAMOVE_ENV") || "").trim().toLowerCase() === "production";
// Key Lalamove: sandbox diawali pk_test_, production pk_prod_. Dicek supaya salah pasang langsung ketahuan.
const keyMode = (k = Deno.env.get("LALAMOVE_API_KEY") || "") => k.startsWith("pk_prod") ? "production" : k.startsWith("pk_test") ? "sandbox" : k ? "tidak dikenal" : "kosong";
async function llm(method: string, path: string, data?: unknown) {
  const key = (Deno.env.get("LALAMOVE_API_KEY") || "").trim(), secret = (Deno.env.get("LALAMOVE_API_SECRET") || "").trim();
  if (!key || !secret) throw new Error("LALAMOVE_API_KEY / LALAMOVE_API_SECRET belum diatur di Supabase secrets");
  if (PROD && keyMode(key) === "sandbox") throw new Error("LALAMOVE_ENV = production, tapi API key yang terpasang masih key sandbox (pk_test_…). Ganti dengan key production (pk_prod_…).");
  if (!PROD && keyMode(key) === "production") throw new Error("Key production (pk_prod_…) sudah terpasang, tapi LALAMOVE_ENV belum diisi production.");
  const host = PROD ? "https://rest.lalamove.com" : "https://rest.sandbox.lalamove.com";
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

// Opsi tambahan Lalamove (tas thermal, pulang pergi, dll.) = nama special request dari /v3/cities; catatan driver masuk remarks.
const specials = (v: unknown) => (Array.isArray(v) ? v : []).map(String).filter(x => /^[A-Z0-9_]{2,60}$/.test(x)).slice(0, 10);
const noteOf = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
let svcCache: { at: number; data: unknown } | null = null; // katalog kendaraan jarang berubah: simpan 10 menit
const URL_ = Deno.env.get("SUPABASE_URL")!, SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// WhatsApp lewat fungsi notify yang sama (template dari Pengaturan), dipanggil sebagai server.
const notify = (order_id: string, kind: string) => fetch(`${URL_}/functions/v1/notify`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ order_id, kind }) }).then(r => r.json()).catch(e => ({ error: String(e) }));

// Status order diambil ulang dari API Lalamove (bukan dari isi webhook), lalu diterapkan ke semua pesanan di order itu.
async function sync(db: any, o: any) {
  const { data: list } = await db.from("orders").select("*").eq("llm_order_id", o.llm_order_id);
  const r = await llm("GET", `/v3/orders/${o.llm_order_id}`), wa: any = {};
  for (const x of list?.length ? list : [o]) wa[x.code] = await syncOne(db, x, r);
  return { r, wa };
}
async function syncOne(db: any, o: any, r: any) {
  const multi = !!o.llm_stop_id, stop = multi ? (r.stops || []).find((s: any) => s.stopId === o.llm_stop_id) : (r.stops || []).at(-1);
  const pod = stop?.POD || {}, done = multi ? ["DELIVERED", "SIGNED"].includes(pod.status) || (r.status === "COMPLETED" && pod.status !== "FAILED") : r.status === "COMPLETED";
  await db.from("orders").update({ llm_status: r.status, ext_link: r.shareLink || o.ext_link }).eq("id", o.id);
  const wa: any = {};
  if (["PICKED_UP", "COMPLETED"].includes(r.status)) {
    const { data } = await db.from("orders").update({ status: "jalan", sent_at: new Date().toISOString(), fail_reason: null }).eq("id", o.id).in("status", ["draft", "siap"]).select("id");
    if (data?.length && r.status === "PICKED_UP") wa.kirim = await notify(o.id, "kirim");
  }
  if (done) {
    const proof = o.proof_path || await grabPod(db, o, pod.image);
    const { data } = await db.from("orders").update({ status: "sampai", delivered_at: pod.deliveredAt || new Date().toISOString(), receiver_name: o.receiver_name || o.recipient, proof_path: proof }).eq("id", o.id).eq("status", "jalan").select("id");
    if (data?.length) wa.sampai = await notify(o.id, "sampai");
    else if (proof && !o.proof_path) await db.from("orders").update({ proof_path: proof }).eq("id", o.id).eq("status", "sampai"); // sudah ditandai sampai manual: tambah foto saja, tanpa WA ulang
  }
  return wa;
}
// Foto bukti dari driver Lalamove disalin ke penyimpanan kita (link foto Lalamove tidak permanen).
async function grabPod(db: any, o: any, url?: string) {
  if (!url) return null;
  try {
    const img = await fetch(url), b = await img.arrayBuffer(), type = img.headers.get("content-type") || "image/jpeg";
    if (img.ok && b.byteLength < 5e6 && /image\/(jpeg|png|webp)/.test(type)) {
      const path = `${o.token}/lalamove-${o.llm_order_id}.${type.split("/")[1].replace("jpeg", "jpg")}`;
      if (!(await db.storage.from("proofs").upload(path, b, { contentType: type, upsert: true })).error) return path;
    }
  } catch { /* foto bukti tidak bisa diambil, status tetap sampai */ }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const payload = await req.json().catch(() => ({}));
  const db = createClient(URL_, SERVICE);
  // Webhook dari Lalamove: tanpa login. Isinya hanya dipakai untuk tahu order mana, statusnya dicek ulang ke API.
  if (!payload.action) { // termasuk tes URL saat Lalamove mendaftarkan webhook
    const id = payload.data?.order?.orderId ?? payload.data?.orderId;
    if (id) {
      const { data: o } = await db.from("orders").select("*").eq("llm_order_id", String(id)).limit(1).maybeSingle();
      if (o) { try { await sync(db, o); } catch (e) { console.error("sync gagal", id, e); } }
    }
    return json({ ok: true });
  }
  if (payload.action === "poll") { // pg_cron tiap 3 menit: cadangan kalau kabar dari Lalamove tidak datang (mis. order dari aplikasi Lalamove)
    const { data: k } = await db.from("app_secrets").select("value").eq("key", "cron_key").maybeSingle();
    if (!k?.value || req.headers.get("x-cron-key") !== k.value) return json({ error: "forbidden" }, 403);
    const since = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10), seen = new Set<string>();
    const { data: os } = await db.from("orders").select("*").not("llm_order_id", "is", null).in("status", ["draft", "siap", "jalan"]).gte("ship_date", since);
    for (const o of (os || []).filter((x: any) => !["CANCELED", "REJECTED", "EXPIRED"].includes(x.llm_status))) {
      if (seen.has(o.llm_order_id)) continue; seen.add(o.llm_order_id);
      try { await sync(db, o); } catch (e) { console.error("poll gagal", o.llm_order_id, e); }
    }
    return json({ ok: true, orders: seen.size });
  }
  const asUser = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: isAdmin } = await asUser.rpc("is_admin");
  if (!isAdmin) return json({ error: "Hanya admin" }, 403);
  const { action, order_id, service, quotation_id, sender_stop, recipient_stop, order_ids, stops } = payload, special = specials(payload.special), note = noteOf(payload.note);
  try {
    if (action === "register_webhook") return json(await llm("PATCH", "/v3/webhook", { url: `${URL_}/functions/v1/lalamove` }));
    if (action === "notify_check") return json(await notify("00000000-0000-0000-0000-000000000000", "kirim"));
    if (action === "mode") return json({ env: PROD ? "production" : "sandbox", key: keyMode(), secret_set: !!Deno.env.get("LALAMOVE_API_SECRET") });
    if (action === "services") {
      if (!svcCache || Date.now() - svcCache.at > 600e3) {
        const cities = await llm("GET", "/v3/cities");
        const jkt = (cities || []).find((c: any) => /jakarta/i.test(c.name || c.locode || "")) || cities?.[0];
        svcCache = { at: Date.now(), data: { city: jkt?.name, services: (jkt?.services || []).map((s: any) => ({ key: s.key, description: s.description,
          specials: (s.specialRequests || []).map((r: any) => ({ name: r.name, description: r.description || r.name, parent: r.parent_type || r.parentType || null, max: r.max_selection ?? r.maxSelection ?? null })) })) } };
      }
      return json(svcCache.data);
    }
    if (action === "resolve_link") { // link pendek Google Maps -> link panjang berisi koordinat; hanya mengikuti host Google
      let u = String(payload.url || "");
      for (let i = 0; i < 4; i++) {
        let h = ""; try { h = new URL(u).hostname; } catch { break; }
        if (!/(^|\.)(goo\.gl|google\.com|google\.co\.id)$/.test(h)) break;
        const loc = (await fetch(u, { redirect: "manual" })).headers.get("location"); if (!loc) break;
        u = new URL(loc, u).toString();
      }
      return json({ url: u });
    }
    if (action === "lookup") { // baca-saja: order yang dipesan dari aplikasi Lalamove bisa dibaca API ini (akun sama) atau tidak
      const id = String(payload.llm_id ?? "").replace(/\D/g, "").slice(0, 30);
      if (!id) return json({ error: "Order ID Lalamove kosong" }, 400);
      try {
        const r = await llm("GET", `/v3/orders/${id}`);
        return json({ found: true, status: r.status, price: r.priceBreakdown?.total, currency: r.priceBreakdown?.currency, stops: (r.stops || []).length, pod: (r.stops || []).filter((x: any) => x.POD?.image).length, share_link: r.shareLink });
      } catch (e) { return json({ found: false, error: String((e as Error).message || e) }); }
    }
    if (action === "quote_multi" || action === "book_multi") { // 1 driver ke banyak alamat dari outlet yang sama
      const ids: string[] = Array.isArray(order_ids) ? order_ids : [];
      if (ids.length < 2) return json({ error: "Pilih minimal 2 pesanan untuk digabung" }, 400);
      const { data: os } = await db.from("orders").select("*, origins(*)").in("id", ids);
      if (!os || os.length !== ids.length) return json({ error: "Ada pesanan yang tidak ditemukan" }, 404);
      if (new Set(os.map((o: any) => o.origin_id)).size > 1) return json({ error: "Semua pesanan yang digabung harus dari outlet yang sama" }, 400);
      const noPin = os.filter((o: any) => o.lat == null); if (noPin.length) return json({ error: `Titik peta belum ada: ${noPin.map((o: any) => o.code).join(", ")}` }, 400);
      const busyOs = os.filter((o: any) => o.llm_order_id && !["CANCELED", "REJECTED", "EXPIRED"].includes(o.llm_status)); if (busyOs.length) return json({ error: `Sudah punya order Lalamove aktif: ${busyOs.map((o: any) => o.code).join(", ")}` }, 409);
      const org = os[0].origins;
      if (action === "quote_multi") {
        const q = await llm("POST", "/v3/quotations", { serviceType: service || "MOTORCYCLE", language: "id_ID", isRouteOptimized: true, ...(special.length ? { specialRequests: special } : {}),
          stops: [{ coordinates: { lat: String(org.lat), lng: String(org.lng) }, address: org.name }, ...os.map((o: any) => ({ coordinates: { lat: String(o.lat), lng: String(o.lng) }, address: o.address }))] });
        // urutan stop dari Lalamove (sudah dioptimalkan) dicocokkan balik ke pesanan lewat alamat + koordinat
        const rest = [...os], near = (s: any, o: any) => Math.abs(+s.coordinates?.lat - o.lat) < 1e-5 && Math.abs(+s.coordinates?.lng - o.lng) < 1e-5;
        const seq = (q.stops || []).slice(1).map((s: any) => {
          let i = rest.findIndex((o: any) => o.address === s.address && near(s, o)); if (i < 0) i = rest.findIndex((o: any) => near(s, o));
          const o = i >= 0 ? rest.splice(i, 1)[0] : null;
          return o && { order_id: o.id, code: o.code, recipient: o.recipient, lat: o.lat, lng: o.lng, stop_id: s.stopId };
        });
        if (seq.length !== os.length || seq.some((x: any) => !x)) return json({ error: "Urutan dari Lalamove tidak bisa dicocokkan ke pesanan" }, 502);
        return json({ quotation_id: q.quotationId, price: q.priceBreakdown?.total, expires_at: q.expiresAt, distance: q.distance, sender_stop: q.stops?.[0]?.stopId, stops: seq });
      }
      const by = Object.fromEntries(os.map((o: any) => [o.id, o])), senderPhone = e164(org.phone);
      if (!senderPhone) return json({ error: `No HP ${org.short} belum diisi di Pengaturan → Lokasi asal` }, 400);
      const list = (Array.isArray(stops) ? stops : []).filter((x: any) => by[x.order_id]);
      if (list.length !== os.length) return json({ error: "Data urutan tidak lengkap, cek ongkir ulang" }, 400);
      const recipients = list.map((x: any) => { const o = by[x.order_id]; return { stopId: x.stop_id, name: o.recipient_phone ? o.recipient : `${o.recipient} (via ${o.sender})`, phone: e164(o.recipient_phone || o.sender_phone), remarks: [o.code, o.item, note, o.notes].filter(Boolean).join(" · ").slice(0, 500) }; });
      const noPhone = list.filter((_: any, i: number) => !recipients[i].phone); if (noPhone.length) return json({ error: `Tanpa No HP penerima/pemesan: ${noPhone.map((x: any) => by[x.order_id].code).join(", ")}` }, 400);
      const r = await llm("POST", "/v3/orders", { quotationId: quotation_id, isPODEnabled: true, sender: { stopId: sender_stop, name: `Exquise ${org.short}`, phone: senderPhone }, recipients, metadata: { codes: os.map((o: any) => o.code).join(",").slice(0, 200) } });
      const share = Math.round(Number(r.priceBreakdown?.total || 0) / os.length) || null; // ongkir dibagi rata per pesanan untuk laporan
      for (const x of list) await db.from("orders").update({ via: "lalamove", llm_order_id: r.orderId, llm_stop_id: x.stop_id, llm_status: r.status, llm_price: share, llm_service: service || null, ext_link: r.shareLink || null }).eq("id", x.order_id);
      return json({ order_id: r.orderId, status: r.status, price: r.priceBreakdown?.total, share_link: r.shareLink });
    }
    const { data: o } = await db.from("orders").select("*, origins(*)").eq("id", order_id).maybeSingle();
    if (!o) return json({ error: "Pesanan tidak ditemukan" }, 404);
    if (action === "quote") {
      if (o.lat == null) return json({ error: "Alamat belum punya titik peta. Pilih kelurahannya dulu di Data pengiriman." }, 400);
      const q = await llm("POST", "/v3/quotations", {
        serviceType: service || "MOTORCYCLE", language: "id_ID", ...(special.length ? { specialRequests: special } : {}),
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
        recipients: [{ stopId: recipient_stop, name: o.recipient_phone ? o.recipient : `${o.recipient} (via ${o.sender})`, phone: toPhone, remarks: [o.code, o.item, note, o.notes].filter(Boolean).join(" · ").slice(0, 500) }],
        metadata: { code: o.code },
      });
      await db.from("orders").update({ via: "lalamove", llm_order_id: r.orderId, llm_stop_id: null, llm_status: r.status, llm_price: r.priceBreakdown?.total ?? null, llm_service: service || null, ext_link: r.shareLink || o.ext_link }).eq("id", o.id);
      return json({ order_id: r.orderId, status: r.status, share_link: r.shareLink, price: r.priceBreakdown?.total });
    }
    if (action === "link") { // dipesan dari aplikasi Lalamove -> dihubungkan lewat Order ID, lalu status, foto & WA ikut otomatis
      const id = String(payload.llm_id ?? "").replace(/\D/g, "").slice(0, 30);
      if (id.length < 8) return json({ error: "Order ID tidak valid. Salin nomor Order ID dari detail pesanan di aplikasi Lalamove." }, 400);
      if (o.llm_order_id && o.llm_order_id !== id && !["CANCELED", "REJECTED", "EXPIRED"].includes(o.llm_status)) return json({ error: "Pesanan ini sudah terhubung ke order Lalamove lain yang masih aktif" }, 409);
      let r: any; try { r = await llm("GET", `/v3/orders/${id}`); } catch { return json({ error: "Order ID tidak ditemukan di akun Lalamove ini. Cek lagi nomornya." }, 404); }
      const drops = (r.stops || []).slice(1), hp = (p: unknown) => String(p ?? "").replace(/\D/g, "").replace(/^0/, "62");
      // 1 order Lalamove bisa berisi beberapa alamat: cocokkan lewat No HP penerima, kalau tidak bisa admin memilih alamatnya.
      let stop = drops.length === 1 ? drops[0] : drops.find((x: any) => x.stopId === payload.stop_id);
      if (!stop && o.recipient_phone) { const hit = drops.filter((x: any) => hp(x.phone) === hp(o.recipient_phone)); if (hit.length === 1) stop = hit[0]; }
      if (!stop) {
        const { data: used } = await db.from("orders").select("code, llm_stop_id").eq("llm_order_id", id);
        return json({ choose: drops.map((x: any) => ({ stop_id: x.stopId, address: x.address || "", name: x.name || "", used: (used || []).find((u: any) => u.llm_stop_id === x.stopId)?.code || null })) });
      }
      const total = Number(r.priceBreakdown?.total || 0);
      await db.from("orders").update({ via: "lalamove", llm_order_id: id, llm_stop_id: drops.length > 1 ? stop.stopId : null, llm_status: r.status, llm_price: total ? Math.round(total / Math.max(1, drops.length)) : null, ext_link: r.shareLink || o.ext_link }).eq("id", o.id);
      const { wa } = await sync(db, { ...o, llm_order_id: id });
      return json({ status: r.status, stops: drops.length, wa });
    }
    if (!o.llm_order_id) return json({ error: "Pesanan ini belum dipesan ke Lalamove" }, 400);
    if (action === "status") {
      const { r, wa } = await sync(db, o);
      let driver = null;
      if (r.driverId) { try { const d = await llm("GET", `/v3/orders/${o.llm_order_id}/drivers/${r.driverId}`); driver = { name: d.name, phone: d.phone, plate: d.plateNumber }; } catch { /* driver belum tersedia */ } }
      return json({ status: r.status, share_link: r.shareLink, driver, wa });
    }
    if (action === "priority") { // tip prioritas saat masih mencari driver (Lalamove: priority fee)
      const amt = Math.round(Number(payload.amount));
      if (!(amt >= 1000 && amt <= 50000)) return json({ error: "Tip prioritas harus Rp1.000–Rp50.000" }, 400);
      if (o.llm_status !== "ASSIGNING_DRIVER") return json({ error: "Tip prioritas hanya bisa saat masih mencari driver" }, 409);
      return json(await llm("POST", `/v3/orders/${o.llm_order_id}/priority-fee`, { priorityFee: String(amt) }));
    }
    if (action === "cancel") {
      await llm("DELETE", `/v3/orders/${o.llm_order_id}`);
      await db.from("orders").update({ llm_status: "CANCELED" }).eq("llm_order_id", o.llm_order_id); // order gabungan: semua alamat ikut batal
      return json({ status: "CANCELED" });
    }
    return json({ error: "action tidak dikenal" }, 400);
  } catch (e) { return json({ error: String((e as Error).message || e) }, 502); }
});
