const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Toutes les routes ci-dessous exigent d'être connecté ET administrateur
router.use(requireAuth, requireAdmin);

// GET /api/admin/stats — vue d'ensemble du site
router.get('/stats', async (req, res) => {
  try {
    const [users, verifiedUsers, matches, predictions] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM users WHERE email_verified = TRUE AND phone_verified = TRUE'),
      pool.query('SELECT COUNT(*) FROM matches'),
      pool.query('SELECT COUNT(*) FROM predictions')
    ]);
    res.json({
      totalUsers: Number(users.rows[0].count),
      verifiedUsers: Number(verifiedUsers.rows[0].count),
      totalMatches: Number(matches.rows[0].count),
      totalPredictions: Number(predictions.rows[0].count)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// GET /api/admin/users — liste de tous les clients inscrits (email + téléphone visibles)
router.get('/users', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, role, email_verified, phone_verified, status, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// PATCH /api/admin/users/:id/status  { status: 'active' | 'suspended' }
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }
    const { rows } = await pool.query(
      'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, name, status',
      [status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Client introuvable.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// PATCH /api/admin/users/:id/role  { role: 'user' | 'admin' }
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide.' });
    }
    const { rows } = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, role',
      [role, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Client introuvable.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Client introuvable.' });
    res.json({ message: 'Client supprimé.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// GET /api/admin/matches — tous les matchs enregistrés (vue complète, sans limite)
router.get('/matches', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM matches ORDER BY match_date DESC LIMIT 500');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// DELETE /api/admin/matches/:id
router.delete('/matches/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM matches WHERE id = $1 RETURNING id', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Match introuvable.' });
    res.json({ message: 'Match supprimé.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
