// Réglages, navigation et petites touches d'UI — n'interfère pas avec app.js

(function () {
  const root = document.documentElement;
  const drawer = document.getElementById('settingsDrawer');
  const overlay = document.getElementById('drawerOverlay');
  const openBtns = [document.getElementById('settingsOpenBtn'), document.getElementById('settingsOpenBtnMobile')];
  const closeBtn = document.getElementById('settingsCloseBtn');

  function openDrawer() {
    drawer.classList.add('open');
    overlay.classList.add('open');
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
  }

  openBtns.forEach((btn) => btn && btn.addEventListener('click', openDrawer));
  closeBtn.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  // ---- thème ----
  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('theme') || 'dark';
  root.setAttribute('data-theme', savedTheme);
  themeToggle.classList.toggle('on', savedTheme === 'dark');

  themeToggle.addEventListener('click', () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    themeToggle.classList.toggle('on', next === 'dark');
  });

  // ---- notifications (préférence locale) ----
  const notifToggle = document.getElementById('notifToggle');
  const notifOn = localStorage.getItem('notifCombo') === 'on';
  notifToggle.classList.toggle('on', notifOn);
  notifToggle.addEventListener('click', () => {
    const next = !notifToggle.classList.contains('on');
    notifToggle.classList.toggle('on', next);
    localStorage.setItem('notifCombo', next ? 'on' : 'off');
  });

  // ---- compte ----
  const accountInfo = document.getElementById('settingsAccountInfo');
  const logoutBtn = document.getElementById('settingsLogoutBtn');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (user) {
    accountInfo.textContent = `Connecté en tant que ${user.name}${user.role === 'admin' ? ' (admin)' : ''}`;
    logoutBtn.classList.remove('hidden');
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    });
  }

  // ---- vider le cache local ----
  document.getElementById('clearCacheBtn').addEventListener('click', () => {
    const keep = { theme: localStorage.getItem('theme') };
    localStorage.clear();
    if (keep.theme) localStorage.setItem('theme', keep.theme);
    window.location.reload();
  });

  // ---- navigation (scroll vers une section + état actif) ----
  document.querySelectorAll('[data-scroll]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.scroll);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (btn.closest('.bottom-nav')) {
        document.querySelectorAll('.bottom-nav button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      }
      if (btn.closest('.desktop-nav')) {
        document.querySelectorAll('.desktop-nav button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      }
    });
  });

  // ---- bandeau du jour ----
  const heroDate = document.getElementById('heroDate');
  if (heroDate) {
    heroDate.textContent = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  }

  const heroFigure = document.getElementById('heroFigure');
  const matchesList = document.getElementById('matchesList');
  if (heroFigure && matchesList) {
    const updateCount = () => {
      const count = matchesList.querySelectorAll('.match-item').length;
      heroFigure.innerHTML = `${count}<span>match${count > 1 ? 's' : ''} chargé${count > 1 ? 's' : ''} aujourd'hui</span>`;
    };
    updateCount();
    new MutationObserver(updateCount).observe(matchesList, { childList: true });
  }
})();
