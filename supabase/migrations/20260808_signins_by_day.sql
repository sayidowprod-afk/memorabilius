-- Compte les connexions par jour (last_sign_in_at) depuis auth.users
-- Utilisé par admin/stats pour la colonne "Actifs (connexions)"
CREATE OR REPLACE FUNCTION get_signins_by_day()
RETURNS TABLE(day text, count int)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    to_char(date_trunc('day', last_sign_in_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
    count(*)::int AS count
  FROM auth.users
  WHERE last_sign_in_at >= now() - interval '8 days'
  GROUP BY date_trunc('day', last_sign_in_at AT TIME ZONE 'UTC')
  ORDER BY day;
$$;
