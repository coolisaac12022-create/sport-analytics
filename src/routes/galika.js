'use strict';

const express = require('express');
const router = express.Router();

const {
  analyzeTeam,
  compareTeams,
  generateReport
} = require('../services/galika/galikaEngine');

/*
 * POST /api/galika/analyze
 *
 * Reçoit :
 * {
 *   home: { name: "...", recent: {...} },
 *   away: { name: "...", recent: {...} }
 * }
 */
router.post('/analyze', (req, res) => {
  try {
    const { home, away } = req.body;

    if (!home || !away) {
      return res.status(400).json({
        error: 'Les données des deux équipes sont nécessaires.'
      });
    }

    const report = generateReport(home, away);

    res.json({
      success: true,
      ...report
    });
  } catch (error) {
    console.error('Galika error:', error);

    res.status(500).json({
      error: 'Impossible de générer l’analyse.'
    });
  }
});

router.post('/team', (req, res) => {
  try {
    if (!req.body.team) {
      return res.status(400).json({
        error: 'Les données de l’équipe sont nécessaires.'
      });
    }

    res.json({
      success: true,
      analysis: analyzeTeam(req.body.team)
    });
  } catch (error) {
    console.error('Galika team error:', error);

    res.status(500).json({
      error: 'Impossible d’analyser cette équipe.'
    });
  }
});

router.post('/compare', (req, res) => {
  try {
    const { home, away } = req.body;

    if (!home || !away) {
      return res.status(400).json({
        error: 'Les deux équipes sont nécessaires.'
      });
    }

    res.json({
      success: true,
      comparison: compareTeams(home, away)
    });
  } catch (error) {
    console.error('Galika compare error:', error);

    res.status(500).json({
      error: 'Impossible de comparer les équipes.'
    });
  }
});

module.exports = router;
