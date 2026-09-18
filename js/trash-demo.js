/* =====================================================================
   Smart Bin — TAHAP 2: animasi demo sampah jatuh & tersortir
   ---------------------------------------------------------------------
   Loop otomatis: botol plastik → kulit pisang → kardus → ulang.
     1. objek turun dari atas frame ke mulut lubang (mendarat di platform)
     2. BERHENTI diam ±2,5 detik: sensor IR mendeteksi, kelembaban dibaca, label jenis muncul
     3. platform (node tilt_platform_pivot dari GLB) miring: kiri = organik, kanan = anorganik;
        objek ikut meluncur ke sisi itu sambil mengecil (masuk kompartemen)
     4. versi "hantu" objek muncul sesaat di dalam kompartemen tujuan (tembus dinding casing)
     5. jeda ±1,8 detik, lanjut objek berikutnya
   Tanpa physics — semua berbasis waktu (t) dalam satu siklus, jadi deterministik & ringan.
   Dipakai oleh model-viewer.js:  demo = createTrashDemo(scene, parts, { topY });  demo.update(dt)
   ===================================================================== */
import * as THREE from 'three';

const COLOR = { organik: '#16a34a', anorganik: '#2563eb' };
const TILT_DEG = 22;

// ---------- Timeline satu siklus (detik) ----------
const T = {
  fall: 0.8,         // turun dari atas frame ke mulut lubang (fade-in di awal)
  hold: 2.5,         // BERHENTI diam di tengah: sensor mendeteksi & menentukan jenis
  tiltDur: 0.4,      // platform miring
  slide: 0.55,       // objek meluncur mengikuti kemiringan lalu mengecil (masuk kompartemen)
  tiltHold: 0.5,
  tiltBack: 0.45,
  ghostFade: 0.25,   // objek kecil muncul di kompartemen
  ghostHold: 0.9,
  ghostOut: 0.35,
  gap: 1.8,          // jeda sebelum objek berikutnya
};
// Waktu mulai tiap fase (dihitung sekali, supaya mengubah satu durasi menggeser sisanya)
T.holdStart  = T.fall;
T.tiltStart  = T.fall + T.hold;                // platform mulai miring setelah masa berhenti
T.slideStart = T.tiltStart + 0.12;             // objek mulai meluncur begitu platform mulai miring
T.slideEnd   = T.slideStart + T.slide;
T.ghostIn    = T.slideEnd + 0.35;              // jeda singkat setelah objek masuk
T.cycle      = T.ghostIn + T.ghostFade + T.ghostHold + T.ghostOut + T.gap;

// ---------- Easing ----------
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, p) => a + (b - a) * p;
const easeInQuad = (p) => p * p;
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const easeInOutQuad = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const easeOutBack = (p) => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const smooth = (a, b, t) => { const p = clamp01((t - a) / (b - a)); return p * p * (3 - 2 * p); };

// ---------- Objek sampah (geometri dasar) ----------
function makeBottle() {
  const g = new THREE.Group();
  const plastic = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.72, roughness: 0.15, metalness: 0 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.062, 18), plastic);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.009, 0.014, 14), plastic);
  neck.position.y = 0.038;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.007, 14),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 }));
  cap.position.y = 0.0485;
  g.add(body, neck, cap);
  return { group: g, type: 'anorganik', name: 'Botol plastik' };
}
function makeBananaPeel() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.65 });
  // Setengah torus = lengkungan kulit pisang; tiga "helai" dengan sudut berbeda
  for (let i = 0; i < 3; i++) {
    const peel = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0055, 8, 22, Math.PI), yellow);
    peel.rotation.set(Math.PI, 0, 0);
    peel.rotation.y = (i - 1) * 0.55;
    g.add(peel);
  }
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.014, 8),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 }));
  tip.position.set(0.022, 0.004, 0);
  tip.rotation.z = -0.5;
  g.add(tip);
  return { group: g, type: 'organik', name: 'Kulit pisang' };
}
function makeCardboard() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.006, 0.042),
    new THREE.MeshStandardMaterial({ color: 0xd6b48c, roughness: 0.95 }));
  const tape = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.0065, 0.043),
    new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.9 }));
  g.add(box, tape);
  return { group: g, type: 'anorganik', name: 'Kardus' };
}

// Siapkan material untuk fade: simpan opacity dasar, set transparent
function prepFade(obj, { xray = false } = {}) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.transparent = true;
    o.material.userData.baseOpacity = o.material.opacity;
    o.castShadow = !xray;
    if (xray) { o.material.depthTest = false; o.material.depthWrite = false; o.renderOrder = 10; }
  });
}
function setAlpha(obj, a) {
  obj.traverse((o) => { if (o.isMesh) o.material.opacity = o.material.userData.baseOpacity * a; });
}

// Label mengambang (sprite dari canvas) — "Organik" / "Anorganik"
function makeLabel(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(8, 16, 240, 64, 32); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 34px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 49);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, opacity: 0 }));
  sp.scale.set(0.105, 0.0394, 1);
  sp.renderOrder = 20;
  sp.visible = false;
  return sp;
}

export function createTrashDemo(scene, parts, { topY }) {
  const worldPos = (o) => (o ? o.getWorldPosition(new THREE.Vector3()) : null);

  // ---------- Titik-titik acuan dari GLB ----------
  const pivot = parts.tilt_platform_pivot || null;
  const platformPos = worldPos(pivot) || new THREE.Vector3(0, topY * 0.85, 0);
  const slotPos = worldPos(parts.ir_sensor_slot) || platformPos;
  // lubang masuk berada di antara pusat platform dan slot sensor IR (bagian belakang atap)
  const drop = new THREE.Vector3(platformPos.x, 0, lerp(platformPos.z, slotPos.z, 0.35));
  const spawnY = topY + 0.13;   // titik awal turun (di atas atap, masih di dalam frame hero)
  const restY  = topY + 0.03;   // titik berhenti: di mulut lubang, seolah mendarat di platform
  const exitY  = platformPos.y - 0.03; // titik akhir meluncur (sudah di bawah atap)
  const trays = {
    organik: worldPos(parts.drawer_organic_tray) || new THREE.Vector3(-0.073, 0, 0),
    anorganik: worldPos(parts.drawer_anorganic_tray) || new THREE.Vector3(0.073, 0, 0),
  };
  const pivotBaseZ = pivot ? pivot.rotation.z : 0;

  // ---------- Objek + hantu + label ----------
  const items = [makeBottle(), makeBananaPeel(), makeCardboard()].map((it) => {
    prepFade(it.group);
    it.group.visible = false;
    scene.add(it.group);

    it.ghost = it.group.clone(true);
    prepFade(it.ghost, { xray: true });
    it.ghost.visible = false;
    scene.add(it.ghost);

    it.label = makeLabel(it.type === 'organik' ? 'Organik' : 'Anorganik', COLOR[it.type]);
    scene.add(it.label);
    return it;
  });

  let t = 0;
  let idx = 0;
  let paused = false;
  const labelOffset = new THREE.Vector3(0.07, 0.03, 0.02);

  function hideAll() {
    items.forEach((it) => { it.group.visible = false; it.ghost.visible = false; it.label.visible = false; });
    if (pivot) pivot.rotation.z = pivotBaseZ;
  }

  function update(dt) {
    if (!paused) t += dt;
    if (t >= T.cycle) { t -= T.cycle; idx = (idx + 1) % items.length; hideAll(); }
    const it = items[idx];
    const isOrg = it.type === 'organik';

    // 1) Objek turun dari atas, berhenti diam di mulut lubang, lalu meluncur mengikuti kemiringan
    const fallEnd = T.slideEnd;
    if (t < fallEnd) {
      it.group.visible = true;
      if (t < T.holdStart) {
        // turun: ease-out supaya melambat lalu "mendarat"; rotasi ikut melambat sampai berhenti total
        const p = clamp01(t / T.fall);
        it.group.position.set(drop.x, lerp(spawnY, restY, easeOutCubic(p)), drop.z);
        it.group.rotation.set(0, easeOutCubic(p) * 1.2, 0);
        it.group.scale.setScalar(1);
        setAlpha(it.group, smooth(0, 0.3, t));
      } else if (t < T.slideStart) {
        // berhenti: diam total (tanpa getar), hanya label yang muncul
        it.group.position.set(drop.x, restY, drop.z);
        it.group.rotation.set(0, 1.2, 0);
        it.group.scale.setScalar(1);
        setAlpha(it.group, 1);
      } else {
        // meluncur ke sisi kemiringan (kiri organik / kanan anorganik) sambil turun & mengecil
        const p = clamp01((t - T.slideStart) / T.slide);
        const side = isOrg ? -1 : 1;
        it.group.position.set(
          drop.x + side * 0.055 * easeInQuad(p),
          lerp(restY, exitY, easeInQuad(p)),
          drop.z
        );
        it.group.rotation.set(0, 1.2 + p * 0.8, side * -0.5 * p);
        it.group.scale.setScalar(Math.max(0.0001, 1 - smooth(0.55, 1, p)));
        setAlpha(it.group, 1);
      }
    } else {
      it.group.visible = false;
    }

    // 2) Platform miring (kiri = organik, kanan = anorganik), lalu kembali ke tengah
    if (pivot) {
      const target = THREE.MathUtils.degToRad(isOrg ? TILT_DEG : -TILT_DEG);
      const t1 = T.tiltStart, t2 = t1 + T.tiltDur, t3 = t2 + T.tiltHold, t4 = t3 + T.tiltBack;
      let a = 0;
      if (t >= t1 && t < t2) a = target * easeOutCubic((t - t1) / T.tiltDur);
      else if (t >= t2 && t < t3) a = target;
      else if (t >= t3 && t < t4) a = target * (1 - easeInOutQuad((t - t3) / T.tiltBack));
      pivot.rotation.z = pivotBaseZ + a;
    }

    // 3) Versi kecil objek muncul di dalam kompartemen tujuan
    const g0 = T.ghostIn, g1 = g0 + T.ghostFade, g2 = g1 + T.ghostHold, g3 = g2 + T.ghostOut;
    if (t >= g0 && t < g3) {
      const tray = trays[it.type];
      it.ghost.visible = true;
      // dekat panel depan laci supaya secara perspektif terlihat "di dalam" kompartemen yang benar
      it.ghost.position.set(tray.x * 1.05, tray.y + 0.06, tray.z + 0.085);
      it.ghost.rotation.set(0, t * 0.8, isOrg ? 0.2 : -0.2);
      const pop = t < g1 ? easeOutBack(clamp01((t - g0) / T.ghostFade)) : 1;
      it.ghost.scale.setScalar(0.75 * lerp(0.5, 1, pop));
      const alpha = t < g1 ? clamp01((t - g0) / T.ghostFade) : t < g2 ? 1 : 1 - clamp01((t - g2) / T.ghostOut);
      setAlpha(it.ghost, 0.9 * alpha);
    } else {
      it.ghost.visible = false;
    }

    // 4) Label jenis sampah: muncul saat objek berhenti (setelah "deteksi"), memudar saat meluncur,
    //    lalu muncul lagi di dekat kompartemen tujuan
    let la = 0;
    if (t < fallEnd) {
      const labelIn = T.holdStart + T.hold * 0.4; // jenis "diketahui" setelah ±40% masa berhenti
      la = smooth(labelIn, labelIn + 0.3, t) * (1 - smooth(T.slideStart, T.slideStart + 0.25, t));
      it.label.position.set(drop.x, restY, drop.z).add(labelOffset);
    } else if (t >= g0 && t < g3) {
      la = smooth(g0, g1, t) * (1 - smooth(g2, g3, t));
      const tray = trays[it.type];
      it.label.position.set(tray.x * 1.15, tray.y + 0.165, tray.z + 0.15); // di atas panel laci, depan casing
    }
    it.label.visible = la > 0.01;
    it.label.material.opacity = la;
  }

  // true selama objek diam di tengah (dipakai viewer untuk menjeda putaran kamera)
  function isHolding() { return t >= T.holdStart && t < T.slideStart; }

  // Alat bantu tuning dari console:  d = smartBinViewers.hero.state.demo;  d.pause(true); d.seek(1.4)
  function seek(time, itemIndex = idx) { idx = itemIndex % items.length; hideAll(); t = Math.max(0, time); update(0); }
  function pause(v = true) { paused = v; }
  // ?demo_t=1.5&demo_i=1 di URL → beku di detik ke-1.5 pada objek ke-1 (untuk screenshot / tuning)
  const q = new URLSearchParams(location.search);
  if (q.has('demo_t')) { seek(parseFloat(q.get('demo_t')) || 0, parseInt(q.get('demo_i') || '0', 10)); pause(true); }

  return { update, seek, pause, isHolding, items, T };
}
