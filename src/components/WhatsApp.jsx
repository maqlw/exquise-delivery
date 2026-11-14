import { useEffect, useState } from "react";
import { Modal, Pill } from "./ui.jsx";
import { parseExpired, daysLeft } from "../lib/logic.js";
import { createTopupInvoice, submitProof, listInvoices, invoiceUrl, proofUrl } from "../lib/api.js";

export const rp = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
const fmtDate = d => d ? d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "–";
export const TOPUP_LABEL = { unpaid: "Menunggu pembayaran", review: "Sedang diproses" };
export const TOPUP_PILL = { unpaid: "warn", review: "jalan" };
// Ringkasan status WhatsApp Gateway untuk kartu & peringatan.
export function waInfo(wa, min = 100) {
  if (!wa) return null;
  const exp = parseExpired(wa.expired), left = daysLeft(exp), quota = Number(wa.quota);
  const issues = [];
  if (!wa.ok) issues.push(wa.reason || "Token WhatsApp Gateway bermasalah");
  else {
    if (!wa.connected) issues.push("WhatsApp terputus. Sambungkan ulang di Pengaturan.");
    if (Number.isFinite(quota) && quota < min) issues.push(`Kuota WhatsApp tinggal ${quota} pesan.`);
    if (left != null && left <= 3) issues.push(left < 0 ? "Paket WhatsApp sudah kedaluwarsa." : left === 0 ? "Paket WhatsApp kedaluwarsa hari ini." : `Paket WhatsApp kedaluwarsa ${left} hari lagi (${fmtDate(exp)}).`);
  }
  return { exp, left, quota: wa.quota, issues };
}

// Peringatan di atas semua halaman admin.
export function WaAlert({ wa, settings }) {
  const i = waInfo(wa, settings?.wa_alert?.min_quota ?? 100);
  if (!i?.issues.length) return null;
  return <div className="banner warn wa-alert" role="status"><b>WhatsApp:</b> {i.issues.join(" ")} <a href="#dashboard">Top up di Dashboard</a></div>;
}

// Kartu di Dashboard: sisa kuota, kedaluwarsa, tombol top up.
export function WaCard({ wa, reloadWa, settings, billing, toast }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [pending, setPending] = useState([]);
  const i = waInfo(wa, settings?.wa_alert?.min_quota ?? 100);
  const loadPending = () => listInvoices(20).then(l => setPending(l.filter(t => t.kind === "topup" && ["unpaid", "review"].includes(t.status)))).catch(() => {});
  useEffect(() => { loadPending(); }, []);
  const recheck = async () => { setBusy(true); await reloadWa(); setBusy(false); };
  return (<section className="wa-card">
    <div className="wa-h"><span className={`wa-dot ${wa?.ok && wa.connected ? "on" : "off"}`} aria-hidden="true" /><b>WhatsApp</b>
      <span className="meta">{!wa ? "Memuat…" : !wa.ok ? "Bermasalah" : wa.connected ? `Terhubung · ${wa.device}` : "Terputus"}</span></div>
    <div className="wa-nums"><div><span>Sisa kuota</span><b className={i?.issues.some(x => /Kuota/.test(x)) ? "bad" : ""}>{wa?.ok ? Number(wa.quota).toLocaleString("id-ID") || wa.quota : "–"}</b><small>pesan</small></div>
      <div><span>Kedaluwarsa</span><b className={i?.left != null && i.left <= 3 ? "bad" : ""}>{fmtDate(i?.exp)}</b><small>{i?.left != null ? (i.left < 0 ? "sudah lewat" : i.left === 0 ? "hari ini" : `${i.left} hari lagi`) : ""}</small></div></div>
    <div className="row"><button className="btn primary" onClick={() => setOpen(true)}>Top up</button><button className="btn ghost" disabled={busy} onClick={recheck}>{busy ? "Mengecek…" : "Cek ulang"}</button></div>
    {pending.length > 0 && <div className="wa-pending">{pending.map(t => <button key={t.id} className="linkish" onClick={() => setOpen(t)}>
      <Pill s={TOPUP_PILL[t.status]}>{TOPUP_LABEL[t.status]}</Pill> #{t.number} · {rp(t.total)}</button>)}</div>}
    {open && <TopupForm billing={billing} resume={typeof open === "object" ? open : null} toast={toast} onClose={() => { setOpen(false); loadPending(); }} />}
  </section>);
}

// Form top up: pilih paket -> instruksi bayar -> unggah bukti transfer.
function TopupForm({ billing, resume, toast, onClose }) {
  const cfg = billing?.topup || {}, pkgs = cfg.packages || [];
  const [sel, setSel] = useState(0), [note, setNote] = useState(""), [req, setReq] = useState(resume), [file, setFile] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const run = async fn => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr(e.message); } setBusy(false); };
  const ajukan = () => run(async () => setReq(await createTopupInvoice(sel, note.trim())));
  const kirimBukti = () => run(async () => { if (!file) throw new Error("Pilih foto bukti transfer dulu"); setReq(await submitProof(req, file)); toast?.("Bukti transfer terkirim. Kuota bertambah setelah diproses."); });
  const step = !req ? 1 : req.status === "unpaid" ? 2 : 3;
  return (<Modal title="Top up kuota WhatsApp" onClose={onClose}
    footer={step === 1 ? <><button className="btn ghost" onClick={onClose}>Batal</button><button className="btn primary" disabled={busy || !pkgs.length} onClick={ajukan}>{busy ? "Mengajukan…" : "Ajukan top up"}</button></>
      : step === 2 ? <><button className="btn ghost" onClick={onClose}>Nanti saja</button><button className="btn ok" disabled={busy} onClick={kirimBukti}>{busy ? "Mengirim…" : "Kirim bukti transfer"}</button></>
      : <button className="btn primary" onClick={onClose}>Selesai</button>}>
    <ol className="topup-steps" aria-label="Langkah top up">{["Pilih paket", "Bayar", "Diproses"].map((t, i) => <li key={t} className={step > i + 1 ? "done" : step === i + 1 ? "now" : ""}>{t}</li>)}</ol>
    {step === 1 && (pkgs.length ? <>
      <div className="pkgs" role="radiogroup" aria-label="Paket top up">{pkgs.map((p, i) => <label key={i} className={`pkg ${sel === i ? "on" : ""}`}>
        <input type="radio" name="pkg" checked={sel === i} onChange={() => setSel(i)} /><div><b>{p.name}</b>{p.desc && <div className="meta">{p.desc}</div>}</div><span className="pkg-price">{rp(p.price)}</span></label>)}</div>
      <label className="lbl" htmlFor="tp-note">Catatan (opsional)</label><input id="tp-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Mis. untuk persiapan festive" /></>
      : <p className="note">Paket top up belum tersedia. Hubungi penyedia layanan.</p>)}
    {step >= 2 && req && <div className="tp-sum"><div><span className="lbl">Invoice</span><b>#{req.number}</b></div><div><span className="lbl">Paket</span><b>{req.items?.[0]?.name}</b></div><div><span className="lbl">Total bayar</span><b className="tp-total">{rp(req.total)}</b></div>
      <a className="btn ghost sm" href={invoiceUrl(req.token)} target="_blank" rel="noopener">Lihat invoice</a></div>}
    {step === 2 && <>
      <div className="tp-pay"><span className="lbl">Cara bayar</span><div style={{ whiteSpace: "pre-line" }}>{cfg.payment || "Instruksi pembayaran belum tersedia. Hubungi penyedia layanan."}</div></div>
      <div className="row"><label className="btn ghost" htmlFor="tp-proof">{file ? "Ganti foto" : "Pilih foto bukti transfer"}</label>
        <input id="tp-proof" type="file" accept="image/*" hidden onChange={e => setFile(e.target.files[0] || null)} />{file && <span className="meta">{file.name}</span>}</div></>}
    {step === 3 && <div className="banner ok">{req.status === "paid" ? "Top up selesai. Tekan Cek ulang di kartu WhatsApp untuk melihat kuota terbaru." : "Bukti transfer sudah diterima. Kuota & masa aktif WhatsApp bertambah setelah diproses (biasanya beberapa jam di jam kerja)."}
      {req.proof_path && <> <a href={proofUrl(req.proof_path)} target="_blank" rel="noopener">Lihat bukti</a></>}</div>}
    {err && <p className="ferr" role="alert">{err}</p>}
  </Modal>);
}
