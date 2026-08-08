-- Performance indexes — August 2026
-- cartes_manuelles.user_id is filtered on every galerie page load (no index = full table scan)
CREATE INDEX IF NOT EXISTS idx_cartes_manuelles_user_id
  ON cartes_manuelles(user_id);

-- nom is used for ilike in recherche + same-card
CREATE INDEX IF NOT EXISTS idx_cartes_manuelles_nom
  ON cartes_manuelles(nom);

-- created_at filtered in card-added delete handler
CREATE INDEX IF NOT EXISTS idx_cartes_manuelles_created_at
  ON cartes_manuelles(created_at);

-- cartes_privees.user_id scanned on every galerie and recherche
CREATE INDEX IF NOT EXISTS idx_cartes_privees_user_id
  ON cartes_privees(user_id);

-- monthly_additions filtered by both columns on every card add/remove
CREATE INDEX IF NOT EXISTS idx_monthly_additions_user_month
  ON monthly_additions(user_id, month);

-- profiles.slug used for slug→id resolution in showcase and galerie links
CREATE INDEX IF NOT EXISTS idx_profiles_slug
  ON profiles(slug);

-- Trigram index on player_name for fast ILIKE on player checklist and search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_card_set_entries_player_name_trgm
  ON card_set_entries USING gin (player_name gin_trgm_ops);
