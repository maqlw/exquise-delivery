import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "./lib/api.js";
import { plan, status, todayYmd } from "./lib/logic.js";
import { useToast } from "./components/ui.jsx";
import { WilList } from "./components/AreaPicker.jsx";
import { OrderForm, UpdateChoice, SampaiForm, ConfirmDelete, WaResult } from "./components/OrderModals.jsx";
import Login from "./views/Login.jsx";
import Dashboard from "./views/Dashboard.jsx";
import Upload from "./views/Upload.jsx";
import Dispatch from "./views/Dispatch.jsx";
import CourierAdmin from "./views/CourierAdmin.jsx";
import Lacak from "./views/Lacak.jsx";
import CourierScreen from "./views/CourierScreen.jsx";
import TrackPublic from "./views/TrackPublic.jsx";
import Report from "./views/Report.jsx";
import Settings from "./views/Settings.jsx";

const VIEWS = { dashboard: Dashboard, upload: Upload, dispatch: Dispatch, kurir: CourierAdmin, lacak: Lacak, laporan: Report, pengaturan: Settings };
const NAV = [
  ["dashboard", "Dashboard", <path key="i" d="M3 11 12 3l9 8v10h-6v-6H9v6H3V11Z" fill="currentColor" />],
  ["upload", "Data pengiriman", <path key="i" d="M12 16V4m0 0-5 5m5-5 5 5M4 20h16" fill="none" stroke="currentColor" strokeWidth="2" />],
  ["dispatch", "Dispatch", <g key="i" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" /></g>],
  ["kurir", "Kurir", <g key="i" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></g>],
  ["lacak", "Lacak pesanan", <g key="i" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></g>],
  ["laporan", "Laporan", <path key="i" d="M4 20V10m6 10V4m6 16v-7m4 7H2" fill="none" stroke="currentColor" strokeWidth="2" />],
  ["pengaturan", "Pengaturan", <g key="i" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M4.9 19.1 7 17m10-10 2.1-2.1" /></g>],
];
const useHash = () => { const [h, setH] = useState(location.hash.slice(1)); useEffect(() => { const f = () => setH(location.hash.slice(1)); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []); return h; };


export default function App() {
  const track = location.pathname.match(/^\/lacak\/([A-Za-z0-9]+)/);
  const [session, setSession] = useState(undefined), [role, setRole] = useState(null);
  useEffect(() => {
    if (track) return;
    api.sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = api.sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) { setRole(null); return; }
    (async () => {
      const { data: admin } = await api.sb.rpc("is_admin");
      if (admin) return setRole("admin");
      const { data: kurir } = await api.sb.rpc("my_courier_id");
      setRole(kurir ? "kurir" : "none");
    })();
  }, [session?.user?.id]);
  if (track) return <TrackPublic token={track[1]} />;
  if (session === undefined || (session && !role)) return <div className="login"><span className="spin" aria-label="Memuat" /></div>;
  if (!session) return <Login />;
  if (role === "kurir") return <CourierScreen />;
  if (role === "none") return <div className="login"><section className="panel"><h1>Akun belum punya akses</h1><p className="sub">Akun ini belum terdaftar sebagai admin atau kurir. Hubungi admin Exquise.</p><button className="btn primary" onClick={() => api.sb.auth.signOut()}>Keluar</button></section></div>;
  return <Admin email={session.user.email} />;
}

function Admin({ email }) {
  const hash = useHash(), view = VIEWS[hash] ? hash : "dashboard", View = VIEWS[view];
  const [toastEl, toast] = useToast();
  const [master, setMaster] = useState(null), [day, setDay] = useState(null), [date, setDate] = useState(null), [dates, setDates] = useState([]);
  const [ui, setUi] = useState({ origin: "ck", batch: 1, filter: "all", lacak: null, q: "" });
  const [modal, setModal] = useState(null);
  const reload = useCallback(async (d = date) => {
    try {
      const [m, ds] = await Promise.all([api.loadMaster(), api.shipDates()]);
      const pick = d || (ds.includes(todayYmd()) ? todayYmd() : ds[0] || todayYmd());
      setMaster(m); setDates(ds); setDate(pick); setDay(await api.loadDay(pick));
    } catch (e) { toast("Gagal memuat data: " + e.message); }
  }, [date, toast]);
  useEffect(() => { reload(); }, []);
  useEffect(() => { document.querySelector(".viewport")?.scrollTo(0, 0); window.scrollTo(0, 0); }, [view]);

  const P = useMemo(() => master && day ? plan(day.orders, master.origins, master.couriers, day.sent) : null, [master, day]);
  if (!master || !day || !P) return <div className="login"><span className="spin" aria-label="Memuat" /></div>;
  const cek = day.orders.filter(o => status(o) === "cek").length;
  const courier = id => master.couriers.find(c => c.id === id);

  const act = {
    edit: o => api.addressHistory(o.id).then(h => setModal({ kind: "form", order: o, history: h })),
    add: () => setModal({ kind: "form" }),
    update: o => setModal({ kind: "update", order: o }),
    hapus: o => setModal({ kind: "hapus", order: o }),
    async saveForm(o, existing) {
      if (existing) await api.updateOrder(existing.id, api.toDb(o)); else await api.insertOrder(o);
      setModal(null); toast(existing ? `Perubahan ${existing.code} disimpan` : `Pesanan ${o.code || "baru"} ditambahkan`);
      await reload(existing ? date : o.ymd);
    },
    async kirim(o) {
      const at = new Date().toISOString();
      await api.updateOrder(o.id, { status: "jalan", sent_at: at, fail_reason: null });
      const res = await api.notify(o.id, "kirim"), logs = (await api.waLogs(o.id)).filter(l => l.kind === "kirim" && l.created_at >= at);
      setModal({ kind: "wa", title: `Dikirim · ${o.code}`, result: res, logs }); reload();
    },
    async sampai(o, { name, rel, file }) {
      const at = new Date().toISOString(), path = file ? await api.uploadProof(o.token, file) : o.proofPath;
      await api.updateOrder(o.id, { status: "sampai", receiver_name: name, receiver_relation: rel, proof_path: path, delivered_at: at, fail_reason: null });
      const res = await api.notify(o.id, "sampai"), logs = (await api.waLogs(o.id)).filter(l => l.kind === "sampai" && l.created_at >= at);
      setModal({ kind: "wa", title: `Sampai · ${o.code}`, result: res, logs }); reload();
    },
    async remove(o) { await api.deleteOrder(o.id); setModal(null); toast(`Pesanan ${o.code} dihapus`); reload(); },
  };
  const close = () => setModal(null);
  const ctx = { ...master, ...day, P, date, dates, ui, setUi, reload, toast, act, courier, setDate: d => reload(d) };

  return (
    <div className="frame"><div className="frame-inner">
      <aside className="side" aria-label="Menu">
        <div className="brand"><span className="brand-bars" aria-hidden="true"><i style={{ height: 16 }} /><i style={{ height: 20 }} /><i style={{ height: 14 }} /></span>Exquise</div>
        <div className="ws"><span className="ws-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 3 7v2h18V7l-9-5Zm-7 9v8H3v2h18v-2h-2v-8h-2v8h-3v-8h-2v8H8v-8H5Z" /></svg></span>
          <div style={{ minWidth: 0, flex: 1 }}><label htmlFor="ws-origin">Lokasi asal</label>
            <select id="ws-origin" value={ui.origin} onChange={e => setUi({ ...ui, origin: e.target.value })}>{Object.values(master.origins).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div></div>
        <div className="navlbl">Menu</div>
        <nav aria-label="Tampilan">{NAV.map(([k, t, ic]) => (
          <a key={k} href={"#" + k} aria-current={view === k ? "page" : undefined}><span className="ic"><svg viewBox="0 0 24 24">{ic}</svg></span>{t}{k === "upload" && cek > 0 && <span className="badge">{cek}</span>}</a>))}</nav>
        <div className="spacer" />
        <div className="who"><span className="avatar">{email.slice(0, 2).toUpperCase()}</span><div style={{ minWidth: 0, flex: 1 }}><b>Admin</b><span style={{ overflowWrap: "anywhere" }}>{email}</span></div>
          <button className="btn sm" style={{ background: "#1d2a22", color: "#fff" }} onClick={() => api.sb.auth.signOut()}>Keluar</button></div>
      </aside>
      <div className="viewport"><main><View {...ctx} /></main></div>
    </div>
      {modal?.kind === "form" && <OrderForm order={modal.order} history={modal.history} origins={master.origins} defaults={{ ymd: date, origin: ui.origin, via: "internal" }} onClose={close} onSave={o => act.saveForm(o, modal.order)} />}
      {modal?.kind === "update" && <UpdateChoice order={modal.order} onClose={close} onKirim={() => act.kirim(modal.order)} onSampai={() => setModal({ kind: "sampai", order: modal.order })} />}
      {modal?.kind === "sampai" && <SampaiForm order={modal.order} onClose={close} onSave={v => act.sampai(modal.order, v)} />}
      {modal?.kind === "hapus" && <ConfirmDelete order={modal.order} onClose={close} onDelete={() => act.remove(modal.order)} />}
      {modal?.kind === "wa" && <WaResult title={modal.title} result={modal.result} logs={modal.logs} onClose={close} />}
      <WilList />{toastEl}
    </div>
  );
}
