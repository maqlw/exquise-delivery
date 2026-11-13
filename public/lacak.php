<?php
// Halaman lacak = index.html yang sama, tapi judul & deskripsi kartu preview WhatsApp diisi data pesanan ini.
$html = file_get_contents(__DIR__ . '/index.html');
$t = preg_replace('/[^A-Za-z0-9]/', '', $_GET['t'] ?? ''); $g = preg_replace('/[^A-Za-z0-9]/', '', $_GET['g'] ?? '');
$key = 'sb_publishable_cDlKUs9MKPF0NlmSAXLY8A_REP-HB32'; // kunci publik (publishable), sama dengan yang dipakai web
function rpc($fn, $body, $key) {
  if (!function_exists('curl_init')) return null;
  $ch = curl_init('https://ddevslmrcduopydrcyun.supabase.co/rest/v1/rpc/' . $fn);
  curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 3,
    CURLOPT_HTTPHEADER => ["apikey: $key", 'Content-Type: application/json'], CURLOPT_POSTFIELDS => json_encode($body)]);
  return json_decode(curl_exec($ch) ?: 'null', true);
}
$e = fn($s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
$title = null; $desc = null;
if (strlen($t) >= 12 && is_array($d = rpc('track', ['p_token' => $t], $key)) && !empty($d['recipient'])) {
  $title = $e('Pesanan untuk ' . $d['recipient'] . ' · Exquise Patisserie');
  $desc = $e(trim(($d['item'] ?? '') . (!empty($d['sender']) ? ' dari ' . $d['sender'] : '')) . '. Klik untuk melihat status pengiriman dan perkiraan tiba.');
} elseif (strlen($g) >= 12 && is_array($d = rpc('track_group', ['p_token' => $g], $key))) {
  $title = $e(count($d['orders'] ?? []) . ' kiriman dari ' . ($d['sender'] ?? 'kamu') . ' · Exquise Patisserie');
  $desc = $e('Pantau status semua penerima dalam satu halaman.');
}
if ($title) {
  // str_replace (bukan regex) supaya karakter seperti $ atau \ di nama tidak diartikan khusus.
  $html = str_replace(
    ['<title>Exquise Delivery</title>', 'content="Lacak pesanan · Exquise Patisserie"', 'content="Status pengiriman dan perkiraan tiba pesanan Exquise Patisserie."'],
    ["<title>$title</title>", "content=\"$title\"", "content=\"$desc\""], $html);
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
echo $html;
