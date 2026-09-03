const pool = require('../config/db');

const K_FACTOR = 30;
const HOME_ELO_BONUS = 60;
const DEFAULT_ELO = 1500;

async function getTeamElo(teamName) {
  const existing = await pool.query('SELECT elo_rating FROM teams WHERE name = $1', [teamName]);
  if (existing.rows.length > 0) return Number(existing.rows[0].elo_rating);

  await pool.query(
    'INSERT INTO teams (name, elo_rating) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
    [teamName, DEFAULT_ELO]
  );
  return DEFAULT_ELO;
}

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

async function updateEloAfterMatch(homeTeamName, awayTeamName, homeScore, awayScore) {
  const homeElo = await getTeamElo(homeTeamName);
  const awayElo = await getTeamElo(awayTeamName);

  const homeEloAdjusted = homeElo + HOME_ELO_BONUS;
  const expectedHome = expectedScore(homeEloAdjusted, awayElo);
  const expectedAway = 1 - expectedHome;

  let actualHome;
  if (homeScore > awayScore) actualHome = 1;
  else if (homeScore < awayScore) actualHome = 0;
  else actualHome = 0.5;
  const actualAway = 1 - actualHome;

  const newHomeElo = homeElo + K_FACTOR * (actualHome - expectedHome);
  const newAwayElo = awayElo + K_FACTOR * (actualAway - expectedAway);

  await pool.query('UPDATE teams SET elo_rating = $1 WHERE name = $2', [Math.round(newHomeElo), homeTeamName]);
  await pool.query('UPDATE teams SET elo_rating = $1 WHERE name = $2', [Math.round(newAwayElo), awayTeamName]);

  return { homeElo: Math.round(newHomeElo), awayElo: Math.round(newAwayElo) };
}

function eloAdjustmentFactor(teamElo, opponentElo) {
  const diff = teamElo - opponentElo;
  const factor = 1 + (diff / 800);
  return Math.max(0.82, Math.min(1.18, factor));
}

module.exports = {
  getTeamElo: getTeamElo,
  updateEloAfterMatch: updateEloAfterMatch,
  eloAdjustmentFactor: eloAdjustmentFactor
};
