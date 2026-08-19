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

async function loadMatches() {
  matchesList.innerHTML = '<p class="hint">Chargement...</p>';
  try {
    const res = await fetch(`${API}/matches`);
    const matches = await res.json();
    if (!matches.length) {
      matchesList.innerHTML = '<p class="hint">Aucun match trouvé.</p>';
      return;
    }
    matchesList.innerHTML = '';
    matches.forEach((m) => matchesList.appendChild(renderMatchCard(m)));
  } catch (err) {
    matchesList.innerHTML = `<p class="message error">Impossible de charger les matchs.</p>`;
  }
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
  `;
}

function showMessage(el, text, type) {
  el.textContent = text;
  el.className = `message ${type}`;
}

loadMatches();
