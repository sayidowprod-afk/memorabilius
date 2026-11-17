-- Perf (2026-11-17) : suite de 20261128. La recherche « mêmes cartes chez d'autres membres » (/api/same-card) pèse ~10 % du temps de la base
-- (666 appels à 1,8 s) pour la même raison : la règle de sécurité empêche l'index des noms de servir. Même solution que player_cards_search
-- (qui, mesuré, passe de 1 700 ms à 45 ms en moyenne) : recherche par nom avec l'index, puis exclusion des cartes privées.
-- Droits identiques : cartes non privées, ou celles du membre connecté.
--
-- Retour en arrière : drop function public.same_card_search(text, uuid);
create or replace function public.same_card_search(p_name text, p_exclude uuid default null)
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  with m as materialized (
    select c.user_id, c.nom, c.equipe, c.image_recto, c.annee, c.marque, c.collection, c.variation, c.num, c.rc, c.auto, c.patch
    from public.cartes_manuelles c
    where c.nom ilike '%' || replace(replace(replace(p_name, '\', '\'), '%', '\%'), '_', '\_') || '%'
      and (p_exclude is null or c.user_id <> p_exclude)
  )
  select jsonb_build_object(
           'user_id', m.user_id, 'nom', m.nom, 'equipe', m.equipe, 'image_recto', m.image_recto, 'annee', m.annee, 'marque', m.marque,
           'collection', m.collection, 'variation', m.variation, 'num', m.num, 'rc', m.rc, 'auto', m.auto, 'patch', m.patch)
  from m
  where m.user_id = (select auth.uid())
     or not exists (select 1 from public.cartes_privees x where x.user_id = m.user_id and x.card_key = m.image_recto)
  order by m.user_id, m.image_recto
$$;

revoke all on function public.same_card_search(text, uuid) from public;
grant execute on function public.same_card_search(text, uuid) to anon, authenticated, service_role;
