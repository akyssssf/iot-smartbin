/* =====================================================================
   Smart Bin — Penampil model 3D casing (Three.js)
   ---------------------------------------------------------------------
   TAHAP 1 (sekarang): scene dasar, lighting, OrbitControls, load GLB,
                       auto-center + auto-fit kamera, responsive.
   TAHAP 2 (nanti)   : animasi sampah jatuh → platform miring → masuk
                       kompartemen. Titik sambungnya ditandai "TAHAP 2".
   Dipanggil dari index.html:  initModelViewer(container, opts)
     opts.name              : nama instance ('main' = section Desain Produk, 'hero')
     opts.enableZoom        : scroll/cubit untuk zoom (default true)
     opts.resumeAutoRotate  : lanjut berputar lagi setelah pengunjung melepas drag
     opts.fit               : faktor jarak kamera (<1 lebih dekat), default 0.92
     opts.targetY           : titik pandang vertikal (0..1 dari tinggi model), default 0.48; lebih besar = model turun di frame
     opts.azimuth/elevation : sudut kamera awal (derajat), default dari VIEW
     opts.demo              : true → jalankan animasi sampah jatuh & sortir (Tahap 2, hanya di hero)
     opts.pauseRotateOnHold : true (default) → putaran kamera berhenti halus saat objek diam di tengah
     opts.mouseParallax     : true → seluruh scene menoleh halus mengikuti posisi kursor (hanya mouse)
   ===================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createTrashDemo } from './trash-demo.js';

const MODEL_URL = 'models/model-v3.glb';
const HIDDEN_NODES = ['brand_label']; // node GLB yang tidak ditampilkan

// Penanda kategori: hanya pintu + gagang laci anorganik yang diwarnai biru (samakan dengan situs).
// Di model v3 material coral dipakai ulang untuk gagang tutup atas, jadi pencocokan per nama node,
// bukan per material; gagang tutup dinetralkan agar palet tetap hijau + biru + netral.
const ANORGANIC_NODES = ['panel_anorganic', 'drawer_anorganic_handle_bar',
  'drawer_anorganic_handle_leg_1', 'drawer_anorganic_handle_leg_2'];
const COLOR_ANORGANIC = '#2563eb';
const COLOR_NEUTRAL_HANDLE = '#6b7280';

// Sudut kamera awal (derajat). Model menghadap +Z: panel LCD/LED & pegangan laci
// di depan, laci organik di kiri (−X), anorganik di kanan (+X), lubang masuk di
// atas-belakang. Dari depan-kiri agak tinggi, semuanya terlihat sekaligus.
const VIEW = { azimuth: -32, elevation: 34, fov: 34 };

export function initModelViewer(container, opts = {}) {
  if (!container) return null;
  const view = { ...VIEW, azimuth: opts.azimuth ?? VIEW.azimuth, elevation: opts.elevation ?? VIEW.elevation };
  const fitFactor = opts.fit ?? 0.92;
  const canvasWrap = container.querySelector('.mv-canvas');
  const statusEl   = container.querySelector('.mv-status');
  const resetBtn   = container.querySelector('.mv-reset');

  // ---------- Renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasWrap.appendChild(renderer.domElement);

  // ---------- Scene & kamera ----------
  const scene = new THREE.Scene(); // background dibiarkan transparan → menyatu dengan section
  const camera = new THREE.PerspectiveCamera(view.fov, 1, 0.01, 100);
  // Semua yang "ada di dunia" (model, lantai bayangan, objek demo) masuk grup ini,
  // supaya parallax mouse memutar semuanya bersama-sama dan animasi tetap sejajar dengan lubang.
  const world = new THREE.Group();
  scene.add(world);

  // ---------- Lighting: ambient + hemisphere (isi bayangan) + directional (key) + fill ----------
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9e2ec, 0.6));

  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(0.35, 2.8, -0.9); // dari atas-belakang: bayangan jatuh ke depan-bawah (area yang memudar), bukan ke samping
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.01;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 1.1);
  fill.position.set(1.2, 1.0, 1.8); // dari depan: panel LCD/laci tetap terang
  scene.add(fill);

  // Lantai penangkap bayangan (tidak terlihat, hanya bayangannya)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.ShadowMaterial({ opacity: 0.16 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  world.add(floor);

  // ---------- Controls ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = opts.enableZoom ?? true;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(88); // jangan sampai kamera di bawah lantai
  controls.autoRotate = true;                             // berputar pelan sampai pengunjung menyentuhnya
  controls.autoRotateSpeed = 0.8;
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  if (opts.resumeAutoRotate) {
    let resumeTimer;
    controls.addEventListener('end', () => {
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { controls.autoRotate = true; }, 2500);
    });
  }

  // ---------- State yang dipakai TAHAP 2 ----------
  const state = {
    model: null,       // THREE.Group hasil load GLB
    parts: {},         // node penting dari GLB (lihat daftar di bawah)
    radius: 1,         // jari-jari bounding sphere model (untuk skala animasi)
    homeView: null,    // posisi kamera awal untuk tombol "Reset tampilan"
  };
  const clock = new THREE.Clock();
  let demo = null; // TAHAP 2: dibuat setelah model termuat (lihat trash-demo.js)

  // ---------- Load model GLB ----------
  setStatus('loading', 'Memuat model 3D…');
  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      const model = gltf.scene;
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        if (o.material?.name !== 'mat_anorganic_coral') return;
        o.material = o.material.clone();
        o.material.color.set(ANORGANIC_NODES.includes(o.name) ? COLOR_ANORGANIC : COLOR_NEUTRAL_HANDLE);
      });
      // Sembunyikan label "SMART BIN" di panel depan (permintaan pemilik); node lain tetap
      HIDDEN_NODES.forEach((n) => { const o = model.getObjectByName(n); if (o) o.visible = false; });

      // Center model di origin (x/z), letakkan dasarnya di y = 0 (di atas lantai bayangan)
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      model.position.set(-center.x, -box.min.y, -center.z);
      world.add(model);

      // Kamera: jarak dihitung dari bounding sphere supaya model selalu pas di frame
      const radius = size.length() / 2;
      const target = new THREE.Vector3(0, size.y * (opts.targetY ?? 0.48), 0);
      const dist = (radius / Math.sin(THREE.MathUtils.degToRad(view.fov) / 2)) * fitFactor; // <1 = sedikit lebih dekat dari bounding sphere
      const az = THREE.MathUtils.degToRad(view.azimuth);
      const el = THREE.MathUtils.degToRad(view.elevation);
      camera.position.set(
        target.x + dist * Math.cos(el) * Math.sin(az),
        target.y + dist * Math.sin(el),
        target.z + dist * Math.cos(el) * Math.cos(az)
      );
      camera.near = radius / 50; camera.far = radius * 50;
      camera.updateProjectionMatrix();
      controls.target.copy(target);
      controls.minDistance = radius * 1.0;
      controls.maxDistance = radius * 5;
      controls.update();

      // Node-node penting dari GLB — TAHAP 2 akan memakai ini:
      //   tilt_platform_pivot : putar rotation.z ± ~20° → platform miring kiri (organik) / kanan (anorganik)
      //   ir_sensor_slot      : posisi lubang masuk → titik awal jatuhnya objek sampah
      //   drawer_organic_tray / drawer_anorganic_tray : tujuan akhir objek sampah
      //   led_green / led_yellow / led_red : bisa di-"nyalakan" dengan mengganti material.emissive
      //   lcd_cutout          : tempat menempelkan tekstur teks LCD (opsional)
      const names = ['tilt_platform_pivot', 'tilt_platform', 'ir_sensor_slot', 'roof_lid',
        'drawer_organic_tray', 'drawer_anorganic_tray', 'servo_shaft',
        'led_green', 'led_yellow', 'led_red', 'lcd_cutout'];
      names.forEach((n) => { state.parts[n] = model.getObjectByName(n) || null; });

      state.model = model;
      state.radius = radius;
      state.homeView = { position: camera.position.clone(), target: target.clone() };
      setStatus('ready');

      // TAHAP 2: animasi demo (hanya jika opts.demo). Posisi lubang/platform/laci diambil dari node GLB.
      if (opts.demo) {
        world.updateMatrixWorld(true);
        demo = createTrashDemo(world, state.parts, { topY: size.y });
        state.demo = demo; // bisa diintip dari console: smartBinViewers.hero.state.demo
      }
    },
    undefined,
    (err) => {
      console.error('Gagal memuat model:', err);
      const isFile = location.protocol === 'file:';
      setStatus('error', isFile
        ? 'Model tidak bisa dimuat lewat file://. Jalankan lewat server lokal (mis. python3 -m http.server) lalu buka http://localhost.'
        : 'Model 3D gagal dimuat. Periksa path ' + MODEL_URL + '.');
    }
  );

  // ---------- Reset tampilan ----------
  resetBtn?.addEventListener('click', () => {
    if (!state.homeView) return;
    camera.position.copy(state.homeView.position);
    controls.target.copy(state.homeView.target);
    controls.autoRotate = true;
    controls.update();
  });

  // ---------- Responsive: ikuti ukuran container ----------
  function resize() {
    const w = canvasWrap.clientWidth;
    const h = canvasWrap.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  new ResizeObserver(resize).observe(canvasWrap);
  resize();

  // ---------- Render loop (berhenti saat section tidak terlihat, hemat baterai) ----------
  let visible = true;
  let rafId = 0;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !rafId) loop();
  }, { threshold: 0.05 }).observe(container);

  function loop() {
    if (!visible) { rafId = 0; return; }
    rafId = requestAnimationFrame(loop);
    const dt = clock.getDelta();
    update(dt);
    controls.update();
    renderer.render(scene, camera);
  }

  // =====================================================================
  // TAHAP 2 — ANIMASI SAMPAH JATUH & SORTIR (implementasi di js/trash-demo.js)
  // Dipanggil setiap frame; dt dibatasi 50 ms supaya tidak "lompat" setelah tab tidak aktif.
  // =====================================================================
  // ---------- Parallax mouse: scene menoleh ±8° mengikuti kursor, diredam (tanpa efek di layar sentuh) ----------
  const parallax = { x: 0, y: 0 };
  if (opts.mouseParallax && matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      parallax.x = (e.clientX / window.innerWidth - 0.5) * 2;   // -1 .. 1
      parallax.y = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  const baseRotateSpeed = controls.autoRotateSpeed;
  function update(dt) {
    dt = Math.min(dt, 0.05);
    if (opts.mouseParallax) {
      const k = Math.min(1, dt * 3);
      world.rotation.y += (parallax.x * 0.14 - world.rotation.y) * k;
      world.rotation.x += (parallax.y * 0.05 - world.rotation.x) * k;
    }
    if (!demo) return;
    demo.update(dt);
    // Saat objek diam di tengah, putaran kamera direm halus sampai berhenti, lalu lanjut lagi
    if (opts.pauseRotateOnHold !== false) {
      const target = demo.isHolding() ? 0 : baseRotateSpeed;
      controls.autoRotateSpeed += (target - controls.autoRotateSpeed) * Math.min(1, dt * 3);
    }
  }

  function setStatus(kind, text = '') {
    if (!statusEl) return;
    statusEl.dataset.state = kind;
    statusEl.textContent = text;
    container.classList.toggle('is-ready', kind === 'ready');
  }

  loop();

  // Diekspos untuk debugging di console & pengembangan Tahap 2
  // window.smartBinViewer = instance 'main' (section Desain Produk); semua instance di window.smartBinViewers
  const api = { name: opts.name || 'viewer', scene, camera, controls, renderer, state };
  window.smartBinViewers = window.smartBinViewers || {};
  window.smartBinViewers[api.name] = api;
  if (api.name === 'main' || !window.smartBinViewer) window.smartBinViewer = api;
  return api;
}
