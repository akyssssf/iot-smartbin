/*
  Smart Bin — firmware ESP32 (Wokwi)
  ------------------------------------------------------------------
  Alur kerja (sama dengan landing page & dashboard):
    1. Sensor IR (di Wokwi: PIR) mendeteksi ada sampah masuk        → state DETECTING
    2. Sensor kelembaban (di Wokwi: potensiometer) menentukan jenis:
       lembab = organik, kering = anorganik                          → LCD "Mendeteksi..."
    3. Satu servo memiringkan platform: kiri = organik, kanan = anorganik
    4. Platform kembali ke tengah, counter bertambah, LCD "Terima kasih..."
    5. 2x HC-SR04 memantau level tiap kompartemen; LED hijau/kuning/merah
    6. Data dikirim ke dashboard lewat WiFi + MQTT (topik smartbin/01/#)

  Library (Wokwi: lihat libraries.txt): PubSubClient, LiquidCrystal I2C, ESP32Servo
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>

// ====================== PIN ======================
#define PIN_IR          14   // sensor IR / PIR (digital)
#define PIN_MOIST       34   // sensor kelembaban / potensiometer (ADC1, input-only)
#define PIN_US1_TRIG     5   // HC-SR04 kompartemen ORGANIK
#define PIN_US1_ECHO    18
#define PIN_US2_TRIG    19   // HC-SR04 kompartemen ANORGANIK
#define PIN_US2_ECHO    23
#define PIN_SERVO       13   // servo platform tilting
#define PIN_LED_GREEN   25
#define PIN_LED_YELLOW  26
#define PIN_LED_RED     27
// LCD I2C: SDA 21, SCL 22 (bawaan ESP32)

// ====================== KONFIGURASI ======================
#define IR_ACTIVE_LOW   false   // modul IR obstacle asli biasanya LOW saat ada objek → true. PIR Wokwi: false
#define MOIST_INVERTED  false   // modul YL-69 asli: nilai ADC besar = kering → true. Potensiometer Wokwi: false
const int   MOIST_THRESHOLD_PCT = 50;   // >= 50% lembab → organik
const float BIN_HEIGHT_CM       = 30.0; // tinggi kompartemen (jarak sensor ke dasar saat kosong)
int   fullThreshold             = 80;   // % dianggap "penuh" (bisa diubah dari dashboard via MQTT)
const int SERVO_CENTER = 90, SERVO_LEFT = 50, SERVO_RIGHT = 130;  // derajat platform

// Durasi tiap fase (ms), disamakan dengan animasi di landing page
const unsigned long T_DETECT  = 2500;   // berhenti dulu: "sensor sedang mendeteksi"
const unsigned long T_TILT    = 1500;   // platform miring, sampah meluncur
const unsigned long T_THANKS  = 2500;   // pesan terima kasih di LCD
const unsigned long T_LEVEL   = 2000;   // interval baca ultrasonik
const unsigned long T_PUBLISH = 5000;   // interval kirim status ke MQTT

// WiFi & MQTT (Wokwi: SSID "Wokwi-GUEST" tanpa password)
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASS = "";
const char* MQTT_HOST = "broker.hivemq.com";
const int   MQTT_PORT = 1883;
const char* DEVICE_ID = "smartbin/01";

// ====================== OBJEK ======================
WiFiClient        wifiClient;
PubSubClient      mqtt(wifiClient);
LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo             platform;

// ====================== STATE ======================
enum Mode  { AUTO, MANUAL };
enum Phase { IDLE, DETECTING, TILTING, RETURNING, THANKS };
enum Kind  { ORGANIK, ANORGANIK };

Mode  mode  = AUTO;
Phase phase = IDLE;
Kind  lastKind = ORGANIK;
int   lastMoisture = 0;
unsigned long phaseStart = 0, lastLevelRead = 0, lastPublish = 0;
unsigned long totalOrganik = 0, totalAnorganik = 0;
int   levelOrganik = 0, levelAnorganik = 0;
bool  irPrev = false;

// ====================== SENSOR ======================
bool irDetected() {
  bool raw = digitalRead(PIN_IR);
  return IR_ACTIVE_LOW ? !raw : raw;
}

int readMoisturePct() {                 // rata-rata 8 sampel → 0..100 %
  long sum = 0;
  for (int i = 0; i < 8; i++) { sum += analogRead(PIN_MOIST); delay(2); }
  int pct = map(sum / 8, 0, 4095, 0, 100);
  return MOIST_INVERTED ? 100 - pct : pct;
}

float readDistanceCm(int trig, int echo) {
  digitalWrite(trig, LOW);  delayMicroseconds(2);
  digitalWrite(trig, HIGH); delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long us = pulseIn(echo, HIGH, 30000);  // timeout 30 ms (~5 m)
  if (us == 0) return BIN_HEIGHT_CM;      // tidak ada pantulan → anggap kosong
  return us * 0.0343f / 2.0f;
}

int levelFromDistance(float d) {          // jarak ke permukaan sampah → % terisi
  float pct = (BIN_HEIGHT_CM - d) / BIN_HEIGHT_CM * 100.0f;
  return constrain((int)pct, 0, 100);
}

// ====================== LED & LCD ======================
void updateLeds() {
  int worst = max(levelOrganik, levelAnorganik);
  digitalWrite(PIN_LED_GREEN,  worst < fullThreshold - 20);
  digitalWrite(PIN_LED_YELLOW, worst >= fullThreshold - 20 && worst < fullThreshold);
  digitalWrite(PIN_LED_RED,    worst >= fullThreshold);
}

void lcdLines(const String& l1, const String& l2) {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(l1.substring(0, 16));
  lcd.setCursor(0, 1); lcd.print(l2.substring(0, 16));
}

void lcdIdle() {
  char l1[17]; snprintf(l1, sizeof(l1), "ORG:%3d%% ANO:%3d%%", levelOrganik, levelAnorganik);
  String l2 = (max(levelOrganik, levelAnorganik) >= fullThreshold) ? "KOMPARTEMEN PENUH"
            : (mode == MANUAL) ? "MODE: MANUAL" : "SIAP MEMILAH";
  lcdLines(l1, l2);
}

// ====================== MQTT ======================
String topic(const char* sub) { return String(DEVICE_ID) + "/" + sub; }

void publishState() {
  char buf[200];
  snprintf(buf, sizeof(buf),
    "{\"organik\":%d,\"anorganik\":%d,\"total_organik\":%lu,\"total_anorganik\":%lu,"
    "\"threshold\":%d,\"mode\":\"%s\",\"online\":true}",
    levelOrganik, levelAnorganik, totalOrganik, totalAnorganik,
    fullThreshold, mode == AUTO ? "auto" : "manual");
  mqtt.publish(topic("state").c_str(), buf, true);
}

void publishDetection(Kind k, int moisture) {
  char buf[120];
  snprintf(buf, sizeof(buf), "{\"type\":\"%s\",\"moisture\":%d}",
           k == ORGANIK ? "organik" : "anorganik", moisture);
  mqtt.publish(topic("event").c_str(), buf);
}

void startTilt(Kind k);  // deklarasi awal

// Perintah dari dashboard: topik smartbin/01/cmd
//   "mode auto" | "mode manual" | "tilt organik" | "tilt anorganik" | "threshold 80" | "reset"
void onMqttMessage(char* t, byte* payload, unsigned int len) {
  String msg; for (unsigned int i = 0; i < len; i++) msg += (char)payload[i];
  msg.trim();
  Serial.println("[MQTT] " + msg);
  if (msg == "mode auto")             { mode = AUTO;   lcdIdle(); }
  else if (msg == "mode manual")      { mode = MANUAL; lcdIdle(); }
  else if (msg.startsWith("threshold ")) { fullThreshold = constrain(msg.substring(10).toInt(), 50, 95); updateLeds(); lcdIdle(); }
  else if (msg == "reset")            { totalOrganik = totalAnorganik = 0; }
  else if (msg.startsWith("tilt ") && mode == MANUAL && phase == IDLE) {
    startTilt(msg.endsWith("organik") && !msg.endsWith("anorganik") ? ORGANIK : ANORGANIK);
  }
  publishState();
}

void ensureMqtt() {
  if (mqtt.connected()) return;
  if (mqtt.connect("smartbin-01-esp32")) {
    mqtt.subscribe(topic("cmd").c_str());
    publishState();
    Serial.println("MQTT terhubung");
  }
}

// ====================== FASE PEMILAHAN ======================
void startDetecting() {
  phase = DETECTING; phaseStart = millis();
  lcdLines("Sampah masuk...", "Mendeteksi jenis");
}

void startTilt(Kind k) {
  lastKind = k; phase = TILTING; phaseStart = millis();
  platform.write(k == ORGANIK ? SERVO_LEFT : SERVO_RIGHT);
  lcdLines(k == ORGANIK ? "Jenis: ORGANIK" : "Jenis: ANORGANIK",
           k == ORGANIK ? "Platform ke KIRI" : "Platform ke KANAN");
}

void runSorter() {
  unsigned long now = millis();
  switch (phase) {
    case IDLE:
      if (mode == AUTO) {
        bool ir = irDetected();
        if (ir && !irPrev) startDetecting();   // tepi naik: sampah baru masuk
        irPrev = ir;
      }
      break;

    case DETECTING:
      if (now - phaseStart >= T_DETECT) {
        lastMoisture = readMoisturePct();
        startTilt(lastMoisture >= MOIST_THRESHOLD_PCT ? ORGANIK : ANORGANIK);
        publishDetection(lastKind, lastMoisture);
      }
      break;

    case TILTING:
      if (now - phaseStart >= T_TILT) {
        platform.write(SERVO_CENTER);
        phase = RETURNING; phaseStart = now;
      }
      break;

    case RETURNING:
      if (now - phaseStart >= 500) {
        if (lastKind == ORGANIK) totalOrganik++; else totalAnorganik++;
        lcdLines("Terima kasih!", "Sampah terpilah");   // versi 16 kolom dari pesan LCD
        phase = THANKS; phaseStart = now;
        publishState();
      }
      break;

    case THANKS:
      if (now - phaseStart >= T_THANKS) { phase = IDLE; lcdIdle(); }
      break;
  }
}

// ====================== SETUP & LOOP ======================
void setup() {
  Serial.begin(115200);
  pinMode(PIN_IR, INPUT);
  pinMode(PIN_US1_TRIG, OUTPUT); pinMode(PIN_US1_ECHO, INPUT);
  pinMode(PIN_US2_TRIG, OUTPUT); pinMode(PIN_US2_ECHO, INPUT);
  pinMode(PIN_LED_GREEN, OUTPUT); pinMode(PIN_LED_YELLOW, OUTPUT); pinMode(PIN_LED_RED, OUTPUT);

  platform.setPeriodHertz(50);
  platform.attach(PIN_SERVO, 500, 2400);
  platform.write(SERVO_CENTER);

  lcd.init(); lcd.backlight();
  lcdLines("Smart Bin v0.3", "Menghubungkan...");

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 10000) { delay(250); Serial.print("."); }
  Serial.println(WiFi.status() == WL_CONNECTED ? "\nWiFi terhubung" : "\nWiFi gagal, lanjut offline");

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  ensureMqtt();

  levelOrganik   = levelFromDistance(readDistanceCm(PIN_US1_TRIG, PIN_US1_ECHO));
  levelAnorganik = levelFromDistance(readDistanceCm(PIN_US2_TRIG, PIN_US2_ECHO));
  updateLeds();
  lcdIdle();
}

void loop() {
  unsigned long now = millis();

  if (WiFi.status() == WL_CONNECTED) { ensureMqtt(); mqtt.loop(); }

  runSorter();

  if (now - lastLevelRead >= T_LEVEL) {           // pantau kapasitas
    lastLevelRead = now;
    levelOrganik   = levelFromDistance(readDistanceCm(PIN_US1_TRIG, PIN_US1_ECHO));
    levelAnorganik = levelFromDistance(readDistanceCm(PIN_US2_TRIG, PIN_US2_ECHO));
    updateLeds();
    if (phase == IDLE) lcdIdle();
  }

  if (now - lastPublish >= T_PUBLISH && mqtt.connected()) { lastPublish = now; publishState(); }
}
