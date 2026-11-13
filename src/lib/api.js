import { createClient } from "@supabase/supabase-js";
import { TUNE, ALIASES } from "./logic.js";
import { compressImage } from "./image.js";

export const SITE = import.meta.env.VITE_SITE_URL;
export const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY);
export const trackUrl = token => `${SITE}/lacak/${token}`;
export const proofUrl = path => path ? sb.storage.from("proofs").getPublicUrl(path).data.publicUrl : null;
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

// Baris tabel orders <-> objek pesanan yang dipakai logika & tampilan.
export const fromDb = r => ({
  id: r.id, code: r.code, gd: r.gd, ymd: r.ship_date, sender: r.sender, phoneSender: r.sender_phone, recipient: r.recipient, phone: r.recipient_phone,
  address: r.address, area: r.area, lat: r.lat, lng: r.lng, item: r.item, notes: r.notes, origin: r.origin_id, batchReq: r.batch_req, reqTime: r.request_time,
  deadline: r.deadline_min, via: r.via, link: r.ext_link || "", token: r.token, ship: r.status === "draft" ? null : r.status, carry: r.carry_over, merged: r.merged_rows,
  issues: r.issues || [], failReason: r.fail_reason, proofPath: r.proof_path, proof: proofUrl(r.proof_path), receivedBy: r.receiver_name, receivedRel: r.receiver_relation,
  sentAt: r.sent_at, doneAt: r.delivered_at, courierForced: r.assigned_courier, batchForced: r.batch_forced, areaManual: r.area_manual, llm: r.llm_order_id ? { id: r.llm_order_id, status: r.llm_status, price: r.llm_price } : null, out: (r.issues || []).some(([, m]) => /Di luar area/.test(m)),
});
// Kolom data saja: status, token, dan bukti tidak ikut supaya upload ulang tidak menimpa progres pengiriman.
export const toDb = o => ({
  code: o.code, gd: o.gd || null, ship_date: o.ymd, sender: o.sender || "", sender_phone: o.phoneSender || null, recipient: o.recipient, recipient_phone: o.phone || null,
  address: o.address, area: o.area, lat: o.lat, lng: o.lng, item: o.item, notes: o.notes || null, origin_id: o.origin, batch_req: o.batchReq, request_time: o.reqTime,
  deadline_min: o.deadline, via: o.via, carry_over: !!o.carry, merged_rows: o.merged || 1, issues: o.issues, area_manual: o.areaManual || null,
});

export async function loadMaster() {
  const [origins, couriers, st] = await Promise.all([sb.from("origins").select("*").order("id"), sb.from("couriers").select("*").order("created_at"), sb.from("settings").select("*")]);
  const settings = Object.fromEntries(must(st).map(r => [r.key, r.value]));
  if (settings.tuning) Object.assign(TUNE, settings.tuning); // dipakai perencanaan rute & ETA
  ALIASES.splice(0, ALIASES.length, ...(settings.aliases || []));
  return { origins: Object.fromEntries(must(origins).map(o => [o.id, o])), couriers: must(couriers), settings };
}
export const saveSetting = async (key, value) => must(await sb.from("settings").upsert({ key, value, updated_at: new Date().toISOString() }));
// Laporan: pesanan dalam rentang tanggal kirim (inklusif).
export const reportOrders = async (from, to) => must(await sb.from("orders").select("ship_date, status, via, origin_id, area, lat, lng, sent_at, delivered_at, llm_price, llm_status").gte("ship_date", from).lte("ship_date", to).limit(10000));
export async function loadDay(ymd) {
  const orders = must(await sb.from("orders").select("*").eq("ship_date", ymd).order("created_at", { ascending: false })).map(fromDb);
  const routes = must(await sb.from("routes").select("id, origin_id, batch, courier_id, started_at, finished_at, route_stops(order_id, seq, eta_min)").eq("ship_date", ymd));
  const sent = {};
  for (const r of routes) ((sent[r.origin_id + "|" + r.batch] ||= {})[r.courier_id] = r.route_stops.sort((a, b) => a.seq - b.seq).map(s => s.order_id));
  const ids = [...new Set(routes.map(r => r.courier_id))];
  const pos = ids.length ? must(await sb.from("courier_positions").select("*").in("courier_id", ids)) : [];
  return { orders, routes, sent, positions: Object.fromEntries(pos.map(p => [p.courier_id, p])) };
}
export async function shipDates() {
  const rows = must(await sb.from("orders").select("ship_date").order("ship_date", { ascending: false }).limit(1000));
  return [...new Set(rows.map(r => r.ship_date))];
}
export async function saveUpload(fileName, sheet, rowCount, list) {
  const up = must(await sb.from("uploads").insert({ file_name: fileName, sheet, row_count: rowCount }).select("id").single());
  for (let i = 0; i < list.length; i += 200)
    must(await sb.from("orders").upsert(list.slice(i, i + 200).map(o => ({ ...toDb(o), upload_id: up.id })), { onConflict: "code" }));
}
export const insertOrder = async o => must(await sb.from("orders").insert(toDb(o)).select("*").single());
export const updateOrder = async (id, patch) => must(await sb.from("orders").update(patch).eq("id", id).select("*").single());
export const deleteOrder = async id => must(await sb.from("orders").delete().eq("id", id));
export const addressHistory = async id => must(await sb.from("order_address_history").select("*").eq("order_id", id).order("changed_at"));
export const waLogs = async id => must(await sb.from("wa_logs").select("*").eq("order_id", id).order("created_at"));

export async function sendRoutes(ymd, oid, batch, routes) {
  for (const [courierId, r] of Object.entries(routes)) {
    if (!r.seq.length) continue;
    const route = must(await sb.from("routes").insert({ ship_date: ymd, origin_id: oid, batch, courier_id: courierId, km: Math.round(r.km * 10) / 10 }).select("id").single());
    must(await sb.from("route_stops").insert(r.seq.map((o, i) => ({ route_id: route.id, order_id: o.id, seq: i + 1, eta_min: Math.round(r.eta[o.code]) }))));
    must(await sb.from("orders").update({ status: "siap" }).in("id", r.seq.map(o => o.id)).eq("status", "draft"));
  }
}
// Tambahan setelah batch dikirim: alamat disambung ke rute kurir yang sudah ada (1 rute per kurir per batch), rute dibuka lagi kalau sudah selesai.
export async function sendExtra(ymd, oid, batch, routes) {
  for (const [courierId, r] of Object.entries(routes)) {
    if (!r.seq.length) continue;
    let route = must(await sb.from("routes").select("id, route_stops(seq)").eq("ship_date", ymd).eq("batch", batch).eq("courier_id", courierId).maybeSingle());
    if (!route) route = { ...must(await sb.from("routes").insert({ ship_date: ymd, origin_id: oid, batch, courier_id: courierId, km: Math.round(r.km * 10) / 10 }).select("id").single()), route_stops: [] };
    else must(await sb.from("routes").update({ finished_at: null }).eq("id", route.id));
    const last = Math.max(0, ...route.route_stops.map(s => s.seq));
    must(await sb.from("route_stops").insert(r.seq.map((o, i) => ({ route_id: route.id, order_id: o.id, seq: last + i + 1, eta_min: Math.round(r.eta[o.code]) }))));
    must(await sb.from("orders").update({ status: "siap" }).in("id", r.seq.map(o => o.id)).eq("status", "draft"));
  }
}
export async function uploadProof(token, original) {
  const file = await compressImage(original), ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const path = `${token}/${crypto.randomUUID()}.${ext}`;
  must(await sb.storage.from("proofs").upload(path, file, { contentType: file.type, upsert: false }));
  return path;
}
// WhatsApp lewat Edge Function (token Fonnte tersimpan di server).
export async function notify(orderId, kind) {
  const { data, error } = await sb.functions.invoke("notify", { body: { order_id: orderId, kind } });
  if (error) return { error: error.message, results: [] };
  return data;
}
export async function lalamove(action, params = {}) {
  const { data, error } = await sb.functions.invoke("lalamove", { body: { action, ...params } });
  if (error) { let msg = error.message; try { msg = (await error.context.json()).error || msg; } catch { /* pakai pesan bawaan */ } throw new Error(msg); }
  return data;
}
export async function courierAccount(courierId, phone, pin) {
  const { data, error } = await sb.functions.invoke("courier-account", { body: { courier_id: courierId, phone, pin } });
  if (error) { let msg = error.message; try { msg = (await error.context.json()).error || msg; } catch { /* pakai pesan bawaan */ } throw new Error(msg); }
  return data;
}
