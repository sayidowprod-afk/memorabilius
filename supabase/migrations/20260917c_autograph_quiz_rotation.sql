-- is_horizontal (booleen) ne code que 0 vs 90 -- insuffisant : certaines
-- cartes ont besoin de 180 ou 270 (bouton "Pivoter" doit pouvoir cycler sur
-- les 4 valeurs, pas juste basculer entre deux). rotation_deg remplace
-- is_horizontal comme source de verite pour ce quiz ; is_horizontal reste en
-- place (colonne existante) mais n'est plus lu que pour la valeur de depart.
alter table autograph_quiz_cards add column if not exists rotation_deg integer not null default 0;
update autograph_quiz_cards set rotation_deg = 90 where is_horizontal = true and rotation_deg = 0;
