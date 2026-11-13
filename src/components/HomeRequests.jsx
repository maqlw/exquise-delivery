import { useState } from "react";
import { decideHome } from "../lib/api.js";
import { fmtTime } from "../lib/logic.js";

// Kurir yang minta izin langsung pulang (tidak kembali ke outlet) menunggu keputusan admin.
export default function HomeRequests({ routes, couriers, origins, reload, toast }) {
  const [busy, setBusy] = useState(null);
  const list = routes.filter(r => r.return_status === "menunggu");
  if (!list.length) return null;
  const decide = async (r, ok) => {
    setBusy(r.id);
    try { await decideHome(r.id, ok); await reload(); toast(ok ? "Izin pulang disetujui, rute selesai" : "Izin pulang ditolak, kurir diminta kembali ke outlet"); }
    catch (e) { toast("Gagal: " + e.message); }
    setBusy(null);
  };
  return (<section className="panel homereq" aria-live="polite"><h2>Minta izin langsung pulang · {list.length}</h2>
    {list.map(r => { const c = couriers.find(x => x.id === r.courier_id); return (
      <div key={r.id} className="row between homereq-row"><div><b>{c?.name || "Kurir"}</b> · Batch {r.batch} · {origins[r.origin_id]?.short}
        <div className="meta">Semua alamat selesai{r.stops_done_at ? ` jam ${fmtTime(r.stops_done_at)}` : ""} · minta izin jam {fmtTime(r.return_requested_at)}{r.return_note ? ` · "${r.return_note}"` : ""}</div></div>
        <div className="row"><button className="btn ok sm" disabled={busy === r.id} onClick={() => decide(r, true)}>Setujui</button><button className="btn ghost sm danger" disabled={busy === r.id} onClick={() => decide(r, false)}>Tolak, kembali ke outlet</button></div></div>); })}
  </section>);
}
