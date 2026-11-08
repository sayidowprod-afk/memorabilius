-- Wishlist : équipe facultative (ex. « Iguodala » seulement chez les « 76ers »). Relançable sans risque.
-- Aucune règle d'accès à changer : la colonne suit celles de la table wishlist.
alter table public.wishlist add column if not exists equipe text;
