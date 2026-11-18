import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// Kelola akun staf (Pengaturan → Akun). Pemanggil: pemilik/admin aktif. Hanya pemilik yang boleh membuat/mengubah akun pemilik.
// Akun baru & reset password memakai password sementara (ditampilkan sekali), wajib diganti saat login pertama.
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const ROLES = ["pemilik", "admin", "cs"];
const tempPw = () => { const a = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", b = crypto.getRandomValues(new Uint8Array(10)); return [...b].map(x => a[x % a.length]).join(""); };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const [{ data: me }, { data: { user } }] = await Promise.all([asUser.rpc("my_staff"), asUser.auth.getUser()]);
  if (!user || !me?.active || !["pemilik", "admin"].includes(me.role)) return json({ error: "Hanya pemilik atau admin" }, 403);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { action, user_id, email, name, role, active } = await req.json().catch(() => ({}));
  const owner = me.role === "pemilik";
  const activeOwners = async () => (await db.from("admins").select("user_id", { count: "exact", head: true }).eq("role", "pemilik").eq("active", true)).count ?? 0;
  try {
    if (action === "list") {
      const { data: rows } = await db.from("admins").select("*").order("created_at");
      const list = await Promise.all((rows || []).map(async (r: any) => {
        const { data } = await db.auth.admin.getUserById(r.user_id);
        return { user_id: r.user_id, email: data.user?.email, last_sign_in: data.user?.last_sign_in_at, name: r.name, role: r.role, active: r.active, must_change_pw: r.must_change_pw, me: r.user_id === user.id };
      }));
      return json({ list, my_role: me.role });
    }
    if (action === "create") {
      const em = String(email || "").trim().toLowerCase(), nm = String(name || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return json({ error: "Email tidak valid" }, 400);
      if (!nm) return json({ error: "Nama wajib diisi" }, 400);
      if (!ROLES.includes(role)) return json({ error: "Level tidak dikenal" }, 400);
      if (role === "pemilik" && !owner) return json({ error: "Hanya pemilik yang bisa membuat akun pemilik" }, 403);
      const pw = tempPw();
      const { data, error } = await db.auth.admin.createUser({ email: em, password: pw, email_confirm: true, user_metadata: { name: nm } });
      if (error) return json({ error: /already|registered|exists/i.test(error.message) ? "Email ini sudah terdaftar" : error.message }, 400);
      const { error: e2 } = await db.from("admins").insert({ user_id: data.user.id, role, name: nm, must_change_pw: true });
      if (e2) { await db.auth.admin.deleteUser(data.user.id); return json({ error: e2.message }, 500); } // jangan tinggalkan login tanpa akses
      return json({ email: em, password: pw });
    }
    const { data: t } = await db.from("admins").select("*").eq("user_id", user_id).maybeSingle();
    if (!t) return json({ error: "Akun tidak ditemukan" }, 404);
    if ((t.role === "pemilik" || role === "pemilik") && !owner) return json({ error: "Hanya pemilik yang bisa mengubah akun pemilik" }, 403);
    if (action === "update") {
      const patch: any = {};
      if (name !== undefined) { if (!String(name).trim()) return json({ error: "Nama wajib diisi" }, 400); patch.name = String(name).trim(); }
      if (role !== undefined) { if (!ROLES.includes(role)) return json({ error: "Level tidak dikenal" }, 400); patch.role = role; }
      if (active !== undefined) patch.active = !!active;
      if (t.user_id === user.id && (patch.role && patch.role !== t.role || patch.active === false)) return json({ error: "Tidak bisa mengubah level atau menonaktifkan akun sendiri" }, 400);
      if (t.role === "pemilik" && t.active && (patch.role && patch.role !== "pemilik" || patch.active === false) && await activeOwners() <= 1) return json({ error: "Harus ada minimal 1 pemilik aktif" }, 400);
      const { error } = await db.from("admins").update(patch).eq("user_id", t.user_id);
      if (error) return json({ error: error.message }, 500);
      if (patch.active !== undefined) await db.auth.admin.updateUserById(t.user_id, { ban_duration: patch.active ? "none" : "876000h" }); // nonaktif = tidak bisa login sama sekali
      return json({ ok: true });
    }
    if (action === "reset") {
      if (t.user_id === user.id) return json({ error: "Untuk akun sendiri, pakai Ganti password saya" }, 400);
      const pw = tempPw();
      const { error } = await db.auth.admin.updateUserById(t.user_id, { password: pw });
      if (error) return json({ error: error.message }, 500);
      await db.from("admins").update({ must_change_pw: true }).eq("user_id", t.user_id);
      return json({ password: pw });
    }
    return json({ error: "action tidak dikenal" }, 400);
  } catch (e) { return json({ error: String((e as Error).message || e) }, 502); }
});
