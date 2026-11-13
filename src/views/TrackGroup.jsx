import { useEffect, useState } from "react";
import { Pill, Logo, Search } from "../components/ui.jsx";
import { sb } from "../lib/api.js";
import { LABEL, VIA, dmy, fmtTime } from "../lib/logic.js";

// Halaman lacak grup: 1 pemesan, banyak penerima. Tanpa login, cukup token di link.
export default function TrackGroup({ token }) {
  const [d, setD] = useState(undefined), [q, setQ] = useState("");
  useEffect(() => {
    const get = () => sb.rpc("track_group", { p_token: token }).then(({ data }) => setD(data ?? null));
    get(); const t = setInterval(get, 30000); return () => clearInterval(t);
  }, [token]);
  const shell = body => (<div style={{ minHeight: "100%", background: "var(--bg)" }}><div className="pubhead"><Logo h={72} /></div><div className="public">{body}</div></div>);
  if (d === undefined) return shell(<p className="sub"><span className="spin" /> Memuat kiriman…</p>);
  if (d === null) return shell(<section className="panel"><h1>Link tidak ditemukan</h1><p className="sub">Periksa kembali link dari WhatsApp, atau hubungi Exquise Patisserie.</p></section>);
  const list = d.orders, st = o => ["jalan", "sampai", "gagal"].includes(o.status) ? o.status : "siap";
  const n = s => list.filter(o => st(o) === s).length, pct = list.length ? Math.round(100 * (n("sampai") + n("gagal")) / list.length) : 0;
  const words = q.toLowerCase().split(/\s+/).filter(Boolean), vis = list.filter(o => words.every(w => `${o.recipient} ${o.address} ${o.item}`.toLowerCase().includes(w)));
  return shell(<div className="stack trackpage">
    <section className="panel fadeup"><h1 style={{ fontSize: 22 }}>{list.length} kiriman dari {d.sender}</h1><p className="sub">Tanggal kirim {dmy(d.ship_date)}</p>
      <div className="grp-prog" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label="Kiriman selesai"><i style={{ width: `${pct}%` }} /></div>
      <div className="grp-stats"><span><b>{n("sampai")}</b> sampai</span><span><b>{n("jalan")}</b> diantar</span><span><b>{n("siap")}</b> menunggu</span>{n("gagal") > 0 && <span className="bad"><b>{n("gagal")}</b> gagal</span>}</div>
      {pct === 100 && <div className="banner ok">Semua kiriman sudah selesai diantar.</div>}</section>
    <section className="panel fadeup" style={{ animationDelay: ".1s" }}><h2>Daftar penerima</h2>
      {list.length > 5 && <Search value={q} onChange={setQ} placeholder="Cari nama penerima atau alamat" label="Cari penerima" count={vis.length} />}
      <ol className="grp-list">{vis.map(o => <li key={o.token}><a href={`/lacak/${o.token}`}>
        <div style={{ minWidth: 0 }}><div className="addr">{o.recipient}</div><div className="meta">{o.item}</div><div className="meta">{o.address}</div>
          <div className="meta">{o.status === "sampai" ? `Diterima ${o.receiver_name || ""} · ${fmtTime(o.delivered_at)}` : o.status === "gagal" ? `Belum berhasil: ${o.fail_reason || "-"}` : o.status === "jalan" ? `Diantar sejak ${fmtTime(o.sent_at)}` : o.via !== "internal" ? `Lewat ${VIA[o.via]}` : "Menunggu diantar"}</div></div>
        <Pill s={st(o)}>{st(o) === "siap" ? "Menunggu" : LABEL[st(o)]}</Pill></a></li>)}</ol>
      {!vis.length && <p className="note">Tidak ada penerima yang cocok.</p>}</section>
    <p className="note" style={{ textAlign: "center" }}>Halaman ini diperbarui otomatis setiap 30 detik. Ketuk nama penerima untuk melihat detail & perkiraan tiba.</p>
  </div>);
}
