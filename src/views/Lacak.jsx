import { useEffect, useState } from "react";
import MapSVG from "../components/MapSVG.jsx";
import { Pill, Phone, Empty, Timeline, StatusPill } from "../components/ui.jsx";
import { HistoryList, WaBubbles } from "../components/OrderModals.jsx";
import { VIA, status, hhmm, dmy, fmtTime, km, minutes, TUNE } from "../lib/logic.js";
import { trackUrl, addressHistory, waLogs } from "../lib/api.js";

export const copy = (text, toast) => navigator.clipboard?.writeText(text).then(() => toast("Link disalin"), () => toast("Salin manual: " + text));

function courierInfo(P, couriers, routes, o) {
  for (const c of couriers) for (const b of [1, 2, 3]) { const r = P[c.origin_id]?.[b]?.routes[c.id];
    if (r?.seq.includes(o)) return { c, b, r, route: routes.find(x => x.courier_id === c.id && x.batch === b) }; }
  return {};
}

function Detail({ o, ctx }) {
  const { P, couriers, routes, positions, origins, toast, act, setUi, ui } = ctx;
  const [hist, setHist] = useState([]), [wa, setWa] = useState([]);
  useEffect(() => { addressHistory(o.id).then(setHist).catch(() => {}); waLogs(o.id).then(setWa).catch(() => {}); }, [o.id, o.ship]);
  const s = status(o), info = courierInfo(P, couriers, routes, o), started = info.route?.started_at && !info.route?.finished_at, pos = started ? positions[info.c.id] : null;
  let eta = info.r ? info.r.eta[o.code] : null, ahead = 0;
  if (s === "jalan" && pos) { let m = 0, p = pos;
    for (const q of info.r.seq.filter(x => x.ship === "jalan")) { m += minutes(km(p, q), info.b); if (q === o) break; m += TUNE.stop; p = q; ahead++; }
    const now = new Date(); eta = now.getHours() * 60 + now.getMinutes() + m; }
  const sent = ["jalan", "sampai", "gagal"].includes(o.ship);
  const steps = [
    ["Pesanan dikonfirmasi", dmy(o.ymd), "done"],
    ["Kue dikemas, rute disusun", info.c ? `Kurir ${info.c.name} · Batch ${info.b}` : o.via !== "internal" ? `Lewat ${VIA[o.via]}` : "Menunggu rute", sent || o.ship === "siap" ? "done" : "now"],
    ["Kurir berangkat", o.sentAt ? `Jam ${fmtTime(o.sentAt)}` : "", sent ? "done" : ""],
    ["Dalam perjalanan", s === "jalan" ? (pos ? (ahead ? `${ahead} pengiriman lagi sebelum pesanan ini` : "Tujuan berikutnya kurir") : "Kurir menuju alamat") : "", s === "jalan" ? "now" : ["sampai", "gagal"].includes(s) ? "done" : ""],
    s === "gagal" ? ["Gagal kirim", o.failReason || "", "fail"] : ["Pesanan sampai", o.doneAt ? `Jam ${fmtTime(o.doneAt)} · diterima ${o.receivedBy} (${o.receivedRel})` : "", s === "sampai" ? "done" : ""],
  ];
  const info2 = [["Kode", <span className="mono">{o.code}</span>], ["Pemesan", <>{o.sender}{o.phoneSender && <> · <span className="mono">{o.phoneSender}</span></>}</>],
    ["Penerima", <>{o.recipient}{o.phone ? <> · <span className="mono">{o.phone}</span></> : " · tanpa No HP"}</>], ["Alamat", o.address], ["Item", o.item],
    ...(o.notes ? [["Wording", o.notes]] : []), ["Kiriman", info.c ? `Kurir ${info.c.name} · Batch ${info.b}` : VIA[o.via]], ...(o.deadline != null ? [["Request jam", hhmm(o.deadline)]] : []),
    ...(o.receivedBy ? [["Diterima oleh", <>{o.receivedBy} <Pill s="ok">{o.receivedRel}</Pill></>]] : [])];
  const link = trackUrl(o.token);
  return (<>
    <button className="btn ghost sm only-m" onClick={() => setUi({ ...ui, lacak: null })}>← Daftar pesanan</button>
    <section className="panel"><div className="row between"><div><h2>{o.recipient}</h2><p className="sub">{o.item} · dari {o.sender}</p></div><StatusPill o={o} /></div>
      {s === "jalan" ? <div className="etabig">{eta != null ? hhmm(eta) : "–"} <small>perkiraan tiba</small></div>
        : s === "sampai" ? <div className="etabig" style={{ color: "var(--ok)" }}>Sampai</div> : s === "gagal" ? <div className="etabig" style={{ color: "var(--bad)" }}>Gagal kirim</div>
        : <div className="etabig">{eta != null ? hhmm(eta) : "–"} <small>rencana tiba</small></div>}
      <Timeline steps={steps} />
      <div className="row"><button className="btn primary sm" onClick={() => act.update(o)}>Update</button><button className="btn ghost sm" onClick={() => act.edit(o)}>Edit</button></div></section>
    <section className="panel"><h2>Informasi pesanan</h2><dl className="info">{info2.map(([k, v]) => [<dt key={k + "t"}>{k}</dt>, <dd key={k + "d"}>{v}</dd>])}</dl>
      {o.proof && <div><div className="lbl">Foto bukti terima</div><a href={o.proof} target="_blank" rel="noopener"><img className="proof" src={o.proof} alt="Foto bukti terima" /></a></div>}
      <div><div className="lbl">Link lacak</div><div className="linkbox"><code>{link}</code><button className="btn ghost sm" onClick={() => copy(link, toast)}>Salin link</button></div>
        {!o.phone && <p className="note" style={{ marginTop: 6 }}>Penerima tidak punya No HP. Bagikan link ini manual ke nomor yang ada.</p>}</div>
      {o.via !== "internal" && o.via !== "pickup" && (o.link ? <a className="btn primary" href={o.link} target="_blank" rel="noopener">Lacak driver di {VIA[o.via]}</a> : <div className="banner warn">Link tracking {VIA[o.via]} belum ditempel di Dispatch.</div>)}</section>
    {o.lat != null && <section className="panel"><h2>Posisi kurir</h2>
      <MapSVG origin={origins[o.origin]} routes={[{ color: info.c?.color || "var(--accent)", pts: [o], pos: s === "jalan" ? pos : null }]} label={false} title="Posisi kurir dan alamat tujuan" />
      <p className="note">{s === "jalan" && pos ? `Titik hitam = posisi kurir, terakhir diperbarui ${fmtTime(pos.updated_at)}.` : "Posisi kurir tampil saat pesanan dalam perjalanan."} Alamat penerima lain tidak pernah ditampilkan ke customer.</p></section>}
    {hist.length > 0 && <section className="panel"><h2>Riwayat perubahan alamat</h2><HistoryList items={hist} /></section>}
    {wa.length > 0 && <section className="panel"><h2>Riwayat WhatsApp</h2><div className="wa"><WaBubbles logs={wa} /></div></section>}
  </>);
}

export default function Lacak(ctx) {
  const { orders, P, couriers, routes, ui, setUi } = ctx;
  if (!orders.length) return <Empty title="Belum ada pengiriman" desc="Upload file Excel atau tambah pesanan manual dulu."><a className="btn primary" href="#upload">Ke Data pengiriman</a></Empty>;
  const sel = orders.find(o => o.id === ui.lacak), q = ui.q.toLowerCase();
  const rows = orders.filter(o => !q || (o.code + " " + o.recipient + " " + o.sender + " " + (o.phone || "")).toLowerCase().includes(q));
  return (<>
    <h1>Lacak pesanan</h1><p className="sub">Cari pesanan, lalu klik untuk melihat alurnya, posisi kurir, dan detail lainnya.</p>
    <div className={`lacak ${sel ? "has-sel" : ""}`}>
      <section className="panel list"><input type="search" placeholder="Cari kode, penerima, pemesan, atau No HP" value={ui.q} onChange={e => setUi({ ...ui, q: e.target.value })} aria-label="Cari pesanan" />
        <div className="tablewrap"><table className="rtable ltable"><thead><tr><th>Kode</th><th>Penerima</th><th>Pemesan</th><th>Status</th><th>Kiriman</th><th /></tr></thead><tbody>
          {rows.map(o => { const info = courierInfo(P, couriers, routes, o); return (
            <tr key={o.id} className={sel === o ? "sel" : ""} onClick={() => setUi({ ...ui, lacak: o.id })}>
              <td data-label="Kode"><span className="mono">{o.code}</span></td><td data-label="Penerima"><div className="addr">{o.recipient}</div><Phone p={o.phone} /></td>
              <td data-label="Pemesan">{o.sender}</td><td data-label="Status"><StatusPill o={o} /></td><td data-label="Kiriman">{info.c ? info.c.name : VIA[o.via]}</td>
              <td data-label=""><button className="btn ghost sm" onClick={e => { e.stopPropagation(); setUi({ ...ui, lacak: o.id }); }}>Lihat</button></td></tr>); })}
          {!rows.length && <tr><td colSpan="6" className="meta">Tidak ada pesanan yang cocok.</td></tr>}</tbody></table></div></section>
      <div className="detail stack">{sel ? <Detail o={sel} ctx={ctx} key={sel.id} /> : <section className="panel empty"><h2>Pilih pesanan</h2><p className="sub">Klik salah satu baris di daftar untuk melihat detailnya.</p></section>}</div>
    </div>
  </>);
}
