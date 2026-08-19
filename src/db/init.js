// Exécute le schéma SQL sur la base de données PostgreSQL configurée
// Utilisation : npm run db:init
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function init() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  try {
    console.log('⏳ Initialisation de la base de données...');
    await pool.query(schema);
    console.log('✅ Base de données initialisée avec succès.');
  } catch (err) {
    console.error('❌ Erreur lors de l\'initialisation :', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

init();
