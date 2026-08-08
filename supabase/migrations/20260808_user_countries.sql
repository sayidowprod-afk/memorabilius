-- Table pays par compte utilisateur — admin only, service_role uniquement
CREATE TABLE IF NOT EXISTS public.user_countries (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  country    char(2) NOT NULL DEFAULT 'XX',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS activé sans aucune policy → inaccessible via anon/authenticated key
-- Seul le service_role (API routes admin) peut lire/écrire
ALTER TABLE public.user_countries ENABLE ROW LEVEL SECURITY;

-- RPC : distribution des comptes par pays (pour la carte admin)
-- p_minutes NULL = toujours, sinon filtre sur updated_at (dernière activité)
-- Exemples : 15 = en direct, 10080 = 7j, 43200 = 30j
CREATE OR REPLACE FUNCTION get_users_country_breakdown(p_minutes int DEFAULT NULL)
RETURNS TABLE(country text, count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT country::text, count(*) AS count
  FROM public.user_countries
  WHERE country != 'XX'
    AND (p_minutes IS NULL OR updated_at >= now() - (p_minutes || ' minutes')::interval)
  GROUP BY country
  ORDER BY count DESC;
$$;

-- RPC : liste des utilisateurs pour un pays donné (pour le drilldown admin)
CREATE OR REPLACE FUNCTION get_users_by_country(p_country text)
RETURNS TABLE(
  user_id        uuid,
  email          text,
  display_name   text,
  created_at     timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    uc.user_id,
    au.email,
    COALESCE(p.display_name, au.email) AS display_name,
    au.created_at,
    au.last_sign_in_at
  FROM public.user_countries uc
  JOIN auth.users au ON au.id = uc.user_id
  LEFT JOIN public.profiles p ON p.id = uc.user_id
  WHERE uc.country = p_country
    AND uc.country != 'XX'
  ORDER BY au.last_sign_in_at DESC NULLS LAST
  LIMIT 200;
$$;
