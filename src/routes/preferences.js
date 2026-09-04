const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

function cleanArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(x => typeof x === 'string')
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 30);
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT country_code, country_name, favorite_team_id,
       favorite_team_name, favorite_competitions,
       favorite_analysis_types, language, notifications_enabled,
       personalization_enabled, privacy_analytics_enabled,
       onboarding_completed
       FROM user_preferences WHERE user_id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.json({
        country_code: null,
        country_name: null,
        favorite_team_id: null,
        favorite_team_name: null,
        favorite_competitions: [],
        favorite_analysis_types: [],
        language: 'fr',
        notifications_enabled: true,
        personalization_enabled: true,
        privacy_analytics_enabled: true,
        onboarding_completed: false
      });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Erreur récupération préférences :', err);
    res.status(500).json({ error: 'Impossible de récupérer les préférences.' });
  }
});

router.put('/', requireAuth, async (req, res) => {
  try {
    const {
      country_code,
      country_name,
      favorite_team_id,
      favorite_team_name,
      favorite_competitions,
      favorite_analysis_types,
      language,
      notifications_enabled,
      personalization_enabled,
      privacy_analytics_enabled,
      onboarding_completed
    } = req.body;

    const competitions = cleanArray(favorite_competitions);
    const analysisTypes = cleanArray(favorite_analysis_types);

    let teamId = null;
    if (favorite_team_id !== null &&
        favorite_team_id !== undefined &&
        favorite_team_id !== '') {
      const parsed = Number(favorite_team_id);
      if (Number.isInteger(parsed) && parsed > 0) teamId = parsed;
    }

    const { rows } = await pool.query(
      `INSERT INTO user_preferences (
        user_id, country_code, country_name, favorite_team_id,
        favorite_team_name, favorite_competitions,
        favorite_analysis_types, language, notifications_enabled,
        personalization_enabled, privacy_analytics_enabled,
        onboarding_completed, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        country_code = EXCLUDED.country_code,
        country_name = EXCLUDED.country_name,
        favorite_team_id = EXCLUDED.favorite_team_id,
        favorite_team_name = EXCLUDED.favorite_team_name,
        favorite_competitions = EXCLUDED.favorite_competitions,
        favorite_analysis_types = EXCLUDED.favorite_analysis_types,
        language = EXCLUDED.language,
        notifications_enabled = EXCLUDED.notifications_enabled,
        personalization_enabled = EXCLUDED.personalization_enabled,
        privacy_analytics_enabled = EXCLUDED.privacy_analytics_enabled,
        onboarding_completed = EXCLUDED.onboarding_completed,
        updated_at = NOW()
      RETURNING *`,
      [
        req.user.id,
        country_code || null,
        country_name || null,
        teamId,
        favorite_team_name || null,
        JSON.stringify(competitions),
        JSON.stringify(analysisTypes),
        language || 'fr',
        notifications_enabled !== false,
        personalization_enabled !== false,
        privacy_analytics_enabled !== false,
        onboarding_completed === true
      ]
    );

    res.json({
      message: 'Préférences enregistrées.',
      preferences: rows[0]
    });
  } catch (err) {
    console.error('Erreur sauvegarde préférences :', err);
    res.status(500).json({ error: 'Impossible d’enregistrer les préférences.' });
  }
});

router.delete('/', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM user_preferences WHERE user_id = $1',
      [req.user.id]
    );

    res.json({ message: 'Préférences supprimées.' });
  } catch (err) {
    console.error('Erreur suppression préférences :', err);
    res.status(500).json({ error: 'Impossible de supprimer les préférences.' });
  }
});

module.exports = router;
