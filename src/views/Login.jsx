import { useState } from "react";
import { sb } from "../lib/api.js";
import { normPhone } from "../lib/logic.js";
import { Field } from "../components/ui.jsx";

export default function Login() {
  const [mode, setMode] = useState("admin"), [a, setA] = useState(""), [b, setB] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setErr("");
    let email = a.trim();
    if (mode === "kurir") { const p = normPhone(a).p; if (!p) return setErr("No HP tidak valid."); if (!/^\d{6}$/.test(b)) return setErr("PIN harus 6 angka."); email = `${p}@kurir.exquise.app`; }
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email, password: b });
    setBusy(false);
    if (error) setErr(mode === "kurir" ? "No HP atau PIN salah." : "Email atau password salah.");
  }
  return (
    <div className="frame"><div className="frame-inner" style={{ justifyContent: "center", alignItems: "center" }}>
      <form className="panel" style={{ width: "min(420px,100%)", margin: 16 }} onSubmit={submit}>
        <div className="brand" style={{ color: "var(--ink)", padding: 0 }}><span className="brand-bars" aria-hidden="true"><i style={{ height: 16 }} /><i style={{ height: 20 }} /><i style={{ height: 14 }} /></span>Exquise Delivery</div>
        <div className="seg" role="group" aria-label="Masuk sebagai">
          {[["admin", "Admin"], ["kurir", "Kurir"]].map(([k, t]) => <button type="button" key={k} aria-pressed={mode === k} onClick={() => { setMode(k); setA(""); setB(""); setErr(""); }}>{t}</button>)}
        </div>
        {mode === "admin" ? <>
          <Field id="l-a" label="Email"><input id="l-a" type="email" autoComplete="username" value={a} onChange={e => setA(e.target.value)} required /></Field>
          <Field id="l-b" label="Password"><input id="l-b" type="password" autoComplete="current-password" value={b} onChange={e => setB(e.target.value)} required /></Field>
        </> : <>
          <Field id="l-a" label="No HP"><input id="l-a" inputMode="tel" autoComplete="username" placeholder="08…" value={a} onChange={e => setA(e.target.value)} required /></Field>
          <Field id="l-b" label="PIN 6 angka"><input id="l-b" type="password" inputMode="numeric" maxLength={6} autoComplete="current-password" value={b} onChange={e => setB(e.target.value.replace(/\D/g, ""))} required /></Field>
        </>}
        {err && <p className="ferr" role="alert">{err}</p>}
        <button className="btn primary big" disabled={busy}>{busy ? "Masuk…" : "Masuk"}</button>
      </form>
    </div></div>
  );
}
