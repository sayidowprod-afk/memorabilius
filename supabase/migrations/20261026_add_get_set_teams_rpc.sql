-- Liste des equipes distinctes d'un set, pour peupler le filtre "equipe" de
-- la page setlist sans dependre des variations deja chargees cote client, et
-- sans se faire tronquer a 1000 lignes par le plafond PostgREST (un simple
-- .select('team') sur ~3k entrees aurait pu perdre des equipes en fin de liste).
CREATE OR REPLACE FUNCTION public.get_set_teams(p_set_id integer)
RETURNS TABLE(team text)
LANGUAGE sql
STABLE
AS $function$
  SELECT DISTINCT team FROM card_set_entries
  WHERE set_id = p_set_id AND team IS NOT NULL
  ORDER BY team;
$function$;
