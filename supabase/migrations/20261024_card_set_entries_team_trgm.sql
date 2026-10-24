-- Incident production (2026-10-24, ~06:17-07:00) : "canceling statement due
-- to statement timeout" en masse sur Postgres. Cause : card_set_entries
-- (14,8M+ lignes) n'avait aucun index sur la colonne "team", et les
-- nouvelles routes /api/team-sets et /api/team-cards relancent
-- ilike('team', '%mot%') en DIRECT a chaque defilement d'une page equipe
-- (avant, cette requete ne tournait qu'une fois par 24h via l'ISR de
-- equipe/[slug]/page.tsx) -- scan sequentiel complet de la table a chaque
-- appel, sous la charge ca a fait timeout en cascade d'autres requetes.
-- CONCURRENTLY : evite de verrouiller la table pendant la creation (site en
-- production sous charge actuellement, 14,8M+ lignes a indexer).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_card_set_entries_team_trgm
  ON card_set_entries USING gin (team gin_trgm_ops);
