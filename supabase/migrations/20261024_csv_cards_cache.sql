-- Cache persistant des cartes CSV externes des collectionneurs. Chaque page
-- joueur refaisait jusqu'a ~500 requetes HTTP externes (une par profil lie a
-- un CSV) a CHAQUE visite, quel que soit le joueur -- cause principale de
-- lenteur. Une vraie table (comme player_photo_cache) survit aux cold starts
-- et evite de re-telecharger/reparser les memes CSV en boucle.
CREATE TABLE IF NOT EXISTS csv_cards_cache (
  profile_id  uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  cards       jsonb NOT NULL DEFAULT '[]',
  fetched_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON csv_cards_cache TO anon, authenticated;
