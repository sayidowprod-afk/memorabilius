-- Perf (2026-10-25) : page joueur fait .ilike('nom','%first%').ilike('nom','%last%')
-- sur cartes_manuelles (pagination en boucle) sans index adapte pour une
-- recherche de sous-chaine. Table modeste (~103k lignes, 119MB) donc impact
-- moins severe que card_set_entries, mais index trigramme ajoute quand meme
-- (build en 2.7s, aucun risque) pour permettre au planner de s'en servir si
-- besoin.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cartes_manuelles_nom_trgm
  ON public.cartes_manuelles USING gin (nom gin_trgm_ops);
