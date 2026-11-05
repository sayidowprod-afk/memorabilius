-- 120 · Calendrier des sorties de produits (basket) : alimenté automatiquement chaque semaine par /api/cron/sorties-produits.
CREATE TABLE IF NOT EXISTS public.card_releases (
  id           bigserial PRIMARY KEY,
  name         text NOT NULL,
  release_date date NOT NULL,
  formats      text[] NOT NULL DEFAULT '{}',
  source       text NOT NULL DEFAULT 'cardsmithsbreaks',
  source_url   text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, release_date)
);
CREATE INDEX IF NOT EXISTS idx_card_releases_date ON public.card_releases (release_date);

ALTER TABLE public.card_releases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_releases lecture publique" ON public.card_releases;
CREATE POLICY "card_releases lecture publique" ON public.card_releases FOR SELECT USING (true);

-- Depuis le 2026-10-30, plus d'auto-grant API sur les nouvelles tables public : grants explicites
GRANT SELECT ON public.card_releases TO anon, authenticated;
GRANT ALL ON public.card_releases TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.card_releases_id_seq TO service_role;
