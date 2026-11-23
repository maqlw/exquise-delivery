import { useEffect, useMemo, useRef, useState } from "react";
import { sb } from "../lib/api.js";
import { normPhone } from "../lib/logic.js";
import { Field, Logo } from "../components/ui.jsx";

// Animasi latar login (gaya "scroll morph hero"): 20 foto produk berserakan -> berbaris -> melingkari form.
// Laptop: lingkaran mengelilingi form, berputar pelan + ikut gerak mouse. HP: kipas di atas form. Kartu membalik saat disorot.
const PICS = Array.from({ length: 20 }, (_, i) => `/login/${String(i + 1).padStart(2, "0")}.jpg`);
const calm = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
function Ring() {
  const ref = useRef(null), [phase, setPhase] = useState(() => calm() ? "final" : "scatter"), [box, setBox] = useState({ w: 0, h: 0 }), [px, setPx] = useState(0);
  const rnd = useMemo(() => PICS.map(() => [(Math.random() - .5) * 1500, (Math.random() - .5) * 1000, (Math.random() - .5) * 180]), []);
  useEffect(() => {
    const el = ref.current, ro = new ResizeObserver(() => setBox({ w: el.offsetWidth, h: el.offsetHeight })); ro.observe(el);
    const t = [setTimeout(() => setPhase(p => p === "final" ? p : "line"), 400), setTimeout(() => setPhase("final"), 2000)];
    return () => { ro.disconnect(); t.forEach(clearTimeout); };
  }, []);
  const n = PICS.length, wide = box.w >= 720;
  const pos = i => {
    if (phase === "scatter") return { x: rnd[i][0], y: rnd[i][1], r: rnd[i][2], s: .6, o: 0 };
    if (phase === "line") { const step = Math.min(72, (box.w - 40) / n); return { x: (i - (n - 1) / 2) * step, y: 0, r: 0, s: 1, o: 1 }; }
    if (wide) { const R = Math.min(box.w, box.h) / 2 - 64, a = i / n * 360; return { x: Math.cos(a * Math.PI / 180) * R, y: Math.sin(a * Math.PI / 180) * R, r: a + 90, s: 1, o: 1 }; }
    const R = box.w * 1.15, a = -90 - 46 + i * 92 / (n - 1); // kipas di bagian atas layar HP
    return { x: Math.cos(a * Math.PI / 180) * R, y: Math.sin(a * Math.PI / 180) * R + R - box.h / 2 + 96, r: a + 90, s: .9, o: 1 };
  };
  return (<div className="lg-stage" ref={ref} aria-hidden="true" onMouseMove={e => { const r = ref.current.getBoundingClientRect(); setPx(((e.clientX - r.left) / r.width * 2 - 1) * 24); }}>
    <div className="lg-ring" style={{ transform: `translateX(${px}px)` }}><div className={`lg-spin${phase === "final" && wide ? " on" : ""}`}>
      {PICS.map((src, i) => { const p = pos(i); return (
        <div key={src} className="lg-card" style={{ transform: `translate(-50%,-50%) translate(${p.x}px,${p.y}px) rotate(${p.r}deg) scale(${p.s})`, opacity: p.o, transitionDelay: `${i * 25}ms` }}>
          <div className="lg-flip"><img src={src} alt="" draggable="false" /><span className="lg-back">Exquise</span></div></div>); })}
    </div></div></div>);
}

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
    <div className="frame"><div className="frame-inner lg">
      <Ring />
      <form className="panel lg-form" onSubmit={submit}>
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
