import { useEffect, useState } from "react";
import { Field, Pill } from "../components/ui.jsx";
import { sb, staffApi } from "../lib/api.js";

export const ROLE = { pemilik: "Pemilik", admin: "Admin", cs: "CS (lihat saja)" };
const DESC = { pemilik: "Semua akses, termasuk token WhatsApp", admin: "Semua kecuali token WhatsApp", cs: "Hanya melihat & melacak pesanan" };

// Ganti password: wajib saat login pertama (password sementara), atau dari Pengaturan → Akun.
export function ChangePassword({ forced, onDone, toast }) {
  const [a, setA] = useState(""), [b, setB] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    if (a.length < 8) return setErr("Password minimal 8 karakter.");
    if (a !== b) return setErr("Ulangi password belum sama.");
    setBusy(true); setErr("");
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) { setBusy(false); return setErr(/same|different/i.test(error.message) ? "Password baru harus beda dari password sementara." : error.message); }
    await sb.rpc("clear_must_change_pw");
    setBusy(false); setA(""); setB(""); toast?.("Password diganti"); onDone?.();
  }
  const form = (<form className="form" onSubmit={save} style={{ marginTop: 12 }}>
    <Field id="pw-a" full label="Password baru"><input id="pw-a" type="password" autoComplete="new-password" value={a} onChange={e => setA(e.target.value)} required /></Field>
    <Field id="pw-b" full label="Ulangi password baru"><input id="pw-b" type="password" autoComplete="new-password" value={b} onChange={e => setB(e.target.value)} required /></Field>
    {err && <p className="ferr full" role="alert">{err}</p>}
    <button className="btn primary full" disabled={busy}>{busy ? "Menyimpan…" : "Simpan password"}</button></form>);
  if (!forced) return form;
  return (<div className="login"><section className="panel" style={{ maxWidth: 420, width: "100%" }}><h1 style={{ fontSize: 22 }}>Buat password baru</h1>
    <p className="sub">Kamu masuk pakai password sementara. Ganti dulu dengan password milikmu sendiri.</p>{form}
    <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => sb.auth.signOut()}>Keluar</button></section></div>);
}

// Pengaturan → Akun: pemilik & admin bisa tambah akun, ubah level, nonaktifkan, reset password.
export default function Accounts({ me, toast }) {
  const [list, setList] = useState(null), [add, setAdd] = useState({ name: "", email: "", role: "admin" }), [busy, setBusy] = useState(""), [pw, setPw] = useState(null);
  const load = () => staffApi("list").then(r => setList(r.list)).catch(e => toast(e.message));
  useEffect(() => { load(); }, []);
  const run = async (label, fn) => { setBusy(label); try { await fn(); await load(); } catch (e) { toast(e.message); } setBusy(""); };
  const owner = me.role === "pemilik", roles = owner ? ["pemilik", "admin", "cs"] : ["admin", "cs"], canEdit = a => owner || a.role !== "pemilik";
  return (<section className="panel"><h2>Akun</h2>
    <p className="note">Pemilik: semua akses. Admin: semua kecuali token WhatsApp. CS: hanya melihat & melacak. Akun baru dapat <b>password sementara</b> yang wajib diganti saat login pertama. Akun kurir dibuat di menu Kurir.</p>
    {pw && <div className="banner ok" role="status"><b>Password sementara {pw.email}:</b> <code className="mono" style={{ fontSize: 16 }}>{pw.password}</code>
      <div className="row" style={{ marginTop: 6 }}><button className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(`Login: ${location.origin}\nEmail: ${pw.email}\nPassword sementara: ${pw.password}`); toast("Info login disalin"); }}>Salin info login</button>
        <button className="btn ghost sm" onClick={() => setPw(null)}>Tutup</button></div>
      <div className="meta">Kirim ke orangnya lewat WhatsApp pribadi. Password ini tidak bisa dilihat lagi setelah ditutup.</div></div>}
    {!list ? <p className="note">Memuat…</p> : <ul className="hist">{list.map(a => <li key={a.user_id} className="inv-row">
      <div><div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><b>{a.name || a.email}</b><Pill s={!a.active ? "bad" : a.role === "pemilik" ? "ok" : a.role === "admin" ? "info" : ""}>{a.active ? ROLE[a.role] : "Nonaktif"}</Pill>{a.me && <span className="meta">(kamu)</span>}</div>
        <div className="meta">{a.email} · {a.last_sign_in ? `terakhir masuk ${new Date(a.last_sign_in).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}` : "belum pernah masuk"}{a.must_change_pw ? " · belum ganti password sementara" : ""}</div></div>
      {!a.me && canEdit(a) && <div className="row">
        <select aria-label={`Level ${a.email}`} value={a.role} disabled={!!busy} onChange={e => run("r" + a.user_id, () => staffApi("update", { user_id: a.user_id, role: e.target.value }))}>{roles.map(r => <option key={r} value={r}>{ROLE[r]}</option>)}</select>
        <button className="btn ghost sm" disabled={!!busy} onClick={() => run("p" + a.user_id, async () => setPw({ email: a.email, ...(await staffApi("reset", { user_id: a.user_id })) }))}>Reset password</button>
        <button className={`btn sm ${a.active ? "ghost danger" : "ok"}`} disabled={!!busy} onClick={() => run("a" + a.user_id, () => staffApi("update", { user_id: a.user_id, active: !a.active }))}>{a.active ? "Nonaktifkan" : "Aktifkan"}</button></div>}
    </li>)}</ul>}
    <h3 style={{ marginTop: 16 }}>+ Tambah akun</h3>
    <div className="form">
      <Field id="ac-n" label="Nama"><input id="ac-n" value={add.name} onChange={e => setAdd({ ...add, name: e.target.value })} autoComplete="off" /></Field>
      <Field id="ac-e" label="Email"><input id="ac-e" type="email" value={add.email} onChange={e => setAdd({ ...add, email: e.target.value })} autoComplete="off" /></Field>
      <Field id="ac-r" full label={<>Level <span className="hint">{DESC[add.role]}</span></>}><select id="ac-r" value={add.role} onChange={e => setAdd({ ...add, role: e.target.value })}>{roles.map(r => <option key={r} value={r}>{ROLE[r]}</option>)}</select></Field></div>
    <button className="btn primary" disabled={!!busy || !add.name.trim() || !add.email.trim()} onClick={() => run("add", async () => { const r = await staffApi("create", add); setPw(r); setAdd({ name: "", email: "", role: "admin" }); toast("Akun dibuat"); })}>{busy === "add" ? "Membuat…" : "Buat akun"}</button>
    <h3 style={{ marginTop: 20 }}>Ganti password saya</h3>
    <ChangePassword toast={toast} />
  </section>);
}
