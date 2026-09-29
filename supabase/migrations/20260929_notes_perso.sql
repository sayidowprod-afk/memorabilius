-- Notes personnelles sur une carte (ex: "auto in person", prix d'achat...) --
-- jamais affichees publiquement, uniquement visibles/editables par le
-- proprietaire sur ses pages d'ajout/edition de carte.
alter table cartes_manuelles add column if not exists notes_perso text;
