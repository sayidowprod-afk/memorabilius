-- Perf (2026-11-16) : le Performance Advisor de Supabase signale des règles de sécurité (RLS) en DOUBLE sur cartes_manuelles, la plus grosse table :
-- pour chaque action, la base évalue les deux règles sur chaque ligne et garde le « OU » des deux. Les paires ci-dessous sont équivalentes (ou la première
-- est incluse dans la seconde) : supprimer l'une ne change AUCUN droit d'accès, mais divise le travail de la base sur chaque lecture/écriture de carte.
--
-- SELECT : « select own cards » (ses propres cartes) est incluse dans « Voir les cartes non privées ou les siennes » (ses propres cartes OU les cartes non privées).
-- INSERT : « insert own cards » = « Ajouter une carte » (user_id = auth.uid()).
-- UPDATE : « Modifier sa carte » (USING seul) est couverte par « update own cards » (USING + WITH CHECK, la plus stricte des deux) : on garde cette dernière.
-- DELETE : « delete own cards » = « Supprimer sa carte ».
--
-- Retour en arrière (si besoin) : voir 20260720_cartes_manuelles_rls.sql (création des règles « ... own cards ») et 20261025c_fix_rls_auth_uid_perf.sql.
drop policy if exists "select own cards" on public.cartes_manuelles;
drop policy if exists "insert own cards" on public.cartes_manuelles;
drop policy if exists "Modifier sa carte" on public.cartes_manuelles;
drop policy if exists "delete own cards" on public.cartes_manuelles;

analyze public.cartes_manuelles;
