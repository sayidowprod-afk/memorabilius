-- Relie chaque sortie du calendrier à son set de la setlist (le bouton « Checklist » mène alors à notre setlist).
ALTER TABLE public.card_releases ADD COLUMN IF NOT EXISTS set_id integer REFERENCES public.card_sets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_card_releases_set_id ON public.card_releases (set_id);
