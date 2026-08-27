const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { syncLeague } = require('../services/leagueSync');

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
    res.status(500).json({ error: 'Erreur serveur lors de la recuperation des matchs.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const matchRes = await pool.query('SELECT * FROM matches WHERE id = $1', [id]);
    if (matchRes.rows.length === 0) {
      return res.status(404).json({ error: 'Match introuvable.' });
    }
    const statsRes = await pool.query('SELECT * FROM match_stats WHERE match_id = $1', [id]);
    res.json(Object.assign({}, matchRes.rows[0], { stats: statsRes.rows[0] || null }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/sync', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { leagueId } = req.body;
    if (!leagueId) return res.status(400).json({ error: 'leagueId est requis.' });

    const inserted = await syncLeague(leagueId);
    res.json({ message: inserted + " match(s) synchronise(s)." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la synchronisation avec l API sportive." });
  }
});

module.exports = router;
