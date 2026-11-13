import { useState } from "react";
import { Modal, Field, Pill } from "./ui.jsx";
import { AreaPicker } from "./AreaPicker.jsx";
import { VIA, REL, BATCH, hhmm, normPhone, recompute, status, fmtTime } from "../lib/logic.js";

const toMin = t => t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : null;

export function OrderForm({ order, origins, defaults, onClose, onSave, history = [] }) {
  const v = order || defaults;
  const [f, setF] = useState({
    ymd: v.ymd || "", gd: v.gd || "", sender: v.sender || "", psender: v.phoneSender || "", recipient: v.recipient || "", phone: v.phone || "",
    address: v.address || "", area: v.areaManual || "", item: v.item || "", notes: v.notes || "", origin: v.origin || "ck",
    batch: v.batchReq ?? "", req: v.reqTime != null ? hhmm(v.reqTime).replace(".", ":") : "", via: v.via || "internal",
  });
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
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
        <Field id="f-address" full label={<>Alamat *{order && <span className="hint"> perubahan alamat dicatat di riwayat</span>}</>}><textarea id="f-address" rows="3" value={f.address} onChange={set("address")} /></Field>
        <Field id="f-area" label={<>Titik peta <span className="hint">{order?.area && !f.area ? `otomatis: ${order.area}` : "kosongkan = otomatis dari alamat"}</span></>}><AreaPicker id="f-area" value={f.area} onPick={v => setF(x => ({ ...x, area: v }))} /></Field>
        <Field id="f-item" label="Item *"><input id="f-item" value={f.item} onChange={set("item")} /></Field>
        <Field id="f-notes" full label="Wording / catatan"><input id="f-notes" value={f.notes} onChange={set("notes")} /></Field>
        <Field id="f-origin" label="Lokasi asal"><select id="f-origin" value={f.origin} onChange={set("origin")}>{Object.values(origins).map(x => <option key={x.id} value={x.id}>{x.short}</option>)}</select></Field>
        <Field id="f-batch" label="Batch"><select id="f-batch" value={f.batch} onChange={set("batch")}><option value="">Otomatis</option>{[1, 2, 3].map(b => <option key={b} value={b}>Batch {b} · {BATCH[b].label}</option>)}</select></Field>
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

export function SampaiForm({ order, onClose, onSave }) {
  const [name, setName] = useState(order.receivedBy || order.recipient), [rel, setRel] = useState(order.receivedRel || REL[0]);
  const [file, setFile] = useState(null), [prev, setPrev] = useState(order.proof), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function save() {
    if (!name.trim()) return setErr("Nama penerima barang wajib diisi.");
    setBusy(true); setErr("");
    try { await onSave({ name: name.trim(), rel, file }); } catch (x) { setErr(x.message); setBusy(false); }
  }
  return (
    <Modal title={`Pesanan sampai · ${order.code}`} onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Batal</button><button className="btn ok" onClick={save} disabled={busy}>{busy ? "Menyimpan…" : "Simpan, pesanan sampai"}</button></>}>
      <p className="sub">{order.address}</p>
      <div className="form">
        <Field id="s-name" full label="Nama penerima barang *"><input id="s-name" value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></Field>
        <Field id="s-rel" full label="Status penerima *"><select id="s-rel" value={rel} onChange={e => setRel(e.target.value)}>{REL.map(r => <option key={r}>{r}</option>)}</select></Field>
        <div className="fld full"><span className="flabel">Foto bukti terima</span>
          <div className="row"><label className="btn ghost" htmlFor="s-photo">Ambil / pilih foto</label>
            <input type="file" id="s-photo" accept="image/*" capture="environment" hidden onChange={e => { const f = e.target.files[0]; if (f) { setFile(f); setPrev(URL.createObjectURL(f)); } }} />
            {prev && <img className="proof" src={prev} alt="Pratinjau foto bukti" />}</div></div>
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
