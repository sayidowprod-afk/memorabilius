-- Étend les commentaires de galerie pour permettre de commenter une carte précise
-- (card_key) ou un classeur précis (binder_id), en réutilisant la même table/UI
-- (réponses, likes, emojis) que les commentaires de galerie.

ALTER TABLE galerie_comments ADD COLUMN IF NOT EXISTS card_key text;
ALTER TABLE galerie_comments ADD COLUMN IF NOT EXISTS binder_id bigint REFERENCES binders(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_galerie_comments_card ON galerie_comments(galerie_user_id, card_key) WHERE card_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_galerie_comments_binder ON galerie_comments(binder_id) WHERE binder_id IS NOT NULL;
