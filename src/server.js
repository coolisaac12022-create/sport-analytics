require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const matchesRouter = require('./routes/matches');
const predictionsRouter = require('./routes/predictions');
const combosRouter = require('./routes/combos');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const galikaRouter = require('./routes/galika');
const preferencesRouter = require('./routes/preferences');
const paymentsRouter = require('./routes/payments');
const pool = require('./config/db');
const cron = require('node-cron');
const { buildDailyCombo, buildAllTiers } = require('./services/comboBuilder');
const { autoSyncAllLeagues, updateFinishedResults } = require('./services/leagueSync');

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGINS = [
  'https://sport-analytics-zhy3.onrender.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Origine non autorisée par CORS: ' + origin));
  }
}));

app.use(express.json({ limit: '10kb' }));

app.use(async (req, res, next) => {
  try {
    const allowedPrefixes = ['/api/admin', '/api/auth', '/admin.html', '/css/', '/js/', '/images/'];
    if (allowedPrefixes.some(function(p) { return req.path.startsWith(p); })) return next();
    const { rows } = await pool.query("SELECT value FROM site_settings WHERE key = 'maintenance_mode'");
    const maintenance = rows.length && rows[0].value === 'true';
    if (!maintenance) return next();
    if (req.path.startsWith('/api/')) {
      return res.status(503).json({ error: 'Site en maintenance. Reessaie plus tard.' });
    }
    res.status(503).send('<html><body style="font-family:sans-serif;text-align:center;padding:60px;"><h1>Site en maintenance</h1><p>Nous revenons tres bientot.</p></body></html>');
  } catch (err) {
    console.error(err);
    next();
  }
});

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
app.use('/api/preferences', preferencesRouter);
app.use('/api/payments', paymentsRouter);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log("Serveur lance sur le port " + PORT);
  autoSyncAllLeagues().catch(function(err) { console.error('Erreur sync initiale :', err.message); });
  updateFinishedResults().catch(function(err) { console.error('Erreur mise a jour resultats initiale :', err.message); });
});

cron.schedule('0 8 * * *', async () => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    await buildAllTiers(today);
    console.log('Combines des 3 niveaux generes automatiquement pour', today);
  } catch (err) {
    console.error('Generation automatique du combine impossible :', err.message);
  }
});

cron.schedule('0 * * * *', async () => {
  try {
    const updated = await updateFinishedResults();
    console.log('Mise a jour des resultats termines : ' + updated + ' match(s).');
  } catch (err) {
    console.error('Erreur mise a jour resultats :', err.message);
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
