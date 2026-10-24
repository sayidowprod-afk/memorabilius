-- Supabase Advisor (securite, CRITICAL) : player_card_counts, csv_cards_cache
-- et player_photo_cache sont publiques sans RLS -- n'importe quel appelant
-- avec la cle anon (publique, embarquee cote client) pouvait lire/ecrire/
-- corrompre ces tables de cache directement via PostgREST.
--
-- Aucune n'en a besoin : csv_cards_cache et player_photo_cache ne sont
-- jamais touchees que via le client service role (cacheDb dans
-- csvCardsCache.ts / espnHeadshot.ts), qui contourne RLS de toute facon.
-- player_card_counts n'est lue que via la RPC search_players_by_count,
-- SECURITY DEFINER, qui contourne RLS elle aussi. On active RLS sans
-- aucune policy publique (deny par defaut) et on retire les GRANT directs
-- qui n'etaient pas necessaires.
ALTER TABLE player_photo_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_cards_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_card_counts ENABLE ROW LEVEL SECURITY;

REVOKE SELECT, INSERT, UPDATE ON player_photo_cache FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE ON csv_cards_cache FROM anon, authenticated;
REVOKE SELECT ON player_card_counts FROM anon, authenticated;
