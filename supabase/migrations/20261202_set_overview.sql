-- Vue d'ensemble d'un set en UNE requête (page setlist : chiffres, équipes, rookies, signatures).
-- Remplace des centaines de lignes lues côté navigateur : indispensable pour les gros sets (jusqu'à 30 000 cartes).
-- La page garde un repli (lecture par pages) tant que cette fonction n'est pas appliquée.
CREATE OR REPLACE FUNCTION public.get_set_overview(p_set_id integer)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  WITH e AS (
    SELECT id, card_number, player_name, team, variation, is_rc, is_auto, image_url
    FROM card_set_entries WHERE set_id = p_set_id
  ),
  base AS (SELECT * FROM e WHERE variation IS NULL),
  -- les équipes se comptent sur les cartes de base ; si le set n'en a pas, sur toutes les cartes
  tsrc AS (SELECT team FROM base WHERE team IS NOT NULL UNION ALL SELECT team FROM e WHERE team IS NOT NULL AND NOT EXISTS (SELECT 1 FROM base)),
  rk AS (
    SELECT player_name AS name, max(team) AS team, count(*) AS cards, count(*) FILTER (WHERE is_auto) AS autos,
           max(image_url) AS img, min(card_number) FILTER (WHERE variation IS NULL) AS base_num
    FROM e WHERE is_rc GROUP BY player_name
  ),
  sg AS (
    SELECT player_name AS name, max(team) AS team, count(*) AS n
    FROM e WHERE is_auto GROUP BY player_name
  )
  SELECT jsonb_build_object(
    'total',    (SELECT count(*) FROM e),
    'base',     (SELECT count(*) FROM base),
    'rookies',  (SELECT count(*) FROM rk),
    'autos',    (SELECT count(*) FROM e WHERE is_auto),
    'signers',  (SELECT count(*) FROM sg),
    'teams',    (SELECT COALESCE(jsonb_agg(jsonb_build_object('team', team, 'n', n) ORDER BY n DESC), '[]'::jsonb)
                 FROM (SELECT team, count(*) AS n FROM tsrc GROUP BY team) t),
    'rookieTop',(SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
                 FROM (SELECT * FROM rk ORDER BY cards DESC, autos DESC LIMIT 60) r),
    'signerTop',(SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
                 FROM (SELECT * FROM sg ORDER BY n DESC, name LIMIT 300) s),
    'hunt',     (SELECT COALESCE(jsonb_agg(to_jsonb(h)), '[]'::jsonb)
                 FROM (SELECT id, card_number, player_name, team, variation, image_url FROM e WHERE is_rc AND is_auto ORDER BY id LIMIT 6) h)
  );
$function$;
