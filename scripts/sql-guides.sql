-- Table pour la section "Guides" (articles admin)
-- À exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS guides (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  cover_image TEXT,
  category TEXT,
  content TEXT NOT NULL,          -- HTML produit par l'éditeur riche (Tiptap)
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guides_published ON guides(published, published_at DESC);

ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read published guides" ON guides
  FOR SELECT USING (published = true AND published_at <= now());

CREATE POLICY "admin full access guides" ON guides
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Blocs riches additionnels (pyramide de variations, grille d'inserts, setlist
-- embarquée) — colonne ajoutée après coup, ALTER idempotent. Si tu as déjà exécuté
-- ce script une première fois, tu peux exécuter SEULEMENT cette ligne :
ALTER TABLE guides ADD COLUMN IF NOT EXISTS blocks JSONB DEFAULT '[]'::jsonb;

-- Bibliothèque de modèles de pyramide réutilisables entre guides (nouvelle table -
-- si tu as déjà exécuté ce script une première fois, tu peux exécuter SEULEMENT ce
-- bloc). Admin-only en lecture ET écriture (pas de policy publique : cette table
-- n'est jamais lue en dehors de l'éditeur admin).
CREATE TABLE IF NOT EXISTS pyramid_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pyramid_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin full access pyramid_templates" ON pyramid_templates
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Après avoir exécuté ce script :
-- 1. Storage → New bucket → nom "guide-images", cocher "Public bucket"
-- 2. Sur ce bucket, Policies → ajouter :
--    - SELECT (lecture) : "true" (public)
--    - INSERT/UPDATE/DELETE (écriture) : réservé aux admins, ex.
--      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
