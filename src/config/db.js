const { Pool } = require('pg');

// Render fournit DATABASE_URL automatiquement quand tu relies une base Postgres au service.
// SSL est nécessaire sur Render même en interne, donc on l'active hors environnement local.
const isLocal = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Erreur inattendue du pool PostgreSQL :', err);
});

module.exports = pool;
