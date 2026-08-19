require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./config/db');

async function bootstrap() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Base de donnees verifiee/initialisee.');
  } catch (err) {
    console.error('Erreur initialisation base :', err.message);
  }

  try {
    const { ADMIN_EMAIL, ADMIN_PHONE, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
    if (ADMIN_EMAIL && ADMIN_PHONE && ADMIN_PASSWORD) {
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await pool.query(
        `INSERT INTO users (name, email, phone, password_hash, role, email_verified, phone_verified)
         VALUES ($1,$2,$3,$4,'admin',TRUE,TRUE)
         ON CONFLICT (email) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           role = 'admin',
           email_verified = TRUE,
           phone_verified = TRUE,
           phone = EXCLUDED.phone`,
        [ADMIN_NAME || 'Administrateur', ADMIN_EMAIL, ADMIN_PHONE, passwordHash]
      );
      console.log('Compte administrateur pret :', ADMIN_EMAIL);
    } else {
      console.log('ADMIN_PHONE/ADMIN_PASSWORD non definis, compte admin non cree automatiquement.');
    }
  } catch (err) {
    console.error('Erreur preparation compte admin :', err.message);
  }

  require('./server.js');
}

bootstrap();
