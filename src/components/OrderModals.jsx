import { useState } from "react";
import { Modal, Field, Pill } from "./ui.jsx";
import { AreaPicker } from "./AreaPicker.jsx";
import { VIA, REL, BATCH, hhmm, normPhone, recompute, status, fmtTime, geocode, findArea, pinLabel, parseLatLng, km } from "../lib/logic.js";
import PinMap from "./PinMap.jsx";
import { lalamove } from "../lib/api.js";

const toMin = t => t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : null;

export function OrderForm({ order, origins, defaults, onClose, onSave, history = [] }) {
  const v = order || defaults;
  const onRoad = ["jalan", "sampai", "gagal"].includes(v.ship); // batch tidak bisa dipindah setelah pesanan dibawa kurir
  const [f, setF] = useState({
    ymd: v.ymd || "", gd: v.gd || "", sender: v.sender || "", psender: v.phoneSender || "", recipient: v.recipient || "", phone: v.phone || "",
    address: v.address || "", area: v.areaManual || "", item: v.item || "", notes: v.notes || "", origin: v.origin || "ck",
    batch: v.batchForced ?? v.batchReq ?? "", req: v.reqTime != null ? hhmm(v.reqTime).replace(".", ":") : "", via: v.via || "internal",
  });
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [gm, setGm] = useState("");
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const g = f.via === "pickup" || /pick ?up/i.test(f.address) ? null : f.area ? findArea(f.area) : geocode(f.address), pt = g && g.lat != null ? g : null, og = origins[f.origin];
  const setPin = (lat, lng) => setF(x => ({ ...x, area: pinLabel(lat, lng) }));
  async function usePaste() { // link pendek maps.app.goo.gl dibuka dulu di server untuk mendapat koordinat
    let c = parseLatLng(gm);
    if (!c && /^https:\/\/(maps\.app\.goo\.gl|goo\.gl)\//.test(gm.trim())) c = parseLatLng((await lalamove("resolve_link", { url: gm.trim() }).catch(() => ({}))).url);
    if (!c) return setErr("Link/koordinat tidak terbaca. Tempel link Google Maps (share location) atau format -6.26, 106.81.");
    setErr(""); setPin(c.lat, c.lng); setGm("");
  }
  async function save() {
    const e = [], ps = normPhone(f.psender), pr = normPhone(f.phone);
    [["ymd", "tanggal kirim"], ["sender", "pemesan"], ["recipient", "nama penerima"], ["address", "alamat"], ["item", "item"]].forEach(([k, t]) => { if (!f[k].trim()) e.push(t + " wajib diisi"); });
    if (ps.bad) e.push("No HP pemesan tidak valid"); if (pr.bad) e.push("No HP penerima tidak valid");
    if (e.length) return setErr("Periksa: " + e.join(", ") + ".");
    const o = recompute({
      ...(order || { issues: [["info", "Ditambahkan manual"]], merged: 1, code: f.gd.trim() || `MAN-${f.ymd.slice(8, 10)}${f.ymd.slice(5, 7)}-${Date.now().toString(36).slice(-5).toUpperCase()}` }),
      ymd: f.ymd, gd: order ? order.gd : f.gd.trim(), sender: f.sender.trim(), phoneSender: ps.p,
      recipient: f.recipient.trim(), phone: pr.p, address: f.address.trim(), item: f.item.trim(), notes: f.notes.trim(), origin: f.origin,
      batchReq: f.batch ? +f.batch : null, reqTime: toMin(f.req), via: f.via, areaManual: f.area || null,
    });
    setBusy(true); setErr("");
    try { await onSave(o); } catch (x) { setErr(/duplicate/.test(x.message) ? "No Pengiriman sudah ada." : x.message); setBusy(false); }
  }
  return (
    <Modal title={order ? `Edit pesanan ${order.code}` : "Tambah pesanan manual"} onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Batal</button><button className="btn primary" onClick={save} disabled={busy}>{busy ? "Menyimpan…" : order ? "Simpan perubahan" : "Tambah pesanan"}</button></>}>
      <div className="form">
        <Field id="f-date" label="Tanggal kirim *"><input type="date" id="f-date" value={f.ymd} onChange={set("ymd")} /></Field>
        <Field id="f-gd" label="No Pengiriman"><input id="f-gd" value={f.gd} onChange={set("gd")} placeholder="Kosongkan untuk kode otomatis" readOnly={!!order} /></Field>
        <Field id="f-sender" label="Pemesan / pengirim *"><input id="f-sender" value={f.sender} onChange={set("sender")} autoComplete="off" /></Field>
        <Field id="f-psender" label="No HP pemesan"><input id="f-psender" inputMode="tel" value={f.psender} onChange={set("psender")} placeholder="08…" /></Field>
        <Field id="f-recipient" label="Nama penerima *"><input id="f-recipient" value={f.recipient} onChange={set("recipient")} autoComplete="off" /></Field>
        <Field id="f-phone" label="No HP penerima"><input id="f-phone" inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="08…" /></Field>
        <Field id="f-address" full label={<>Alamat *{order && <span className="hint"> perubahan alamat dicatat di riwayat</span>}</>}><><textarea id="f-address" rows="3" value={f.address} onChange={set("address")} />
          <div className="row" style={{ marginTop: 6 }}><a className="btn ghost sm" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.address.trim() || "Jakarta")}`} target="_blank" rel="noopener">Cari di Google Maps ↗</a>
            <span className="hint">pilih tempatnya → Bagikan → Salin link → tempel di "Lokasi di peta" di bawah</span></div></></Field>
        <Field id="f-area" label={<>Titik peta <span className="hint">{order?.area && !f.area ? `otomatis: ${order.area}` : "kosongkan = otomatis dari alamat"}</span></>}><AreaPicker key={f.area.startsWith("pin:") ? "pin" : "area"} id="f-area" value={f.area.startsWith("pin:") ? "" : f.area} onPick={v => setF(x => ({ ...x, area: v }))} /></Field>
        <div className="fld full"><span className="flabel">Lokasi di peta <span className="hint">{!pt ? "alamat belum terbaca, tandai di peta" : pt.how === "titik tepat di peta" ? "✓ titik tepat sudah ditandai" : `masih perkiraan dari ${pt.how}`}</span></span>
          <div className="row"><input aria-label="Link Google Maps atau koordinat" placeholder="Tempel link Google Maps / share location, atau -6.26, 106.81" value={gm} onChange={e => setGm(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
            <button type="button" className="btn ghost sm" disabled={!gm.trim()} onClick={usePaste}>Pakai titik</button></div>
          <PinMap origin={og} stops={pt ? [{ lat: pt.lat, lng: pt.lng, title: f.recipient || "Tujuan" }] : []} onPick={setPin} label="Peta lokasi tujuan, geser titik untuk memperbaiki" />
          <p className="note">{pt && pt.how !== "titik tepat di peta" ? "Titik masih perkiraan dari alamat. " : ""}Geser titik merah atau ketuk peta di lokasi persis{f.via === "lalamove" ? " (dipakai untuk ongkir & arah driver Lalamove)" : ""}.{pt && og?.lat != null ? ` Perkiraan ± ${km(og, pt).toFixed(1)} km dari ${og.short}.` : ""}</p></div>
        <Field id="f-item" label="Item *"><input id="f-item" value={f.item} onChange={set("item")} /></Field>
        <Field id="f-notes" full label="Wording / catatan"><input id="f-notes" value={f.notes} onChange={set("notes")} /></Field>
        <Field id="f-origin" label="Lokasi asal"><select id="f-origin" value={f.origin} onChange={set("origin")}>{Object.values(origins).map(x => <option key={x.id} value={x.id}>{x.short}</option>)}</select></Field>
        <Field id="f-batch" label={<>Batch{onRoad && <span className="hint">sudah dibawa kurir</span>}</>}><select id="f-batch" value={f.batch} onChange={set("batch")} disabled={onRoad}><option value="">Otomatis</option>{[1, 2, 3].map(b => <option key={b} value={b}>Batch {b} · {BATCH[b].label}</option>)}</select></Field>
        <Field id="f-req" label="Request jam tiba (opsional)"><input type="time" id="f-req" value={f.req} onChange={set("req")} /></Field>
        <Field id="f-via" label="Kiriman"><select id="f-via" value={f.via} onChange={set("via")}>{Object.entries(VIA).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Field>
      </div>
      {history.length > 0 && <div><div className="lbl">Riwayat alamat</div><HistoryList items={history} /></div>}
      {err && <p className="ferr" role="alert">{err}</p>}
    </Modal>
  );
}

export const HistoryList = ({ items }) => (
  <ul className="hist">{items.map(h => <li key={h.id}><div className="meta">{new Date(h.changed_at).toLocaleDateString("id-ID")} {fmtTime(h.changed_at)}</div><div><s>{h.old_address}</s></div><div>→ {h.new_address}</div></li>)}</ul>
);

export function UpdateChoice({ order, onClose, onKirim, onSampai }) {
  const s = status(order), canKirim = !["jalan", "sampai", "pickup"].includes(s), canSampai = ["jalan", "pickup", "pihak3", "gagal"].includes(s);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Update ${order.code}`} onClose={onClose}>
      <p className="sub">{order.recipient} · {order.item} · <Pill s={s} /></p>
      <button className="opt" disabled={!canKirim || busy} onClick={async () => { setBusy(true); await onKirim(); }}><b>1 · Kirim</b><span>{busy ? "Mengirim WhatsApp…" : "Status jadi Dalam perjalanan. WhatsApp ke pemesan (dengan link lacak) dan ke penerima."}</span></button>
      <button className="opt" disabled={!canSampai || busy} onClick={onSampai}><b>2 · Sampai</b><span>{canSampai ? "Isi nama penerima barang, status penerima, dan foto bukti. WhatsApp konfirmasi ke pemesan." : "Tekan Kirim dulu sebelum menandai sampai."}</span></button>
    </Modal>
  );
}

// Foto bukti dari kamera atau galeri: kurir bisa memotret dulu saat sinyal jelek, lalu upload setelah sinyal kembali.
function PhotoPick({ id, label, hint, prev, onPick }) {
  const pick = e => { const f = e.target.files[0]; e.target.value = ""; if (f) onPick(f); };
  return (<div className="fld"><span className="flabel">{label}</span><span className="meta">{hint}</span>
    <div className="row" style={{ marginTop: 6 }}><label className="btn ghost sm" htmlFor={id + "-cam"}>Kamera</label><label className="btn ghost sm" htmlFor={id + "-gal"}>Galeri</label>
      <input type="file" id={id + "-cam"} accept="image/*" capture="environment" hidden onChange={pick} />
      <input type="file" id={id + "-gal"} accept="image/*" hidden onChange={pick} /></div>
    {prev && <img className="proof" src={prev} alt={`Pratinjau ${label.toLowerCase()}`} style={{ marginTop: 6 }} />}</div>);
}

// need = foto sebelum & sesudah wajib (kurir). Admin yang menandai sampai untuk pihak ketiga boleh tanpa foto.
export function SampaiForm({ order, onClose, onSave, need }) {
  const [name, setName] = useState(order.receivedBy || order.recipient), [rel, setRel] = useState(order.receivedRel || REL[0]);
  const [files, setFiles] = useState({}), [prev, setPrev] = useState({ before: order.beforeArchived ? null : order.proofBefore, after: order.archived ? null : order.proof });
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const pick = k => f => { setFiles(x => ({ ...x, [k]: f })); setPrev(x => ({ ...x, [k]: URL.createObjectURL(f) })); };
  async function save() {
    if (!name.trim()) return setErr("Nama penerima barang wajib diisi.");
    const miss = need ? [["before", "sebelum diserahkan"], ["after", "sesudah diterima"]].filter(([k]) => !files[k] && !prev[k]).map(x => x[1]) : [];
    if (miss.length) return setErr(`Foto ${miss.join(" dan ")} wajib diisi.`);
    setBusy(true); setErr("");
    try { await onSave({ name: name.trim(), rel, file: files.after, fileBefore: files.before }); } catch (x) { setErr(x.message + (/fetch|network|timeout|failed/i.test(x.message) ? " · Sinyal bermasalah: coba Simpan lagi, foto tidak perlu diulang." : "")); setBusy(false); }
  }
  return (
    <Modal title={`Pesanan sampai · ${order.code}`} onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Batal</button><button className="btn ok" onClick={save} disabled={busy}>{busy ? "Menyimpan…" : "Simpan, pesanan sampai"}</button></>}>
      <p className="sub">{order.address}</p>
      <div className="form">
        <Field id="s-rel" full label="Siapa yang menerima? *"><select id="s-rel" value={rel} onChange={e => { const v = e.target.value; setRel(v);
          if (v === REL[0]) setName(order.recipient); else if (name.trim() === order.recipient) setName(""); /* diterima orang lain: nama wajib diisi ulang */ }}>{REL.map(r => <option key={r}>{r}</option>)}</select></Field>
        <Field id="s-name" full label={rel === REL[0] ? "Nama penerima barang *" : `Nama yang menerima (${rel.toLowerCase()}) *`}><input id="s-name" value={name} onChange={e => setName(e.target.value)} autoComplete="off" placeholder={rel === REL[0] ? order.recipient : "mis. Aldi"} /></Field>
        <PhotoPick id="s-before" label={`Foto sebelum diserahkan${need ? " *" : ""}`} hint="Kue di depan alamat, sebelum diberikan" prev={prev.before} onPick={pick("before")} />
        <PhotoPick id="s-after" label={`Foto sesudah diterima${need ? " *" : ""}`} hint="Penerima / satpam memegang kue" prev={prev.after} onPick={pick("after")} />
      </div>
      {err && <p className="ferr" role="alert">{err}</p>}
    </Modal>
  );
}

export function ConfirmDelete({ order, onClose, onDelete }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Hapus ${order.code}?`} onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Batal</button><button className="btn bad" disabled={busy} onClick={async () => { setBusy(true); await onDelete(); }}>Ya, hapus</button></>}>
      <p>Pesanan untuk <b>{order.recipient}</b> ({order.item}) akan dihapus dari daftar dan rute. Tindakan ini tidak bisa dibatalkan.</p>
    </Modal>
  );
}

export const WaBubbles = ({ logs }) => logs.map(l => l.ok
  ? <div className="bubble" key={l.id}><div className="to">Ke {l.role} · {l.to_phone} · {fmtTime(l.created_at)} · terkirim</div>{l.message}</div>
  : <div className="bubble skip" key={l.id}><div className="to">Ke {l.role} · {l.to_phone} · {fmtTime(l.created_at)}</div>Gagal terkirim: {l.response || "tidak diketahui"}</div>);

export function WaResult({ title, result, logs, onClose }) {
  const skipped = (result?.results || []).filter(r => r.reason === "tanpa No HP");
  return (
    <Modal title={title} onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Selesai</button>}>
      {result?.error && <div className="banner bad">WhatsApp gagal diproses: {result.error}</div>}
      <div className="wa"><WaBubbles logs={logs} />
        {skipped.map(r => <div className="bubble skip" key={r.role}><div className="to">Ke {r.role}</div>Tidak dikirim: {r.role} tidak punya No HP. Bagikan link lacak manual.</div>)}
        {!logs.length && !skipped.length && !result?.error && <p className="note">Tidak ada pesan yang dikirim.</p>}</div>
    </Modal>
  );
}
