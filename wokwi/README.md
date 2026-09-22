# Wokwi — Smart Bin (ESP32)

Ada dua cara menjalankan; pilih salah satu.

## A. Ekstensi Wokwi di VS Code (yang kamu pakai)

Ekstensi ini tidak mengompilasi kode, jadi firmware harus dibuat dulu dengan arduino-cli:

```bash
cd wokwi && ./build.sh
```

Hasilnya `wokwi/build/smartbin.ino.bin` + `.elf`. Ekstensi membacanya lewat `wokwi.toml` dan
`diagram.json` yang ada di **root proyek** (`smartbinuiux/`), karena ekstensi hanya mencari di
folder yang dibuka di VS Code. Lalu:

1. Buka folder `smartbinuiux` di VS Code (bukan subfolder).
2. `F1` → **Wokwi: Start Simulator**.
3. Setiap mengubah `smartbin/smartbin.ino`, jalankan `./build.sh` lagi lalu restart simulator.

Prasyarat sekali saja (sudah terpasang di mesin ini): `arduino-cli`, core `esp32:esp32`,
library `PubSubClient`, `LiquidCrystal I2C`, `ESP32Servo`
(`arduino-cli lib install "PubSubClient" "LiquidCrystal I2C" "ESP32Servo"`).

## B. wokwi.com (browser)

New Project → ESP32, lalu tempel:

| File | Ke mana |
|---|---|
| `smartbin/smartbin.ino` | tab `sketch.ino` |
| `../diagram.json` (di root proyek) | tab `diagram.json` (ganti seluruh isinya) |
| `libraries.txt` | tab `libraries.txt` (buat lewat ikon "+" jika belum ada) |

## Pengganti modul yang tidak ada di Wokwi

| Modul asli | Di Wokwi | Catatan |
|---|---|---|
| Sensor IR obstacle | Sensor PIR (`wokwi-pir-motion-sensor`) | klik sensornya untuk "ada sampah masuk". Modul IR asli biasanya aktif LOW → set `IR_ACTIVE_LOW true` |
| Sensor kelembaban tanah | Potensiometer (`wokwi-potentiometer`) di GPIO34 | putar ke kanan = lembab (organik), kiri = kering (anorganik). Modul YL-69 asli nilainya terbalik → set `MOIST_INVERTED true` |

## Pin

| Fungsi | GPIO |
|---|---|
| Sensor IR (PIR) | 14 |
| Sensor kelembaban (ADC) | 34 |
| HC-SR04 organik TRIG / ECHO | 5 / 18 |
| HC-SR04 anorganik TRIG / ECHO | 19 / 23 |
| Servo platform | 13 |
| LCD 16x2 I2C SDA / SCL | 21 / 22 (alamat 0x27) |
| LED hijau / kuning / merah | 25 / 26 / 27 (resistor 220 Ω) |

Di hardware asli, pin ECHO HC-SR04 mengeluarkan 5 V; ESP32 hanya toleran 3,3 V, jadi pakai
pembagi tegangan (1 kΩ + 2 kΩ) atau modul 3,3 V. Di Wokwi tidak perlu.

## Cara menguji

1. Jalankan simulasi. LCD menampilkan `ORG:xx% ANO:xx%`.
2. Geser jarak HC-SR04 (klik sensornya) untuk mengubah level; LED berubah hijau → kuning → merah
   pada 60% / 80% (ambang bisa diubah dari MQTT).
3. Putar potensiometer, lalu klik sensor PIR: LCD "Mendeteksi jenis" (2,5 detik) → servo miring
   kiri (organik) / kanan (anorganik) → kembali → "Terima kasih! Sampah terpilah".
4. WiFi Wokwi (`Wokwi-GUEST`) tersambung ke internet, jadi MQTT ke `broker.hivemq.com` benar-benar
   jalan. Pantau dengan MQTT client apa pun (mis. MQTT Explorer) di topik `smartbin/01/#`:
   - `smartbin/01/state` (retained, tiap 5 detik): level, counter, threshold, mode
   - `smartbin/01/event`: tiap sampah terdeteksi (`type`, `moisture`)
   - kirim ke `smartbin/01/cmd`: `mode manual`, `tilt organik`, `tilt anorganik`, `threshold 85`,
     `mode auto`, `reset` (persis tombol-tombol di dashboard)
