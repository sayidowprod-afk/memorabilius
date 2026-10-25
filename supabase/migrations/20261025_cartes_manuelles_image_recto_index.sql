-- Index trouve par l'audit perf (assistant Supabase, pg_stat_statements) :
-- cartes_manuelles filtree par `image_recto = ANY(...)` (lookup des grail
-- cards, voir fetchInitialPreview dans joueur/[slug]/page.tsx et
-- galerie/[userId]/page.tsx) n'avait aucun index exploitable.
-- Deja appliquee manuellement via l'assistant Supabase -- ce fichier
-- documente la migration dans l'historique sans la reappliquer deux fois
-- (IF NOT EXISTS).
CREATE INDEX IF NOT EXISTS idx_cartes_manuelles_image_recto
  ON public.cartes_manuelles (image_recto)
  INCLUDE (id, is_horizontal)
  WHERE image_recto IS NOT NULL;
