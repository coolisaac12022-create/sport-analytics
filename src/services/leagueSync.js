const pool = require('../config/db');
const sportsApi = require('./sportsApi');

async function syncLeague(leagueId) {
  const events = await sportsApi.getUpcomingMatchesByLeague(leagueId);

  let inserted = 0;
  for (const ev of events) {
    await pool.query(
      "INSERT INTO matches (external_id, league, season, home_team_name, away_team_name, match_date, status) VALUES ($1, $2, $3, $4, $5, $6, 'scheduled') ON CONFLICT (external_id) DO NOTHING",
      [ev.idEvent, ev.strLeague, ev.strSeason, ev.strHomeTeam, ev.strAwayTeam, ev.strTimestamp || ev.dateEvent]
    );
    inserted += 1;
  }
  return inserted;
}

function getConfiguredLeagueIds() {
  const fromEnv = process.env.AUTO_SYNC_LEAGUE_IDS;
  if (fromEnv) {
    return fromEnv.split(',').map(function(id) { return id.trim(); }).filter(Boolean);
  }
  return ['4328', '4335', '4332', '4331', '4334'];
}

async function autoSyncAllLeagues() {
  const leagueIds = getConfiguredLeagueIds();
  let totalInserted = 0;
  for (const leagueId of leagueIds) {
    try {
      const count = await syncLeague(leagueId);
      totalInserted += count;
      console.log("Synchronisation automatique - ligue " + leagueId + " : " + count + " match(s).");
    } catch (err) {
      console.error("Erreur de synchronisation automatique pour la ligue " + leagueId + " : " + err.message);
    }
  }
  return totalInserted;
}

module.exports = { syncLeague: syncLeague, autoSyncAllLeagues: autoSyncAllLeagues, getConfiguredLeagueIds: getConfiguredLeagueIds };
