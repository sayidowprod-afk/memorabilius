-- Recherche insensible aux accents ("jokic" trouve aussi "Jokić") pour les
-- champs les plus consultes de la recherche globale (/api/recherche) :
-- profiles.display_name et cartes_manuelles (nom/equipe/variation/marque/
-- collection). PostgREST ne peut pas appeler unaccent() dans un simple
-- .ilike(), d'ou ces 2 fonctions RPC appelees depuis la route.
--
-- Volontairement limite a ces 2 tables (quelques milliers/dizaines de
-- milliers de lignes) -- card_set_entries depasse 14 millions de lignes,
-- y appliquer unaccent() sans index dedie risquerait de ralentir/timeout
-- la recherche la plus utilisee du site. A traiter separement si besoin
-- (necessiterait un index fonctionnel + une fonction unaccent IMMUTABLE,
-- plus delicat sur une table de cette taille).
--
-- A executer dans le Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION search_profiles_unaccent(q text, max_rows int DEFAULT 10)
RETURNS SETOF profiles
LANGUAGE sql STABLE
AS $$
  SELECT *
  FROM profiles
  WHERE unaccent(display_name) ILIKE '%' || unaccent(q) || '%'
  LIMIT max_rows;
$$;

CREATE OR REPLACE FUNCTION search_cartes_manuelles_unaccent(q text, max_rows int DEFAULT 500)
RETURNS SETOF cartes_manuelles
LANGUAGE sql STABLE
AS $$
  SELECT *
  FROM cartes_manuelles
  WHERE unaccent(coalesce(nom, ''))        ILIKE '%' || unaccent(q) || '%'
     OR unaccent(coalesce(equipe, ''))     ILIKE '%' || unaccent(q) || '%'
     OR unaccent(coalesce(variation, ''))  ILIKE '%' || unaccent(q) || '%'
     OR unaccent(coalesce(marque, ''))     ILIKE '%' || unaccent(q) || '%'
     OR unaccent(coalesce(collection, '')) ILIKE '%' || unaccent(q) || '%'
  LIMIT max_rows;
$$;

-- Permissions : ces fonctions ne font que lire/renvoyer des colonnes deja
-- publiques via les policies RLS existantes de chaque table (meme donnees
-- que les .ilike() directs qu'elles remplacent) -- execution ouverte aux
-- roles utilises par l'app.
GRANT EXECUTE ON FUNCTION search_profiles_unaccent(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_cartes_manuelles_unaccent(text, int) TO anon, authenticated;
