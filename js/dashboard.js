/* =====================================================================
   Smart Bin: Mockup dashboard mobile (data simulasi, tanpa backend)
   State di bawah ini yang nantinya diganti data dari MQTT.
   ===================================================================== */
(function () {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---------- State aplikasi (nanti diisi dari topik MQTT smartbin/01/#) ----------
  const state = {
    mode: 'auto',                       // 'auto' | 'manual'
    threshold: 80,                      // % kapasitas dianggap "penuh"
    levels: { organik: 45, anorganik: 85 },
    totals: { organik: 152, anorganik: 97 },   // counter total sampah yang sudah masuk (dari alat)
    binHeight: 30,                      // tinggi kompartemen (cm) untuk konversi jarak ultrasonik
    notif: { push: true, full: true, daily: false },
    online: false,      // koneksi alat (MQTT). false + connecting = loading state, false saja = error state
    connecting: true,
  };

  // Statistik 7 hari terakhir (hari ini = indeks terakhir)
  const WEEK_DEFAULT = {
    days: ['Jum', 'Sab', 'Min', 'Sen', 'Sel', 'Rab', 'Kam'],
    organik:   [16, 9, 7, 14, 18, 12, 15],
    anorganik: [10, 6, 4,  9, 11,  8,  9],
  };
  const ACTIVITY_DEFAULT = [
    { time: '14:32', type: 'organik',   title: 'Sampah organik terdeteksi',   desc: 'Lembab 68% · platform miring ke kiri' },
    { time: '14:10', type: 'anorganik', title: 'Sampah anorganik terdeteksi', desc: 'Kering 21% · platform miring ke kanan' },
    { time: '13:58', type: 'alert',     title: 'Kompartemen anorganik 85%',   desc: 'Melewati ambang 80% · LED merah menyala' },
    { time: '13:41', type: 'anorganik', title: 'Sampah anorganik terdeteksi', desc: 'Kering 18% · platform miring ke kanan' },
    { time: '12:05', type: 'manual',    title: 'Platform dimiringkan ke organik', desc: 'Mode manual override · uji servo' },
    { time: '11:47', type: 'organik',   title: 'Sampah organik terdeteksi',   desc: 'Lembab 74% · platform miring ke kiri' },
    { time: '09:15', type: 'system',    title: 'Alat online',                 desc: 'Terhubung ke WiFi & MQTT broker' },
  ];
  let week = clone(WEEK_DEFAULT);
  let activity = clone(ACTIVITY_DEFAULT);

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const nowHM = () => {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };

  // ---------- Navigasi bawah ----------
  function showPage(name) {
    $$('.page').forEach((p) => p.classList.toggle('active', p.dataset.page === name));
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === name));
    $('#appContent').scrollTop = 0;
  }
  $$('.nav-item').forEach((b) => b.addEventListener('click', () => showPage(b.dataset.page)));
  $('#bellBtn').addEventListener('click', () => showPage('history'));

  // ---------- Logika status (sama dengan LED di alat) ----------
  function levelStatus(v) {
    if (v >= state.threshold)      return { cls: 'red',   label: 'Penuh',        color: 'var(--red-500)' };
    if (v >= state.threshold - 20) return { cls: 'amber', label: 'Hampir penuh', color: 'var(--amber-500)' };
    return                                { cls: 'green', label: 'Normal',       color: 'var(--green-600)' }; // 3.3:1 non-teks
  }
  // Ultrasonik mengukur jarak ke permukaan sampah → jarak = tinggi bin × (1 − level)
  function distanceCm(level) {
    return (state.binHeight * (1 - level / 100)).toFixed(1).replace('.', ',') + ' cm';
  }

  // ---------- Halaman Beranda ----------
  const CIRC = 2 * Math.PI * 42; // keliling lingkaran gauge (r = 42)
  function renderHome() {
    Object.entries(state.levels).forEach(([key, v]) => {
      const card = $(`.gauge-card[data-comp="${key}"]`);
      const st = levelStatus(v);
      const bar = $('.bar', card);
      bar.style.strokeDashoffset = CIRC * (1 - v / 100);
      bar.style.stroke = st.color;
      $('.num', card).textContent = v;
      $('.dist', card).textContent = distanceCm(v);
      const lvl = $('.lvl', card);
      lvl.className = 'lvl lvl-' + st.cls;
      lvl.innerHTML = '<span class="dot"></span>' + st.label;
    });
    $('#modeLabel').textContent = state.mode === 'auto' ? 'Otomatis' : 'Manual Override';
    renderTotals();
    renderBanner();
  }

  // Counter total sampah yang sudah masuk (dihitung alat, dikirim via MQTT)
  function renderTotals() {
    $('#totalOrg').textContent = state.totals.organik;
    $('#totalAnorg').textContent = state.totals.anorganik;
  }

  // ---------- Simulasi sampah masuk (hook untuk pesan MQTT "deteksi" nanti) ----------
  const DETECT_ICON = { organik: { icon: 'leaf', cls: 'green' }, anorganik: { icon: 'package', cls: 'blue' } };
  function onDetection({ type, moisture }) {
    const isOrg = type === 'organik';
    const time = nowHM();
    const desc = `Kelembaban ${moisture}% (${isOrg ? 'lembab' : 'kering'}) · platform miring ke ${isOrg ? 'kiri' : 'kanan'} · tersortir`;

    // 1) kartu "Deteksi terakhir"
    const card = $('#lastDetect');
    const m = DETECT_ICON[type];
    $('.icon-box', card).className = `icon-box ${m.cls}`;
    $('.icon-box', card).innerHTML = `<span data-icon="${m.icon}"></span>`;
    $('.t strong', card).textContent = `Sampah ${type}`;
    $('.t span', card).textContent = desc;
    $('time', card).textContent = time;
    renderIcons(card);

    // 2) counter total, level kompartemen, statistik hari ini
    state.totals[type] += 1;
    state.levels[type] = Math.min(100, state.levels[type] + 2);
    week[type][week.days.length - 1] += 1;
    addActivity({ type, title: `Sampah ${type} terdeteksi`, desc: `${isOrg ? 'Lembab' : 'Kering'} ${moisture}% · platform miring ke ${isOrg ? 'kiri' : 'kanan'}` });
    renderHome();
    renderChart();

    // 3) pesan apresiasi, sama seperti yang tampil di LCD alat
    toast('Terima kasih! Sampah berhasil terpilah 🌱', 'leaf', { variant: 'thanks', duration: 3200 });
  }
  let simToggle = false;
  $('#simulateBtn').addEventListener('click', () => {
    simToggle = !simToggle;
    const type = simToggle ? 'anorganik' : 'organik';
    const moisture = type === 'organik' ? 60 + Math.floor(Math.random() * 25) : 12 + Math.floor(Math.random() * 20);
    onDetection({ type, moisture });
  });

  function renderBanner() {
    const el = $('#alertBanner');
    if (state.connecting) {
      el.innerHTML = `<div class="alert alert-gray"><span class="spinner" aria-hidden="true"></span><div>
        <strong>Menghubungkan ke alat…</strong>
        <p>Mengambil data terakhir dari broker MQTT (smartbin/01/#).</p></div></div>`;
      return;
    }
    if (!state.online) {
      el.innerHTML = `<div class="alert alert-red"><span data-icon="x-circle"></span><div>
        <strong>Alat tidak terhubung</strong>
        <p>Data terakhir diterima pukul ${state.lastSeen}. Periksa WiFi alat dan broker MQTT, lalu tekan "Sambungkan kembali" di Pengaturan.</p></div></div>`;
      renderIcons(el);
      return;
    }
    if (!state.notif.full) { el.innerHTML = ''; return; }
    const entries = Object.entries(state.levels);
    const full = entries.filter(([, v]) => v >= state.threshold).map(([k]) => cap(k));
    const near = entries.filter(([, v]) => v < state.threshold && v >= state.threshold - 20).map(([k]) => cap(k));
    let html;
    if (full.length) {
      html = `<div class="alert alert-red"><span data-icon="alert-triangle"></span><div>
        <strong>Kompartemen ${full.join(' & ')} penuh</strong>
        <p>Level melewati ambang ${state.threshold}%. Segera kosongkan agar platform tidak terhalang.</p></div></div>`;
    } else if (near.length) {
      html = `<div class="alert alert-amber"><span data-icon="bell-ring"></span><div>
        <strong>Kompartemen ${near.join(' & ')} hampir penuh</strong>
        <p>Mendekati ambang ${state.threshold}%. Jadwalkan pengosongan.</p></div></div>`;
    } else {
      html = `<div class="alert alert-green"><span data-icon="check-circle"></span><div>
        <strong>Semua kompartemen normal</strong>
        <p>Kapasitas masih di bawah ambang ${state.threshold}%.</p></div></div>`;
    }
    el.innerHTML = html;
    renderIcons(el);
  }

  // ---------- Koneksi alat: loading → online, atau offline (error state) ----------
  function renderConnection() {
    const label = state.connecting ? 'Menghubungkan…' : state.online ? 'Online' : 'Offline';
    $$('.js-status').forEach((ch) => {
      ch.classList.toggle('offline', !state.online && !state.connecting);
      ch.classList.toggle('connecting', state.connecting);
      ch.innerHTML = '<span class="dot"></span> ' + label;
    });
    $('.app').classList.toggle('is-offline', !state.online && !state.connecting);
    $('#mqttStatus').innerHTML = state.online ? '<em class="ok">Terhubung</em>' : state.connecting ? '<em>Menghubungkan…</em>' : '<em class="err">Terputus</em>';
    const btn = $('#offlineBtn');
    btn.innerHTML = state.online ? '<span data-icon="power"></span> Uji mode alat offline' : '<span data-icon="refresh"></span> Sambungkan kembali';
    btn.disabled = state.connecting;
    renderIcons(btn);
    $('#simulateBtn').disabled = !state.online;
    $$('#modeSeg button').forEach((b) => { b.disabled = !state.online; });
    renderControl();
    renderBanner();
  }
  function setOnline(online) {
    state.online = online; state.connecting = false;
    if (!online) state.lastSeen = nowHM();
    renderConnection();
  }
  function connect() {
    state.connecting = true; state.online = false;
    renderConnection();
    setTimeout(() => { setOnline(true); renderHome(); toast('Terhubung ke broker MQTT', 'wifi'); }, 1100);
  }
  $('#offlineBtn').addEventListener('click', () => {
    if (state.online) { setOnline(false); toast('Alat terputus (simulasi)', 'x-circle'); }
    else connect();
  });

  // ---------- Halaman Kontrol ----------
  function renderControl() {
    const manual = state.mode === 'manual';
    $$('#modeSeg button').forEach((b) => b.classList.toggle('active', b.dataset.mode === state.mode));
    $$('.tilt-btn').forEach((b) => { b.disabled = !manual || !state.online; });
    $('#modeNote span:last-child').textContent = manual
      ? 'Pemilahan otomatis dijeda. Platform hanya bergerak lewat tombol di bawah, gunakan untuk pengujian servo.'
      : 'Sistem mendeteksi sampah masuk melalui sensor inframerah, lalu menentukan jenisnya berdasarkan tingkat kelembaban.';
    $('#tiltHint').textContent = !state.online
      ? 'Alat tidak terhubung. Kontrol dinonaktifkan sampai koneksi kembali.'
      : manual
        ? 'Tekan tombol untuk memiringkan platform selama 1,5 detik, lalu servo kembali ke posisi tengah.'
        : 'Aktifkan Manual Override untuk mengendalikan platform.';
  }
  $$('#modeSeg button').forEach((b) => b.addEventListener('click', () => {
    if (state.mode === b.dataset.mode) return;
    state.mode = b.dataset.mode;
    renderControl();
    renderHome();
    toast(state.mode === 'manual' ? 'Mode Manual Override aktif' : 'Kembali ke mode Otomatis', 'zap');
  }));

  // Satu servo platform: miring ke kiri (organik) / kanan (anorganik), lalu kembali ke tengah
  const tiltIndicator = $('#tiltIndicator');
  $$('.tilt-btn').forEach((b) => b.addEventListener('click', () => {
    if ($('.tilt-btn.busy')) return;
    const key = b.dataset.target;
    const label = $('.lbl', b);
    const original = label.textContent;
    b.classList.add('busy');
    label.textContent = 'Memiringkan…';
    tiltIndicator.dataset.pos = key;
    toast(`Perintah miringkan platform ke ${key} dikirim via MQTT`, 'rotate-cw');
    addActivity({ type: 'manual', title: `Platform dimiringkan ke ${key}`, desc: 'Mode manual override · uji servo' });
    setTimeout(() => {
      label.textContent = 'Kembali ke tengah';
      tiltIndicator.dataset.pos = '';
      setTimeout(() => { label.textContent = original; b.classList.remove('busy'); }, 900);
    }, 1500);
  }));

  function renderThreshold() {
    const t = state.threshold;
    $('#thVal').textContent = t;
    $('#thHint').textContent = `LED merah & notifikasi aktif saat level ≥ ${t}%.`;
    $('#lgGreen').textContent = `< ${t - 20}%`;
    $('#lgAmber').textContent = `${t - 20}–${t - 1}%`;
    $('#lgRed').textContent = `≥ ${t}%`;
  }
  $('#thRange').addEventListener('input', (e) => {
    state.threshold = Number(e.target.value);
    renderThreshold();
    renderHome();
  });
  $('#thRange').addEventListener('change', () => toast(`Ambang batas disimpan: ${state.threshold}%`));

  // ---------- Halaman Riwayat ----------
  function renderChart() {
    const el = $('#chart');
    const max = Math.max(1, ...week.organik, ...week.anorganik);
    const last = week.days.length - 1;
    el.innerHTML = week.days.map((d, i) => `
      <div class="col ${i === last ? 'today' : ''}">
        <div class="bars">
          <span class="bar org"   style="--h: ${week.organik[i] / max * 100}%"   title="Organik: ${week.organik[i]}"></span>
          <span class="bar anorg" style="--h: ${week.anorganik[i] / max * 100}%" title="Anorganik: ${week.anorganik[i]}"></span>
        </div>
        <span class="day">${d}</span>
      </div>`).join('');

    const sum = (a) => a.reduce((x, y) => x + y, 0);
    const org = sum(week.organik), anorg = sum(week.anorganik);
    $('#statOrg').textContent = org;
    $('#statAnorg').textContent = anorg;
    $('#statTotal').textContent = org + anorg;

    // Kartu "Hari ini" di Beranda ikut data hari terakhir
    const tOrg = week.organik[last], tAnorg = week.anorganik[last], tot = tOrg + tAnorg;
    $('#todayOrg').textContent = tOrg;
    $('#todayAnorg').textContent = tAnorg;
    $('#todayTotal').textContent = `${tot} item`;
    $('#todayBar .org').style.width = tot ? (tOrg / tot * 100) + '%' : '0%';
    $('#todayBar .anorg').style.width = tot ? (tAnorg / tot * 100) + '%' : '0%';
  }

  const ACT_ICON = {
    organik:   { icon: 'leaf',           cls: 'green' },
    anorganik: { icon: 'package',        cls: 'blue' },
    alert:     { icon: 'alert-triangle', cls: 'red' },
    manual:    { icon: 'hand',           cls: 'amber' },
    system:    { icon: 'wifi',           cls: 'gray' },
  };
  function renderActivity() {
    const el = $('#activityList');
    if (!activity.length) {
      el.innerHTML = `<li class="empty"><div><span data-icon="clock"></span>Belum ada aktivitas tercatat.<br>
        <button class="btn btn-soft btn-sm" id="reloadDemo"><span data-icon="refresh"></span> Muat data demo</button></div></li>`;
      renderIcons(el);
      $('#reloadDemo').addEventListener('click', () => {
        week = clone(WEEK_DEFAULT);
        activity = clone(ACTIVITY_DEFAULT);
        renderChart(); renderActivity();
        toast('Data demo dimuat ulang', 'refresh');
      });
      return;
    }
    el.innerHTML = activity.map((a) => {
      const m = ACT_ICON[a.type] || ACT_ICON.system;
      return `<li>
        <div class="icon-box ${m.cls} sm"><span data-icon="${m.icon}"></span></div>
        <div class="t"><strong>${a.title}</strong><span>${a.desc}</span></div>
        <time>${a.time}</time>
      </li>`;
    }).join('');
    renderIcons(el);
  }
  function addActivity(item) {
    activity.unshift({ time: nowHM(), ...item });
    renderActivity();
  }

  // ---------- Halaman Pengaturan ----------
  $$('.switch').forEach((s) => s.addEventListener('click', () => {
    const on = s.getAttribute('aria-checked') !== 'true';
    s.setAttribute('aria-checked', String(on));
    state.notif[s.dataset.notif] = on;
    if (s.dataset.notif === 'full') renderBanner();
    toast(`${s.getAttribute('aria-label')} ${on ? 'diaktifkan' : 'dimatikan'}`, on ? 'check-circle' : 'x-circle');
  }));

  $('#exportBtn').addEventListener('click', () => toast('riwayat_smartbin.csv disiapkan (simulasi)', 'download'));

  const modal = $('#modal');
  const openModal = (open) => { modal.classList.toggle('open', open); modal.setAttribute('aria-hidden', String(!open)); };
  $('#resetBtn').addEventListener('click', () => { openModal(true); $('#modalCancel').focus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) { openModal(false); $('#resetBtn').focus(); } });
  $('#modalCancel').addEventListener('click', () => openModal(false));
  modal.addEventListener('click', (e) => { if (e.target === modal) openModal(false); });
  $('#modalConfirm').addEventListener('click', () => {
    activity = [];
    week.organik = week.organik.map(() => 0);
    week.anorganik = week.anorganik.map(() => 0);
    renderChart(); renderActivity();
    openModal(false);
    toast('Riwayat & statistik direset', 'trash-2');
  });

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg, icon = 'check-circle', { variant = '', duration = 2200 } = {}) {
    const t = $('#toast');
    t.className = 'toast' + (variant ? ' ' + variant : '');
    t.innerHTML = `<span data-icon="${icon}"></span><span>${msg}</span>`;
    renderIcons(t);
    // paksa reflow supaya animasi muncul lagi walau toast sebelumnya masih tampil
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), duration);
  }

  // ---------- Mode sentuh: tekan lalu geser untuk menggulir (meniru jari di layar HP) ----------
  // Hanya untuk mouse; di layar sentuh sudah ada scroll bawaan. Klik biasa tetap jalan karena
  // geseran baru dianggap "drag" setelah melewati ambang 4 px.
  (function enableDragScroll() {
    if (!matchMedia('(hover: hover)').matches) return;
    const el = $('#appContent');
    const DRAG_THRESHOLD = 4;
    let startY = 0, startTop = 0, dragging = false, moved = false;
    let lastY = 0, lastT = 0, velocity = 0, glideId = 0;

    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      cancelAnimationFrame(glideId);
      dragging = true; moved = false;
      startY = lastY = e.clientY; startTop = el.scrollTop;
      lastT = performance.now(); velocity = 0;
    });

    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dy = e.clientY - startY;
      if (!moved && Math.abs(dy) < DRAG_THRESHOLD) return;
      if (!moved) { moved = true; el.classList.add('is-dragging'); el.setPointerCapture(e.pointerId); }
      el.scrollTop = startTop - dy;
      const now = performance.now(), dt = now - lastT;
      if (dt > 0) velocity = (e.clientY - lastY) / dt; // px per ms
      lastY = e.clientY; lastT = now;
    });

    const release = (e) => {
      if (!dragging) return;
      dragging = false;
      if (!moved) return;
      el.classList.remove('is-dragging');
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
      // inersia: lanjut meluncur lalu melambat, seperti scroll di ponsel
      let v = velocity * 16; // px per frame
      const glide = () => {
        if (Math.abs(v) < 0.4) return;
        el.scrollTop -= v;
        v *= 0.94;
        glideId = requestAnimationFrame(glide);
      };
      glideId = requestAnimationFrame(glide);
      // batalkan klik yang terlanjur terpicu di akhir geseran
      const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      el.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0);
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('dragstart', (e) => e.preventDefault()); // jangan seret teks/gambar
  })();

  // ---------- Jam status bar & indikator sinkronisasi ----------
  function tickClock() { $('#clock').textContent = nowHM(); }
  let syncSec = 3;
  setInterval(() => {
    if (state.connecting) { $('#syncLabel').textContent = 'menghubungkan…'; return; }
    if (!state.online) { $('#syncLabel').textContent = `terputus (${state.lastSeen})`; return; }
    syncSec = (syncSec + 1) % 10; // alat "mengirim data" tiap 10 detik
    $('#syncLabel').textContent = syncSec === 0 ? 'baru saja' : `${syncSec} dtk lalu`;
  }, 1000);

  // ---------- Init ----------
  renderIcons();
  tickClock(); setInterval(tickClock, 30 * 1000);
  renderThreshold();
  renderTotals();
  renderControl();
  renderChart();
  renderActivity();
  state.lastSeen = '14:32';
  connect(); // loading state ±1 detik, lalu online dan gauge dianimasikan
  requestAnimationFrame(() => setTimeout(renderHome, 120));
})();
