// src/utils/subscriptionAccess.js
// A placer dans src/utils/ (a cote des autres fichiers utilitaires).
// Sert a verifier si un client a le droit de voir les combines payants
// (Ultra Safe / Safe) : soit parce qu'il est encore dans son essai
// gratuit de 7 jours, soit parce que son abonnement Mobile Money est actif.

async function aAccesCombinesPayants(pool, userId) {
  const result = await pool.query(
    `SELECT trial_ends_at, subscription_active, subscription_expires_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) return false;

  const user = result.rows[0];
  const maintenant = new Date();

  const enEssaiGratuit = user.trial_ends_at && new Date(user.trial_ends_at) > maintenant;
  const abonnementActif =
    user.subscription_active &&
    user.subscription_expires_at &&
    new Date(user.subscription_expires_at) > maintenant;

  return Boolean(enEssaiGratuit || abonnementActif);
}

module.exports = { aAccesCombinesPayants };
