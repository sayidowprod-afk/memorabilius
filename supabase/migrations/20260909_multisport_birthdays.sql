-- Etend le systeme d'anniversaires Discord (jusque-la NBA uniquement) a 4
-- sports supplementaires : NFL, MLB, NHL, Football (soccer, top 5 ligues
-- europeennes). Renomme la table joueurs pour refleter cette portee
-- multi-sport ; nba_birthday_posts reste tel quel (deja agnostique du sport,
-- suit juste "un anniversaire a ete traite ce jour-la" toutes disciplines
-- confondues -- un seul post/thread par jour, peu importe le sport).

ALTER TABLE nba_allstar_birthdays RENAME TO sports_birthdays;
ALTER TABLE sports_birthdays ADD COLUMN sport text NOT NULL DEFAULT 'nba';
ALTER TABLE sports_birthdays ALTER COLUMN sport DROP DEFAULT;

-- L'ancien index (mois, jour) ne suffit plus a lui seul : deux joueurs de
-- sports differents nes le meme jour sont deux candidats distincts, mais on
-- veut aussi pouvoir filtrer/lister par sport efficacement.
DROP INDEX IF EXISTS nba_allstar_birthdays_month_day_idx;
CREATE INDEX IF NOT EXISTS sports_birthdays_month_day_idx ON sports_birthdays (birth_month, birth_day);
CREATE INDEX IF NOT EXISTS sports_birthdays_sport_idx ON sports_birthdays (sport);

-- Un joueur ne peut apparaitre deux fois dans le meme sport (l'ancienne
-- contrainte unique portait sur player_name seul, uniquement valable tant
-- qu'il n'y avait qu'un sport).
ALTER TABLE sports_birthdays DROP CONSTRAINT IF EXISTS nba_allstar_birthdays_player_name_key;
ALTER TABLE sports_birthdays ADD CONSTRAINT sports_birthdays_player_sport_key UNIQUE (player_name, sport);
