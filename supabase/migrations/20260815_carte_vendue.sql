-- Statut "vendue" : distinct de disponible_vente (en vente), permet de garder
-- une carte vendue visible dans la galerie tout en la marquant comme telle.
ALTER TABLE cartes_manuelles ADD COLUMN IF NOT EXISTS vendue boolean DEFAULT false;
