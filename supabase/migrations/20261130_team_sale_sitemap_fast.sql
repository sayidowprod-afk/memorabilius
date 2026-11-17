-- Perf (2026-11-17) : suite de 20261128 / 20261129 (mesuré : player_cards_search = 45 ms en moyenne au lieu de 1 700 ms).
-- Même cause pour trois autres requêtes de l'export Query Performance : la règle de sécurité des cartes privées appelle une fonction pour CHAQUE carte
-- et empêche l'index de servir. Ces fonctions font le même travail avec l'index, puis excluent les cartes privées sur le petit résultat.
-- Droits identiques : cartes non privées, ou celles du membre connecté.
--   1) team_cards_search    : cartes d'une équipe (pages équipe + /api/team-cards)            ~1,2 % du temps de la base, 1,7 s par appel
--   2) count_cards_for_sale : nombre de cartes à vendre (accueil, site-stats, presskit)       ~1,4 %, 774 appels
--   3) sitemap_cards_page   : une page de 1 000 cartes du sitemap (régénéré à chaque déploiement)   ~4,2 %, 592 appels à 860 ms
--
-- Retour en arrière :
--   drop function public.team_cards_search(text);
--   drop function public.count_cards_for_sale();
--   drop function public.sitemap_cards_page(integer, integer);

create or replace function public.team_cards_search(p_team text)
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  with m as materialized (
    select c.id, c.nom, c.annee, c.marque, c.image_recto, c.is_horizontal, c.user_id, c.created_at
    from public.cartes_manuelles c
    where c.equipe ilike '%' || p_team || '%'
      and c.image_recto is not null
  )
  select jsonb_build_object(
           'id', m.id, 'nom', m.nom, 'annee', m.annee, 'marque', m.marque, 'image_recto', m.image_recto,
           'is_horizontal', m.is_horizontal, 'user_id', m.user_id, 'created_at', m.created_at,
           'profiles', (select jsonb_build_object('display_name', p.display_name, 'avatar_url', p.avatar_url, 'couleur_bordure', p.couleur_bordure, 'is_demo', p.is_demo)
                        from public.profiles p where p.id = m.user_id)
         )
  from m
  where m.user_id = (select auth.uid())
     or not exists (select 1 from public.cartes_privees x where x.user_id = m.user_id and x.card_key = m.image_recto)
  order by m.created_at desc, m.id
$$;

create or replace function public.count_cards_for_sale()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.cartes_manuelles c
  where c.disponible_vente = true
    and (c.user_id = (select auth.uid())
         or not exists (select 1 from public.cartes_privees x where x.user_id = c.user_id and x.card_key = c.image_recto))
$$;

create or replace function public.sitemap_cards_page(p_offset integer, p_limit integer)
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'id', c.id, 'user_id', c.user_id, 'nom', c.nom, 'annee', c.annee, 'marque', c.marque,
           'collection', c.collection, 'image_recto', c.image_recto, 'created_at', c.created_at)
  from public.cartes_manuelles c
  where c.image_recto is not null
    and not exists (select 1 from public.cartes_privees x where x.user_id = c.user_id and x.card_key = c.image_recto)
  order by c.id
  offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 1000)
$$;

revoke all on function public.team_cards_search(text) from public;
revoke all on function public.count_cards_for_sale() from public;
revoke all on function public.sitemap_cards_page(integer, integer) from public;
grant execute on function public.team_cards_search(text) to anon, authenticated, service_role;
grant execute on function public.count_cards_for_sale() to anon, authenticated, service_role;
grant execute on function public.sitemap_cards_page(integer, integer) to anon, authenticated, service_role;
