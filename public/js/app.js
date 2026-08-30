const API = '/api';
const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

renderAuthNav();

function renderAuthNav() {
  const nav = document.getElementById('authNav');
  if (currentUser) {
    nav.innerHTML = `
      <span>Bonjour ${escapeHtml(currentUser.name)}</span>
      ${currentUser.role === 'admin' ? '<a href="/admin.html">Espace admin</a>' : ''}
      <a href="#" id="logoutLink">Déconnexion</a>
    `;
    document.getElementById('logoutLink').addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    });
  } else {
    nav.innerHTML = `<a href="/login.html">Connexion</a> <a href="/register.html">Inscription</a>`;
  }
}

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const syncBtn = document.getElementById('syncBtn');
const leagueIdInput = document.getElementById('leagueIdInput');
const syncMessage = document.getElementById('syncMessage');
const matchesList = document.getElementById('matchesList');
const predictionSection = document.getElementById('predictionSection');
const predictionContent = document.getElementById('predictionContent');

syncBtn.addEventListener('click', async () => {
  const leagueId = leagueIdInput.value.trim();
  if (!leagueId) {
    showMessage(syncMessage, 'Merci d\'entrer un identifiant de ligue.', 'error');
    return;
  }
  syncBtn.disabled = true;
  showMessage(syncMessage, 'Synchronisation en cours...', '');
  try {
    const res = await fetch(`${API}/matches/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
    showMessage(syncMessage, data.message, 'success');
    loadMatches();
  } catch (err) {
    showMessage(syncMessage, err.message, 'error');
  } finally {
    syncBtn.disabled = false;
  }
});

let currentCalendarDate = new Date();

function formatDateForApi(d) {
  return d.toISOString().slice(0, 10);
}

function formatDateForLabel(d) {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

async function loadMatches() {
  const label = document.getElementById('calendarDateLabel');
  if (label) label.textContent = formatDateForLabel(currentCalendarDate);

  matchesList.innerHTML = '<p class="hint">Chargement...</p>';
  try {
    const dateStr = formatDateForApi(currentCalendarDate);
    const res = await fetch(`${API}/matches?date=${dateStr}`);
    const matches = await res.json();
    if (!matches.length) {
      matchesList.innerHTML = '<p class="hint">Aucun match ce jour-là.</p>';
      return;
    }
    matchesList.innerHTML = '';
    matches.forEach((m) => matchesList.appendChild(renderMatchCard(m)));
  } catch (err) {
    matchesList.innerHTML = `<p class="message error">Impossible de charger les matchs.</p>`;
  }
}

const prevDayBtn = document.getElementById('prevDayBtn');
const nextDayBtn = document.getElementById('nextDayBtn');
if (prevDayBtn) {
  prevDayBtn.addEventListener('click', () => {
    currentCalendarDate.setDate(currentCalendarDate.getDate() - 1);
    loadMatches();
  });
}
if (nextDayBtn) {
  nextDayBtn.addEventListener('click', () => {
    currentCalendarDate.setDate(currentCalendarDate.getDate() + 1);
    loadMatches();
  });
}

function renderMatchCard(match) {
  const div = document.createElement('div');
  div.className = 'match-item';
  const date = match.match_date ? new Date(match.match_date).toLocaleString('fr-FR') : 'Date inconnue';
  div.innerHTML = `
    <div class="teams">${match.home_team_name} vs ${match.away_team_name}</div>
    <div class="date">${date} — ${match.league || ''}</div>
    <button data-id="${match.id}">Voir l'analyse</button>
  `;
  div.querySelector('button').addEventListener('click', () => loadPrediction(match.id, match));
  return div;
}

async function loadPrediction(matchId, match) {
  predictionSection.classList.remove('hidden');
  predictionSection.scrollIntoView({ behavior: 'smooth' });

  if (!token) {
    predictionContent.innerHTML = `<p class="message error">Connecte-toi pour accéder aux analyses de matchs. <a href="/login.html">Se connecter</a></p>`;
    return;
  }

  predictionContent.innerHTML = '<p class="hint">Calcul de la prédiction en cours...</p>';
  const authHeaders = { Authorization: `Bearer ${token}` };

  try {
    let res = await fetch(`${API}/predictions/${matchId}`, { headers: authHeaders });
    if (res.status === 404) {
      res = await fetch(`${API}/predictions/${matchId}`, { method: 'POST', headers: authHeaders });
    }
    const p = await res.json();
    if (!res.ok) throw new Error(p.error || 'Erreur de prédiction');
    renderPrediction(match, p);
  } catch (err) {
    predictionContent.innerHTML = `<p class="message error">${err.message}</p>`;
  }
}

function renderPrediction(match, p) {
  const homePct = Math.round(p.home_win_prob * 100);
  const drawPct = Math.round(p.draw_prob * 100);
  const awayPct = 100 - homePct - drawPct;

  const bttsYesPct = p.btts_yes_prob != null ? Math.round(p.btts_yes_prob * 100) : null;
  const over15Pct = p.over_1_5_prob != null ? Math.round(p.over_1_5_prob * 100) : null;
  const over25Pct = p.over_2_5_prob != null ? Math.round(p.over_2_5_prob * 100) : null;

  predictionContent.innerHTML = `
    <span class="engine-tag">${p.engine === 'ai' ? 'Analyse IA' : 'Moteur statistique'}</span>
    <h3>${match.home_team_name} vs ${match.away_team_name}</h3>
    <div class="prob-bar">
      <span class="prob-home" style="width:${homePct}%">${homePct}%</span>
      <span class="prob-draw" style="width:${drawPct}%">${drawPct}%</span>
      <span class="prob-away" style="width:${awayPct}%">${awayPct}%</span>
    </div>
    <p>Score probable : <strong>${p.predicted_score_home} - ${p.predicted_score_away}</strong> (confiance ${p.confidence}%)</p>
    ${p.ai_analysis ? `<div class="analysis-box">${p.ai_analysis}</div>` : ''}
    ${bttsYesPct !== null ? `
      <button id="toggleMarketsBtn" class="secondary small">Voir plus de statistiques</button>
      <div id="extraMarkets" class="hidden">
        <div class="market-row">
          <span>But/But (les 2 equipes marquent)</span>
          <span><strong>Oui ${bttsYesPct}%</strong> / Non ${100 - bttsYesPct}%</span>
        </div>
        <div class="market-row">
          <span>+1,5 / -1,5 buts</span>
          <span><strong>+1,5 : ${over15Pct}%</strong> / -1,5 : ${100 - over15Pct}%</span>
        </div>
        <div class="market-row">
          <span>+2,5 / -2,5 buts</span>
          <span><strong>+2,5 : ${over25Pct}%</strong> / -2,5 : ${100 - over25Pct}%</span>
        </div>
      </div>
    ` : ''}
  `;

  const toggleBtn = document.getElementById('toggleMarketsBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      document.getElementById('extraMarkets').classList.toggle('hidden');
    });
  }
}

function showMessage(el, text, type) {
  el.textContent = text;
  el.className = `message ${type}`;
}

loadMatches();

loadCombo();

async function loadCombo() {
  const el = document.getElementById('comboContent');
  if (!el) return;
  if (!token) {
    el.innerHTML = '<p class="hint">Connecte-toi pour voir le combine du jour. <a href="/login.html">Se connecter</a></p>';
    return;
  }
  el.innerHTML = '<p class="hint">Chargement du combine du jour...</p>';
  try {
    const res = await fetch(`${API}/combos/today`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Impossible de charger le combine.');
    renderCombo(data);
  } catch (err) {
    el.innerHTML = `<p class="message error">${err.message}</p>`;
  }
}

function renderCombo(data) {
  const el = document.getElementById('comboContent');
  const picks = data.picks || [];
  const combiPicks = picks.filter((p) => (p.pick_type || p.type) === '1x2');
  const scorePicks = picks.filter((p) => (p.pick_type || p.type) === 'exact_score');
  const summary = data.combo ? data.combo.ai_summary : null;

  const renderList = (list) => list.map((p) => `
    <div class="combo-pick">
      <span class="combo-teams">${p.home_team_name || p.homeTeam} vs ${p.away_team_name || p.awayTeam}</span>
      <span class="combo-label">${p.pick_label || p.label}</span>
      <span class="combo-conf">${Math.round(p.confidence)}%</span>
    </div>
  `).join('');

  el.innerHTML = `
    <h3>Selection 1X2</h3>
    ${combiPicks.length ? renderList(combiPicks) : '<p class="hint">Aucune selection pour aujourd hui.</p>'}
    <h3>Scores exacts pressentis</h3>
    ${scorePicks.length ? renderList(scorePicks) : '<p class="hint">Aucun score exact suffisamment fiable aujourd hui.</p>'}
    ${summary ? `<div class="analysis-box">${summary}</div>` : ''}
  `;
}
