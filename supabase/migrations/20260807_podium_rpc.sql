-- RPC : agrège les cartes ajoutées ce mois via cartes_manuelles en une seule requête
-- Remplace la boucle while avec pagination séquentielle dans fetchPodium
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
  GROUP BY cm.user_id, p.display_name, p.avatar_url
$$;

GRANT EXECUTE ON FUNCTION get_monthly_card_counts(timestamptz) TO anon, authenticated;

-- Index pour le tri par stats_total dans l'annuaire
CREATE INDEX IF NOT EXISTS idx_profiles_stats_total ON profiles(stats_total DESC NULLS LAST);
