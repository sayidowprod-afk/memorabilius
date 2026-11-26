-- Toujours en cours au moment de ce commit (timeouts 57014 constates en
-- direct, 25 oct ~03:50 UTC) : get_player_sets_unaccent et
-- search_player_entries_unaccent filtrent le prenom efficacement (prefix-
-- range sur l'index idx_cse_player_name_unaccent existant) mais le nom de
-- famille utilise LIKE '%...%' sur immutable_unaccent(lower(player_name)) --
-- un pattern "contient" qu'aucun index btree ne peut servir. Pour un prenom
-- courant/court, le prefix-range seul laisse encore beaucoup de lignes a
-- filtrer en sequentiel sur card_set_entries (14,8M lignes).
-- CONCURRENTLY : table volumineuse, ne doit pas verrouiller en ecriture
-- pendant la construction (meme precaution que idx_card_set_entries_team_trgm
-- hier -- necessite une session avec statement_timeout releve, voir la
-- procedure utilisee pour cet index).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cse_player_name_unaccent_trgm
  ON card_set_entries USING gin (immutable_unaccent(lower(player_name)) gin_trgm_ops);
