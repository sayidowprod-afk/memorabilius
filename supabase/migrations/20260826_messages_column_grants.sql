-- La policy UPDATE "Marquer lu" (auth.uid() = to_user_id) restreint QUELLES
-- LIGNES un destinataire peut modifier, mais pas QUELLES COLONNES — sans
-- restriction de colonnes, le destinataire d'un message pouvait aussi
-- réécrire son `contenu` (ou d'autres colonnes) après réception, ce qui
-- changerait ce que l'expéditeur voit aussi avoir écrit dans la même
-- conversation. Seuls `lu` et `reaction` sont réellement modifiés côté
-- client (confirmé : grep de tous les .from('messages').update(...) de
-- l'app), donc on retire le droit UPDATE sur toutes les autres colonnes.
REVOKE UPDATE ON messages FROM authenticated;
GRANT UPDATE (lu, reaction) ON messages TO authenticated;
