-- Compte demo pour les salons de cartes (tablette en mode kiosque, voir
-- /admin/demo) -- ne doit jamais apparaitre dans l'annuaire, le carrousel de
-- pepites, le podium ou les compteurs de la home, pour ne pas fausser les
-- vraies statistiques de la communaute.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION get_total_cards()
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(SUM(stats_total), 0)::INT FROM profiles WHERE stats_total > 0 AND is_demo IS NOT TRUE;
$$;

GRANT EXECUTE ON FUNCTION get_total_cards() TO anon, authenticated;

CREATE OR REPLACE FUNCTION get_monthly_card_counts(p_start timestamptz)
RETURNS TABLE(user_id uuid, count bigint, display_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT cm.user_id, COUNT(*)::bigint AS count, p.display_name, p.avatar_url
  FROM cartes_manuelles cm
  JOIN profiles p ON p.id = cm.user_id
  WHERE cm.created_at >= p_start
    AND p.display_name IS NOT NULL
    AND p.display_name <> ''
    AND p.is_demo IS NOT TRUE
  GROUP BY cm.user_id, p.display_name, p.avatar_url
$$;

GRANT EXECUTE ON FUNCTION get_monthly_card_counts(timestamptz) TO anon, authenticated;
