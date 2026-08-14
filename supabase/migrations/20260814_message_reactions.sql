-- Réaction emoji (façon Instagram) sur un message du chat privé.
-- Une seule réaction par message (chat 1:1, pas besoin d'un compteur multi-utilisateurs).
alter table messages add column if not exists reaction text;
