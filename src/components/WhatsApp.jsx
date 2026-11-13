import { useState } from "react";
import { Modal } from "./ui.jsx";
import { parseExpired, daysLeft } from "../lib/logic.js";

const FONNTE = "https://md.fonnte.com/";
const fmtDate = d => d ? d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "–";
// Ringkasan status WhatsApp Fonnte untuk kartu & peringatan.
export function waInfo(wa, min = 100) {
  if (!wa) return null;
  const exp = parseExpired(wa.expired), left = daysLeft(exp), quota = Number(wa.quota);
  const issues = [];
  if (!wa.ok) issues.push(wa.reason || "Token Fonnte bermasalah");
  else {
    if (!wa.connected) issues.push("WhatsApp terputus dari Fonnte. Sambungkan ulang di Pengaturan.");
    if (Number.isFinite(quota) && quota < min) issues.push(`Kuota WhatsApp tinggal ${quota} pesan.`);
    if (left != null && left <= 3) issues.push(left < 0 ? "Paket Fonnte sudah kedaluwarsa." : left === 0 ? "Paket Fonnte kedaluwarsa hari ini." : `Paket Fonnte kedaluwarsa ${left} hari lagi (${fmtDate(exp)}).`);
  }
  return { exp, left, quota: wa.quota, issues };
}

// Peringatan di atas semua halaman admin.
export function WaAlert({ wa, settings }) {
  const i = waInfo(wa, settings?.wa_alert?.min_quota ?? 100);
  if (!i?.issues.length) return null;
  return <div className="banner warn wa-alert" role="status"><b>WhatsApp:</b> {i.issues.join(" ")} <a href="#pengaturan">Buka Pengaturan</a></div>;
}

// Kartu di Dashboard: sisa kuota, kedaluwarsa, tombol top up.
export function WaCard({ wa, reloadWa, settings }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const i = waInfo(wa, settings?.wa_alert?.min_quota ?? 100);
  const recheck = async () => { setBusy(true); await reloadWa(); setBusy(false); };
  return (<section className="wa-card">
    <div className="wa-h"><span className={`wa-dot ${wa?.ok && wa.connected ? "on" : "off"}`} aria-hidden="true" /><b>WhatsApp</b>
      <span className="meta">{!wa ? "Memuat…" : !wa.ok ? "Bermasalah" : wa.connected ? `Terhubung · ${wa.device}` : "Terputus"}</span></div>
    <div className="wa-nums"><div><span>Sisa kuota</span><b className={i?.issues.some(x => /Kuota/.test(x)) ? "bad" : ""}>{wa?.ok ? Number(wa.quota).toLocaleString("id-ID") || wa.quota : "–"}</b><small>pesan</small></div>
      <div><span>Kedaluwarsa</span><b className={i?.left != null && i.left <= 3 ? "bad" : ""}>{fmtDate(i?.exp)}</b><small>{i?.left != null ? (i.left < 0 ? "sudah lewat" : i.left === 0 ? "hari ini" : `${i.left} hari lagi`) : ""}</small></div></div>
    <div className="row"><button className="btn primary" onClick={() => setOpen(true)}>Top up</button><button className="btn ghost" disabled={busy} onClick={recheck}>{busy ? "Mengecek…" : "Cek ulang"}</button></div>
    {open && <Modal title="Top up WhatsApp (Fonnte)" onClose={() => setOpen(false)} footer={<><button className="btn ghost" onClick={() => setOpen(false)}>Tutup</button><button className="btn ghost" disabled={busy} onClick={recheck}>{busy ? "Mengecek…" : "Sudah top up? Cek ulang"}</button></>}>
      <div className="wa-nums"><div><span>Sisa kuota</span><b>{wa?.ok ? wa.quota : "–"}</b><small>pesan</small></div><div><span>Kedaluwarsa</span><b>{fmtDate(i?.exp)}</b><small>{i?.left != null && i.left >= 0 ? `${i.left} hari lagi` : ""}</small></div></div>
      <ol className="steps">
        <li>Tekan <b>Buka halaman top up Fonnte</b>, lalu login ke akun Fonnte Exquise.</li>
        <li>Pilih perangkat <b>{wa?.name || "Exquise"}</b> ({wa?.device || "nomor WhatsApp outlet"}), lalu perpanjang paket atau tambah kuota dan bayar.</li>
        <li>Kembali ke sini dan tekan <b>Cek ulang</b>. Kuota & tanggal kedaluwarsa langsung diperbarui.</li></ol>
      <a className="btn ok big" href={FONNTE} target="_blank" rel="noopener">Buka halaman top up Fonnte ↗</a>
      <p className="note">Pembayaran dilakukan di Fonnte. Aplikasi ini tidak memotong saldo apa pun.</p></Modal>}
  </section>);
}
