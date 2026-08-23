-- Champs additionnels pour les annonces (offre/recherche) sur /trades, alignes
-- avec les cartes de la galerie (cartes_manuelles) : collection, numero de carte,
-- numerotation (ex: 25/99). Nom different de "num" (deja utilise dans trades
-- comme tag booleen "a une numerotation" pour le filtre) pour eviter la collision.
alter table trades add column if not exists collection text;
alter table trades add column if not exists card_number text;
alter table trades add column if not exists numerotation text;
