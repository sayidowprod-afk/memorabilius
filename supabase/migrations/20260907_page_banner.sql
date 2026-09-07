-- Banniere de galerie personnalisee (membres Federation de la carte),
-- distincte du fond de page (page_bg) : couleur/degrade ou image, affichee
-- en bande au-dessus de l'en-tete de profil.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS page_banner text;
