-- Politique UPDATE manquante sur card_collections
-- Sans elle, upsert avec DO UPDATE échoue silencieusement (RLS bloque)
DROP POLICY IF EXISTS "card_collections_update" ON card_collections;
CREATE POLICY "card_collections_update" ON card_collections
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
