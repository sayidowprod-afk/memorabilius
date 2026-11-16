-- Perf (2026-11-16) : l'export « Query Performance » montre que 5 requêtes sur cartes_manuelles (recherche d'un joueur par son nom, rôle anon) représentent
-- à elles seules ~60 % du temps total de la base : 1,7 s en moyenne chacune, avec un maximum à 3 s = le délai maximal du rôle anon (donc des échecs).
--
-- Cause : la règle de sécurité « Voir les cartes non privées ou les siennes » appelle une fonction (is_card_private) pour CHAQUE ligne de la table.
-- Avec une règle de sécurité (RLS), PostgreSQL n'autorise pas l'index de recherche par nom (ILIKE) à passer avant elle, car ILIKE n'est pas « leakproof » :
-- la base parcourt donc toutes les cartes en appelant la fonction sur chacune, au lieu d'utiliser l'index.
--
-- Solution : une fonction qui fait la même chose AVEC l'index (recherche par nom d'abord, puis exclusion des cartes privées sur le petit résultat).
-- Les droits d'accès sont identiques : on ne renvoie que les cartes non privées, ou celles du membre connecté (auth.uid()).
-- Le site l'utilise automatiquement dès que cette fonction existe, et retombe sur l'ancienne requête sinon.
--
-- Vérification après exécution (doit répondre en quelques dizaines de ms au lieu de ~2 s) :
--   explain analyze select count(*) from player_cards_search('Michael', 'Jordan');
--
-- Retour en arrière : drop function public.player_cards_search(text, text);
create or replace function public.player_cards_search(p_first text, p_last text)
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  with m as materialized (
    select c.id, c.nom, c.annee, c.rc, c.auto, c.num, c.patch, c.marque, c.collection, c.variation,
           c.image_recto, c.is_horizontal, c.disponible_vente, c.created_at, c.user_id
    from public.cartes_manuelles c
    where c.nom ilike '%' || p_first || '%'
      and c.nom ilike '%' || p_last || '%'
      and c.image_recto is not null
  )
  select jsonb_build_object(
           'id', m.id, 'nom', m.nom, 'annee', m.annee, 'rc', m.rc, 'auto', m.auto, 'num', m.num, 'patch', m.patch,
           'marque', m.marque, 'collection', m.collection, 'variation', m.variation, 'image_recto', m.image_recto,
           'is_horizontal', m.is_horizontal, 'disponible_vente', m.disponible_vente, 'created_at', m.created_at, 'user_id', m.user_id,
           'profiles', (select jsonb_build_object('display_name', p.display_name, 'avatar_url', p.avatar_url, 'couleur_bordure', p.couleur_bordure, 'is_demo', p.is_demo)
                        from public.profiles p where p.id = m.user_id)
         )
  from m
  where m.user_id = (select auth.uid())
     or not exists (select 1 from public.cartes_privees x where x.user_id = m.user_id and x.card_key = m.image_recto)
  order by m.created_at desc, m.id
$$;

revoke all on function public.player_cards_search(text, text) from public;
grant execute on function public.player_cards_search(text, text) to anon, authenticated, service_role;
