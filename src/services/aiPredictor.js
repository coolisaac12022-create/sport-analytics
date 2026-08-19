// Moteur de prédiction des matchs.
//
// Deux modes :
// 1) Mode statistique (par défaut, aucune clé requise) : calcule des probabilités
//    à partir de la forme récente (5 derniers matchs), des buts marqués/encaissés
//    et de l'avantage du terrain.
// 2) Mode IA (si ANTHROPIC_API_KEY est défini) : envoie les statistiques calculées
//    à l'API Claude pour obtenir une analyse en langage naturel en plus des probabilités.

const fetch = require('node-fetch');

// --- 1. Calcul statistique de la forme d'une équipe à partir de ses derniers résultats ---
function computeForm(results = [], teamName) {
  let points = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let played = 0;

  results.slice(0, 5).forEach((r) => {
    const isHome = r.strHomeTeam === teamName;
    const gf = Number(isHome ? r.intHomeScore : r.intAwayScore) || 0;
    const ga = Number(isHome ? r.intAwayScore : r.intHomeScore) || 0;
    goalsFor += gf;
    goalsAgainst += ga;
    played += 1;
    if (gf > ga) points += 3;
    else if (gf === ga) points += 1;
  });

  return {
    played,
    points,
    avgGoalsFor: played ? goalsFor / played : 0,
    avgGoalsAgainst: played ? goalsAgainst / played : 0
  };
}

// --- 2. Modèle statistique simple (type Poisson simplifié) pour estimer les probabilités ---
function statisticalPrediction(homeForm, awayForm) {
  const HOME_ADVANTAGE = 1.15;

  const homeAttack = (homeForm.avgGoalsFor || 1) * HOME_ADVANTAGE;
  const awayAttack = awayForm.avgGoalsFor || 1;
  const homeDefenseWeak = homeForm.avgGoalsAgainst || 1;
  const awayDefenseWeak = awayForm.avgGoalsAgainst || 1;

  // Force offensive relative pondérée par la faiblesse défensive adverse
  const homeStrength = homeAttack * awayDefenseWeak;
  const awayStrength = awayAttack * homeDefenseWeak;
  const total = homeStrength + awayStrength || 1;

  let homeWinProb = homeStrength / total;
  let awayWinProb = awayStrength / total;

  // On réserve une part réaliste au match nul (15 à 30 % selon l'écart de force)
  const gap = Math.abs(homeWinProb - awayWinProb);
  const drawProb = Math.max(0.15, 0.30 - gap * 0.3);

  const remaining = 1 - drawProb;
  homeWinProb = homeWinProb * remaining;
  awayWinProb = awayWinProb * remaining;

  const predictedHomeGoals = Math.round(homeAttack);
  const predictedAwayGoals = Math.round(awayAttack);

  const confidence = Math.round(Math.max(homeWinProb, drawProb, awayWinProb) * 100);

  return {
    homeWinProb: round(homeWinProb),
    drawProb: round(drawProb),
    awayWinProb: round(awayWinProb),
    predictedScore: { home: predictedHomeGoals, away: predictedAwayGoals },
    confidence
  };
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

// --- 3. Analyse en langage naturel via l'API Claude (optionnelle) ---
async function generateAiAnalysis({ homeTeam, awayTeam, homeForm, awayForm, stats }) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const prompt = `Tu es un analyste sportif. Rédige une analyse courte (4 à 6 phrases, en français) du match suivant, basée uniquement sur les statistiques fournies. Reste factuel et nuancé, précise que ce sont des tendances statistiques et non une garantie.

Équipe à domicile : ${homeTeam} — forme récente : ${homeForm.points} pts sur ${homeForm.played} matchs, ${homeForm.avgGoalsFor.toFixed(1)} buts marqués / match, ${homeForm.avgGoalsAgainst.toFixed(1)} buts encaissés / match.
Équipe à l'extérieur : ${awayTeam} — forme récente : ${awayForm.points} pts sur ${awayForm.played} matchs, ${awayForm.avgGoalsFor.toFixed(1)} buts marqués / match, ${awayForm.avgGoalsAgainst.toFixed(1)} buts encaissés / match.
Probabilités calculées : domicile ${(stats.homeWinProb * 100).toFixed(0)}%, nul ${(stats.drawProb * 100).toFixed(0)}%, extérieur ${(stats.awayWinProb * 100).toFixed(0)}%.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    console.error('Erreur API Claude :', res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const textBlock = data.content.find((b) => b.type === 'text');
  return textBlock ? textBlock.text : null;
}

// --- 4. Point d'entrée unique utilisé par les routes ---
async function predictMatch({ homeTeam, awayTeam, homeResults, awayResults }) {
  const homeForm = computeForm(homeResults, homeTeam);
  const awayForm = computeForm(awayResults, awayTeam);
  const stats = statisticalPrediction(homeForm, awayForm);

  let aiAnalysis = null;
  let engine = 'statistical';

  try {
    aiAnalysis = await generateAiAnalysis({ homeTeam, awayTeam, homeForm, awayForm, stats });
    if (aiAnalysis) engine = 'ai';
  } catch (err) {
    console.error('Analyse IA indisponible, repli sur le mode statistique :', err.message);
  }

  return { ...stats, homeForm, awayForm, aiAnalysis, engine };
}

module.exports = { predictMatch, computeForm, statisticalPrediction };
