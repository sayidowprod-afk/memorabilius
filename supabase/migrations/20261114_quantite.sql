-- 445 : quantité par carte (×3). Une seule fiche pour plusieurs exemplaires identiques.
-- La table existe déjà : les droits (GRANT) en place couvrent la nouvelle colonne.
alter table public.cartes_manuelles
  add column if not exists quantite integer not null default 1
  check (quantite >= 1 and quantite <= 999);
