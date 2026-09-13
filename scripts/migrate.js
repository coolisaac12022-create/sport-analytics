
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'migration_v2.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('Migration v2 OK : table payment_submissions + colonnes abonnement crees.');
  } catch (err) {
    console.error('Erreur migration :', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
run();
