# Daftar Revisi · Exquise Delivery

Setiap revisi diberi nomor **v001, v002, …**. Untuk kembali ke salah satu versi, cukup bilang ke Claude:
> "restore ke v00X"

Semua versi tersimpan permanen di GitHub (private): https://github.com/maqlw/exquise-delivery
- Versi terbaru: branch `main`
- Tiap versi: branch `versi/v001`, `versi/v002`, … (pilih di menu branch GitHub untuk melihat isinya)

Yang dikembalikan oleh restore: **tampilan web** (delivery.exquisepatisserie.space) dan **fungsi server** (WhatsApp, Lalamove, login kurir).
Yang **tidak** ikut mundur: **data** (pesanan, kurir, pengaturan, template WA) dan struktur database.
Perubahan database selalu dibuat menambah (tidak menghapus kolom), jadi versi lama tetap bisa jalan di database yang baru.

| Versi | Tanggal | Isi perubahan |
|---|---|---|
| **v013** | 14/11/2026 | Fonnte: ganti token dari Pengaturan, sisa kuota & kedaluwarsa + Top up di Dashboard, sambung ulang via QR/kode, peringatan otomatis. |
| **v012** | 13/11/2026 | No HP disamarkan (081xxx1234) di link publik; browser selalu ambil versi website terbaru. |
| **v011** | 13/11/2026 | Pesanan grup: 1 pemesan banyak penerima cukup 2 WhatsApp (awal & akhir) + 1 link pantau semua penerima. |
| **v010** | 13/11/2026 | Saklar cek GPS kembali ke outlet; kotak cari & filter tanggal baru; menu HP melayang di bawah ala Dynamic Island. |
| **v009** | 13/11/2026 | Radius kembali ke outlet 500 m; transisi liquid glass di semua menu, tab & filter admin; tombol mata di login. |
| **v008** | 13/11/2026 | Kurir wajib kembali ke outlet (cek GPS) atau minta izin pulang ke admin; tombol Kirim lebih jelas; transisi liquid glass antar batch. |
| **v007** | 13/11/2026 | Tampilan HP admin: tombol Keluar di header, menu ikon saja (nama muncul di menu yang dibuka). |
| **v006** | 13/11/2026 | Perbaikan bug: pesanan tambahan di batch yang sudah dikirim sekarang bisa di-dispatch. |
| **v005** | 13/11/2026 | Audit keamanan: tidak ada rahasia di website; data lokasi outlet ditutup dari akun asing. |
| **v004** | 13/11/2026 | Logo resmi Exquise (dengan croissant) di kartu preview & seluruh website, ikon tab croissant. |
| **v003** | 13/11/2026 | Kartu preview pakai logo Exquise (navy) di background krem + aksen terakota. |
| **v002** | 13/11/2026 | Kartu preview WhatsApp untuk link lacak (gambar Exquise + nama penerima & produk). |
| **v001** | 13/11/2026 | Titik awal riwayat versi. Berisi semua fitur sampai hari ini (rincian di bawah). |

## v013 · 14/11/2026 · WhatsApp (Fonnte) di aplikasi
- **Dashboard:** kartu WhatsApp berisi status terhubung, **sisa kuota**, **tanggal kedaluwarsa** (+ "x hari lagi"), tombol **Top up** (form langkah-langkah + tombol ke halaman pembayaran Fonnte) dan **Cek ulang**.
- **Pengaturan → WhatsApp (Fonnte):** status, nomor terhubung (tersamar), ujung token yang dipakai; **ganti token** (dites ke Fonnte dulu, token lama tetap dipakai kalau ditolak; token tidak bisa dibaca lagi setelah disimpan); **sambung ulang** via **Scan QR** atau **Pakai kode**; batas **peringatan kuota** (default 100).
- **Peringatan otomatis** di atas semua halaman admin: WhatsApp terputus, kuota di bawah batas, atau paket kedaluwarsa ≤ 3 hari.
- Top up tidak memotong saldo dari aplikasi; pembayaran tetap di Fonnte.

## v012 · 13/11/2026 · privasi No HP & cache
- Halaman publik (link lacak & link grup) menampilkan No HP pengirim/penerima **tersamar**, mis. `087xxx6465`. Penyamaran dilakukan di server, nomor lengkap tidak pernah dikirim ke halaman publik. Admin & kurir tetap melihat nomor lengkap.
- Hosting sekarang memberi tahu browser untuk selalu mengambil halaman terbaru (index/lacak), jadi setelah update tidak ada lagi yang tertahan di versi lama (penyebab link grup sempat minta login).

## v011 · 13/11/2026 · pesanan grup
- Pemesan (No HP sama) dengan **≥ 3 penerima** di tanggal kirim yang sama otomatis jadi **pesanan grup** (angka bisa diubah di Pengaturan → Pesanan grup).
- WhatsApp ke pemesan grup cuma **2x**: "grup mulai" saat kiriman pertama berangkat & "grup selesai" saat semua sampai/gagal (berisi jumlah sampai & gagal). **Gagal kirim tetap langsung dikabarkan.** Penerima tetap dapat WhatsApp masing-masing. Berlaku juga untuk kiriman Lalamove.
- Link grup **/g/…**: progres, jumlah per status, daftar semua penerima (cari nama/alamat), tiap baris bisa diklik ke halaman lacak penerima. Kartu preview WhatsApp: "N kiriman dari {pemesan}".
- Template baru di Pengaturan: **Grup mulai** & **Grup selesai** dengan kata otomatis {jumlah}, {sampai}, {gagal}, {link}.
- Admin: detail Lacak pesanan menampilkan **link grup** (bisa disalin) kalau pemesannya pesanan grup.
- Kalau WhatsApp grup gagal terkirim (Fonnte gangguan), tandanya dibatalkan supaya dicoba lagi di kejadian berikutnya.

## v010 · 13/11/2026 · saklar GPS, kotak cari, filter tanggal, menu melayang
- **Pengaturan → Cek GPS saat kurir kembali ke outlet** (saklar ON/OFF, default ON). OFF: tombol "Saya sudah kembali di outlet" langsung diterima tanpa cek jarak (untuk HP dengan GPS kurang akurat). Hanya berlaku untuk langkah kembali ke outlet.
- **Kotak cari baru** (Data pengiriman & Lacak pesanan): ikon kaca pembesar, sorotan hijau saat diketik, jumlah hasil, tombol hapus.
- **Filter tanggal Laporan** jadi kartu "Dari → Sampai" bergaya kaca.
- **HP admin:** menu (Dashboard, Pengiriman, Dispatch, …) melayang di bawah layar ala Dynamic Island, pil kaca di menu aktif; logo, lokasi asal & Keluar tetap di atas.

## v009 · 13/11/2026 · radius 500 m, liquid glass di admin, mata password
- "Saya sudah kembali di outlet" diterima kalau GPS kurir **maks. 500 m** dari titik outlet (sebelumnya 1 km).
- Pil kaca meluncur & memantul otomatis di **semua** grup tombol: menu samping (laptop & HP), tab Batch, pilihan lokasi asal, filter Data pengiriman, rentang & tingkat Laporan, pilihan Admin/Kurir di login (`src/lib/glass.js`).
- Pindah halaman admin, pindah batch/lokasi di Dispatch, dan ganti Admin/Kurir di login: isi masuk meluncur + memudar sesuai arah.
- Login: tombol **mata** untuk menampilkan/menyembunyikan password (admin) dan PIN (kurir).

## v008 · 13/11/2026 · kembali ke outlet & izin pulang
- **Rute kurir internal baru selesai setelah kembali ke outlet.** Setelah alamat terakhir, HP kurir menampilkan kartu "Kembali ke CK/Depok": tombol **"Saya sudah kembali di …"** mengecek GPS (harus ≤ 1 km dari titik outlet). GPS tetap terkirim selama perjalanan balik, jadi leader bisa memantau.
- **Langsung pulang perlu izin admin:** kurir tekan "Langsung pulang (perlu izin admin)" + alasan opsional. Di semua halaman admin muncul panel "Minta izin langsung pulang" dengan tombol **Setujui** (rute selesai) / **Tolak, kembali ke outlet** (kurir wajib kembali). HP kurir cek keputusan otomatis tiap 20 detik.
- Status kurir di Dispatch & Dashboard: Menuju outlet / Minta izin pulang / Sudah kembali / Pulang (disetujui).
- Tombol **Kirim · kabari pemesan & penerima** jadi hijau terang (sebelumnya menyatu dengan kartu gelap).
- Pilihan batch di HP kurir bergaya **liquid glass**: pil kaca meluncur & memantul, isi rute masuk meluncur + memudar sesuai arah.

## v007 · 13/11/2026 · header HP admin
- Tombol **Keluar** sekarang ada di kanan atas header saat dibuka di HP (sebelumnya tersembunyi).
- Menu di HP tampil sebagai ikon saja; nama menu muncul hanya di menu yang sedang dibuka. Di laptop tetap ikon + nama seperti biasa.

## v006 · 13/11/2026 · bug tambahan batch
- **Bug:** setelah rute satu batch dikirim ke kurir, pesanan baru yang masuk ke batch itu terhitung tapi tidak muncul di rute dan tidak ada tombol kirimnya. Pesanan tanpa jam request juga bisa otomatis masuk ke batch yang sudah dikirim.
- **Perbaikan:** di Dispatch muncul bagian **"Tambahan Batch X"** (kotak garis putus oranye) + tanda **"+N tambahan"** di tab batch. Tombol **"Kirim N alamat tambahan ke kurir"** menyambung alamat ke rute kurir yang sudah ada (kalau rutenya sudah selesai, dibuka lagi). Pesanan tanpa jam request tidak lagi dimasukkan ke batch yang sudah dikirim.
- **Supaya tidak terulang:** 2 tes otomatis baru (`src/lib/logic.test.js`) memastikan setiap pesanan selalu ada di rute terkirim, rencana, atau tambahan, tanpa hilang atau dobel. Tes dijalankan sebelum setiap rilis.

## v005 · 13/11/2026 · audit keamanan
- Dicek: file website (JS, HTML, PHP) tidak memuat token Fonnte, key Lalamove, kunci admin Supabase, email, password, atau No HP. Yang ada hanya alamat Supabase + kunci publik (memang harus publik).
- Dicek: tanpa login, semua tabel kosong, foto bukti tidak bisa didaftar, fungsi internal ditolak. Customer tetap bisa buka link lacak tanpa login.
- Diperbaiki: tabel lokasi outlet (nama, koordinat, No HP outlet) sebelumnya bisa dibaca akun login mana pun; sekarang hanya admin & kurir (`supabase/migrations/20261113_origins_admin_courier_only.sql`).

## v004 · 13/11/2026 · logo resmi di seluruh website
- Logo dari file resmi (navy #0D3144 + croissant terakota #BC5539), dibuat 3 versi transparan: warna (`logo-exquise.png`), terang untuk background gelap (`logo-exquise-light.png`), ikon croissant (`icon-croissant.png`).
- Dipasang di: kartu preview WhatsApp (`og-exquise-logo.jpg`), halaman login, sidebar admin (HP & laptop), header kurir, header halaman lacak customer (background krem + garis terakota), ikon tab browser.

## v003 · 13/11/2026 · logo Exquise di kartu preview
- Gambar kartu diganti `public/og-exquise.jpg`: logo EXQUISE PATISSERIE warna navy (diambil dari logo website, diwarnai ulang), background krem, garis & truk terakota mengikuti warna logo.
- Ornamen pita oranye di atas logo belum ada (file logo lengkapnya belum tersedia di sesi).

## v002 · 13/11/2026 · kartu preview WhatsApp
- Link lacak yang dikirim lewat WhatsApp tampil sebagai kartu: gambar hijau Exquise "Lacak pesananmu", judul "Pesanan untuk {penerima} · Exquise Patisserie", keterangan produk & pemesan, dan domain delivery.exquisepatisserie.space.
- Dibuat oleh `public/lacak.php` (judul per pesanan) + gambar `public/og.jpg`. Link yang salah tetap tampil kartu umum "Lacak pesanan · Exquise Patisserie".
- Isi kartu tidak memuat status pengiriman, karena WhatsApp menyimpan kartu lama dan status bisa berubah.

## v001 · 13/11/2026 · titik awal
Semua yang sudah dibuat sebelum riwayat versi dimulai:
- **Dasar aplikasi:** React + Vite + Tailwind, Supabase, login Admin (email) dan Kurir (No HP + PIN), upload Excel Matrix Delivery (Sheet1), tambah/edit/hapus manual dengan riwayat alamat, Dispatch per lokasi asal & batch, Lacak, halaman lacak customer, WhatsApp Fonnte.
- **Alamat:** data 1.502 kelurahan + kode pos Jabodetabek, kotak cari kelurahan/kode pos, "Alamat dikenal", tombol cek ulang alamat.
- **Data pengiriman:** kotak cari, pilih banyak sekaligus (ubah kiriman/asal/batch).
- **Dispatch:** detail penerima, pengirim, alamat, produk per nomor; tombol Edit sebelum rute dikirim; panel Lalamove (ongkir, pesan, status, batal).
- **Kurir:** edit/hapus kurir; di HP kurir WhatsApp dikirim per alamat (tombol Kirim), bisa pilih alamat lain, foto bukti otomatis dikompres maks 500 KB.
- **Pengaturan:** lokasi asal (+ No HP outlet), kata-kata WhatsApp (dengan {alamat}), perkiraan waktu tempuh, alamat dikenal.
- **Laporan & Dashboard:** filter hari/bulan/custom, daerah tujuan terbanyak, peta sebaran, ringkasan & rincian per cara kirim, ongkir Lalamove.
- **Lalamove:** API v3 (sandbox), status otomatis lewat webhook (diambil → Dalam perjalanan + WA, selesai → Sampai + foto + WA).
- **Halaman lacak customer:** detail pengirim/penerima/alamat, animasi, perkiraan tiba dari GPS kurir.
