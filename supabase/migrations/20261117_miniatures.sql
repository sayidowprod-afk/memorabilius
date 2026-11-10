-- Miniatures des cartes pour la grille de la galerie (~50 Ko au lieu de ~150 Ko pour la photo complète).
-- La colonne est facultative : sans elle (ou tant qu'une carte n'a pas de miniature) le site affiche la photo complète, comme avant.
-- À appliquer dans le SQL editor de Supabase.
alter table public.cartes_manuelles add column if not exists image_recto_thumb text;
