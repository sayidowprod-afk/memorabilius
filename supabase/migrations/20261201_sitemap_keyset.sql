-- Perf (2026-11-17) : sitemap_cards_page (offset profond) mesuré à 513 ms pour la page 50 000 : trop lent (la base trie tout à chaque page).
-- Remplacée par une pagination « par curseur » (id > dernier id vu) qui lit l'index de la clé primaire et s'arrête après 1 000 lignes.
--   sitemap_start_id(offset)          : id de la carte située à cette position (sert à découper le sitemap en tranches de 5 000 ; ignore les cartes privées, sans conséquence pour des bornes)
--   sitemap_cards_after(after, until, limit) : les cartes visibles qui suivent `after` (jusqu'à `until` inclus), triées par id
-- Droits identiques : seules les cartes non privées sont renvoyées.
--
-- Retour en arrière : drop function public.sitemap_start_id(integer); drop function public.sitemap_cards_after(uuid, uuid, integer);

drop function if exists public.sitemap_cards_page(integer, integer);

create or replace function public.sitemap_start_id(p_offset integer)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id from public.cartes_manuelles c
  where c.image_recto is not null
  order by c.id
  offset greatest(p_offset, 0) limit 1
$$;

create or replace function public.sitemap_cards_after(p_after uuid, p_until uuid, p_limit integer)
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
    and (p_after is null or c.id > p_after)
    and (p_until is null or c.id <= p_until)
    and not exists (select 1 from public.cartes_privees x where x.user_id = c.user_id and x.card_key = c.image_recto)
  order by c.id
  limit least(greatest(p_limit, 1), 1000)
$$;

revoke all on function public.sitemap_start_id(integer) from public;
revoke all on function public.sitemap_cards_after(uuid, uuid, integer) from public;
grant execute on function public.sitemap_start_id(integer) to anon, authenticated, service_role;
grant execute on function public.sitemap_cards_after(uuid, uuid, integer) to anon, authenticated, service_role;
