-- Perf (2026-11-16) : le budget d'entrées/sorties disque de la base est presque épuisé (Supabase : « about to deplete its Disk IO Budget »),
-- ce qui ralentit tout le site. D'après Query Performance, les plus gros consommateurs :
--   1) get_user_badge_data : 16 à 33 % de lectures en cache seulement, ~10 000 appels (accueil + galerie), car elle COMPTE toutes les vues de page de la galerie ;
--   2) recherche des cartes d'un joueur (nom ILIKE ... ORDER BY created_at DESC LIMIT) : 24 % du temps total, moyenne 1,9 s.
-- Cette migration ne change aucun plan : seulement un plafond de comptage et deux index (idempotents). À exécuter dans l'éditeur SQL.

-- 1) Le palier de badge « vues » le plus haut est 10 000 : inutile de compter au-delà (le comptage s'arrête à 10 001 lignes).
create or replace function get_user_badge_data(p_user_id uuid)
returns table(
  earned_badges text[],
  stat_total    int,
  stat_rc       int,
  stat_auto     int,
  stat_patch    int,
  stat_num      int,
  mois_count    int,
  views_count   bigint,
  teams_count   int
)
language sql security definer as $$
  select
    array(select badge_id from user_badges where user_id = p_user_id),
    coalesce(p.stats_total,  0)::int,
    coalesce(p.stats_rc,     0)::int,
    coalesce(p.stats_auto,   0)::int,
    coalesce(p.stats_patch,  0)::int,
    coalesce(p.stats_num,    0)::int,
    (select count(*)::int from badges where user_id = p_user_id and type = 'collectionneur_du_mois'),
    (select count(*) from (select 1 from page_views where path like '/galerie/' || p_user_id::text || '%' limit 10001) v),
    (select count(*)::int from team_members where user_id = p_user_id)
  from profiles p where p.id = p_user_id;
$$;

grant execute on function get_user_badge_data(uuid) to anon, authenticated;

-- 2) Index « contient » (trigramme) sur les noms de cartes et les équipes, déjà prévus par 20261025d mais pas toujours appliqués ; sans effet s'ils existent.
create extension if not exists pg_trgm;
create index if not exists idx_cartes_manuelles_nom_trgm on public.cartes_manuelles using gin (nom gin_trgm_ops);
create index if not exists idx_cartes_manuelles_equipe_trgm on public.cartes_manuelles using gin (equipe gin_trgm_ops);

-- Statistiques à jour pour que la base choisisse ces index.
analyze public.cartes_manuelles;
