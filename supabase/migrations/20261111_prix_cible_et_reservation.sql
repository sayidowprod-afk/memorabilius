-- 415 : prix cible par carte de wishlist (alerte quand une carte correspondante est mise en vente à ce prix ou moins)
-- 417 : statut « réservée » d'une carte à vendre (posé quand une offre est acceptée, levé par le vendeur)
-- Deux colonnes ajoutées à des tables existantes : aucun nouvel accès à accorder (les GRANT de ces tables restent valables).
alter table public.wishlist add column if not exists prix_cible numeric(10, 2) check (prix_cible is null or (prix_cible > 0 and prix_cible <= 100000));
alter table public.cartes_manuelles add column if not exists reservee_pour uuid references auth.users (id) on delete set null;
alter table public.cartes_manuelles add column if not exists reservee_at timestamptz;
