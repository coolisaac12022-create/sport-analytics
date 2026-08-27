const fetch = require('node-fetch');

function computeForm(results, teamName) {
  results = results || [];
  let points = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let played = 0;

  results.slice(0, 5).forEach(function(r) {
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
    played: played,
    points: points,
    avgGoalsFor: played ? goalsFor / played : 0,
    avgGoalsAgainst: played ? goalsAgainst / played : 0
  };
}

const LEAGUE_AVG_GOALS = 1.35;
const HOME_ADVANTAGE = 1.30;
const AWAY_DISADVANTAGE = 0.88;
const SHRINKAGE_MATCHES = 4;
const MAX_GOALS = 6;

function factorial(n) {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function poissonProbability(lambda, k) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function shrinkTowardsAverage(average, played) {
  return (average * played + LEAGUE_AVG_GOALS * SHRINKAGE_MATCHES) / (played + SHRINKAGE_MATCHES);
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function statisticalPrediction(homeForm, awayForm) {
  const homeAttackAvg = shrinkTowardsAverage(homeForm.avgGoalsFor, homeForm.played);
  const homeDefenseAvg = shrinkTowardsAverage(homeForm.avgGoalsAgainst, homeForm.played);
  const awayAttackAvg = shrinkTowardsAverage(awayForm.avgGoalsFor, awayForm.played);
  const awayDefenseAvg = shrinkTowardsAverage(awayForm.avgGoalsAgainst, awayForm.played);

  const homeAttackStrength = homeAttackAvg / LEAGUE_AVG_GOALS;
  const homeDefenseWeakness = homeDefenseAvg / LEAGUE_AVG_GOALS;
  const awayAttackStrength = awayAttackAvg / LEAGUE_AVG_GOALS;
  const awayDefenseWeakness = awayDefenseAvg / LEAGUE_AVG_GOALS;

  const lambdaHome = LEAGUE_AVG_GOALS * homeAttackStrength * awayDefenseWeakness * HOME_ADVANTAGE;
  const lambdaAway = LEAGUE_AVG_GOALS * awayAttackStrength * homeDefenseWeakness * AWAY_DISADVANTAGE;

  let homeWinProb = 0;
  let drawProb = 0;
  let awayWinProb = 0;
  let bestScore = { home: 0, away: 0 };
  let bestScoreProb = 0;

  for (let h = 0; h <= MAX_GOALS; h++) {
    const pHome = poissonProbability(lambdaHome, h);
    for (let a = 0; a <= MAX_GOALS; a++) {
      const pAway = poissonProbability(lambdaAway, a);
      const cellProb = pHome * pAway;

      if (h > a) homeWinProb += cellProb;
      else if (h === a) drawProb += cellProb;
      else awayWinProb += cellProb;

      if (cellProb > bestScoreProb) {
        bestScoreProb = cellProb;
        bestScore = { home: h, away: a };
      }
    }
  }

  const total = homeWinProb + drawProb + awayWinProb || 1;
  homeWinProb = homeWinProb / total;
  drawProb = drawProb / total;
  awayWinProb = awayWinProb / total;

  const confidence = Math.round(Math.max(homeWinProb, drawProb, awayWinProb) * 100);

  return {
    homeWinProb: round(homeWinProb),
    drawProb: round(drawProb),
    awayWinProb: round(awayWinProb),
    predictedScore: bestScore,
    confidence: confidence,
    expectedGoals: { home: round(lambdaHome), away: round(lambdaAway) }
  };
}

async function generateAiAnalysis(params) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const homeTeam = params.homeTeam, awayTeam = params.awayTeam, homeForm = params.homeForm, awayForm = params.awayForm, stats = params.stats;

  const prompt = "Tu es un analyste sportif expert utilisant un modele statistique de Poisson (methode standard en analyse de football). Redige une analyse courte (4 a 6 phrases, en francais) du match suivant, basee uniquement sur les statistiques fournies. Reste factuel et nuance, precise que ce sont des tendances statistiques et non une garantie.\n\n" +
    "Equipe a domicile : " + homeTeam + " - forme recente : " + homeForm.points + " pts sur " + homeForm.played + " matchs, " + homeForm.avgGoalsFor.toFixed(1) + " buts marques / match, " + homeForm.avgGoalsAgainst.toFixed(1) + " buts encaisses / match.\n" +
    "Equipe a l exterieur : " + awayTeam + " - forme recente : " + awayForm.points + " pts sur " + awayForm.played + " matchs, " + awayForm.avgGoalsFor.toFixed(1) + " buts marques / match, " + awayForm.avgGoalsAgainst.toFixed(1) + " buts encaisses / match.\n" +
    "Buts attendus (xG) calcules par le modele : " + homeTeam + " " + stats.expectedGoals.home.toFixed(2) + ", " + awayTeam + " " + stats.expectedGoals.away.toFixed(2) + ".\n" +
    "Probabilites calculees : domicile " + (stats.homeWinProb * 100).toFixed(0) + "%, nul " + (stats.drawProb * 100).toFixed(0) + "%, exterieur " + (stats.awayWinProb * 100).toFixed(0) + "%.";

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
  const textBlock = data.content.find(function(b) { return b.type === 'text'; });
  return textBlock ? textBlock.text : null;
}

async function predictMatch(params) {
  const homeTeam = params.homeTeam, awayTeam = params.awayTeam, homeResults = params.homeResults, awayResults = params.awayResults;
  const homeForm = computeForm(homeResults, homeTeam);
  const awayForm = computeForm(awayResults, awayTeam);
  const stats = statisticalPrediction(homeForm, awayForm);

  let aiAnalysis = null;
  let engine = 'statistical';

  try {
    aiAnalysis = await generateAiAnalysis({ homeTeam: homeTeam, awayTeam: awayTeam, homeForm: homeForm, awayForm: awayForm, stats: stats });
    if (aiAnalysis) engine = 'ai';
  } catch (err) {
    console.error('Analyse IA indisponible, repli sur le mode statistique :', err.message);
  }

  return Object.assign({}, stats, { homeForm: homeForm, awayForm: awayForm, aiAnalysis: aiAnalysis, engine: engine });
}

async function generateComboSummary(picks) {
  picks = picks || [];
  if (!process.env.ANTHROPIC_API_KEY || picks.length === 0) return null;

  const list = picks.map(function(p, i) {
    return (i + 1) + ". " + p.homeTeam + " vs " + p.awayTeam + " - pronostic : " + p.label + " (confiance " + p.confidence + "%)";
  }).join("\n");
  const prompt = "Tu es un analyste sportif. Voici une selection de matchs pour un combine du jour :\n" + list + "\n\nRedige un court resume (4 a 6 phrases, en francais) expliquant pourquoi cette selection est jugee globalement fiable, en restant factuel et nuance. Rappelle que combiner plusieurs matchs augmente le risque global meme si chaque match pris seul est probable, et que ce sont des tendances statistiques, jamais une garantie.";

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
    console.error('Erreur API Claude (combine) :', res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const textBlock = data.content.find(function(b) { return b.type === 'text'; });
  return textBlock ? textBlock.text : null;
}

module.exports = { predictMatch: predictMatch, computeForm: computeForm, statisticalPrediction: statisticalPrediction, generateComboSummary: generateComboSummary };
