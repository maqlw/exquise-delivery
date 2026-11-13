import { useState } from "react";
import { Field } from "../components/ui.jsx";
import { AreaPicker } from "../components/AreaPicker.jsx";
import { sb, saveSetting, updateOrder, toDb, fonnteApi } from "../lib/api.js";
import { TUNE, BATCH, recompute, normPhone } from "../lib/logic.js";

const parseLL = v => { const m = String(v).match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/); return m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180 ? [+m[1], +m[2]] : null; };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
const TPL = [
  ["kirim_pemesan", "Kirim → pemesan", "Terkirim saat status jadi Dalam perjalanan."],
  ["kirim_penerima", "Kirim → penerima", "Terkirim bersamaan ke No HP penerima."],
  ["sampai_pemesan", "Sampai → pemesan", "Terkirim saat kurir menandai sampai."],
  ["gagal_pemesan", "Gagal kirim → pemesan", "Terkirim saat kurir menandai gagal kirim (juga untuk pesanan grup)."],
  ["grup_mulai", "Grup mulai → pemesan", "Pesanan grup: 1x saat kiriman pertama berangkat. Pakai {jumlah} dan {link} (link grup)."],
  ["grup_selesai", "Grup selesai → pemesan", "Pesanan grup: 1x saat semua kiriman sampai/gagal. Pakai {jumlah}, {sampai}, {gagal}, {link}."],
];
const VARS = { pemesan: "Ibu Sari", penerima: "Pak Budi", diterima_oleh: "Satpam Andi", alasan: "Penerima tidak ada", item: "Fraisier D18", kode: "GD2026110001", jumlah: "30", sampai: "28", gagal: "2", alamat: "Jl. Kemang Raya No. 8, Bangka, Jakarta Selatan 12730", link: "https://delivery.exquisepatisserie.space/lacak/contoh" };
const fill = t => t.replace(/\{(\w+)\}/g, (m, v) => VARS[v] ?? m);

export default function Settings({ origins, settings, orders, reload, toast, wa, setWa, reloadWa }) {
  return (<>
    <h1>Pengaturan</h1><p className="sub">Lokasi asal, kata-kata WhatsApp, perkiraan waktu tempuh, dan alamat langganan.</p>
    <div className="stack" style={{ marginTop: 16 }}>
      <Fonnte wa={wa} setWa={setWa} reloadWa={reloadWa} min={settings.wa_alert?.min_quota ?? 100} reload={reload} toast={toast} />
      <Origins key={Object.keys(origins).join()} origins={origins} reload={reload} toast={toast} />
      <Templates value={settings.wa_templates || {}} reload={reload} toast={toast} />
      <Tuning value={settings.tuning || TUNE} reload={reload} toast={toast} />
      <GroupMin value={settings.group_wa?.min ?? 3} reload={reload} toast={toast} />
      <ReturnGps value={settings.return_gps?.check !== false} reload={reload} toast={toast} />
      <Aliases value={settings.aliases || []} orders={orders} reload={reload} toast={toast} />
    </div>
  </>);
}

function Origins({ origins, reload, toast }) {
  const [rows, setRows] = useState(() => Object.values(origins).map(o => ({ ...o, phone: o.phone || "", ll: `${o.lat}, ${o.lng}` })));
  const [add, setAdd] = useState({ name: "", short: "", ll: "" }), [del, setDel] = useState(null);
  const set = (i, k) => e => setRows(rows.map((r, j) => j === i ? { ...r, [k]: e.target.value } : r));
  async function save(r) {
    const ll = parseLL(r.ll); if (!r.name.trim() || !r.short.trim() || !ll) return toast("Isi nama, nama singkat, dan koordinat (contoh: -6.1525, 106.8345)");
    const { error } = await sb.from("origins").update({ name: r.name.trim(), short: r.short.trim(), lat: ll[0], lng: ll[1], phone: normPhone(r.phone).p }).eq("id", r.id);
    if (error) return toast("Gagal: " + error.message);
    toast(`${r.short} disimpan`); reload();
  }
  async function create() {
    const ll = parseLL(add.ll), id = slug(add.short || add.name);
    if (!add.name.trim() || !add.short.trim() || !ll || !id) return toast("Isi nama, nama singkat, dan koordinat (contoh: -6.1525, 106.8345)");
    if (origins[id]) return toast(`Kode ${id} sudah dipakai, ganti nama singkatnya`);
    const { error } = await sb.from("origins").insert({ id, name: add.name.trim(), short: add.short.trim(), lat: ll[0], lng: ll[1] });
    if (error) return toast("Gagal: " + error.message);
    toast(`${add.short} ditambahkan`); setAdd({ name: "", short: "", ll: "" }); reload();
  }
  async function remove(r) {
    const { error } = await sb.from("origins").delete().eq("id", r.id); setDel(null);
    if (error) return toast(/foreign key/i.test(error.message) ? `${r.short} masih dipakai kurir, pesanan, atau rute. Pindahkan dulu kurirnya, atau biarkan saja.` : "Gagal: " + error.message);
    toast(`${r.short} dihapus`); reload();
  }
  return (<section className="panel"><h2>Lokasi asal</h2>
    <p className="note">Koordinat: di Google Maps, klik kanan titik lokasi lalu klik angka koordinat paling atas untuk menyalin, kemudian tempel di sini.</p>
    {rows.map((r, i) => <div className="form" key={r.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
      <Field id={`o-name-${i}`} label={`Nama lengkap · kode ${r.id}`}><input id={`o-name-${i}`} value={r.name} onChange={set(i, "name")} /></Field>
      <Field id={`o-short-${i}`} label="Nama singkat"><input id={`o-short-${i}`} value={r.short} onChange={set(i, "short")} /></Field>
      <Field id={`o-ll-${i}`} label="Koordinat (lat, lng)"><input id={`o-ll-${i}`} value={r.ll} onChange={set(i, "ll")} inputMode="decimal" /></Field>
      <Field id={`o-ph-${i}`} label="No HP outlet (untuk driver Lalamove)"><input id={`o-ph-${i}`} value={r.phone} onChange={set(i, "phone")} inputMode="tel" placeholder="08…" /></Field>
      <div className="row full"><button className="btn primary sm" onClick={() => save(r)}>Simpan</button>
        {del === r.id ? <><button className="btn bad sm" onClick={() => remove(r)}>Ya, hapus {r.short}</button><button className="btn ghost sm" onClick={() => setDel(null)}>Batal</button></>
          : <button className="btn ghost sm danger" onClick={() => setDel(r.id)}>Hapus</button>}</div></div>)}
    <h3 style={{ marginTop: 16 }}>Tambah lokasi asal</h3>
    <div className="form">
      <Field id="o-add-name" label="Nama lengkap"><input id="o-add-name" value={add.name} onChange={e => setAdd({ ...add, name: e.target.value })} placeholder="Outlet Kelapa Gading" /></Field>
      <Field id="o-add-short" label="Nama singkat"><input id="o-add-short" value={add.short} onChange={e => setAdd({ ...add, short: e.target.value })} placeholder="Kelapa Gading" /></Field>
      <Field id="o-add-ll" full label="Koordinat (lat, lng)"><input id="o-add-ll" value={add.ll} onChange={e => setAdd({ ...add, ll: e.target.value })} placeholder="-6.1580, 106.9050" inputMode="decimal" /></Field></div>
    <button className="btn ok" onClick={create}>+ Tambah lokasi</button></section>);
}

function Templates({ value, reload, toast }) {
  const [t, setT] = useState(value);
  async function save() {
    if (TPL.some(([k]) => !String(t[k] || "").trim())) return toast("Semua template wajib diisi");
    try { await saveSetting("wa_templates", t); toast("Template WhatsApp disimpan"); reload(); } catch (e) { toast("Gagal: " + e.message); }
  }
  return (<section className="panel"><h2>Kata-kata WhatsApp</h2>
    <p className="note">Kata dalam kurung kurawal diganti otomatis: {Object.keys(VARS).map(k => <code key={k} style={{ marginRight: 6 }}>{`{${k}}`}</code>)}</p>
    {TPL.map(([k, title, hint]) => <div key={k} className="tplrow">
      <div><label className="lbl" htmlFor={`t-${k}`}>{title}</label><p className="note">{hint}</p>
        <textarea id={`t-${k}`} rows="5" value={t[k] || ""} onChange={e => setT({ ...t, [k]: e.target.value })} style={{ width: "100%" }} /></div>
      <div className="wa"><div className="bubble"><div className="to">Contoh</div>{fill(t[k] || "")}</div></div></div>)}
    <button className="btn primary" onClick={save}>Simpan template</button></section>);
}

function Tuning({ value, reload, toast }) {
  const [v, setV] = useState({ speed: { ...value.speed }, stop: value.stop });
  async function save() {
    const sp = [1, 2, 3].map(b => +v.speed[b]);
    if (sp.some(x => !(x >= 5 && x <= 60)) || !(+v.stop >= 1 && +v.stop <= 60)) return toast("Kecepatan 5–60 km/jam, waktu berhenti 1–60 menit");
    try { await saveSetting("tuning", { speed: { 1: sp[0], 2: sp[1], 3: sp[2] }, stop: +v.stop }); toast("Perkiraan waktu tempuh disimpan"); reload(); } catch (e) { toast("Gagal: " + e.message); }
  }
  return (<section className="panel"><h2>Perkiraan waktu tempuh</h2>
    <p className="note">Jarak dihitung dari garis lurus × 1,35 (perkiraan jalan berbelok), dibagi kecepatan rata-rata, ditambah waktu berhenti di tiap alamat. Kalau di lapangan sering telat, turunkan kecepatan atau naikkan waktu berhenti.</p>
    <div className="form">
      {[1, 2, 3].map(b => <Field key={b} id={`sp-${b}`} label={`Kecepatan Batch ${b} (${BATCH[b].label}), km/jam`}><input id={`sp-${b}`} type="number" min="5" max="60" value={v.speed[b]} onChange={e => setV({ ...v, speed: { ...v.speed, [b]: e.target.value } })} /></Field>)}
      <Field id="stop" label="Waktu berhenti per alamat (menit)"><input id="stop" type="number" min="1" max="60" value={v.stop} onChange={e => setV({ ...v, stop: e.target.value })} /></Field></div>
    <button className="btn primary" onClick={save}>Simpan</button></section>);
}

function Fonnte({ wa, setWa, reloadWa, min, reload, toast }) {
  const [tok, setTok] = useState(""), [busy, setBusy] = useState(""), [mode, setMode] = useState("qr"), [num, setNum] = useState(""), [res, setRes] = useState(null), [lim, setLim] = useState(min);
  const run = async (k, fn) => { setBusy(k); try { await fn(); } catch (e) { toast(e.message); } setBusy(""); };
  const save = () => run("save", async () => { const r = await fonnteApi("save", { token: tok }); setWa(r); setTok(""); toast(`Token baru tersimpan. Terhubung ke ${r.device || "perangkat Fonnte"}.`); });
  const connect = () => run("qr", async () => { setRes(null); const r = await fonnteApi("qr", { type: mode, whatsapp: num }); setRes(r); if (!r.ok && !r.image && !r.code) toast(r.reason || "Fonnte tidak memberi QR/kode. Mungkin perangkat sudah terhubung."); });
  const saveLim = () => run("lim", async () => { if (!(+lim >= 0)) throw new Error("Isi angka"); await saveSetting("wa_alert", { min_quota: +lim }); toast("Batas peringatan kuota disimpan"); reload(); });
  return (<section className="panel"><h2>WhatsApp (Fonnte)</h2>
    <div className="wa-set">
      <div><span className="lbl">Status</span><div className="addr"><span className={`wa-dot ${wa?.ok && wa.connected ? "on" : "off"}`} aria-hidden="true" /> {!wa ? "Memuat…" : !wa.ok ? (wa.reason || "Bermasalah") : wa.connected ? "Terhubung" : "Terputus"}</div></div>
      <div><span className="lbl">Nomor WhatsApp</span><div className="addr">{wa?.device || "–"}{wa?.name ? <span className="meta"> · {wa.name}</span> : ""}</div></div>
      <div><span className="lbl">Token dipakai</span><div className="addr mono">{wa?.token_hint || "–"} <span className="meta">{wa?.source === "server" ? "(dari server)" : wa?.source === "pengaturan" ? "(dari Pengaturan)" : ""}</span></div></div>
      <button className="btn ghost sm" disabled={busy === "cek"} onClick={() => run("cek", reloadWa)}>{busy === "cek" ? "Mengecek…" : "Cek ulang"}</button></div>

    <h3 style={{ marginTop: 16 }}>Ganti token / nomor WhatsApp</h3>
    <p className="note">Ambil token di dashboard Fonnte (menu Device → token perangkat). Token dites dulu ke Fonnte; kalau ditolak, token lama tetap dipakai. Setelah disimpan, token tidak bisa dilihat lagi.</p>
    <div className="row"><input type="password" autoComplete="off" value={tok} onChange={e => setTok(e.target.value)} placeholder="Tempel token Fonnte baru" aria-label="Token Fonnte baru" style={{ flex: 1, minWidth: 200 }} />
      <button className="btn primary" disabled={!tok.trim() || busy === "save"} onClick={save}>{busy === "save" ? "Mengetes…" : "Tes & simpan"}</button></div>

    <h3 style={{ marginTop: 16 }}>Sambungkan ulang WhatsApp</h3>
    <p className="note">Kalau status Terputus, sambungkan lagi dari HP outlet: WhatsApp → Perangkat tertaut → Tautkan perangkat.</p>
    <div className="seg" role="group" aria-label="Cara menyambung"><button aria-pressed={mode === "qr"} onClick={() => { setMode("qr"); setRes(null); }}>Scan QR</button><button aria-pressed={mode === "code"} onClick={() => { setMode("code"); setRes(null); }}>Pakai kode</button></div>
    <div className="row" style={{ marginTop: 8 }}>
      {mode === "code" && <input inputMode="tel" value={num} onChange={e => setNum(e.target.value)} placeholder="No WhatsApp outlet, mis. 0812…" aria-label="Nomor WhatsApp untuk kode" style={{ flex: 1, minWidth: 180 }} />}
      <button className="btn ok" disabled={busy === "qr"} onClick={connect}>{busy === "qr" ? "Meminta…" : mode === "qr" ? "Tampilkan QR" : "Minta kode"}</button></div>
    {res?.image && <div className="wa-qr"><img src={res.image.startsWith("data:") ? res.image : `data:image/png;base64,${res.image}`} alt="QR untuk menyambungkan WhatsApp ke Fonnte" /><p className="note">Scan dari WhatsApp → Perangkat tertaut → Tautkan perangkat. QR berlaku sebentar; kalau kedaluwarsa, tekan Tampilkan QR lagi.</p></div>}
    {res?.code && <div className="wa-code"><span className="lbl">Kode sambung</span><b className="mono">{res.code}</b><p className="note">Di WhatsApp: Perangkat tertaut → Tautkan perangkat → <b>Tautkan dengan nomor telepon</b>, lalu masukkan kode ini.</p></div>}
    {res && !res.image && !res.code && <p className="note">{res.reason || "Tidak ada QR/kode dari Fonnte. Kalau status sudah Terhubung, tidak perlu disambungkan."}</p>}

    <h3 style={{ marginTop: 16 }}>Peringatan kuota</h3>
    <div className="row"><Field id="wa-min" label="Peringatkan kalau kuota di bawah (pesan)"><input id="wa-min" type="number" min="0" value={lim} onChange={e => setLim(e.target.value)} /></Field>
      <button className="btn primary" style={{ alignSelf: "flex-end" }} disabled={busy === "lim"} onClick={saveLim}>Simpan</button></div>
    <p className="note">Peringatan juga muncul kalau WhatsApp terputus atau paket kedaluwarsa dalam 3 hari.</p></section>);
}

function GroupMin({ value, reload, toast }) {
  const [v, setV] = useState(value);
  async function save() {
    if (!(+v >= 2 && +v <= 100)) return toast("Isi angka 2 sampai 100");
    try { await saveSetting("group_wa", { min: +v }); toast("Batas pesanan grup disimpan"); reload(); } catch (e) { toast("Gagal: " + e.message); }
  }
  return (<section className="panel"><h2>Pesanan grup (1 pemesan, banyak penerima)</h2>
    <p className="note">Kalau 1 No HP pemesan punya sebanyak ini penerima atau lebih di tanggal kirim yang sama, pemesan cukup dapat 2 WhatsApp: saat kiriman pertama berangkat & saat semua selesai, dengan 1 link untuk memantau semua penerima. Penerima tetap dapat WhatsApp masing-masing. Gagal kirim tetap langsung dikabarkan.</p>
    <div className="row"><Field id="grp-min" label="Minimal jumlah penerima"><input id="grp-min" type="number" min="2" max="100" value={v} onChange={e => setV(e.target.value)} /></Field>
      <button className="btn primary" style={{ alignSelf: "flex-end" }} onClick={save}>Simpan</button></div></section>);
}

function ReturnGps({ value, reload, toast }) {
  const [on, setOn] = useState(value), [busy, setBusy] = useState(false);
  async function flip() {
    setBusy(true);
    try { await saveSetting("return_gps", { check: !on }); setOn(!on); toast(!on ? "Cek GPS saat kembali ke outlet: ON" : "Cek GPS saat kembali ke outlet: OFF"); reload(); } catch (e) { toast("Gagal: " + e.message); }
    setBusy(false);
  }
  return (<section className="panel"><div className="row between" style={{ flexWrap: "nowrap", gap: 16 }}>
    <div><h2>Cek GPS saat kurir kembali ke outlet</h2>
      <p className="note">{on ? "ON: tombol \"Saya sudah kembali di outlet\" hanya diterima kalau GPS kurir maks. 500 m dari outlet." : "OFF: kurir bisa menyelesaikan rute tanpa cek jarak. Pakai kalau GPS HP kurir sedang tidak akurat."} Pengiriman ke alamat tidak terpengaruh.</p></div>
    <button className="switch" role="switch" aria-checked={on} aria-label="Cek GPS saat kembali ke outlet" disabled={busy} onClick={flip}><span /></button></div></section>);
}

function Aliases({ value, orders, reload, toast }) {
  const [list, setList] = useState(value), [k, setK] = useState(""), [area, setArea] = useState(""), [key, setKey] = useState(0);
  async function persist(next, msg) {
    try {
      await saveSetting("aliases", next); setList(next); await reload();
      // Pesanan tanggal ini yang belum punya titik peta dicek ulang dengan daftar baru.
      let n = 0; for (const o of orders.filter(o => o.lat == null && o.via !== "pickup")) { const x = recompute({ ...o }); if (x.lat != null) { await updateOrder(o.id, toDb(x)); n++; } }
      toast(msg + (n ? ` · ${n} alamat sekarang ketemu di peta` : "")); if (n) reload();
    } catch (e) { toast("Gagal: " + e.message); }
  }
  return (<section className="panel"><h2>Alamat dikenal</h2>
    <p className="note">Untuk tempat langganan yang alamatnya tidak menyebut kelurahan atau kode pos, mis. "BRI KCK" atau "Menara Brilian". Kalau kata kunci ada di alamat, titik peta memakai kelurahan yang dipilih.</p>
    {list.length > 0 && <ul className="hist">{list.map((x, i) => <li key={i} className="row between"><div><b>{x.k}</b><div className="meta">→ {x.area}</div></div>
      <button className="btn ghost sm danger" onClick={() => persist(list.filter((_, j) => j !== i), `"${x.k}" dihapus`)}>Hapus</button></li>)}</ul>}
    <div className="form" key={key}>
      <Field id="al-k" label="Kata kunci di alamat"><input id="al-k" value={k} onChange={e => setK(e.target.value)} placeholder="BRI KCK" /></Field>
      <Field id="al-a" label="Kelurahan / kode pos"><AreaPicker id="al-a" onPick={setArea} /></Field></div>
    <button className="btn ok" onClick={() => {
      if (k.trim().length < 3 || !area) return toast("Isi kata kunci (min. 3 huruf) dan pilih kelurahan dari daftar");
      persist([...list, { k: k.trim(), area }], `"${k.trim()}" disimpan`); setK(""); setArea(""); setKey(key + 1);
    }}>+ Simpan alamat dikenal</button></section>);
}
