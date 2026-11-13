import { useEffect, useState } from "react";
import MapSVG from "../components/MapSVG.jsx";
import { Timeline, Pill, Logo } from "../components/ui.jsx";
import { sb, proofUrl } from "../lib/api.js";
import { VIA, LABEL, hhmm } from "../lib/logic.js";

// Halaman lacak untuk customer: tanpa login, hanya data pesanan ini.
export default function TrackPublic({ token }) {
  const [d, setD] = useState(undefined);
  useEffect(() => {
    const get = () => sb.rpc("track", { p_token: token }).then(({ data }) => setD(data ?? null));
    get(); const t = setInterval(get, 20000); return () => clearInterval(t);
  }, [token]);
  const shell = body => (<div style={{ minHeight: "100%", background: "var(--bg)" }}>
    <div className="pubhead"><Logo h={72} /></div>
    <div className="public">{body}</div></div>);
  if (d === undefined) return shell(<p className="sub"><span className="spin" /> Memuat pesanan…</p>);
  if (d === null) return shell(<section className="panel"><h1>Pesanan tidak ditemukan</h1><p className="sub">Link lacak tidak valid. Periksa kembali link dari WhatsApp, atau hubungi Exquise Patisserie.</p></section>);
  const s = ["jalan", "sampai", "gagal", "siap"].includes(d.status) ? d.status : "draft", now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  const eta = d.eta_minutes != null ? nowMin + d.eta_minutes : d.planned_eta_min, live = d.eta_minutes != null;
  const steps = [
    ["Pesanan dikonfirmasi", "", "done"],
    ["Kue dikemas, rute disusun", d.courier ? `Kurir ${d.courier}` : "", ["siap", "jalan", "sampai", "gagal"].includes(s) ? "done" : "now"],
    ["Kurir dalam perjalanan", s === "jalan" ? "Kurir sedang menuju alamatmu" : s === "siap" && d.route_started ? `Kurir sudah berangkat${d.ahead ? `, ${d.ahead} pengiriman lagi sebelum pesananmu` : ""}` : "", s === "jalan" ? "now" : ["sampai", "gagal"].includes(s) ? "done" : ""],
    s === "gagal" ? ["Belum berhasil diantar", `${d.fail_reason || ""}. Tim Exquise akan menghubungi.`, "fail"] : ["Pesanan sampai", "", s === "sampai" ? "done" : ""],
  ];
  const pct = { draft: 10, siap: 36, jalan: 68, sampai: 100, gagal: 68 }[s];
  return shell(<div className="stack trackpage">
    <section className="panel fadeup"><div className="row between"><div><h1 style={{ fontSize: 22 }}>Pesanan untuk {d.recipient}</h1><p className="sub">{d.item} · dari {d.sender}</p></div><Pill s={s}>{LABEL[s]}</Pill></div>
      <div className={`trk ${s}`} aria-hidden="true">
        <div className="road"><i style={{ width: `${pct}%` }} /></div>
        <span className="van" style={{ left: `calc(${pct}% - 22px)` }}>{s === "sampai" ? <svg viewBox="0 0 24 24" width="26" height="26"><circle cx="12" cy="12" r="11" fill="var(--ok)" /><path d="m7 12.5 3.2 3L17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          : <svg viewBox="0 0 44 28" width="44" height="28"><path d="M2 6h24v14H2z" fill="var(--accent)" /><path d="M26 10h8l6 6v4H26z" fill="#0f1b13" /><path d="M29 12h4l3 3h-7z" fill="#bfe8cc" /><circle cx="10" cy="22" r="3.6" fill="#0f1b13" /><circle cx="32" cy="22" r="3.6" fill="#0f1b13" /><path d="M7 11h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>}</span>
        <div className="pins"><span>Dikemas</span><span>Diantar</span><span>Sampai</span></div></div>
      {s === "sampai" ? <div className="etabig" style={{ color: "var(--ok)" }}>Sudah sampai</div>
        : s === "gagal" ? <div className="etabig" style={{ color: "var(--bad)", fontSize: 34 }}>Belum berhasil diantar</div>
        : eta != null ? <div className="etabig">{hhmm(eta)} <small>{live ? "perkiraan tiba" : "rencana tiba"}</small></div>
        : <div className="etabig" style={{ fontSize: 24 }}>Jadwal antar sedang disusun</div>}
      <Timeline steps={steps} />
      {d.via !== "internal" && d.via !== "pickup" && d.ext_link && <a className="btn primary big" href={d.ext_link} target="_blank" rel="noopener">Lacak driver di {VIA[d.via]}</a>}
      {d.proof_path && <div><div className="lbl">Foto bukti terima</div><img className="proof" src={proofUrl(d.proof_path)} alt="Foto bukti terima" /></div>}</section>
    <section className="panel fadeup" style={{ animationDelay: ".12s" }}><h2>Detail pengiriman</h2>
      <dl className="info">
        <dt>Pengirim</dt><dd>{d.sender || "–"}</dd>
        <dt>Penerima</dt><dd>{d.recipient}</dd>
        <dt>Alamat penerima</dt><dd>{d.address}</dd>
        <dt>Pesanan</dt><dd>{d.item}</dd>
        {s === "sampai" && d.receiver_name && <><dt>Diterima oleh</dt><dd>{d.receiver_name}</dd></>}
        <dt>Kode</dt><dd className="mono">{d.code}</dd></dl></section>
    {d.lat != null && <section className="panel fadeup" style={{ animationDelay: ".24s" }}><h2>Posisi kurir</h2>
      <MapSVG origin={d.courier_pos || { lat: d.lat, lng: d.lng }} routes={[{ color: "var(--accent)", pts: [{ lat: d.lat, lng: d.lng }], pos: s === "jalan" ? d.courier_pos : null }]} label={false} showOrigin={false} title="Posisi kurir dan alamat tujuan" />
      <p className="note">{s === "jalan" && d.courier_pos ? "Titik hitam = posisi kurir. Halaman ini diperbarui otomatis setiap 20 detik." : "Posisi kurir tampil saat pesanan dalam perjalanan."}</p></section>}
    <p className="note" style={{ textAlign: "center" }}>Terima kasih sudah memesan di Exquise Patisserie.</p>
  </div>);
}
