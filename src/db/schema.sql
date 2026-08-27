-- Schéma de la base de données "sport-analytics"

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(160) UNIQUE NOT NULL,
    phone VARCHAR(30) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user', -- user | admin
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verification_token VARCHAR(128),
    phone_otp_code VARCHAR(10),
    phone_otp_expires TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | suspended
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(64) UNIQUE,
    name VARCHAR(120) NOT NULL,
    league VARCHAR(120),
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(64) UNIQUE,
    league VARCHAR(120),
    season VARCHAR(20),
    home_team_id INTEGER REFERENCES teams(id),
    away_team_id INTEGER REFERENCES teams(id),
    home_team_name VARCHAR(120),
    away_team_name VARCHAR(120),
    match_date TIMESTAMP,
    status VARCHAR(30) DEFAULT 'scheduled', -- scheduled | live | finished
    home_score INTEGER,
    away_score INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_stats (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
    possession_home NUMERIC,
    possession_away NUMERIC,
    shots_home INTEGER,
    shots_away INTEGER,
    shots_on_target_home INTEGER,
    shots_on_target_away INTEGER,
    corners_home INTEGER,
    corners_away INTEGER,
    fouls_home INTEGER,
    fouls_away INTEGER,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
    home_win_prob NUMERIC,
    draw_prob NUMERIC,
    away_win_prob NUMERIC,
    predicted_score_home INTEGER,
    predicted_score_away INTEGER,
    confidence NUMERIC,
    ai_analysis TEXT,
    engine VARCHAR(20) DEFAULT 'statistical', -- statistical | ai
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date);
CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(match_id);

-- Combiné du jour : sélection des matchs jugés les plus fiables par l'IA
CREATE TABLE IF NOT EXISTS daily_combos (
    id SERIAL PRIMARY KEY,
    combo_date DATE UNIQUE NOT NULL,
    ai_summary TEXT,
    engine VARCHAR(20) DEFAULT 'statistical',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS combo_selections (
    id SERIAL PRIMARY KEY,
    combo_id INTEGER REFERENCES daily_combos(id) ON DELETE CASCADE,
    match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
    pick_label VARCHAR(160),
    pick_type VARCHAR(20),
    confidence NUMERIC,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_combo_selections_combo ON combo_selections(combo_id);

-- Ajoute les colonnes manquantes sur les bases deja existantes (sans danger si deja presentes)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMP;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS btts_yes_prob NUMERIC;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS over_1_5_prob NUMERIC;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS over_2_5_prob NUMERIC;
