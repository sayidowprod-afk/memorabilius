-- Préférences par type pour les notifications proactives (crons) — activées
-- par défaut, désactivables individuellement depuis /parametres.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_popularity_digest BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_streak_warning BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_winback BOOLEAN NOT NULL DEFAULT true;
