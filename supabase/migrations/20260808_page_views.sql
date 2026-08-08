-- Table de tracking page vues : path + pays ISO (x-vercel-ip-country header)
CREATE TABLE IF NOT EXISTS page_views (
  id        bigserial PRIMARY KEY,
  path      text        NOT NULL,
  country   char(2)     NOT NULL DEFAULT 'XX',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_country    ON page_views(country, created_at DESC);

-- Pas de RLS : la table est insérée via service_role uniquement (API route côté serveur)
