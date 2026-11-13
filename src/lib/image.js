// Kompres foto bukti sebelum upload: JPEG, sisi terpanjang maks 1600px, ukuran maks 500 KB.
export const MAX_BYTES = 500 * 1024;
export async function compressImage(file, maxBytes = MAX_BYTES) {
  if (file.size <= maxBytes && file.type === "image/jpeg") return file;
  const bmp = await createImageBitmap(file); // orientasi EXIF dari kamera HP ikut dibaca
  const toBlob = (c, q) => new Promise(r => c.toBlob(r, "image/jpeg", q));
  for (let side = 1600; side >= 480; side = Math.round(side * 0.75)) {
    const k = Math.min(1, side / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    for (const q of [0.82, 0.7, 0.58, 0.46]) {
      const b = await toBlob(c, q);
      if (b && b.size <= maxBytes) return new File([b], "bukti.jpg", { type: "image/jpeg" });
    }
  }
  throw new Error("Foto tidak bisa dikecilkan sampai 500 KB. Coba foto ulang.");
}
