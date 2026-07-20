-- Indique si une carte est disponible à la vente ou au trade
alter table cartes_manuelles add column if not exists disponible_vente boolean default false;
