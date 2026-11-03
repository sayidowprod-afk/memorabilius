-- Résumé quotidien « les membres que tu suis ont ajouté des cartes » : activé par défaut, désactivable depuis /parametres.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_followed_cards BOOLEAN NOT NULL DEFAULT true;

-- Le cron lit les cartes ajoutées sur 24 h (cartes_manuelles.created_at) : index pour éviter un balayage complet.
CREATE INDEX IF NOT EXISTS idx_cartes_manuelles_created_at ON cartes_manuelles(created_at);
