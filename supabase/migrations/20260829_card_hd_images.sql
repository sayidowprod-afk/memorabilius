-- Colonnes pour les versions haute resolution (non compressees) de recto/verso,
-- utilisees uniquement par le Viewer3D. Le reste du site (galerie, trades, etc.)
-- continue d'utiliser image_recto/image_verso (compressees 600x840).
alter table cartes_manuelles
  add column if not exists image_recto_hd text,
  add column if not exists image_verso_hd text;
