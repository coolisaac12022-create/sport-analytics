-- ============================================================
-- MIGRATION v2 — Système d'abonnement & paiements Mobile Money
-- À exécuter UNE SEULE FOIS sur la base PostgreSQL (Render)
-- ============================================================

-- 1. Colonnes d'abonnement sur users
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_active BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;

-- 2. Table des soumissions de paiement (validation manuelle admin)
CREATE TABLE IF NOT EXISTS payment_submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operator VARCHAR(20) NOT NULL,              -- orange | mtn | moov
    phone_number VARCHAR(30) NOT NULL,
    transaction_code VARCHAR(80) NOT NULL,
    amount NUMERIC,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | validated | rejected
    admin_note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    validated_at TIMESTAMP,
    validated_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_submissions_user ON payment_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_status ON payment_submissions(status);

-- 3. Activer l'essai gratuit de 7 jours pour les nouveaux comptes existants
--    (optionnel : décommente la ligne suivante si tu veux offrir l'essai aux anciens users)
-- UPDATE users SET trial_ends_at = NOW() + INTERVAL '7 days' WHERE trial_ends_at IS NULL;
