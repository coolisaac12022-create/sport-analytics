const pool = require('../config/db');
const sportsApi = require('./sportsApi');
const { predictMatch, generateComboSummary } = require('./aiPredictor');

const TARGET_COMBO_ODDS = 10;
const MAX_COMBO_PICKS = 15;
const MIN_PICK_PROB = 0.40;
const EXACT_SCORE_MIN_CONF = 30;
const EXACT_SCORE_MAX = 5;

function pickBestOption(match, prediction) {
  const homeP = Number(prediction.home_win_prob);
  const drawP = Number(prediction.draw_prob);
  const awayP = Number(prediction.away_win_prob);
  const home1X = homeP + drawP;
  const awayX2 = drawP + awayP;
  const candidates = [
    { label: "Victoire " + match.home_team_name, prob: homeP, key: "home" },
    { label: "Victoire " + match.away_team_name, prob: awayP, key: "away" },
    { label: "Match nul", prob: drawP, key: "draw" },
    { label: "Victoire " + match.home_team_name + " ou Match nul", prob: home1X, key: "home_dc" },
    { label: "Victoire " + match.away_team_name + " ou Match nul", prob: awayX2, key: "away_dc" }
  ];
  let best = candidates[0];
  for (const c of candidates) { if (c.prob > best.prob) best = c; }
  return best;
}

async function ensurePrediction(match) {
  const existing = await pool.query("SELECT * FROM predictions WHERE match_id = $1 ORDER BY created_at DESC LIMIT 1", [match.id]);
  if (existing.rows.length > 0) return existing.rows[0];
  const homeTeam = await sportsApi.getTeamByName(match.home_team_name);
  const awayTeam = await sportsApi.getTeamByName(match.away_team_name);
  const homeResults = homeTeam ? await sportsApi.getLastResultsByTeam(homeTeam.idTeam) : [];
  const awayResults = awayTeam ? await sportsApi.getLastResultsByTeam(awayTeam.idTeam) : [];
  const prediction = await predictMatch({ homeTeam: match.home_team_name, awayTeam: match.away_team_name, homeResults: homeResults, awayResults: awayResults, leagueName: match.league });
  const inserted = await pool.query(
    "INSERT INTO predictions (match_id, home_win_prob, draw_prob, away_win_prob, predicted_score_home, predicted_score_away, confidence, ai_analysis, engine, btts_yes_prob, over_1_5_prob, over_2_5_prob) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
    [match.id, prediction.homeWinProb, prediction.drawProb, prediction.awayWinProb, prediction.predictedScore.home, prediction.predictedScore.away, prediction.confidence, prediction.aiAnalysis, prediction.engine, prediction.bttsYesProb, prediction.over15Prob, prediction.over25Prob]
  );
  return inserted.rows[0];
}

async function buildDailyCombo(dateStr) {
  const matchesRes = await pool.query("SELECT * FROM matches WHERE match_date >= NOW() AND match_date::date <= ($1::date + INTERVAL '4 days') ORDER BY match_date ASC LIMIT 80", [dateStr]);
  const matches = matchesRes.rows;
  if (matches.length === 0) throw new Error("Aucun match trouve pour cette date.");

  const analyzed = [];
  for (const match of matches) {
    try {
      const prediction = await ensurePrediction(match);
      const bestOption = pickBestOption(match, prediction);
      if (bestOption.prob >= MIN_PICK_PROB) analyzed.push({ match: match, prediction: prediction, bestOption: bestOption });
    } catch (err) { console.error("Erreur match " + match.id + " : " + err.message); }
  }
  analyzed.sort(function(a, b) { return b.bestOption.prob - a.bestOption.prob; });

  const comboPicks = [];
  let runningOdds = 1;
  for (const item of analyzed) {
    if (comboPicks.length >= MAX_COMBO_PICKS) break;
    const odds = 1 / item.bestOption.prob;
    comboPicks.push({ matchId: item.match.id, homeTeam: item.match.home_team_name, awayTeam: item.match.away_team_name, label: item.bestOption.label, resultKey: item.bestOption.key, type: "1x2", confidence: Math.round(item.bestOption.prob * 100), odds: Math.round(odds * 100) / 100 });
    runningOdds *= odds;
    if (runningOdds >= TARGET_COMBO_ODDS) break;
  }

  const exactScorePicks = analyzed.filter(function(i) { return Number(i.prediction.confidence) >= EXACT_SCORE_MIN_CONF; }).slice(0, EXACT_SCORE_MAX).map(function(i) {
    return { matchId: i.match.id, homeTeam: i.match.home_team_name, awayTeam: i.match.away_team_name, label: "Score exact " + i.prediction.predicted_score_home + "-" + i.prediction.predicted_score_away, resultKey: "exact", type: "exact_score", confidence: Number(i.prediction.confidence), odds: i.prediction.confidence > 0 ? Math.round((100 / i.prediction.confidence) * 100) / 100 : null };
  });

  const allPicks = comboPicks.concat(exactScorePicks);
  let aiSummary = null, engine = "statistical";
  try { aiSummary = await generateComboSummary(comboPicks); if (aiSummary) engine = "ai"; } catch (err) { console.error(err.message); }

  const comboRes = await pool.query("INSERT INTO daily_combos (combo_date, ai_summary, engine) VALUES ($1,$2,$3) ON CONFLICT (combo_date) DO UPDATE SET ai_summary = EXCLUDED.ai_summary, engine = EXCLUDED.engine RETURNING *", [dateStr, aiSummary, engine]);
  const combo = comboRes.rows[0];
  await pool.query("DELETE FROM combo_selections WHERE combo_id = $1", [combo.id]);
  for (const pick of allPicks) {
    await pool.query("INSERT INTO combo_selections (combo_id, match_id, pick_label, pick_type, confidence, result_key) VALUES ($1,$2,$3,$4,$5,$6)", [combo.id, pick.matchId, pick.label, pick.type, pick.confidence, pick.resultKey]);
  }
  return { combo: combo, picks: allPicks, totalOdds: Math.round(runningOdds * 100) / 100 };
}

function evaluatePick(pick) {
  if (pick.status !== 'finished' || pick.home_score === null || pick.away_score === null) return 'pending';
  const outcome = pick.home_score > pick.away_score ? 'home' : (pick.home_score < pick.away_score ? 'away' : 'draw');
  if (pick.result_key === 'home') return outcome === 'home' ? 'won' : 'lost';
  if (pick.result_key === 'away') return outcome === 'away' ? 'won' : 'lost';
  if (pick.result_key === 'draw') return outcome === 'draw' ? 'won' : 'lost';
  if (pick.result_key === 'home_dc') return (outcome === 'home' || outcome === 'draw') ? 'won' : 'lost';
  if (pick.result_key === 'away_dc') return (outcome === 'away' || outcome === 'draw') ? 'won' : 'lost';
  if (pick.result_key === 'exact') {
    const m = pick.pick_label.match(/(\d+)-(\d+)/);
    if (!m) return 'pending';
    return (pick.home_score === parseInt(m[1], 10) && pick.away_score === parseInt(m[2], 10)) ? 'won' : 'lost';
  }
  return 'pending';
}

async function getCombo(dateStr) {
  const comboRes = await pool.query("SELECT * FROM daily_combos WHERE combo_date = $1", [dateStr]);
  if (comboRes.rows.length === 0) return null;
  const combo = comboRes.rows[0];
  const selectionsRes = await pool.query("SELECT cs.*, m.home_team_name, m.away_team_name, m.match_date, m.status, m.home_score, m.away_score FROM combo_selections cs JOIN matches m ON m.id = cs.match_id WHERE cs.combo_id = $1 ORDER BY cs.pick_type ASC, cs.confidence DESC", [combo.id]);
  const picks = selectionsRes.rows.map(function(row) { row.result = evaluatePick(row); return row; });
  return { combo: combo, picks: picks };
}

module.exports = { buildDailyCombo: buildDailyCombo, getCombo: getCombo };
