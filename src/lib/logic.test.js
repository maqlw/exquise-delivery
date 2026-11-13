import { test } from "node:test";
import assert from "node:assert/strict";
import { normPhone, parseDeadline, parseDate, geocode, buildOrders, plan, status } from "./logic.js";

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
