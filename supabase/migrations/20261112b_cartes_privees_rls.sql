-- Cartes privées réellement privées (audit de sécurité du 2026-11-07).
-- Avant : « Voir ses cartes » (SELECT, rôle public, using true) laissait n'importe qui lire TOUTES les cartes via l'API,
-- le masquage des cartes privées se faisant seulement dans l'affichage du site. La liste cartes_privees était lisible par tous.
-- Après : un visiteur ne voit que les cartes qui ne sont pas marquées privées ; le propriétaire voit toutes les siennes.
--
-- À appliquer avec un contrôle juste après : ta galerie (connecté), celle d'un autre membre (cartes privées absentes), l'accueil.
-- Pour revenir en arrière en cas de souci :
--   drop policy if exists "Voir les cartes non privées ou les siennes" on public.cartes_manuelles;
--   create policy "Voir ses cartes" on public.cartes_manuelles for select to public using (true);
--   drop policy if exists "Voir ses cartes privées" on public.cartes_privees;
--   create policy "Voir cartes privées" on public.cartes_privees for select to public using (true);
create index if not exists cartes_privees_user_card_idx on public.cartes_privees (user_id, card_key);

drop policy if exists "Voir ses cartes" on public.cartes_manuelles;
drop policy if exists "Voir les cartes non privées ou les siennes" on public.cartes_manuelles;
create policy "Voir les cartes non privées ou les siennes" on public.cartes_manuelles for select to anon, authenticated
  using (
    (select auth.uid()) = user_id
    or not exists (
      select 1 from public.cartes_privees p
      where p.user_id = cartes_manuelles.user_id and p.card_key = cartes_manuelles.image_recto
    )
  );

drop policy if exists "Voir cartes privées" on public.cartes_privees;
drop policy if exists "Voir ses cartes privées" on public.cartes_privees;
create policy "Voir ses cartes privées" on public.cartes_privees for select to authenticated
  using ((select auth.uid()) = user_id);
