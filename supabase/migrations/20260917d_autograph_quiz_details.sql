-- Infos supplementaires affichees a droite de la carte au moment de la
-- revelation cote presentateur : badges (RC/AUTO/PATCH/numerotation),
-- annee/marque/collection, et qui possede la carte (display_name).
alter table autograph_quiz_cards add column if not exists rc boolean not null default false;
alter table autograph_quiz_cards add column if not exists patch boolean not null default false;
alter table autograph_quiz_cards add column if not exists num text;
alter table autograph_quiz_cards add column if not exists annee text;
alter table autograph_quiz_cards add column if not exists marque text;
alter table autograph_quiz_cards add column if not exists collection text;
alter table autograph_quiz_cards add column if not exists owner_name text;
