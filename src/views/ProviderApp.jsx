import { useEffect, useState } from "react";
import { sb, SITE, loadBilling, saveBilling, listInvoices, serviceStatus, billingApi, invoiceUrl, proofUrl } from "../lib/api.js";
import { normPhone, dmy } from "../lib/logic.js";
import { Field, Pill, useToast } from "../components/ui.jsx";
import { InvoiceDoc } from "./InvoicePage.jsx";

const rp = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
export const INV_LABEL = { unpaid: "Unpaid", review: "Cek bukti", paid: "Paid", void: "Batal" }, INV_PILL = { unpaid: "warn", review: "jalan", paid: "sampai", void: "" };
export const SVC = { aktif: ["sampai", "Aktif"], tenggang: ["warn", "Masa tenggang"], nonaktif: ["gagal", "Nonaktif"] };
const num = v => Math.round(+String(v ?? "").replace(/\D/g, "")) || 0;

// Panel penyedia jasa (/penyedia): hanya email yang terdaftar sebagai penyedia.
export default function ProviderApp() {
  const [session, setSession] = useState(undefined), [ok, setOk] = useState(null);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (!session) return setOk(null); sb.rpc("is_provider").then(({ data }) => setOk(!!data)); }, [session?.user?.id]);
  if (session === undefined || (session && ok === null)) return <div className="login"><span className="spin" aria-label="Memuat" /></div>;
  if (!session) return <ProviderLogin />;
  if (!ok) return <div className="login"><section className="panel"><h1>Bukan akun penyedia</h1><p className="sub">Halaman ini khusus penyedia jasa.</p><button className="btn primary" onClick={() => sb.auth.signOut()}>Keluar</button></section></div>;
  return <Panel email={session.user.email} />;
}

function ProviderLogin() {
  const [mode, setMode] = useState("masuk"), [email, setEmail] = useState(""), [pw, setPw] = useState(""), [show, setShow] = useState(false), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setMsg(""); setBusy(true);
    try {
      if (mode === "masuk") { const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw }); if (error) throw new Error("Email atau password salah."); }
      else {
        const { data: allowed } = await sb.rpc("provider_allowed", { p_email: email });
        if (!allowed) throw new Error("Email ini tidak terdaftar sebagai penyedia.");
        if (pw.length < 10) throw new Error("Password minimal 10 karakter.");
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password: pw, options: { emailRedirectTo: `${SITE}/penyedia` } });
        if (error) throw new Error(error.message);
        setMsg(data.session ? "" : "Akun dibuat. Buka email kamu dan klik link konfirmasi, lalu masuk di sini.");
      }
    } catch (x) { setMsg(x.message); }
    setBusy(false);
  }
  return (<div className="frame"><div className="frame-inner" style={{ justifyContent: "center", alignItems: "center" }}>
    <form className="panel" style={{ width: "min(420px,100%)", margin: 16 }} onSubmit={submit}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><img src="/kdn-logo.png" alt="" width="44" height="44" style={{ borderRadius: 6 }} /><div><b>Panel Penyedia</b><div className="meta">Tagihan & layanan Matrix Delivery</div></div></div>
      <div className="seg" role="group" aria-label="Mode"><button type="button" aria-pressed={mode === "masuk"} onClick={() => setMode("masuk")}>Masuk</button><button type="button" aria-pressed={mode === "daftar"} onClick={() => setMode("daftar")}>Buat akun (sekali)</button></div>
      <Field id="p-email" label="Email"><input id="p-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></Field>
      <Field id="p-pw" label="Password"><div className="pw"><input id="p-pw" type={show ? "text" : "password"} autoComplete={mode === "masuk" ? "current-password" : "new-password"} value={pw} onChange={e => setPw(e.target.value)} required />
        <button type="button" className="eye" aria-label={show ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={show} onClick={() => setShow(!show)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{!show && <path d="M3 3l18 18" />}</svg></button></div></Field>
      {msg && <p className="ferr" role="alert">{msg}</p>}
      <button className="btn primary big" disabled={busy}>{busy ? "Memproses…" : mode === "masuk" ? "Masuk" : "Buat akun penyedia"}</button>
    </form></div></div>);
}

function Panel({ email }) {
  const [toastEl, toast] = useToast();
  const [b, setB] = useState(null), [inv, setInv] = useState(null), [svc, setSvc] = useState(null), [view, setView] = useState(null), [pay, setPay] = useState(null);
  const load = async () => { try { const [bb, ii, ss] = await Promise.all([loadBilling(), listInvoices(), serviceStatus()]); setB(bb); setInv(ii); setSvc(ss); } catch (e) { toast(e.message); } };
  useEffect(() => { load(); }, []);
  if (!b || !inv) return <div className="login"><span className="spin" aria-label="Memuat" /></div>;
  const plan = b.plan || {}, cycle = b.cycle || {};
  const run = async (fn, msg) => { try { await fn(); if (msg) toast(msg); await load(); } catch (e) { toast(e.message); } };
  const send = (i, event) => run(async () => { const r = await billingApi("send", { id: i.id, event }); toast(r.summary || "Terkirim"); });
  async function newInvoice() {
    const { data: number, error } = await sb.rpc("next_invoice_number"); if (error) throw new Error(error.message);
    const { error: e2 } = await sb.from("invoices").insert({ number, kind: "langganan", active_until: cycle.active_until, pay_link: plan.pay_link || null, note: plan.note || null,
      items: [{ name: `Subscription Matrix Delivery - ${plan.name?.replace(/^Paket\s*/i, "") || "1 Bulan"}`, desc: plan.desc, normal: plan.normal || null, price: plan.price }], subtotal: plan.price, total: plan.price });
    if (e2) throw new Error(e2.message);
  }
  const svcPill = SVC[svc?.status] || SVC.aktif, last = inv.find(i => i.kind === "langganan" && i.status !== "void");
  return (<div className="prov">
    <header className="prov-top"><div style={{ display: "flex", gap: 10, alignItems: "center" }}><img src="/kdn-logo.png" alt="" width="36" height="36" style={{ borderRadius: 6 }} /><b>Panel Penyedia</b></div>
      <div className="row"><span className="meta">{email}</span><button className="btn sm ghost" onClick={() => sb.auth.signOut()}>Keluar</button></div></header>
    <main className="stack">
      <section className="prov-hero"><span className="eyebrow"><span className={`wa-dot ${svc?.status === "aktif" ? "on" : "off"}`} /> {svcPill[1].toUpperCase()}</span>
        <h1>{svc?.days_left >= 0 ? `${svc.days_left} hari tersisa` : svc?.status === "tenggang" ? "Masa tenggang" : "Nonaktif"}</h1>
        <p>Masa aktif sampai {dmy(svc?.active_until)} · tenggang sampai {dmy(svc?.grace_until)}</p>
        <div className="prov-kv"><div><span>Tagihan terakhir</span><b>{last ? `#${last.number}` : "-"}</b></div><div><span>Status tagihan</span><b>{last ? INV_LABEL[last.status] : "-"}</b></div><div><span>Batas aktif</span><b>{dmy(cycle.active_until)}</b></div></div></section>

      <Cycle b={b} run={run} />
      <section className="panel"><div className="row between"><h2>Invoice · {inv.length}</h2><button className="btn primary" onClick={() => run(newInvoice, "Tagihan langganan dibuat")}>+ Buat tagihan langganan</button></div>
        <ul className="hist">{inv.map(i => <li key={i.id} className="inv-row">
          <div><b>#{i.number}</b> <Pill s={INV_PILL[i.status]}>{INV_LABEL[i.status]}</Pill> <span className="meta">{i.kind === "topup" ? "Top up WhatsApp" : "Langganan"}</span>
            <div className="meta">{dmy(i.issued_on)} · {rp(i.total)}{i.active_until ? ` · batas aktif ${dmy(i.active_until)}` : ""}{i.paid_at ? ` · dibayar ${dmy(i.paid_at.slice(0, 10))} ${i.paid_method || ""}` : ""}{i.note ? ` · ${i.note}` : ""}
              {i.proof_path && <> · <a href={proofUrl(i.proof_path)} target="_blank" rel="noopener">bukti transfer</a></>}</div></div>
          <div className="row">
            <a className="btn ghost sm" href={invoiceUrl(i.token)} target="_blank" rel="noopener">Buka</a>
            <button className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(invoiceUrl(i.token)); toast("Link invoice disalin"); }}>Salin link</button>
            <button className="btn ghost sm" onClick={() => setView(i)}>Pratinjau</button>
            {i.status !== "void" && <button className="btn ghost sm" onClick={() => send(i, i.status === "paid" ? "paid" : "new")}>Kirim</button>}
            {["unpaid", "review"].includes(i.status) && <button className="btn ok sm" onClick={() => setPay({ inv: i, method: "Transfer", ref: "", date: new Date().toISOString().slice(0, 10) })}>Tandai lunas</button>}
            {["unpaid", "review"].includes(i.status) && <button className="btn ghost sm danger" onClick={() => run(async () => { const { error } = await sb.from("invoices").update({ status: "void" }).eq("id", i.id); if (error) throw new Error(error.message); }, "Invoice dibatalkan")}>Batalkan</button>}</div>
          {pay?.inv.id === i.id && <div className="prov-pay">
            <Field id="py-m" label="Metode"><input id="py-m" value={pay.method} onChange={e => setPay({ ...pay, method: e.target.value })} placeholder="Transfer / DOKU / QRIS" /></Field>
            <Field id="py-r" label="No referensi (opsional)"><input id="py-r" value={pay.ref} onChange={e => setPay({ ...pay, ref: e.target.value })} /></Field>
            <Field id="py-d" label="Tanggal bayar"><input id="py-d" type="date" value={pay.date} onChange={e => setPay({ ...pay, date: e.target.value })} /></Field>
            <div className="row"><button className="btn ok" onClick={() => run(async () => {
              const { error } = await sb.rpc("mark_invoice_paid", { p_invoice: i.id, p_method: pay.method, p_ref: pay.ref, p_paid_at: new Date(pay.date + "T12:00:00+07:00").toISOString() }); if (error) throw new Error(error.message);
              setPay(null); await billingApi("send", { id: i.id, event: "paid", auto: true }).catch(() => {});
            }, i.kind === "langganan" ? "Lunas. Batas aktif maju ke tanggal 20 bulan berikutnya." : "Lunas")}>Simpan lunas</button><button className="btn ghost" onClick={() => setPay(null)}>Batal</button></div></div>}
        </li>)}</ul></section>
      <Plan b={b} run={run} />
      <Topup b={b} run={run} toast={toast} />
      <Sending b={b} run={run} toast={toast} />
    </main>
    {view && <div className="modal" onClick={e => e.target === e.currentTarget && setView(null)}><div className="sheet" style={{ width: "min(860px,100%)" }} role="dialog" aria-modal="true" aria-label={`Pratinjau ${view.number}`}>
      <div className="sheet-h"><h2>Pratinjau #{view.number}</h2><button className="x" onClick={() => setView(null)} aria-label="Tutup">×</button></div>
      <div className="sheet-b" style={{ background: "#eef1f4" }}><InvoiceDoc inv={{ ...view, company: plan.company, customer: plan.customer }} /></div></div></div>}
    {toastEl}
  </div>);
}

function Cycle({ b, run }) {
  const [c, setC] = useState({ active_until: b.cycle?.active_until || "", grace_workdays: b.cycle?.grace_workdays ?? 7 });
  return (<section className="panel"><h2>Siklus tagihan</h2><p className="note">Aktif sampai batas aktif → masa tenggang (hari kerja) → nonaktif. Saat nonaktif, admin Exquise tidak bisa upload/menambah pesanan atau mengirim rute baru (lihat & lacak tetap jalan). Tagihan langganan yang ditandai lunas memajukan batas aktif ke tanggal 20 bulan berikutnya.</p>
    <div className="form"><Field id="c-a" label="Batas masa aktif"><input id="c-a" type="date" value={c.active_until} onChange={e => setC({ ...c, active_until: e.target.value })} /></Field>
      <Field id="c-g" label="Masa tenggang (hari kerja)"><input id="c-g" type="number" min="0" max="30" value={c.grace_workdays} onChange={e => setC({ ...c, grace_workdays: e.target.value })} /></Field></div>
    <button className="btn primary" onClick={() => run(() => saveBilling("cycle", { active_until: c.active_until, grace_workdays: Math.max(0, num(c.grace_workdays)) }), "Siklus disimpan")}>Simpan jadwal</button></section>);
}

function Plan({ b, run }) {
  const [p, setP] = useState({ company: "", customer: "", name: "", desc: "", normal: "", price: "", prefix: "KDN", pay_link: "", note: "", ...b.plan });
  const set = k => e => setP({ ...p, [k]: e.target.value });
  return (<section className="panel"><h2>Paket langganan & data tagihan</h2>
    <div className="form">
      <Field id="pl-co" label="Nama penyedia (di invoice)"><input id="pl-co" value={p.company} onChange={set("company")} /></Field>
      <Field id="pl-cu" label="Ditagihkan kepada"><input id="pl-cu" value={p.customer} onChange={set("customer")} /></Field>
      <Field id="pl-n" label="Nama paket"><input id="pl-n" value={p.name} onChange={set("name")} /></Field>
      <Field id="pl-x" label="Prefix nomor invoice"><input id="pl-x" value={p.prefix} onChange={set("prefix")} /></Field>
      <Field id="pl-nr" label="Harga normal (opsional)"><input id="pl-nr" inputMode="numeric" value={p.normal ?? ""} onChange={set("normal")} /></Field>
      <Field id="pl-pr" label="Harga promo / tagihan"><input id="pl-pr" inputMode="numeric" value={p.price} onChange={set("price")} /></Field>
      <Field id="pl-d" full label="Keterangan paket"><input id="pl-d" value={p.desc} onChange={set("desc")} /></Field>
      <Field id="pl-l" full label="Link pembayaran DOKU (manual)"><input id="pl-l" type="url" value={p.pay_link} onChange={set("pay_link")} placeholder="https://pay.doku.com/…" /></Field>
      <Field id="pl-no" full label="Catatan penagihan (internal)"><textarea id="pl-no" rows="2" value={p.note} onChange={set("note")} placeholder="Contoh: Follow up PIC finance tanggal 18." /></Field></div>
    <p className="note">Link DOKU & harga dipakai saat tombol "Buat tagihan langganan" ditekan. Invoice yang sudah dibuat tidak berubah.</p>
    <button className="btn primary" onClick={() => run(() => { if (p.pay_link && !/^https:\/\//.test(p.pay_link)) throw new Error("Link harus diawali https://"); if (!(num(p.price) > 0)) throw new Error("Harga wajib diisi"); return saveBilling("plan", { ...p, price: num(p.price), normal: num(p.normal) || null, prefix: (p.prefix || "INV").toUpperCase().replace(/[^A-Z0-9]/g, "") }); }, "Paket disimpan")}>Simpan paket</button></section>);
}

function Topup({ b, run }) {
  const t = b.topup || {};
  const [pk, setPk] = useState(t.packages?.length ? t.packages : [{ name: "", desc: "", price: "" }]), [payTxt, setPayTxt] = useState(t.payment || ""), [ph, setPh] = useState(t.notify_phone || "");
  const set = (i, k) => e => setPk(pk.map((x, j) => j === i ? { ...x, [k]: e.target.value } : x));
  return (<section className="panel"><h2>Top up WhatsApp</h2><p className="note">Paket & harga yang muncul di tombol <b>Top up</b> Dashboard admin Exquise. Pengajuan baru & bukti transfer dikabarkan lewat WhatsApp ke No HP di bawah.</p>
    {pk.map((x, i) => <div className="form" key={i} style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
      <Field id={`tp-n-${i}`} label="Nama paket"><input id={`tp-n-${i}`} value={x.name} onChange={set(i, "name")} placeholder="Paket 1 bulan" /></Field>
      <Field id={`tp-p-${i}`} label="Harga (Rp)"><input id={`tp-p-${i}`} inputMode="numeric" value={x.price} onChange={set(i, "price")} /></Field>
      <Field id={`tp-d-${i}`} full label="Keterangan"><input id={`tp-d-${i}`} value={x.desc} onChange={set(i, "desc")} placeholder="Masa aktif 30 hari + kuota 1.000 pesan" /></Field>
      <div className="row full"><button className="btn ghost sm danger" onClick={() => setPk(pk.filter((_, j) => j !== i))}>Hapus paket</button></div></div>)}
    <button className="btn ghost" onClick={() => setPk([...pk, { name: "", desc: "", price: "" }])}>+ Tambah paket</button>
    <div className="form" style={{ marginTop: 12 }}>
      <Field id="tp-pay" full label="Instruksi pembayaran (tampil di invoice top up)"><textarea id="tp-pay" rows="3" value={payTxt} onChange={e => setPayTxt(e.target.value)} placeholder={"Transfer ke BCA … a.n. …\natau scan QRIS"} /></Field>
      <Field id="tp-ph" full label="No HP yang dikabari setiap ada pengajuan"><input id="tp-ph" inputMode="tel" value={ph} onChange={e => setPh(e.target.value)} placeholder="08…" /></Field></div>
    <button className="btn primary" onClick={() => run(() => {
      const packages = pk.filter(x => x.name.trim()).map(x => ({ name: x.name.trim(), desc: x.desc.trim(), price: num(x.price) }));
      if (packages.some(x => !(x.price > 0))) throw new Error("Setiap paket wajib punya harga");
      const notify_phone = normPhone(ph).p || null; if (ph.trim() && !notify_phone) throw new Error("No HP tidak valid");
      return saveBilling("topup", { packages, payment: payTxt.trim(), notify_phone });
    }, "Pengaturan top up disimpan")}>Simpan top up</button></section>);
}

function Sending({ b, run, toast }) {
  const [s, setS] = useState({ wa: false, email: false, wa_to: "", email_to: "", ...b.send }), [busy, setBusy] = useState("");
  const test = async ch => { setBusy(ch); try { const r = await billingApi("test", { channel: ch }); toast(r.summary); } catch (e) { toast(e.message); } setBusy(""); };
  return (<section className="panel"><h2>Kirim invoice otomatis</h2><p className="note">Saat invoice dibuat/dikirim dan saat ditandai lunas, link invoice dikirim lewat saluran yang aktif. Tombol "Kirim" di daftar invoice selalu bisa dipakai manual.</p>
    <div className="send-row"><button className="switch" role="switch" aria-checked={s.wa} aria-label="Kirim lewat WhatsApp" onClick={() => setS({ ...s, wa: !s.wa })}><span /></button><b>WhatsApp</b>
      <input inputMode="tel" value={s.wa_to} onChange={e => setS({ ...s, wa_to: e.target.value })} placeholder="No WhatsApp PIC (pisahkan koma)" aria-label="No WhatsApp tujuan" />
      <button className="btn ghost sm" disabled={busy === "wa"} onClick={() => test("wa")}>{busy === "wa" ? "Mengirim…" : "Tes kirim"}</button></div>
    <div className="send-row"><button className="switch" role="switch" aria-checked={s.email} aria-label="Kirim lewat email" onClick={() => setS({ ...s, email: !s.email })}><span /></button><b>Email</b>
      <input type="email" multiple value={s.email_to} onChange={e => setS({ ...s, email_to: e.target.value })} placeholder="email PIC (pisahkan koma)" aria-label="Email tujuan" />
      <button className="btn ghost sm" disabled={busy === "email"} onClick={() => test("email")}>{busy === "email" ? "Mengirim…" : "Tes kirim"}</button></div>
    <p className="note">Email dikirim dari kotak surat Hostinger. Isi secret <code>SMTP_USER</code> (alamat email) & <code>SMTP_PASS</code> (password email) di Supabase → Edge Functions → Secrets.</p>
    <button className="btn primary" onClick={() => run(() => saveBilling("send", { ...s, wa_to: s.wa_to.trim(), email_to: s.email_to.trim() }), "Pengaturan kirim disimpan")}>Simpan</button></section>);
}
