-- RPC : fil d'activité "cartes récemment ajoutées par les collectionneurs suivis".
-- S'appuie sur les tables follows + cartes_manuelles déjà existantes plutôt que
-- d'introduire une nouvelle table d'événements écrite à chaque ajout de carte
-- (aurait fallu instrumenter tous les points d'écriture de cartes_manuelles) --
-- created_at suffit déjà à reconstituer un flux chronologique.
CREATE OR REPLACE FUNCTION get_following_activity(p_user_id uuid, p_limit integer DEFAULT 30)
RETURNS TABLE(
  id_manuelle uuid,
  user_id uuid,
  display_name text,
  avatar_url text,
  slug text,
  nom text,
  equipe text,
  annee text,
  image_recto text,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT cm.id, cm.user_id, p.display_name, p.avatar_url, p.slug,
         cm.nom, cm.equipe, cm.annee, cm.image_recto, cm.created_at
  FROM cartes_manuelles cm
  JOIN follows f ON f.followed_id = cm.user_id
  JOIN profiles p ON p.id = cm.user_id
  WHERE f.follower_id = p_user_id
    AND p.display_name IS NOT NULL
    AND p.display_name <> ''
  ORDER BY cm.created_at DESC
  LIMIT p_limit
$$;

GRANT EXECUTE ON FUNCTION get_following_activity(uuid, integer) TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_cartes_manuelles_created_at ON cartes_manuelles(created_at DESC);
