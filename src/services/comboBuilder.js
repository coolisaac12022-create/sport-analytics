const pool = require('../config/db');
const sportsApi = require('./sportsApi');
const { predictMatch, generateComboSummary } = require('./aiPredictor');

const COMBO_SIZE = 5;
const EXACT_SCORE_MIN_CONF = 35;
const EXACT_SCORE_MAX = 3;

function pickLabel(match, prediction) {
  const homeP = prediction.home_win_prob;
  const drawP = prediction.draw_prob;
  const awayP = prediction.away_win_prob;
  const best = Math.max(homeP, drawP, awayP);
  if (best === homeP) return "Victoire " + match.home_team_name;
  if (best === awayP) return "Victoire " + match.away_team_name;
  return "Match nul";
}

async function ensurePrediction(match) {
  const existing = await pool.query(
    "SELECT * FROM predictions WHERE match_id = $1 ORDER BY created_at DESC LIMIT 1",
    [match.id]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const homeTeam = await sportsApi.getTeamByName(match.home_team_name);
  const awayTeam = await sportsApi.getTeamByName(match.away_team_name);
  const homeResults = homeTeam ? await sportsApi.getLastResultsByTeam(homeTeam.idTeam) : [];
  const awayResults = awayTeam ? await sportsApi.getLastResultsByTeam(awayTeam.idTeam) : [];

  const prediction = await predictMatch({
    homeTeam: match.home_team_name,
    awayTeam: match.away_team_name,
    homeResults: homeResults,
    awayResults: awayResults
  });

  const inserted = await pool.query(
    "INSERT INTO predictions (match_id, home_win_prob, draw_prob, away_win_prob, predicted_score_home, predicted_score_away, confidence, ai_analysis, engine, btts_yes_prob, over_1_5_prob, over_2_5_prob) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
    [match.id, prediction.homeWinProb, prediction.drawProb, prediction.awayWinProb, prediction.predictedScore.home, prediction.predictedScore.away, prediction.confidence, prediction.aiAnalysis, prediction.engine, prediction.bttsYesProb, prediction.over15Prob, prediction.over25Prob]
  );
  return inserted.rows[0];
}

async function buildDailyCombo(dateStr) {
  const matchesRes = await pool.query(
    "SELECT * FROM matches WHERE match_date::date = $1 ORDER BY match_date ASC LIMIT 30",
    [dateStr]
  );
  const matches = matchesRes.rows;
  if (matches.length === 0) {
    throw new Error("Aucun match trouve pour cette date. Synchronise une ligue au prealable.");
  }

  const analyzed = [];
  for (const match of matches) {
    try {
      const prediction = await ensurePrediction(match);
      analyzed.push({ match: match, prediction: prediction });
    } catch (err) {
      console.error("Prediction impossible pour le match " + match.id + " : " + err.message);
    }
  }

  analyzed.sort(function(a, b) { return b.prediction.confidence - a.prediction.confidence; });

  const comboPicks = analyzed.slice(0, COMBO_SIZE).map(function(item) {
    return {
      matchId: item.match.id,
      homeTeam: item.match.home_team_name,
      awayTeam: item.match.away_team_name,
      label: pickLabel(item.match, item.prediction),
      type: "1x2",
      confidence: Number(item.prediction.confidence)
    };
  });

  const exactScorePicks = analyzed
    .filter(function(item) { return Number(item.prediction.confidence) >= EXACT_SCORE_MIN_CONF; })
    .slice(0, EXACT_SCORE_MAX)
    .map(function(item) {
      return {
        matchId: item.match.id,
        homeTeam: item.match.home_team_name,
        awayTeam: item.match.away_team_name,
        label: "Score exact " + item.prediction.predicted_score_home + "-" + item.prediction.predicted_score_away,
        type: "exact_score",
        confidence: Number(item.prediction.confidence)
      };
    });

  const allPicks = comboPicks.concat(exactScorePicks);
  let aiSummary = null;
  let engine = "statistical";
  try {
    aiSummary = await generateComboSummary(comboPicks);
    if (aiSummary) engine = "ai";
  } catch (err) {
    console.error("Resume IA du combine indisponible : " + err.message);
  }

  const comboRes = await pool.query(
    "INSERT INTO daily_combos (combo_date, ai_summary, engine) VALUES ($1,$2,$3) ON CONFLICT (combo_date) DO UPDATE SET ai_summary = EXCLUDED.ai_summary, engine = EXCLUDED.engine RETURNING *",
    [dateStr, aiSummary, engine]
  );
  const combo = comboRes.rows[0];

  await pool.query("DELETE FROM combo_selections WHERE combo_id = $1", [combo.id]);
  for (const pick of allPicks) {
    await pool.query(
      "INSERT INTO combo_selections (combo_id, match_id, pick_label, pick_type, confidence) VALUES ($1,$2,$3,$4,$5)",
      [combo.id, pick.matchId, pick.label, pick.type, pick.confidence]
    );
  }

  return { combo: combo, picks: allPicks };
}

async function getCombo(dateStr) {
  const comboRes = await pool.query("SELECT * FROM daily_combos WHERE combo_date = $1", [dateStr]);
  if (comboRes.rows.length === 0) return null;
  const combo = comboRes.rows[0];

  const selectionsRes = await pool.query(
    "SELECT cs.*, m.home_team_name, m.away_team_name, m.match_date FROM combo_selections cs JOIN matches m ON m.id = cs.match_id WHERE cs.combo_id = $1 ORDER BY cs.pick_type ASC, cs.confidence DESC",
    [combo.id]
  );

  return { combo: combo, picks: selectionsRes.rows };
}

module.exports = { buildDailyCombo: buildDailyCombo, getCombo: getCombo };
