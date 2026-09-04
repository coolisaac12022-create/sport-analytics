const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { buildDailyCombo, getCombo } = require('../services/comboBuilder');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT email_verified, phone_verified FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(403).json({ error: 'Compte introuvable.' });
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

function todayStr() { return new Date().toISOString().slice(0, 10); }

router.get('/today', async (req, res) => {
  try {
    const tier = req.query.tier || 'safe';
    const date = todayStr();
    let result = await getCombo(date, tier);
    if (!result) result = await buildDailyCombo(date, tier);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Erreur lors de la generation du combine.' });
  }
});

router.get('/:date', async (req, res) => {
  try {
    const tier = req.query.tier || 'safe';
    const result = await getCombo(req.params.date, tier);
    if (!result) return res.status(404).json({ error: 'Aucun combine pour cette date.' });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
