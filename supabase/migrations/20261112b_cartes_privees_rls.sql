-- Cartes privées réellement privées (audit de sécurité du 2026-11-07), version corrigée.
-- Avant : « Voir ses cartes » (SELECT, rôle public, using true) laissait n'importe qui lire TOUTES les cartes via l'API,
-- le masquage des cartes privées se faisant seulement dans l'affichage du site.
-- Après : un visiteur ne voit que les cartes qui ne sont pas marquées privées ; le propriétaire voit toutes les siennes.
--
-- Le test « cette carte est-elle privée ? » passe par une fonction SECURITY DEFINER : une sous-requête écrite directement dans la
-- règle serait soumise aux règles de lecture de cartes_privees (vide pour un visiteur), donc ne verrait aucune carte privée.
-- La liste cartes_privees reste lisible : le site s'en sert pour masquer les cartes de l'import CSV (qui ne sont pas dans la base).
--
-- Retour en arrière :
--   drop policy if exists "Voir les cartes non privées ou les siennes" on public.cartes_manuelles;
--   create policy "Voir ses cartes" on public.cartes_manuelles for select to public using (true);
create index if not exists cartes_privees_user_card_idx on public.cartes_privees (user_id, card_key);

create or replace function public.is_card_private(p_owner uuid, p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cartes_privees where user_id = p_owner and card_key = p_key)
$$;
revoke all on function public.is_card_private(uuid, text) from public;
grant execute on function public.is_card_private(uuid, text) to anon, authenticated, service_role;

drop policy if exists "Voir ses cartes" on public.cartes_manuelles;
drop policy if exists "Voir les cartes non privées ou les siennes" on public.cartes_manuelles;
create policy "Voir les cartes non privées ou les siennes" on public.cartes_manuelles for select to anon, authenticated
  using ((select auth.uid()) = user_id or not public.is_card_private(user_id, image_recto));

drop policy if exists "Voir ses cartes privées" on public.cartes_privees;
drop policy if exists "Voir cartes privées" on public.cartes_privees;
create policy "Voir cartes privées" on public.cartes_privees for select to public using (true);
