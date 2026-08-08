-- Table de log des connexions (une ligne par session créée)
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id         bigserial PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_created_at ON public.user_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id    ON public.user_sessions(user_id, created_at DESC);

-- Trigger : insère un log à chaque nouvelle session auth (= chaque connexion réelle)
CREATE OR REPLACE FUNCTION public.track_user_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_sessions (user_id, created_at)
  VALUES (NEW.user_id, NEW.created_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_session_created ON auth.sessions;
CREATE TRIGGER on_auth_session_created
  AFTER INSERT ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION public.track_user_login();

-- Mise à jour de get_signins_by_day : lit user_sessions (exact, historique complet)
-- DISTINCT user_id = DAU réels (un user qui se reconnecte plusieurs fois compte une fois)
CREATE OR REPLACE FUNCTION get_signins_by_day()
RETURNS TABLE(day text, count int)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
    count(DISTINCT user_id)::int AS count
  FROM public.user_sessions
  WHERE created_at >= now() - interval '8 days'
  GROUP BY date_trunc('day', created_at AT TIME ZONE 'UTC')
  ORDER BY day;
$$;
