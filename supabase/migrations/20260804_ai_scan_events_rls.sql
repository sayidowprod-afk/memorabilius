-- RLS pour ai_scan_events (oublié dans la migration initiale)
-- La table est uniquement lue/écrite par les routes API via service role key,
-- qui bypasse RLS — ces policies restreignent uniquement l'accès client anon.

ALTER TABLE ai_scan_events ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs ne voient que leurs propres events (transparence, lecture optionnelle)
CREATE POLICY "ai_scan_events_select_own"
  ON ai_scan_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Insert autorisé uniquement pour son propre user_id (le service role bypass de toute façon)
CREATE POLICY "ai_scan_events_insert_own"
  ON ai_scan_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Delete autorisé pour son propre user_id (purge best-effort applicative)
CREATE POLICY "ai_scan_events_delete_own"
  ON ai_scan_events FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
