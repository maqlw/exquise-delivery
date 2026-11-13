import MapSVG from "../components/MapSVG.jsx";
import { Pill, Empty, initials } from "../components/ui.jsx";
import { BATCH, VIA, status, hhmm, fmtKm, dmy, returnLabel } from "../lib/logic.js";

const Mini = ({ vals, color }) => { const m = Math.max(1, ...vals); return <span className="mini" aria-hidden="true">{vals.map((v, i) => <i key={i} style={{ height: 8 + 36 * v / m, background: color(i) }} />)}</span>; };

function HourChart({ rows, batch }) {
  const W = 640, H = 236, L = 34, B = 30, T = 30, top = Math.ceil(Math.max(4, ...rows.map(r => r.n)) / 4) * 4;
  const bw = (W - L - 8) / rows.length, Y = v => H - B - (H - B - T) * v / top, peak = rows.reduce((a, r) => r.n > a.n ? r : a, rows[0]);
  const inB = h => h * 60 >= BATCH[batch].start && h * 60 < BATCH[batch].end, pi = rows.indexOf(peak), px = Math.max(L + 44, L + pi * bw + bw / 2), py = Y(peak.n) - 12;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Jumlah alamat per jam perkiraan tiba">
      {[0, top / 4, top / 2, 3 * top / 4, top].map(t => <g key={t}><line x1={L} x2={W} y1={Y(t)} y2={Y(t)} style={{ stroke: "#edf1ee" }} /><text x={L - 8} y={Y(t) + 4} textAnchor="end" style={{ fill: "#8a978e", font: "500 11px var(--f-body)" }}>{t}</text></g>)}
      {rows.map((r, i) => { const x = L + i * bw + bw * 0.28, w = bw * 0.44, y = Y(r.n); return (
        <g key={r.h}><rect x={x} y={y} width={w} height={Math.max(0, H - B - y)} rx={Math.min(6, w / 2)} style={{ fill: inB(r.h) ? "var(--accent-hi)" : "#d5ddd7" }} />
          <text x={x + w / 2} y={H - 10} textAnchor="middle" style={{ fill: "#8a978e", font: "500 11px var(--f-body)" }}>{String(r.h).padStart(2, "0")}.00</text></g>); })}
      {peak.n > 0 && <g><rect x={px - 40} y={py - 20} width="80" height="24" rx="8" style={{ fill: "#0f1b13" }} /><text x={px} y={py - 4} textAnchor="middle" style={{ fill: "#fff", font: "700 12px var(--f-display)" }}>{peak.n} alamat</text></g>}
    </svg>
  );
}

export default function Dashboard({ orders, origins, couriers, P, date, dates, setDate, ui, setUi, positions, routes }) {
  const top = (
    <div className="topbar"><h1>Dashboard</h1><div className="grow" />
      <label className="datepill"><i />Kirim <select value={date} onChange={e => setDate(e.target.value)} aria-label="Tanggal kirim" style={{ border: 0, background: "transparent", fontWeight: 600 }}>{[...new Set([date, ...dates])].map(d => <option key={d} value={d}>{dmy(d)}</option>)}</select></label>
      <a className="btn primary" href="#upload">Upload Excel</a></div>);
  if (!orders.length) return <>{top}<Empty title="Belum ada pengiriman di tanggal ini" desc="Upload file Excel atau tambah pesanan manual di menu Data pengiriman."><a className="btn primary" href="#upload">Ke Data pengiriman</a></Empty></>;
  const oid = ui.origin, b = ui.batch, org = origins[oid], active = couriers.filter(c => c.active);
  const routed = [];
  for (const k in origins) for (const x of [1, 2, 3]) for (const c of active.filter(c => c.origin_id === k)) { const r = P[k][x].routes[c.id]; r?.seq.forEach(o => routed.push({ o, eta: r.eta[o.code], c, b: x })); }
  const dl = routed.filter(x => x.o.deadline != null), onTime = dl.filter(x => x.eta <= x.o.deadline).length, pct = dl.length ? Math.round(onTime / dl.length * 100) : 100;
  const all = Object.keys(origins).flatMap(k => [1, 2, 3].flatMap(x => Object.values(P[k][x].routes))).filter(r => r.seq.length);
  const totalKm = all.reduce((a, r) => a + r.km, 0), nActive = new Set(routed.map(x => x.c.id)).size;
  const hours = Array.from({ length: 10 }, (_, i) => 7 + i).map(h => ({ h, n: routed.filter(x => Math.floor(Math.round(x.eta) / 60) === h).length }));
  const n = s => orders.filter(o => status(o) === s).length, carry = orders.filter(o => o.carry).length;
  const started = id => routes.some(r => r.courier_id === id && r.batch === b && r.started_at && !r.finished_at);
  return (<>
    {top}
    <div className="dash">
      <div className="kc dark"><div><div className="lab">Pengiriman hari ini</div><div className="big">{orders.length} <small>pesanan</small></div><div className="chg"><b>{routed.length}</b> dirute kurir · {carry} carry over</div></div><Mini vals={[1, 2, 3].map(x => routed.filter(y => y.b === x).length)} color={() => "var(--accent-hi)"} /></div>
      <div className="kc"><div><div className="lab">Tepat waktu (rencana)</div><div className="big">{pct}<small>/100%</small></div><div className="chg"><b className={pct < 95 ? "down" : ""}>{onTime} dari {dl.length}</b> alamat ber-request jam</div></div><Mini vals={Object.keys(origins).map(k => routed.filter(y => y.o.origin === k).length)} color={i => i === 0 ? "var(--accent)" : "#d5ddd7"} /></div>
      <div className="kc"><div><div className="lab">Total jarak rencana</div><div className="big">{fmtKm(totalKm).replace(" km", "")} <small>km</small></div><div className="chg"><b>{nActive}</b> kurir aktif · {fmtKm(nActive ? totalKm / nActive : 0)} per kurir</div></div><Mini vals={all.slice(0, 6).map(r => r.km)} color={() => "var(--accent)"} /></div>
      <section className="chartcard span2"><div className="row between"><h2>Perkiraan jam tiba</h2>
        <div className="seg" role="group" aria-label="Sorot batch">{[1, 2, 3].map(x => <button key={x} aria-pressed={x === b} onClick={() => setUi({ ...ui, batch: x })}>Batch {x}</button>)}</div></div>
        <HourChart rows={hours} batch={b} /><p className="note">Jumlah alamat per jam perkiraan tiba, semua lokasi asal. Batang hijau = jam Batch {b} ({BATCH[b].label}).</p></section>
      <section className="sage"><div><div className="big">{n("sampai")} <small>/ {orders.length} sampai</small></div><div className="meta" style={{ color: "#56705c" }}>{n("jalan")} sedang dalam perjalanan</div></div><hr />
        {[[n("siap") + n("draft"), "Siap & menunggu rute", "kurir internal"], [n("cek"), "Perlu dicek", "alamat belum ketemu di peta"], [n("pihak3"), "Pihak ketiga", "Lalamove, GoSend, Grab"], [n("pickup") + n("gagal"), "Pick up & gagal kirim", `${n("pickup")} pick up · ${n("gagal")} gagal`]].map(([v, t, d]) =>
          <div className="srow" key={t}><span className="ico">{v}</span><div><b>{t}</b><span>{d}</span></div></div>)}</section>
      <section className="chartcard span2"><div className="row between"><h2>Cara kirim hari ini</h2><a className="btn ghost" href="#laporan">Detail di Laporan</a></div>
        <ol className="bars">{Object.entries(VIA).map(([k, t]) => { const list = orders.filter(o => o.via === k), done = list.filter(o => o.ship === "sampai").length; return (
          <li key={k}><span className="bl">{t}</span><span className="bt"><i style={{ width: `${100 * list.length / orders.length}%` }} /></span><span className="bn">{list.length}</span></li>); })}</ol>
        <p className="note">{Object.entries(VIA).filter(([k]) => orders.some(o => o.via === k)).map(([k, t]) => `${t}: ${orders.filter(o => o.via === k && o.ship === "sampai").length} sampai`).join(" · ")}
          {orders.some(o => o.llm?.price && o.llm.status !== "CANCELED") && ` · Ongkir Lalamove Rp ${orders.filter(o => o.llm?.price && o.llm.status !== "CANCELED").reduce((a, o) => a + +o.llm.price, 0).toLocaleString("id-ID")}`}</p></section>
      <section className="chartcard span2"><div className="row between"><h2>Kurir hari ini</h2><a className="btn ghost" href="#dispatch">Buka Dispatch</a></div>
        <div style={{ overflowX: "auto" }}><table className="ctable"><thead><tr><th>Kurir</th><th>Alamat</th><th>B1 · B2 · B3</th><th>Progres</th><th>Status</th><th style={{ textAlign: "right" }}>Jarak</th></tr></thead><tbody>
          {active.map(c => { const mine = routed.filter(x => x.c.id === c.id); if (!mine.length) return null;
            const rs = [1, 2, 3].map(x => P[c.origin_id][x].routes[c.id]), kmN = rs.reduce((a, r) => a + r.km, 0), late = rs.reduce((a, r) => a + r.late, 0);
            const done = mine.filter(x => ["sampai", "gagal"].includes(x.o.ship)).length, going = mine.some(x => x.o.ship === "jalan"), sentAny = mine.some(x => x.o.ship);
            const st = going ? ["jalan", "Dalam perjalanan"] : done === mine.length ? (returnLabel(routes.filter(x => x.courier_id === c.id).sort((p, q) => q.batch - p.batch)[0]) || ["sampai", "Selesai"]) : sentAny ? ["siap", "Siap berangkat"] : ["", "Menunggu rute"];
            return (<tr key={c.id}><td><div className="who-cell"><span className="avatar" style={{ background: c.color }}>{initials(c.name)}</span><div><div className="addr">{c.name}</div><div className="meta">{origins[c.origin_id].short}</div></div></div></td>
              <td className="mono">{mine.length}</td><td className="mono" style={{ whiteSpace: "nowrap" }}>{[1, 2, 3].map(x => mine.filter(y => y.b === x).length).join(" · ")}</td>
              <td><div className="row" style={{ gap: 10 }}><span className="prog"><i style={{ width: `${Math.round(done / mine.length * 100)}%` }} /></span><span className="mono">{done}/{mine.length}</span></div></td>
              <td><Pill s={st[0]}>{st[1]}</Pill>{late > 0 && <> <Pill s="late">{late} terlambat</Pill></>}</td><td className="mono" style={{ textAlign: "right" }}>{fmtKm(kmN)}</td></tr>); })}
        </tbody></table></div></section>
      <section className="darkcard"><div className="row between"><h2>Peta rute</h2><span className="pill" style={{ background: "#fff", color: "#121a15" }}>{org.short} · B{b}</span></div>
        <MapSVG origin={org} routes={active.filter(c => c.origin_id === oid).map(c => { const r = P[oid][b].routes[c.id]; return { color: c.color, pts: r.seq, doneN: r.seq.filter(o => ["sampai", "gagal"].includes(o.ship)).length, pos: started(c.id) && positions[c.id] ? positions[c.id] : null }; })} />
        <div className="legend">{active.filter(c => c.origin_id === oid).map(c => <span key={c.id}><span className="dot" style={{ background: c.color }} /> {c.name}</span>)}</div></section>
    </div>
  </>);
}
