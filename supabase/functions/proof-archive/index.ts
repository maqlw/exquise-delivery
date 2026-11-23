import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

// Pindahkan foto bukti lama dari Supabase ke Google Drive (lewat Apps Script milik Exquise).
// Dipanggil pg_cron tiap 5 menit jam 08.00-09.55 WIB dengan header x-cron-key. Secret: GDRIVE_URL (URL web app), GDRIVE_SECRET.
// Urutan aman: simpan di Drive -> catat "drive:<id>" di pesanan -> baru hapus dari Supabase.
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const clean = (s: string) => String(s || "").replace(/[^\p{L}\p{N} ._-]+/gu, "").trim().slice(0, 60);
const jakartaDate = (iso: string | null) => new Date(new Date(iso || Date.now()).getTime() + 7 * 3600e3).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: key } = await db.from("app_secrets").select("value").eq("key", "cron_key").maybeSingle();
  if (!key?.value || req.headers.get("x-cron-key") !== key.value) return json({ error: "Tidak punya akses" }, 403);
  const url = Deno.env.get("GDRIVE_URL"), secret = Deno.env.get("GDRIVE_SECRET");
  if (!url || !secret) return json({ skipped: "GDRIVE_URL / GDRIVE_SECRET belum diatur" });
  const { days = 30, limit = 25, test } = await req.json().catch(() => ({}));
  if (test) { // kirim 1 gambar uji (piksel putih) tanpa menyentuh pesanan
    const b64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, items: [{ name: "TES-ARSIP.jpg", date: jakartaDate(null), b64 }] }) }).then(r => r.text()).catch(e => String(e));
    return json({ test: r.slice(0, 300) });
  }

  const { data: rows, error } = await db.rpc("proofs_to_archive", { p_limit: limit, p_days: days });
  if (error) return json({ error: error.message }, 500);
  if (!rows?.length) return json({ moved: 0 });

  const items: { row: any; name: string; date: string; b64: string }[] = [];
  for (const r of rows) {
    const { data: blob } = await db.storage.from("proofs").download(r.proof_path);
    if (!blob) continue; // file hilang: biarkan, dicoba lagi nanti
    items.push({ row: r, name: `${clean(r.code)}_${clean(r.recipient)}${r.col === "proof_before_path" ? "_sebelum" : ""}.jpg`, date: jakartaDate(r.delivered_at), b64: encodeBase64(new Uint8Array(await blob.arrayBuffer())) });
  }
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, items: items.map(({ name, date, b64 }) => ({ name, date, b64 })) }) })
    .then(r => r.json()).catch(e => ({ ok: false, error: String(e) }));
  if (!res.ok) return json({ error: "Drive: " + (res.error || "gagal") }, 502);

  let moved = 0;
  for (let i = 0; i < items.length; i++) {
    const id = res.ids?.[i], r = items[i].row;
    if (!id) continue;
    const col = r.col || "proof_path"; // foto sesudah diterima (proof_path) atau sebelum diserahkan (proof_before_path)
    const { data: upd } = await db.from("orders").update({ [col]: "drive:" + id }).eq("id", r.id).eq(col, r.proof_path).select("id");
    if (upd?.length) { await db.storage.from("proofs").remove([r.proof_path]); moved++; }
  }
  return json({ moved, of: rows.length });
});
