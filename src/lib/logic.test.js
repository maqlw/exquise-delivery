import { test } from "node:test";
import assert from "node:assert/strict";
import { normPhone, parseDeadline, parseDate, geocode, buildOrders, plan, status, returnLabel, parseExpired, daysLeft } from "./logic.js";

test("No HP dirapikan ke 62", () => {
  assert.equal(normPhone("0812-2222-0003").p, "6281222220003");
  assert.equal(normPhone("8131056600").p, "628131056600");
  assert.equal(normPhone("UP Mba Riska").p, null);
});
test("request jam dibaca dari teks", () => {
  assert.equal(parseDeadline("(JAM 9.00MAXX TIBA)"), 540);
  assert.equal(parseDeadline("MAX JAM 11"), 660);
  assert.equal(parseDeadline("Jl. Sawit II No 2"), null);
});
test("tanggal dan area", () => {
  assert.equal(parseDate("09/11/2026"), "2026-11-09");
  assert.equal(geocode("Jl. Raya Bogor Km 20, Pasar Rebo").name, "Pasar Rebo");
  assert.ok(geocode("Bogor Baru Blok D").out);
  assert.equal(geocode("Jl gading kirana timur kelapa gading jakarta utara 14240").name, "Kelapa Gading, Jakarta Utara"); // kode pos, kelurahan tidak disebut
  assert.equal(geocode("Jl Rajawali Sawah Besar Gunung Sahari Utara JAKARTA 10720").name, "Gunung Sahari Utara, Sawah Besar, Jakarta Pusat");
  assert.equal(geocode("Jl. Kemang Selatan VIII, Jakarta Selatan").name, "Kemang"); // bukan Kemang di Bogor
  assert.equal(geocode("Perum Ubud Village Jl.Sudimara Raya Ciledug Tangerang").name, "Ciledug, Tangerang");
  assert.equal(geocode("Outlet Kemensos"), null);
});
test("baris GD sama digabung, baris tanpa alamat jadi error", () => {
  const r = buildOrders([
    { gd: "GD1", date: "09/11/2026", sender: "A", recipient: "B", address: "Jl. Kemang Raya 1, Kemang", item: "Kue 1" },
    { gd: "GD1", date: "09/11/2026", sender: "A", recipient: "B", address: "Jl. Kemang Raya 1, Kemang", item: "Kue 2" },
    { gd: "GD2", date: "09/11/2026", sender: "A", recipient: "C", address: "", item: "Kue" },
  ]);
  assert.equal(r.orders.length, 1); assert.equal(r.orders[0].item, "Kue 1 + Kue 2"); assert.equal(r.errors.length, 1);
});
test("carry over ikut tanggal kirim file", () => {
  const r = buildOrders([1, 2, 3].map(i => ({ gd: "G" + i, date: i === 3 ? "07/11/2026" : "09/11/2026", sender: "S", recipient: "R", address: "Jl. X, Kemang", item: "Kue" })));
  const c = r.orders.find(o => o.carry); assert.equal(c.ymd, "2026-11-09"); assert.match(c.issues.map(i => i[1]).join(), /Carry over dari 07\/11\/2026/);
});
test("semua alamat terbagi ke kurir tanpa dobel", () => {
  const r = buildOrders(["Kemang", "Tebet", "Pluit", "Sunter", "Cikini", "Kuningan", "Senen"].map((a, i) => ({ gd: "G" + i, date: "09/11/2026", sender: "S", recipient: "R" + i, address: "Jl. X, " + a, item: "Kue" })));
  r.orders.forEach((o, i) => { o.id = "o" + i; });
  const P = plan(r.orders, { ck: { lat: -6.1525, lng: 106.8345 } }, [{ id: "k1", origin_id: "ck", active: true }, { id: "k2", origin_id: "ck", active: true }], {});
  const ids = Object.values(P.ck[1].routes).flatMap(x => x.seq.map(o => o.id));
  assert.equal(ids.length, 7); assert.equal(new Set(ids).size, 7);
  assert.equal(status(r.orders[0]), "draft");
});
// Bug 13/11: pesanan tambahan di batch yang sudah dikirim tidak bisa di-dispatch.
test("pesanan tambahan di batch yang sudah dikirim tetap bisa dikirim", () => {
  const r = buildOrders(["Kemang", "Tebet", "Pluit", "Sunter"].map((a, i) => ({ gd: "G" + i, date: "09/11/2026", sender: "S", recipient: "R" + i, address: "Jl. X, " + a, item: "Kue", batch: "Batch 2" })));
  r.orders.forEach((o, i) => { o.id = "o" + i; });
  const org = { ck: { lat: -6.1525, lng: 106.8345 } }, kurir = [{ id: "k1", origin_id: "ck", active: true }, { id: "k2", origin_id: "ck", active: true }];
  const sent = { "ck|2": { k1: ["o0", "o1"], k2: ["o2"] } }; // o3 masuk setelah rute Batch 2 dikirim
  const B = plan(r.orders, org, kurir, sent).ck[2];
  const extra = Object.values(B.extra?.routes || {}).flatMap(x => x.seq.map(o => o.id));
  assert.deepEqual(extra, ["o3"]);
  // tidak ada pesanan yang hilang atau dobel di semua batch (terkirim + rencana + tambahan)
  const P = plan(r.orders, org, kurir, sent).ck, all = [1, 2, 3].flatMap(b => [P[b].routes, P[b].extra?.routes || {}].flatMap(rs => Object.values(rs).flatMap(x => x.seq.map(o => o.id))));
  assert.deepEqual(all.sort(), ["o0", "o1", "o2", "o3"]);
});
test("pesanan tanpa batch tidak dilempar ke batch yang sudah dikirim", () => {
  const r = buildOrders([{ gd: "G9", date: "09/11/2026", sender: "S", recipient: "R", address: "Jl. X, Tebet", item: "Kue" }]);
  r.orders[0].id = "x";
  const P = plan(r.orders, { ck: { lat: -6.1525, lng: 106.8345 } }, [{ id: "k1", origin_id: "ck", active: true }], { "ck|1": { k1: [] } }).ck;
  assert.equal(Object.values(P[2].routes).flatMap(x => x.seq).length, 1);
});
test("status kurir setelah semua alamat selesai", () => {
  assert.equal(returnLabel({ stops_done_at: null, finished_at: null }), null);
  assert.equal(returnLabel({ stops_done_at: "x", finished_at: null })[1], "Menuju outlet");
  assert.equal(returnLabel({ stops_done_at: "x", return_status: "menunggu" })[1], "Minta izin pulang");
  assert.equal(returnLabel({ stops_done_at: "x", return_status: "kembali", finished_at: "y" })[1], "Sudah kembali");
  assert.equal(returnLabel({ finished_at: "y" })[1], "Selesai"); // rute lama sebelum fitur ini
});
test("tanggal kedaluwarsa Fonnte", () => {
  assert.equal(parseExpired("15 November 2026").getDate(), 15);
  assert.equal(parseExpired("1 Agustus 2027").getMonth(), 7);
  assert.equal(parseExpired("3 Mei 2027").getMonth(), 4);
  assert.equal(parseExpired("1794600000").getFullYear(), 2026);
  assert.equal(parseExpired("tidak jelas"), null);
  assert.equal(daysLeft(parseExpired("15 November 2026"), new Date(2026, 10, 13, 22)), 2);
});

test("parseLatLng: koordinat & link Google Maps, tolak di luar Indonesia", async () => {
  const { parseLatLng, findArea, pinLabel } = await import("./logic.js");
  assert.deepEqual(parseLatLng("-6.2615, 106.8106"), { lat: -6.2615, lng: 106.8106 });
  assert.deepEqual(parseLatLng("https://www.google.com/maps/place/X/@-6.2615123,106.8106456,17z/data=!3d-6.2611!4d106.8102"), { lat: -6.2611, lng: 106.8102 });
  assert.deepEqual(parseLatLng("https://maps.google.com/?q=-6.30001,106.65002"), { lat: -6.30001, lng: 106.65002 });
  assert.deepEqual(parseLatLng("https://www.google.com/maps/search/?api=1&query=-6.2%2C106.8"), { lat: -6.2, lng: 106.8 });
  assert.equal(parseLatLng("40.7128, -74.0060"), null);
  assert.equal(parseLatLng("Jl. Kemang Raya 8"), null);
  assert.equal(parseLatLng("%E0%A4%A"), null);
  const g = findArea(pinLabel(-6.2615, 106.8106));
  assert.equal(g.lat, -6.2615); assert.equal(g.how, "titik tepat di peta"); assert.ok(g.name.length > 3);
});

test("jasa kirim tambahan: disisipkan sebelum Pick up, nama publik dari kode", async () => {
  const { VIA, setExtVia, viaName, viaKey } = await import("./logic.js");
  setExtVia([{ key: "borzo", name: "Borzo" }, { key: "lalamove", name: "Palsu" }]);
  assert.deepEqual(Object.keys(VIA), ["internal", "lalamove", "gosend", "grab", "borzo", "pickup"]);
  assert.equal(VIA.lalamove, "Lalamove");
  assert.equal(viaName("paxel_same_day"), "Paxel Same Day");
  assert.equal(viaKey("Borzo (Mr. Speedy)"), "borzo_mr_speedy"); assert.equal(viaKey("99 Express"), "x99_express");
  setExtVia([]); assert.deepEqual(Object.keys(VIA), ["internal", "lalamove", "gosend", "grab", "pickup"]);
});

test("Excel Matrix: driver, batch, dan pick up/lalamove dibaca dari kolom kelompok (merge)", async () => {
  const XLSX = await import("xlsx"); const { readSheets, matchCourier } = await import("./logic.js");
  const H = ["NO", "NO PENGIRIMAN", "Tanggal Pengiriman", "PENGIRIM", "NAMA", "ALAMAT", "NO PENERIMA", "ITEM", "WORDING", "7.00"];
  const row = (i, g, a = "Jl. X, Kemang") => [i, "G" + i, "19/11/2026", "S", "R" + i, a, "", "Kue", "", g];
  const ws = XLSX.utils.aoa_to_sheet([["MATRIX", , , , , , , , , "BATCH 1"], H,
    row(1, "HANSARI"), row(2, null, "Jl. Y, Tebet"), row(3, "IRFAN"), row(4, "SIAPA"), row(5, "BATCH 2"), row(6, null),
    row(7, "PICK UP OUTLET / LALAMOVE", "Pickup: Outlet Menteng"), row(8, null, "Jl. Z, Pluit")]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const kur = [{ id: "h", name: "HANSARI", origin_id: "ck" }, { id: "i", name: "IRPAN", origin_id: "ck" }, { id: "f", name: "FIKRI NUR", origin_id: "ck" }];
  const o = Object.fromEntries(buildOrders(readSheets(XLSX, wb).rows, [{ id: "ck" }], kur).orders.map(x => [x.code, x]));
  assert.deepEqual([o.G1.courierForced, o.G2.courierForced, o.G3.courierForced, o.G4.courierForced], ["h", "h", "i", null]);
  assert.deepEqual([o.G1.batchReq, o.G3.batchReq, o.G5.batchReq, o.G6.batchReq], [1, 1, 2, 2]);
  assert.ok(o.G4.issues.some(([, m]) => /SIAPA/.test(m)));
  assert.deepEqual([o.G7.via, o.G8.via, o.G8.courierForced], ["pickup", "lalamove", null]);
  assert.equal(matchCourier("FIKRI", kur).id, "f"); assert.equal(matchCourier("AZIS", kur), null);
});

test("Pembagian otomatis OFF: kurir & urutan ikut Excel, tanpa driver tidak dibagi", () => {
  const r = buildOrders(["Kemang", "Tebet", "Pluit", "Sunter"].map((a, i) => ({ gd: "G" + i, date: "09/11/2026", sender: "S", recipient: "R" + i, address: "Jl. X, " + a, item: "Kue" })));
  const [o0, o1, o2, o3] = r.orders; o2.courierForced = "k1"; o0.courierForced = "k1"; o1.courierForced = "zzz";
  const P = plan(r.orders, { ck: { lat: -6.1525, lng: 106.8345 } }, [{ id: "k1", origin_id: "ck", active: true }, { id: "k2", origin_id: "ck", active: true }], {}, false).ck[1];
  assert.deepEqual(P.routes.k1.seq.map(o => o.code), ["G0", "G2"]);
  assert.equal(P.routes.k2.seq.length, 0);
  assert.deepEqual(P.un.map(o => o.code), ["G1", "G3"]);
});
