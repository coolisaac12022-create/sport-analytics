// ============================================================
// dashboard.js — Espace abonné (combinés, matchs, historique)
// Combinés affichés en tableau "ticket pro" : League | Match | Choix
// ============================================================

const API = '/api';
const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

// Garde-fou : renvoyer vers login si pas connecté
if (!token || !currentUser) {
  window.location.href = '/login.html';
}

const authHeaders = { Authorization: `Bearer ${token}` };
let currentTier = 'ultra_safe';
let currentCalendarDate = new Date();

init();

function init() {
  renderAuthNav();
  renderTabs();
  loadSubscriptionStatus();
  loadCombo();
  loadMatches();
}

// ---------- Auth nav ----------

function renderAuthNav() {
  const nav = document.getElementById('authNav');
  if (!nav) return;
  nav.innerHTML = `
    <span style="color:var(--ink-muted);font-size:0.85rem;">${escapeHtml(currentUser.name)}</span>
    ${currentUser.role === 'admin' ? '<a href="/admin.html" style="color:var(--gold);font-size:0.85rem;">Admin</a>' : ''}
    <a href="#" id="logoutLink" style="color:var(--ink-muted);font-size:0.85rem;">Déconnexion</a>
  `;
  document.getElementById('logoutLink').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  });
}

// ---------- Statut abonnement ----------

async function loadSubscriptionStatus() {
  const banner = document.getElementById('subscriptionBanner');
  try {
    const res = await fetch(`${API}/payments/my-status`, { headers: authHeaders });
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (data.acces_combines_payants) {
      banner.innerHTML = `
        <div class="card" style="border-color:rgba(46,204,143,0.4);display:flex;align-items:center;gap:0.8rem;">
          <span style="font-size:1.4rem;">✅</span>
          <div>
            <strong>Abonnement actif</strong>
            <p class="hint" style="margin:0;">Accès complet à tous les combinés premium.</p>
          </div>
        </div>`;
    } else {
      banner.innerHTML = `
        <div class="card" style="border-color:rgba(245,185,66,0.4);display:flex;align-items:center;gap:0.8rem;flex-wrap:wrap;">
          <span style="font-size:1.4rem;">💎</span>
          <div style="flex:1;min-width:200px;">
            <strong>Passe à Premium</strong>
            <p class="hint" style="margin:0;">Débloque les 5 niveaux de combinés, scores exacts et analyses complètes.</p>
          </div>
          <a href="/subscribe.html" class="btn btn-gold btn-sm">S'abonner — 2 500 F/mois</a>
        </div>`;
    }
  } catch (_) {
    banner.innerHTML = '';
  }
}

// ---------- Navigation par onglets ----------

function renderTabs() {
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  document.querySelectorAll('#tierTabs .combo-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tierTabs .combo-tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTier = btn.dataset.tier;
      loadCombo();
    });
  });
  document.getElementById('prevDayBtn').addEventListener('click', () => {
    currentCalendarDate.setDate(currentCalendarDate.getDate() - 1);
    loadMatches();
  });
  document.getElementById('nextDayBtn').addEventListener('click', () => {
    currentCalendarDate.setDate(currentCalendarDate.getDate() + 1);
    loadMatches();
  });
}

function switchView(view) {
  ['combos', 'matches', 'history'].forEach((v) => {
    document.getElementById(`view-${v}`).classList.toggle('hidden', v !== view);
  });
  document.querySelectorAll('[data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  if (view === 'history') loadHistory();
}

// ---------- Combinés : tableau ticket pro ----------

async function loadCombo() {
  const el = document.getElementById('comboContent');
  el.innerHTML = '<p class="hint">Chargement du combiné…</p>';
  try {
    const res = await fetch(`${API}/combos/today?tier=${currentTier}`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Impossible de charger le combiné.');
    renderCombo(data);
  } catch (err) {
    el.innerHTML = `<p style="color:var(--red);">${escapeHtml(err.message)}</p>`;
  }
}

// Codes ligues connues (fallback : 3 premières lettres en majuscules)
const LEAGUE_CODES = {
  'premier league': 'ENG', 'championship': 'ENG', 'fa cup': 'ENG',
  'ligue 1': 'FRA', 'ligue 2': 'FRA',
  'bundesliga': 'GER', 'serie a': 'ITA', 'la liga': 'ESP',
  'eredivisie': 'NED', 'primeira liga': 'POR', 'belgian pro league': 'BEL',
  'champions league': 'UEFA', 'europa league': 'UEFA', 'conference league': 'UEFA',
  'major league soccer': 'MLS', 'saudi pro league': 'KSA',
  'super league': 'SUI', 'superliga': 'DEN'
};

function leagueCode(league) {
  if (!league) return '—';
  const key = league.toLowerCase();
  if (LEAGUE_CODES[key]) return LEAGUE_CODES[key];
  return league.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || '—';
}

// Déduit le code de pari (1, 2, X, 1X, X2, 12) depuis le libellé du pick
function extractChoiceCode(pick) {
  const label = String(pick.pick_label || pick.label || '').toLowerCase();
  const home = String(pick.home_team_name || pick.homeTeam || '').toLowerCase();
  const away = String(pick.away_team_name || pick.awayTeam || '').toLowerCase();

  const mentionsHome = home && label.includes(home);
  const mentionsAway = away && label.includes(away);
  const mentionsDraw = /nul|draw|égalité/.test(label);

  if (mentionsHome && mentionsDraw) return '1X';
  if (mentionsAway && mentionsDraw) return 'X2';
  if (mentionsHome) return '1';
  if (mentionsAway) return '2';
  if (mentionsDraw) return 'X';
  if (/1x2|double chance|dc/.test(label)) return '12';
  return '?';
}

function renderCombo(data) {
  const el = document.getElementById('comboContent');
  const picks = data.picks || [];
  const combiPicks = picks.filter((p) => (p.pick_type || p.type) === '1x2');
  const scorePicks = picks.filter((p) => (p.pick_type || p.type) === 'exact_score');
  const summary = data.combo ? data.combo.ai_summary : null;
  const totalOdds = data.totalOdds;

  const renderTable = (list) => `
    <table class="ticket-table">
      <thead>
        <tr><th>League</th><th>Matches</th><th>Choices</th></tr>
      </thead>
      <tbody>
        ${list.map((p) => {
          const result = p.result || 'pending';
          const homeLogo = p.home_team_badge || p.homeBadge
            ? `<img src="${escapeHtml(p.home_team_badge || p.homeBadge)}" alt="" />` : '';
          const awayLogo = p.away_team_badge || p.awayBadge
            ? `<img src="${escapeHtml(p.away_team_badge || p.awayBadge)}" alt="" />` : '';
          const tag = result === 'won' ? '<span class="result-tag won">Gagné</span>'
            : result === 'lost' ? '<span class="result-tag lost">Perdu</span>'
            : '<span class="result-tag pending">En cours</span>';
          return `
          <tr>
            <td class="td-league">${leagueCode(p.league)}</td>
            <td class="td-match">
              <span class="td-team">${homeLogo}${escapeHtml(p.home_team_name || p.homeTeam)}</span>
              <span class="td-vs">VS</span>
              <span class="td-team">${awayLogo}${escapeHtml(p.away_team_name || p.awayTeam)}</span>
            </td>
            <td style="text-align:center;">
              <span class="choice-badge result-${result}">${extractChoiceCode(p)}</span>
              ${tag}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  el.innerHTML = `
    ${totalOdds ? `<div class="card" style="margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center;">
      <span style="color:var(--ink-muted);">Cote combinée estimée</span>
      <strong style="font-family:var(--font-display);font-size:1.5rem;color:var(--gold);">${totalOdds}</strong>
    </div>` : ''}

    <h3 style="margin-top:0;">Sélection 1X2</h3>
    ${combiPicks.length ? renderTable(combiPicks) : '<p class="hint">Aucune sélection pour aujourd\'hui.</p>'}

    ${scorePicks.length ? `
      <h3 style="margin-top:1.4rem;">Scores exacts pressentis</h3>
      <div class="grid-2">
        ${scorePicks.map((p) => `
          <div class="pick-card">
            <div class="pick-teams">${escapeHtml(p.home_team_name || p.homeTeam)} vs ${escapeHtml(p.away_team_name || p.awayTeam)}</div>
            <div class="pick-meta"><span>Score : <strong>${escapeHtml(p.pick_label || p.label)}</strong></span></div>
          </div>`).join('')}
      </div>` : ''}

    ${summary ? `<div class="card" style="margin-top:1rem;color:var(--ink-muted);font-size:0.92rem;">${summary}</div>` : ''}
  `;
}

// ---------- Matchs ----------

async function loadMatches() {
  const label = document.getElementById('calendarDateLabel');
  label.textContent = currentCalendarDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const list = document.getElementById('matchesList');
  list.innerHTML = '<p class="hint">Chargement…</p>';
  try {
    const dateStr = currentCalendarDate.toISOString().slice(0, 10);
    const res = await fetch(`${API}/matches?date=${dateStr}`);
    const matches = await res.json();
    if (!matches.length) {
      list.innerHTML = '<p class="hint">Aucun match ce jour-là.</p>';
      return;
    }
    list.innerHTML = '';
    matches.forEach((m) => list.appendChild(renderMatchCard(m)));
  } catch (_) {
    list.innerHTML = '<p class="hint" style="color:var(--red);">Impossible de charger les matchs.</p>';
  }
}

function renderMatchCard(match) {
  const div = document.createElement('div');
  div.className = 'pick-card';
  const date = match.match_date ? new Date(match.match_date).toLocaleString('fr-FR') : '';
  const homeLogo = match.home_team_badge ? `<img src="${escapeHtml(match.home_team_badge)}" style="width:26px;height:26px;border-radius:50%;background:#fff;padding:2px;" alt="" />` : '';
  const awayLogo = match.away_team_badge ? `<img src="${escapeHtml(match.away_team_badge)}" style="width:26px;height:26px;border-radius:50%;background:#fff;padding:2px;" alt="" />` : '';
  div.innerHTML = `
    <div class="pick-league">${escapeHtml(match.league || '')}</div>
    <div class="pick-teams">${homeLogo} ${escapeHtml(match.home_team_name)} vs ${escapeHtml(match.away_team_name)} ${awayLogo}</div>
    <div class="pick-meta"><span>🕐 ${date}</span></div>
    <button class="btn btn-outline btn-sm" style="margin-top:0.7rem;">Voir l'analyse</button>
  `;
  div.querySelector('button').addEventListener('click', () => loadPrediction(match.id, match));
  return div;
}

// ---------- Prédiction ----------

async function loadPrediction(matchId, match) {
  const section = document.getElementById('predictionSection');
  const content = document.getElementById('predictionContent');
  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth' });
  content.innerHTML = '<p class="hint">Calcul de la prédiction…</p>';

  try {
    let res = await fetch(`${API}/predictions/${matchId}`, { headers: authHeaders });
    if (res.status === 404) {
      res = await fetch(`${API}/predictions/${matchId}`, { method: 'POST', headers: authHeaders });
    }
    const p = await res.json();
    if (!res.ok) throw new Error(p.error || 'Erreur de prédiction');
    renderPrediction(match, p);
  } catch (err) {
    content.innerHTML = `<p style="color:var(--red);">${escapeHtml(err.message)}</p>`;
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

  document.getElementById('predictionContent').innerHTML = `
    <span class="confidence-pill" style="margin-bottom:0.6rem;">${p.engine === 'ai' ? '🤖 Analyse IA' : '📊 Moteur statistique'}</span>
    <h3 style="margin-top:0.6rem;">${escapeHtml(match.home_team_name)} vs ${escapeHtml(match.away_team_name)}</h3>

    <div style="display:flex;height:36px;border-radius:8px;overflow:hidden;margin:1rem 0;font-weight:700;font-size:0.9rem;">
      <span style="width:${homePct}%;background:var(--green);display:flex;align-items:center;justify-content:center;color:#04140c;">${homePct}%</span>
      <span style="width:${drawPct}%;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#04101f;">${drawPct}%</span>
      <span style="width:${awayPct}%;background:var(--red);display:flex;align-items:center;justify-content:center;color:#1f0609;">${awayPct}%</span>
    </div>

    <div class="pick-meta" style="margin-bottom:0.8rem;">
      <span>Cote 1 : <strong>${toOdds(p.home_win_prob)}</strong></span>
      <span>Cote X : <strong>${toOdds(p.draw_prob)}</strong></span>
      <span>Cote 2 : <strong>${toOdds(p.away_win_prob)}</strong></span>
    </div>

    <p>Score probable : <strong style="color:var(--gold);">${p.predicted_score_home} - ${p.predicted_score_away}</strong> (confiance ${p.confidence}%)</p>

    ${p.ai_analysis ? `<div class="card" style="margin-top:0.8rem;color:var(--ink-muted);font-size:0.92rem;">${p.ai_analysis}</div>` : ''}

    ${bttsYesPct !== null ? `
    <div class="card" style="margin-top:0.8rem;">
      <div class="pick-meta" style="justify-content:space-between;">
        <span>But/But : <strong>${bttsYesPct}% oui</strong></span>
        <span>+1,5 buts : <strong>${Math.round(p.over_1_5_prob * 100)}%</strong></span>
        <span>+2,5 buts : <strong>${Math.round(p.over_2_5_prob * 100)}%</strong></span>
      </div>
    </div>` : ''}
  `;
}

// ---------- Historique ----------

async function loadHistory() {
  const el = document.getElementById('historyContent');
  el.innerHTML = '<p class="hint">Chargement…</p>';
  try {
    const res = await fetch(`${API}/combos/history`, { headers: authHeaders });
    if (!res.ok) throw new Error();
    const combos = await res.json();
    if (!combos.length) {
      el.innerHTML = '<p class="hint">Pas encore d\'historique.</p>';
      return;
    }
    el.innerHTML = combos.map((c) => `
      <div class="pick-card" style="margin-bottom:0.7rem;">
        <div class="pick-meta" style="justify-content:space-between;">
          <strong>${new Date(c.combo_date).toLocaleDateString('fr-FR')}</strong>
          <span class="confidence-pill">${escapeHtml(c.tier || 'safe')}</span>
        </div>
      </div>
    `).join('');
  } catch (_) {
    el.innerHTML = '<p class="hint">Historique indisponible.</p>';
  }
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
