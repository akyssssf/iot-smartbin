#!/usr/bin/env bash
# Kompilasi firmware Smart Bin untuk ESP32 → wokwi/build/ (dipakai wokwi.toml)
set -e
cd "$(dirname "$0")"
arduino-cli compile --fqbn esp32:esp32:esp32 --output-dir build smartbin
echo "Selesai: build/smartbin.ino.bin dan build/smartbin.ino.elf"
