const crypto = require('crypto');

// Token long et aléatoire pour le lien de vérification email
function generateEmailToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Code à 6 chiffres pour la vérification par SMS
function generateOtpCode() {
  return String(crypto.randomInt(100000, 999999));
}

module.exports = { generateEmailToken, generateOtpCode };
