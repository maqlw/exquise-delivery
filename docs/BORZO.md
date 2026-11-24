# Borzo Business API — catatan & rencana integrasi

Sumber: https://borzodelivery.com/id/business-api/doc (Borzo Business API **1.8**, dibaca 24/11/2026).

## Dasar
- **Test**: `https://robotapitest-id.borzodelivery.com/api/business/1.8` (daftar dulu di apitest.borzodelivery.com).
- **Production**: `https://robot-id.borzodelivery.com/api/business/1.8` — dibuka Borzo setelah kirim email bahwa uji di test sudah berhasil.
- Auth: header `X-DV-Auth-Token: <token>` (token di Personal cabinet, bisa diganti). Hanya GET & POST; POST body JSON UTF-8.
- Respons: selalu ada `is_successful`; error = HTTP 400 + kode error.

## Metode yang kita perlukan
| Metode | Guna |
|---|---|
| `POST /calculate-order` | Cek ongkir & validasi sebelum pesan |
| `POST /create-order` | Pesan kurir (1 atau banyak alamat) |
| `POST /edit-order` | Ubah order |
| `POST /cancel-order` | Batal (status new/available/active/delayed, selama kurir belum mengunjungi alamat) |
| `GET /orders?order_id=` | Ambil status order (juga untuk order yang dipesan dari aplikasi → "tempel Order ID") |
| `GET /courier?order_id=` | Nama/HP/foto kurir + lokasi (saat aktif & di jalan) |

## Isi order penting (create-order)
- `matter` (wajib): isi kiriman → item pesanan. `vehicle_type_id`: **8 = motor (≤20 kg)**, 7 = mobil, 1 = mobil/SUV/pickup.
- `is_thermobox_required`, `is_motobox_required`, `insurance_amount`, `is_route_optimizer_enabled` (banyak alamat → urutan optimal), `payment_method`: `cash` / `balance` (deposit) / `bank_card`.
- `points[]`: titik 1 = outlet (pickup), sisanya penerima. Per titik: `address`, `latitude`/`longitude`, `contact_person{phone,name}`, `client_order_id` (**isi kode pesanan kita**), `note`, `apartment_number`, `required_start_datetime`/`required_finish_datetime` (jendela waktu → cocok untuk "request jam").
- Respons per titik: **`point_id` (ID tetap per alamat — lebih enak dari Lalamove)**, `tracking_url` (link lacak penerima), dan setelah selesai **`place_photo_url`** (foto bukti), `sign_photo_url`, `checkin.recipient_full_name`.

## Status
- Order: `new` → `available` (mencari kurir) → `active` (kurir jalan) → `completed`; juga `canceled`, `delayed`, `reactivated`, `draft`.
- Delivery (per alamat): `planned`, `courier_assigned`, `courier_departed`, `courier_at_pickup`, **`parcel_picked_up`** (→ kita: *Dalam perjalanan* + WA), `courier_arrived`, **`finished`** (→ *Sampai* + foto + WA), `canceled`, `return_*`, `reattempt_*`.

## Notifikasi (callback)
- Isi **Callback URL** di Personal cabinet tab Integration → `…/functions/v1/borzo`.
- Dua jenis: perubahan **order** dan perubahan **delivery** (perlu diaktifkan). POST JSON; header **`X-DV-Signature` = HMAC-SHA256(body mentah, Callback Secret Key)** → wajib dicek.
- Gagal (non-2xx) dicoba ulang sampai 24 jam. Cadangan: pakai `lalamove-poll`-style polling (pg_cron 3 menit) lewat `GET /orders`.

## Rencana implementasi (meniru Lalamove)
1. Supabase secrets: `BORZO_TOKEN`, `BORZO_CALLBACK_SECRET`, `BORZO_ENV` (`production` / kosong = test). Kolom baru di `orders`: `ext_order_id`, `ext_point_id`, `ext_status`, `ext_price` (atau umumkan kolom `llm_*` jadi `ext_*`).
2. Edge function `borzo`: `quote`, `book` (+ banyak alamat, `client_order_id` = kode kita), `link` (tempel Order ID dari aplikasi Borzo → cocokkan alamat lewat `client_order_id`/No HP/`point_id`), `status`, `courier`, `cancel`, callback ber-signature, `poll`.
3. Sync: `parcel_picked_up` → jalan + WA kirim; `finished` → sampai + salin `place_photo_url` ke Storage + WA sampai (tanpa WA ulang bila sudah ditandai manual); ongkir masuk laporan.
4. UI Dispatch → tab Borzo: kotak seperti Lalamove (jenis kendaraan, thermobox, catatan, cek ongkir, pesan, tempel Order ID, status/driver, batal).

## Yang perlu disiapkan pemilik akun
- Daftar akun test di apitest.borzodelivery.com → ambil **token test** + **Callback Secret** (dimasukkan lewat Supabase secrets, jangan ditempel di chat).
- Tentukan cara bayar API: deposit (`balance`) / kartu / tunai.
- Setelah uji lolos: email Borzo untuk akses production → token production.
