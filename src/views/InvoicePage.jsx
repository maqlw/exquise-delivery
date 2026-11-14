import { useEffect, useState } from "react";
import { sb } from "../lib/api.js";
import { dmy } from "../lib/logic.js";

const rp = n => n == null ? "-" : "Rp " + Number(n).toLocaleString("id-ID");
const ddmmyyyy = d => d ? dmy(String(d).slice(0, 10)) : "-";
const LABEL = { unpaid: "Unpaid", review: "Menunggu verifikasi", paid: "Paid", void: "Dibatalkan" };

// Isi invoice (format sama dengan PDF penyedia): dipakai halaman publik & pratinjau di panel penyedia.
export function InvoiceDoc({ inv }) {
  const paid = inv.status === "paid", items = inv.items || [];
  return (<article className={`inv ${paid ? "is-paid" : ""}`}>
    <div className="inv-bar" />
    <header className="inv-head">
      <div className="inv-brand"><img src="/kdn-logo.png" alt="" width="48" height="48" /><div><div className="inv-co">{inv.company || "Kreasi Digital Nusantara"}</div><div className="inv-sub">{inv.kind === "topup" ? "Top up WhatsApp Gateway" : "Matrix Delivery Subscription"}</div></div></div>
      <div className="inv-no"><span className="inv-tag">INVOICE</span><b>#{inv.number}</b><div>Tanggal: {ddmmyyyy(inv.issued_on)}</div>{inv.active_until && <div>Batas Aktif: {ddmmyyyy(inv.active_until)}</div>}</div>
    </header>
    {paid && <div className="inv-stamp" aria-label="Lunas">LUNAS · PAID</div>}
    <section className="inv-box inv-two">
      <div><div className="inv-lbl">Ditagihkan kepada</div><div>{inv.customer || "-"}</div></div>
      <div><div className="inv-lbl">Detail invoice</div><div>{items[0]?.name || "-"}</div><div>Status: <b className={paid ? "ok" : ""}>{LABEL[inv.status]}</b></div>
        {inv.active_until && <div>Batas Aktif: {ddmmyyyy(inv.active_until)}</div>}
        {paid && <div>Dibayar: {ddmmyyyy(inv.paid_at)}{inv.paid_method ? ` · ${inv.paid_method}` : ""}{inv.paid_ref ? ` · Ref ${inv.paid_ref}` : ""}</div>}</div>
    </section>
    <section className="inv-box"><div className="inv-h">Rincian Paket</div>
      <table className="inv-t"><thead><tr><th>Deskripsi</th><th>Harga Normal</th><th>Harga Promo</th></tr></thead><tbody>
        {items.map((it, i) => <tr key={i}><td><b>{it.name}</b>{it.desc && <div className="inv-d">{it.desc}</div>}</td><td className="r">{it.normal ? rp(it.normal) : "-"}</td><td className="r">{rp(it.price)}</td></tr>)}
        <tr><td>Status pembayaran</td><td className="r">-</td><td className="r">{paid ? <span className="inv-paid">PAID</span> : LABEL[inv.status]}</td></tr></tbody></table></section>
    <section className="inv-box"><div className="inv-h">Ringkasan Pembayaran</div>
      <table className="inv-t inv-sum"><tbody><tr><td className="r">Sub Total</td><td className="r">{rp(inv.subtotal)}</td></tr><tr><td className="r">Kredit</td><td className="r">{rp(inv.credit)}</td></tr>
        <tr className="tot"><td className="r">Total</td><td className="r">{rp(inv.total)}</td></tr></tbody></table></section>
    <p className="inv-foot">{paid ? `Invoice ini telah LUNAS pada ${ddmmyyyy(inv.paid_at)}. Terima kasih.` : `Invoice ini dihasilkan otomatis oleh sistem Matrix Delivery pada tanggal ${ddmmyyyy(inv.issued_on)}.`}</p>
  </article>);
}

// Halaman publik /invoice/<token>: bisa dibuka tanpa login, diunduh sebagai PDF lewat cetak browser.
export default function InvoicePage({ token }) {
  const [inv, setInv] = useState(undefined);
  useEffect(() => { sb.rpc("invoice_public", { p_token: token }).then(({ data }) => setInv(data ?? null)); }, [token]);
  useEffect(() => { if (inv) document.title = `Invoice #${inv.number}`; }, [inv]);
  if (inv === undefined) return <div className="login"><span className="spin" aria-label="Memuat" /></div>;
  if (inv === null) return <div className="inv-page"><section className="panel"><h1>Invoice tidak ditemukan</h1><p className="sub">Periksa kembali link invoice yang kamu terima.</p></section></div>;
  const open = ["unpaid", "review"].includes(inv.status);
  return (<div className="inv-page">
    <div className="inv-actions no-print">
      <button className="btn ghost" onClick={() => print()}>Unduh PDF</button>
      {inv.status === "paid" && <span className="btn ok inv-btn-paid" aria-label="Status lunas">✓ PAID</span>}
      {open && inv.pay_link && <a className="btn primary" href={inv.pay_link} target="_blank" rel="noopener">Bayar sekarang ↗</a>}
    </div>
    {open && !inv.pay_link && inv.payment && <div className="inv-payinfo no-print"><b>Cara bayar</b><div style={{ whiteSpace: "pre-line" }}>{inv.payment}</div></div>}
    {inv.status === "review" && <div className="banner warn no-print">Bukti transfer sudah diterima dan sedang diverifikasi.</div>}
    <InvoiceDoc inv={inv} />
  </div>);
}
