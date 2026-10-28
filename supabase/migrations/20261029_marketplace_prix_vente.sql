-- Marketplace, étape 0 : un prix de vente (EUR) sur les cartes de la galerie.
-- Une carte est « en vente » sur la marketplace quand prix_vente n'est pas NULL
-- (et qu'elle n'est pas marquée vendue). Distinct de disponible_vente, qui mélange
-- vente et échange. Pas de nouvelle table : aucun GRANT à ajouter. Idempotent.
alter table public.cartes_manuelles add column if not exists prix_vente numeric(10,2);

alter table public.cartes_manuelles drop constraint if exists cartes_manuelles_prix_vente_check;
alter table public.cartes_manuelles
  add constraint cartes_manuelles_prix_vente_check check (prix_vente is null or (prix_vente >= 1 and prix_vente <= 100000));

create index if not exists cartes_manuelles_prix_vente_idx
  on public.cartes_manuelles (prix_vente) where prix_vente is not null;
