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
| **v035** | 19/11/2026 | Pesanan Lalamove di Dispatch cukup 1 kolom: tempel **Order ID** → link tracking diambil sendiri dari Lalamove, status/foto/WA otomatis (tidak perlu tempel link lagi). Link share tetap bisa disimpan, tapi statusnya manual. Dicek: Lalamove tidak mengirim kabar untuk order dari aplikasi, jadi Order ID tidak bisa ditebak dari link share. |
| **v034** | 19/11/2026 | Lalamove dari aplikasi: di Dispatch ada kotak "Tempel Order ID". Setelah dihubungkan, status, driver, foto bukti & WA otomatis seperti pesanan dari tombol Dispatch (order berisi beberapa alamat: dicocokkan lewat No HP penerima atau admin pilih alamatnya). Pesanan yang sudah ditandai Sampai manual ikut dapat foto bukti tanpa WA ulang. Pengecekan otomatis tiap 3 menit sebagai cadangan kabar dari Lalamove. |
| **v033** | 19/11/2026 | Fungsi Lalamove: cek baca-saja Order ID (untuk memastikan order dari aplikasi Lalamove bisa dibaca API). Hasil: 2 order dari aplikasi terbaca → API terhubung ke akun Lalamove yang sama. |
| **v032** | 19/11/2026 | Dispatch: daftar Pihak ketiga ditampilkan per 10 (tombol Sebelumnya/Berikutnya), yang belum selesai di atas, judul menampilkan jumlah yang belum selesai. Data pengiriman sebelum 19/11 dihapus untuk uji coba penuh. |
| **v031** | 19/11/2026 | Saklar **Pembagian otomatis** di Pengaturan (default OFF). OFF: kurir & urutan alamat mengikuti Excel; alamat tanpa nama driver masuk kotak "Belum ada kurir" di Dispatch (tidak dibagi otomatis, tidak ikut dikirim sampai dipilih kurirnya). ON: perilaku lama (dibagi per arah & jarak). Ganti tanggal tidak lagi sempat menampilkan data tanggal sebelumnya. |
| **v030** | 19/11/2026 | Upload Excel Matrix: kolom di sebelah WORDING (nama driver yang di-merge per kelompok) sekarang dibaca. Nama driver → alamat langsung masuk ke kurir itu di Dispatch (nama mirip ikut cocok, mis. IRFAN = IRPAN); "BATCH 2" → batch 2; "PICK UP OUTLET / LALAMOVE" → pick up kalau alamatnya pickup, selain itu Lalamove. Nama driver yang tidak ada di menu Kurir diberi peringatan. |
| **v029** | 19/11/2026 | Ganti batch/outlet/tanggal di Data Pengiriman sekarang ikut memindahkan pesanan di Dispatch: pesanan yang belum dibawa kurir keluar dari rute lama dan muncul di batch baru; pilihan batch di form menang atas pindahan lama di Dispatch. Batch dikunci setelah pesanan dibawa kurir. Kurir tes AZIS (0877-9000-6465) & DELIVERY dihapus; alamat AZIS tes dipindah ke AZIS asli. |
| **v028** | 19/11/2026 | Dispatch: kurir berjejer ke samping (tombol ‹ ›, bisa diciutkan per kurir / semua, daftar digulir di dalam kolom); pencarian penerima/kode/alamat/No HP/item (tekan "/"), loncat ke batch/outlet lain bila hasil ada di sana; peta pindah ke bawah. |
| **v027** | 18/11/2026 | Form Sampai: pilih dulu siapa yang menerima; kalau bukan penerima langsung, nama yang menerima wajib diisi (tidak lagi otomatis nama di pesanan). WA "sudah diterima oleh" menyebut hubungannya, mis. "Aldi (Satpam / resepsionis)". |
| **v026** | 18/11/2026 | Kurir berhalangan: pindahkan alamat (satu-satu atau semua sisa) ke kurir lain setelah rute dikirim. Perbaikan: pesanan yang diganti ke pihak ketiga otomatis keluar dari rute kurir. HP kurir memperbarui rute tiap 30 detik. |
| **v025** | 18/11/2026 | Pengaturan → Jasa kirim pihak ketiga: tambah / ubah nama / hapus jasa kirim (Borzo sudah ditambahkan), ikut terbaca dari kolom kiriman Excel; database tidak lagi membatasi 5 jasa kirim. |
| **v024** | 18/11/2026 | Lalamove: opsi tambahan per kendaraan (tas thermal, pulang pergi, waktu tunggu, antar sampai pintu, tol dalam kota) ikut ongkir; catatan untuk driver (mis. lewat pintu belakang); tip prioritas saat masih mencari driver. Data uji dibersihkan untuk live. |
| **v023** | 18/11/2026 | Akun staf di Pengaturan → Akun: 3 level (Pemilik / Admin / CS lihat saja), tambah akun dengan password sementara (wajib ganti saat login pertama), ubah level, reset password, nonaktifkan. Token WhatsApp hanya Pemilik. Batasan dikunci di database. |
| **v022** | 18/11/2026 | Tombol "Cari di Google Maps" di bawah kolom alamat (gratis, salin link lalu tempel jadi titik tepat); Lalamove: LALAMOVE_ENV tidak peka huruf besar, peringatan jelas bila key sandbox/production tidak cocok dengan mode. |
| **v021** | 18/11/2026 | Halaman lacak customer pakai peta jalan OpenStreetMap (gratis): titik tujuan + posisi kurir saat diantar, keterangan untuk kiriman Lalamove/pihak ketiga. |
| **v020** | 17/11/2026 | Peta jalan sungguhan (OpenStreetMap): titik tujuan bisa digeser / ditempel link Google Maps di form pesanan; cek titik di kotak Lalamove; Lalamove 1 driver banyak alamat (urutan searah dari Lalamove, total ongkir, jarak, perkiraan waktu, peta urutan). |
| **v019** | 17/11/2026 | Halaman /cek tanpa login: pemesan isi No HP + nama → kiriman 30 hari terakhir per tanggal (salah 5x dikunci 15 menit). Daftar penerima grup bisa dibuka di tempat (status, perkiraan tiba, foto) tanpa pindah halaman. |
| **v018** | 17/11/2026 | Link lacak lebih pendek: /l/ + 8 karakter (tanpa huruf mirip). Link lama /lacak/… tetap bisa dibuka. |
| **v017** | 17/11/2026 | Link DOKU per paket top up (otomatis jadi tombol Bayar di invoice & form top up admin); kotak cek link DOKU di /penyedia (domain, format, link dobel, pengingat nominal); login penyedia pakai akun admin fahmi@exquiseindonesia.com. |
| **v016** | 17/11/2026 | Foto bukti dikompres maks 150 KB; foto > 30 hari otomatis dipindah ke Google Drive (folder tahun/bulan/hari) tiap pagi jam 08.00-09.55 WIB; link lacak lama menampilkan "foto sudah diarsipkan". |
| **v015** | 14/11/2026 | Tagihan langganan: panel penyedia (/penyedia), invoice online + unduh PDF dengan cap LUNAS, menu Tagihan admin, masa tenggang & kunci layanan saat nonaktif, kirim invoice via WA/email (bisa dinyalakan/dimatikan). Top up WhatsApp sekarang lewat invoice. |
| **v014** | 14/11/2026 | Form top up sendiri (paket & harga sendiri, bukti transfer, notifikasi WA ke penyedia jasa); nama penyedia disembunyikan jadi "WhatsApp Gateway". |
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

## v014 · 14/11/2026 · top up versi sendiri
- Tombol **Top up** di Dashboard membuka form 3 langkah: **pilih paket** (nama, keterangan, harga diatur di Pengaturan) → **bayar** (instruksi rekening/QRIS dari Pengaturan + unggah foto bukti transfer, dikompres otomatis) → **diproses**.
- Setiap pengajuan baru & bukti transfer masuk dikabarkan lewat WhatsApp ke **No HP penyedia jasa** (diatur di Pengaturan → Top up WhatsApp), lengkap dengan link foto bukti.
- **Pengaturan → Top up WhatsApp:** atur paket & harga, instruksi pembayaran, No HP notifikasi, dan **riwayat top up** dengan tombol Tandai selesai / Batalkan.
- Kartu Dashboard menampilkan pengajuan yang masih menunggu pembayaran / sedang diproses (bisa diklik untuk melanjutkan).
- Semua tulisan & link penyedia di tampilan admin diganti netral: **"WhatsApp Gateway"**; fungsi server berganti nama jadi `wa-gateway`.

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
