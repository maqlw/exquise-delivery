import { useEffect, useMemo, useRef, useState } from "react";
import Lacak from "./Lacak.jsx";
import { Logo, useToast } from "../components/ui.jsx";
import { sb, fromDb } from "../lib/api.js";
import { plan, TUNE, setExtVia, dmy } from "../lib/logic.js";

// Pantau internal tanpa login (/pantau/<token>): halaman Lacak yang sama, hanya-lihat, diperbarui tiap 1 menit.
export default function InternalTrack({ token }) {
  const [d, setD] = useState(null), [err, setErr] = useState(""), [at, setAt] = useState(null), [busy, setBusy] = useState(false);
  const [ui, setUi] = useState({ q: "", lacak: null, origin: "ck", batch: 1 }), [toastEl, toast] = useToast(), date = useRef(null);
  async function load(day = date.current) {
    setBusy(true);
    const { data, error } = await sb.rpc("internal_day", { p_token: token, p_date: day });
    setBusy(false);
    if (error) return setErr(/berlaku/.test(error.message) ? "Link ini sudah tidak berlaku. Minta link baru ke admin." : "Gagal memuat: " + error.message);
    if (data.settings.tuning) Object.assign(TUNE, data.settings.tuning);
    setExtVia(data.settings.ext_couriers || []);
    date.current = data.date; setErr(""); setD(data); setAt(new Date());
  }
  useEffect(() => { load(); const t = setInterval(() => load(), 60000); return () => clearInterval(t); }, []);
  const ctx = useMemo(() => {
    if (!d) return null;
    const orders = d.orders.map(fromDb), origins = Object.fromEntries(d.origins.map(o => [o.id, o])), sent = {};
    for (const r of d.routes) ((sent[r.origin_id + "|" + r.batch] ||= {})[r.courier_id] = [...r.route_stops].sort((a, b) => a.seq - b.seq).map(s => s.order_id));
    return { orders, origins, couriers: d.couriers, routes: d.routes, positions: Object.fromEntries(d.positions.map(p => [p.courier_id, p])),
      P: plan(orders, origins, d.couriers, sent, d.settings.auto_dispatch?.on === true), readOnly: true, toast, act: {} };
  }, [d]);
  return (<div style={{ minHeight: "100%", background: "var(--bg)" }}><div className="pubhead"><Logo h={56} /></div>
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 16px 48px" }}>
      {err ? <section className="panel"><h1 style={{ fontSize: 22 }}>Pantau pengiriman</h1><p className="sub">{err}</p></section>
        : !ctx ? <p className="note">Memuat…</p>
        : <><div className="row between" style={{ marginBottom: 8, gap: 8 }}><span className="meta">Internal Exquise · hanya lihat · No HP pelanggan disamarkan</span>
            <div className="row" style={{ gap: 8 }}><select aria-label="Tanggal kirim" value={d.date} onChange={e => { setUi({ ...ui, lacak: null }); load(e.target.value); }}>
              {[...new Set([d.date, ...d.dates])].map(x => <option key={x} value={x}>{dmy(x)}</option>)}</select>
              <button className="btn ghost sm" disabled={busy} onClick={() => load()}>{busy ? "Memuat…" : `Muat ulang · ${at.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`}</button></div></div>
          <Lacak {...ctx} ui={ui} setUi={setUi} /></>}
    </div>{toastEl}</div>);
}
