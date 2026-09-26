-- Historique des equipes NBA du joueur (recupere via ESPN), affiche sur la
-- fiche et en presentation. jsonb : tableau ordonne de passages
-- [{ slug, abbr, name, logo, logoDark, from, to }].
alter table player_sheets add column if not exists team_history jsonb;
