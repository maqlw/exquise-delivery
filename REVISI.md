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
| **v005** | 13/11/2026 | Audit keamanan: tidak ada rahasia di website; data lokasi outlet ditutup dari akun asing. |
| **v004** | 13/11/2026 | Logo resmi Exquise (dengan croissant) di kartu preview & seluruh website, ikon tab croissant. |
| **v003** | 13/11/2026 | Kartu preview pakai logo Exquise (navy) di background krem + aksen terakota. |
| **v002** | 13/11/2026 | Kartu preview WhatsApp untuk link lacak (gambar Exquise + nama penerima & produk). |
| **v001** | 13/11/2026 | Titik awal riwayat versi. Berisi semua fitur sampai hari ini (rincian di bawah). |

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
