import { useState } from "react";
import MapSVG from "../components/MapSVG.jsx";
import { Pill, Empty, StopInfo } from "../components/ui.jsx";
import { BATCH, VIA, status, hhmm, fmtKm, dmy, returnLabel } from "../lib/logic.js";
import { updateOrder, sendRoutes, sendExtra, lalamove } from "../lib/api.js";

export default function Dispatch({ orders, origins, couriers, P, date, ui, setUi, reload, toast, routes, positions, act }) {
  const [busy, setBusy] = useState(false);
  if (!orders.length) return <Empty title="Belum ada pengiriman" desc="Upload file Excel atau tambah pesanan manual dulu."><a className="btn primary" href="#upload">Ke Data pengiriman</a></Empty>;
  const oid = ui.origin, b = ui.batch, B = P[oid][b], org = origins[oid], list = couriers.filter(c => c.origin_id === oid && c.active);
  const rs = list.map(c => B.routes[c.id]), totalKm = rs.reduce((a, r) => a + r.km, 0), late = rs.reduce((a, r) => a + r.late, 0);
  const end = Math.max(BATCH[b].start, ...rs.filter(r => r.seq.length).map(r => r.end));
  const cek = orders.filter(o => status(o) === "cek" && o.origin === oid).length, ext = orders.filter(o => status(o) === "pihak3" || (o.via !== "internal" && o.via !== "pickup"));
  const pick = orders.filter(o => o.via === "pickup");
  const save = async (o, p, msg) => { try { await updateOrder(o.id, p); toast(msg); await reload(); } catch (e) { toast("Gagal: " + e.message); } };
  function move(o, v) {
    const [k, x] = v.split(":");
    if (k === "c") save(o, { assigned_courier: x, batch_forced: b }, `${o.recipient} dipindah ke ${couriers.find(c => c.id === x).name}`);
    if (k === "b") save(o, { batch_forced: +x, assigned_courier: null }, `${o.recipient} dipindah ke Batch ${x}`);
    if (k === "v") save(o, { via: x }, `${o.recipient} dikirim lewat ${VIA[x]}`);
  }
  async function send() {
    setBusy(true);
    try { await sendRoutes(date, oid, b, B.routes); await reload(); toast(`Rute Batch ${b} dikirim ke ${rs.filter(r => r.seq.length).length} kurir`); }
    catch (e) { toast("Gagal mengirim rute: " + e.message); }
    setBusy(false);
  }
  async function sendAdd() {
    setBusy(true);
    try { const n = B.extra.count; await sendExtra(date, oid, b, B.extra.routes); await reload(); toast(`${n} alamat tambahan Batch ${b} dikirim ke HP kurir`); }
    catch (e) { toast("Gagal mengirim tambahan: " + e.message); }
    setBusy(false);
  }
  // Kartu per kurir; locked = rute sudah di HP kurir (tidak bisa dipindah/diedit).
  const cards = (R, locked) => <div className="couriers">{list.map(c => { const r = R[c.id]; return (
        <article className="cc" key={c.id}><div className="cc-h"><span className="dot" style={{ background: c.color }} /><b>{c.name}</b><span className="meta">{r.seq.length} alamat · {fmtKm(r.km)}{r.seq.length ? ` · selesai ${hhmm(r.end)}` : ""}</span>{r.late > 0 && <Pill s="late">{r.late} terlambat</Pill>}
          {locked && (x => x && <Pill s={x[0]}>{x[1]}</Pill>)(returnLabel(routes.find(x => x.courier_id === c.id && x.batch === b)))}</div>
          {r.seq.length ? <ol className="stops">{r.seq.map((o, i) => { const e = r.eta[o.code], isLate = o.deadline != null && e > o.deadline; return (
            <li key={o.id}><span className="num" style={{ background: isLate ? "var(--bad)" : c.color }}>{i + 1}</span>
              <div><StopInfo o={o} />
                {locked ? <Pill s={status(o)} /> : <select aria-label={`Pindahkan ${o.code}`} style={{ marginTop: 4, fontSize: 13 }} value="" onChange={e => e.target.value && move(o, e.target.value)}>
                  <option value="">Pindahkan…</option>{list.filter(x => x.id !== c.id).map(x => <option key={x.id} value={"c:" + x.id}>Ke {x.name}</option>)}
                  {[1, 2, 3].filter(x => x !== b).map(x => <option key={x} value={"b:" + x}>Ke Batch {x}</option>)}<option value="v:lalamove">Ke Lalamove</option><option value="v:gosend">Ke GoSend</option><option value="v:grab">Ke GrabExpress</option></select>}
                {!locked && <button className="btn ghost sm" style={{ marginLeft: 6 }} onClick={() => act.edit(o)}>Edit</button>}</div>
              <div className="eta">{hhmm(e)}{o.deadline != null && <Pill s={isLate ? "late" : "ok"}>batas {hhmm(o.deadline)}</Pill>}</div></li>); })}</ol>
            : <p className="note">Tidak ada alamat di batch ini.</p>}</article>); })}</div>;
  const started = id => routes.some(r => r.courier_id === id && r.batch === b && r.started_at && !r.finished_at);
  return (<>
    <h1>Susun pengiriman {dmy(date)}</h1><p className="sub">Sistem mengusulkan pembagian kurir dan urutan antar per lokasi asal dan batch. Pindahkan alamat kalau perlu, lalu kirim rute ke kurir.</p>
    <div className="seg" role="group" aria-label="Lokasi asal" style={{ marginTop: 16 }}>
      {Object.values(origins).map(x => <button key={x.id} aria-pressed={x.id === oid} onClick={() => setUi({ ...ui, origin: x.id })}>{x.short} <small>{[1, 2, 3].reduce((a, y) => a + P[x.id][y].count, 0)}</small></button>)}</div>
    <div className="tabs" role="group" aria-label="Batch" style={{ marginTop: 12 }}>
      {[1, 2, 3].map(x => <button key={x} aria-pressed={x === b} onClick={() => setUi({ ...ui, batch: x })}>Batch {x}{P[oid][x].sent ? " ✓" : ""}{P[oid][x].extra && <span className="badge-add">+{P[oid][x].extra.count} tambahan</span>}<small>{BATCH[x].label} · {P[oid][x].count} alamat</small></button>)}</div>
    <div className="grid swap-r" key={oid + b}><div className="stack">
      <div className="kpis"><div className="kpi"><span>Alamat</span><b>{B.count}</b></div><div className="kpi"><span>Total jarak</span><b>{fmtKm(totalKm)}</b></div><div className="kpi"><span>Selesai paling akhir</span><b>{B.count ? hhmm(end) : "–"}</b></div><div className={`kpi ${late ? "bad" : "ok"}`}><span>Lewat request jam</span><b>{late}</b></div></div>
      {!list.length && <div className="banner warn">Belum ada kurir aktif di {org.short}. Tambahkan di menu Kurir.</div>}
      {cek > 0 && <div className="banner warn">{cek} alamat dari {org.short} belum punya titik peta dan belum masuk rute. <a href="#upload">Perbaiki di Data pengiriman</a>.</div>}
      {late > 0 && <div className="banner bad">{late} alamat diperkirakan lewat request jam. Pindahkan ke kurir lain atau kirim lewat pihak ketiga.</div>}
      {end > BATCH[b].end && <div className="banner warn">Rute selesai {hhmm(end)}, lewat jam akhir Batch {b} ({hhmm(BATCH[b].end)}).</div>}
      {cards(B.routes, B.sent)}
      {B.extra && <section className="panel extra"><h2>Tambahan Batch {b} · {B.extra.count} alamat</h2>
        <p className="note">Masuk setelah rute Batch {b} dikirim. Kurir mengambil kuenya di {org.short}, lalu alamat ini muncul di HP kurir setelah rutenya yang sekarang.</p>
        {cards(B.extra.routes, false)}
        <button className="btn primary big" disabled={busy || !list.length} onClick={sendAdd}>{busy ? "Mengirim…" : `Kirim ${B.extra.count} alamat tambahan ke kurir`}</button></section>}
      <div className="row">{B.sent ? <><div className="banner ok" style={{ flex: 1 }}>Rute Batch {b} sudah dikirim ke kurir. Status berubah dari aksi kurir.</div><a className="btn ghost" href="#lacak">Pantau di Lacak →</a></>
        : <button className="btn primary big" onClick={send} disabled={!B.count || busy || !list.length}>{busy ? "Mengirim…" : `Kirim rute Batch ${b} ke kurir ${org.short}`}</button>}</div>
      <section className="panel"><h2>Pihak ketiga · {ext.length}</h2><p className="note">Pesan lewat aplikasinya seperti biasa, lalu tempel link tracking supaya muncul di halaman lacak customer.</p>
        {ext.length ? <ol className="stops">{ext.map(o => <ExtRow key={o.id} o={o} save={save} toast={toast} reload={reload} act={act} />)}</ol> : <p className="note">Belum ada.</p>}</section>
      <section className="panel"><h2>Pick up · {pick.length}</h2>{pick.length ? <ol className="stops">{pick.map(o => <li key={o.id}><span className="num" style={{ background: "var(--muted)" }}>P</span><div><div className="addr">{o.recipient}</div><div className="meta">{o.address} · {o.item}</div></div><span /></li>)}</ol> : <p className="note">Tidak ada.</p>}</section>
    </div>
      <section className="panel sticky-map"><h2>Peta Batch {b} · {org.short}</h2>
        <MapSVG origin={org} routes={list.map(c => { const r = B.routes[c.id]; return { color: c.color, pts: r.seq, doneN: r.seq.filter(o => ["sampai", "gagal"].includes(o.ship)).length, pos: started(c.id) && positions[c.id] ? positions[c.id] : null }; })} />
        <div className="legend"><span>■ {org.short}</span>{list.map(c => <span key={c.id}><span className="dot" style={{ background: c.color }} /> {c.name}</span>)}<span>Kotak grid ≈ 1 km</span></div>
        <p className="note">Titik alamat masih perkiraan per area. Setelah Google Maps aktif, titik dan waktu tempuh memakai data Google.</p></section></div>
  </>);
}

const LLM_STATUS = { ASSIGNING_DRIVER: "Mencari driver", ON_GOING: "Driver menuju outlet", PICKED_UP: "Sedang diantar", COMPLETED: "Selesai", CANCELED: "Dibatalkan", REJECTED: "Ditolak", EXPIRED: "Kedaluwarsa" };
const VEH = { MOTORCYCLE: "Motor", SEDAN: "Mobil sedan", MPV: "Mobil MPV", VAN: "Van" }; // jenis lain di Jakarta truk/bak, tidak cocok untuk kue
const rp = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
// Pesan Lalamove langsung dari sini: cek ongkir -> pesan -> cek status / batalkan.
function LalamoveBox({ o, toast, reload }) {
  const [svc, setSvc] = useState(null), [type, setType] = useState("MOTORCYCLE"), [q, setQ] = useState(null), [busy, setBusy] = useState(""), [st, setSt] = useState(null);
  const run = async (label, fn) => { setBusy(label); try { await fn(); } catch (e) { toast(e.message); } setBusy(""); };
  const live = o.llm && !["CANCELED", "REJECTED", "EXPIRED"].includes(o.llm.status);
  if (live) return (<div className="llm">
    <div><b>Lalamove</b> · {LLM_STATUS[(st || o.llm).status] || (st || o.llm).status}{o.llm.price ? ` · ${rp(o.llm.price)}` : ""}</div>
    {st?.driver && <div className="meta">Driver {st.driver.name} · {st.driver.plate} · <a href={`tel:${st.driver.phone}`}>{st.driver.phone}</a></div>}
    <div className="row"><button className="btn ghost sm" disabled={!!busy} onClick={() => run("s", async () => { setSt(await lalamove("status", { order_id: o.id })); reload(); })}>{busy === "s" ? "Memuat…" : "Cek status"}</button>
      {o.link && <a className="btn ghost sm" href={o.link} target="_blank" rel="noopener">Buka tracking</a>}
      {["ASSIGNING_DRIVER"].includes((st || o.llm).status) && <button className="btn ghost sm danger" disabled={!!busy} onClick={() => run("c", async () => { await lalamove("cancel", { order_id: o.id }); toast("Order Lalamove dibatalkan"); reload(); })}>Batalkan</button>}</div></div>);
  return (<div className="llm">
    <div className="row">
      <select aria-label={`Jenis kendaraan ${o.code}`} value={type} onFocus={() => !svc && lalamove("services").then(r => setSvc(r.services || [])).catch(e => toast(e.message))} onChange={e => { setType(e.target.value); setQ(null); }}>
        {(svc?.filter(s => VEH[s.key]).length ? svc.filter(s => VEH[s.key]) : [{ key: "MOTORCYCLE" }]).map(s => <option key={s.key} value={s.key}>{VEH[s.key]}</option>)}</select>
      <button className="btn ghost sm" disabled={!!busy || o.lat == null} onClick={() => run("q", async () => setQ(await lalamove("quote", { order_id: o.id, service: type })))}>{busy === "q" ? "Menghitung…" : "Cek ongkir"}</button>
      {q && <button className="btn primary sm" disabled={!!busy} onClick={() => run("b", async () => { const r = await lalamove("book", { order_id: o.id, service: type, quotation_id: q.quotation_id, sender_stop: q.sender_stop, recipient_stop: q.recipient_stop }); toast(`Lalamove dipesan · ${LLM_STATUS[r.status] || r.status}`); setQ(null); reload(); })}>{busy === "b" ? "Memesan…" : `Pesan ${rp(q.price)}`}</button>}</div>
    {o.lat == null && <div className="meta">Pilih kelurahan alamat ini dulu supaya ongkir bisa dihitung.</div>}
    {q && <div className="meta">Ongkir {rp(q.price)}{q.distance?.value ? ` · ${(q.distance.value / 1000).toFixed(1)} km` : ""} · harga berlaku sampai {new Date(q.expires_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>}</div>);
}

function ExtRow({ o, save, toast, reload, act }) {
  const [v, setV] = useState(o.link);
  return (<li><span className="num" style={{ background: "var(--ext)" }}>↗</span><div><div className="addr">{o.recipient}</div><div className="meta">{o.address}</div>
    <div className="row" style={{ marginTop: 6 }}><Pill s="pihak3">{VIA[o.via]}</Pill><input type="url" aria-label={`Link tracking ${o.code}`} placeholder={`Tempel link tracking ${VIA[o.via]}`} value={v} onChange={e => setV(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
      <button className="btn ghost" onClick={() => v && !/^https:\/\/\S+$/.test(v.trim()) ? toast("Link harus diawali https://") : save(o, { ext_link: v.trim() || null }, v.trim() ? "Link tracking disimpan" : "Link dihapus")}>Simpan</button></div>
    {!o.llm && !["jalan", "sampai", "gagal"].includes(o.ship) && <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => act.edit(o)}>Edit pesanan</button>}
    {o.via === "lalamove" && <LalamoveBox o={o} toast={toast} reload={reload} />}</div><span /></li>);
}
