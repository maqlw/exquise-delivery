import { useCallback, useEffect, useRef, useState } from "react";
import MapSVG from "../components/MapSVG.jsx";
import { Pill, StopInfo, Logo } from "../components/ui.jsx";
import { SampaiForm } from "../components/OrderModals.jsx";
import { sb, fromDb, uploadProof, notify } from "../lib/api.js";
import { BATCH, FAIL_REASONS, LABEL, hhmm, dmy, todayYmd } from "../lib/logic.js";
import { useToast } from "../components/ui.jsx";

const PING_MS = 30000;

export default function CourierScreen() {
  const [toastEl, toast] = useToast();
  const [me, setMe] = useState(null), [origins, setOrigins] = useState({}), [routes, setRoutes] = useState(null), [sel, setSel] = useState(null);
  const [modal, setModal] = useState(null), [fail, setFail] = useState(null), [pick, setPick] = useState(null), [busy, setBusy] = useState(false), [gps, setGps] = useState("");
  const load = useCallback(async () => {
    const [{ data: c }, { data: og }] = await Promise.all([sb.from("couriers").select("*").maybeSingle(), sb.from("origins").select("*")]);
    setMe(c); setOrigins(Object.fromEntries((og || []).map(o => [o.id, o])));
    if (!c) return setRoutes([]);
    const { data } = await sb.from("routes").select("*, route_stops(seq, eta_min, orders(*))").eq("courier_id", c.id).order("ship_date", { ascending: false }).order("batch").limit(9);
    const today = new Date().toDateString(); // rute yang baru selesai hari ini tetap tampil sebagai ringkasan
    const list = (data || []).filter(r => r.ship_date === todayYmd() || !r.finished_at || new Date(r.finished_at).toDateString() === today)
      .map(r => ({ ...r, stops: r.route_stops.sort((a, b) => a.seq - b.seq).map(s => ({ ...fromDb(s.orders), eta: s.eta_min })) }));
    setRoutes(list); setSel(s => list.some(r => r.id === s) ? s : (list.find(r => !r.finished_at) || list[0])?.id || null);
  }, []);
  useEffect(() => { load(); }, [load]);

  // GPS dikirim selama ada rute yang sedang berjalan dan halaman ini terbuka.
  const active = routes?.some(r => r.started_at && !r.finished_at), last = useRef(0);
  useEffect(() => {
    if (!active) return;
    if (!navigator.geolocation) { setGps("HP ini tidak mendukung GPS."); return; }
    const id = navigator.geolocation.watchPosition(async p => {
      setGps("GPS aktif");
      if (Date.now() - last.current < PING_MS) return;
      last.current = Date.now();
      await sb.rpc("courier_ping", { p_lat: p.coords.latitude, p_lng: p.coords.longitude });
    }, e => setGps(e.code === 1 ? "Izin lokasi ditolak. Aktifkan lokasi untuk Exquise Delivery di pengaturan browser." : "Sinyal GPS belum didapat."), { enableHighAccuracy: true, maximumAge: 15000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [active]);

  if (!routes) return <div className="login"><span className="spin" aria-label="Memuat" /></div>;
  const r = routes.find(x => x.id === sel), org = r && origins[r.origin_id];
  const left = r ? r.stops.filter(o => ["siap", "jalan"].includes(o.ship)) : [];
  // Alamat yang sedang dituju dulu; kalau belum ada, pilihan kurir atau urutan sistem.
  const next = left.find(o => o.ship === "jalan") || left.find(o => o.id === pick) || left[0], others = left.filter(o => o !== next && o.ship === "siap"), done = r ? r.stops.filter(o => ["sampai", "gagal"].includes(o.ship)) : [];
  async function run(fn, okMsg) { setBusy(true); try { await fn(); if (okMsg) toast(okMsg); await load(); } catch (e) { toast(e.message); } setBusy(false); }
  const start = () => run(async () => {
    const { error } = await sb.rpc("courier_start", { p_route: r.id }); if (error) throw new Error(error.message);
    toast("GPS aktif. Tekan Kirim di alamat pertama saat berangkat ke sana.");
  });
  const kirim = o => run(async () => {
    const { error } = await sb.rpc("courier_mark", { p_order: o.id, p_status: "jalan" }); if (error) throw new Error(error.message);
    const res = await notify(o.id, "kirim"), n = (res.results || []).filter(x => x.sent).length;
    toast(n ? `${n} WhatsApp terkirim ke ${o.recipient} & pemesan` : "Status dikirim. Tidak ada No HP, WhatsApp tidak terkirim.");
  });
  const mark = async (o, st, extra) => {
    const { error } = await sb.rpc("courier_mark", { p_order: o.id, p_status: st, p_reason: extra.reason || null, p_proof: extra.path || null, p_receiver_name: extra.name || null, p_receiver_relation: extra.rel || null });
    if (error) throw new Error(error.message);
    await notify(o.id, st);
  };
  const header = (
    <div className="side" style={{ width: "auto", position: "sticky", top: 0, zIndex: 6, background: "#0b120e", flexDirection: "row", alignItems: "center", padding: "12px max(16px, env(safe-area-inset-left, 0px))" }}>
      <div className="brand" style={{ flex: 1 }}><Logo light h={50} /></div>
      <button className="btn sm" style={{ background: "#1d2a22", color: "#fff" }} onClick={() => sb.auth.signOut()}>Keluar</button></div>);
  return (<div style={{ minHeight: "100%", background: "var(--bg)" }}>{header}<main>
    <h1>Halo, {me?.name || "kurir"}</h1>
    <p className="sub">{active ? (gps || "Menyalakan GPS…") : "GPS akan aktif setelah kamu menekan Mulai jalan."}</p>
    {routes.length > 1 && <div className="seg" role="group" aria-label="Pilih rute" style={{ marginTop: 12 }}>{routes.map(x => <button key={x.id} aria-pressed={x.id === sel} onClick={() => setSel(x.id)}>{dmy(x.ship_date)} · Batch {x.batch}</button>)}</div>}
    {!r ? <section className="panel" style={{ marginTop: 16 }}><h2>Belum ada rute untuk kamu hari ini</h2><p className="sub">Tunggu admin mengirim rute, lalu tarik halaman ini untuk memuat ulang.</p><button className="btn primary" onClick={load}>Muat ulang</button></section>
    : <div className="grid"><div className="stack">
      {!r.started_at ? <section className="panel"><h2>Batch {r.batch} · {r.stops.length} alamat · berangkat {hhmm(BATCH[r.batch].start)} dari {org?.short}</h2>
          <ol className="stops">{r.stops.map((o, i) => <li key={o.id}><span className="num" style={{ background: me.color }}>{i + 1}</span><StopInfo o={o} />
            <div className="eta">{o.eta != null ? hhmm(o.eta) : ""}{o.deadline != null && <Pill s="warn">batas {hhmm(o.deadline)}</Pill>}</div></li>)}</ol>
          <button className="btn primary big" disabled={busy} onClick={start}>{busy ? "Memproses…" : "Mulai jalan"}</button>
          <p className="note">Saat ditekan, GPS kamu mulai dikirim. WhatsApp ke pemesan & penerima dikirim per alamat, saat kamu menekan Kirim.</p></section>
      : next ? <section className="next"><span className="eyebrow">Tujuan berikutnya · {r.stops.indexOf(next) + 1} dari {r.stops.length}{next.deadline != null ? ` · batas ${hhmm(next.deadline)}` : ""}</span>
          <div className="addr">{next.address}</div><div className="meta">{next.code} · {next.item}</div>
          <div className="meta">Penerima <b>{next.recipient}</b>{next.phone ? ` · +${next.phone}` : " · tanpa No HP"}</div>
          <div className="meta">Pengirim <b>{next.sender || "–"}</b>{next.phoneSender ? <> · <a href={`tel:+${next.phoneSender}`}>+{next.phoneSender}</a></> : ""}</div>
          {next.notes && (/^edible$/i.test(next.notes) ? <span className="pill">{next.notes}</span> : <div className="wording">“{next.notes}”</div>)}
          <div className="row"><a className="btn ghost" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(next.address)}`} target="_blank" rel="noopener">Buka di Google Maps</a>
            {next.phone ? <a className="btn ghost" href={`tel:+${next.phone}`}>Telepon penerima</a> : <span className="pill">Penerima tanpa No HP</span>}
            {next.phoneSender && <a className="btn ghost" href={`tel:+${next.phoneSender}`}>Telepon pengirim</a>}</div>
          {fail === next.id ? <div className="panel"><label className="lbl" htmlFor="reason">Alasan gagal kirim</label><select id="reason" defaultValue={FAIL_REASONS[0]}>{FAIL_REASONS.map(x => <option key={x}>{x}</option>)}</select>
              <div className="row"><button className="btn bad" disabled={busy} onClick={() => run(() => mark(next, "gagal", { reason: document.getElementById("reason").value }), "Ditandai gagal kirim").then(() => setFail(null))}>Simpan gagal kirim</button><button className="btn ghost" onClick={() => setFail(null)}>Batal</button></div></div>
            : next.ship === "siap" ? <>
              <div className="row"><button className="btn primary big" style={{ flex: 1 }} disabled={busy} onClick={() => kirim(next)}>{busy ? "Mengirim…" : "Kirim · kabari pemesan & penerima"}</button><button className="btn ghost" onClick={() => setFail(next.id)}>Gagal kirim</button></div>
              <p className="note">Tekan saat berangkat ke alamat ini. Pemesan & penerima dapat WhatsApp berisi link lacak. Tombol Sudah sampai muncul setelah ini.</p>
              {others.length > 0 && <div><label className="lbl" htmlFor="pick">Antar alamat lain dulu?</label>
                <select id="pick" value="" onChange={e => e.target.value && setPick(e.target.value)}><option value="">Pilih alamat lain…</option>
                  {others.map(o => <option key={o.id} value={o.id}>{r.stops.indexOf(o) + 1}. {o.recipient} · {o.address.slice(0, 50)}</option>)}</select></div>}</>
            : <div className="row"><button className="btn ok big" style={{ flex: 1 }} disabled={busy} onClick={() => setModal(next)}>Sudah sampai</button><button className="btn ghost" onClick={() => setFail(next.id)}>Gagal kirim</button></div>}</section>
      : <section className="panel"><h2>Batch {r.batch} selesai</h2><p className="sub">{done.filter(o => o.ship === "sampai").length} sampai, {done.filter(o => o.ship === "gagal").length} gagal. Kembali ke {org?.short}.</p></section>}
      {done.length > 0 && <section className="panel"><h2>Sudah dikunjungi</h2><ol className="stops">{done.map(o => <li key={o.id}><span className="num" style={{ background: `var(--${o.ship === "sampai" ? "ok" : "bad"})` }}>{r.stops.indexOf(o) + 1}</span>
        <div><div className="addr">{o.recipient}</div><div className="meta">{o.address}{o.receivedBy ? ` · diterima ${o.receivedBy}` : ""}{o.failReason ? ` · ${o.failReason}` : ""}</div></div><Pill s={o.ship}>{LABEL[o.ship]}</Pill></li>)}</ol></section>}
    </div>
      {org && <section className="panel sticky-map"><h2>Peta rute</h2><MapSVG origin={org} routes={[{ color: me.color, pts: r.stops, doneN: done.length }]} /></section>}</div>}
  </main>
    {modal && <SampaiForm order={modal} onClose={() => setModal(null)} onSave={async ({ name, rel, file }) => {
      const path = file ? await uploadProof(modal.token, file) : null;
      await mark(modal, "sampai", { name, rel, path }); setModal(null); toast(`${modal.recipient}: sampai. WhatsApp konfirmasi ke pemesan`); await load(); }} />}
    {toastEl}
  </div>);
}
