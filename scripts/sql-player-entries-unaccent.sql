-- Unifie "Nikola Jokic" / "Nikola Jokić" (sources d'import differentes, meme
-- joueur reel) pour la checklist joueur (/joueur/[slug], popup PCs, MesPCTab)
-- -- card_set_entries depasse 14 millions de lignes, donc contrairement a la
-- recherche globale (scripts/sql-search-unaccent.sql), un simple unaccent()
-- sans index dedie risquerait un scan sequentiel beaucoup trop lent/un
-- timeout sur la table la plus grosse du site. Index fonctionnel + fonction
-- IMMUTABLE requis pour que Postgres puisse s'en servir.
--
-- Purement additif : aucune colonne/index existant modifie ou supprime, le
-- reste du site continue d'utiliser card_set_entries normalement.
--
-- A executer dans le Supabase SQL Editor, CHAQUE BLOC SEPAREMENT (le CREATE
-- INDEX CONCURRENTLY ne peut pas tourner dans une transaction -- certains
-- editeurs SQL enveloppent tout le script dans une seule transaction si on
-- colle tout d'un coup). Prevoir quelques minutes pour l'index sur 14M+ lignes.

-- 1) Extension unaccent (no-op si deja active, ex: via sql-search-unaccent.sql)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2) Wrapper IMMUTABLE : unaccent() de base est seulement STABLE (depend du
--    dictionnaire de recherche courant), ce qui empeche Postgres de l'indexer
--    directement -- ce wrapper fige le dictionnaire 'unaccent' utilise.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT unaccent('unaccent', $1)
$$;

-- 3) Index fonctionnel sur le nom normalise (minuscule + sans accents).
--    text_pattern_ops : necessaire pour qu'un LIKE 'prefixe%' utilise l'index
--    quand la base n'est pas en locale C (cas par defaut chez la plupart des
--    fournisseurs, dont Supabase). CONCURRENTLY : ne bloque pas les
--    lectures/ecritures pendant la construction (plus lent a creer, mais
--    aucune interruption de service). A executer SEUL, hors transaction.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cse_player_name_unaccent
  ON card_set_entries (immutable_unaccent(lower(player_name)) text_pattern_ops);

-- 4) Fonction de recherche : meme logique que l'ancien double .ilike()
--    (prefixe prenom + sous-chaine nom) de /api/player-checklist, mais
--    insensible aux accents -- "doncic" et "dončić" renvoient desormais les
--    MEMES entrees (toutes les cartes des deux variantes d'orthographe),
--    fusionnant la checklist du joueur au lieu de la fragmenter. Inclut le
--    jointure vers card_sets directement (evite un aller-retour supplementaire
--    cote app).
--
--    IMPORTANT : le filtre prefixe utilise >= / < (recherche par intervalle),
--    PAS LIKE prefixe || '%'. Postgres ne sait extraire un prefixe fixe d'un
--    LIKE que si le motif est un LITTERAL ecrit en dur dans la requete -- des
--    qu'il est construit dynamiquement (ici via ||), l'optimisation saute et
--    l'index fonctionnel n'est plus utilise du tout -> scan complet des 14M+
--    lignes -> timeout (constate en prod). >= / < sur l'expression indexee
--    fonctionne nativement avec un index B-tree, parametre ou pas.
CREATE OR REPLACE FUNCTION search_player_entries_unaccent(p_first text, p_last text)
RETURNS TABLE (
  id int, set_id int, card_number text, variation text, is_rc boolean, is_auto boolean, image_url text,
  set_name text, set_year int, set_brand text, set_sport text
)
LANGUAGE sql STABLE
AS $$
  SELECT e.id, e.set_id, e.card_number, e.variation, e.is_rc, e.is_auto, e.image_url,
         s.name, s.year, s.brand, s.sport
  FROM card_set_entries e
  JOIN card_sets s ON s.id = e.set_id
  WHERE immutable_unaccent(lower(e.player_name)) >= immutable_unaccent(lower(p_first))
    AND immutable_unaccent(lower(e.player_name)) <  immutable_unaccent(lower(p_first)) || chr(1114111)
    AND immutable_unaccent(lower(e.player_name)) LIKE '%' || immutable_unaccent(lower(p_last)) || '%'
  ORDER BY e.set_id, e.card_number;
$$;

GRANT EXECUTE ON FUNCTION search_player_entries_unaccent(text, text) TO anon, authenticated;

-- 5) Equivalent insensible aux accents de l'ancienne fonction get_player_sets
--    (deja existante en base, utilisee par /joueur/[slug] pour la section
--    "Sets" -- definition non versionnee ici, creee a part a l'epoque). Meme
--    forme de retour (un set par ligne, is_rc/variations agreges) pour rester
--    compatible avec le code qui la consomme sans rien y changer d'autre.
CREATE OR REPLACE FUNCTION get_player_sets_unaccent(p_first text, p_last text)
RETURNS TABLE (
  id int, name text, year int, brand text, sport text,
  is_rc boolean, variations text[]
)
LANGUAGE sql STABLE
AS $$
  SELECT s.id, s.name, s.year, s.brand, s.sport,
         bool_or(e.is_rc) AS is_rc,
         array_agg(DISTINCT e.variation) FILTER (WHERE e.variation IS NOT NULL) AS variations
  FROM card_set_entries e
  JOIN card_sets s ON s.id = e.set_id
  WHERE immutable_unaccent(lower(e.player_name)) >= immutable_unaccent(lower(p_first))
    AND immutable_unaccent(lower(e.player_name)) <  immutable_unaccent(lower(p_first)) || chr(1114111)
    AND immutable_unaccent(lower(e.player_name)) LIKE '%' || immutable_unaccent(lower(p_last)) || '%'
  GROUP BY s.id, s.name, s.year, s.brand, s.sport;
$$;

GRANT EXECUTE ON FUNCTION get_player_sets_unaccent(text, text) TO anon, authenticated;
