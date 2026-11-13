import { useState } from "react";
import { sb } from "../lib/api.js";
import { normPhone } from "../lib/logic.js";
import { Field, Logo } from "../components/ui.jsx";

export default function Login() {
  const [show, setShow] = useState(false), [mode, setMode] = useState("admin"), [a, setA] = useState(""), [b, setB] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setErr("");
    let email = a.trim();
    if (mode === "kurir") { const p = normPhone(a).p; if (!p) return setErr("No HP tidak valid."); if (!/^\d{6}$/.test(b)) return setErr("PIN harus 6 angka."); email = `${p}@kurir.exquise.app`; }
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email, password: b });
    setBusy(false);
    if (error) setErr(mode === "kurir" ? "No HP atau PIN salah." : "Email atau password salah.");
  }
  const label = mode === "kurir" ? "PIN" : "password";
  const eye = <button type="button" className="eye" aria-label={show ? `Sembunyikan ${label}` : `Tampilkan ${label}`} aria-pressed={show} onClick={() => setShow(!show)}>
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{!show && <path d="M3 3l18 18" />}</svg></button>;
  return (
    <div className="frame"><div className="frame-inner" style={{ justifyContent: "center", alignItems: "center" }}>
      <form className="panel" style={{ width: "min(420px,100%)", margin: 16 }} onSubmit={submit}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}><Logo h={84} /><span className="eyebrow">Delivery</span></div>
        <div className="seg" role="group" aria-label="Masuk sebagai">
          {[["admin", "Admin"], ["kurir", "Kurir"]].map(([k, t]) => <button type="button" key={k} aria-pressed={mode === k} onClick={() => { setMode(k); setA(""); setB(""); setErr(""); setShow(false); }}>{t}</button>)}
        </div>
        <div key={mode} className={`stack ${mode === "kurir" ? "swap-r" : "swap-l"}`} style={{ gap: 14 }}>{mode === "admin" ? <>
          <Field id="l-a" label="Email"><input id="l-a" type="email" autoComplete="username" value={a} onChange={e => setA(e.target.value)} required /></Field>
          <Field id="l-b" label="Password"><div className="pw"><input id="l-b" type={show ? "text" : "password"} autoComplete="current-password" value={b} onChange={e => setB(e.target.value)} required />{eye}</div></Field>
        </> : <>
          <Field id="l-a" label="No HP"><input id="l-a" inputMode="tel" autoComplete="username" placeholder="08…" value={a} onChange={e => setA(e.target.value)} required /></Field>
          <Field id="l-b" label="PIN 6 angka"><div className="pw"><input id="l-b" type={show ? "text" : "password"} inputMode="numeric" maxLength={6} autoComplete="current-password" value={b} onChange={e => setB(e.target.value.replace(/\D/g, ""))} required />{eye}</div></Field>
        </>}</div>
        {err && <p className="ferr" role="alert">{err}</p>}
        <button className="btn primary big" disabled={busy}>{busy ? "Masuk…" : "Masuk"}</button>
      </form>
    </div></div>
  );
}
