// src/routes/payments.js
// Paiement Mobile Money en validation MANUELLE.

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { aAccesCombinesPayants } = require('../utils/subscriptionAccess');

const DUREE_ABONNEMENT_JOURS = 30;
const OPERATEURS_VALIDES = ['orange', 'mtn', 'moov', 'wave'];

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de soumissions de paiement. Réessaie dans une heure.' }
});

// ============================ COTE CLIENT ============================

router.post('/submit', submitLimiter, requireAuth, async (req, res) => {
  const { operator, phone_number, transaction_code, amount } = req.body;

  if (!operator || !phone_number || !transaction_code) {
    return res.status(400).json({
      error: 'Operateur, numero de telephone et code de transaction sont obligatoires.'
    });
  }

  if (!OPERATEURS_VALIDES.includes(String(operator).toLowerCase())) {
    return res.status(400).json({ error: 'Operateur invalide (orange, mtn, moov ou wave).' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO payment_submissions (user_id, operator, phone_number, transaction_code, amount, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id, created_at`,
      [req.user.id, operator.toLowerCase(), phone_number, transaction_code, amount || null]
    );

    res.json({
      success: true,
      submission: result.rows[0],
      message: "Paiement soumis. En attente de validation par l'administrateur."
    });
  } catch (err) {
    console.error('Erreur soumission paiement :', err);
    res.status(500).json({ error: 'Erreur serveur lors de la soumission du paiement.' });
  }
});

router.get('/my-status', requireAuth, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT role, trial_ends_at, subscription_active, subscription_expires_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    const historique = await pool.query(
      `SELECT id, operator, transaction_code, amount, status, admin_note, created_at, validated_at
       FROM payment_submissions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );

    const user = userResult.rows[0];
    const maintenant = new Date();
    const enEssaiGratuit = user.role === 'admin' ? true : (user.trial_ends_at && new Date(user.trial_ends_at) > maintenant);
    const abonnementActif =
      user.subscription_active &&
      user.subscription_expires_at &&
      new Date(user.subscription_expires_at) > maintenant;

    res.json({
      acces_combines_payants: enEssaiGratuit || abonnementActif,
      en_essai_gratuit: enEssaiGratuit,
      essai_expire_le: user.trial_ends_at,
      abonnement_actif: abonnementActif,
      abonnement_expire_le: user.subscription_expires_at,
      historique: historique.rows
    });
  } catch (err) {
    console.error('Erreur statut paiement :', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ============================= COTE ADMIN =============================

router.get('/admin/list', requireAuth, requireAdmin, async (req, res) => {
  const statut = req.query.status || 'pending';
  try {
    const result = await pool.query(
      `SELECT ps.*, u.name, u.phone, u.email
       FROM payment_submissions ps
       JOIN users u ON u.id = ps.user_id
       WHERE ps.status = $1
       ORDER BY ps.created_at ASC`,
      [statut]
    );
    res.json({ paiements: result.rows });
  } catch (err) {
    console.error('Erreur liste paiements admin :', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/admin/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const dureeJours = req.body.duree_jours || DUREE_ABONNEMENT_JOURS;

  try {
    const soumission = await pool.query('SELECT * FROM payment_submissions WHERE id = $1', [id]);
    if (soumission.rows.length === 0) {
      return res.status(404).json({ error: 'Paiement introuvable.' });
    }
    if (soumission.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Ce paiement a deja ete traite.' });
    }

    const userId = soumission.rows[0].user_id;
    const userResult = await pool.query(
      'SELECT subscription_active, subscription_expires_at FROM users WHERE id = $1',
      [userId]
    );

    const dejaActif =
      userResult.rows[0].subscription_active &&
      userResult.rows[0].subscription_expires_at &&
      new Date(userResult.rows[0].subscription_expires_at) > new Date();

    const dateDepart = dejaActif ? new Date(userResult.rows[0].subscription_expires_at) : new Date();
    const nouvelleExpiration = new Date(dateDepart.getTime() + dureeJours * 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE users SET subscription_active = TRUE, subscription_expires_at = $1 WHERE id = $2`,
      [nouvelleExpiration, userId]
    );
    await pool.query(
      `UPDATE payment_submissions SET status = 'approved', validated_at = NOW(), validated_by = $1 WHERE id = $2`,
      [req.user.id, id]
    );

    res.json({ success: true, nouvelle_expiration: nouvelleExpiration });
  } catch (err) {
    console.error('Erreur validation paiement :', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/admin/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  try {
    const result = await pool.query(
      `UPDATE payment_submissions
       SET status = 'rejected', admin_note = $1, validated_at = NOW(), validated_by = $2
       WHERE id = $3 AND status = 'pending'
       RETURNING id`,
      [note || null, req.user.id, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paiement introuvable ou deja traite.' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur rejet paiement :', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
