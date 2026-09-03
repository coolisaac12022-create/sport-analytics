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

    if (window.GalikaObserver) {
      window.GalikaObserver.send('league_sync', {
        leagueId
      });
    }

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
  if (window.GalikaObserver) {
    window.GalikaObserver.send('match_selected', {
      matchId,
      homeTeam: match.homeTeam || match.home_team || '',
      awayTeam: match.awayTeam || match.away_team || ''
    });
  }

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
    if (window.GalikaObserver) {
      window.GalikaObserver.send('prediction_loaded', {
        homeTeam: match.home_team_name,
        awayTeam: match.away_team_name,
        league: match.league,
        homeWinProb: p.home_win_prob,
        drawProb: p.draw_prob,
        awayWinProb: p.away_win_prob,
        predictedScoreHome: p.predicted_score_home,
        predictedScoreAway: p.predicted_score_away
      });
    }
  } catch (err) {
    predictionContent.innerHTML = `<p class="message error">${err.message}</p>`;
  }
}

function toOdds(prob) {
  if (!prob || prob <= 0) return '-';
  return (1 / prob).toFixed(2);
}

function renderPrediction(match, p) {
  const homePct = Math.round(p.home_win_prob * 100);
  const drawPct = Math.round(p.draw_prob * 100);
  const awayPct = 100 - homePct - drawPct;
  const bttsYesPct = p.btts_yes_prob != null ? Math.round(p.btts_yes_prob * 100) : null;
  const over15Pct = p.over_1_5_prob != null ? Math.round(p.over_1_5_prob * 100) : null;
  const over25Pct = p.over_2_5_prob != null ? Math.round(p.over_2_5_prob * 100) : null;
  const xgHome = p.expected_goals_home != null ? p.expected_goals_home : null;
  const xgAway = p.expected_goals_away != null ? p.expected_goals_away : null;

  predictionContent.innerHTML = `
    <span class="engine-tag">${p.engine === 'ai' ? 'Analyse IA' : 'Moteur statistique'}</span>
    <h3>${match.home_team_name} vs ${match.away_team_name}</h3>

    <div class="match-tabs">
      <button class="tab-btn active" data-tab="analyse">Analyse</button>
      <button class="tab-btn" data-tab="stats">Stats</button>
      <button class="tab-btn" data-tab="compos">Compos</button>
      <button class="tab-btn" data-tab="h2h">H2H</button>
      <button class="tab-btn" data-tab="forme">Forme</button>
    </div>

    <div class="tab-panel" data-panel="analyse">
      <div class="prob-bar">
        <span class="prob-home" style="width:${homePct}%">${homePct}%</span>
        <span class="prob-draw" style="width:${drawPct}%">${drawPct}%</span>
        <span class="prob-away" style="width:${awayPct}%">${awayPct}%</span>
      </div>
      <div class="score-prediction">
        <span>Score probable</span>
        <span class="score">${p.predicted_score_home} - ${p.predicted_score_away}</span>
        <span>Confiance : <strong class="confidence-value">${p.confidence}%</strong></span>
      </div>
      ${p.ai_analysis ? `<div class="analysis-box">${p.ai_analysis}</div>` : ''}
    </div>

    <div class="tab-panel hidden" data-panel="stats">
      <div class="market-row"><span>xG (buts attendus)</span><span><strong>${xgHome ?? '-'} - ${xgAway ?? '-'}</strong></span></div>
      ${bttsYesPct !== null ? `
      <div class="market-row"><span>But/But</span><span><strong>Oui ${bttsYesPct}%</strong> / Non ${100 - bttsYesPct}%</span></div>
      <div class="market-row"><span>+1,5 / -1,5 buts</span><span><strong>${over15Pct}%</strong> / ${100 - over15Pct}%</span></div>
      <div class="market-row"><span>+2,5 / -2,5 buts</span><span><strong>${over25Pct}%</strong> / ${100 - over25Pct}%</span></div>
      ` : ''}
      <div class="market-row"><span>Corners</span><span class="coming-soon">Bientot disponible (API premium)</span></div>
      <div class="market-row"><span>Cartons</span><span class="coming-soon">Bientot disponible (API premium)</span></div>
    </div>

    <div class="tab-panel hidden" data-panel="compos">
      <p class="coming-soon-block">Les compositions officielles seront disponibles prochainement, des qu'un acces API premium sera active.</p>
    </div>

    <div class="tab-panel hidden" data-panel="h2h">
      <p class="coming-soon-block">L'historique des confrontations directes sera disponible prochainement, des qu'un acces API premium sera active.</p>
    </div>

    <div class="tab-panel hidden" data-panel="forme">
      <div class="market-row"><span>${match.home_team_name}</span><span><strong>${p.home_form_points != null ? p.home_form_points + ' pts / ' + p.home_form_played + ' matchs' : 'Donnees limitees'}</strong></span></div>
      <div class="market-row"><span>${match.away_team_name}</span><span><strong>${p.away_form_points != null ? p.away_form_points + ' pts / ' + p.away_form_played + ' matchs' : 'Donnees limitees'}</strong></span></div>
    </div>
  `;

  const tabBtns = predictionContent.querySelectorAll('.tab-btn');
  tabBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      tabBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      predictionContent.querySelectorAll('.tab-panel').forEach(function(panel) {
        panel.classList.toggle('hidden', panel.dataset.panel !== btn.dataset.tab);
      });
    });
  });
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
  const totalOdds = data.totalOdds;

  const renderList = (list) => list.map((p) => {
    const result = p.result || 'pending';
    const badge = result === 'won' ? 'GAGNE' : (result === 'lost' ? 'PERDU' : 'EN COURS');
    return `
    <div class="combo-pick ${result}">
      <span class="combo-teams">${p.home_team_name || p.homeTeam} vs ${p.away_team_name || p.awayTeam}</span>
      <span class="combo-label">${p.pick_label || p.label}</span>
      <span class="combo-conf">${Math.round(p.confidence)}%</span>
      <span class="pick-badge ${result}">${badge}</span>
    </div>
  `;
  }).join('');

  el.innerHTML = `
    ${totalOdds ? `<div class="combo-total-odds">Cote combinee estimee : <strong>${totalOdds}</strong></div>` : ''}
    <h3>Selection 1X2</h3>
    ${combiPicks.length ? renderList(combiPicks) : '<p class="hint">Aucune selection pour aujourd hui.</p>'}
    <h3>Scores exacts pressentis</h3>
    ${scorePicks.length ? renderList(scorePicks) : '<p class="hint">Aucun score exact suffisamment fiable.</p>'}
    ${summary ? `<div class="analysis-box">${summary}</div>` : ''}
  `;
}
