// ============================================================
// public.js — Page d'accueil publique (freemium)
// Affiche un aperçu gratuit verrouillé + navigation auth
// ============================================================

const API = '/api';
const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

renderAuthNav();
loadHeroStats();
loadFreePicks();

// ---------- Navigation compte ----------

function renderAuthNav() {
  const nav = document.getElementById('authNav');
  if (!nav) return;
  if (currentUser) {
    nav.innerHTML = `
      <a href="/dashboard.html" class="btn btn-gold btn-sm">Mon espace</a>
      <a href="#" id="logoutLink" style="color:var(--ink-muted);">Déconnexion</a>
    `;
    document.getElementById('logoutLink').addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    });
  } else {
    nav.innerHTML = `
      <a href="/login.html" style="color:var(--ink-muted);">Connexion</a>
      <a href="/register.html" class="btn btn-gold btn-sm">S'inscrire</a>
    `;
  }
}

// ---------- Stats hero ----------

async function loadHeroStats() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${API}/matches?date=${today}`);
    if (!res.ok) return;
    const matches = await res.json();
    const el = document.getElementById('statMatches');
    if (el) el.textContent = matches.length;
  } catch (_) { /* silencieux sur la page publique */ }
}

// ---------- Aperçu gratuit (picks verrouillés) ----------

async function loadFreePicks() {
  const container = document.getElementById('freePicks');
  if (!container) return;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${API}/matches?date=${today}`);
    if (!res.ok) throw new Error();
    const matches = await res.json();

    if (!matches.length) {
      container.innerHTML = '<p class="hint" style="text-align:center;grid-column:1/-1;">Les analyses du jour sont en préparation. Reviens à 8h. ☕</p>';
      return;
    }

    // On prend les 2 premiers matchs comme aperçu
    container.innerHTML = '';
    matches.slice(0, 2).forEach((m) => container.appendChild(renderLockedPick(m)));
  } catch (_) {
    container.innerHTML = '<p class="hint" style="text-align:center;grid-column:1/-1;">Aperçu indisponible pour le moment.</p>';
  }
}

function renderLockedPick(match) {
  const div = document.createElement('div');
  div.className = 'pick-card locked';
  const date = match.match_date
    ? new Date(match.match_date).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })
    : '';

  div.innerHTML = `
    <div class="pick-body">
      <div class="pick-league">${escapeHtml(match.league || 'Compétition')}</div>
      <div class="pick-teams">${escapeHtml(match.home_team_name)} vs ${escapeHtml(match.away_team_name)}</div>
      <div class="pick-meta">
        <span>🕐 ${date}</span>
        <span>Confiance : <strong>87%</strong></span>
        <span>Score probable : <strong>2 - 1</strong></span>
      </div>
      <div style="margin-top:0.8rem;">
        <span class="confidence-pill">Victoire ${escapeHtml(match.home_team_name)}</span>
      </div>
    </div>
    <div class="pick-lock-overlay">
      <div class="lock-box">
        <div class="lock-icon">🔒</div>
        <p>Analyse complète réservée aux membres</p>
        <a href="/register.html" class="btn btn-gold btn-sm">Débloquer</a>
      </div>
    </div>
  `;
  return div;
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
