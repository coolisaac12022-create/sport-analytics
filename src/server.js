require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const matchesRouter = require('./routes/matches');
const predictionsRouter = require('./routes/predictions');
const combosRouter = require('./routes/combos');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const galikaRouter = require('./routes/galika');
const pool = require('./config/db');
const cron = require('node-cron');
const { buildDailyCombo } = require('./services/comboBuilder');
const { autoSyncAllLeagues } = require('./services/leagueSync');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connectee' });
  } catch (err) {
    res.status(500).json({ status: 'erreur', db: 'non connectee', detail: err.message });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/combos', combosRouter);
app.use('/api/galika', galikaRouter);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log("Serveur lance sur le port " + PORT);
  autoSyncAllLeagues().catch(function(err) { console.error('Erreur sync initiale :', err.message); });
});

cron.schedule('0 8 * * *', async () => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    await buildDailyCombo(today);
    console.log('Combine du jour genere automatiquement pour', today);
  } catch (err) {
    console.error('Generation automatique du combine impossible :', err.message);
  }
});

cron.schedule('0 */6 * * *', async () => {
  try {
    const total = await autoSyncAllLeagues();
    console.log('Synchronisation automatique terminee :', total, 'match(s) au total.');
  } catch (err) {
    console.error('Erreur lors de la synchronisation automatique :', err.message);
  }
});
