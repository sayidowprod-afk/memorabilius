-- Colonne date de deces pour sports_birthdays (bot anniversaire Discord) --
-- permet de distinguer "c'est l'anniversaire de X" de "X aurait eu Y ans
-- aujourd'hui" pour un joueur decede. A executer dans Supabase SQL Editor.

ALTER TABLE sports_birthdays ADD COLUMN IF NOT EXISTS death_date date;
