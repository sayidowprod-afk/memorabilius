-- Images de la communauté pour les entrées de setlist
-- Stocke la première photo disponible sur le site pour chaque carte
CREATE TABLE IF NOT EXISTS entry_images (
  entry_id   INT  NOT NULL REFERENCES card_set_entries(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entry_id, user_id)
);

-- Lecture par entry_id rapide (pour l'affichage setlist)
CREATE INDEX IF NOT EXISTS idx_entry_images_entry ON entry_images(entry_id);

-- Tout le monde peut lire (affichage communautaire)
ALTER TABLE entry_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entry_images_select" ON entry_images FOR SELECT USING (true);
CREATE POLICY "entry_images_insert" ON entry_images FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entry_images_delete" ON entry_images FOR DELETE USING (auth.uid() = user_id);

-- Fonction : récupère la première image dispo par entry_id (la plus ancienne = priorité ancienneté)
CREATE OR REPLACE FUNCTION get_entry_images(p_entry_ids INT[])
RETURNS TABLE(entry_id INT, image_url TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (ei.entry_id)
    ei.entry_id,
    ei.image_url
  FROM entry_images ei
  WHERE ei.entry_id = ANY(p_entry_ids)
  ORDER BY ei.entry_id, ei.created_at ASC;
$$;
