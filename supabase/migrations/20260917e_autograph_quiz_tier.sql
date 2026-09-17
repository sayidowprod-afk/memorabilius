-- Tier list en direct : apres avoir devine le joueur, l'animateur classe la
-- carte (S/A/B/C/D). Null tant que non classee.
alter table autograph_quiz_cards add column if not exists tier text;
