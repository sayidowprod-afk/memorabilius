-- Ajout du pays (depuis user_countries) dans la liste des derniers inscrits
CREATE OR REPLACE FUNCTION admin_get_recent_users(p_limit INT DEFAULT 25)
RETURNS TABLE(
  user_id      UUID,
  display_name TEXT,
  slug         TEXT,
  email        TEXT,
  created_at   TIMESTAMPTZ,
  cards_count  BIGINT,
  country      TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    u.id,
    COALESCE(p.display_name, split_part(u.email, '@', 1)) AS display_name,
    p.slug,
    u.email,
    u.created_at,
    COALESCE((
      SELECT COUNT(*)::BIGINT
      FROM cartes_manuelles cm
      WHERE cm.user_id = u.id
    ), 0) AS cards_count,
    NULLIF(uc.country, 'XX') AS country
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  LEFT JOIN user_countries uc ON uc.user_id = u.id
  ORDER BY u.created_at DESC
  LIMIT p_limit;
$$;
