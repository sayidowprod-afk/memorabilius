-- Les cartes "horizontales" (paysage) sont stockées dans leur orientation brute
-- (portrait, tournée) -- l'affichage upright se fait via rotation CSS/canvas
-- ailleurs dans l'app (voir GalerieClient.tsx). Sans cette info sur les entrées
-- du quiz, la signature s'affichait de travers au présentateur.
alter table autograph_quiz_cards add column if not exists is_horizontal boolean not null default false;
