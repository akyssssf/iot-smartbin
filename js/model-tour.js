/* =====================================================================
   Smart Bin — Tur berpandu model 3D (section "Desain Produk")
   ---------------------------------------------------------------------
   - Tombol Sebelumnya / Berikutnya memindahkan kamera ke bagian yang dibahas
   - Tombol "Jalankan simulasi" memutar satu siklus sampah jatuh & tersortir
   - Tombol layar penuh; di ponsel layar dikunci ke posisi horizontal bila
     browser mengizinkan (Android), kalau tidak diizinkan (iOS) muncul imbauan
   Isi langkah hanya menyebut bagian yang benar-benar ada di model GLB.
   ===================================================================== */

// fit: makin kecil makin dekat. targetY: 0..1 dari tinggi model (titik pandang).
const STEPS = [
  {
    title: 'Lubang masuk',
    text: 'Sampah dimasukkan lewat lubang di bagian atas. Sensor inframerah di tepi lubang mendeteksi ada benda masuk dan memicu proses pemilahan.',
    view: { azimuth: -18, elevation: 58, fit: 1.0, targetY: 0.78 },
  },
  {
    title: 'Platform pemilah',
    text: 'Di bawah lubang ada platform datar yang digerakkan satu servo. Platform miring ke kiri untuk sampah organik, ke kanan untuk anorganik.',
    view: { azimuth: -30, elevation: 40, fit: 0.95, targetY: 0.7 },
    tilt: 'organik',
  },
  {
    title: 'Sensor kapasitas',
    text: 'Dua sensor ultrasonik dipasang di langit-langit tiap kompartemen. Keduanya mengukur jarak ke permukaan sampah untuk menghitung persen terisi.',
    view: { azimuth: -42, elevation: 26, fit: 1.05, targetY: 0.55 },
  },
  {
    title: 'Laci organik',
    text: 'Kompartemen kiri menampung sampah organik. Pintunya berwarna hijau dan bisa ditarik keluar untuk dikosongkan.',
    view: { azimuth: -58, elevation: 14, fit: 0.95, targetY: 0.3 },
  },
  {
    title: 'Laci anorganik',
    text: 'Kompartemen kanan menampung sampah anorganik, ditandai warna biru mengikuti warna kategori di dashboard.',
    view: { azimuth: 48, elevation: 14, fit: 0.95, targetY: 0.3 },
  },
  {
    title: 'Panel LCD & LED',
    text: 'Di sisi depan ada LCD 16x2 yang menampilkan kapasitas dan pesan terima kasih, serta tiga LED: hijau normal, kuning hampir penuh, merah penuh.',
    view: { azimuth: 6, elevation: 18, fit: 0.8, targetY: 0.62 },
  },
];

export function initModelTour(container, viewer) {
  if (!container || !viewer) return null;
  const $ = (s) => container.querySelector(s);
  const stage   = $('.mv-stage');       // yang dijadikan layar penuh
  const titleEl = $('.tour-title');
  const textEl  = $('.tour-text');
  const stepEl  = $('.tour-step');
  const dotsEl  = $('.tour-dots');
  const prevBtn = $('.tour-prev');
  const nextBtn = $('.tour-next');
  const simBtn  = $('.mv-sim');
  const fsBtn   = $('.mv-fullscreen');
  const hintEl  = $('.mv-rotate-hint');

  let i = 0;

  dotsEl.innerHTML = STEPS.map((s, n) =>
    `<button type="button" class="tour-dot" data-i="${n}" aria-label="Langkah ${n + 1}: ${s.title}"></button>`).join('');
  const dots = [...dotsEl.querySelectorAll('.tour-dot')];

  function render(animate = true) {
    const s = STEPS[i];
    titleEl.textContent = s.title;
    textEl.textContent = s.text;
    stepEl.textContent = `${i + 1} / ${STEPS.length}`;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === STEPS.length - 1;
    dots.forEach((d, n) => {
      d.classList.toggle('is-active', n === i);
      d.setAttribute('aria-current', n === i ? 'step' : 'false');
    });
    viewer.flyTo({ ...s.view, duration: animate ? 900 : 0 });
    // Langkah platform: miringkan sebentar supaya gerakannya terlihat
    const pivot = viewer.state.parts?.tilt_platform_pivot;
    if (pivot) {
      const target = s.tilt === 'organik' ? 0.38 : 0;
      clearTimeout(render._t);
      render._t = setTimeout(() => { pivot.rotation.z = target; }, animate ? 500 : 0);
    }
  }

  const go = (n) => { i = Math.min(STEPS.length - 1, Math.max(0, n)); render(); };
  prevBtn.addEventListener('click', () => go(i - 1));
  nextBtn.addEventListener('click', () => go(i + 1));
  dots.forEach((d) => d.addEventListener('click', () => go(+d.dataset.i)));

  // Panah kiri/kanan saat fokus ada di dalam viewer
  container.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { go(i + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft')  { go(i - 1); e.preventDefault(); }
  });

  // ---------- Jalankan simulasi (satu siklus) ----------
  let simIndex = 0;
  simBtn.addEventListener('click', () => {
    if (viewer.demoRunning()) return;
    simBtn.disabled = true;
    simBtn.querySelector('.label').textContent = 'Sedang berjalan…';
    const pivot = viewer.state.parts?.tilt_platform_pivot;
    if (pivot) pivot.rotation.z = 0;
    viewer.flyTo({ azimuth: -24, elevation: 40, fit: 1.15, targetY: 0.62, duration: 700 });
    viewer.playDemo(simIndex++, () => {
      simBtn.disabled = false;
      simBtn.querySelector('.label').textContent = 'Jalankan simulasi';
    });
  });

  // ---------- Layar penuh + orientasi horizontal di ponsel ----------
  // Dua jalur: Fullscreen API bila diizinkan, kalau tidak (iPhone Safari, halaman
  // yang disematkan) pakai mode layar penuh berbasis CSS supaya tombol tetap berfungsi.
  const isNativeFs = () => document.fullscreenElement === stage;
  const isFauxFs   = () => stage.classList.contains('is-faux-fullscreen');
  const isFs       = () => isNativeFs() || isFauxFs();

  function syncFsUI() {
    const on = isFs();
    stage.classList.toggle('is-fullscreen', on);
    document.body.classList.toggle('mv-fullscreen-open', on);
    fsBtn.setAttribute('aria-pressed', String(on));
    fsBtn.querySelector('.label').textContent = on ? 'Keluar layar penuh' : 'Layar penuh';
    if (!on) hintEl.hidden = true;
    requestAnimationFrame(() => { viewer.resize(); render(false); });
  }

  async function lockLandscape() {
    if (!matchMedia('(max-width: 900px)').matches) return;
    try {
      await screen.orientation.lock('landscape');   // Android mengizinkan
      hintEl.hidden = true;
    } catch {
      // iOS menolak penguncian: minta pengguna memutar sendiri, hanya bila masih tegak
      if (matchMedia('(orientation: portrait)').matches) {
        hintEl.hidden = false;
        setTimeout(() => { hintEl.hidden = true; }, 4500);
      }
    }
  }

  async function enterFullscreen() {
    try {
      await stage.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      stage.classList.add('is-faux-fullscreen');    // cadangan: layar penuh versi CSS
      syncFsUI();
    }
    lockLandscape();
  }

  async function exitFullscreen() {
    try { screen.orientation?.unlock?.(); } catch {}
    if (isNativeFs()) { try { await document.exitFullscreen(); } catch {} }
    if (isFauxFs()) { stage.classList.remove('is-faux-fullscreen'); syncFsUI(); }
  }

  fsBtn.addEventListener('click', () => (isFs() ? exitFullscreen() : enterFullscreen()));
  document.addEventListener('fullscreenchange', syncFsUI);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isFauxFs()) exitFullscreen(); });

  render(false);
  viewer.ready.then(() => render(false)); // ulangi setelah model siap agar kamera langkah 1 pas
  return { go, render };
}
