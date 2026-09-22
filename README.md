# Smart Bin — Landing Page & Mockup Dashboard

Proyek mata kuliah IoT (D3 Teknik Informatika). Tempat sampah pintar berbasis ESP32 yang
memilah sampah organik/anorganik secara otomatis dan memantau kapasitas tiap kompartemen
secara real-time.

## Cara membuka

Tidak perlu build tool. Buka langsung di browser:

- `index.html` — landing page (showcase proyek)
- `dashboard.html` — mockup aplikasi mobile (4 halaman, interaktif, data simulasi)

Atau jalankan server lokal supaya font Google termuat dengan lancar:

```bash
python3 -m http.server 5173
```

lalu buka <http://localhost:5173>.

## Struktur

```
index.html          landing page
dashboard.html      mockup dashboard mobile
css/base.css        design tokens (warna, radius, shadow, tombol, ikon) — dipakai keduanya
css/landing.css     gaya landing page
css/dashboard.css   gaya dashboard + frame ponsel
js/icons.js         ikon Lucide disematkan inline (tanpa CDN, bisa offline)
js/landing.js       navbar, menu mobile, fade-in saat scroll
js/dashboard.js     state aplikasi + interaksi (nanti diganti data MQTT)
js/model-viewer.js  penampil model 3D casing (Three.js): scene, lighting, OrbitControls, load GLB
js/trash-demo.js    animasi demo sampah jatuh & tersortir (hanya di viewer hero)
models/             smart-bin-casing-v2.glb
```

> Section "Desain Produk" memuat file GLB lewat `fetch`, jadi **harus dibuka lewat http://**
> (server lokal di atas), bukan double-click `index.html` (file://) — browser memblokirnya.

Tuning animasi hero: buka `index.html?demo_t=1.4&demo_i=1` untuk membekukan siklus di detik
ke-1,4 pada objek ke-1 (0 botol, 1 kulit pisang, 2 kardus), atau dari console:
`d = smartBinViewers.hero.state.demo; d.pause(true); d.seek(2.4, 2)`. Durasi tiap fase ada di
objek `T` di `js/trash-demo.js`.

## Keputusan desain (untuk dijelaskan ke dosen)

**Warna.** Hijau (`#16a34a`) sebagai warna primer karena identitas *eco / pengelolaan sampah*;
biru (`#2563eb`) sebagai aksen untuk hal yang berbau teknologi/IoT (ESP32, MQTT, dashboard);
abu-abu netral untuk latar dan teks supaya konten tidak "ramai".

**Warna status = warna LED di alat.** Hijau = normal, kuning = hampir penuh, merah = penuh.
Ring gauge di dashboard memakai warna yang sama dengan LED fisik, jadi pengguna tidak perlu
belajar dua sistem warna. Sementara **jenis sampah** dibedakan lewat ikon + warna kategori
(daun hijau = organik, kotak biru = anorganik) — dipakai konsisten di ilustrasi hero, chart,
dan riwayat.

**Ambang batas (threshold) satu sumber.** Slider di halaman Kontrol mengubah status gauge,
banner peringatan, dan legenda LED sekaligus — meniru perilaku firmware yang memakai satu
nilai threshold.

**Satu servo, platform tilting.** Pemilahan memakai satu servo yang memiringkan platform
ke kiri (organik) atau kanan (anorganik). Di dashboard ini tampil sebagai dua tombol arah +
indikator posisi platform, bukan dua flap terpisah.

**Deteksi dua tahap.** Sensor IR hanya *pemicu* (ada sampah masuk); jenis sampah ditentukan
sensor kelembaban (lembab = organik, kering = anorganik). Teks di kartu deteksi dan riwayat
menampilkan nilai kelembabannya.

**Manual Override mengunci tombol platform.** Tombol "Miringkan ke…" hanya aktif saat mode
manual, supaya tidak ada perintah servo yang bertabrakan dengan pemilahan otomatis. Ini pola
*safety interlock* yang umum di sistem kontrol.

**Counter total & pesan apresiasi.** Alat menghitung total sampah organik/anorganik dan
menampilkan "Terima kasih…" di LCD setiap sortir berhasil. Dashboard meniru keduanya: badge
total di bawah gauge dan toast hijau sesaat setelah kartu "Deteksi terakhir" diperbarui
(di mockup dipicu tombol "Simulasi deteksi"; nanti dipicu pesan MQTT).

**Card-based + bottom navigation.** Pola yang familiar dari aplikasi smart-home, sehingga
mudah dipakai tanpa panduan; 4 tab = 4 kebutuhan utama (pantau, kendalikan, lihat riwayat,
atur).

**Aksi destruktif dikonfirmasi.** Reset riwayat memunculkan bottom sheet konfirmasi dan
tombolnya berwarna merah "lembut", bukan tombol utama.

## Menghindari cache lama saat mengubah CSS/JS/model

GitHub Pages menyuruh browser menyimpan aset selama 10 menit (`max-age=600`), sehingga setelah
push, halaman bisa memakai HTML baru dengan JS lama. Karena itu alamat aset diberi penanda versi
(`?v=20260923g`). **Setiap kali mengubah CSS, JS, atau file model, naikkan penandanya** di:

- `index.html` dan `dashboard.html` (tag `<link>`, `<script>`, dan `import`)
- `js/model-viewer.js` (konstanta `ASSET_VERSION`)

Cara cepat mengganti semuanya sekaligus (ganti tanggalnya):

```bash
grep -rl "v=20260923g" index.html dashboard.html js/ | xargs sed -i '' 's/v=20260923g/v=20260923g/g'
```

## Kredit foto

Semua foto berlisensi bebas (Creative Commons). Wajib mencantumkan atribusi di bawah ini bila
halaman dipublikasikan.

| File | Judul / pembuat | Lisensi | Sumber |
|---|---|---|---|
| `img/masalah.jpg` | "Rubbish", oatsy40 | CC BY 2.0 | https://www.flickr.com/photos/68089229@N06/7631270960 |
| `img/roadmap.jpg` | "Color-coded recycling bins", Eric Fischer | CC BY 2.0 | https://www.flickr.com/photos/24431382@N03/17820971264 |
| `img/komponen/esp32.jpg` | "ESP32 Dev Board", Edwiyanto (dipotong) | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:ESP32_Dev_Board.jpg |
| `img/komponen/sensor-ir.jpg` | "2 infrared sensors, arduino nano, breadboard", WILLPOWER STUDIOS (dipotong) | CC BY 2.0 | https://www.flickr.com/ (lihat `anti-slop/credits.json`) |
| `img/komponen/sensor-kelembaban.jpg` | "Soil Moisture Sensor Detection Module", tvluke_ | CC0 | https://www.flickr.com/ (lihat `anti-slop/credits.json`) |
| `img/komponen/hc-sr04.jpg` | "HC SR04 Ultrasonic sensor", Nevit Dilmen (dipotong) | CC BY-SA 3.0 | https://commons.wikimedia.org/ |
| `img/komponen/servo-sg90.jpg` | "Tower Pro SG90 micro servo motor", Suyash Dwivedi (dipotong) | CC BY-SA 4.0 | https://commons.wikimedia.org/ |
| `img/komponen/lcd-16x2.jpg` | "MELT 16x2 LCD alphanumeric display", Retired electrician (dipotong) | CC0 | https://commons.wikimedia.org/ |
| `img/komponen/led.jpg` | "LEDs", Afrank99 (dipotong) | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:LEDs.jpg |

Tautan sumber lengkap per foto ada di `anti-slop/credits.json`.

## Yang perlu diganti

- Tautan repositori GitHub, simulasi Wokwi, dan email di footer `index.html` sengaja dilepas dan berlabel "segera tersedia"; isi URL aslinya lalu ubah kembali jadi `<a>`.
- Data di `js/dashboard.js` (`state`, `WEEK_DEFAULT`, `ACTIVITY_DEFAULT`) — nanti diisi
  dari topik MQTT `smartbin/01/#`.
