-- Les 4 endroits de BinderLibrary.tsx qui réorganisent des pochettes
-- (changement de mise en page, tri, glisser-déposer, insertion avec décalage)
-- faisaient chacun un DELETE puis un INSERT séparés depuis le client — sans
-- transaction, un échec réseau/timeout entre les deux (courant sur mobile)
-- supprimait des cartes du classeur sans jamais les réinsérer, avec pour
-- seul recours un catch qui affiche une erreur mais ne restaure rien.
--
-- SECURITY INVOKER (par défaut) : la fonction s'exécute avec les droits de
-- l'appelant, donc les policies RLS existantes de binder_slots (delete/insert
-- vérifiant la propriété du classeur via binders.user_id) s'appliquent
-- normalement — aucune vérification de propriété à dupliquer ici.
CREATE OR REPLACE FUNCTION replace_binder_slots(p_binder_id bigint, p_deletes jsonb, p_inserts jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_deletes IS NOT NULL AND jsonb_array_length(p_deletes) > 0 THEN
    DELETE FROM binder_slots bs
    USING jsonb_to_recordset(p_deletes) AS d(page_number int, slot_index int)
    WHERE bs.binder_id = p_binder_id
      AND bs.page_number = d.page_number
      AND bs.slot_index = d.slot_index;
  END IF;

  IF p_inserts IS NOT NULL AND jsonb_array_length(p_inserts) > 0 THEN
    INSERT INTO binder_slots (binder_id, page_number, slot_index, card_key, img, img_back, nom, is_horizontal)
    SELECT
      p_binder_id,
      (r->>'page_number')::int,
      (r->>'slot_index')::int,
      r->>'card_key',
      r->>'img',
      r->>'img_back',
      r->>'nom',
      COALESCE((r->>'is_horizontal')::boolean, false)
    FROM jsonb_array_elements(p_inserts) AS r;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION replace_binder_slots(bigint, jsonb, jsonb) TO authenticated;
