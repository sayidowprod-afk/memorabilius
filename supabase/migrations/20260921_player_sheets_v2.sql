-- Suite de 20260921_player_sheets.sql (deja appliquee en prod) -- ajoute les
-- colonnes de stats supplementaires (matchs/minutes/pays/age) et l'ordre
-- d'affichage en drag-and-drop, via ALTER plutot qu'en modifiant le fichier
-- deja execute.

alter table player_sheets add column if not exists stat_matches text;
alter table player_sheets add column if not exists stat_minutes text;
alter table player_sheets add column if not exists stat_country text;
alter table player_sheets add column if not exists stat_age text;
alter table player_sheets add column if not exists sort_order integer not null default 0;

-- Backfill : ordre initial base sur la date de creation pour les fiches deja
-- existantes (sinon toutes a 0, donc pas d'ordre stable au premier chargement).
with ordered as (
  select id, row_number() over (partition by team_abbr order by created_at) - 1 as rn
  from player_sheets
)
update player_sheets p set sort_order = o.rn
from ordered o
where p.id = o.id and p.sort_order = 0;

create index if not exists player_sheets_team_order_idx on player_sheets(team_abbr, sort_order);
