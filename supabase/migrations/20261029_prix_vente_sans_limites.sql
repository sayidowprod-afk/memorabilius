-- Prix de vente des cartes : plus de minimum (3 €) ni de maximum (100 000 €) imposés -- seulement « strictement positif »
-- (la colonne numeric(10,2) limite elle-même à 99 999 999,99). Idempotent ; ne touche aucune donnée.
alter table public.cartes_manuelles drop constraint if exists cartes_manuelles_prix_vente_check;
alter table public.cartes_manuelles
  add constraint cartes_manuelles_prix_vente_check check (prix_vente is null or prix_vente > 0);
