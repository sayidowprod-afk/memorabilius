-- Compteur "en direct" de la home (LiveStat.tsx) : page.tsx et
-- api/site-stats/route.ts telechargeaient chacun TOUTE la colonne
-- stats_total de tous les profils (des milliers de lignes) pour l'additionner
-- en JS apres coup -- alors que les agregats natifs de PostgREST
-- (?select=sum(stats_total)) sont desactives sur cette instance (PGRST123).
-- Remplace par une somme cote base, comme increment_monthly_additions deja
-- fait pour le meme genre de besoin.
CREATE OR REPLACE FUNCTION get_total_cards()
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(SUM(stats_total), 0)::INT FROM profiles WHERE stats_total > 0;
$$;

GRANT EXECUTE ON FUNCTION get_total_cards() TO anon, authenticated;
