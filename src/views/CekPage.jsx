import { useState } from "react";
import { Logo, Field } from "../components/ui.jsx";
import { sb } from "../lib/api.js";
import { dmy } from "../lib/logic.js";
import { GroupList } from "./TrackGroup.jsx";

// /cek: tanpa login. Pemesan isi No HP lengkap + nama -> semua kiriman 30 hari terakhir, dikelompokkan per tanggal kirim.
export default function CekPage() {
  const [f, setF] = useState({ phone: "", name: "" }), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [list, setList] = useState(null);
  async function cek(e) {
    e.preventDefault(); setBusy(true); setErr("");
    const { data, error } = await sb.rpc("track_lookup", { p_phone: f.phone, p_name: f.name });
    setBusy(false);
    if (error || data?.error) return setErr(data?.error || "Gagal memeriksa. Coba lagi sebentar.");
    setList(data.orders);
  }
  const dates = list ? [...new Set(list.map(o => o.ship_date))] : [];
  return (<div style={{ minHeight: "100%", background: "var(--bg)" }}><div className="pubhead"><Logo h={72} /></div>
    <div className="public"><div className="stack trackpage">
      {!list ? <section className="panel fadeup"><h1 style={{ fontSize: 22 }}>Cek pengiriman</h1>
        <p className="sub">Masukkan No HP dan nama pemesan seperti saat memesan. Kiriman 30 hari terakhir akan tampil.</p>
        <form className="form" onSubmit={cek} style={{ marginTop: 12 }}>
          <Field id="c-ph" full label="No HP pemesan"><input id="c-ph" inputMode="tel" autoComplete="tel" placeholder="08…" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} required /></Field>
          <Field id="c-nm" full label="Nama pemesan"><input id="c-nm" autoComplete="name" placeholder="Nama sesuai pesanan" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required /></Field>
          {err && <p className="ferr full" role="alert">{err}</p>}
          <button className="btn primary big full" disabled={busy}>{busy ? "Memeriksa…" : "Cek pengiriman"}</button></form></section>
      : <>{dates.map(dt => { const g = list.filter(o => o.ship_date === dt);
          return <GroupList key={dt} list={g} title={`Kiriman ${dmy(dt)}`} sub={`${g.length} penerima · dari ${g[0].sender}`} />; })}
        <button className="btn ghost" onClick={() => { setList(null); setF({ phone: "", name: "" }); }}>Cek nomor lain</button></>}
      <p className="note" style={{ textAlign: "center" }}>Data dijaga: tanpa No HP dan nama yang cocok, kiriman tidak ditampilkan.</p>
    </div></div></div>);
}
