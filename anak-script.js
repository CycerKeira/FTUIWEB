const STORAGE_KEY = 'ftui_shared_data';
const CHANNEL_NAME = 'ftui-parent-companion';

const PRIVACY_LABELS = [
  { key: 'attendance', icon: '🏫', title: 'Kehadiran Kelas', desc: 'Persentase kehadiran' },
  { key: 'taskLoad', icon: '📋', title: 'Beban Tugas', desc: 'Deadline dan beban tugas' },
  { key: 'sleep', icon: '🛌', title: 'Jam Tidur', desc: 'Rata-rata jam tidur harian' },
  { key: 'mood', icon: '🙂', title: 'Mood & Stres', desc: 'Kondisi emosional' },
  { key: 'liveActivity', icon: '📍', title: 'Status Aktivitas', desc: 'Status kegiatan saat ini' },
  { key: 'activities', icon: '📝', title: 'Kegiatan Non-Formal', desc: 'Praktikum, organisasi, dll' },
  { key: 'matkul', icon: '📚', title: 'Jadwal Matkul', desc: 'Jadwal kelas, dosen, ruangan' }
];

const DEFAULT_DATA = {
  student: { name: 'Raka Pratama', nim: '2306212345' },
  privacy: { attendance: true, taskLoad: true, sleep: true, mood: true, liveActivity: true, activities: true, matkul: true },
  live: { shared: true, status: 'Di kelas — Kalkulus II', since: Date.now() },
  matkul: [
    { id: 'm1', nama: 'Kalkulus II', hari: 'Senin', mulai: '08:00', selesai: '10:00', dosen: 'Dr. Budi', ruang: 'MRPQ 301' }
  ],
  activities: {
    praktikum: [],
    kerjaKelompok: [],
    organisasi: [],
    belajarMandiri: []
  },
  selfReport: { mood: 'Baik 🙂', moodScore: 4, sleepHours: 6.4, stress: 2 },
  stats: { attendance: 92, taskLoad: 'Sedang' }
};

let currentData = null;

// FUNGSI LOAD YANG DIPERBAIKI (AUTO-FIX DATA LAMA)
function loadData() {
  let raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  
  let parsed = JSON.parse(raw);
  
  // Menggabungkan data lama dengan data default agar tidak error
  let fixedData = { ...DEFAULT_DATA, ...parsed };
  fixedData.activities = { ...DEFAULT_DATA.activities, ...(parsed.activities || {}) };
  fixedData.privacy = { ...DEFAULT_DATA.privacy, ...(parsed.privacy || {}) };
  fixedData.selfReport = { ...DEFAULT_DATA.selfReport, ...(parsed.selfReport || {}) };
  fixedData.stats = { ...DEFAULT_DATA.stats, ...(parsed.stats || {}) };
  
  return fixedData;
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  try {
    const bc = new BroadcastChannel(CHANNEL_NAME);
    bc.postMessage({ type: 'update' });
    bc.close();
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
  currentData = loadData();
  
  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    sessionStorage.setItem('isLoggedIn', 'true');
    showDashboard();
  });

  document.querySelectorAll('.tabs-inner button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tabs-inner button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      const panel = document.getElementById(e.target.dataset.panel);
      if(panel) panel.classList.add('active');
    });
  });

  if (sessionStorage.getItem('isLoggedIn') === 'true') showDashboard();
});

function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboardScreen').classList.add('active');
  renderAll();
}

function renderAll() {
  document.getElementById('welcomeName').textContent = currentData.student.name.split(' ')[0];
  document.getElementById('studentLine').textContent = `${currentData.student.name} · ${currentData.student.nim}`;
  document.getElementById('liveValue').textContent = currentData.live.status;
  document.getElementById('sleepValue').textContent = currentData.selfReport.sleepHours;
  document.getElementById('stressValue').textContent = currentData.selfReport.stress;
  
  renderBanner();
  renderPrivacy();
  renderMatkul();
  renderKegiatan();
  renderSelfReport();
  renderStatusPicker();
  renderLive();
}

function renderBanner() {
  const keys = PRIVACY_LABELS.map(p => p.key);
  const on = keys.filter(k => currentData.privacy[k]).length;
  document.getElementById('shareBannerTitle').textContent = `Membagikan ${on} dari ${keys.length} kategori`;
}

function renderPrivacy() {
  const list = document.getElementById('privacyList');
  list.innerHTML = PRIVACY_LABELS.map(p => {
    const on = currentData.privacy[p.key];
    return `
      <div class="privacy-row ${on ? 'on' : 'off'}">
        <div class="privacy-row-icon">${p.icon}</div>
        <div class="privacy-row-text">
          <strong>${p.title}</strong>
          <span>${p.desc}</span>
        </div>
        <label class="switch"><input type="checkbox" ${on ? 'checked' : ''} onchange="togglePrivacy('${p.key}', this.checked)" /><span class="switch-slider"></span></label>
      </div>`;
  }).join('');
  
  const grid = document.getElementById('shareSummaryGrid');
  grid.innerHTML = PRIVACY_LABELS.map(p => `
    <div class="card" style="border-color:${currentData.privacy[p.key] ? '#7DC79E' : '#ddd'}">
      <div style="font-size:1.5rem; margin-bottom:5px;">${p.icon}</div>
      <h3>${p.title}</h3>
      <p style="color:${currentData.privacy[p.key] ? '#166534' : '#666'};font-weight:bold;">${currentData.privacy[p.key] ? '✅ Dibagikan' : '🔒 Disembunyikan'}</p>
    </div>
  `).join('');
}

window.togglePrivacy = (key, val) => {
  currentData.privacy[key] = val;
  saveData(currentData);
  renderAll();
  showToast(val ? '✅ Dibagikan' : '🔒 Disembunyikan');
};

window.scrollToPanel = (id) => {
  const tabBtn = document.querySelector(`.tabs-inner button[data-panel="${id}"]`);
  if (tabBtn) tabBtn.click();
};

// --- JADWAL MATKUL (TAMPILAN KALENDER SENIN - MINGGU) ---
function renderMatkul() {
  const calendar = document.getElementById('matkulGrid');
  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  
  let html = '';
  days.forEach(day => {
    // Filter data sesuai hari
    const items = currentData.matkul
      .filter(m => m.hari === day)
      .sort((a, b) => a.mulai.localeCompare(b.mulai));
    
    // Buat kartu-kartu matkul
    let cards = items.map(m => `
      <div class="calendar-item">
        <strong>${m.nama}</strong>
        <span>⏰ ${m.mulai} - ${m.selesai}</span>
        <span>📍 ${m.ruang || '-'}</span>
        <span>👨‍🏫 ${m.dosen || '-'}</span>
        <button class="btn-del-cal" onclick="deleteMatkul('${m.id}')">Hapus</button>
      </div>
    `).join('');
    
    if (!cards) {
      cards = '<div style="text-align:center; font-size:0.75rem; color:#999; margin-top:20px;">Kosong</div>';
    }

    // Bungkus jadi kolom hari
    html += `
      <div class="calendar-day">
        <div class="calendar-day-header">${day}</div>
        <div class="calendar-day-body">
          ${cards}
        </div>
      </div>
    `;
  });
  
  calendar.innerHTML = html;
}

window.openMatkulModal = () => document.getElementById('matkulModal').classList.add('active');
window.closeMatkulModal = () => document.getElementById('matkulModal').classList.remove('active');
window.saveMatkul = () => {
  const nama = document.getElementById('mkName').value;
  const hari = document.getElementById('mkDay').value;
  const mulai = document.getElementById('mkStart').value;
  const selesai = document.getElementById('mkEnd').value;
  const ruang = document.getElementById('mkRoom').value;
  const dosen = document.getElementById('mkDosen').value;

  if (!nama || !mulai || !selesai) return showToast('Lengkapi data wajib!');
  currentData.matkul.push({ id: 'm' + Date.now(), nama, hari, mulai, selesai, ruang, dosen });
  saveData(currentData);
  renderMatkul();
  closeMatkulModal();
  showToast('📚 Jadwal ditambahkan');
  
  document.getElementById('mkName').value = '';
  document.getElementById('mkStart').value = '';
  document.getElementById('mkEnd').value = '';
  document.getElementById('mkRoom').value = '';
  document.getElementById('mkDosen').value = '';
};

window.deleteMatkul = (id) => {
  if(confirm('Yakin mau hapus jadwal ini?')) {
      currentData.matkul = currentData.matkul.filter(m => m.id !== id);
      saveData(currentData);
      renderMatkul();
      showToast('🗑️ Jadwal dihapus');
  }
};

// --- KEGIATAN (TAMBAH & HAPUS) ---
function renderKegiatan() {
  const grid = document.getElementById('kegiatanGrid');
  const cats = [
    { key: 'praktikum', title: 'Praktikum', icon: '🔬' },
    { key: 'kerjaKelompok', title: 'Kerja Kelompok', icon: '👥' },
    { key: 'organisasi', title: 'Organisasi', icon: '🎯' },
    { key: 'belajarMandiri', title: 'Belajar Mandiri', icon: '📖' }
  ];
  
  grid.innerHTML = cats.map(c => {
    const items = currentData.activities[c.key] || [];
    
    const list = items.map(i => `
        <li style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:8px;">
            <div>
                <strong style="font-size:0.9rem;">${i.title}</strong><br>
                <span style="font-size:0.75rem;color:var(--muted);">${i.day} ${i.time}</span>
            </div>
            <button class="btn-secondary btn-sm" style="padding:0.2rem 0.5rem; color:#EF4444; border-color:#EF4444;" onclick="deleteActivity('${c.key}', '${i.id}')">✕</button>
        </li>
    `).join('');
    
    return `
      <div class="card">
        <div style="font-size:1.5rem; margin-bottom:5px;">${c.icon}</div>
        <h3>${c.title}</h3>
        <ul style="padding-left:0; list-style:none; margin-bottom:15px; margin-top:10px;">${list || '<li style="color:var(--muted); font-size:0.85rem;">Belum ada kegiatan.</li>'}</ul>
        <button class="btn-secondary btn-sm" onclick="openActivityModal('${c.key}')">➕ Tambah Kegiatan</button>
      </div>
    `;
  }).join('');
}

window.openActivityModal = (cat) => {
  document.getElementById('actCategory').value = cat;
  document.getElementById('actTitle').value = '';
  document.getElementById('actDay').value = '';
  document.getElementById('actTime').value = '';
  document.getElementById('activityModal').classList.add('active');
};

window.closeActivityModal = () => document.getElementById('activityModal').classList.remove('active');

window.saveActivity = () => {
  const cat = document.getElementById('actCategory').value;
  const title = document.getElementById('actTitle').value;
  const day = document.getElementById('actDay').value;
  const time = document.getElementById('actTime').value;
  
  if (!title) return showToast('Nama kegiatan wajib diisi');
  
  if (!currentData.activities[cat]) {
      currentData.activities[cat] = [];
  }
  
  currentData.activities[cat].push({ id: 'a' + Date.now(), title, day, time });
  saveData(currentData);
  renderKegiatan();
  closeActivityModal();
  showToast('📝 Kegiatan ditambahkan');
};

window.deleteActivity = (cat, id) => {
    if(confirm('Yakin mau hapus kegiatan ini?')) {
        currentData.activities[cat] = currentData.activities[cat].filter(item => item.id !== id);
        saveData(currentData);
        renderKegiatan();
        showToast('🗑️ Kegiatan dihapus');
    }
};

// --- STATUS LIVE ---
function renderStatusPicker() {
  const picker = document.getElementById('statusPicker');
  const statuses = [
    { label: '🏫 Di kelas', val: 'Di kelas' },
    { label: '🔬 Praktikum', val: 'Praktikum' },
    { label: '👥 Kerja Kelompok', val: 'Kerja Kelompok' },
    { label: '🎯 Organisasi', val: 'Organisasi' },
    { label: '📖 Belajar Mandiri', val: 'Belajar Mandiri' },
    { label: '☕ Istirahat', val: 'Istirahat' },
    { label: '🏠 Di rumah/kos', val: 'Di rumah/kos' }
  ];
  picker.innerHTML = statuses.map(s => `
    <button class="status-pill ${currentData.live.status === s.val ? 'active' : ''}" onclick="setStatus('${s.val}')">${s.label}</button>
  `).join('');
}

window.setStatus = (status) => {
  currentData.live.status = status;
  currentData.live.since = Date.now();
  currentData.live.shared = true;
  saveData(currentData);
  renderAll();
  showToast('📍 Status diperbarui');
};

function renderLive() {
  const isOn = currentData.live.shared && currentData.privacy.liveActivity;
  document.getElementById('livePulse').className = `live-pulse ${isOn ? 'on' : 'off'}`;
  document.getElementById('liveValue').textContent = isOn ? currentData.live.status : 'Tidak dibagikan';
  document.getElementById('liveSub').textContent = isOn ? 'Baru saja diperbarui' : 'Orang tua tidak melihat statusmu';
  document.getElementById('liveShareBtn').textContent = currentData.live.shared ? '⏸️ Berhenti Membagikan' : '▶️ Mulai Membagikan';
}

window.toggleLiveSharing = () => {
  currentData.live.shared = !currentData.live.shared;
  saveData(currentData);
  renderAll();
  showToast(currentData.live.shared ? '▶️ Berbagi diaktifkan' : '⏸️ Berbagi dihentikan');
};

// --- SELF REPORT ---
function renderSelfReport() {
  const sleepRange = document.getElementById('sleepRange');
  const stressRange = document.getElementById('stressRange');
  
  sleepRange.value = currentData.selfReport.sleepHours;
  stressRange.value = currentData.selfReport.stress;
  
  sleepRange.oninput = (e) => {
    currentData.selfReport.sleepHours = parseFloat(e.target.value);
    document.getElementById('sleepValue').textContent = e.target.value;
    saveData(currentData);
  };
  stressRange.oninput = (e) => {
    currentData.selfReport.stress = parseInt(e.target.value);
    document.getElementById('stressValue').textContent = e.target.value;
    saveData(currentData);
  };

  const moodPicker = document.getElementById('moodPicker');
  if(moodPicker) {
      const moods = [
          { score: 1, emoji: '😞', label: 'Buruk' },
          { score: 2, emoji: '😕', label: 'Kurang' },
          { score: 3, emoji: '😐', label: 'Biasa' },
          { score: 4, emoji: '🙂', label: 'Baik' },
          { score: 5, emoji: '😄', label: 'Sangat Baik' }
      ];
      moodPicker.innerHTML = moods.map(m => `
          <button class="mood-btn ${currentData.selfReport.moodScore === m.score ? 'active' : ''}" onclick="setMood(${m.score}, '${m.emoji} ${m.label}')">
              <span class="emoji">${m.emoji}</span>
              <span class="label">${m.label}</span>
          </button>
      `).join('');
  }
}

window.setMood = (score, val) => {
    currentData.selfReport.moodScore = score;
    currentData.selfReport.mood = val;
    saveData(currentData);
    renderSelfReport();
    showToast('🙂 Mood diperbarui');
};

window.handleLogout = () => {
  sessionStorage.removeItem('isLoggedIn');
  location.reload();
};

let toastTimer;
window.showToast = (msg) => {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
};