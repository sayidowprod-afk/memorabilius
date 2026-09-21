-- Metadonnees de la carte choisie (marque, annee, numero, proprietaire) --
-- affichees sur la fiche/presentation. Un seul champ jsonb plutot que
-- plusieurs colonnes texte : la forme varie selon la source de la carte
-- (galerie d'un collectionneur, base de checklist, import CSV, upload libre).
alter table player_sheets add column if not exists card_meta jsonb;
