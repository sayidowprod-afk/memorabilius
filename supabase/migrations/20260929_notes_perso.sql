-- Notes personnelles sur une carte (ex: "auto in person", prix d'achat...) --
-- privees par defaut, l'utilisateur choisit s'il veut les rendre visibles sur
-- la fiche publique de la carte (notes_perso_public).
alter table cartes_manuelles add column if not exists notes_perso text;
alter table cartes_manuelles add column if not exists notes_perso_public boolean not null default false;
