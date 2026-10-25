-- Perf (2026-10-25) : /api/team-sets recuperait TOUTES les lignes
-- card_set_entries matchant l'equipe (jusqu'a 131k lignes pour un nom
-- courant comme "Tigers", 1.4s) juste pour en extraire les set_id distincts
-- cote JS. Le GROUP BY cote DB (529ms, 2.6x plus rapide) + bien moins de
-- donnees transferees sur le reseau.
CREATE OR REPLACE FUNCTION public.get_team_sets(p_team_pattern text)
RETURNS TABLE(id integer, name text, year integer, brand text, sport text)
LANGUAGE sql
STABLE
AS $function$
  WITH matched AS (
    SELECT set_id FROM card_set_entries
    WHERE team ILIKE ('%' || p_team_pattern || '%')
    LIMIT 20000
  )
  SELECT cs.id, cs.name, cs.year, cs.brand, cs.sport
  FROM matched m
  JOIN card_sets cs ON cs.id = m.set_id
  GROUP BY cs.id, cs.name, cs.year, cs.brand, cs.sport;
$function$;

-- Meme logique pour equipe/[slug]/page.tsx, qui recuperait aussi TOUTES les
-- lignes (avec player_name en plus, join plus lourd) juste pour en deduire
-- la liste des joueurs de la franchise. GROUP BY cote DB.
CREATE OR REPLACE FUNCTION public.get_team_players(p_team_pattern text)
RETURNS TABLE(name text, is_rc boolean)
LANGUAGE sql
STABLE
AS $function$
  WITH matched AS (
    SELECT player_name, is_rc
    FROM card_set_entries
    WHERE team ILIKE ('%' || p_team_pattern || '%') AND player_name IS NOT NULL
    LIMIT 3000
  )
  SELECT player_name, bool_or(is_rc) AS is_rc
  FROM matched
  GROUP BY player_name
  LIMIT 30;
$function$;
