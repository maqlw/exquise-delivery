# Daftar Revisi · Exquise Delivery

Setiap revisi diberi nomor **v001, v002, …**. Untuk kembali ke salah satu versi, cukup bilang ke Claude:
> "restore ke v00X"

Yang dikembalikan oleh restore: **tampilan web** (delivery.exquisepatisserie.space) dan **fungsi server** (WhatsApp, Lalamove, login kurir).
Yang **tidak** ikut mundur: **data** (pesanan, kurir, pengaturan, template WA) dan struktur database.
Perubahan database selalu dibuat menambah (tidak menghapus kolom), jadi versi lama tetap bisa jalan di database yang baru.

| Versi | Tanggal | Isi perubahan |
|---|---|---|
| **v001** | 13/11/2026 | Titik awal riwayat versi. Berisi semua fitur sampai hari ini (rincian di bawah). |

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
