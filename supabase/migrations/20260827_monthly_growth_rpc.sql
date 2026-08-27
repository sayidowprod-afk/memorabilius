-- RPC : nombre de cartes ajoutées par mois pour UN collectionneur, sur les 12
-- derniers mois (dashboard de tendances personnelles). Agrégation faite côté
-- SQL plutôt que de rapatrier toutes les lignes cartes_manuelles côté client
-- (déjà paginé par 1000 dans GalerieClient -- inutile de tout retélécharger
-- juste pour compter par mois).
CREATE OR REPLACE FUNCTION get_user_monthly_growth(p_user_id uuid, p_start timestamptz)
RETURNS TABLE(month_start date, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT date_trunc('month', cm.created_at)::date AS month_start, COUNT(*)::bigint AS count
  FROM cartes_manuelles cm
  WHERE cm.user_id = p_user_id
    AND cm.created_at >= p_start
  GROUP BY date_trunc('month', cm.created_at)
  ORDER BY month_start
$$;

GRANT EXECUTE ON FUNCTION get_user_monthly_growth(uuid, timestamptz) TO anon, authenticated;
