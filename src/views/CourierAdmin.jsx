import { useState } from "react";
import { Pill, Field, initials } from "../components/ui.jsx";
import { sb, courierAccount } from "../lib/api.js";

const COLORS = ["#1d8f46", "#2f6db5", "#c26a12", "#8a4fc0", "#b0124f", "#0f8a84", "#5d6b00", "#a8326e"];

export default function CourierAdmin({ couriers, origins, routes, reload, toast }) {
  const [add, setAdd] = useState({ name: "", origin: "ck" }), [edit, setEdit] = useState(null), [busy, setBusy] = useState(false), [info, setInfo] = useState(null), [del, setDel] = useState(null);
  async function saveInfo() {
    if (!info.name.trim()) return toast("Nama kurir wajib diisi");
    const { error } = await sb.from("couriers").update({ name: info.name.trim().toUpperCase(), origin_id: info.origin }).eq("id", info.id);
    if (error) return toast("Gagal: " + error.message);
    toast("Data kurir disimpan"); setInfo(null); reload();
  }
  async function remove(c) {
    const { error } = await sb.from("couriers").delete().eq("id", c.id);
    setDel(null);
    if (error) return toast(/foreign key/i.test(error.message) ? `${c.name} sudah punya riwayat rute, jadi tidak bisa dihapus. Nonaktifkan saja supaya riwayat tetap tersimpan.` : "Gagal: " + error.message);
    toast(`Kurir ${c.name} dihapus`); reload();
  }
  async function create() {
    if (!add.name.trim()) return toast("Nama kurir wajib diisi");
    const { error } = await sb.from("couriers").insert({ name: add.name.trim().toUpperCase(), origin_id: add.origin, color: COLORS[couriers.length % COLORS.length] });
    if (error) return toast("Gagal: " + error.message);
    setAdd({ name: "", origin: add.origin }); toast("Kurir ditambahkan. Atur No HP dan PIN untuk login."); reload();
  }
  async function toggle(c) { const { error } = await sb.from("couriers").update({ active: !c.active }).eq("id", c.id); if (error) return toast("Gagal: " + error.message); reload(); }
  async function saveLogin() {
    setBusy(true);
    try { const r = await courierAccount(edit.id, edit.phone, edit.pin); toast(`Login ${edit.name} disimpan (No HP ${r.phone})`); setEdit(null); reload(); }
    catch (e) { toast(e.message); }
    setBusy(false);
  }
  return (<>
    <h1>Kurir</h1><p className="sub">Atur kurir per lokasi asal dan buat login mereka (No HP + PIN 6 angka). Kurir masuk lewat halaman yang sama dengan memilih "Kurir".</p>
    <div className="grid"><section className="panel"><h2>Daftar kurir · {couriers.length}</h2>
      <div className="tablewrap"><table className="rtable ltable"><thead><tr><th>Kurir</th><th>Lokasi asal</th><th>Login</th><th>Hari ini</th><th>Aksi</th></tr></thead><tbody>
        {couriers.map(c => { const mine = routes.filter(r => r.courier_id === c.id); return (
          <tr key={c.id}><td data-label="Kurir"><div className="who-cell"><span className="avatar" style={{ background: c.color }}>{initials(c.name)}</span><div><div className="addr">{c.name}</div>{!c.active && <Pill>Nonaktif</Pill>}</div></div></td>
            <td data-label="Lokasi asal">{origins[c.origin_id]?.short}</td>
            <td data-label="Login">{c.user_id ? <><Pill s="ok">Aktif</Pill><div className="meta mono">{c.phone}</div></> : <Pill s="warn">Belum dibuat</Pill>}</td>
            <td data-label="Hari ini">{mine.length ? mine.map(r => <div key={r.id} className="meta">Batch {r.batch} · {r.route_stops.length} alamat · {r.finished_at ? "selesai" : r.started_at ? "jalan" : "belum berangkat"}</div>) : <span className="meta">–</span>}</td>
            <td data-label="Aksi" className="full"><div className="acts"><button className="btn primary sm" onClick={() => setEdit({ id: c.id, name: c.name, phone: c.phone || "", pin: "" })}>{c.user_id ? "Ubah login" : "Buat login"}</button>
              <button className="btn ghost sm" onClick={() => setInfo({ id: c.id, name: c.name, origin: c.origin_id })}>Edit</button>
              <button className="btn ghost sm" onClick={() => toggle(c)}>{c.active ? "Nonaktifkan" : "Aktifkan"}</button>
              {del === c.id ? <><button className="btn bad sm" onClick={() => remove(c)}>Ya, hapus {c.name}</button><button className="btn ghost sm" onClick={() => setDel(null)}>Batal</button></>
                : <button className="btn ghost sm danger" onClick={() => setDel(c.id)}>Hapus</button>}</div></td></tr>); })}
      </tbody></table></div></section>
      <div className="stack">
        {info && <section className="panel"><h2>Edit kurir</h2><div className="form">
          <Field id="e-name" full label="Nama kurir"><input id="e-name" value={info.name} onChange={e => setInfo({ ...info, name: e.target.value })} /></Field>
          <Field id="e-origin" full label="Lokasi asal"><select id="e-origin" value={info.origin} onChange={e => setInfo({ ...info, origin: e.target.value })}>{Object.values(origins).map(o => <option key={o.id} value={o.id}>{o.short}</option>)}</select></Field></div>
          <div className="row"><button className="btn ghost" onClick={() => setInfo(null)}>Batal</button><button className="btn primary" onClick={saveInfo}>Simpan</button></div></section>}
        {edit && <section className="panel"><h2>Login {edit.name}</h2><div className="form">
          <Field id="k-phone" full label="No HP kurir"><input id="k-phone" inputMode="tel" placeholder="08…" value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })} /></Field>
          <Field id="k-pin" full label="PIN baru (6 angka)"><input id="k-pin" inputMode="numeric" maxLength={6} value={edit.pin} onChange={e => setEdit({ ...edit, pin: e.target.value.replace(/\D/g, "") })} autoComplete="new-password" /></Field></div>
          <p className="note">Berikan PIN langsung ke kurir. PIN tidak bisa dilihat lagi setelah disimpan; kalau lupa, buat PIN baru di sini.</p>
          <div className="row"><button className="btn ghost" onClick={() => setEdit(null)}>Batal</button><button className="btn primary" disabled={busy} onClick={saveLogin}>{busy ? "Menyimpan…" : "Simpan login"}</button></div></section>}
        <section className="panel"><h2>Tambah kurir</h2><div className="form">
          <Field id="k-name" full label="Nama kurir"><input id="k-name" value={add.name} onChange={e => setAdd({ ...add, name: e.target.value })} /></Field>
          <Field id="k-origin" full label="Lokasi asal"><select id="k-origin" value={add.origin} onChange={e => setAdd({ ...add, origin: e.target.value })}>{Object.values(origins).map(o => <option key={o.id} value={o.id}>{o.short}</option>)}</select></Field></div>
          <button className="btn ok" onClick={create}>+ Tambah kurir</button></section>
      </div></div>
  </>);
}
