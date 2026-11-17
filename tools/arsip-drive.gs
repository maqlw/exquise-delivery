// Arsip foto bukti kirim Exquise -> Google Drive.
// Pasang di script.google.com (akun Google pemilik folder), lalu Deploy sebagai Web app.
// Struktur: <folder arsip>/2026/11-November/17/<kode>_<penerima>.jpg
const FOLDER_ID = '1BHD8Zyp1wUsUbQ0hNfjKs0zdluD7iV5E';
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Jalankan SEKALI dari editor: minta izin Drive, cek folder, buat kunci rahasia.
function setup() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('SECRET');
  if (!s) { s = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); p.setProperty('SECRET', s); }
  Logger.log('Folder arsip: ' + DriveApp.getFolderById(FOLDER_ID).getName());
  Logger.log('KUNCI (salin ke Supabase sebagai GDRIVE_SECRET): ' + s);
}

function sub_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function doPost(e) {
  const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (x) { return out({ ok: false, error: 'data tidak valid' }); }
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!secret || body.secret !== secret) return out({ ok: false, error: 'kunci salah' });
  const lock = LockService.getScriptLock();
  lock.waitLock(60000); // cegah folder tanggal dobel kalau dua kiriman datang bersamaan
  try {
    const root = DriveApp.getFolderById(FOLDER_ID), ids = [];
    for (const it of body.items || []) {
      try {
        const [y, m, d] = String(it.date).split('-');
        const day = sub_(sub_(sub_(root, y), m + '-' + BULAN[Number(m) - 1]), d);
        ids.push(day.createFile(Utilities.newBlob(Utilities.base64Decode(it.b64), 'image/jpeg', it.name)).getId());
      } catch (x) { ids.push(null); } // satu foto gagal tidak membatalkan yang lain; dicoba lagi 15 menit kemudian
    }
    return out({ ok: true, ids: ids });
  } finally { lock.releaseLock(); }
}
