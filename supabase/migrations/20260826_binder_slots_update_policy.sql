-- binder_slots avait des policies select/insert/delete (20260702_binders.sql)
-- mais aucune policy UPDATE. Sans elle, un UPDATE passe silencieusement (0
-- ligne affectée, pas d'erreur remontée par PostgREST) au lieu d'être
-- rejeté bruyamment — repéré via BinderLibrary.tsx (fixOrientationIfLoaded)
-- qui corrige l'orientation d'une carte en état local mais dont l'update
-- n'atteignait jamais réellement la base : la correction "tenait" pour la
-- session en cours puis revenait à l'orientation d'origine au rechargement.
CREATE POLICY "binder_slots_update" ON binder_slots FOR UPDATE TO authenticated
  USING (auth.uid() = (SELECT user_id FROM binders WHERE id = binder_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM binders WHERE id = binder_id));
