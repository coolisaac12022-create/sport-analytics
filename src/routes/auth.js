const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const pool = require('../config/db');
const { sendVerificationEmail } = require('../config/mailer');
const { sendOtpSms } = require('../config/sms');
const { generateEmailToken, generateOtpCode } = require('../utils/tokens');
const { requireAuth } = require('../middleware/auth');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{8,15}$/;

// Limite le nombre de tentatives de connexion pour se protéger du "brute force"
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de connexion. Réessaie dans 15 minutes.' }
});

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    emailVerified: u.email_verified,
    phoneVerified: u.phone_verified
  };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }
    if (!PHONE_REGEX.test(phone)) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide (utilise le format international, ex : +2250700000000).' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1 OR phone = $2', [email, phone]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet email ou ce numéro de téléphone.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const emailToken = generateEmailToken();
    const otpCode = generateOtpCode();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Le compte dont l'email correspond à ADMIN_EMAIL est automatiquement administrateur
    const role = process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()
      ? 'admin'
      : 'user';

    const { rows } = await pool.query(
      `INSERT INTO users
         (name, email, phone, password_hash, role, email_verification_token, phone_otp_code, phone_otp_expires)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [name, email, phone, passwordHash, role, emailToken, otpCode, otpExpires]
    );
    const user = rows[0];

    await Promise.all([
      sendVerificationEmail({ to: email, name, token: emailToken }),
      sendOtpSms({ to: phone, code: otpCode })
    ]);

    res.status(201).json({
      message: 'Compte créé. Vérifie ton email (lien reçu) et ton téléphone (code reçu par SMS) pour l\'activer.',
      user: publicUser(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création du compte.' });
  }
});

// POST /api/auth/verify-email  { token }
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token manquant.' });

    const { rows } = await pool.query(
      `UPDATE users SET email_verified = TRUE, email_verification_token = NULL
       WHERE email_verification_token = $1
       RETURNING id, name, email`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Lien de vérification invalide ou déjà utilisé.' });
    }

    res.json({ message: 'Email vérifié avec succès. Tu peux maintenant te connecter.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la vérification.' });
  }
});

// POST /api/auth/verify-phone  { email, code }
router.post('/verify-phone', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email et code requis.' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Compte introuvable.' });

    if (user.phone_verified) {
      return res.json({ message: 'Numéro déjà vérifié.' });
    }
    if (!user.phone_otp_code || user.phone_otp_code !== code) {
      return res.status(400).json({ error: 'Code incorrect.' });
    }
    if (new Date(user.phone_otp_expires) < new Date()) {
      return res.status(400).json({ error: 'Code expiré, demande un nouveau code.' });
    }

    await pool.query(
      `UPDATE users SET phone_verified = TRUE, phone_otp_code = NULL, phone_otp_expires = NULL WHERE id = $1`,
      [user.id]
    );

    res.json({ message: 'Numéro de téléphone vérifié avec succès.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la vérification.' });
  }
});

// POST /api/auth/resend-otp  { email }
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Compte introuvable.' });
    if (user.phone_verified) return res.json({ message: 'Numéro déjà vérifié.' });

    const otpCode = generateOtpCode();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      'UPDATE users SET phone_otp_code = $1, phone_otp_expires = $2 WHERE id = $3',
      [otpCode, otpExpires, user.id]
    );
    await sendOtpSms({ to: user.phone, code: otpCode });

    res.json({ message: 'Nouveau code envoyé par SMS.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du code.' });
  }
});

// POST /api/auth/login  { email, password }
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Identifiants incorrects.' });

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Ce compte a été suspendu. Contacte l\'administrateur.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants incorrects.' });

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Merci de vérifier ton email avant de te connecter.' });
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
});

// GET /api/auth/me — infos du compte connecté
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Compte introuvable.' });
    res.json(publicUser(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
