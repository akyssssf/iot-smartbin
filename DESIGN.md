# DESIGN.md — Smart Bin

Arah desain ini ditranskripsi dari brief pemilik proyek (percakapan pengerjaan landing page &
dashboard). Tidak ada yang ditambahkan oleh agen; bagian yang belum pernah disebut pemilik dibiarkan
kosong.

## Identitas
- Produk: Smart Bin, tempat sampah pintar berbasis ESP32 yang memilah organik/anorganik otomatis
  dan memantau kapasitas real-time. Proyek mata kuliah IoT, D3 Teknik Informatika.
- Audiens: dosen penguji, mahasiswa, pengunjung showcase proyek.

## Palet
- Utama: hijau (eco-friendly). "Pertahankan warna hijau yang sudah jadi identitas Smart Bin."
- Netral: abu-abu / putih.
- Aksen: biru (teknologi / IoT).
- Warna status mengikuti LED di alat: hijau normal, kuning hampir penuh, merah penuh.
- Kategori: hijau = organik, biru = anorganik.

## Gaya
- "Modern, clean, responsive, whitespace cukup, jangan padat teks."
- Dashboard: "card-based layout, rounded corners, shadow halus (gaya aplikasi IoT smart home)".
- Ikon: "ikon sederhana (Lucide/Feather), kontras teks cukup jelas".
- Foto (revisi): card foto rounded besar, full-bleed, kualitas tinggi, mengikuti referensi landing
  page bertema ekologi ("Coastal Care", "Green Living"). Foto adalah elemen pendukung, bukan
  pengubah skema warna.
- Referensi layout (dikirim pemilik, 18 Sep): landing "Ecology" di Dribbble
  (cdn.dribbble.com/userupload/17870644/...). Dipakai sebagai inspirasi pola, bukan tiruan (R-30):
  hero teks kiri + visual kanan yang memudar ke putih di bawah; deretan kartu pastel; foto berbentuk
  organik di samping teks; grid tile foto berlabel; komposisi foto tumpang kartu; container hijau
  gelap untuk highlight; footer mint. Warna turunan: hijau hutan #1b4d3e untuk judul dan tombol utama,
  mint #eaf6ee / #d9efe0 untuk latar dan kartu; hijau #16a34a tetap untuk organik/aksen, biru untuk
  anorganik/teknologi.

## Catatan keputusan (R-31)
- Section "Desain Produk" memakai tur berpandu (6 langkah, tombol next/back) karena penjelasan
  bertahap lebih mudah dicerna daripada satu paragraf panjang; isi langkah hanya menyebut bagian
  yang benar-benar ada di model GLB.
- Layar penuh punya dua jalur: Fullscreen API bila diizinkan, dan mode CSS bila ditolak
  (iPhone Safari tidak mendukung fullscreen untuk elemen), supaya tombolnya selalu berfungsi.
- Penguncian orientasi horizontal hanya bisa di Android; di iOS diganti imbauan memutar ponsel.
- Label section huruf besar (eyebrow, judul card dashboard): pembeda visual label kecil dari judul;
  tracking dijaga rapat (.03–.04em).
- Ikon Lucide: diminta eksplisit di brief; dipilih per relevansi konten (daun = organik, kotak = anorganik).
- Empat card fitur seragam: keempat fitur setara bobotnya, tidak ada yang "unggulan".
- Laci anorganik di model 3D ditimpa biru dari JS supaya kategori warna sama dengan situs.

## Tipografi
- Landing: Plus Jakarta Sans (pilihan agen mengikuti referensi yang memakai sans geometris membulat,
  cocok dengan sudut membulat besar). Dashboard tetap Inter (terbaca kecil di layar ponsel).
  Boleh diganti oleh pemilik.

## Motion
- Hero: model 3D berputar pelan + demo sampah jatuh (permintaan pemilik, tujuan: menjelaskan cara
  kerja tanpa teks panjang).
- Landing (permintaan pemilik 18 Sep): interaksi mouse yang halus. Parallax hero (scene 3D menoleh ±8°,
  kartu mengambang bergeser berlawanan arah), tombol utama magnetik, hover mengangkat kartu dan
  memperbesar foto sedikit, garis bawah nav meluncur. Nonaktif di layar sentuh dan prefers-reduced-motion.

Dial: ENERGY 2 / RHYTHM 3 / MOTION 3
(ditetapkan agen dari brief di atas: landing showcase proyek kampus, ramah, tidak agresif;
komposisi sengaja berbeda tiap section mengikuti referensi (split, deretan kartu, grid tile, tumpang, container gelap); motion terbatas pada hero 3D dan reveal.)
