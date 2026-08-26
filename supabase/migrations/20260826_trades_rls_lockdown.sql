-- La policy trade_offers_update (20260715_trades_rls.sql) autorisait sender OU
-- receiver à modifier la ligne vers N'IMPORTE QUEL statut, sans WITH CHECK :
-- l'API route (src/app/api/trades/[id]/route.ts) applique bien la règle
-- "seul le receiver accepte/refuse, seul le sender annule" mais uniquement en
-- code applicatif via le service role — un appel direct au client Supabase
-- (anon/authenticated key, déjà exposée côté client dans cette app) pouvait
-- contourner cette règle et faire passer une offre à 'accepted' unilatéralement.
--
-- USING : seule une offre encore 'pending' peut être modifiée par une des deux
-- parties (ferme aussi la fenêtre de course avec l'API — le verrou de ligne
-- Postgres pendant l'UPDATE rend la vérification atomique).
-- WITH CHECK : le nouveau statut doit correspondre au rôle de l'appelant —
-- le sender ne peut aller que vers 'cancelled', le receiver que vers
-- 'accepted'/'refused'.
DROP POLICY IF EXISTS "trade_offers_update" ON trade_offers;

CREATE POLICY "trade_offers_update" ON trade_offers
  FOR UPDATE
  USING (
    status = 'pending' AND (auth.uid() = sender_id OR auth.uid() = receiver_id)
  )
  WITH CHECK (
    (auth.uid() = sender_id AND status = 'cancelled')
    OR (auth.uid() = receiver_id AND status IN ('accepted', 'refused'))
  );
