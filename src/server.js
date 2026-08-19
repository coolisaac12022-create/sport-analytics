require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const matchesRouter = require('./routes/matches');
const predictionsRouter = require('./routes/predictions');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Fichiers statiques du frontend (public/)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Vérifie que l'API et la base répondent
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connectée' });
  } catch (err) {
    res.status(500).json({ status: 'erreur', db: 'non connectée', detail: err.message });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/predictions', predictionsRouter);

// Toute autre route sert la page principale (single page app)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});
