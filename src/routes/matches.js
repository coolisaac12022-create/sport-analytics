const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const sportsApi = require('../services/sportsApi');

// GET /api/matches -> liste les matchs enregistrés en base (à venir + passés)
router.get('/', async (req, res) => {
  try {
    const { status, league } = req.query;
    const conditions = [];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }
    if (league) {
      values.push(league);
      conditions.push(`league = $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM matches ${where} ORDER BY match_date ASC LIMIT 100`,
      values
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des matchs.' });
  }
});

// GET /api/matches/:id -> détail d'un match + ses stats
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const matchRes = await pool.query('SELECT * FROM matches WHERE id = $1', [id]);
    if (matchRes.rows.length === 0) {
      return res.status(404).json({ error: 'Match introuvable.' });
    }
    const statsRes = await pool.query('SELECT * FROM match_stats WHERE match_id = $1', [id]);
    res.json({ ...matchRes.rows[0], stats: statsRes.rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/matches/sync -> va chercher les prochains matchs d'une ligue via l'API sportive
// et les enregistre en base. Body attendu : { "leagueId": "4328" }  (id TheSportsDB)
router.post('/sync', async (req, res) => {
  try {
    const { leagueId } = req.body;
    if (!leagueId) return res.status(400).json({ error: 'leagueId est requis.' });

    const events = await sportsApi.getUpcomingMatchesByLeague(leagueId);

    let inserted = 0;
    for (const ev of events) {
      await pool.query(
        `INSERT INTO matches (external_id, league, season, home_team_name, away_team_name, match_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
         ON CONFLICT (external_id) DO NOTHING`,
        [ev.idEvent, ev.strLeague, ev.strSeason, ev.strHomeTeam, ev.strAwayTeam, ev.strTimestamp || ev.dateEvent]
      );
      inserted += 1;
    }

    res.json({ message: `${inserted} match(s) synchronisé(s).` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la synchronisation avec l\'API sportive.' });
  }
});

module.exports = router;
