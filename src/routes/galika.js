'use strict';

const express = require('express');
const router = express.Router();

const pool = require('../config/db');

const {
  setUser,
  addEvent,
  getRecentEvents
} = require('../services/galika/galikaContext');

const { requireAuth } = require('../middleware/auth');
const { createResponse } = require('../services/galika/galikaAssistant');

router.post('/context', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        error: 'Utilisateur introuvable.'
      });
    }

    setUser(rows[0]);

    addEvent(req.user.id, {
      type: req.body.type,
      data: req.body.data || {}
    });

    res.json({
      success: true
    });
  } catch (err) {
    console.error('Galika context error:', err);
    res.status(500).json({
      error: 'Impossible d’enregistrer le contexte Galika.'
    });
  }
});

router.get('/context', requireAuth, (req, res) => {
  res.json({
    success: true,
    events: getRecentEvents(req.user.id, 20)
  });
});


router.post('/ask', requireAuth, async (req, res) => {
  try {
    const { question, context } = req.body;

    if (!question || !String(question).trim()) {
      return res.status(400).json({
        error: 'Question requise.'
      });
    }

    const { rows } = await pool.query(
      'SELECT id, name, role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        error: 'Utilisateur introuvable.'
      });
    }

    const answer = createResponse(
      rows[0],
      question,
      context || {}
    );

    res.json({
      success: true,
      answer
    });
  } catch (err) {
    console.error('Galika ask error:', err);
    res.status(500).json({
      error: 'Galika ne peut pas répondre pour le moment.'
    });
  }
});

module.exports = router;
