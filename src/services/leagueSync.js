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
  return ['4328', '4335', '4332', '4331', '4334', '4346', '4351', '4339', '4340', '4344', '4347', '4350', '4354'];
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

async function updateFinishedResults() {
  const pool = require('../config/db');
  const { updateEloAfterMatch } = require('./eloRating');
  const leagueIds = getConfiguredLeagueIds();
  let updated = 0;

  for (const leagueId of leagueIds) {
    try {
      const pastEvents = await sportsApi.getPastMatchesByLeague(leagueId);
      for (const ev of pastEvents) {
        if (ev.intHomeScore === null || ev.intAwayScore === null || ev.intHomeScore === undefined || ev.intAwayScore === undefined) continue;

        const result = await pool.query(
          `UPDATE matches SET status = 'finished', home_score = $1, away_score = $2
           WHERE external_id = $3 AND (status IS DISTINCT FROM 'finished' OR elo_processed IS NOT TRUE)
           RETURNING id, home_team_name, away_team_name, elo_processed`,
          [Number(ev.intHomeScore), Number(ev.intAwayScore), ev.idEvent]
        );

        if (result.rows.length > 0) {
          const match = result.rows[0];
          updated += 1;
          if (!match.elo_processed) {
            await updateEloAfterMatch(match.home_team_name, match.away_team_name, Number(ev.intHomeScore), Number(ev.intAwayScore));
            await pool.query('UPDATE matches SET elo_processed = TRUE WHERE id = $1', [match.id]);
          }
        }
      }
    } catch (err) {
      console.error('Erreur mise a jour resultats ligue ' + leagueId + ' : ' + err.message);
    }
  }
  return updated;
}

module.exports = { syncLeague: syncLeague, autoSyncAllLeagues: autoSyncAllLeagues, getConfiguredLeagueIds: getConfiguredLeagueIds, updateFinishedResults: updateFinishedResults };
