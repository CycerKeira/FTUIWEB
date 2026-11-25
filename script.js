const STORAGE_KEY = 'ftui_shared_data';

/* --- A11Y & UI --- */
function setFont(size, btn) {
  document.body.classList.remove('large-text', 'xlarge-text');
  if (size === 'large') document.body.classList.add('large-text');
  if (size === 'xlarge') document.body.classList.add('xlarge-text');
  document.querySelectorAll('.a11y-bar button[data-fs]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function toggleContrast(btn) {
  document.body.classList.toggle('high-contrast');
  if (btn) btn.classList.toggle('active');
}

/* --- LOGIN & TABS --- */
function handleLogin(e) {
  e.preventDefault();
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('dashboardScreen').classList.add('active');
  applyChildData(); 
}

function handleLogout() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('dashboardScreen').classList.remove('active');
}

function togglePassword(btn) {
  const input = document.getElementById('password');
  if (input.type === 'password') { input.type = 'text'; btn.textContent = '🙈'; }
  else { input.type = 'password'; btn.textContent = '👁️'; }
}

function scrollToPanel(id) {
  const tabBtn = document.querySelector(`.tabs-inner button[data-panel="${id}"]`);
  if (tabBtn) tabBtn.click();
}

/* --- TOAST --- */
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

/* --- TIPS ACCORDION --- */
const TIPS_DATA = [
  { q: 'Bagaimana memulai percakapan tanpa terkesan menginterogasi?', a: 'Mulai dengan hal ringan: "Gimana hari ini?" daripada "Nilai kamu berapa?". Biarkan anak yang memilih apa yang ingin dibagikan.' },
  { q: 'Kapan waktu yang tepat untuk menanyakan kesiapan UTS?', a: 'Bukan saat anak baru pulang dan lelah. Coba saat makan malam santai atau akhir pekan. Tanyakan "Ada yang bisa dibantu?" bukan "Sudah belajar belum?".' },
  { q: 'Bagaimana merespons nilai yang lebih rendah dari ekspektasi?', a: 'Tahan reaksi awal. Tanyakan: "Menurutmu, apa yang bikin hasilnya begini?" Dengarkan dulu. Nilai B di teknik bukan kegagalan.' },
  { q: 'Bagaimana mendukung anak yang tinggal di kos?', a: 'Jangan pantau lewat lokasi. Cukup tanyakan rutin soal makan, tidur, dan kesehatan.' }
];

function renderAccordion() {
  const wrap = document.getElementById('accordionWrap');
  if (!wrap) return;
  wrap.innerHTML = TIPS_DATA.map(t => `
    <div class="accordion-item">
      <div class="accordion-head" onclick="toggleAccordion(this)">
        <span>${t.q}</span>
        <span class="chev">▼</span>
      </div>
      <div class="accordion-body"><p>${t.a}</p></div>
    </div>
  `).join('');
}

function toggleAccordion(head) {
  const item = head.closest('.accordion-item');
  item.classList.toggle('open');
}

/* --- CHATBOT --- */
const BOT_REPLIES = {
  privasi: 'Kami hanya menampilkan data yang dipilih anak. Nilai detail per mata kuliah, isi chat, dan lokasi presisi tidak pernah dibagikan.',
  kegiatan: 'Di tab "Kegiatan Anak" Anda bisa melihat ringkasan praktikum, kerja kelompok, organisasi, dan belajar mandiri.',
  tips: 'Coba mulai percakapan dengan pertanyaan ringan seperti "Gimana hari ini?" daripada langsung menanyakan nilai.',
  stres: 'Validasi perasaannya dulu: "Kedengarannya berat ya." Hindari kalimat seperti "zaman Bapak dulu lebih berat".',
  default: 'Maaf, saya belum paham. Coba tanyakan soal: privasi data, kegiatan anak, tips komunikasi, atau anak stres.'
};

function toggleChat() {
  const w = document.getElementById('chatWindow');
  const fab = document.getElementById('chatFab');
  const badge = document.getElementById('chatBadge');
  w.classList.toggle('open');
  if (w.classList.contains('open')) {
    fab.style.display = 'none';
    if (badge) badge.style.display = 'none';
    if (!document.getElementById('chatMessages').children.length) {
      addBotMessage('Halo! Saya Asisten FTUI. Ada yang bisa saya bantu soal pendampingan belajar anak? 💛');
    }
    setTimeout(() => document.getElementById('chatInput').focus(), 100);
  } else {
    fab.style.display = 'block';
  }
}

function addBotMessage(text) {
  const wrap = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.innerHTML = `<div class="msg-bubble">${text}</div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function addUserMessage(text) {
  const wrap = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg user';
  div.innerHTML = `<div class="msg-bubble">${text}</div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function handleChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  addUserMessage(text);
  input.value = '';
  setTimeout(() => {
    const t = text.toLowerCase();
    let reply = BOT_REPLIES.default;
    if (t.match(/privasi|data|share|bagi/)) reply = BOT_REPLIES.privasi;
    else if (t.match(/kegiatan|praktikum|kelompok|organisasi/)) reply = BOT_REPLIES.kegiatan;
    else if (t.match(/tips|komunikasi|ngobrol|bicara/)) reply = BOT_REPLIES.tips;
    else if (t.match(/stres|sedih|murung|depresi|cemas/)) reply = BOT_REPLIES.stres;
    addBotMessage(reply);
  }, 500);
}

function sendSuggestion(text) {
  document.getElementById('chatInput').value = text;
  handleChatSubmit({ preventDefault: () => {} });
}

/* =========================================================
   SINKRONISASI DATA DARI WEB ANAK (DENGAN PENGAMAN & POLLING)
   ========================================================= */
let lastDataString = ""; // Untuk mengecek apakah data berubah

function applyChildData() {
  let raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  
  // Cek jika data tidak berubah, jangan render ulang (biar gak berat)
  if (raw === lastDataString) return;
  lastDataString = raw;

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error("Data JSON rusak.");
    return;
  }

  // 🛡️ PENGAMAN: Jika data dari anak belum lengkap, buatkan nilai default
  if (!data.privacy) data.privacy = {};
  if (!data.stats) data.stats = { attendance: 0, taskLoad: '-' };
  if (!data.selfReport) data.selfReport = { sleepHours: 0, mood: '-' };
  if (!data.live) data.live = { status: '-', shared: false };
  if (!data.matkul) data.matkul = []; 
  if (!data.activities) data.activities = { praktikum: [], kerjaKelompok: [], organisasi: [], belajarMandiri: [] };

  // 1. Update Stat Cards (Dashboard)
  const setStat = (id, val, note, show) => {
    const el = document.querySelector(`[data-stat="${id}"]`);
    if (!el) return;
    el.querySelector('.value').textContent = show ? val : '—';
    el.querySelector('.note').textContent = show ? note : '🔒 Tidak dibagikan';
    el.querySelector('.value').style.opacity = show ? '1' : '.4';
  };
  setStat('attendance', (data.stats.attendance || 0) + '%', 'Rata-rata 4 minggu terakhir', data.privacy.attendance !== false);
  setStat('taskLoad', data.stats.taskLoad || '-', 'Beban tugas saat ini', data.privacy.taskLoad !== false);
  setStat('sleep', (data.selfReport.sleepHours || 0) + ' jam', 'Jam tidur semalam', data.privacy.sleep !== false);
  setStat('mood', data.selfReport.mood || '-', 'Suasana hati', data.privacy.mood !== false);

  // 2. Update Live Activity
  const isLive = data.privacy.liveActivity !== false && data.live.shared === true;
  const lv = document.getElementById('liveValue');
  const ls = document.getElementById('liveSub');
  const lp = document.getElementById('livePulse');
  const sd = document.getElementById('shareDot');
  const st = document.getElementById('shareText');

  if (lv) lv.textContent = isLive ? data.live.status : 'Tidak dibagikan';
  if (ls) ls.textContent = isLive ? 'Baru saja diperbarui' : 'Anak mematikan berbagi';
  if (lp) lp.className = `live-pulse ${isLive ? 'active' : ''}`;
  if (sd) sd.className = `share-dot ${isLive ? 'active' : ''}`;
  if (st) st.textContent = isLive ? 'Anak sedang membagikan' : 'Anak tidak membagikan';

  // 3. Render Jadwal Matkul
  const gridMatkul = document.getElementById('parentMatkulGrid');
  if (gridMatkul) {
    if (data.privacy.matkul === false) {
      gridMatkul.innerHTML = '<p style="grid-column:1/-1; color:#666;">Anak menyembunyikan jadwal mata kuliah.</p>';
    } else if (data.matkul.length === 0) {
      gridMatkul.innerHTML = '<p style="grid-column:1/-1; color:#666;">Belum ada jadwal diinput.</p>';
    } else {
      const daysOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      const sorted = [...data.matkul].sort((a, b) => daysOrder.indexOf(a.hari) - daysOrder.indexOf(b.hari) || a.mulai.localeCompare(b.mulai));
      gridMatkul.innerHTML = sorted.map(m => `
        <div class="card" style="border-left: 4px solid var(--gold);">
          <h3>${m.nama}</h3>
          <p><strong>${m.hari}</strong>, ${m.mulai} - ${m.selesai}</p>
          <p style="margin-top:0.5rem;">📍 ${m.ruang || '-'} | 👨‍🏫 ${m.dosen || '-'}</p>
        </div>
      `).join('');
    }
  }

  // 4. Render Kegiatan
  const gridKegiatan = document.getElementById('kegiatanGrid');
  if (gridKegiatan) {
    if (data.privacy.activities === false) {
      gridKegiatan.innerHTML = '<p style="grid-column:1/-1; color:#666;">Anak menyembunyikan daftar kegiatannya.</p>';
    } else {
      const cats = [
        { key: 'praktikum', title: 'Praktikum', icon: '🔬' },
        { key: 'kerjaKelompok', title: 'Kerja Kelompok', icon: '👥' },
        { key: 'organisasi', title: 'Organisasi', icon: '🎯' },
        { key: 'belajarMandiri', title: 'Belajar Mandiri', icon: '📖' }
      ];
      gridKegiatan.innerHTML = cats.map(c => {
        const items = data.activities[c.key] || [];
        const list = items.map(i => `<li>${i.title} <br><span style="font-size:0.75rem;color:#666;">${i.day || ''} ${i.time || ''}</span></li>`).join('');
        return `
          <div class="card">
            <h3>${c.icon} ${c.title}</h3>
            <ul style="padding-left:15px; margin-top:10px; font-size:0.9rem;">
              ${list || '<li style="color:#999;">Belum ada kegiatan.</li>'}
            </ul>
          </div>
        `;
      }).join('');
    }
  }
}

/* =========================================================
   INIT & REALTIME LISTENER
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  // Setup Tab Navigation
  document.querySelectorAll('.tabs-inner button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabs-inner button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.panel);
      if (target) target.classList.add('active');
    });
  });

  renderAccordion();
  
  // Panggil data pertama kali
  setTimeout(applyChildData, 300);

  // 1. LISTENER 1: Event Storage (Standard)
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) applyChildData();
  });

  // 2. LISTENER 2: BroadcastChannel (Realtime)
  try {
    const bc = new BroadcastChannel('ftui-parent-companion');
    bc.onmessage = (e) => { 
      if (e.data.type === 'update') applyChildData(); 
    };
  } catch (e) {}

  // 3. LISTENER 3: SISTEM BANDEL (Cek tiap 1 detik)
  // Kalau browser ngeblokir BroadcastChannel, ini tetep bakal jalan!
  setInterval(applyChildData, 1000); 
});