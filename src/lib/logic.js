// Logika murni (tanpa React/Supabase): dipakai di browser dan di tes node.
import WILAYAH from "./wilayah.js";
export const BATCH = { 1: { start: 420, end: 660, label: "07.00–11.00" }, 2: { start: 660, end: 840, label: "11.00–14.00" }, 3: { start: 840, end: 1020, label: "14.00–17.00" } };
export const CAP = 16, ROAD_FACTOR = 1.35; // shortcut: jarak garis lurus x faktor jalan, ganti ke Google Routes API setelah key tersedia
// Kecepatan rata-rata (km/jam) per batch dan menit berhenti per alamat; diisi dari Pengaturan saat aplikasi dimuat.
export const TUNE = { speed: { 1: 15, 2: 18, 3: 15 }, stop: 10 };
export const VIA = { internal: "Kurir internal", lalamove: "Lalamove", gosend: "GoSend", grab: "GrabExpress", pickup: "Pick up" };
export const REL = ["Penerima langsung", "Keluarga / saudara", "Rekan kerja", "Satpam / resepsionis", "Tetangga", "Lainnya"];
export const FAIL_REASONS = ["Penerima tidak ada", "Alamat tidak ditemukan", "Ditolak penerima", "Akses gedung ditutup", "Lainnya"];
export const LABEL = { err: "Error", pickup: "Pick up", pihak3: "Via pihak ketiga", cek: "Perlu dicek", draft: "Menunggu rute", siap: "Siap dikirim", jalan: "Dalam perjalanan", sampai: "Sampai", gagal: "Gagal kirim" };
export const AREAS = [
  ["Gading Serpong", /gading serpong/, -6.2405, 106.6300], ["Alam Sutera", /alam sutera/, -6.2240, 106.6520],
  ["BSD", /\bbsd\b|bumi serpong/, -6.3000, 106.6600], ["Serpong", /serpong/, -6.3150, 106.6650],
  ["Bintaro", /bintaro/, -6.2700, 106.7300], ["Pondok Aren", /pondok aren|pondok pucung/, -6.2650, 106.7000],
  ["Cipondoh", /cipondoh/, -6.1830, 106.6900], ["Kelapa Gading", /kelapa gading|gading kirana|\bkgd\b/, -6.1580, 106.9050],
  ["Gunung Sahari", /gunung sahari/, -6.1500, 106.8360], ["Kemayoran", /kemayoran/, -6.1620, 106.8460],
  ["Ancol", /ancol|pademangan/, -6.1270, 106.8320], ["Mangga Dua", /mangga dua/, -6.1370, 106.8230],
  ["Sunter", /sunter/, -6.1400, 106.8680], ["Pluit", /pluit/, -6.1180, 106.7920],
  ["Cempaka Putih", /cempaka putih/, -6.1780, 106.8670], ["Rawamangun", /rawamangun/, -6.1950, 106.8880],
  ["Pulo Gadung", /pulo ?gadung/, -6.1900, 106.9050], ["Senen", /senen|kramat/, -6.1790, 106.8420],
  ["Salemba", /salemba/, -6.1930, 106.8510], ["Matraman", /matraman/, -6.2000, 106.8600],
  ["Menteng", /menteng|cikini|imam bonjol|kebon sirih/, -6.1920, 106.8380], ["Tanah Abang", /tanah abang/, -6.1860, 106.8120],
  ["PIK", /\bpik\b|pantai indah kapuk/, -6.1100, 106.7400], ["Ampera", /ampera/, -6.2900, 106.8150], ["Thamrin", /thamri[nm]/, -6.1900, 106.8230], ["Sudirman", /sudirman/, -6.2150, 106.8180],
  ["Kuningan", /kuningan|gatot subroto|gatsu/, -6.2320, 106.8300], ["Senayan", /senayan|\bdpr\b|\bmpr\b/, -6.2120, 106.7990],
  ["Tebet", /tebet|saharjo/, -6.2290, 106.8540], ["Jatinegara", /jatinegara/, -6.2150, 106.8700],
  ["Cawang", /cawang/, -6.2460, 106.8690], ["Kalibata", /kalibata/, -6.2570, 106.8530],
  ["Duren Sawit", /duren sawit|radin inten/, -6.2320, 106.9170], ["Pasar Rebo", /pasar rebo/, -6.3100, 106.8580],
  ["Pejaten", /pejaten/, -6.2780, 106.8330], ["Kemang", /kemang/, -6.2610, 106.8140],
  ["Cipete", /cipete/, -6.2770, 106.7990], ["Pondok Indah", /pondok indah/, -6.2700, 106.7830],
  ["Fatmawati", /fatmawati|cilandak/, -6.2920, 106.7970], ["Kebayoran Baru", /kebayoran baru|senopati|wijaya/, -6.2430, 106.8000],
  ["Tanjung Duren", /tanjung duren/, -6.1750, 106.7850], ["Kebon Jeruk", /kebon jeruk/, -6.1920, 106.7700],
  ["Grogol", /grogol/, -6.1650, 106.7900], ["Cinere", /cinere/, -6.3350, 106.7840], ["Depok", /depok|margonda/, -6.3730, 106.8320],
].map(([name, re, lat, lng]) => ({ name, re, lat, lng }));
const OUTSIDE = [["Bandung", /bandung/], ["Medan", /\bmedan\b(?!\s*merdeka)/], ["Surabaya", /surabaya/], ["Bogor", /(?<!raya\s)\bbogor\b/], ["Semarang", /semarang/], ["Yogyakarta", /yogya|jogja/]]; // "Jl. Raya Bogor" dan "Medan Merdeka" ada di Jakarta

export const hhmm = m => { const t = Math.round(m); return `${String(Math.floor(t / 60)).padStart(2, "0")}.${String(t % 60).padStart(2, "0")}`; };
export const fmtKm = k => k.toFixed(1).replace(".", ",") + " km";
export const dmy = ymd => ymd ? ymd.split("-").reverse().join("/") : "–";
export const fmtTime = d => d ? new Date(d).toTimeString().slice(0, 5).replace(":", ".") : "";
export const todayYmd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export function km(a, b) {
  const R = 6371, r = d => d * Math.PI / 180, dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * ROAD_FACTOR;
}
export const minutes = (k, b = 2) => k / (TUNE.speed[b] || 18) * 60;
const pathKm = (s, pts) => pts.reduce((acc, q, i) => acc + km(i ? pts[i - 1] : s, q), 0);
export function optimize(start, pts) { // tetangga terdekat lalu 2-opt, rute terbuka
  const left = [...pts], out = []; let cur = start;
  while (left.length) { let bi = 0; left.forEach((p, i) => { if (km(cur, p) < km(cur, left[bi])) bi = i; }); cur = left.splice(bi, 1)[0]; out.push(cur); }
  for (let imp = true; imp;) { imp = false;
    for (let i = 0; i < out.length - 1; i++) for (let k = i + 1; k < out.length; k++) {
      const c = [...out.slice(0, i), ...out.slice(i, k + 1).reverse(), ...out.slice(k + 1)];
      if (pathKm(start, c) + 1e-9 < pathKm(start, out)) { out.splice(0, out.length, ...c); imp = true; }
    } }
  return out;
}
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };
const norm = s => " " + s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " ";
// Kelurahan dengan nama kata umum ("baru", "tengah") sering bukan nama kelurahan di alamat, jadi tidak dicari dari teks.
const SKIP = new Set(["baru", "tengah", "jati", "pulo", "batu", "pasir", "muara", "tegal", "kuta", "daru", "dukuh", "tugu", "waru", "benda", "petir", "kota", "sawah", "kemang"]);
export const WIL = WILAYAH.map(([v, d, c, code, lat, lng]) => ({ v, d, c, code: String(code), lat, lng, name: `${v}, ${d}, ${c}`, label: `${v}, ${d}, ${c} ${code}`, nv: norm(v), nd: norm(d) }));
const CITY = [["Jakarta", /jakarta|\bjkt\b|\bdki\b/], ["Tangerang Selatan", /tangerang selatan|tangsel/], ["Tangerang", /tangerang(?! selatan)/], ["Bekasi", /bekasi/], ["Depok", /depok/], ["Bogor", /(?<!raya |jl\.? |jalan )\bbogor\b/]];
const cityOf = c => c.startsWith("Jakarta") ? "Jakarta" : c;
const centroid = (list, name, how) => ({ name, how, lat: list.reduce((a, r) => a + r.lat, 0) / list.length, lng: list.reduce((a, r) => a + r.lng, 0) / list.length });
// Urutan: kode pos -> kelurahan (dikonfirmasi kecamatan/kota) -> area landmark -> kelurahan saja -> kecamatan.
export const ALIASES = []; // [{k: "bri kck", area: label}] dari Pengaturan, diisi saat aplikasi dimuat
export function geocode(addr) {
  const a = addr.toLowerCase(), n = norm(addr);
  for (const x of ALIASES) if (x.k && n.includes(norm(x.k))) { const g = findArea(x.area); if (g) return { ...g, how: `alamat dikenal "${x.k}"` }; }
  const out = OUTSIDE.find(([, re]) => re.test(a)); if (out) return { name: out[0], out: true };
  const cities = CITY.filter(([, re]) => re.test(a)).map(([c]) => c), cityOk = r => !cities.length || cities.includes(cityOf(r.c));
  const hit = r => !SKIP.has(r.nv.trim()) && r.nv.length > 5 && n.includes(r.nv);
  for (const code of a.match(/\b1[0-7]\d{3}\b/g) || []) {
    const list = WIL.filter(r => r.code === code); if (!list.length) continue;
    const v = list.find(hit) || (list.length === 1 && list[0]);
    return v ? { ...v, how: `kode pos ${code}` } : centroid(list, `${list[0].d}, ${list[0].c}`, `kode pos ${code}`);
  }
  const score = r => r.nv.length + (n.includes(r.nd) ? 100 : 0) + (cities.length ? 50 : 0);
  const vs = WIL.filter(r => hit(r) && cityOk(r)).sort((x, y) => score(y) - score(x));
  if (vs[0] && score(vs[0]) >= 50) return { ...vs[0], how: "kelurahan" };
  const A = AREAS.find(x => x.re.test(a));
  if (A) { const h = hash(a); return { name: A.name, how: "area", lat: A.lat + ((h % 97) / 97) * 0.004, lng: A.lng + (((h >> 8) % 89) / 89) * 0.004 }; } // digeser sedikit supaya tidak menumpuk
  if (vs[0]) return { ...vs[0], how: "kelurahan" };
  const ds = WIL.filter(r => r.nd.length > 5 && n.includes(r.nd) && cityOk(r)).sort((x, y) => (x.d === x.c) - (y.d === y.c)); // "Ciledug" lebih spesifik dari "Tangerang"
  return ds.length ? centroid(ds.filter(r => r.d === ds[0].d), `${ds[0].d}, ${ds[0].c}`, "kecamatan") : null;
}
// Kelurahan terdekat dari titik peta (untuk laporan per kecamatan/kota).
export function nearestWil(lat, lng) { let best = null, bd = Infinity; for (const r of WIL) { const d = (r.lat - lat) ** 2 + ((r.lng - lng) * 0.994) ** 2; if (d < bd) { bd = d; best = r; } } return best; }
// Pilihan area manual: kelurahan (label dengan kode pos) atau nama area landmark.
export function findArea(label) {
  const w = WIL.find(r => r.label === label || r.name === label); if (w) return { ...w, how: "kelurahan dipilih admin" };
  const A = AREAS.find(x => x.name === label); return A && { name: A.name, lat: A.lat, lng: A.lng, how: "area dipilih admin" };
}
export function normPhone(v) {
  if (v == null || String(v).trim() === "") return { p: null };
  const d = String(v).replace(/\D/g, "");
  const p = d.startsWith("62") ? d : d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("8") ? "62" + d : null;
  return p && p.length >= 10 && p.length <= 15 ? { p } : { p: null, bad: true };
}
export function parseDeadline(text) {
  const m = text.match(/(?:jam|maxx?|maks|sebelum|paling lambat)\D{0,8}?(\d{1,2})(?:[.:](\d{2}))?/i);
  if (!m) return null; const h = +m[1], mi = +(m[2] || 0);
  return h >= 6 && h <= 20 ? h * 60 + mi : null;
}
export function parseDate(v) {
  if (v instanceof Date && !isNaN(v)) { const d = new Date(v.getTime() + 12 * 3600e3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
  const m = String(v ?? "").match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

// ---------- baca Excel ----------
export const COLSPEC = [
  ["phoneSender", /^no\.?\s*(hp\s*)?pengirim$/], ["phone", /^phone$|^no\.?\s*(hp\s*)?penerima$/],
  ["gd", /goods delivery number|^no\.?\s*pengiriman/], ["date", /goods delivery date|^tanggal/],
  ["sender", /^sender( name)?$|^pengirim$/], ["recipient", /customer name|^nama$|^penerima$/],
  ["address", /^address$|^alamat$/], ["item", /product|^item$/], ["notes", /^notes$|^wording$/],
  ["origin", /lokasi asal|^origin$/], ["batch", /^batch/], ["via", /kirim via|^via$/],
];
const isHead = r => r.some(c => /goods delivery number|^no\.?\s*pengiriman/i.test(String(c ?? "").trim())) && r.some(c => /^(alamat|address)$/i.test(String(c ?? "").trim()));
export function readSheets(XLSX, wb) {
  let best = null;
  for (const name of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
    const hi = aoa.findIndex(isHead); if (hi < 0) continue;
    const map = {};
    aoa[hi].forEach((c, j) => { const h = String(c ?? "").trim().toLowerCase(); const s = COLSPEC.find(([k, re]) => !(k in map) && re.test(h)); if (s) map[s[0]] = j; });
    const rows = aoa.slice(hi + 1).map(r => Object.fromEntries(Object.entries(map).map(([k, j]) => [k, r[j]])))
      .filter(r => [r.address, r.recipient, r.item].some(v => v != null && String(v).trim() !== ""));
    const score = rows.length + (map.recipient != null && /^nama$/i.test(String(aoa[hi][map.recipient] ?? "").trim()) ? 1e6 : 0); // format Matrix (Sheet1) diutamakan
    if (!best || score > best.score) best = { name, rows, score };
  }
  return best;
}
// Hitung ulang catatan sistem, batas jam, dan titik peta dari isi pesanan.
export function recompute(o) {
  o.issues = (o.issues || []).filter(([, m]) => /Digabung|Carry over|Tanpa nomor GD|Ditambahkan manual/.test(m));
  o.out = false; o.lat = null; o.lng = null; o.area = null;
  if (o.phoneBad) o.issues.push(["warn", "No HP penerima tidak valid"]);
  else if (!o.phone) o.issues.push(["info", "Penerima tanpa No HP, link dibagikan manual"]);
  if (/pick ?up/i.test(o.address)) { o.via = "pickup"; o.issues.push(["info", "Pick up, tidak masuk rute"]); }
  o.deadline = o.reqTime ?? parseDeadline(o.address + " " + (o.notes || ""));
  if (o.reqTime != null) o.issues.push(["info", `Request tiba jam ${hhmm(o.reqTime)}`]);
  else if (o.deadline != null) o.issues.push(["info", `Request jam ${hhmm(o.deadline)} dibaca dari teks`]);
  const A = o.areaManual && findArea(o.areaManual);
  const g = o.via === "pickup" ? null : A || geocode(o.address);
  if (g && g.out) { o.area = g.name; o.out = true; if (o.via === "internal") o.via = "lalamove"; o.issues.push(["warn", `Di luar area kurir (${g.name}), disarankan Lalamove`]); }
  else if (g) { Object.assign(o, { area: g.name, lat: g.lat, lng: g.lng }); o.issues.push(["info", `Titik peta dari ${g.how}`]); }
  else if (o.via !== "pickup") o.issues.push(["warn", "Alamat belum ketemu di peta: tidak ada kode pos, kelurahan, atau kecamatan yang dikenali. Pilih kelurahan"]);
  return o;
}
// Baris Excel -> pesanan. Baris error dikembalikan terpisah dan tidak disimpan.
export function buildOrders(rows, origins = []) {
  const ymds = rows.map(r => parseDate(r.date)).filter(Boolean), freq = {};
  ymds.forEach(d => freq[d] = (freq[d] || 0) + 1);
  const ref = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0] || null;
  let manual = 0; const byGd = {}, out = [], errors = [];
  rows.forEach((r, i) => {
    const t = k => (r[k] == null ? "" : String(r[k]).replace(/\s+/g, " ").trim());
    const o = { gd: t("gd"), ymd: parseDate(r.date), sender: t("sender"), recipient: t("recipient"), address: t("address"), item: t("item"), notes: t("notes"), issues: [], merged: 1 };
    if (o.gd && byGd[o.gd]) { const f = byGd[o.gd]; f.item += " + " + o.item; f.merged++; return; }
    if (!o.recipient || !o.address || !o.item || !o.ymd) { errors.push({ row: i + 1, code: o.gd || "(tanpa nomor)", reason: !o.ymd ? "Tanggal tidak terbaca" : "Penerima, alamat, atau item kosong" }); return; }
    if (!o.gd) { manual++; o.code = `MAN-${(ref || o.ymd).slice(8, 10)}${(ref || o.ymd).slice(5, 7)}-${String(manual).padStart(3, "0")}`; o.issues.push(["info", "Tanpa nomor GD, kode dibuat sistem"]); }
    else o.code = o.gd;
    const ph = normPhone(r.phone); o.phone = ph.p; o.phoneBad = !!ph.bad;
    o.phoneSender = normPhone(r.phoneSender).p;
    if (ref && o.ymd < ref) { o.carry = true; o.issues.push(["warn", `Carry over dari ${dmy(o.ymd)}`]); o.ymd = ref; } // dikirim di hari file ini
    const og = t("origin").toLowerCase(), hit = og && origins.find(x => [x.id, x.short, x.name].some(n => n && (og.includes(n.toLowerCase()) || n.toLowerCase().includes(og))));
    o.origin = hit ? hit.id : (origins.find(x => x.id === "ck") || origins[0])?.id || "ck";
    const b = t("batch").match(/[123]/); o.batchReq = b ? +b[0] : null;
    const v = t("via").toLowerCase(); o.via = /lalamove/.test(v) ? "lalamove" : /gosend|gojek/.test(v) ? "gosend" : /grab/.test(v) ? "grab" : /pick/.test(v) ? "pickup" : "internal";
    o.reqTime = null; o.areaManual = null;
    recompute(o);
    if (o.gd) byGd[o.gd] = o; out.push(o);
  });
  out.forEach(o => { if (o.merged > 1) o.issues.push(["info", `Digabung dari ${o.merged} baris (nomor GD sama)`]); });
  return { orders: out, errors, ref };
}

// ---------- status & perencanaan rute ----------
export function status(o) {
  if (["jalan", "sampai", "gagal"].includes(o.ship)) return o.ship;
  if (o.via === "pickup") return "pickup"; if (o.via !== "internal") return "pihak3";
  if (o.lat == null) return "cek"; return o.ship || "draft";
}
// Status kurir setelah semua alamat selesai: menuju outlet / minta izin pulang / sudah kembali.
export const returnLabel = r => !r || !r.stops_done_at && !r.finished_at ? null
  : r.return_status === "kembali" ? ["sampai", "Sudah kembali"] : r.return_status === "disetujui" ? ["sampai", "Pulang (disetujui)"]
  : r.return_status === "menunggu" ? ["warn", "Minta izin pulang"] : r.finished_at ? ["sampai", "Selesai"] : ["jalan", "Menuju outlet"];
export const routable = o => o.via === "internal" && o.lat != null;
export function batchOf(o) { return o.batchForced || o.batchReq || (o.deadline != null ? (o.deadline <= 660 ? 1 : o.deadline <= 840 ? 2 : 3) : null); }
export function timeline(org, seq, b) {
  let t = BATCH[b].start, p = org, total = 0, late = 0, rested = false; const eta = {};
  for (const o of seq) { const d = km(p, o); total += d; t += minutes(d, b);
    if (b === 2 && !rested && t >= 720) { t += 60; rested = true; } // istirahat 12.00
    eta[o.code] = t; if (o.deadline != null && t > o.deadline) late++; t += TUNE.stop; p = o; }
  return { seq, km: total, end: t, late, eta };
}
function bestRoute(org, stops, b) {
  const a = timeline(org, optimize(org, stops), b);
  const dl = stops.filter(o => o.deadline != null).sort((x, y) => x.deadline - y.deadline);
  if (!dl.length) return a;
  const bRoute = timeline(org, [...dl, ...optimize(dl.at(-1), stops.filter(o => o.deadline == null))], b);
  return a.late < bRoute.late || (a.late === bRoute.late && a.km <= bRoute.km) ? a : bRoute;
}
// origins: {id:{lat,lng}}, couriers: [{id,name,origin_id}], sent: {"origin|batch": {courierId: [orderId...]}}
export function plan(orders, origins, couriers, sent) {
  const out = {}, byId = Object.fromEntries(orders.map(o => [o.id, o]));
  for (const oid in origins) {
    const org = origins[oid], ids = couriers.filter(c => c.origin_id === oid && c.active).map(c => c.id), cap = Math.max(1, ids.length) * CAP;
    const list = orders.filter(o => routable(o) && o.origin === oid);
    const sentIds = new Set(Object.entries(sent).filter(([k]) => k.startsWith(oid + "|")).flatMap(([, v]) => Object.values(v).flat()));
    const byB = { 1: [], 2: [], 3: [] };
    for (const [k, v] of Object.entries(sent)) if (k.startsWith(oid + "|")) Object.values(v).flat().forEach(id => byId[id] && byB[+k.split("|")[1]].push(byId[id]));
    const free = list.filter(o => !sentIds.has(o.id));
    free.forEach(o => { o._b = batchOf(o); if (o._b) byB[o._b].push(o); });
    const open = b => !sent[oid + "|" + b]; // batch yang belum dikirim ke kurir
    free.filter(o => !o._b).sort((x, y) => km(org, x) - km(org, y)).forEach(o => { o._b = [1, 2, 3].find(b => open(b) && byB[b].length < cap) || [1, 2, 3].find(open) || 3; byB[o._b].push(o); });
    // Bagi pesanan ke kurir: yang dipilih admin dulu, sisanya dibagi per arah dari outlet.
    const assign = (L, b) => {
      const res = Object.fromEntries(ids.map(n => [n, []])), routes = {};
      const forced = L.filter(o => ids.includes(o.courierForced)); forced.forEach(o => res[o.courierForced].push(o));
      const rest = L.filter(o => !forced.includes(o));
      const ang = o => Math.atan2(o.lat - org.lat, (o.lng - org.lng) * Math.cos(org.lat * Math.PI / 180));
      rest.sort((x, y) => ang(x) - ang(y));
      const target = Math.ceil(L.length / Math.max(1, ids.length)); let i = 0;
      for (const o of rest) { while (i < ids.length - 1 && res[ids[i]].length >= target) i++; if (ids.length) res[ids[i]].push(o); }
      for (const n of ids) routes[n] = bestRoute(org, res[n], b);
      return routes;
    };
    out[oid] = {};
    for (const b of [1, 2, 3]) {
      const key = oid + "|" + b;
      if (!sent[key]) { out[oid][b] = { routes: assign(byB[b], b), extra: null, count: byB[b].length, sent: false }; continue; }
      const routes = {}, add = byB[b].filter(o => !sentIds.has(o.id));
      for (const id of ids) routes[id] = timeline(org, (sent[key][id] || []).map(x => byId[x]).filter(Boolean), b);
      // Pesanan yang masuk setelah batch dikirim: direncanakan terpisah sebagai "tambahan" (kurir ambil di outlet).
      out[oid][b] = { routes, extra: add.length ? { routes: assign(add, b), count: add.length } : null, count: byB[b].length, sent: true };
    }
  }
  return out;
}
