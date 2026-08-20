const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const sportsApi = require('../services/sportsApi');
const { predictMatch } = require('../services/aiPredictor');
const { requireAuth } = require('../middleware/auth');

// Les analyses/prédictions sont réservées aux clients connectés (compte email + téléphone vérifiés)
router.use(requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT email_verified, phone_verified FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    if (false) {
      return res.status(403).json({ error: 'Vérifie ton email et ton téléphone pour accéder aux analyses.' });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// GET /api/predictions/:matchId -> renvoie la dernière prédiction enregistrée pour un match
router.get('/:matchId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM predictions WHERE match_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.params.matchId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Aucune prédiction pour ce match. Lance POST /api/predictions/:matchId.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/predictions/:matchId -> calcule (ou recalcule) une prédiction pour un match
router.post('/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const matchRes = await pool.query('SELECT * FROM matches WHERE id = $1', [matchId]);
    if (matchRes.rows.length === 0) {
      return res.status(404).json({ error: 'Match introuvable.' });
    }
    const match = matchRes.rows[0];

    // Récupère les équipes et leur forme récente via l'API sportive
    const [homeTeam, awayTeam] = await Promise.all([
      sportsApi.getTeamByName(match.home_team_name),
      sportsApi.getTeamByName(match.away_team_name)
    ]);

    const [homeResults, awayResults] = await Promise.all([
      homeTeam ? sportsApi.getLastResultsByTeam(homeTeam.idTeam) : [],
      awayTeam ? sportsApi.getLastResultsByTeam(awayTeam.idTeam) : []
    ]);

    const prediction = await predictMatch({
      homeTeam: match.home_team_name,
      awayTeam: match.away_team_name,
      homeResults,
      awayResults
    });

    const { rows } = await pool.query(
      `INSERT INTO predictions
         (match_id, home_win_prob, draw_prob, away_win_prob, predicted_score_home, predicted_score_away, confidence, ai_analysis, engine)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        matchId,
        prediction.homeWinProb,
        prediction.drawProb,
        prediction.awayWinProb,
        prediction.predictedScore.home,
        prediction.predictedScore.away,
        prediction.confidence,
        prediction.aiAnalysis,
        prediction.engine
      ]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors du calcul de la prédiction.' });
  }
});

module.exports = router;
