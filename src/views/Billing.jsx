import { useEffect, useState } from "react";
import { listInvoices, invoiceUrl } from "../lib/api.js";
import { dmy } from "../lib/logic.js";
import { Pill } from "../components/ui.jsx";
import { INV_LABEL, INV_PILL, SVC } from "./ProviderApp.jsx";

const rp = n => "Rp " + Number(n || 0).toLocaleString("id-ID");

// Banner di atas semua halaman admin saat masa tenggang / nonaktif.
export function ServiceBanner({ svc }) {
  if (!svc || svc.status === "aktif") return null;
  return svc.status === "tenggang"
    ? <div className="banner warn" role="status"><b>Langganan Matrix Delivery melewati batas aktif ({dmy(svc.active_until)}).</b> Masa tenggang sampai {dmy(svc.grace_until)}. Segera lunasi tagihan supaya layanan tidak terhenti. <a href="#tagihan">Lihat tagihan</a></div>
    : <div className="banner bad" role="alert"><b>Langganan Matrix Delivery nonaktif.</b> Upload, tambah pesanan, dan kirim rute dikunci; lihat & lacak tetap bisa. Lunasi tagihan untuk mengaktifkan kembali. <a href="#tagihan">Lihat tagihan</a></div>;
}

// Menu Tagihan (admin Exquise): status langganan & daftar invoice. Hanya lihat, bayar, unduh.
export default function Billing({ svc, toast }) {
  const [inv, setInv] = useState(null);
  useEffect(() => { listInvoices().then(setInv).catch(e => toast(e.message)); }, []);
  const s = SVC[svc?.status] || SVC.aktif, open = (inv || []).filter(i => ["unpaid", "review"].includes(i.status));
  return (<>
    <h1>Tagihan</h1><p className="sub">Langganan Matrix Delivery & top up WhatsApp.</p>
    <section className="prov-hero" style={{ marginTop: 16 }}><span className="eyebrow"><span className={`wa-dot ${svc?.status === "aktif" ? "on" : "off"}`} /> {s[1].toUpperCase()}</span>
      <h1>{svc?.days_left >= 0 ? `${svc.days_left} hari tersisa` : svc?.status === "tenggang" ? "Masa tenggang" : svc ? "Nonaktif" : "…"}</h1>
      <p>Masa aktif sampai {dmy(svc?.active_until)}{svc?.status !== "aktif" ? ` · tenggang sampai ${dmy(svc?.grace_until)}` : ""}</p>
      <div className="prov-kv"><div><span>Tagihan belum lunas</span><b>{open.length}</b></div><div><span>Total belum lunas</span><b>{rp(open.reduce((a, i) => a + i.total, 0))}</b></div></div></section>
    <section className="panel" style={{ marginTop: 16 }}><h2>Invoice</h2>
      {!inv ? <p className="note">Memuat…</p> : !inv.length ? <p className="note">Belum ada invoice.</p>
        : <ul className="hist">{inv.filter(i => i.status !== "void").map(i => <li key={i.id} className="inv-row">
          <div><b>#{i.number}</b> <Pill s={INV_PILL[i.status]}>{INV_LABEL[i.status]}</Pill> <span className="meta">{i.kind === "topup" ? "Top up WhatsApp" : "Langganan"}</span>
            <div className="meta">{dmy(i.issued_on)} · {rp(i.total)}{i.active_until ? ` · batas aktif ${dmy(i.active_until)}` : ""}{i.paid_at ? ` · lunas ${dmy(i.paid_at.slice(0, 10))}` : ""}</div></div>
          <div className="row"><a className={`btn sm ${["unpaid", "review"].includes(i.status) ? "primary" : "ghost"}`} href={invoiceUrl(i.token)} target="_blank" rel="noopener">{i.status === "unpaid" ? "Lihat & bayar" : "Lihat / unduh"}</a></div></li>)}</ul>}
    </section></>);
}
