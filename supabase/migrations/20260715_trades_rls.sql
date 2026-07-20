-- RLS policies pour trade_offers et trade_offer_cards
-- À exécuter dans le SQL Editor du dashboard Supabase

ALTER TABLE trade_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_offer_cards ENABLE ROW LEVEL SECURITY;

-- trade_offers : lecture si on est sender ou receiver
CREATE POLICY "trade_offers_select" ON trade_offers
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- trade_offers : insertion si on est le sender
CREATE POLICY "trade_offers_insert" ON trade_offers
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- trade_offers : mise à jour si on est sender (cancel) ou receiver (accept/refuse)
CREATE POLICY "trade_offers_update" ON trade_offers
  FOR UPDATE USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- trade_offer_cards : lecture si on est impliqué dans le trade
CREATE POLICY "trade_offer_cards_select" ON trade_offer_cards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trade_offers
      WHERE trade_offers.id = trade_offer_cards.trade_id
        AND (trade_offers.sender_id = auth.uid() OR trade_offers.receiver_id = auth.uid())
    )
  );

-- trade_offer_cards : insertion via service role uniquement (API route)
-- Pas de policy INSERT pour le client anon : l'API utilise le service role key
