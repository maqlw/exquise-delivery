import { useEffect, useState } from "react";
import MapSVG from "../components/MapSVG.jsx";
import PinMap from "../components/PinMap.jsx";
import { Pill, Empty, StopInfo } from "../components/ui.jsx";
import { BATCH, VIA, status, hhmm, fmtKm, dmy, returnLabel } from "../lib/logic.js";
import { updateOrder, sendRoutes, sendExtra, lalamove, reassignOrders } from "../lib/api.js";

export default function Dispatch({ orders, origins, couriers, P, date, ui, setUi, reload, toast, routes, positions, act, locked }) {
  const [busy, setBusy] = useState(false), [sel, setSel] = useState(new Set());
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
    if (k === "v") save(o, { via: x }, `${o.recipient} dikirim lewat ${VIA[x]}${B.sent ? ", dicabut dari rute kurir" : ""}`);
    if (k === "r") reassign([o.id], x, o.recipient);
  }
  // Setelah rute dikirim: pindah ke kurir lain (rute kurir tujuan di batch yang sama ditambah alamat ini).
  async function reassign(ids, to, label) {
    const c = couriers.find(x => x.id === to);
    try { const n = await reassignOrders(ids, to); toast(`${label} dipindah ke ${c.name} (${n} alamat). Kabari ${c.name}, rutenya bertambah di HP-nya.`); await reload(); }
    catch (e) { toast("Gagal memindah: " + e.message); }
  }
  const extOpts = Object.entries(VIA).filter(([k]) => k !== "internal" && k !== "pickup");
  const undone = o => !["sampai", "gagal"].includes(o.ship);
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
          {locked && (x => x && <Pill s={x[0]}>{x[1]}</Pill>)(returnLabel(routes.find(x => x.courier_id === c.id && x.batch === b)))}
          {locked && r.seq.filter(undone).length > 0 && <select className="cc-move" aria-label={`Pindahkan semua alamat ${c.name} yang belum selesai`} value="" onChange={e => { const v = e.target.value; if (v && confirm(`Pindahkan ${r.seq.filter(undone).length} alamat ${c.name} yang belum selesai ke ${couriers.find(x => x.id === v).name}?`)) reassign(r.seq.filter(undone).map(o => o.id), v, `Semua sisa ${c.name}`); }}>
            <option value="">Kurir berhalangan? Pindahkan semua sisa…</option>{list.filter(x => x.id !== c.id).map(x => <option key={x.id} value={x.id}>Ke {x.name}</option>)}</select>}</div>
          {r.seq.length ? <ol className="stops">{r.seq.map((o, i) => { const e = r.eta[o.code], isLate = o.deadline != null && e > o.deadline; return (
            <li key={o.id}><span className="num" style={{ background: isLate ? "var(--bad)" : c.color }}>{i + 1}</span>
              <div><StopInfo o={o} />
                {locked ? <><Pill s={status(o)} />{undone(o) && <select aria-label={`Pindahkan ${o.code}`} style={{ marginTop: 4, marginLeft: 6, fontSize: 13 }} value="" onChange={e => e.target.value && move(o, e.target.value)}>
                  <option value="">Pindahkan…</option>{list.filter(x => x.id !== c.id).map(x => <option key={x.id} value={"r:" + x.id}>Ke {x.name}</option>)}
                  {extOpts.map(([k, t]) => <option key={k} value={"v:" + k}>Ke {t}</option>)}</select>}</> : <select aria-label={`Pindahkan ${o.code}`} style={{ marginTop: 4, fontSize: 13 }} value="" onChange={e => e.target.value && move(o, e.target.value)}>
                  <option value="">Pindahkan…</option>{list.filter(x => x.id !== c.id).map(x => <option key={x.id} value={"c:" + x.id}>Ke {x.name}</option>)}
                  {[1, 2, 3].filter(x => x !== b).map(x => <option key={x} value={"b:" + x}>Ke Batch {x}</option>)}{extOpts.map(([k, t]) => <option key={k} value={"v:" + k}>Ke {t}</option>)}</select>}
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
        <button className="btn primary big" disabled={busy || !list.length || locked} onClick={sendAdd}>{busy ? "Mengirim…" : `Kirim ${B.extra.count} alamat tambahan ke kurir`}</button></section>}
      <div className="row">{B.sent ? <><div className="banner ok" style={{ flex: 1 }}>Rute Batch {b} sudah dikirim ke kurir. Status berubah dari aksi kurir. Kalau kurir berhalangan, pindahkan alamat yang belum selesai lewat pilihan <b>Pindahkan</b> di kartunya.</div><a className="btn ghost" href="#lacak">Pantau di Lacak →</a></>
        : <button className="btn primary big" onClick={send} disabled={!B.count || busy || !list.length || locked}>{busy ? "Mengirim…" : `Kirim rute Batch ${b} ke kurir ${org.short}`}</button>}</div>
      <section className="panel"><h2>Pihak ketiga · {ext.length}</h2><p className="note">Lalamove: pesan langsung dari sini supaya status, foto bukti & WhatsApp otomatis. Centang 2 pesanan Lalamove atau lebih dari outlet yang sama untuk <b>1 driver banyak alamat</b>. GoSend/Grab: pesan di aplikasinya lalu tempel link tracking.</p>
        {sel.size >= 2 && <LalamoveMulti list={ext.filter(o => sel.has(o.id))} origins={origins} toast={toast} reload={reload} done={() => setSel(new Set())} />}
        {ext.length ? <ol className="stops">{ext.map(o => <ExtRow key={o.id} o={o} save={save} toast={toast} reload={reload} act={act} org={origins[o.origin]}
          checked={sel.has(o.id)} onCheck={canMulti(o) ? () => { const n = new Set(sel); n.has(o.id) ? n.delete(o.id) : n.add(o.id); setSel(n); } : null} />)}</ol> : <p className="note">Belum ada.</p>}</section>
      <section className="panel"><h2>Pick up · {pick.length}</h2>{pick.length ? <ol className="stops">{pick.map(o => <li key={o.id}><span className="num" style={{ background: "var(--muted)" }}>P</span><div><div className="addr">{o.recipient}</div><div className="meta">{o.address} · {o.item}</div></div><span /></li>)}</ol> : <p className="note">Tidak ada.</p>}</section>
    </div>
      <section className="panel sticky-map"><h2>Peta Batch {b} · {org.short}</h2>
        <MapSVG origin={org} routes={list.map(c => { const r = B.routes[c.id]; return { color: c.color, pts: r.seq, doneN: r.seq.filter(o => ["sampai", "gagal"].includes(o.ship)).length, pos: started(c.id) && positions[c.id] ? positions[c.id] : null }; })} />
        <div className="legend"><span>■ {org.short}</span>{list.map(c => <span key={c.id}><span className="dot" style={{ background: c.color }} /> {c.name}</span>)}<span>Kotak grid ≈ 1 km</span></div>
        <p className="note">Titik alamat masih perkiraan per area. Setelah Google Maps aktif, titik dan waktu tempuh memakai data Google.</p></section></div>
  </>);
}

const canMulti = o => o.via === "lalamove" && !["jalan", "sampai", "gagal"].includes(o.ship) && !(o.llm && !["CANCELED", "REJECTED", "EXPIRED"].includes(o.llm.status));
const LLM_STATUS = { ASSIGNING_DRIVER: "Mencari driver", ON_GOING: "Driver menuju outlet", PICKED_UP: "Sedang diantar", COMPLETED: "Selesai", CANCELED: "Dibatalkan", REJECTED: "Ditolak", EXPIRED: "Kedaluwarsa" };
const VEH = { MOTORCYCLE: "Motor", SEDAN: "Mobil sedan", MPV: "Mobil MPV", VAN: "Van" }; // jenis lain di Jakarta truk/bak, tidak cocok untuk kue
const rp = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
let svcP = null; // daftar kendaraan + opsi tambahan Lalamove, dimuat sekali untuk semua kotak
const loadSvc = () => (svcP ||= lalamove("services").catch(e => { svcP = null; throw e; }));
function useSvc(toast) { const [svc, setSvc] = useState(null); useEffect(() => { loadSvc().then(r => setSvc(r.services || [])).catch(e => toast(e.message)); }, []); return svc; }
// Opsi tambahan (tas thermal, pulang pergi, prioritas, …) sesuai jenis kendaraan + catatan untuk driver.
const SP_ID = { THERMAL_BAG_1: "Tas thermal", ROUND_TRIP: "Pulang pergi", WAITING_TIME_060MIN: "Waktu tunggu tambahan (s/d 1 jam)", DOOR_TO_DOOR_1DRIVER: "Antar sampai pintu (driver masuk/naik gedung)", TOLL_FEE_1: "Bayar tol dalam kota", LOADING_1HELPER: "Bantuan bongkar muat" };
function LlmOptions({ svc, type, sp, setSp, note, setNote, id }) {
  const list = (svc?.find(s => s.key === type)?.specials || []).filter(r => !/^TOLL_FEE_[2-9]/.test(r.name)); // tol luar kota tidak dipakai untuk kue
  return (<div className="llm-opt">
    {list.length > 0 && <fieldset><legend className="lbl">Opsi tambahan Lalamove</legend>{list.map(r => <label key={r.name} className="chk"><input type="checkbox" checked={sp.includes(r.name)} onChange={() => setSp(sp.includes(r.name) ? sp.filter(x => x !== r.name) : [...sp, r.name])} /> {SP_ID[r.name] || r.description}</label>)}</fieldset>}
    <input aria-label="Catatan untuk driver" id={id} placeholder="Catatan untuk driver, mis. lewat pintu belakang / lobby lt 8 / titip satpam" value={note} maxLength={300} onChange={e => setNote(e.target.value)} /></div>);
}
// Pesan Lalamove langsung dari sini: cek ongkir -> pesan -> cek status / batalkan.
function LalamoveBox({ o, toast, reload, org, act }) {
  const svc = useSvc(toast), [type, setType] = useState("MOTORCYCLE"), [q, setQ] = useState(null), [busy, setBusy] = useState(""), [st, setSt] = useState(null), [sp, setSp] = useState([]), [note, setNote] = useState("");
  const run = async (label, fn) => { setBusy(label); try { await fn(); } catch (e) { toast(e.message); } setBusy(""); };
  const live = o.llm && !["CANCELED", "REJECTED", "EXPIRED"].includes(o.llm.status);
  if (live) return (<div className="llm">
    <div><b>Lalamove</b> · {LLM_STATUS[(st || o.llm).status] || (st || o.llm).status}{o.llm.price ? ` · ${rp(o.llm.price)}` : ""}</div>
    {st?.driver && <div className="meta">Driver {st.driver.name} · {st.driver.plate} · <a href={`tel:${st.driver.phone}`}>{st.driver.phone}</a></div>}
    <div className="row"><button className="btn ghost sm" disabled={!!busy} onClick={() => run("s", async () => { setSt(await lalamove("status", { order_id: o.id })); reload(); })}>{busy === "s" ? "Memuat…" : "Cek status"}</button>
      {o.link && <a className="btn ghost sm" href={o.link} target="_blank" rel="noopener">Buka tracking</a>}
      {["ASSIGNING_DRIVER"].includes((st || o.llm).status) && <select aria-label="Tambah tip prioritas" value="" disabled={!!busy} onChange={e => { const v = +e.target.value; if (v && confirm(`Tambah tip prioritas ${rp(v)} supaya lebih cepat dapat driver? Biaya ini ikut terpotong.`)) run("t", async () => { await lalamove("priority", { order_id: o.id, amount: v }); toast(`Tip prioritas ${rp(v)} ditambahkan`); }); }}>
        <option value="">+ Tip prioritas…</option>{[5000, 10000, 15000, 20000].map(v => <option key={v} value={v}>{rp(v)}</option>)}</select>}
      {["ASSIGNING_DRIVER"].includes((st || o.llm).status) && <button className="btn ghost sm danger" disabled={!!busy} onClick={() => run("c", async () => { await lalamove("cancel", { order_id: o.id }); toast("Order Lalamove dibatalkan"); reload(); })}>Batalkan</button>}</div></div>);
  return (<div className="llm">
    <div className="row">
      <select aria-label={`Jenis kendaraan ${o.code}`} value={type} onChange={e => { setType(e.target.value); setSp([]); setQ(null); }}>
        {(svc?.filter(s => VEH[s.key]).length ? svc.filter(s => VEH[s.key]) : [{ key: "MOTORCYCLE" }]).map(s => <option key={s.key} value={s.key}>{VEH[s.key]}</option>)}</select>
      <button className="btn ghost sm" disabled={!!busy || o.lat == null} onClick={() => run("q", async () => setQ(await lalamove("quote", { order_id: o.id, service: type, special: sp, note })))}>{busy === "q" ? "Menghitung…" : "Cek ongkir"}</button>
      {q && <button className="btn primary sm" disabled={!!busy} onClick={() => run("b", async () => { const r = await lalamove("book", { order_id: o.id, service: type, quotation_id: q.quotation_id, sender_stop: q.sender_stop, recipient_stop: q.recipient_stop, note }); toast(`Lalamove dipesan · ${LLM_STATUS[r.status] || r.status}`); setQ(null); reload(); })}>{busy === "b" ? "Memesan…" : `Pesan ${rp(q.price)}`}</button>}</div>
    <LlmOptions svc={svc} type={type} sp={sp} setSp={v => { setSp(v); setQ(null); }} note={note} setNote={setNote} id={`llm-note-${o.id}`} />
    {o.lat == null ? <div className="meta">Tandai lokasinya di peta dulu (Edit pesanan) supaya ongkir bisa dihitung.</div>
      : <details className="llm-map"><summary>Cek titik di peta {/^pin:/.test(o.areaManual || "") ? "· titik tepat" : "· masih perkiraan dari alamat"}</summary>
        <PinMap origin={org} stops={[{ lat: o.lat, lng: o.lng, title: o.recipient }]} height={220} label={`Peta ${o.recipient}`} />
        <button className="btn ghost sm" onClick={() => act.edit(o)}>Ubah titik</button></details>}
    {q && <div className="meta">Ongkir {rp(q.price)}{q.distance?.value ? ` · ${(q.distance.value / 1000).toFixed(1)} km` : ""} · harga berlaku sampai {new Date(q.expires_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>}</div>);
}

function ExtRow({ o, save, toast, reload, act, org, checked, onCheck }) {
  const [v, setV] = useState(o.link);
  return (<li>{onCheck ? <input type="checkbox" className="ext-chk" checked={checked} onChange={onCheck} aria-label={`Gabungkan ${o.recipient} ke 1 driver Lalamove`} /> : <span className="num" style={{ background: "var(--ext)" }}>↗</span>}<div><div className="addr">{o.recipient}</div><div className="meta">{o.address}</div>
    <div className="row" style={{ marginTop: 6 }}><Pill s="pihak3">{VIA[o.via]}</Pill><input type="url" aria-label={`Link tracking ${o.code}`} placeholder={`Tempel link tracking ${VIA[o.via]}`} value={v} onChange={e => setV(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
      <button className="btn ghost" onClick={() => v && !/^https:\/\/\S+$/.test(v.trim()) ? toast("Link harus diawali https://") : save(o, { ext_link: v.trim() || null }, v.trim() ? "Link tracking disimpan" : "Link dihapus")}>Simpan</button></div>
    {!o.llm && !["jalan", "sampai", "gagal"].includes(o.ship) && <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => act.edit(o)}>Edit pesanan</button>}
    {o.via === "lalamove" && <LalamoveBox o={o} toast={toast} reload={reload} org={org} act={act} />}</div><span /></li>);
}

// 1 driver Lalamove ke banyak alamat: Lalamove menyusun urutan searah (isRouteOptimized), satu ongkir total.
function LalamoveMulti({ list, origins, toast, reload, done }) {
  const svc = useSvc(toast), [type, setType] = useState("MOTORCYCLE"), [q, setQ] = useState(null), [busy, setBusy] = useState(""), [sp, setSp] = useState([]), [note, setNote] = useState("");
  const run = async (label, fn) => { setBusy(label); try { await fn(); } catch (e) { toast(e.message); } setBusy(""); };
  const ids = list.map(o => o.id), org = origins[list[0].origin], mixed = new Set(list.map(o => o.origin)).size > 1;
  const km = q?.distance?.value ? q.distance.value / 1000 : null, eta = km != null ? Math.round(km / 22 * 60 + list.length * 8) : null; // shortcut: kecepatan rata-rata 22 km/jam + 8 menit per alamat, ganti ke data Lalamove kalau tersedia
  const by = Object.fromEntries(list.map(o => [o.id, o]));
  return (<div className="llm llm-multi"><div><b>1 driver Lalamove · {list.length} alamat</b>{mixed ? " · beda outlet, tidak bisa digabung" : ` · dari ${org.short}`}</div>
    <div className="row"><select aria-label="Jenis kendaraan gabungan" value={type} onChange={e => { setType(e.target.value); setSp([]); setQ(null); }}>{Object.entries(VEH).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
      <button className="btn ghost sm" disabled={!!busy || mixed} onClick={() => run("q", async () => setQ(await lalamove("quote_multi", { order_ids: ids, service: type, special: sp, note })))}>{busy === "q" ? "Menghitung…" : "Cek ongkir & rute"}</button>
      {q && <button className="btn primary sm" disabled={!!busy} onClick={() => run("b", async () => { const r = await lalamove("book_multi", { order_ids: ids, service: type, quotation_id: q.quotation_id, sender_stop: q.sender_stop, stops: q.stops, note }); toast(`Lalamove dipesan · ${list.length} alamat · ${LLM_STATUS[r.status] || r.status}`); setQ(null); done(); reload(); })}>{busy === "b" ? "Memesan…" : `Pesan 1 driver ${rp(q.price)}`}</button>}
      <button className="btn ghost sm" onClick={done}>Batal pilih</button></div>
    <LlmOptions svc={svc} type={type} sp={sp} setSp={v => { setSp(v); setQ(null); }} note={note} setNote={setNote} id="llm-note-multi" />
    {q && <>
      <div className="llm-sum"><div><span className="lbl">Total ongkir</span><b>{rp(q.price)}</b></div><div><span className="lbl">Jarak rute</span><b>{km != null ? `${km.toFixed(1)} km` : "-"}</b></div>
        <div><span className="lbl">Perkiraan selesai</span><b>{eta != null ? `± ${eta} menit` : "-"}</b></div><div><span className="lbl">Rata-rata / alamat</span><b>{rp(Math.round(q.price / list.length))}</b></div></div>
      <ol className="llm-seq">{q.stops.map((s, i) => <li key={s.stop_id}><b>{i + 1}.</b> {s.recipient} <span className="meta">· {by[s.order_id]?.address}</span></li>)}</ol>
      <PinMap origin={org} stops={q.stops.map(s => ({ lat: s.lat, lng: s.lng, title: s.recipient }))} height={260} label="Peta urutan antar Lalamove" />
      <p className="note">Urutan disusun Lalamove supaya searah. Harga berlaku sampai {new Date(q.expires_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}. Garis di peta = urutan, bukan jalur jalan persis.</p></>}</div>);
}
