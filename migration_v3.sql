-- ============================================================
-- MIGRATION v3 — Parametres du site (admin)
-- ============================================================

CREATE TABLE IF NOT EXISTS site_settings (
    key VARCHAR(60) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO site_settings (key, value) VALUES
    ('min_pick_odds', '1.25'),
    ('registration_open', 'true'),
    ('email_verification_required', 'false'),
    ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;
