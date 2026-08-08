-- Couleur personnalisable par bibliothèque (dossier de classeurs)
ALTER TABLE binder_folders ADD COLUMN IF NOT EXISTS color text DEFAULT '#4a6741';
