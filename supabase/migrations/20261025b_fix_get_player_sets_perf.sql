-- Perf (2026-10-25) : get_player_sets / get_player_sets_unaccent faisaient un
-- ILIKE/LIKE '%last_name%' (substring n'importe ou dans la chaine) sur 15M de
-- lignes. Pour un fragment court/courant (ex: "Jo"/"er"), ca matchait plus
-- d'1 million de lignes et prenait jusqu'a 42s+ par appel (verifie en prod),
-- saturant le CPU de l'instance pour TOUT le site (pas seulement la page
-- joueur) le temps de l'execution. Fix : n'accepter le nom de famille qu'en
-- DEBUT de mot (prefixe du nom complet, ou prefixe apres un espace) au lieu
-- de "contient n'importe ou" -- resultat identique pour un vrai nom de
-- famille (qui commence toujours un mot), beaucoup plus selectif. + LIMIT de
-- securite (30000, calibre sur LeBron James ~19.8k entrees reelles) en garde-
-- fou dur contre tout cas pathologique restant.
CREATE OR REPLACE FUNCTION public.get_player_sets(p_first text, p_last text)
RETURNS TABLE(id bigint, name text, year integer, brand text, sport text, is_rc boolean, variations text[])
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  WITH matched_entries AS (
    SELECT e.set_id, e.is_rc, e.variation
    FROM card_set_entries e
    WHERE e.player_name ILIKE (p_first || '%')
      AND (e.player_name ILIKE (p_last || '%') OR e.player_name ILIKE ('% ' || p_last || '%'))
    LIMIT 30000
  )
  SELECT
    cs.id,
    cs.name,
    cs.year,
    cs.brand,
    cs.sport,
    bool_or(me.is_rc) AS is_rc,
    array_remove(array_agg(DISTINCT me.variation), NULL) AS variations
  FROM matched_entries me
  JOIN card_sets cs ON cs.id = me.set_id
  GROUP BY cs.id, cs.name, cs.year, cs.brand, cs.sport
  ORDER BY cs.year DESC NULLS LAST;
$function$;

CREATE OR REPLACE FUNCTION public.get_player_sets_unaccent(p_first text, p_last text)
RETURNS TABLE(id integer, name text, year integer, brand text, sport text, is_rc boolean, variations text[])
LANGUAGE sql
STABLE
AS $function$
  WITH matched_entries AS (
    SELECT e.set_id, e.is_rc, e.variation
    FROM card_set_entries e
    WHERE immutable_unaccent(lower(e.player_name)) >= immutable_unaccent(lower(p_first))
      AND immutable_unaccent(lower(e.player_name)) <  immutable_unaccent(lower(p_first)) || chr(1114111)
      AND (
        immutable_unaccent(lower(e.player_name)) LIKE (immutable_unaccent(lower(p_last)) || '%')
        OR immutable_unaccent(lower(e.player_name)) LIKE ('% ' || immutable_unaccent(lower(p_last)) || '%')
      )
    LIMIT 30000
  )
  SELECT s.id, s.name, s.year, s.brand, s.sport,
         bool_or(me.is_rc) AS is_rc,
         array_agg(DISTINCT me.variation) FILTER (WHERE me.variation IS NOT NULL) AS variations
  FROM matched_entries me
  JOIN card_sets s ON s.id = me.set_id
  GROUP BY s.id, s.name, s.year, s.brand, s.sport;
$function$;
