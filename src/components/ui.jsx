import { useCallback, useEffect, useRef, useState } from "react";
import { LABEL, status } from "../lib/logic.js";

export const Pill = ({ s, children, className = "" }) => <span className={`pill ${s || ""} ${className}`}>{children ?? LABEL[s]}</span>;
export const StatusPill = ({ o }) => { const s = status(o); return <Pill s={s} />; };
export const Phone = ({ p, none = "tanpa No HP" }) => p ? <div className="meta mono">{p}</div> : <div className="meta">{none}</div>;
export const Field = ({ id, label, full, children }) => <div className={`fld ${full ? "full" : ""}`}><label htmlFor={id}>{label}</label>{children}</div>;
// Detail satu alamat di daftar rute (admin & kurir): penerima, pengirim, alamat, produk.
export const StopInfo = ({ o }) => (<div className="stopinfo">
  <div className="addr">{o.recipient}{o.merged > 1 && <> <Pill>{o.merged} item</Pill></>}</div>
  <div className="meta"><b>Penerima</b> {o.recipient} · {o.phone ? <a className="mono" href={`tel:+${o.phone}`}>+{o.phone}</a> : "tanpa No HP"}</div>
  <div className="meta"><b>Pengirim</b> {o.sender || "–"}{o.phoneSender ? <> · <a className="mono" href={`tel:+${o.phoneSender}`}>+{o.phoneSender}</a></> : ""}</div>
  <div className="meta"><b>Alamat</b> {o.address}</div>
  <div className="meta"><b>Produk</b> {o.item}{o.notes ? ` · “${o.notes}”` : ""}</div>
</div>);
// Logo resmi: versi warna untuk background terang, versi terang (tulisan putih) untuk background gelap.
export const Logo = ({ light, h = 44 }) => <img src={light ? "/logo-exquise-light.png" : "/logo-exquise.png"} alt="Exquise Patisserie" height={h} style={{ display: "block", width: "auto", height: h }} />;
export const initials = n => n.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();

// Modal: lembar dari bawah di HP, kotak di tengah di laptop. Esc dan klik latar menutup.
export function Modal({ title, onClose, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const k = e => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    ref.current?.querySelector(".sheet-b input:not([readonly]), .sheet-b select, .opt:not(:disabled), .sheet-f .btn")?.focus();
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}>
        <div className="sheet-h"><h2 id="modal-title">{title}</h2><button className="x" onClick={onClose} aria-label="Tutup">×</button></div>
        <div className="sheet-b">{children}</div>
        {footer && <div className="sheet-f">{footer}</div>}
      </div>
    </div>
  );
}
export const Empty = ({ title, desc, children }) => <section className="panel empty" style={{ marginTop: 8 }}><h1>{title}</h1><p className="sub">{desc}</p><div className="row">{children}</div></section>;
export const Timeline = ({ steps }) => <ol className="tl2">{steps.map(([t, d, st], i) => <li key={i} className={st}><div className="t">{t}</div>{d && <div className="meta">{d}</div>}</li>)}</ol>;

export function useToast() {
  const [msg, setMsg] = useState("");
  const show = useCallback(m => { setMsg(m); clearTimeout(show.t); show.t = setTimeout(() => setMsg(""), 3200); }, []);
  return [msg ? <div className="toast" role="status">{msg}</div> : null, show];
}
