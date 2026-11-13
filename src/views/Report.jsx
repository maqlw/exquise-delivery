import { useEffect, useState } from "react";
import { reportOrders } from "../lib/api.js";
import { LABEL, VIA, dmy, todayYmd, nearestWil } from "../lib/logic.js";

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function preset(k) {
  const t = new Date(), y = t.getFullYear(), m = t.getMonth();
  if (k === "today") return [todayYmd(), todayYmd()];
  if (k === "7") return [ymd(new Date(y, m, t.getDate() - 6)), todayYmd()];
  if (k === "month") return [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))];
  if (k === "last") return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))];
}
const PRESETS = [["today", "Hari ini"], ["7", "7 hari"], ["month", "Bulan ini"], ["last", "Bulan lalu"]];
// Daerah diambil dari kelurahan terdekat ke titik peta, jadi data lama (area umum) dan baru dikelompokkan sama.
const LEVELS = [["d", "Kecamatan", w => `${w.d}, ${w.c}`], ["c", "Kota", w => w.c], ["v", "Kelurahan", w => w.name]];
const count = (list, key) => Object.entries(list.reduce((m, o) => { const k = key(o); if (k) m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);

export default function Report({ origins }) {
  const [range, setRange] = useState(preset("month")), [rows, setRows] = useState(null), [err, setErr] = useState(""), [lvl, setLvl] = useState("d");
  useEffect(() => {
    if (!range[0] || !range[1] || range[0] > range[1]) return;
    setRows(null); setErr("");
    reportOrders(...range).then(setRows).catch(e => setErr(e.message));
  }, [range[0], range[1]]);
  const active = PRESETS.find(([k]) => preset(k).join() === range.join())?.[0];
  const head = (<>
    <h1>Laporan</h1><p className="sub">Rekap pengiriman berdasarkan tanggal kirim.</p>
    <div className="row" style={{ marginTop: 16, alignItems: "center", gap: 12 }}>
      <div className="seg" role="group" aria-label="Rentang cepat">{PRESETS.map(([k, t]) => <button key={k} aria-pressed={active === k} onClick={() => setRange(preset(k))}>{t}</button>)}</div>
      <div className="daterange" role="group" aria-label="Rentang tanggal">
        <label className="dr-f"><span>Dari</span><input type="date" value={range[0]} max={range[1]} onChange={e => setRange([e.target.value, range[1]])} /></label>
        <span className="dr-arrow" aria-hidden="true">→</span>
        <label className="dr-f"><span>Sampai</span><input type="date" value={range[1]} min={range[0]} onChange={e => setRange([range[0], e.target.value])} /></label></div></div></>);
  if (err) return <>{head}<div className="banner bad" style={{ marginTop: 12 }}>Gagal memuat laporan: {err}</div></>;
  if (!rows) return <>{head}<p className="sub" style={{ marginTop: 16 }}><span className="spin" /> Memuat…</p></>;
  const st = o => o.via === "pickup" ? "pickup" : ["sampai", "gagal", "jalan"].includes(o.status) ? o.status : o.via !== "internal" ? "pihak3" : "proses";
  const by = Object.fromEntries(count(rows, st)), mapped = rows.filter(o => o.lat != null && o.via !== "pickup").map(o => ({ ...o, w: nearestWil(o.lat, o.lng) }));
  const durs = rows.filter(o => o.status === "sampai" && o.sent_at && o.delivered_at).map(o => (new Date(o.delivered_at) - new Date(o.sent_at)) / 60000).filter(m => m > 0 && m < 600);
  const avg = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : null;
  const days = count(rows, o => o.ship_date).sort((a, b) => a[0] < b[0] ? -1 : 1), dmax = Math.max(1, ...days.map(d => d[1]));
  const areas = count(mapped, o => LEVELS.find(l => l[0] === lvl)[2](o.w)), amax = Math.max(1, ...areas.map(a => a[1]));
  return (<>
    {head}
    <p className="note" style={{ marginTop: 8 }}>{dmy(range[0])}{range[0] !== range[1] ? ` – ${dmy(range[1])}` : ""} · {rows.length} pesanan</p>
    <div className="kpis" style={{ marginTop: 12 }}>
      <div className="kpi"><span>Total pesanan</span><b>{rows.length}</b></div>
      <div className="kpi ok"><span>Sampai</span><b>{by.sampai || 0}</b></div>
      <div className={`kpi ${by.gagal ? "bad" : ""}`}><span>Gagal kirim</span><b>{by.gagal || 0}</b></div>
      <div className="kpi"><span>Rata-rata kirim → sampai</span><b>{avg != null ? `${avg} mnt` : "–"}</b></div></div>
    <div className="grid" style={{ marginTop: 16 }}><div className="stack">
      <section className="panel"><h2>Daerah tujuan terbanyak</h2>
        <div className="seg" role="group" aria-label="Tingkat daerah">{LEVELS.map(([k, t]) => <button key={k} aria-pressed={lvl === k} onClick={() => setLvl(k)}>{t}</button>)}</div>
        {areas.length ? <ol className="bars">{areas.slice(0, 15).map(([a, n], i) => <li key={a}><span className="bl"><b>{i + 1}.</b> {a}</span><span className="bt"><i style={{ width: `${100 * n / amax}%` }} /></span><span className="bn">{n}</span></li>)}</ol>
          : <p className="note">Belum ada alamat yang punya titik peta di rentang ini.</p>}
        {rows.length - mapped.length - (by.pickup || 0) > 0 && <p className="note">{rows.length - mapped.length - (by.pickup || 0)} alamat belum punya titik peta, tidak ikut dihitung.</p>}</section>
      <section className="panel"><h2>Rincian per cara kirim</h2>
        <div className="tablewrap"><table className="rtable ltable"><thead><tr><th>Cara kirim</th><th>Pesanan</th><th>Sampai</th><th>Gagal</th><th>Belum selesai</th><th>% sampai</th><th>Ongkir</th></tr></thead><tbody>
          {Object.entries(VIA).map(([k, t]) => { const l = rows.filter(o => o.via === k); if (!l.length) return null;
            const ok = l.filter(o => o.status === "sampai").length, bad = l.filter(o => o.status === "gagal").length, fee = l.filter(o => o.llm_price && o.llm_status !== "CANCELED").reduce((a, o) => a + +o.llm_price, 0);
            return (<tr key={k}><td data-label="Cara kirim"><b>{t}</b></td><td data-label="Pesanan" className="mono">{l.length}</td><td data-label="Sampai" className="mono">{ok}</td><td data-label="Gagal" className="mono">{bad}</td>
              <td data-label="Belum selesai" className="mono">{l.length - ok - bad}</td><td data-label="% sampai" className="mono">{Math.round(100 * ok / l.length)}%</td>
              <td data-label="Ongkir" className="mono">{k === "lalamove" ? (fee ? `Rp ${fee.toLocaleString("id-ID")}` : "–") : k === "internal" ? "kurir sendiri" : k === "pickup" ? "–" : "dicatat di aplikasinya"}</td></tr>); })}
        </tbody></table></div>
        <p className="note">Ongkir Lalamove dihitung dari order yang dipesan lewat aplikasi ini (tidak termasuk yang dibatalkan). GoSend dan Grab masih dipesan manual, jadi ongkirnya belum tercatat.</p></section>
      {days.length > 1 && <section className="panel"><h2>Per hari</h2><ol className="bars">{days.map(([d, n]) => <li key={d}><span className="bl">{dmy(d)}</span><span className="bt"><i style={{ width: `${100 * n / dmax}%` }} /></span><span className="bn">{n}</span></li>)}</ol></section>}
    </div><div className="stack">
      <section className="panel"><h2>Peta sebaran</h2><BubbleMap pts={mapped} origins={Object.values(origins)} /><p className="note">Lingkaran makin besar = makin banyak kiriman ke kecamatan itu. Kotak hitam = lokasi asal.</p></section>
      <section className="panel"><h2>Status & cara kirim</h2><ol className="bars">
        {[["sampai", LABEL.sampai], ["gagal", LABEL.gagal], ["jalan", LABEL.jalan], ["proses", "Belum dikirim"], ["pihak3", "Pihak ketiga"], ["pickup", "Pick up"]].map(([k, t]) => <li key={k}><span className="bl">{t}</span><span className="bt"><i style={{ width: `${100 * (by[k] || 0) / Math.max(1, rows.length)}%` }} /></span><span className="bn">{by[k] || 0}</span></li>)}</ol>
        <h3 style={{ marginTop: 12 }}>Per lokasi asal</h3><ol className="bars">{count(rows, o => origins[o.origin_id]?.short || o.origin_id).map(([k, n]) => <li key={k}><span className="bl">{k}</span><span className="bt"><i style={{ width: `${100 * n / rows.length}%` }} /></span><span className="bn">{n}</span></li>)}</ol>
        <h3 style={{ marginTop: 12 }}>Per cara kirim</h3><ol className="bars">{count(rows, o => VIA[o.via] || o.via).map(([k, n]) => <li key={k}><span className="bl">{k}</span><span className="bt"><i style={{ width: `${100 * n / rows.length}%` }} /></span><span className="bn">{n}</span></li>)}</ol></section>
    </div></div>
  </>);
}

// Lingkaran per kecamatan di atas grid ±1 km (tanpa ubin peta), sama gaya dengan peta rute.
function BubbleMap({ pts, origins }) {
  const groups = Object.values(pts.reduce((m, o) => { const k = LEVELS[0][2](o.w); (m[k] ||= { k, n: 0, lat: 0, lng: 0 }); m[k].n++; m[k].lat += o.lat; m[k].lng += o.lng; return m; }, {})).map(g => ({ ...g, lat: g.lat / g.n, lng: g.lng / g.n }));
  const all = [...groups, ...origins];
  if (!groups.length) return <p className="note">Belum ada data.</p>;
  const W = 600, H = 440, pad = 40, kx = Math.cos(-6.2 * Math.PI / 180), xs = all.map(p => p.lng * kx), ys = all.map(p => p.lat);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * (W / H), 0.05), s = (W - 2 * pad) / span;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2, P = p => [W / 2 + (p.lng * kx - cx) * s, H / 2 - (p.lat - cy) * s];
  const nmax = Math.max(...groups.map(g => g.n)), top = new Set(groups.sort((a, b) => b.n - a.n).slice(0, 5).map(g => g.k));
  return (<svg className="map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Peta sebaran kiriman per kecamatan">
    {groups.map(g => { const [x, y] = P(g); const r = 6 + 22 * Math.sqrt(g.n / nmax); return (<g key={g.k}>
      <circle cx={x} cy={y} r={r} style={{ fill: "var(--accent)", opacity: 0.35, stroke: "var(--accent)", strokeWidth: 1.5 }}><title>{`${g.k}: ${g.n} kiriman`}</title></circle>
      {top.has(g.k) && <text x={x} y={y - r - 4} textAnchor="middle" style={{ fill: "var(--ink)", font: "600 11px var(--f-body)" }}>{g.k.split(", ")[0]} · {g.n}</text>}</g>); })}
    {origins.map(o => { const [x, y] = P(o); return <g key={o.id}><rect x={x - 8} y={y - 8} width="16" height="16" rx="4" style={{ fill: "var(--ink)" }} /><text x={x} y={y + 22} textAnchor="middle" style={{ fill: "var(--ink)", font: "700 10px var(--f-mono)" }}>{o.short}</text></g>; })}
  </svg>);
}
