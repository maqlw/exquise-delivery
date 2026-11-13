import { useState } from "react";
import * as XLSX from "xlsx";
import { Pill, Phone } from "../components/ui.jsx";
import { AreaPicker } from "../components/AreaPicker.jsx";
import { VIA, status, batchOf, routable, hhmm, dmy, readSheets, buildOrders, recompute } from "../lib/logic.js";
import { saveUpload, updateOrder, toDb } from "../lib/api.js";

const FILTERS = [["all", "Semua"], ["draft", "Belum dikirim"], ["jalan", "Dikirim"], ["sampai", "Sampai"], ["cek", "Perlu dicek"], ["pihak3", "Pihak ketiga"], ["pickup", "Pick up"]];
const isLocked = o => ["jalan", "sampai", "gagal", "siap"].includes(o.ship);
const inFilter = (o, f) => { const s = status(o); return f === "all" || (f === "draft" ? ["draft", "siap"].includes(s) : s === f); };

export default function Upload({ orders, origins, date, dates, setDate, ui, setUi, reload, toast, act }) {
  const [sel, setSel] = useState(() => new Set()), [bulk, setBulk] = useState({ via: "", origin: "", batch: "" }), [q, setQ] = useState(""), [busy, setBusy] = useState(false), [over, setOver] = useState(false), [errors, setErrors] = useState(null);
  async function readFile(f) {
    if (!f) return;
    setBusy(true); setErrors(null);
    try {
      const best = readSheets(XLSX, XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true }));
      if (!best?.rows.length) throw new Error("Tidak menemukan tabel pengiriman. Pastikan ada kolom No Pengiriman dan Alamat.");
      const r = buildOrders(best.rows, Object.values(origins));
      await saveUpload(f.name, best.name, best.rows.length, r.orders);
      setErrors({ file: f.name, sheet: best.name, saved: r.orders.length, list: r.errors });
      toast(`${r.orders.length} pesanan disimpan dari ${f.name}`);
      await reload(r.ref || date);
    } catch (e) { toast(e.message); }
    setBusy(false);
  }
  async function recheck() {
    setBusy(true); let n = 0;
    try { for (const o of orders.filter(o => status(o) === "cek")) { const x = recompute({ ...o }); if (x.lat != null) { await updateOrder(o.id, toDb(x)); n++; } } }
    catch (e) { toast("Gagal: " + e.message); }
    toast(n ? `${n} alamat sekarang ketemu di peta` : "Belum ada alamat baru yang terbaca. Pilih kelurahannya manual."); setBusy(false); reload();
  }
  async function patch(o, change) {
    const next = recompute({ ...o, ...change });
    try { await updateOrder(o.id, toDb(next)); await reload(); } catch (e) { toast("Gagal menyimpan: " + e.message); }
  }
  // Ubah banyak pesanan sekaligus: cara kirim, lokasi asal, batch. Pesanan yang sudah dirute/dikirim dilewati.
  async function applyBulk() {
    const list = orders.filter(o => sel.has(o.id) && !isLocked(o));
    if (!bulk.via && !bulk.origin && !bulk.batch) return toast("Pilih dulu yang mau diubah");
    setBusy(true); let n = 0;
    try {
      for (let i = 0; i < list.length; i += 10) await Promise.all(list.slice(i, i + 10).map(async o => {
        const x = recompute({ ...o, ...(bulk.via && { via: bulk.via }), ...(bulk.origin && { origin: bulk.origin }) });
        await updateOrder(o.id, { ...toDb(x), ...(bulk.batch && { batch_forced: bulk.batch === "auto" ? null : +bulk.batch }) }); n++;
      }));
      toast(`${n} pesanan diubah`); setSel(new Set()); setBulk({ via: "", origin: "", batch: "" });
    } catch (e) { toast(`Gagal setelah ${n} pesanan: ${e.message}`); }
    await reload(); setBusy(false);
  }
  const fileInput = <input type="file" id="file" accept=".xlsx,.xls" hidden onChange={e => { readFile(e.target.files[0]); e.target.value = ""; }} />;
  const head = (
    <div className="row between"><div><h1>Data pengiriman</h1>
      <p className="sub">Tanggal kirim <select value={date} onChange={e => setDate(e.target.value)} aria-label="Tanggal kirim">{[...new Set([date, ...dates])].map(d => <option key={d} value={d}>{dmy(d)}</option>)}</select> · {orders.length} pesanan</p></div>
      <div className="row"><button className="btn ok" onClick={act.add}>+ Tambah manual</button>
        <label className="btn ghost" htmlFor="file">{busy ? <><span className="spin" /> Membaca…</> : "Upload Excel"}</label>{fileInput}
        <a className="btn primary" href="#dispatch">Susun rute ({orders.filter(routable).length}) →</a></div></div>);
  const report = errors && (
    <div className={`banner ${errors.list.length ? "bad" : "ok"}`} style={{ marginTop: 12 }}>
      {errors.file} (sheet "{errors.sheet}"): {errors.saved} pesanan disimpan.
      {errors.list.length > 0 && <> {errors.list.length} baris tidak disimpan: {errors.list.slice(0, 5).map(e => `baris ${e.row} ${e.code} (${e.reason})`).join("; ")}{errors.list.length > 5 ? "; …" : ""}.</>}
    </div>);
  if (!orders.length) return (<>{head}{report}
    <label className={`drop ${over ? "over" : ""}`} htmlFor="file" style={{ marginTop: 16, cursor: "pointer" }}
      onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); readFile(e.dataTransfer.files[0]); }}>
      <h2>Tarik file Excel ke sini, atau klik untuk memilih</h2>
      <p className="note">Format yang dibaca: sheet Matrix Delivery (Sheet1) dengan kolom No Pengiriman, Tanggal Pengiriman, Pengirim, No Pengirim, Nama (penerima), Alamat, No Penerima, Item, Wording.</p>
      <span className="btn primary">{busy ? "Membaca…" : "Pilih file .xlsx"}</span></label></>);

  const c = {}; orders.forEach(o => { const s = status(o); c[s] = (c[s] || 0) + 1; });
  const words = q.toLowerCase().split(/\s+/).filter(Boolean), hay = o => [o.code, o.gd, o.sender, o.recipient, o.phone, o.phoneSender, o.address, o.item, o.area].join(" ").toLowerCase();
  const vis = orders.filter(o => inFilter(o, ui.filter) && words.every(w => hay(o).includes(w))), ready = orders.filter(routable).length;
  return (<>
    {head}{report}
    <div className="kpis" style={{ marginTop: 16 }}>
      <div className="kpi ok"><span>Siap dirute</span><b>{ready}</b></div><div className="kpi warn"><span>Perlu dicek</span><b>{c.cek || 0}</b></div>
      <div className="kpi"><span>Dikirim / sampai</span><b>{c.jalan || 0} / {c.sampai || 0}</b></div><div className="kpi"><span>Tanpa No HP</span><b>{orders.filter(o => !o.phone && o.via !== "pickup").length}</b></div></div>
    {(c.cek || 0) > 0 && <div className="banner warn" style={{ marginTop: 12 }}>{c.cek} alamat belum ketemu di peta. Ketik nama kelurahan atau kode pos di kolom Alamat. Tempat langganan (mis. "BRI KCK") bisa disimpan di Pengaturan → Alamat dikenal supaya otomatis terbaca. <button className="btn ghost sm" disabled={busy} onClick={recheck}>Cek ulang alamat</button></div>}
    <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama, kode, No HP, atau alamat…" aria-label="Cari pesanan" style={{ marginTop: 16, width: "100%", maxWidth: 480 }} />
    <div className="seg" role="group" aria-label="Saring" style={{ marginTop: 12 }}>
      {FILTERS.map(([k, t]) => <button key={k} aria-pressed={ui.filter === k} onClick={() => setUi({ ...ui, filter: k })}>{t} <small>{orders.filter(o => inFilter(o, k)).length}</small></button>)}</div>
    {q && <p className="note" style={{ marginTop: 8 }}>{vis.length} hasil untuk "{q}"</p>}
    {sel.size > 0 && <div className="bulkbar" role="region" aria-label="Ubah pesanan terpilih">
      <b>{sel.size} dipilih</b>
      <select aria-label="Kirim lewat" value={bulk.via} onChange={e => setBulk({ ...bulk, via: e.target.value })}><option value="">Kiriman: tidak diubah</option>{Object.entries(VIA).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
      <select aria-label="Lokasi asal" value={bulk.origin} onChange={e => setBulk({ ...bulk, origin: e.target.value })}><option value="">Asal: tidak diubah</option>{Object.values(origins).map(x => <option key={x.id} value={x.id}>{x.short}</option>)}</select>
      <select aria-label="Batch" value={bulk.batch} onChange={e => setBulk({ ...bulk, batch: e.target.value })}><option value="">Batch: tidak diubah</option><option value="auto">Batch otomatis</option>{[1, 2, 3].map(b => <option key={b} value={b}>Batch {b}</option>)}</select>
      <button className="btn primary" disabled={busy} onClick={applyBulk}>{busy ? "Menyimpan…" : "Terapkan"}</button>
      <button className="btn ghost" onClick={() => setSel(new Set())}>Batal pilih</button></div>}
    <div className="tablewrap" style={{ marginTop: 12 }}><table className="rtable"><thead><tr><th><input type="checkbox" aria-label="Pilih semua yang tampil" checked={vis.some(o => !isLocked(o)) && vis.filter(o => !isLocked(o)).every(o => sel.has(o.id))}
        onChange={e => { const n = new Set(sel); vis.filter(o => !isLocked(o)).forEach(o => e.target.checked ? n.add(o.id) : n.delete(o.id)); setSel(n); }} /></th><th>Status</th><th>Kode</th><th>Pengirim</th><th>Penerima</th><th>Alamat</th><th>Batch</th><th>Asal</th><th>Kiriman</th><th>Penerima barang</th><th>Status penerima</th><th>Catatan sistem</th><th>Aksi</th></tr></thead>
      <tbody>{vis.length ? vis.map(o => { const s = status(o), locked = ["jalan", "sampai", "gagal", "siap"].includes(o.ship), b = o.via === "internal" ? (batchOf(o) || o._b) : null;
        return (<tr key={o.id} className={sel.has(o.id) ? "picked" : ""}>
          <td data-label="Pilih"><input type="checkbox" aria-label={`Pilih ${o.code}`} disabled={locked} checked={sel.has(o.id)} onChange={() => { const n = new Set(sel); n.has(o.id) ? n.delete(o.id) : n.add(o.id); setSel(n); }} /></td>
          <td data-label="Status"><Pill s={s} /></td>
          <td data-label="Kode"><div className="mono">{o.code}</div><div className="meta">{dmy(o.ymd)}</div></td>
          <td data-label="Pengirim"><div className="addr">{o.sender || "–"}</div><Phone p={o.phoneSender} /></td>
          <td data-label="Penerima"><div className="addr">{o.recipient}</div><Phone p={o.phone} /></td>
          <td data-label="Alamat" className="full wide"><div>{o.address}</div>
            {o.area ? <div className="meta">Area: {o.area}</div> : o.via !== "pickup" && <div style={{ marginTop: 6 }}><AreaPicker id={`area-${o.id}`} onPick={v => v && patch(o, { areaManual: v })} /></div>}</td>
          <td data-label="Batch"><div className="addr">{b ? `Batch ${b}` : "–"}</div>{o.deadline != null && <div className="meta">Request jam {hhmm(o.deadline)}</div>}</td>
          <td data-label="Asal"><select aria-label={`Lokasi asal ${o.code}`} value={o.origin} disabled={locked} onChange={e => patch(o, { origin: e.target.value })}>{Object.values(origins).map(x => <option key={x.id} value={x.id}>{x.short}</option>)}</select></td>
          <td data-label="Kiriman"><select aria-label={`Kirim via ${o.code}`} value={o.via} disabled={locked} onChange={e => patch(o, { via: e.target.value })}>{Object.entries(VIA).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></td>
          <td data-label="Penerima barang">{o.receivedBy ? <div className="addr">{o.receivedBy}</div> : <div className="meta">–</div>}</td>
          <td data-label="Status penerima">{o.receivedRel ? <><Pill s="ok">{o.receivedRel}</Pill>{o.proof && <a href={o.proof} target="_blank" rel="noopener"><img className="thumb" src={o.proof} alt={`Foto bukti ${o.code}`} /></a>}</> : <div className="meta">–</div>}</td>
          <td data-label="Catatan sistem" className="full wide"><ul className="iss">{o.issues.length ? o.issues.map(([l, m], i) => <li key={i} className={l}>{m}</li>) : <li>OK</li>}</ul></td>
          <td data-label="Aksi" className="full"><div className="acts"><button className="btn primary sm" onClick={() => act.update(o)}>Update</button><button className="btn ghost sm" onClick={() => act.edit(o)}>Edit</button><button className="btn ghost sm danger" onClick={() => act.hapus(o)}>Hapus</button></div></td>
        </tr>); }) : <tr><td colSpan="13" className="meta">{q ? `Tidak ada pesanan yang cocok dengan "${q}".` : "Tidak ada pesanan untuk filter ini."}</td></tr>}</tbody></table></div>
  </>);
}
