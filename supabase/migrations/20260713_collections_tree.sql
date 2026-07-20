-- Collections « arbre » + appartenance multiple
-- ------------------------------------------------------------------
-- Avant : une carte portait UNE seule collection (cartes_manuelles.collection_tag
-- ou une ligne carte_tags par carte). Désormais :
--   • une carte peut appartenir à PLUSIEURS collections (table de liaison)
--   • les collections forment un ARBRE (collection principale → sous-collections)
--
-- On reste "name-based" : une collection est identifiée par (user_id, nom),
-- ce qui réutilise collection_tab_settings (couleur/position déjà par nom).

-- 1) Table de liaison carte ↔ collection (appartenance multiple)
CREATE TABLE IF NOT EXISTS card_collections (
  id bigint generated always as identity primary key,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_key text NOT NULL,          -- image_recto de la carte (clé uniforme, comme carte_tags/binder_slots)
  collection text NOT NULL,        -- nom de la collection
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_key, collection)
);
CREATE INDEX IF NOT EXISTS card_collections_user_idx ON card_collections (user_id);
CREATE INDEX IF NOT EXISTS card_collections_card_idx ON card_collections (user_id, card_key);

ALTER TABLE card_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_collections_select" ON card_collections;
DROP POLICY IF EXISTS "card_collections_insert" ON card_collections;
DROP POLICY IF EXISTS "card_collections_delete" ON card_collections;
CREATE POLICY "card_collections_select" ON card_collections FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "card_collections_insert" ON card_collections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "card_collections_delete" ON card_collections FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2) Hiérarchie : une collection peut avoir une collection parente (NULL = racine)
ALTER TABLE collection_tab_settings ADD COLUMN IF NOT EXISTS parent text;

-- 3) Backfill de l'appartenance depuis l'ancien modèle (idempotent)
--    a) cartes manuelles
INSERT INTO card_collections (user_id, card_key, collection)
SELECT user_id, image_recto, collection_tag
FROM cartes_manuelles
WHERE collection_tag IS NOT NULL AND collection_tag <> '' AND image_recto IS NOT NULL
ON CONFLICT (user_id, card_key, collection) DO NOTHING;

--    b) cartes CSV (carte_tags)
INSERT INTO card_collections (user_id, card_key, collection)
SELECT user_id, card_key, collection_tag
FROM carte_tags
WHERE collection_tag IS NOT NULL AND collection_tag <> ''
ON CONFLICT (user_id, card_key, collection) DO NOTHING;
