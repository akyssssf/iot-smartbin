# Tindak lanjut audit 001, 2026-09-18

Pemilik menyetujui semua rekomendasi. Semua 17 temuan kini SUDAH DIPERBAIKI atau DIPERTAHANKAN
dengan alasan tercatat (#13 ikon Lucide, #15 card seragam).

Perubahan tindak lanjut (di luar yang sudah diterapkan saat audit):
- #1  Em dash diganti koma/titik dua di `index.html`, `dashboard.html`, `js/dashboard.js`. Kata tidak berubah.
- #5  Tiga tautan placeholder di footer dilepas, diberi label "segera tersedia".
- #8  Kartu hero "ESP32" dan "Deteksi terakhir" diberi tag "contoh".
- #9  Dashboard: loading state saat dibuka, error state alat offline (uji dari Pengaturan → Koneksi alat).
- #10 Pill di atas H1 diganti baris teks.
- #11 Panah hanya di CTA utama hero.
- #12 Tracking label huruf besar dikurangi ke .03–.04em.
- #14 Animasi kartu mengambang dan denyut titik "Online" dihapus.
- #16 Efek hover angkat pada card non-interaktif dihapus.
- #17 Material laci anorganik di model 3D ditimpa jadi biru (#2563eb) agar palet konsisten.

Verifikasi (R-35): kedua halaman dijalankan di http://localhost:5173, 0 error console.
Landing: 6 tautan nav → section ada; menu mobile buka/tutup (klik & Escape); Reset tampilan
mengembalikan kamera; 9 foto termuat; tanpa overflow @375 dan @1280.
Dashboard: 4 tab; lonceng → riwayat; simulasi deteksi → counter +1 dan toast; manual override →
tombol aktif → platform miring; slider → legenda; switch → banner; ekspor → toast; modal reset →
Escape menutup dan fokus kembali; reset → empty state → muat ulang; loading → online → offline →
sambungkan kembali; kontrol terlihat ≥ 44 px.

Catatan 18 Sep (setelah tindak lanjut): pemilik meminta interaksi mouse. Efek hover angkat pada
kartu (#16) dikembalikan atas keputusan pemilik sebagai bagian dari bahasa interaksi halaman,
bersama parallax hero dan tombol magnetik. Dial MOTION dinaikkan ke 3 di DESIGN.md; semua efek
mati di perangkat sentuh dan prefers-reduced-motion.
